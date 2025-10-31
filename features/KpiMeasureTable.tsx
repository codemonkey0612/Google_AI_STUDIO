import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Project, KpiMeasure, KpiMeasureMaster, KpiMeasureColumn, KpiMeasureRow, KpiRecord, ItemMaster } from '../types';
import { useAuth } from '../contexts/AuthContext';
// FIX: import firebase to access firebase.firestore.FieldValue
import { firestore, getCollectionPath, firebase } from '../firebase';
import { PlusIcon, SaveIcon, CancelIcon, TrashIcon, EditIcon, CogIcon, TableViewIcon, FileDownloadIcon, CloudUploadIcon, FilterListIcon, ChevronDownIcon, ContentCopyIcon } from '../components/Icons';
import { PrimaryButton, SecondaryButton, IconButton } from '../components/common/Buttons';
import { ImageUploadField, ComparisonDisplay } from './kpi/KpiComponents';
import { KpiMeasureColumnSettingsModal } from './kpi/KpiMeasureColumnSettingsModal';
import { RowVisibilitySettingsModal } from './kpi/RowVisibilitySettingsModal';
import { ColumnVisibilitySettingsModal } from './kpi/ColumnVisibilitySettingsModal';
import { RegisterMasterModal } from './kpi/RegisterMasterModal';
import { MeasureCsvImportModal } from './kpi/MeasureCsvImportModal';
import { SelectItemMasterModal } from './kpi/SelectItemMasterModal';
import { MeasureRow } from './kpi/MeasureRow';


