import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Client, Project, KpiRecord, KpiMeasure, KpiMeasureMaster, KpiMeasureColumn, KpiMeasureRow, ItemMaster, User } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { firestore, getCollectionPath, firebase } from '../firebase';
import Modal from '../components/Modal';
import { ChevronRightIcon, PlusIcon, ChevronDownIcon, EditIcon, TrashIcon, SaveIcon, CancelIcon, TableViewIcon, BarChartIcon, ArrowUpwardIcon, ArrowDownwardIcon } from '../components/Icons';
import { PrimaryButton, SecondaryButton, DangerButton, IconButton } from '../components/common/Buttons';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { MeasureTable } from '../features/KpiMeasureTable';
import ManageItemMasterModal from '../features/kpi/ManageItemMasterModal';
import { copyMeasureDeep } from '../features/kpi/kpiUtils';
import { CopyMeasureModal } from '../features/kpi/CopyMeasureModal';

const ManageMastersModal: React.FC<{
    project: Project;
    masters: KpiMeasureMaster[];
    onUpdate: () => void;
    onClose: () => void;
}> = ({ project, masters: initialMasters, onUpdate, onClose }) => {
    const { currentUser } = useAuth();
    const [masters, setMasters] = useState<KpiMeasureMaster[]>(() => JSON.parse(JSON.stringify(initialMasters)));
    const [editingMasterId, setEditingMasterId] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const customColumnTypes: KpiMeasureColumn['type'][] = ['text', 'image', 'date', 'number'];
    const customTypeTranslations: Record<string, string> = { text: 'テキスト', image: '画像', date: '日付', number: '数値' };

    const handleMoveColumn = (masterId: string, colIndex: number, direction: 'up' | 'down') => {
        setMasters(prevMasters => prevMasters.map(m => {
            if (m.id === masterId) {
                const columns = m.columns;
                const newColumns = [...columns];
                const item = newColumns[colIndex];
                const swapIndex = direction === 'up' ? colIndex - 1 : colIndex + 1;
    
                if (swapIndex < 0 || swapIndex >= newColumns.length) return m;
    
                const swapItem = newColumns[swapIndex];
    
                if ((item.type === 'kpi') !== (swapItem.type === 'kpi')) {
                    return m; // Prevent moving between types
                }
    
                [newColumns[colIndex], newColumns[swapIndex]] = [swapItem, item];
                return { ...m, columns: newColumns };
            }
            return m;
        }));
    };
    
    const handleMoveRow = (masterId: string, rowIndex: number, direction: 'up' | 'down') => {
        setMasters(prevMasters => prevMasters.map(m => {
            if (m.id === masterId) {
                const rows = m.rows;
                if ((direction === 'up' && rowIndex === 0) || (direction === 'down' && rowIndex === rows.length - 1)) {
                    return m;
                }
                const newRows = [...rows];
                const [movedItem] = newRows.splice(rowIndex, 1);
                const newIndex = direction === 'up' ? rowIndex - 1 : rowIndex + 1;
                newRows.splice(newIndex, 0, movedItem);
                return { ...m, rows: newRows };
            }
            return m;
        }));
    };


    useEffect(() => {
        setMasters(JSON.parse(JSON.stringify(initialMasters)));
    }, [initialMasters]);

    const handleMasterNameChange = (id: string, name: string) => {
        setMasters(prev => prev.map(m => m.id === id ? { ...m, name } : m));
    };
    
    const handleColumnChange = (masterId: string, colIndex: number, field: keyof KpiMeasureMaster['columns'][0], value: any) => {
        setMasters(prev => prev.map(m => {
            if (m.id === masterId) {
                const newColumns = [...m.columns];
                newColumns[colIndex] = { ...newColumns[colIndex], [field]: value };
                return { ...m, columns: newColumns };
            }
            return m;
        }));
    };
    const handleAddColumn = (masterId: string, type: KpiMeasureColumn['type']) => {
        setMasters(prev => prev.map(m => {
            if (m.id === masterId) {
                const newColumn: KpiMeasureMaster['columns'][0] = {
                    id: firestore.collection('tmp').doc().id,
                    name: type === 'kpi' ? '新規KPI' : '新規列',
                    type: type,
                    order: m.columns.length,
                };
                const newColumns = [...m.columns, newColumn];
                return { ...m, columns: newColumns };
            }
            return m;
        }));
    };
    const handleDeleteColumn = (masterId: string, colIndex: number) => {
        setMasters(prev => prev.map(m => {
            if (m.id === masterId) {
                const newColumns = m.columns.filter((_, index) => index !== colIndex);
                return { ...m, columns: newColumns };
            }
            return m;
        }));
    };
    
    const handleRowChange = (masterId: string, rowIndex: number, value: string) => {
        setMasters(prev => prev.map(m => {
            if (m.id === masterId) {
                const newRows = [...m.rows];
                newRows[rowIndex] = { ...newRows[rowIndex], name: value };
                return { ...m, rows: newRows };
            }
            return m;
        }));
    };
    const handleAddRow = (masterId: string) => {
        setMasters(prev => prev.map(m => {
            if (m.id === masterId) {
                const newRows = [...m.rows, {
                    id: firestore.collection('tmp').doc().id,
                    name: '新規項目',
                    order: m.rows.length,
                }];
                return { ...m, rows: newRows };
            }
            return m;
        }));
    };
    const handleDeleteRow = (masterId: string, rowIndex: number) => {
        setMasters(prev => prev.map(m => {
            if (m.id === masterId) {
                const newRows = m.rows.filter((_, index) => index !== rowIndex);
                return { ...m, rows: newRows };
            }
            return m;
        }));
    };

    const handleCancelEdit = (masterId: string) => {
        const originalMaster = initialMasters.find(m => m.id === masterId);
        if (originalMaster) {
            setMasters(prev => prev.map(m => 
                m.id === masterId ? JSON.parse(JSON.stringify(originalMaster)) : m
            ));
        }
        setEditingMasterId(null);
        setError(null);
    };

    const handleSaveChanges = async (master: KpiMeasureMaster) => {
        if (!currentUser) return;
        setError(null);

        if (!master.name.trim()) { setError("マスター名は必須です。"); return; }
        if (master.columns.some(c => !c.name.trim())) { setError("すべての列に名前を入力してください。"); return; }
        if (master.rows.some(r => !r.name.trim())) { setError("すべての項目に名前を入力してください。"); return; }

        setLoading(true);
        try {
            const masterDocRef = firestore.doc(getCollectionPath.kpiMeasureMasterDoc(currentUser.uid, project.id, master.id));
            
            const dataToUpdate = {
                name: master.name.trim(),
                columns: master.columns.map((col, index) => ({
                    id: col.id,
                    name: col.name.trim(),
                    type: col.type,
                    order: index,
                })),
                rows: master.rows.map((row, index) => ({
                    id: row.id,
                    name: row.name.trim(),
                    order: index,
                })),
            };

            await masterDocRef.update(dataToUpdate);
            setEditingMasterId(null);
            onUpdate(); // Refresh parent state
        } catch (err: any) {
            setError(err.message || "マスターの更新に失敗しました。");
        } finally {
            setLoading(false);
        }
    };
    
    const handleDeleteMaster = async (masterId: string) => {
        if (!currentUser || !window.confirm("このマスターを削除しますか？このマスターを使用している既存の施策には影響しませんが、元に戻すことはできません。")) {
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const masterDocRef = firestore.doc(getCollectionPath.kpiMeasureMasterDoc(currentUser.uid, project.id, masterId));
            await masterDocRef.delete();
            onUpdate();
        } catch (err: any) {
            setError(err.message || "マスターの削除に失敗しました。");
        } finally {
            setLoading(false);
        }
    };
    
    return (
        <Modal title="施策マスターの管理" onClose={onClose} size="3xl">
            <div className="space-y-4" style={{ minHeight: '400px' }}>
                <p className="text-sm text-slate-600">登録済みの施策マスターテンプレートを管理します。編集ボタンで詳細な編集が可能です。</p>
                {error && <p className="text-sm text-red-600 bg-red-100 p-3 rounded-md">{error}</p>}
                <div className="space-y-3 max-h-[65vh] overflow-y-auto pr-2">
                    {masters.length > 0 ? (
                        masters.map(master => {
                            const isEditing = editingMasterId === master.id;
                            if (isEditing) {
                                const customMasterColumns = master.columns.filter(c => c.type !== 'kpi');
                                const kpiMasterColumns = master.columns.filter(c => c.type === 'kpi');
                                return (
                                    <div key={master.id} className="flex flex-col gap-4 p-4 border-2 border-sky-500 rounded-lg bg-white shadow-lg transition-all duration-300">
                                        <div className="flex justify-between items-center pb-3 border-b border-slate-200">
                                            <input
                                                type="text"
                                                value={master.name}
                                                onChange={e => handleMasterNameChange(master.id, e.target.value)}
                                                className="text-lg font-semibold px-2 py-1 border border-slate-300 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500 flex-grow"
                                            />
                                            <div className="flex items-center gap-1 ml-4">
                                                <IconButton onClick={() => handleSaveChanges(master)} disabled={loading} aria-label="保存"><SaveIcon className="text-sky-600"/></IconButton>
                                                <IconButton onClick={() => handleCancelEdit(master.id)} disabled={loading} aria-label="キャンセル"><CancelIcon/></IconButton>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                                            <div className="border rounded-lg p-4 bg-slate-50 space-y-4">
                                                <h4 className="text-lg font-bold text-slate-800 border-b pb-2 mb-4">列</h4>
                                                
                                                <div className="space-y-3">
                                                    <h5 className="font-medium text-slate-600 text-sm flex items-center gap-2"><TableViewIcon className="text-sm" />カスタム列</h5>
                                                    <div className="space-y-2 p-2 border rounded-md bg-white max-h-40 overflow-y-auto">
                                                        {customMasterColumns.map(col => {
                                                            const originalIndex = master.columns.findIndex(c => c.id === col.id);
                                                            const canMoveUp = originalIndex > 0 && master.columns[originalIndex - 1].type !== 'kpi';
                                                            const canMoveDown = originalIndex < master.columns.length - 1 && master.columns[originalIndex + 1].type !== 'kpi';
                                                            return (
                                                                <div key={col.id} className="flex items-center gap-2 p-1.5 bg-white rounded shadow-sm">
                                                                    <input type="text" placeholder="列名" value={col.name} onChange={e => handleColumnChange(master.id, originalIndex, 'name', e.target.value)} className="px-2 py-1 border border-slate-300 rounded-md focus:ring-sky-500 focus:border-sky-500 text-sm flex-grow"/>
                                                                    <select value={col.type} onChange={e => handleColumnChange(master.id, originalIndex, 'type', e.target.value as KpiMeasureColumn['type'])} className="px-2 py-1 border border-slate-300 rounded-md focus:ring-sky-500 focus:border-sky-500 text-sm w-32">
                                                                        {customColumnTypes.map(type => <option key={type} value={type}>{customTypeTranslations[type] || type}</option>)}
                                                                    </select>
                                                                    <IconButton onClick={() => handleMoveColumn(master.id, originalIndex, 'up')} disabled={!canMoveUp} aria-label="上に移動"><ArrowUpwardIcon/></IconButton>
                                                                    <IconButton onClick={() => handleMoveColumn(master.id, originalIndex, 'down')} disabled={!canMoveDown} aria-label="下に移動"><ArrowDownwardIcon/></IconButton>
                                                                    <IconButton onClick={() => handleDeleteColumn(master.id, originalIndex)} className="hover:text-red-500" aria-label="削除"><TrashIcon/></IconButton>
                                                                </div>
                                                            );
                                                        })}
                                                        {customMasterColumns.length === 0 && <p className="text-xs text-slate-500 text-center py-2">カスタム列がありません</p>}
                                                    </div>
                                                    <SecondaryButton size="sm" icon={<PlusIcon/>} onClick={() => handleAddColumn(master.id, 'text')}>カスタム列を追加</SecondaryButton>
                                                </div>

                                                <div className="space-y-3">
                                                    <h5 className="font-medium text-slate-600 text-sm flex items-center gap-2"><BarChartIcon className="text-sm" />施策KPI列</h5>
                                                    <div className="space-y-2 p-2 border rounded-md bg-white max-h-40 overflow-y-auto">
                                                        {kpiMasterColumns.map(col => {
                                                            const originalIndex = master.columns.findIndex(c => c.id === col.id);
                                                            const canMoveUp = originalIndex > 0 && master.columns[originalIndex - 1].type === 'kpi';
                                                            const canMoveDown = originalIndex < master.columns.length - 1 && master.columns[originalIndex + 1].type === 'kpi';
                                                            return (
                                                                <div key={col.id} className="flex items-center gap-2 p-1.5 bg-white rounded shadow-sm">
                                                                    <input type="text" placeholder="KPI名" value={col.name} onChange={e => handleColumnChange(master.id, originalIndex, 'name', e.target.value)} className="px-2 py-1 border border-slate-300 rounded-md focus:ring-sky-500 focus:border-sky-500 text-sm flex-grow"/>
                                                                    <IconButton onClick={() => handleMoveColumn(master.id, originalIndex, 'up')} disabled={!canMoveUp} aria-label="上に移動"><ArrowUpwardIcon/></IconButton>
                                                                    <IconButton onClick={() => handleMoveColumn(master.id, originalIndex, 'down')} disabled={!canMoveDown} aria-label="下に移動"><ArrowDownwardIcon/></IconButton>
                                                                    <IconButton onClick={() => handleDeleteColumn(master.id, originalIndex)} className="hover:text-red-500" aria-label="削除"><TrashIcon/></IconButton>
                                                                </div>
                                                            );
                                                        })}
                                                        {kpiMasterColumns.length === 0 && <p className="text-xs text-slate-500 text-center py-2">KPI列がありません</p>}
                                                    </div>
                                                     <SecondaryButton size="sm" icon={<PlusIcon/>} onClick={() => handleAddColumn(master.id, 'kpi')}>KPI列を追加</SecondaryButton>
                                                </div>

                                            </div>
                                            <div className="border rounded-lg p-4 bg-slate-50 space-y-2">
                                                <h4 className="text-lg font-bold text-slate-800 border-b pb-2 mb-4">項目</h4>
                                                <div className="space-y-2 p-2 bg-white border rounded-md max-h-60 overflow-y-auto">
                                                     {master.rows.map((row, index) => (
                                                        <div key={row.id} className="flex items-center gap-2 p-1.5 bg-white rounded shadow-sm">
                                                            <input type="text" placeholder="項目名" value={row.name} onChange={e => handleRowChange(master.id, index, e.target.value)} className="px-2 py-1 border border-slate-300 rounded-md focus:ring-sky-500 focus:border-sky-500 text-sm flex-grow"/>
                                                            <IconButton onClick={() => handleMoveRow(master.id, index, 'up')} disabled={index === 0} aria-label="上に移動"><ArrowUpwardIcon/></IconButton>
                                                            <IconButton onClick={() => handleMoveRow(master.id, index, 'down')} disabled={index === master.rows.length - 1} aria-label="下に移動"><ArrowDownwardIcon/></IconButton>
                                                            <IconButton onClick={() => handleDeleteRow(master.id, index)} className="hover:text-red-500" aria-label="削除"><TrashIcon/></IconButton>
                                                        </div>
                                                    ))}
                                                    {master.rows.length === 0 && <p className="text-xs text-slate-500 text-center py-2">項目がありません</p>}
                                                </div>
                                                <SecondaryButton size="sm" icon={<PlusIcon/>} onClick={() => handleAddRow(master.id)}>項目を追加</SecondaryButton>
                                            </div>
                                        </div>
                                    </div>
                                );
                            }
                            return (
                                <div key={master.id} className="flex items-center gap-3 p-3 border rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors">
                                    <div className="flex-grow">
                                        <p className="font-semibold text-slate-800">{master.name}</p>
                                        <p className="text-xs text-slate-500">{master.columns.length}列, {master.rows.length}項目</p>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <IconButton onClick={() => { setEditingMasterId(master.id); setError(null); }} disabled={loading} aria-label="編集"><EditIcon/></IconButton>
                                        <IconButton onClick={() => handleDeleteMaster(master.id)} disabled={loading} className="hover:text-red-500" aria-label="削除"><TrashIcon/></IconButton>
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <p className="text-center text-slate-500 py-8">登録済みのマスターはありません。</p>
                    )}
                </div>
                <div className="flex justify-end pt-4 border-t border-slate-200">
                     <SecondaryButton onClick={onClose}>閉じる</SecondaryButton>
                </div>
            </div>
        </Modal>
    );
};


const SelectMasterModal: React.FC<{
    masters: KpiMeasureMaster[];
    onSelect: (master: KpiMeasureMaster) => void;
    onClose: () => void;
}> = ({ masters, onSelect, onClose }) => {
    return (
        <Modal title="マスターから追加" onClose={onClose}>
            <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                {masters.length > 0 ? (
                    masters.map(master => (
                        <div
                            key={master.id}
                            onClick={() => onSelect(master)}
                            className="p-4 border border-slate-200 rounded-lg hover:bg-sky-50 hover:border-sky-500 cursor-pointer transition-colors"
                        >
                            <h4 className="font-semibold text-sky-700">{master.name}</h4>
                            <p className="text-xs text-slate-500 mt-1">
                                {master.columns.length}列, {master.rows.length}項目
                            </p>
                        </div>
                    ))
                ) : (
                    <p className="text-center text-slate-500 py-8">利用可能なマスターがありません。</p>
                )}
            </div>
        </Modal>
    );
};

const KpiMeasurePage: React.FC = () => {
    const { clientId, projectId, recordId } = useParams<{ clientId: string; projectId: string; recordId: string }>();
    const { currentUser } = useAuth();
    const navigate = useNavigate();
    
    const [measures, setMeasures] = useState<KpiMeasure[]>([]);
    const [masters, setMasters] = useState<KpiMeasureMaster[]>([]);
    const [itemMasters, setItemMasters] = useState<ItemMaster[]>([]);
    const [project, setProject] = useState<Project | null>(null);
    const [client, setClient] = useState<Client | null>(null);
    const [kpiRecord, setKpiRecord] = useState<KpiRecord | null>(null);
    const [allKpiRecords, setAllKpiRecords] = useState<KpiRecord[]>([]);
    
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [showManageMastersModal, setShowManageMastersModal] = useState(false);
    const [showManageItemMasterModal, setShowManageItemMasterModal] = useState(false);
    const [showSelectMasterModal, setShowSelectMasterModal] = useState(false);
    const [showCopyMeasureModal, setShowCopyMeasureModal] = useState(false);

    const sheetKpiRecords = useMemo(() => {
        if (!kpiRecord) return [];
        return allKpiRecords.filter(r => r.sheetId === kpiRecord.sheetId);
    }, [allKpiRecords, kpiRecord]);

    const fetchMasters = async () => {
        if (!currentUser || !projectId) return;
        const mastersPath = getCollectionPath.kpiMeasureMasters(currentUser.uid, projectId);
        const mastersSnapshot = await firestore.collection(mastersPath).get();
        const fetchedMasters = mastersSnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                ...data,
                id: doc.id,
                columns: data.columns || [],
                rows: data.rows || [],
            } as KpiMeasureMaster;
        });
        setMasters(fetchedMasters);
    };

    const fetchItemMasters = async () => {
        if (!currentUser || !projectId) return;
        const path = getCollectionPath.itemMasters(currentUser.uid, projectId);
        const snapshot = await firestore.collection(path).orderBy("name").get();
        const fetchedMasters = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as ItemMaster));
        setItemMasters(fetchedMasters);
    };

    useEffect(() => {
        if (!currentUser || !clientId || !projectId || !recordId) {
            setError("必要な情報が不足しています。");
            setIsLoading(false);
            return;
        }

        const fetchAllData = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const clientDoc = await firestore.doc(getCollectionPath.clientDoc(currentUser.uid, clientId)).get();
                if (!clientDoc.exists) throw new Error("クライアントが見つかりません。");
                setClient({ ...clientDoc.data(), id: clientDoc.id } as Client);

                const projectDoc = await firestore.doc(getCollectionPath.projectDoc(currentUser.uid, clientId, projectId)).get();
                if (!projectDoc.exists) throw new Error("プロジェクトが見つかりません。");
                setProject({ ...projectDoc.data(), id: projectDoc.id } as Project);

                const recordDoc = await firestore.doc(getCollectionPath.kpiRecordDoc(currentUser.uid, projectId, recordId)).get();
                if (!recordDoc.exists) throw new Error("KPIレコードが見つかりません。");
                setKpiRecord({ ...recordDoc.data(), id: recordDoc.id } as KpiRecord);
                
                const kpiRecordsSnapshot = await firestore.collection(getCollectionPath.kpiRecords(currentUser.uid, projectId)).get();
                setAllKpiRecords(kpiRecordsSnapshot.docs.map(doc => ({...doc.data(), id: doc.id} as KpiRecord)));

                await fetchMasters();
                await fetchItemMasters();

            } catch (err: any) {
                console.error("Error fetching data:", err);
                setError(err.message || "データの読み込みに失敗しました。");
            } finally {
                setIsLoading(false);
            }
        };

        fetchAllData();
    }, [currentUser, clientId, projectId, recordId]);

    useEffect(() => {
        if (!currentUser || !projectId || !recordId) return;

        const measuresPath = getCollectionPath.kpiMeasures(currentUser.uid, projectId, recordId);
        const q = firestore.collection(measuresPath).orderBy("order", "asc");

        const unsubscribe = q.onSnapshot(snapshot => {
            const fetchedMeasures = snapshot.docs.map((doc, index) => ({
                ...doc.data(),
                id: doc.id,
                order: doc.data().order ?? index,
            } as KpiMeasure));
            setMeasures(fetchedMeasures);
        }, err => {
            console.error("Error fetching KPI measures:", err);
            setError("施策データの読み込みに失敗しました。");
        });

        return () => unsubscribe();
    }, [currentUser, projectId, recordId]);

    const addMeasure = async (data: Omit<KpiMeasure, 'id'>) => {
        if (!currentUser || !projectId || !recordId) return;
        const measuresPath = getCollectionPath.kpiMeasures(currentUser.uid, projectId, recordId);
        const measureDocRef = await firestore.collection(measuresPath).add(data);
        
        const newRowData: Omit<KpiMeasureRow, 'id'> = {
            name: "新規項目", order: 0, values: {}, projectId, userId: currentUser.uid, kpiMeasureId: measureDocRef.id,
        };
        const rowsPath = getCollectionPath.kpiMeasureRows(currentUser.uid, projectId, recordId, measureDocRef.id);
        await firestore.collection(rowsPath).add(newRowData);
    };

    const handleAddBlankMeasure = async () => {
        await addMeasure({
            name: "新規施策テーブル", order: measures.length, projectId: projectId!, userId: currentUser!.uid, kpiRecordId: recordId!, masterId: null,
        });
    };

    const handleAddFromMaster = async (master: KpiMeasureMaster) => {
        setShowSelectMasterModal(false);
        if (!currentUser || !projectId || !recordId) return;

        const measureData: Omit<KpiMeasure, 'id'> = {
            name: master.name, order: measures.length, projectId: projectId, userId: currentUser.uid, kpiRecordId: recordId, masterId: master.id,
        };
        
        const measuresPath = getCollectionPath.kpiMeasures(currentUser.uid, projectId, recordId);
        const measureDocRef = await firestore.collection(measuresPath).add(measureData);
        
        if (master.rows && master.rows.length > 0) {
            const batch = firestore.batch();
            const rowsPath = getCollectionPath.kpiMeasureRows(currentUser.uid, projectId, recordId, measureDocRef.id);
            master.rows.forEach(masterRow => {
                const newRowDocRef = firestore.collection(rowsPath).doc(masterRow.id);
                const newRowData: Omit<KpiMeasureRow, 'id'> = {
                    name: masterRow.name,
                    order: masterRow.order,
                    values: {},
                    projectId: projectId,
                    userId: currentUser.uid,
                    kpiMeasureId: measureDocRef.id,
                    masterRowId: masterRow.id,
                };
                batch.set(newRowDocRef, newRowData);
            });
            await batch.commit();
        }
    };
    
    const handleDeleteMeasure = async (measureId: string) => {
        if (!currentUser || !projectId || !recordId || !window.confirm("この施策テーブル全体を削除しますか？この操作は元に戻せません。")) return;

        const batch = firestore.batch();
        const measureDocRef = firestore.doc(getCollectionPath.kpiMeasureDoc(currentUser.uid, projectId, recordId, measureId));

        const columnsPath = getCollectionPath.kpiMeasureColumns(currentUser.uid, projectId, recordId, measureId);
        const columnsSnapshot = await firestore.collection(columnsPath).get();
        columnsSnapshot.docs.forEach(doc => batch.delete(doc.ref));

        const rowsPath = getCollectionPath.kpiMeasureRows(currentUser.uid, projectId, recordId, measureId);
        const rowsSnapshot = await firestore.collection(rowsPath).get();
        rowsSnapshot.docs.forEach(doc => batch.delete(doc.ref));

        batch.delete(measureDocRef);
        await batch.commit();
    };

    const handleDuplicateMeasure = async (measureIdToDuplicate: string) => {
        if (!currentUser || !projectId || !recordId) return;
        const originalMeasure = measures.find(m => m.id === measureIdToDuplicate);
        if (!originalMeasure) {
            setError("複製元の施策が見つかりませんでした。");
            return;
        }
        setError(null);
        try {
            const batch = firestore.batch();
            await copyMeasureDeep(
                batch, currentUser, projectId,
                { recordId, measureId: measureIdToDuplicate },
                { recordId, newName: `${originalMeasure.name}のコピー`, newOrder: measures.length }
            );
            await batch.commit();
        } catch (err: any) {
            console.error("Error duplicating measure:", err);
            setError(err.message || "施策の複製に失敗しました。");
        }
    };

    const handleCopyFromOtherRecord = async (sourceRecordId: string, sourceMeasureId: string) => {
        if (!currentUser || !projectId || !recordId) {
            throw new Error("必要な情報がありません。");
        }
        const sourceMeasureDoc = await firestore.doc(getCollectionPath.kpiMeasureDoc(currentUser.uid, projectId, sourceRecordId, sourceMeasureId)).get();
        if (!sourceMeasureDoc.exists) {
            throw new Error("コピー元の施策が見つかりません。");
        }
        const sourceMeasureData = sourceMeasureDoc.data() as KpiMeasure;

        const batch = firestore.batch();
        await copyMeasureDeep(
            batch, currentUser, projectId,
            { recordId: sourceRecordId, measureId: sourceMeasureId },
            { recordId, newName: sourceMeasureData.name, newOrder: measures.length }
        );
        await batch.commit();
        setShowCopyMeasureModal(false);
    };

    if (isLoading) return <LoadingSpinner text="施策データを読み込み中..." />;
    if (error) return <div className="p-4 bg-red-100 text-red-700 rounded-md">{error} <PrimaryButton onClick={() => navigate('/dashboard')} className="mt-2">ダッシュボードに戻る</PrimaryButton></div>;
    if (!client || !project || !kpiRecord) return <div className="p-4 bg-yellow-100 text-yellow-700 rounded-md">関連データが見つかりません。</div>;

    return (
        <div className="space-y-6">
            <nav aria-label="breadcrumb" className="text-sm text-slate-600 mb-2">
                <ol className="flex items-center space-x-1">
                    <li><button onClick={() => navigate('/dashboard')} className="hover:text-sky-600 hover:underline">クライアント一覧</button></li>
                    <li><ChevronRightIcon className="text-slate-400" /><button onClick={() => navigate(`/clients/${clientId}/projects`)} className="hover:text-sky-600 hover:underline">{client.name}</button></li>
                    <li><ChevronRightIcon className="text-slate-400" /><button onClick={() => navigate(`/clients/${clientId}/projects/${projectId}/#KPI%E7%AE%A1%E7%90%86`)} className="hover:text-sky-600 hover:underline">{project.name}</button></li>
                    <li><ChevronRightIcon className="text-slate-400" /><span className="font-medium text-slate-700">施策管理: {kpiRecord.periodLabel}</span></li>
                </ol>
            </nav>

             <div className="bg-white p-6 rounded-lg shadow-md flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-semibold text-slate-800 mb-1">施策管理: {kpiRecord.periodLabel}</h2>
                    <p className="text-sm text-slate-500">プロジェクト: {project.name}</p>
                </div>
                <div className="flex items-center gap-2">
                     <SecondaryButton onClick={() => setShowManageMastersModal(true)}>テーブルマスター管理</SecondaryButton>
                     <SecondaryButton onClick={() => setShowManageItemMasterModal(true)}>項目マスター管理</SecondaryButton>
                     <div className="relative group">
                         <PrimaryButton icon={<PlusIcon/>}>施策テーブルを追加 <ChevronDownIcon className="group-hover:rotate-180 transition-transform"/></PrimaryButton>
                         <div className="absolute right-0 top-full w-56 hidden group-hover:block pt-2 z-20">
                             <div className="bg-white rounded-md shadow-lg py-1">
                                <button onClick={handleAddBlankMeasure} className="block w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">新規テーブルを追加</button>
                                <button onClick={() => setShowSelectMasterModal(true)} disabled={masters.length === 0} className="block w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed">マスターから追加</button>
                                <button onClick={() => setShowCopyMeasureModal(true)} className="block w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">他の月からコピー</button>
                             </div>
                         </div>
                     </div>
                </div>
            </div>
            
            {error && <p className="text-red-600 bg-red-100 p-3 rounded-md mb-4">{error}</p>}
            
            <div className="space-y-8">
                {measures.map((measure, index) => (
                    <div
                        key={measure.id}
                    >
                        <MeasureTable
                            measure={measure}
                            project={project}
                            onDelete={handleDeleteMeasure}
                            onDuplicate={handleDuplicateMeasure}
                            masters={masters}
                            onMastersUpdate={fetchMasters}
                            kpiRecord={kpiRecord}
                            allKpiRecords={sheetKpiRecords}
                            itemMasters={itemMasters}
                        />
                    </div>
                ))}
                {measures.length === 0 && (
                    <div className="text-center py-12 bg-white rounded-lg shadow">
                         <h3 className="mt-2 text-lg font-medium text-slate-900">施策テーブルがありません</h3>
                        <p className="mt-1 text-sm text-slate-500">最初の施策テーブルを追加して始めましょう。</p>
                    </div>
                )}
            </div>
            {showManageMastersModal && <ManageMastersModal project={project} masters={masters} onUpdate={fetchMasters} onClose={() => setShowManageMastersModal(false)} />}
            {showManageItemMasterModal && <ManageItemMasterModal project={project} initialItems={itemMasters} onUpdate={fetchItemMasters} onClose={() => setShowManageItemMasterModal(false)} />}
            {showSelectMasterModal && <SelectMasterModal masters={masters} onSelect={handleAddFromMaster} onClose={() => setShowSelectMasterModal(false)} />}
            {showCopyMeasureModal && <CopyMeasureModal project={project} currentRecordId={recordId} allKpiRecords={allKpiRecords} onClose={() => setShowCopyMeasureModal(false)} onCopy={handleCopyFromOtherRecord} />}
        </div>
    );
};

export default KpiMeasurePage;