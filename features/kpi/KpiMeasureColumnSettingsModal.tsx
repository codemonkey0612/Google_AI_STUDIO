import React, { useState, useMemo, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { firebase, firestore, getCollectionPath } from '../../firebase';
import { KpiMeasure, KpiMeasureColumn } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import Modal from '../../components/Modal';
import { PrimaryButton, SecondaryButton, IconButton } from '../../components/common/Buttons';
import { PlusIcon, TrashIcon, DragHandleIcon, BarChartIcon, TableViewIcon, ArrowUpwardIcon, ArrowDownwardIcon } from '../../components/Icons';

export const KpiMeasureColumnSettingsModal: React.FC<{
    measure: KpiMeasure,
    onClose: () => void,
    initialColumns: KpiMeasureColumn[],
    parentRowContext?: { parentMeasureId: string; parentRowId: string; };
}> = ({ measure, onClose, initialColumns, parentRowContext }) => {
    const { currentUser } = useAuth();
    const { projectId, recordId } = useParams<{ projectId: string, recordId: string }>();
    const [columns, setColumns] = useState<KpiMeasureColumn[]>(() => JSON.parse(JSON.stringify(initialColumns.sort((a,b) => a.order - b.order))));
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const draggedColumnIndex = useRef<number | null>(null);
    const dropTargetColumnIndex = useRef<number | null>(null);

    const handleDragStart = (index: number) => {
        draggedColumnIndex.current = index;
    };

    const handleDragEnter = (index: number) => {
        dropTargetColumnIndex.current = index;
    };

    const handleDragEnd = () => {
        const draggedIdx = draggedColumnIndex.current;
        const targetIdx = dropTargetColumnIndex.current;

        draggedColumnIndex.current = null;
        dropTargetColumnIndex.current = null;

        if (draggedIdx === null || targetIdx === null || draggedIdx === targetIdx) return;
        
        const isDraggedKpi = columns[draggedIdx].type === 'kpi';
        const isTargetKpi = columns[targetIdx].type === 'kpi';
        if (isDraggedKpi !== isTargetKpi) {
            return; // Don't allow reordering between types
        }

        const reorderedColumns = [...columns];
        const [draggedItem] = reorderedColumns.splice(draggedIdx, 1);
        reorderedColumns.splice(targetIdx, 0, draggedItem);
        
        setColumns(reorderedColumns);
    };

    const kpiColumns = useMemo(() => columns.filter(c => c.type === 'kpi'), [columns]);
    const customColumns = useMemo(() => columns.filter(c => c.type !== 'kpi'), [columns]);

    const handleAddColumn = (type: KpiMeasureColumn['type'] = 'text') => {
        if (!currentUser) return;
        const newCol: Omit<KpiMeasureColumn, 'isEditing'> & { id: string } = {
            id: `new-${Date.now()}`,
            projectId: measure.projectId,
            userId: currentUser.uid,
            kpiMeasureId: measure.id,
            name: type === 'kpi' ? '新規KPI' : '新規列',
            type: type,
            order: columns.length,
        };
        setColumns([...columns, newCol]);
    };

    const handleColumnChange = (id: string, field: keyof KpiMeasureColumn, value: any) => {
        setColumns(cols => cols.map(c => c.id === id ? { ...c, [field]: value } : c));
    };

    const handleDeleteColumn = (id: string) => {
        setColumns(cols => cols.filter(c => c.id !== id));
    };

    const handleSaveChanges = async () => {
        if (!currentUser || !projectId || !recordId) return;
        setLoading(true);
        setError(null);
        try {
            const columnsBatch = firestore.batch();
            
            const columnsPath = parentRowContext 
                ? getCollectionPath.kpiMeasureRowSubMeasureColumns(currentUser.uid, projectId, recordId, parentRowContext.parentMeasureId, parentRowContext.parentRowId, measure.id)
                : getCollectionPath.kpiMeasureColumns(currentUser.uid, projectId, recordId, measure.id);
            
            const rowsPath = parentRowContext
                ? getCollectionPath.kpiMeasureRowSubMeasureRows(currentUser.uid, projectId, recordId, parentRowContext.parentMeasureId, parentRowContext.parentRowId, measure.id)
                : getCollectionPath.kpiMeasureRows(currentUser.uid, projectId, recordId, measure.id);

            const finalColumns = columns.map((col, index) => ({ ...col, order: index }));

            const finalIds = new Set(finalColumns.map(c => c.id));
            const deletedColumns = initialColumns.filter(c => !finalIds.has(c.id));
            
            deletedColumns.forEach(c => columnsBatch.delete(firestore.doc(`${columnsPath}/${c.id}`)));

            for (const col of finalColumns) {
                if (!col.name.trim()) {
                    throw new Error("列名は必須です。");
                }
                
                const { isEditing, ...dataToSave } = col;

                if (col.id.startsWith('new-')) {
                    const { id, ...finalData } = dataToSave;
                    columnsBatch.set(firestore.collection(columnsPath).doc(), finalData);
                } else {
                    columnsBatch.update(firestore.doc(`${columnsPath}/${col.id}`), dataToSave);
                }
            }
            
            await columnsBatch.commit();

            if (deletedColumns.length > 0) {
                const rowsCleanupBatch = firestore.batch();
                const rowsSnapshot = await firestore.collection(rowsPath).get();
                
                rowsSnapshot.forEach(rowDoc => {
                    const updates: { [key: string]: any } = {};
                    deletedColumns.forEach(deletedCol => {
                        updates[`values.${deletedCol.id}`] = firebase.firestore.FieldValue.delete();
                    });
                    if (Object.keys(updates).length > 0) {
                        rowsCleanupBatch.update(rowDoc.ref, updates);
                    }
                });
                
                await rowsCleanupBatch.commit();
            }

            onClose();
        } catch(e: any) {
            setError(e.message || "保存中にエラーが発生しました。");
            console.error("Error saving measure columns:", e);
        } finally {
            setLoading(false);
        }
    };
    
    return (
        <Modal title={`「${measure.name}」の列を構成`} onClose={onClose} size="2xl">
            <div className="space-y-6">
                {error && <p className="text-sm text-red-600 bg-red-100 p-3 rounded-md">{error}</p>}
                
                <div className="space-y-3">
                    <div className="pb-1">
                        <h4 className="font-semibold text-slate-700 text-base">施策KPI列</h4>
                        <p className="text-xs text-slate-500">この施策テーブル内でのみ使用する独自のKPI（数値）列を追加します。</p>
                    </div>
                    <div className="space-y-2 max-h-40 overflow-y-auto pr-2 border rounded-md p-2 bg-slate-50/50">
                        {kpiColumns.length > 0 ? (
                            kpiColumns.map(col => {
                                const originalIndex = columns.findIndex(c => c.id === col.id);
                                return (
                                <div key={col.id} className="flex items-center gap-2 p-1 rounded-md bg-white shadow-sm"
                                    draggable
                                    onDragStart={() => handleDragStart(originalIndex)}
                                    onDragEnter={() => handleDragEnter(originalIndex)}
                                    onDragEnd={handleDragEnd}
                                    onDragOver={(e) => e.preventDefault()}
                                >
                                    <span className="cursor-move text-slate-400"><DragHandleIcon /></span>
                                    <input 
                                        type="text" 
                                        placeholder="KPI名" 
                                        value={col.name} 
                                        onChange={e => handleColumnChange(col.id, 'name', e.target.value)} 
                                        className="px-2 py-1 border border-slate-300 rounded-md focus:ring-sky-500 focus:border-sky-500 text-sm flex-grow" 
                                    />
                                    <IconButton onClick={() => handleDeleteColumn(col.id)} className="hover:text-red-500" aria-label="削除"><TrashIcon/></IconButton>
                                </div>
                            )})
                        ) : (
                            <p className="text-sm text-center text-slate-500 py-3">KPI列はありません。</p>
                        )}
                    </div>
                    <SecondaryButton icon={<BarChartIcon />} onClick={() => handleAddColumn('kpi')} size="sm">KPI列を追加</SecondaryButton>
                </div>

                <div className="space-y-3 border-t border-slate-200 pt-6">
                    <div className="pb-1">
                        <h4 className="font-semibold text-slate-700 text-base">カスタム列</h4>
                        <p className="text-xs text-slate-500">テキスト、数値、日付、画像など自由な形式の列を追加できます。</p>
                    </div>
                     <div className="space-y-2 max-h-40 overflow-y-auto pr-2 border rounded-md p-2 bg-slate-50/50">
                        {customColumns.length > 0 ? (
                            customColumns.map(col => {
                                const originalIndex = columns.findIndex(c => c.id === col.id);
                                return (
                                <div key={col.id} className="flex items-center gap-2 p-1 rounded-md bg-white shadow-sm"
                                    draggable
                                    onDragStart={() => handleDragStart(originalIndex)}
                                    onDragEnter={() => handleDragEnter(originalIndex)}
                                    onDragEnd={handleDragEnd}
                                    onDragOver={(e) => e.preventDefault()}
                                >
                                   <span className="cursor-move text-slate-400"><DragHandleIcon /></span>
                                   <input type="text" placeholder="列名" value={col.name} onChange={e => handleColumnChange(col.id, 'name', e.target.value)} className="px-2 py-1 border border-slate-300 rounded-md focus:ring-sky-500 focus:border-sky-500 text-sm flex-grow" />
                                   <select value={col.type} onChange={e => handleColumnChange(col.id, 'type', e.target.value)} className="px-2 py-1 border border-slate-300 rounded-md focus:ring-sky-500 focus:border-sky-500 text-sm w-36">
                                       <option value="text">テキスト</option>
                                       <option value="number">数値</option>
                                       <option value="date">日付</option>
                                       <option value="image">画像</option>
                                   </select>
                                   <IconButton onClick={() => handleDeleteColumn(col.id)} className="hover:text-red-500" aria-label="削除"><TrashIcon/></IconButton>
                                </div>
                            )})
                        ) : (
                            <p className="text-sm text-center text-slate-500 py-3">カスタム列はありません。</p>
                        )}
                    </div>
                    <PrimaryButton icon={<PlusIcon />} onClick={() => handleAddColumn('text')} size="sm">カスタム列を追加</PrimaryButton>
                </div>

                <div className="border-t border-slate-200 pt-4 flex justify-end space-x-3">
                    <SecondaryButton onClick={onClose} disabled={loading}>キャンセル</SecondaryButton>
                    <PrimaryButton onClick={handleSaveChanges} disabled={loading}>
                        {loading ? "保存中..." : "変更を保存"}
                    </PrimaryButton>
                </div>
            </div>
        </Modal>
    );
};