export const MeasureTable: React.FC<{ 
    measure: KpiMeasure;
    project: Project;
    onDelete: (measureId: string) => void;
    onDuplicate: (measureId: string) => void;
    masters: KpiMeasureMaster[];
    onMastersUpdate: () => void;
    kpiRecord: KpiRecord;
    allKpiRecords: KpiRecord[];
    itemMasters: ItemMaster[];
    parentRowContext?: { parentMeasureId: string; parentRowId: string; };
}> = ({ measure, project, onDelete, onDuplicate, masters, onMastersUpdate, kpiRecord, allKpiRecords, itemMasters, parentRowContext }) => {
    const { currentUser } = useAuth();
    const { projectId, recordId } = useParams<{ projectId: string, recordId: string; }>();

    const [localColumns, setLocalColumns] = useState<KpiMeasureColumn[]>([]);
    const [rows, setRows] = useState<KpiMeasureRow[]>([]);
    const [isEditingName, setIsEditingName] = useState(false);
    const [editedName, setEditedName] = useState(measure.name);
    const [editingRowId, setEditingRowId] = useState<string | null>(null);
    const [showColumnSettings, setShowColumnSettings] = useState(false);
    const [showRegisterMaster, setShowRegisterMaster] = useState(false);
    const [showCsvImportModal, setShowCsvImportModal] = useState(false);
    const [showSelectItemMasterModal, setShowSelectItemMasterModal] = useState(false);
    const [showRowVisibilitySettings, setShowRowVisibilitySettings] = useState(false);
    const [showColumnVisibilitySettings, setShowColumnVisibilitySettings] = useState(false);
    const [hiddenRowIds, setHiddenRowIds] = useState<Set<string>>(() => new Set(measure.viewPreferences?.hiddenRowIds || []));
    const [hiddenColumnIds, setHiddenColumnIds] = useState<Set<string>>(() => new Set(measure.viewPreferences?.hiddenColumnIds || []));
    const [error, setError] = useState<string | null>(null);

    const [isSavingView, setIsSavingView] = useState(false);
    const [prevMonthData, setPrevMonthData] = useState<{ rows: Map<string, KpiMeasureRow>; columns: (KpiMeasureColumn | KpiMeasureMaster['columns'][0])[] } | null>(null);
    const [lastYearData, setLastYearData] = useState<{ rows: Map<string, KpiMeasureRow>; columns: (KpiMeasureColumn | KpiMeasureMaster['columns'][0])[] } | null>(null);

    const [visibleComparisons, setVisibleComparisons] = useState<Record<string, { prevMonth: boolean; lastYear: boolean }>>({});
    const [activeKpiFilter, setActiveKpiFilter] = useState<string | null>(null);
    const draggedRowIndex = useRef<number | null>(null);
    const dropTargetRowIndex = useRef<number | null>(null);

    useEffect(() => {
        setHiddenRowIds(new Set(measure.viewPreferences?.hiddenRowIds || []));
        setHiddenColumnIds(new Set(measure.viewPreferences?.hiddenColumnIds || []));
    }, [measure.viewPreferences]);

    useEffect(() => {
        if (!currentUser || !projectId || !recordId || !measure.id) return;
        
        const columnsPath = parentRowContext 
            ? getCollectionPath.kpiMeasureRowSubMeasureColumns(currentUser.uid, projectId, recordId, parentRowContext.parentMeasureId, parentRowContext.parentRowId, measure.id)
            : getCollectionPath.kpiMeasureColumns(currentUser.uid, projectId, recordId, measure.id);

        const q = firestore.collection(columnsPath).orderBy("order", "asc");
        const unsubscribe = q.onSnapshot(snapshot => {
            setLocalColumns(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as KpiMeasureColumn)));
        }, err => console.error("Error fetching measure columns", err));
        return unsubscribe;
    }, [currentUser, projectId, recordId, measure.id, parentRowContext]);

    useEffect(() => {
        if (!currentUser || !projectId || !recordId || !measure.id) return;
        
        const rowsPath = parentRowContext
            ? getCollectionPath.kpiMeasureRowSubMeasureRows(currentUser.uid, projectId, recordId, parentRowContext.parentMeasureId, parentRowContext.parentRowId, measure.id)
            : getCollectionPath.kpiMeasureRows(currentUser.uid, projectId, recordId, measure.id);

        const q = firestore.collection(rowsPath).orderBy("order", "asc");
        const unsubscribe = q.onSnapshot(snapshot => {
            setRows(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as KpiMeasureRow)));
        }, err => console.error("Error fetching measure rows", err));
        return unsubscribe;
    }, [currentUser, projectId, recordId, measure.id, parentRowContext]);

    const isMasterLinked = !!measure.masterId;
    const master = useMemo(() => isMasterLinked ? masters.find(m => m.id === measure.masterId) : null, [isMasterLinked, masters, measure.masterId]);

    const displayColumns = useMemo(() => {
        return master ? master.columns.sort((a,b) => a.order - b.order) : localColumns;
    }, [master, localColumns]);

    const visibleRows = useMemo(() => rows.filter(r => !hiddenRowIds.has(r.id)), [rows, hiddenRowIds]);

    const kpiColumns = useMemo(() => displayColumns.filter(c => c.type === 'kpi'), [displayColumns]);
    const customColumns = useMemo(() => displayColumns.filter(c => c.type !== 'kpi'), [displayColumns]);
    
    const visibleKpiColumns = useMemo(() => kpiColumns.filter(c => !hiddenColumnIds.has(c.id)), [kpiColumns, hiddenColumnIds]);
    const visibleCustomColumns = useMemo(() => customColumns.filter(c => !hiddenColumnIds.has(c.id)), [customColumns, hiddenColumnIds]);

    useEffect(() => {
        const saved = measure.viewPreferences?.visibleComparisons || {};
        const newState: Record<string, { prevMonth: boolean; lastYear: boolean }> = {};
        kpiColumns.forEach(item => {
            newState[item.id] = saved[item.id] ?? { prevMonth: true, lastYear: true };
        });
        setVisibleComparisons(newState);
    }, [kpiColumns, measure.viewPreferences]);

    const handleVisibilityChange = (itemId: string, type: 'prevMonth' | 'lastYear', isVisible: boolean) => {
        setVisibleComparisons(prev => ({
            ...prev,
            [itemId]: {
                ...(prev[itemId] || { prevMonth: true, lastYear: true }),
                [type]: isVisible,
            }
        }));
    };

    const handleSaveView = async () => {
        if (!currentUser || !projectId || !recordId) return;
        setIsSavingView(true);
        setError(null);
        try {
          const measureDocRef = parentRowContext
            ? firestore.doc(getCollectionPath.kpiMeasureRowSubMeasureDoc(currentUser.uid, projectId, recordId, parentRowContext.parentMeasureId, parentRowContext.parentRowId, measure.id))
            : firestore.doc(getCollectionPath.kpiMeasureDoc(currentUser.uid, projectId, recordId, measure.id));
            
          await measureDocRef.update({
            'viewPreferences.visibleComparisons': visibleComparisons,
          });
        } catch (err) {
          console.error("Failed to save view preferences:", err);
          setError("ビュー設定の保存に失敗しました。");
        } finally {
          setIsSavingView(false);
        }
    };

    const handleSaveRowVisibility = async (newHiddenIds: Set<string>) => {
        if (!currentUser || !projectId || !recordId) return;
        const hiddenIdsArray = Array.from(newHiddenIds);
        
        try {
            const measureDocRef = parentRowContext
                ? firestore.doc(getCollectionPath.kpiMeasureRowSubMeasureDoc(currentUser.uid, projectId, recordId, parentRowContext.parentMeasureId, parentRowContext.parentRowId, measure.id))
                : firestore.doc(getCollectionPath.kpiMeasureDoc(currentUser.uid, projectId, recordId, measure.id));
                
            await measureDocRef.update({
                'viewPreferences.hiddenRowIds': hiddenIdsArray,
            });
            setHiddenRowIds(new Set(hiddenIdsArray));
            setShowRowVisibilitySettings(false);
        } catch(err) {
            console.error("Failed to save visibility settings:", err);
            setError("表示設定の保存に失敗しました。");
        }
    };

    const handleSaveColumnVisibility = async (newHiddenIds: Set<string>) => {
        if (!currentUser || !projectId || !recordId) return;
        const hiddenIdsArray = Array.from(newHiddenIds);
        
        try {
            const measureDocRef = parentRowContext
                ? firestore.doc(getCollectionPath.kpiMeasureRowSubMeasureDoc(currentUser.uid, projectId, recordId, parentRowContext.parentMeasureId, parentRowContext.parentRowId, measure.id))
                : firestore.doc(getCollectionPath.kpiMeasureDoc(currentUser.uid, projectId, recordId, measure.id));
                
            await measureDocRef.update({
                'viewPreferences.hiddenColumnIds': hiddenIdsArray,
            });
            setHiddenColumnIds(new Set(hiddenIdsArray));
            setShowColumnVisibilitySettings(false);
        } catch(err) {
            console.error("Failed to save column visibility settings:", err);
            setError("列の表示設定の保存に失敗しました。");
        }
    };

    useEffect(() => {
        const isMonthly = /^\d{4}年\d{1,2}月$/.test(kpiRecord.periodLabel);
        if (!isMonthly || !currentUser || !projectId) {
            setPrevMonthData(null);
            setLastYearData(null);
            return;
        }

        const fetchComparisonDataFor = async (targetRecord: KpiRecord | undefined) => {
            if (!targetRecord) return null;
            
            let comparisonMeasureSnapshot: firebase.firestore.QuerySnapshot;

            if (parentRowContext) {
                 const parentMeasuresCollectionRef = firestore.collection(getCollectionPath.kpiMeasures(currentUser.uid, projectId, targetRecord.id));
                 const parentMeasureData = (await firestore.doc(getCollectionPath.kpiMeasureDoc(currentUser.uid, projectId, kpiRecord.id, parentRowContext.parentMeasureId)).get()).data();
                 if(!parentMeasureData) return null;

                 const parentMeasureQuery = parentMeasureData.masterId 
                     ? parentMeasuresCollectionRef.where("masterId", "==", parentMeasureData.masterId)
                     : parentMeasuresCollectionRef.where("name", "==", parentMeasureData.name);
                 const parentMeasuresSnapshot = await parentMeasureQuery.limit(1).get();
                 if (parentMeasuresSnapshot.empty) return null;
                 const historicalParentMeasureRef = parentMeasuresSnapshot.docs[0].ref;

                 const parentRowData = (await firestore.doc(getCollectionPath.kpiMeasureRowDoc(currentUser.uid, projectId, kpiRecord.id, parentRowContext.parentMeasureId, parentRowContext.parentRowId)).get()).data();
                 if(!parentRowData) return null;

                 const parentRowQuery = parentRowData.masterRowId
                    ? historicalParentMeasureRef.collection('rows').where(firebase.firestore.FieldPath.documentId(), "==", parentRowData.masterRowId)
                    : historicalParentMeasureRef.collection('rows').where("name", "==", parentRowData.name);
                 const parentRowsSnapshot = await parentRowQuery.limit(1).get();
                 if(parentRowsSnapshot.empty) return null;
                 const historicalParentRowRef = parentRowsSnapshot.docs[0].ref;

                 const subMeasuresCollectionRef = historicalParentRowRef.collection('measures');
                 const subMeasureQuery = measure.masterId 
                    ? subMeasuresCollectionRef.where("masterId", "==", measure.masterId)
                    : subMeasuresCollectionRef.where("name", "==", measure.name);
                 comparisonMeasureSnapshot = await subMeasureQuery.limit(1).get();

            } else { // Top-level measure
                const measuresCollectionRef = firestore.collection(getCollectionPath.kpiMeasures(currentUser.uid, projectId, targetRecord.id));
                const measureQuery = measure.masterId
                    ? measuresCollectionRef.where("masterId", "==", measure.masterId)
                    : measuresCollectionRef.where("name", "==", measure.name);
                comparisonMeasureSnapshot = await measureQuery.limit(1).get();
            }

            if (comparisonMeasureSnapshot.empty) return null;
            
            const comparisonMeasureDoc = comparisonMeasureSnapshot.docs[0];
            const comparisonMeasure = { ...comparisonMeasureDoc.data(), id: comparisonMeasureDoc.id } as KpiMeasure;
            
            let comparisonColumns: (KpiMeasureColumn | KpiMeasureMaster['columns'][0])[];
            if (comparisonMeasure.masterId) {
                const master = masters.find(m => m.id === comparisonMeasure.masterId);
                comparisonColumns = master ? master.columns : [];
            } else {
                 const colsSnapshot = await comparisonMeasureDoc.ref.collection('columns').orderBy("order").get();
                comparisonColumns = colsSnapshot.docs.map(d => ({...d.data(), id: d.id} as KpiMeasureColumn));
            }
            
            const rowsSnapshot = await comparisonMeasureDoc.ref.collection('rows').get();
            const rowsMap = new Map<string, KpiMeasureRow>();
            rowsSnapshot.forEach(doc => {
                const row = { ...doc.data(), id: doc.id } as KpiMeasureRow;
                const key = measure.masterId ? row.masterRowId : row.name;
                if (key) {
                    rowsMap.set(key, row);
                }
            });

            return { rows: rowsMap, columns: comparisonColumns };
        };
        
        const match = kpiRecord.periodLabel.match(/(\d{4})年(\d{1,2})月/);
        if (match) {
            const year = parseInt(match[1], 10);
            const month = parseInt(match[2], 10);
            
            const prevMonthDate = new Date(year, month - 1, 0);
            const prevMonthLabel = `${prevMonthDate.getFullYear()}年${prevMonthDate.getMonth() + 1}月`;
            const prevMonthRecord = allKpiRecords.find(r => r.periodLabel === prevMonthLabel);
            
            const lastYearDate = new Date(year - 1, month - 1);
            const lastYearLabel = `${lastYearDate.getFullYear()}年${lastYearDate.getMonth() + 1}月`;
            const lastYearRecord = allKpiRecords.find(r => r.periodLabel === lastYearLabel);

            fetchComparisonDataFor(prevMonthRecord).then(setPrevMonthData);
            fetchComparisonDataFor(lastYearRecord).then(setLastYearData);
        }

    }, [kpiRecord, allKpiRecords, currentUser, projectId, measure.name, measure.masterId, masters, parentRowContext]);


    const handleUpdateMeasureName = async () => {
        if (!currentUser || !editedName.trim() || !projectId || !recordId) return;
        
        const measureDocRef = parentRowContext
            ? firestore.doc(getCollectionPath.kpiMeasureRowSubMeasureDoc(currentUser.uid, projectId, recordId, parentRowContext.parentMeasureId, parentRowContext.parentRowId, measure.id))
            : firestore.doc(getCollectionPath.kpiMeasureDoc(currentUser.uid, projectId, recordId, measure.id));
            
        await measureDocRef.update({ name: editedName.trim() });
        setIsEditingName(false);
    };

    const handleAddBlankRow = async () => {
        if (!currentUser || !projectId || !recordId || isMasterLinked) return;
        const newRow: Omit<KpiMeasureRow, 'id'> = {
            name: "新規項目", order: rows.length, values: {}, projectId, userId: currentUser.uid, kpiMeasureId: measure.id,
        };
        
        const rowsPath = parentRowContext
            ? getCollectionPath.kpiMeasureRowSubMeasureRows(currentUser.uid, projectId, recordId, parentRowContext.parentMeasureId, parentRowContext.parentRowId, measure.id)
            : getCollectionPath.kpiMeasureRows(currentUser.uid, projectId, recordId, measure.id);
            
        await firestore.collection(rowsPath).add(newRow);
    };

    const handleAddRowsFromMaster = async (selectedMasters: ItemMaster[]) => {
        setShowSelectItemMasterModal(false);
        if (!currentUser || !projectId || !recordId || isMasterLinked || selectedMasters.length === 0) return;

        const batch = firestore.batch();
        const rowsPath = parentRowContext
            ? getCollectionPath.kpiMeasureRowSubMeasureRows(currentUser.uid, projectId, recordId, parentRowContext.parentMeasureId, parentRowContext.parentRowId, measure.id)
            : getCollectionPath.kpiMeasureRows(currentUser.uid, projectId, recordId, measure.id);
            
        let currentMaxOrder = rows.length > 0 ? Math.max(...rows.map(r => r.order), -1) : -1;
        const existingRowNames = new Set(rows.map(r => r.name));

        selectedMasters.forEach(master => {
            if (existingRowNames.has(master.name)) return; 

            currentMaxOrder++;
            const newRow: Omit<KpiMeasureRow, 'id'> = {
                name: master.name,
                order: currentMaxOrder,
                values: {},
                projectId,
                userId: currentUser.uid,
                kpiMeasureId: measure.id,
            };
            const newRowRef = firestore.collection(rowsPath).doc();
            batch.set(newRowRef, newRow);
        });

        try {
            await batch.commit();
        } catch (err) {
            setError("マスターからの項目追加に失敗しました。");
            console.error(err);
        }
    };

    const handleUpdateRow = async (rowId: string, newValues: Record<string, any>) => {
        if (!currentUser || !projectId || !recordId) {
            throw new Error("User or project information is missing.");
        }
    
        const rowDocRef = parentRowContext
            ? firestore.doc(getCollectionPath.kpiMeasureRowSubMeasureRowDoc(currentUser.uid, projectId, recordId, parentRowContext.parentMeasureId, parentRowContext.parentRowId, measure.id, rowId))
            : firestore.doc(getCollectionPath.kpiMeasureRowDoc(currentUser.uid, projectId, recordId, measure.id, rowId));
            
        try {
            await rowDocRef.update(newValues);
            setEditingRowId(null);
        } catch (err) {
            console.error("Failed to update row:", err);
            setError("項目の更新に失敗しました。");
            throw err; // Re-throw the error to be caught by the caller
        }
    };

    const handleDeleteRow = async (rowId: string) => {
        if (!currentUser || !projectId || !recordId || isMasterLinked || !window.confirm("この項目を削除しますか？")) return;
        
        const rowDocRef = parentRowContext
            ? firestore.doc(getCollectionPath.kpiMeasureRowSubMeasureRowDoc(currentUser.uid, projectId, recordId, parentRowContext.parentMeasureId, parentRowContext.parentRowId, measure.id, rowId))
            : firestore.doc(getCollectionPath.kpiMeasureRowDoc(currentUser.uid, projectId, recordId, measure.id, rowId));
        
        await rowDocRef.delete();
    };
    
    const handleRegisterAsMaster = async (masterName: string) => {
        if (!currentUser || !projectId || !recordId) {
            throw new Error("必要な情報が不足しています。");
        }
    
        const batch = firestore.batch();

        // 1. Prepare new master data with stable new IDs
        const newMasterRows = rows.map((row, index) => ({ id: firestore.collection('tmp').doc().id, name: row.name, order: index }));
        const newMasterCols = localColumns.map((col, index) => ({ id: firestore.collection('tmp').doc().id, name: col.name, type: col.type, order: index }));

        const newMasterData: Omit<KpiMeasureMaster, 'id'> = {
            name: masterName,
            projectId: projectId,
            userId: currentUser.uid,
            columns: newMasterCols,
            rows: newMasterRows,
        };

        // 2. Add new master to batch
        const mastersPath = getCollectionPath.kpiMeasureMasters(currentUser.uid, projectId);
        const newMasterRef = firestore.collection(mastersPath).doc();
        batch.set(newMasterRef, newMasterData);

        // 3. Update current measure to link to the new master
        const measureDocRef = parentRowContext
            ? firestore.doc(getCollectionPath.kpiMeasureRowSubMeasureDoc(currentUser.uid, projectId, recordId, parentRowContext.parentMeasureId, parentRowContext.parentRowId, measure.id))
            : firestore.doc(getCollectionPath.kpiMeasureDoc(currentUser.uid, projectId, recordId, measure.id));
        batch.update(measureDocRef, { masterId: newMasterRef.id });

        // 4. Update current rows to link to their new master rows
        const rowNameToMasterIdMap = new Map(newMasterRows.map(r => [r.name, r.id]));
        const rowsPath = parentRowContext
            ? getCollectionPath.kpiMeasureRowSubMeasureRows(currentUser.uid, projectId, recordId, parentRowContext.parentMeasureId, parentRowContext.parentRowId, measure.id)
            : getCollectionPath.kpiMeasureRows(currentUser.uid, projectId, recordId, measure.id);

        rows.forEach(row => {
            const masterRowId = rowNameToMasterIdMap.get(row.name);
            if (masterRowId) {
                const rowDocRef = firestore.doc(`${rowsPath}/${row.id}`);
                batch.update(rowDocRef, { masterRowId: masterRowId });
            }
        });
        
        // 5. Commit batch
        await batch.commit();
        setShowRegisterMaster(false);
        onMastersUpdate();
    };

    const handleRowDragStart = (e: React.DragEvent, visibleIndex: number) => {
        const draggedRow = visibleRows[visibleIndex];
        const originalIndex = rows.findIndex(r => r.id === draggedRow.id);
        draggedRowIndex.current = originalIndex;
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleRowDragEnter = (visibleIndex: number) => {
        const targetRow = visibleRows[visibleIndex];
        const originalIndex = rows.findIndex(r => r.id === targetRow.id);
        dropTargetRowIndex.current = originalIndex;
    };
    
    const handleRowDragEnd = async () => {
        const draggedIdx = draggedRowIndex.current;
        const targetIdx = dropTargetRowIndex.current;
    
        draggedRowIndex.current = null;
        dropTargetRowIndex.current = null;
    
        if (draggedIdx === null || targetIdx === null || draggedIdx === targetIdx) return;
    
        const originalRows = [...rows];
        const reorderedRows = [...rows]; // Use full `rows` array for reordering logic
        const [draggedItem] = reorderedRows.splice(draggedIdx, 1);
        reorderedRows.splice(targetIdx, 0, draggedItem);
        
        setRows(reorderedRows); // Optimistic update of full state
    
        if (!currentUser || !projectId || !recordId) return;
    
        const batch = firestore.batch();
        const rowsPath = parentRowContext
            ? getCollectionPath.kpiMeasureRowSubMeasureRows(currentUser.uid, projectId, recordId, parentRowContext.parentMeasureId, parentRowContext.parentRowId, measure.id)
            : getCollectionPath.kpiMeasureRows(currentUser.uid, projectId, recordId, measure.id);
        
        reorderedRows.forEach((row, index) => {
            if (row.order !== index) {
                const docRef = firestore.doc(`${rowsPath}/${row.id}`);
                batch.update(docRef, { order: index });
            }
        });
        
        try {
            await batch.commit();
        } catch (err) {
            console.error("Error reordering rows:", err);
            setError("項目の並び替えに失敗しました。");
            setRows(originalRows); // Revert on failure
        }
    };

    const totalKpiColSpan = visibleKpiColumns.reduce((acc, item) => {
        const isPrevMonthVisible = visibleComparisons[item.id]?.prevMonth ?? true;
        const isLastYearVisible = visibleComparisons[item.id]?.lastYear ?? true;
        return acc + 1 + (isPrevMonthVisible ? 1 : 0) + (isLastYearVisible ? 2 : 0);
    }, 0);
    const emptyStateColSpan = 1 + visibleCustomColumns.length + totalKpiColSpan + 1;

    return (
        <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md space-y-4 group">
            <div className="space-y-4">
                <div className="flex justify-between items-center pb-3 border-b border-slate-200">
                    <div className="flex items-center gap-2 flex-grow min-w-0">
                        {isEditingName ? (
                            <div className="flex items-center gap-2">
                                <input
                                    type="text" value={editedName} onChange={(e) => setEditedName(e.target.value)}
                                    className="text-xl font-semibold px-2 py-1 border border-slate-300 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500"
                                    onBlur={handleUpdateMeasureName} onKeyDown={e => e.key === 'Enter' && handleUpdateMeasureName()}
                                    autoFocus
                                />
                                <IconButton onClick={handleUpdateMeasureName} aria-label="保存"><SaveIcon className="text-sky-600"/></IconButton>
                                <IconButton onClick={() => { setIsEditingName(false); setEditedName(measure.name); }} aria-label="キャンセル"><CancelIcon/></IconButton>
                            </div>
                        ) : (
                            <h3 className="text-xl font-semibold text-slate-800 flex items-center gap-2">
                               {measure.name}
                               <IconButton onClick={() => setIsEditingName(true)} aria-label="施策名を編集" className="opacity-0 group-hover:opacity-100 transition-opacity"><EditIcon className="text-sm"/></IconButton>
                            </h3>
                        )}
                        {isMasterLinked && master && <span className="text-xs bg-violet-100 text-violet-700 font-medium px-2 py-0.5 rounded-full" title={`マスター: ${master.name}`}>マスター</span>}
                    </div>
                    <div className="flex items-center gap-2">
                         <SecondaryButton size="sm" icon={<SaveIcon />} onClick={handleSaveView} disabled={isSavingView}>
                            {isSavingView ? '...' : '表示保存'}
                        </SecondaryButton>
                         <SecondaryButton size="sm" icon={<CloudUploadIcon />} onClick={() => setShowCsvImportModal(true)}>CSVインポート</SecondaryButton>
                         {!isMasterLinked && <SecondaryButton size="sm" onClick={() => setShowRegisterMaster(true)}>マスターとして登録</SecondaryButton>}
                         <IconButton onClick={() => setShowRowVisibilitySettings(true)} aria-label="項目の表示設定"><FilterListIcon/></IconButton>
                         <IconButton onClick={() => setShowColumnVisibilitySettings(true)} aria-label="列の表示設定"><TableViewIcon/></IconButton>
                         <IconButton onClick={() => onDuplicate(measure.id)} aria-label="テーブルを複製"><ContentCopyIcon /></IconButton>
                         <IconButton onClick={() => setShowColumnSettings(true)} disabled={isMasterLinked} aria-label="列を構成"><CogIcon/></IconButton>
                         <IconButton onClick={() => onDelete(measure.id)} className="hover:text-red-500" aria-label="テーブルを削除"><TrashIcon/></IconButton>
                    </div>
                </div>

                {error && <p className="text-red-600 bg-red-100 p-3 rounded-md">{error}</p>}
                <div className="overflow-x-auto text-sm">
                    <table className="min-w-full border-collapse">
                        <thead className="bg-slate-50 text-slate-600">
                            <tr>
                                <th rowSpan={2} className="p-3 text-left font-semibold border-b-2 border-l border-slate-200 w-48 align-bottom whitespace-nowrap">項目名</th>
                                {visibleCustomColumns.map(col => (
                                    <th key={col.id} rowSpan={2} className="p-3 text-left font-semibold border-b-2 border-l border-slate-200 w-48 align-bottom whitespace-nowrap truncate">{col.name}</th>
                                ))}
                                {visibleKpiColumns.map(col => {
                                    const isPrevMonthVisible = visibleComparisons[col.id]?.prevMonth ?? true;
                                    const isLastYearVisible = visibleComparisons[col.id]?.lastYear ?? true;
                                    const kpiItemColSpan = 1 + (isPrevMonthVisible ? 1 : 0) + (isLastYearVisible ? 2 : 0);
                                    return (
                                        <th key={col.id} colSpan={kpiItemColSpan} className="p-2 text-center font-semibold border-b-2 border-l border-slate-200">
                                            <div className="flex items-center justify-center gap-1 relative">
                                                <span className="truncate" title={col.name}>{col.name}</span>
                                                <IconButton
                                                    onClick={() => setActiveKpiFilter(activeKpiFilter === col.id ? null : col.id)}
                                                    aria-label={`${col.name}の表示オプション`}
                                                    className="p-0.5"
                                                >
                                                    <FilterListIcon className="text-xs"/>
                                                </IconButton>
                                                {activeKpiFilter === col.id && (
                                                    <div className="absolute top-full mt-2 right-0 w-40 bg-white border border-slate-200 rounded-md shadow-lg z-20 p-2 text-left" onMouseLeave={()=>setActiveKpiFilter(null)}>
                                                        <p className="text-xs font-semibold text-slate-700 mb-2">表示設定</p>
                                                        <div className="space-y-2">
                                                            <label className="flex items-center space-x-2 cursor-pointer">
                                                                <input type="checkbox" checked={isPrevMonthVisible} onChange={e => handleVisibilityChange(col.id, 'prevMonth', e.target.checked)} className="h-4 w-4 text-sky-600 border-slate-300 rounded focus:ring-sky-500" />
                                                                <span className="text-sm font-normal text-slate-600">前月比</span>
                                                            </label>
                                                            <label className="flex items-center space-x-2 cursor-pointer">
                                                                <input type="checkbox" checked={isLastYearVisible} onChange={e => handleVisibilityChange(col.id, 'lastYear', e.target.checked)} className="h-4 w-4 text-sky-600 border-slate-300 rounded focus:ring-sky-500" />
                                                                <span className="text-sm font-normal text-slate-600">昨対比</span>
                                                            </label>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </th>
                                    );
                                })}
                                <th rowSpan={2} className="w-24 border-b-2 border-l border-r border-slate-200 align-bottom"></th>
                            </tr>
                            <tr>
                                {visibleKpiColumns.map(col => {
                                    const isPrevMonthVisible = visibleComparisons[col.id]?.prevMonth ?? true;
                                    const isLastYearVisible = visibleComparisons[col.id]?.lastYear ?? true;
                                    return (
                                    <React.Fragment key={`${col.id}-sub`}>
                                        <th className="p-2 text-right font-medium border-b-2 border-slate-200 bg-slate-100 border-l w-32">実績</th>
                                        {isPrevMonthVisible && <th className="p-2 text-right font-medium border-b-2 border-slate-200 bg-slate-100 w-32">前月比</th>}
                                        {isLastYearVisible && <th className="p-2 text-right font-medium border-b-2 border-slate-200 bg-slate-100 w-32">昨年実績</th>}
                                        {isLastYearVisible && <th className="p-2 text-right font-medium border-b-2 border-slate-200 bg-slate-100 w-32">昨年対比</th>}
                                    </React.Fragment>
                                )})}
                            </tr>
                        </thead>
                        <tbody>
                            {visibleRows.map((row, index) => (
                                <MeasureRow
                                    key={row.id}
                                    measureId={measure.id}
                                    row={row}
                                    customColumns={visibleCustomColumns}
                                    kpiColumns={visibleKpiColumns}
                                    project={project}
                                    isEditing={editingRowId === row.id}
                                    onStartEdit={() => setEditingRowId(row.id)}
                                    onCancelEdit={() => setEditingRowId(null)}
                                    onUpdate={handleUpdateRow}
                                    onDelete={handleDeleteRow}
                                    prevMonthData={prevMonthData}
                                    lastYearData={lastYearData}
                                    isMasterLinked={isMasterLinked}
                                    visibleComparisons={visibleComparisons}
                                    canDrag={!isMasterLinked}
                                    onDragStart={(e) => handleRowDragStart(e, index)}
                                    onDragEnter={() => handleRowDragEnter(index)}
                                    onDragEnd={handleRowDragEnd}
                                    onDragOver={(e) => e.preventDefault()}
                                />
                            ))}
                        </tbody>
                    </table>
                     {rows.length === 0 && <p className="text-center text-slate-500 py-6">データがありません。</p>}
                </div>
            </div>
            <div className="pt-2">
                 <div className="relative group inline-block">
                    <PrimaryButton icon={<PlusIcon/>} disabled={isMasterLinked} size="sm">
                        項目を追加 <ChevronDownIcon className="group-hover:rotate-180 transition-transform duration-200"/>
                    </PrimaryButton>
                    <div className="absolute left-0 top-full w-48 hidden group-hover:block pt-2 z-20">
                        <div className="bg-white rounded-md shadow-lg py-1 ring-1 ring-black ring-opacity-5">
                            <button onClick={handleAddBlankRow} className="block w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">空白の項目を追加</button>
                            <button onClick={() => setShowSelectItemMasterModal(true)} disabled={itemMasters.length === 0} className="block w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed">マスターから追加</button>
                        </div>
                    </div>
                </div>
            </div>
            {showColumnSettings && <KpiMeasureColumnSettingsModal measure={measure} initialColumns={localColumns} onClose={() => setShowColumnSettings(false)} parentRowContext={parentRowContext} />}
            {showRegisterMaster && <RegisterMasterModal onRegister={handleRegisterAsMaster} onClose={() => setShowRegisterMaster(false)} />}
            {showCsvImportModal && <MeasureCsvImportModal measure={measure} customColumns={customColumns} kpiColumns={kpiColumns} rows={rows} onClose={() => setShowCsvImportModal(false)} parentRowContext={parentRowContext} />}
            {showSelectItemMasterModal && (
                <SelectItemMasterModal
                    masters={itemMasters}
                    existingRowNames={rows.map(r => r.name)}
                    onAdd={handleAddRowsFromMaster}
                    onClose={() => setShowSelectItemMasterModal(false)}
                />
            )}
            {showRowVisibilitySettings && (
                <RowVisibilitySettingsModal
                    rows={rows}
                    initialHiddenIds={hiddenRowIds}
                    onSave={handleSaveRowVisibility}
                    onClose={() => setShowRowVisibilitySettings(false)}
                />
            )}
             {showColumnVisibilitySettings && (
                <ColumnVisibilitySettingsModal
                    columns={displayColumns}
                    initialHiddenIds={hiddenColumnIds}
                    onSave={handleSaveColumnVisibility}
                    onClose={() => setShowColumnVisibilitySettings(false)}
                />
            )}
        </div>
    );
};
