import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Client, Project, ProjectDetailTab, ProjectType, IncomeExpenseItem, ScheduleTask, KpiItem, KpiRecord, KpiCustomColumn, IncomeExpenseSheet, ScheduleSheet, KpiSheet, BaseSheet, Memo, MemoGroup, Bookmark, ProjectFile, BookmarkGroup, FileGroup, TimeScheduleSheet, TimeScheduleEntry } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { firestore, getCollectionPath } from '../firebase';
import { ChevronRightIcon, PlusIcon, EditIcon, SaveIcon, CancelIcon, ChevronLeftIcon } from '../components/Icons';
import { PrimaryButton, SecondaryButton, IconButton } from '../components/common/Buttons';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { formatDate } from '../utils';
import IncomeExpenseManagementTab from '../features/IncomeExpenseTab';
import GanttScheduleTab from '../features/ScheduleTab';
import TimeScheduleTab from '../features/TimeScheduleTab';
import KpiManagementTab from '../features/KpiTab';
import MemoTab from '../features/MemoTab';
import BookmarkTab from '../contexts/BookmarkTab';
import FileTab from '../components/FileTab';
import { ManagementSheet } from '../components/ManagementSheet';
import Modal from '../components/Modal';

const SheetNameModal: React.FC<{
  title: string;
  onConfirm: (name: string) => Promise<void>;
  onClose: () => void;
  initialName?: string;
  confirmButtonText?: string;
}> = ({ title, onConfirm, onClose, initialName = '', confirmButtonText = "作成" }) => {
    const [name, setName] = useState(initialName);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        setName(initialName);
    }, [initialName]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) {
            setError("シート名は必須です。");
            return;
        }
        setLoading(true);
        setError('');
        try {
            await onConfirm(name.trim());
            onClose();
        } catch (err: any) {
            setError(err.message || "シートの作成/複製に失敗しました。");
            setLoading(false);
        }
    };

    return (
        <Modal title={title} onClose={onClose}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label htmlFor="sheet-name" className="block text-sm font-medium text-slate-700 mb-1">
                        シート名
                    </label>
                    <input
                        id="sheet-name"
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        className="block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                        placeholder="例: フェーズ1予算"
                        autoFocus
                    />
                </div>
                {error && <p className="text-sm text-red-600">{error}</p>}
                <div className="flex justify-end space-x-3 pt-2">
                    <SecondaryButton type="button" onClick={onClose} disabled={loading}>キャンセル</SecondaryButton>
                    <PrimaryButton type="submit" disabled={loading}>
                        {loading ? "処理中..." : confirmButtonText}
                    </PrimaryButton>
                </div>
            </form>
        </Modal>
    );
};

const TimeScheduleSheetModal: React.FC<{
  onConfirm: (name: string, dates: string[]) => Promise<void>;
  onClose: () => void;
  sheetToEdit?: TimeScheduleSheet | null;
}> = ({ onConfirm, onClose, sheetToEdit }) => {
    const [name, setName] = useState(sheetToEdit?.name || '');
    const [currentMonth, setCurrentMonth] = useState(sheetToEdit?.dates?.[0] ? new Date(sheetToEdit.dates[0] + 'T00:00:00') : new Date());
    const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set(sheetToEdit?.dates || []));
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const changeMonth = (amount: number) => {
        setCurrentMonth(prev => {
            const newDate = new Date(prev);
            newDate.setDate(1);
            newDate.setMonth(prev.getMonth() + amount);
            return newDate;
        });
    };

    const toggleDate = (date: string) => {
        setSelectedDates(prev => {
            const newSet = new Set(prev);
            if (newSet.has(date)) {
                newSet.delete(date);
            } else {
                newSet.add(date);
            }
            return newSet;
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) {
            setError("シート名は必須です。");
            return;
        }
        if (selectedDates.size === 0) {
            setError("日付を1日以上選択してください。");
            return;
        }
        setLoading(true);
        setError('');
        try {
            const sortedDates = Array.from(selectedDates).sort();
            await onConfirm(name.trim(), sortedDates);
            onClose();
        } catch (err: any) {
            const action = sheetToEdit ? '更新' : '作成';
            setError(err.message || `シートの${action}に失敗しました。`);
            setLoading(false);
        }
    };

    const renderCalendar = () => {
        const year = currentMonth.getFullYear();
        const month = currentMonth.getMonth();
        const firstDayOfMonth = new Date(year, month, 1);
        const lastDayOfMonth = new Date(year, month + 1, 0);
        const startingDay = firstDayOfMonth.getDay(); // 0 (Sun) - 6 (Sat)
        const daysInMonth = lastDayOfMonth.getDate();

        const blanks = Array.from({ length: startingDay }, (_, i) => <div key={`blank-${i}`} className="w-10 h-10"></div>);

        const days = Array.from({ length: daysInMonth }, (_, i) => {
            const day = i + 1;
            const dateObj = new Date(year, month, day);
            const dateStr = formatDate(dateObj);
            const isSelected = selectedDates.has(dateStr);
            const isToday = formatDate(new Date()) === dateStr;

            return (
                <div key={day} className="flex items-center justify-center">
                    <button
                        type="button"
                        onClick={() => toggleDate(dateStr)}
                        className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors text-sm
                            ${isSelected ? 'bg-sky-600 text-white font-bold' : isToday ? 'bg-sky-100 text-sky-700' : 'hover:bg-slate-100'}
                        `}
                    >
                        {day}
                    </button>
                </div>
            );
        });

        return (
            <div>
                <div className="flex justify-between items-center mb-2 px-2">
                    <IconButton onClick={() => changeMonth(-1)} aria-label="前の月"><ChevronLeftIcon /></IconButton>
                    <h5 className="font-semibold text-base">{`${year}年 ${month + 1}月`}</h5>
                    <IconButton onClick={() => changeMonth(1)} aria-label="次の月"><ChevronRightIcon /></IconButton>
                </div>
                <div className="grid grid-cols-7 gap-y-1 text-center text-xs text-slate-500 font-medium">
                    <div className="text-red-500">日</div><div>月</div><div>火</div><div>水</div><div>木</div><div>金</div><div className="text-blue-500">土</div>
                    {blanks}
                    {days}
                </div>
            </div>
        );
    };
    
    const title = sheetToEdit ? "タイムテーブルを編集" : "タイムテーブルを新規作成";
    const buttonText = sheetToEdit ? "更新" : "作成";

    return (
        <Modal title={title} onClose={onClose} size="lg">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label htmlFor="sheet-name" className="block text-sm font-medium text-slate-700 mb-1">シート名</label>
                    <input id="sheet-name" type="text" value={name} onChange={(e) => setName(e.target.value)} required className="block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500" placeholder="例: イベント準備" autoFocus />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="border p-4 rounded-md">
                        <label className="block text-sm font-medium text-slate-700 mb-2">日付を選択</label>
                        {renderCalendar()}
                    </div>
                    <div className="border p-4 rounded-md bg-slate-50">
                         <label className="block text-sm font-medium text-slate-700 mb-2">選択中の日付 ({selectedDates.size}日)</label>
                         {selectedDates.size > 0 ? (
                            <div className="max-h-60 overflow-y-auto space-y-1 pr-2">
                                {Array.from(selectedDates).sort().map(date => (
                                    <div key={date} className="flex justify-between items-center bg-white p-2 rounded text-sm shadow-sm">
                                        <span>{date}</span>
                                        <IconButton onClick={() => toggleDate(date)} aria-label={`${date}の選択を解除`}><CancelIcon className="text-xs" /></IconButton>
                                    </div>
                                ))}
                            </div>
                         ) : (
                            <div className="flex items-center justify-center h-full text-slate-500 text-sm">
                                カレンダーから日付を選択してください。
                            </div>
                         )}
                    </div>
                </div>

                {error && <p className="text-sm text-red-600">{error}</p>}
                <div className="flex justify-end space-x-3 pt-2">
                    <SecondaryButton type="button" onClick={onClose} disabled={loading}>キャンセル</SecondaryButton>
                    <PrimaryButton type="submit" disabled={loading}>{loading ? `${buttonText}中...` : buttonText}</PrimaryButton>
                </div>
            </form>
        </Modal>
    );
};


const ProjectDetailPage: React.FC = () => {
  const { clientId, projectId } = useParams<{ clientId: string, projectId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser } = useAuth();

  const [project, setProject] = useState<Project | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [activeTab, setActiveTab] = useState<ProjectDetailTab | null>(null);
  
  // States for sheets
  const [incomeExpenseSheets, setIncomeExpenseSheets] = useState<IncomeExpenseSheet[]>([]);
  const [scheduleSheets, setScheduleSheets] = useState<ScheduleSheet[]>([]);
  const [kpiSheets, setKpiSheets] = useState<KpiSheet[]>([]);
  const [timeScheduleSheets, setTimeScheduleSheets] = useState<TimeScheduleSheet[]>([]);

  // Modal states
  const [showAddSheetModalFor, setShowAddSheetModalFor] = useState<ProjectDetailTab | null>(null);
  const [timeSheetModalState, setTimeSheetModalState] = useState<{isOpen: boolean; sheetToEdit: TimeScheduleSheet | null}>({ isOpen: false, sheetToEdit: null });
  const [scheduleSheetTypeToAdd, setScheduleSheetTypeToAdd] = useState<'gantt' | 'timetable' | null>(null);
  const [sheetToDuplicate, setSheetToDuplicate] = useState<{ tab: ProjectDetailTab; sheet: BaseSheet, type: 'gantt' | 'timetable' | 'income' | 'kpi' } | null>(null);

  // States for all items (will be filtered per sheet)
  const [incomeExpenseItems, setIncomeExpenseItems] = useState<IncomeExpenseItem[]>([]);
  const [scheduleTasks, setScheduleTasks] = useState<ScheduleTask[]>([]);
  const [timeScheduleEntries, setTimeScheduleEntries] = useState<TimeScheduleEntry[]>([]);
  const [kpiItems, setKpiItems] = useState<KpiItem[]>([]);
  const [kpiRecords, setKpiRecords] = useState<KpiRecord[]>([]);
  const [kpiCustomColumns, setKpiCustomColumns] = useState<KpiCustomColumn[]>([]);
  const [memos, setMemos] = useState<Memo[]>([]);
  const [memoGroups, setMemoGroups] = useState<MemoGroup[]>([]);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [bookmarkGroups, setBookmarkGroups] = useState<BookmarkGroup[]>([]);
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [fileGroups, setFileGroups] = useState<FileGroup[]>([]);

  const [isLoadingProjectData, setIsLoadingProjectData] = useState(true);
  const [isLoadingSubData, setIsLoadingSubData] = useState(true); 
  const [error, setError] = useState<string | null>(null);
  
  const [isEditingProjectName, setIsEditingProjectName] = useState(false);
  const [editedProjectName, setEditedProjectName] = useState('');

  useEffect(() => {
    if (project && !isEditingProjectName) {
        setEditedProjectName(project.name);
    }
  }, [project, isEditingProjectName]);

  useEffect(() => {
    const hash = location.hash.replace('#', '');
    const validTabs = Object.values(ProjectDetailTab) as string[];
    if (hash && validTabs.includes(decodeURIComponent(hash))) {
      setActiveTab(decodeURIComponent(hash) as ProjectDetailTab);
    } else if (project && !activeTab) { // If project is loaded and no tab is active yet
      const defaultTab = ProjectDetailTab.IncomeExpense;
      setActiveTab(defaultTab);
      navigate(`${location.pathname.split('#')[0]}#${encodeURIComponent(defaultTab)}`, { replace: true });
    }
  }, [location.pathname, location.hash, navigate, project, activeTab]);

  useEffect(() => {
    if (!currentUser || !clientId || !projectId) {
        setIsLoadingProjectData(false);
        setError("必要な情報が不足しています。");
        return;
    }

    let clientUnsubscribe: (() => void) | undefined;
    let projectUnsubscribe: (() => void) | undefined;
    let isMounted = true;

    const fetchClient = () => {
        const clientDocRef = firestore.doc(getCollectionPath.clientDoc(currentUser.uid, clientId));
        clientUnsubscribe = clientDocRef.onSnapshot(
            (docSnap) => {
                if (!isMounted) return;
                if (docSnap.exists) {
                    setClient({ ...docSnap.data(), id: docSnap.id } as Client);
                } else {
                    setError("クライアントが見つかりません。");
                }
            },
            (err) => {
                if (!isMounted) return;
                console.error("Error fetching client:", err);
                setError("クライアント情報の読み込みに失敗しました。");
            }
        );
    };

    const fetchProject = () => {
        const projectDocRef = firestore.doc(getCollectionPath.projectDoc(currentUser.uid, clientId, projectId));
        projectUnsubscribe = projectDocRef.onSnapshot(
            (docSnap) => {
                if (!isMounted) return;
                if (docSnap.exists) {
                    setProject({ ...docSnap.data(), id: docSnap.id } as Project);
                } else {
                    setError("プロジェクトが見つかりません。");
                }
                setIsLoadingProjectData(false);
            },
            (err) => {
                if (!isMounted) return;
                console.error("Error fetching project:", err);
                setError("プロジェクト情報の読み込みに失敗しました。");
                setIsLoadingProjectData(false);
            }
        );
    };

    setIsLoadingProjectData(true);
    fetchClient();
    fetchProject();

    return () => {
        isMounted = false;
        if (clientUnsubscribe) clientUnsubscribe();
        if (projectUnsubscribe) projectUnsubscribe();
    };
}, [currentUser, clientId, projectId]);

  // Effect for fetching sheets and all sub-collections
  useEffect(() => {
      if (!currentUser || !projectId || !project) return;
      setIsLoadingSubData(true); 
      setError(null);

      const unsubscribers: (() => void)[] = [];

      // Sheet Fetching
      const ieSheetsQuery = firestore.collection(getCollectionPath.incomeExpenseSheets(currentUser.uid, projectId)).orderBy("order");
      unsubscribers.push(ieSheetsQuery.onSnapshot(snap => setIncomeExpenseSheets(snap.docs.map(d => ({ ...d.data(), id: d.id } as IncomeExpenseSheet)))));
      
      const scheduleSheetsQuery = firestore.collection(getCollectionPath.scheduleSheets(currentUser.uid, projectId)).orderBy("order");
      unsubscribers.push(scheduleSheetsQuery.onSnapshot(snap => setScheduleSheets(snap.docs.map(d => ({ ...d.data(), id: d.id } as ScheduleSheet)))));
      
      const timeScheduleSheetsQuery = firestore.collection(getCollectionPath.timeScheduleSheets(currentUser.uid, projectId)).orderBy("order");
      unsubscribers.push(timeScheduleSheetsQuery.onSnapshot(snap => setTimeScheduleSheets(snap.docs.map(d => ({ ...d.data(), id: d.id } as TimeScheduleSheet)))));

      const kpiSheetsQuery = firestore.collection(getCollectionPath.kpiSheets(currentUser.uid, projectId)).orderBy("order");
      unsubscribers.push(kpiSheetsQuery.onSnapshot(snap => setKpiSheets(snap.docs.map(d => ({ ...d.data(), id: d.id } as KpiSheet)))));

      // Data Item Fetching (all for project)
      const ieQuery = firestore.collection(getCollectionPath.incomeExpenses(currentUser.uid, projectId)).orderBy("order");
      unsubscribers.push(ieQuery.onSnapshot(snap => setIncomeExpenseItems(snap.docs.map(d => ({ ...d.data(), id: d.id } as IncomeExpenseItem)))));
      
      const schQuery = firestore.collection(getCollectionPath.scheduleTasks(currentUser.uid, projectId)).orderBy("order");
      unsubscribers.push(schQuery.onSnapshot(snap => setScheduleTasks(snap.docs.map(d => ({ ...d.data(), id: d.id } as ScheduleTask)))));
      
      const timeSchEntriesQuery = firestore.collection(getCollectionPath.timeScheduleEntries(currentUser.uid, projectId));
      unsubscribers.push(timeSchEntriesQuery.onSnapshot(snap => setTimeScheduleEntries(snap.docs.map(d => ({...d.data(), id: d.id} as TimeScheduleEntry)))));

      const kpiItemsQuery = firestore.collection(getCollectionPath.kpiItems(currentUser.uid, projectId)).orderBy("order");
      unsubscribers.push(kpiItemsQuery.onSnapshot(snap => setKpiItems(snap.docs.map(d => ({ ...d.data(), id: d.id } as KpiItem)))));
      
      const kpiRecordsQuery = firestore.collection(getCollectionPath.kpiRecords(currentUser.uid, projectId)).orderBy("startDate", "desc");
      unsubscribers.push(kpiRecordsQuery.onSnapshot(snap => setKpiRecords(snap.docs.map(d => ({ ...d.data(), id: d.id } as KpiRecord)))));

      const kpiColsQuery = firestore.collection(getCollectionPath.kpiCustomColumns(currentUser.uid, projectId)).orderBy("order");
      unsubscribers.push(kpiColsQuery.onSnapshot(snap => setKpiCustomColumns(snap.docs.map(d => ({ ...d.data(), id: d.id } as KpiCustomColumn)))));
      
      const memosQuery = firestore.collection(getCollectionPath.memos(currentUser.uid, projectId)).orderBy("order");
      unsubscribers.push(memosQuery.onSnapshot(snap => setMemos(snap.docs.map(d => ({ ...d.data(), id: d.id } as Memo)))));

      const memoGroupsQuery = firestore.collection(getCollectionPath.memoGroups(currentUser.uid, projectId)).orderBy("order");
      unsubscribers.push(memoGroupsQuery.onSnapshot(snap => setMemoGroups(snap.docs.map(d => ({ ...d.data(), id: d.id } as MemoGroup)))));

      const bookmarksQuery = firestore.collection(getCollectionPath.bookmarks(currentUser.uid, projectId)).orderBy("order");
      unsubscribers.push(bookmarksQuery.onSnapshot(snap => setBookmarks(snap.docs.map(d => ({ ...d.data(), id: d.id } as Bookmark)))));

      const bookmarkGroupsQuery = firestore.collection(getCollectionPath.bookmarkGroups(currentUser.uid, projectId)).orderBy("order");
      unsubscribers.push(bookmarkGroupsQuery.onSnapshot(snap => setBookmarkGroups(snap.docs.map(d => ({ ...d.data(), id: d.id } as BookmarkGroup)))));

      const filesQuery = firestore.collection(getCollectionPath.files(currentUser.uid, projectId)).orderBy("order");
      unsubscribers.push(filesQuery.onSnapshot(snap => setFiles(snap.docs.map(d => ({ ...d.data(), id: d.id } as ProjectFile)))));

      const fileGroupsQuery = firestore.collection(getCollectionPath.fileGroups(currentUser.uid, projectId)).orderBy("order");
      unsubscribers.push(fileGroupsQuery.onSnapshot(snap => setFileGroups(snap.docs.map(d => ({ ...d.data(), id: d.id } as FileGroup)))));


      // Consider all data loaded once project data is loaded
      setIsLoadingSubData(false);

      return () => {
        unsubscribers.forEach(unsub => unsub());
      };
  }, [currentUser, projectId, project]); 

  const handleTabChange = (tab: ProjectDetailTab) => {
    setActiveTab(tab);
    navigate(`${location.pathname.split('#')[0]}#${encodeURIComponent(tab)}`, { replace: true });
  };
  
  const handleUpdateProjectName = async () => {
    if (!currentUser || !clientId || !projectId || !editedProjectName.trim() || !project || editedProjectName.trim() === project.name) {
        setIsEditingProjectName(false);
        if (project) setEditedProjectName(project.name);
        return;
    }
    
    try {
        const projectDocRef = firestore.doc(getCollectionPath.projectDoc(currentUser.uid, clientId, projectId));
        await projectDocRef.update({ name: editedProjectName.trim() });
        setIsEditingProjectName(false);
    } catch (err) {
        console.error("Error updating project name:", err);
        setError("プロジェクト名の更新に失敗しました。");
        if(project) setEditedProjectName(project.name);
        setIsEditingProjectName(false);
    }
  };
  
  const handleConfirmSheetModal = async (name: string) => {
    if (!currentUser || !projectId) return;

    if (sheetToDuplicate) {
        // --- DUPLICATION LOGIC ---
        const { type, sheet: originalSheet } = sheetToDuplicate;
        const batch = firestore.batch();
        let collectionPath: string, newSheetOrder: number;

        switch (type) {
            case 'income':
                collectionPath = getCollectionPath.incomeExpenseSheets(currentUser.uid, projectId);
                newSheetOrder = incomeExpenseSheets.length;
                break;
            case 'gantt':
                collectionPath = getCollectionPath.scheduleSheets(currentUser.uid, projectId);
                newSheetOrder = scheduleSheets.length;
                break;
            case 'timetable':
                collectionPath = getCollectionPath.timeScheduleSheets(currentUser.uid, projectId);
                newSheetOrder = timeScheduleSheets.length;
                break;
            case 'kpi':
                collectionPath = getCollectionPath.kpiSheets(currentUser.uid, projectId);
                newSheetOrder = kpiSheets.length;
                break;
            default: return;
        }

        const newSheetRef = firestore.collection(collectionPath).doc();
        batch.set(newSheetRef, { name, projectId, userId: currentUser.uid, order: newSheetOrder, id: newSheetRef.id });

        if (type === 'income' || type === 'gantt') {
            const itemsToCopy = type === 'income' ? incomeExpenseItems : scheduleTasks;
            const originalItems = itemsToCopy.filter(i => i.sheetId === originalSheet.id).sort((a,b) => (a.depth || 0) - (b.depth || 0));
            const itemsPath = type === 'income' ? getCollectionPath.incomeExpenses(currentUser.uid, projectId) : getCollectionPath.scheduleTasks(currentUser.uid, projectId);
            const idMap = new Map<string, string>();

            originalItems.forEach(item => {
                const newItemRef = firestore.collection(itemsPath).doc();
                const { id, ...itemData } = item;
                const newItem = { ...itemData, sheetId: newSheetRef.id, id: newItemRef.id };
                if (newItem.parentId && idMap.has(newItem.parentId)) {
                    newItem.parentId = idMap.get(newItem.parentId)!;
                }
                batch.set(newItemRef, newItem);
                idMap.set(id, newItemRef.id);
            });
        } else if (type === 'timetable') {
            const entriesToCopy = timeScheduleEntries.filter(e => e.sheetId === originalSheet.id);
            const entriesPath = getCollectionPath.timeScheduleEntries(currentUser.uid, projectId);
            entriesToCopy.forEach(entry => {
                const newEntryRef = firestore.collection(entriesPath).doc();
                const { id, ...entryData } = entry;
                batch.set(newEntryRef, { ...entryData, sheetId: newSheetRef.id });
            });
        } else if (type === 'kpi') {
            const kpiItemMap = new Map<string, string>();
            const customColMap = new Map<string, string>();

            const columnsToCopy = kpiCustomColumns.filter(c => c.sheetId === originalSheet.id);
            columnsToCopy.forEach(col => {
                const newColRef = firestore.collection(getCollectionPath.kpiCustomColumns(currentUser.uid, projectId)).doc();
                const { id, ...colData } = col;
                batch.set(newColRef, { ...colData, sheetId: newSheetRef.id, id: newColRef.id });
                customColMap.set(id, newColRef.id);
            });

            const itemsToCopy = kpiItems.filter(i => i.sheetId === originalSheet.id);
            itemsToCopy.forEach(item => {
                const newItemRef = firestore.collection(getCollectionPath.kpiItems(currentUser.uid, projectId)).doc();
                const { id, ...itemData } = item;
                batch.set(newItemRef, { ...itemData, sheetId: newSheetRef.id, id: newItemRef.id });
                kpiItemMap.set(id, newItemRef.id);
            });
            
            const recordsToCopy = kpiRecords.filter(r => r.sheetId === originalSheet.id);
            recordsToCopy.forEach(record => {
                const newRecordRef = firestore.collection(getCollectionPath.kpiRecords(currentUser.uid, projectId)).doc();
                const { id, values, customColumns, ...recordData } = record;

                const newValues: { [key: string]: number | null } = {};
                Object.entries(values).forEach(([oldKpiId, value]) => {
                    if (kpiItemMap.has(oldKpiId)) {
                        newValues[kpiItemMap.get(oldKpiId)!] = value;
                    }
                });

                const newCustomColumns: { [key: string]: string } = {};
                Object.entries(customColumns).forEach(([oldColId, value]) => {
                    if (customColMap.has(oldColId)) {
                        newCustomColumns[customColMap.get(oldColId)!] = value;
                    }
                });
                
                batch.set(newRecordRef, { ...recordData, sheetId: newSheetRef.id, values: newValues, customColumns: newCustomColumns, id: newRecordRef.id });
            });
        }
        
        await batch.commit();

    } else if (showAddSheetModalFor) {
        // --- NEW SHEET LOGIC ---
        const tab = showAddSheetModalFor;
        let collectionPath: string, newSheetOrder: number;
        switch (tab) {
            case ProjectDetailTab.IncomeExpense:
                collectionPath = getCollectionPath.incomeExpenseSheets(currentUser.uid, projectId);
                newSheetOrder = incomeExpenseSheets.length;
                break;
            case ProjectDetailTab.Schedule:
                if (scheduleSheetTypeToAdd === 'gantt') {
                    collectionPath = getCollectionPath.scheduleSheets(currentUser.uid, projectId);
                    newSheetOrder = scheduleSheets.length;
                } else return;
                break;
            case ProjectDetailTab.Kpi:
                collectionPath = getCollectionPath.kpiSheets(currentUser.uid, projectId);
                newSheetOrder = kpiSheets.length;
                break;
            default: return;
        }
        const newSheetRef = firestore.collection(collectionPath).doc();
        await newSheetRef.set({ name, projectId, userId: currentUser.uid, order: newSheetOrder, id: newSheetRef.id });
    }
  };

  const handleConfirmTimeSheet = async (name: string, dates: string[]) => {
    if (!currentUser || !projectId) return;

    const { sheetToEdit } = timeSheetModalState;

    if (sheetToEdit) { // Update existing sheet
      const docPath = getCollectionPath.timeScheduleSheetDoc(currentUser.uid, projectId, sheetToEdit.id);
      await firestore.doc(docPath).update({ name, dates });
    } else { // Create new sheet
      const collectionPath = getCollectionPath.timeScheduleSheets(currentUser.uid, projectId);
      const newSheetOrder = timeScheduleSheets.length;
      const newSheetRef = firestore.collection(collectionPath).doc();
      await newSheetRef.set({ name, dates, projectId, userId: currentUser.uid, order: newSheetOrder, id: newSheetRef.id });
    }
  };

  const handleOpenAddScheduleSheetModal = (type: 'gantt' | 'timetable') => {
    setScheduleSheetTypeToAdd(type);
    if (type === 'gantt') {
        setShowAddSheetModalFor(ProjectDetailTab.Schedule);
    } else {
        setTimeSheetModalState({ isOpen: true, sheetToEdit: null });
    }
  };
  
  const handleDuplicateSheet = (sheet: BaseSheet, type: 'gantt' | 'timetable' | 'income' | 'kpi') => {
    if (!activeTab) return;
    setSheetToDuplicate({ tab: activeTab, sheet, type });
  };
  
  const handleUpdateSheetName = async (sheetId: string, newName: string, type: 'gantt' | 'timetable' | 'income' | 'kpi') => {
      if (!currentUser || !projectId) return;
      let docPath: string;
      switch(type) {
          case 'income': docPath = getCollectionPath.incomeExpenseSheetDoc(currentUser.uid, projectId, sheetId); break;
          case 'gantt': docPath = getCollectionPath.scheduleSheetDoc(currentUser.uid, projectId, sheetId); break;
          case 'timetable': docPath = getCollectionPath.timeScheduleSheetDoc(currentUser.uid, projectId, sheetId); break;
          case 'kpi': docPath = getCollectionPath.kpiSheetDoc(currentUser.uid, projectId, sheetId); break;
          default: return;
      }
      await firestore.doc(docPath).update({ name: newName });
  };
  
  const handleDeleteSheet = async (sheetId: string, type: 'gantt' | 'timetable' | 'income' | 'kpi') => {
      if (!currentUser || !projectId) return;
      if (!window.confirm("このシートを削除しますか？シート内のすべてのデータも削除され、元に戻すことはできません。")) return;

      const batch = firestore.batch();
      
      let sheetDocPath: string;

      switch(type) {
          case 'income':
              sheetDocPath = getCollectionPath.incomeExpenseSheetDoc(currentUser.uid, projectId, sheetId);
              (await firestore.collection(getCollectionPath.incomeExpenses(currentUser.uid, projectId)).where('sheetId', '==', sheetId).get()).forEach(d => batch.delete(d.ref));
              break;
          case 'gantt':
              sheetDocPath = getCollectionPath.scheduleSheetDoc(currentUser.uid, projectId, sheetId);
              (await firestore.collection(getCollectionPath.scheduleTasks(currentUser.uid, projectId)).where('sheetId', '==', sheetId).get()).forEach(d => batch.delete(d.ref));
              break;
          case 'timetable':
              sheetDocPath = getCollectionPath.timeScheduleSheetDoc(currentUser.uid, projectId, sheetId);
              (await firestore.collection(getCollectionPath.timeScheduleEntries(currentUser.uid, projectId)).where('sheetId', '==', sheetId).get()).forEach(d => batch.delete(d.ref));
              // FIX: Expected 3 arguments, but got 2. Pass sheetId to getCollectionPath.timeScheduleSections.
              (await firestore.collection(getCollectionPath.timeScheduleSections(currentUser.uid, projectId, sheetId)).get()).forEach(d => batch.delete(d.ref));
              break;
          case 'kpi':
              sheetDocPath = getCollectionPath.kpiSheetDoc(currentUser.uid, projectId, sheetId);
              (await firestore.collection(getCollectionPath.kpiItems(currentUser.uid, projectId)).where('sheetId', '==', sheetId).get()).forEach(d => batch.delete(d.ref));
              (await firestore.collection(getCollectionPath.kpiRecords(currentUser.uid, projectId)).where('sheetId', '==', sheetId).get()).forEach(d => batch.delete(d.ref));
              (await firestore.collection(getCollectionPath.kpiCustomColumns(currentUser.uid, projectId)).where('sheetId', '==', sheetId).get()).forEach(d => batch.delete(d.ref));
              break;
          default: return;
      }
      
      batch.delete(firestore.doc(sheetDocPath));
      await batch.commit();
  };

  const handleMoveSheet = async (sheetId: string, direction: 'up' | 'down', type: 'gantt' | 'timetable' | 'income' | 'kpi') => {
    if (!currentUser || !projectId) return;

    let originalSheets: BaseSheet[];
    let setSheets: React.Dispatch<React.SetStateAction<any>>;
    let getDocPath: (userId: string, projectId: string, sheetId: string) => string;

    switch(type) {
        case 'income':
            originalSheets = [...incomeExpenseSheets];
            setSheets = setIncomeExpenseSheets;
            getDocPath = getCollectionPath.incomeExpenseSheetDoc;
            break;
        case 'gantt':
            originalSheets = [...scheduleSheets];
            setSheets = setScheduleSheets;
            getDocPath = getCollectionPath.scheduleSheetDoc;
            break;
        case 'timetable':
            originalSheets = [...timeScheduleSheets];
            setSheets = setTimeScheduleSheets;
            getDocPath = getCollectionPath.timeScheduleSheetDoc;
            break;
        case 'kpi':
            originalSheets = [...kpiSheets];
            setSheets = setKpiSheets;
            getDocPath = getCollectionPath.kpiSheetDoc;
            break;
        default: return;
    }

    const currentIndex = originalSheets.findIndex(s => s.id === sheetId);
    if (currentIndex === -1) return;
    if ((direction === 'up' && currentIndex === 0) || (direction === 'down' && currentIndex === originalSheets.length - 1)) return;

    const swapIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    
    const reordered = [...originalSheets];
    [reordered[currentIndex], reordered[swapIndex]] = [reordered[swapIndex], reordered[currentIndex]];
    
    setSheets(reordered.map((s, i) => ({...s, order: i}))); // Optimistic update

    const batch = firestore.batch();
    reordered.forEach((sheet, index) => {
        const docRef = firestore.doc(getDocPath(currentUser.uid, projectId, sheet.id));
        batch.update(docRef, { order: index });
    });

    try {
        await batch.commit();
    } catch (err) {
        console.error(`Error reordering ${type} sheets:`, err);
        setError(`シートの並び替えに失敗しました。`);
        setSheets(originalSheets); // Revert on failure
    }
  };


  if (isLoadingProjectData) return <LoadingSpinner text="プロジェクト詳細を読み込み中..." />;
  if (error && (!project || !client)) return <div className="p-4 bg-red-100 text-red-700 rounded-md">{error} <PrimaryButton onClick={() => navigate('/dashboard')} className="mt-2">ダッシュボードに戻る</PrimaryButton></div>;
  if (!project || !client) return <div className="p-4 bg-yellow-100 text-yellow-700 rounded-md">プロジェクト情報が見つかりません。 <PrimaryButton onClick={() => navigate('/dashboard')} className="mt-2">ダッシュボードに戻る</PrimaryButton></div>;
  
  if (!activeTab) { return <LoadingSpinner text="タブ情報を読み込み中..." />; }

  const renderActiveTabContent = () => {
      if (isLoadingSubData) {
          return <LoadingSpinner text={`${activeTab}データを読み込み中...`} />;
      }

      let tabContent: React.ReactNode;
      let showAddSheetButton = true;

      switch(activeTab) {
          case ProjectDetailTab.IncomeExpense:
              tabContent = incomeExpenseSheets.map((sheet, index) => (
                <ManagementSheet 
                    key={sheet.id} 
                    sheet={sheet} 
                    onUpdateName={(id, name) => handleUpdateSheetName(id, name, 'income')} 
                    onDelete={(id) => handleDeleteSheet(id, 'income')} 
                    onDuplicate={(s) => handleDuplicateSheet(s, 'income')}
                    onMove={(id, dir) => handleMoveSheet(id, dir, 'income')}
                    isFirst={index === 0}
                    isLast={index === incomeExpenseSheets.length - 1}
                >
                    <IncomeExpenseManagementTab project={project} sheet={sheet} initialItems={incomeExpenseItems.filter(i => i.sheetId === sheet.id)} />
                </ManagementSheet>
              ));
              break;
          case ProjectDetailTab.Schedule:
              showAddSheetButton = false; // Use custom buttons
              tabContent = (
                <div className="space-y-6">
                    <div className="flex justify-end gap-2">
                        <PrimaryButton onClick={() => handleOpenAddScheduleSheetModal('gantt')} icon={<PlusIcon />}>ガントチャート追加</PrimaryButton>
                        <PrimaryButton onClick={() => handleOpenAddScheduleSheetModal('timetable')} icon={<PlusIcon />}>タイムテーブル追加</PrimaryButton>
                    </div>
                    {scheduleSheets.map((sheet, index) => (
                        <div key={`gantt-${sheet.id}`}>
                            <ManagementSheet 
                                sheet={sheet} 
                                onUpdateName={(id, name) => handleUpdateSheetName(id, name, 'gantt')} 
                                onDelete={(id) => handleDeleteSheet(id, 'gantt')} 
                                onDuplicate={(s) => handleDuplicateSheet(s, 'gantt')}
                                onMove={(id, dir) => handleMoveSheet(id, dir, 'gantt')}
                                isFirst={index === 0}
                                isLast={index === scheduleSheets.length - 1}
                            >
                                <GanttScheduleTab project={project} sheet={sheet} initialTasks={scheduleTasks.filter(t => t.sheetId === sheet.id)} />
                            </ManagementSheet>
                        </div>
                    ))}
                    {timeScheduleSheets.map((sheet, index) => (
                       <div key={`time-${sheet.id}`}>
                            <ManagementSheet
                                sheet={sheet}
                                onUpdateName={(id, name) => handleUpdateSheetName(id, name, 'timetable')}
                                onDelete={(id) => handleDeleteSheet(id, 'timetable')}
                                onDuplicate={(s) => handleDuplicateSheet(s, 'timetable')}
                                onEditDetails={(s) => setTimeSheetModalState({ isOpen: true, sheetToEdit: s as TimeScheduleSheet })}
                                onMove={(id, dir) => handleMoveSheet(id, dir, 'timetable')}
                                isFirst={index === 0}
                                isLast={index === timeScheduleSheets.length - 1}
                            >
                                <TimeScheduleTab project={project} sheet={sheet} initialEntries={timeScheduleEntries.filter(e => e.sheetId === sheet.id)} />
                            </ManagementSheet>
                        </div>
                    ))}
                </div>
              );
              break;
          case ProjectDetailTab.Kpi:
              tabContent = kpiSheets.map((sheet, index) => (
                <ManagementSheet 
                    key={sheet.id} 
                    sheet={sheet} 
                    onUpdateName={(id, name) => handleUpdateSheetName(id, name, 'kpi')} 
                    onDelete={(id) => handleDeleteSheet(id, 'kpi')} 
                    onDuplicate={(s) => handleDuplicateSheet(s, 'kpi')}
                    onMove={(id, dir) => handleMoveSheet(id, dir, 'kpi')}
                    isFirst={index === 0}
                    isLast={index === kpiSheets.length - 1}
                >
                    <KpiManagementTab project={project} sheet={sheet}
                        initialKpiItems={kpiItems.filter(i => i.sheetId === sheet.id)}
                        initialKpiRecords={kpiRecords.filter(r => r.sheetId === sheet.id)}
                        initialKpiCustomColumns={kpiCustomColumns.filter(c => c.sheetId === sheet.id)}
                    />
                </ManagementSheet>
              ));
              break;
          case ProjectDetailTab.Memo:
              tabContent = <MemoTab project={project} initialMemos={memos} initialMemoGroups={memoGroups} />;
              showAddSheetButton = false;
              break;
          case ProjectDetailTab.Bookmark:
              tabContent = <BookmarkTab project={project} initialBookmarks={bookmarks} initialBookmarkGroups={bookmarkGroups} />;
              showAddSheetButton = false;
              break;
          case ProjectDetailTab.File:
              tabContent = <FileTab project={project} initialFiles={files} initialFileGroups={fileGroups} />;
              showAddSheetButton = false;
              break;
          default:
              tabContent = null;
              showAddSheetButton = false;
      }

      return (
        <div className="space-y-6">
            {tabContent}
            {showAddSheetButton && (
                <div className="mt-4">
                    <PrimaryButton icon={<PlusIcon />} onClick={() => setShowAddSheetModalFor(activeTab)}>{activeTab}シートを追加</PrimaryButton>
                </div>
            )}
        </div>
    );
  };

  const isSheetNameModalOpen = !!showAddSheetModalFor || !!sheetToDuplicate;
  const modalTitle = sheetToDuplicate ? `「${sheetToDuplicate.sheet.name}」を複製` : `${showAddSheetModalFor}シートの追加`;
  const modalInitialName = sheetToDuplicate ? `${sheetToDuplicate.sheet.name}のコピー` : '';
  const modalConfirmText = sheetToDuplicate ? '複製' : '追加';

  return (
    <div className="space-y-6">
       <nav aria-label="breadcrumb" className="text-sm text-slate-600 mb-2">
        <ol className="flex items-center space-x-1">
          <li><button onClick={() => navigate('/dashboard')} className="hover:text-sky-600 hover:underline">クライアント一覧</button></li>
          <li><ChevronRightIcon className="text-slate-400" /><button onClick={() => navigate(`/clients/${clientId}/projects`)} className="hover:text-sky-600 hover:underline">{client.name}</button></li>
          <li><ChevronRightIcon className="text-slate-400" /><span className="font-medium text-slate-700">{project.name}</span></li>
        </ol>
      </nav>

      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="flex items-center gap-2 mb-3">
            {isEditingProjectName ? (
                <div className="flex items-center gap-2 flex-grow">
                    <input
                        type="text"
                        value={editedProjectName}
                        onChange={(e) => setEditedProjectName(e.target.value)}
                        onBlur={handleUpdateProjectName}
                        onKeyDown={e => {
                            if (e.key === 'Enter') handleUpdateProjectName();
                            if (e.key === 'Escape') {
                                setIsEditingProjectName(false);
                                setEditedProjectName(project.name);
                            }
                        }}
                        className="text-2xl font-semibold px-2 py-1 border border-slate-300 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500 w-full"
                        autoFocus
                    />
                    <IconButton onClick={handleUpdateProjectName} aria-label="保存"><SaveIcon className="text-sky-600" /></IconButton>
                    <IconButton onClick={() => {
                        setIsEditingProjectName(false);
                        setEditedProjectName(project.name);
                    }} aria-label="キャンセル"><CancelIcon /></IconButton>
                </div>
            ) : (
                <div className="flex items-center gap-2">
                    <h2 className="text-2xl font-semibold text-slate-800">{project.name}</h2>
                    <IconButton onClick={() => setIsEditingProjectName(true)} aria-label="プロジェクト名を編集">
                        <EditIcon />
                    </IconButton>
                </div>
            )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <p><span className="font-medium text-slate-500">クライアント:</span> {client.name}</p>
            {project.types && project.types.length > 0 && (
              <p><span className="font-medium text-slate-500">種類:</span> {project.types.map(t => t === ProjectType.Other ? project.otherTypeName || t : t).join(', ')}</p>
            )}
            {project.dueDate && (
              <p><span className="font-medium text-slate-500">期限:</span> {formatDate(project.dueDate)}</p>
            )}
        </div>
      </div>

      <div>
        <nav aria-label="Tabs" className="flex border-b border-slate-200 overflow-x-auto">
          {Object.values(ProjectDetailTab).map((tab) => (
            <button
              key={tab}
              onClick={() => handleTabChange(tab as ProjectDetailTab)}
              aria-current={activeTab === tab ? 'page' : undefined}
              className={`py-3 px-4 -mb-px font-medium text-sm focus:outline-none transition-colors duration-150 whitespace-nowrap
                ${activeTab === tab 
                  ? 'border-b-2 border-sky-600 text-sky-600' 
                  : 'border-b-2 border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      <div className="mt-6">
        {renderActiveTabContent()}
      </div>

      {isSheetNameModalOpen && (
        <SheetNameModal
            title={modalTitle}
            onClose={() => {
                setShowAddSheetModalFor(null);
                setSheetToDuplicate(null);
                setScheduleSheetTypeToAdd(null);
            }}
            onConfirm={handleConfirmSheetModal}
            initialName={modalInitialName}
            confirmButtonText={modalConfirmText}
        />
      )}
      {timeSheetModalState.isOpen && (
        <TimeScheduleSheetModal 
            onConfirm={handleConfirmTimeSheet}
            onClose={() => setTimeSheetModalState({ isOpen: false, sheetToEdit: null })}
            sheetToEdit={timeSheetModalState.sheetToEdit}
        />
      )}
    </div>
  );
};

export default ProjectDetailPage;