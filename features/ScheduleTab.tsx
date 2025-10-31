import React, { useState, useEffect, useMemo, useRef, useCallback, useLayoutEffect } from 'react';
import { ScheduleTask, Project, ScheduleSheet } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { firestore, getCollectionPath, firebase } from '../firebase';
import { PlusIcon, SaveIcon, CancelIcon, TrashIcon, EditIcon, ChevronDownIcon, AddTaskIcon, PlaylistAddIcon, SubdirectoryArrowRightIcon, ArrowUpwardIcon, ArrowDownwardIcon, ChevronLeftIcon, ChevronRightIcon } from '../components/Icons';
import { PrimaryButton, SecondaryButton, IconButton } from '../components/common/Buttons';
import { EditableField } from '../components/common/EditableField';
import GanttChartHeader from './schedule/GanttChart';
import { formatDate, hexToRgba } from '../../utils';
import { JAPANESE_PUBLIC_HOLIDAYS } from '../constants';

// This local parseDate ensures that date strings are parsed as local dates without time components.
const parseDateAsLocal = (dateStr: string | undefined | null): Date | undefined => {
    if (!dateStr) return undefined;
    // Handles 'YYYY-MM-DD' format reliably across timezones by creating a local date.
    const parts = dateStr.split('-');
    if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed
        const day = parseInt(parts[2], 10);
        const date = new Date(year, month, day);
        return isNaN(date.getTime()) ? undefined : date;
    }
    // Fallback for other potential formats, though might have timezone issues
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? undefined : new Date(d.getFullYear(), d.getMonth(), d.getDate());
};

const formatDuration = (days: number): string => {
    if (days <= 0) return '';

    if (days < 30) {
        return `${days}日`;
    }

    let remainingDays = days;
    const parts: string[] = [];

    if (remainingDays >= 365) {
        const years = Math.floor(remainingDays / 365);
        parts.push(`${years}年`);
        remainingDays %= 365;
    }

    if (remainingDays >= 30) {
        const months = Math.floor(remainingDays / 30);
        parts.push(`${months}ヶ月`);
        remainingDays %= 30;
    }
    
    if (remainingDays > 0) {
        parts.push(`${remainingDays}日`);
    }

    return parts.join('');
};


interface GanttScheduleTabProps {
  project: Project;
  sheet: ScheduleSheet;
  initialTasks: ScheduleTask[];
}
const SECTION_COLORS = [
    '#6366f1', // indigo-500
    '#ec4899', // pink-500
    '#22c55e', // green-500
    '#f97316', // orange-500
    '#3b82f6', // blue-500
    '#8b5cf6', // violet-500
    '#f43f5e', // rose-500
    '#14b8a6', // teal-500
    '#64748b', // slate-500
];

const findTopmostAncestorColor = (startTaskId: string, allTasks: ScheduleTask[]): string | undefined => {
    let currentTask = allTasks.find(t => t.id === startTaskId);
    let topmostSection: ScheduleTask | undefined;

    if (currentTask?.isSectionHeader) {
        topmostSection = currentTask;
    }

    while (currentTask?.parentId) {
        currentTask = allTasks.find(t => t.id === currentTask.parentId);
        if (currentTask?.isSectionHeader) {
            topmostSection = currentTask;
        }
    }
    return topmostSection?.color;
};

const getDaysInMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();

const GanttScheduleTab: React.FC<GanttScheduleTabProps> = ({ project, sheet, initialTasks }) => {
    const { currentUser } = useAuth();
    const [tasks, setTasks] = useState<ScheduleTask[]>(initialTasks);
    const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'daily' | 'weekly' | 'monthly'>(sheet.viewPreferences?.viewMode || 'daily');
    
    const [isSavingView, setIsSavingView] = useState(false);
    const mainScrollContainerRef = useRef<HTMLDivElement>(null);
    
    const [dragAction, setDragAction] = useState<{
        type: 'move' | 'resize-start' | 'resize-end';
        task: ScheduleTask;
        startX: number;
        initialStartDate: Date;
        initialEndDate: Date;
    } | null>(null);
    
    const today = useMemo(() => new Date(), []);
    
    const dayWidth = useMemo(() => {
        if (viewMode === 'daily') return 40;
        if (viewMode === 'weekly') return 100;
        return 200; // monthly
    }, [viewMode]);

    // --- Gantt Timeline Logic (from GanttChart.tsx) ---
    const [timelineDates, setTimelineDates] = useState<Date[]>([]);
    const initialScrollDone = useRef(false);

    const dateRange = useMemo(() => {
        const todayDate = new Date();
        let min: Date = new Date(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate());
        let max: Date = new Date(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate());

        if (tasks.length > 0) {
            tasks.forEach(task => {
                const start = parseDateAsLocal(task.startDate);
                const end = parseDateAsLocal(task.endDate);
                if (start && start < min) {
                    min = start;
                }
                if (end && end > max) {
                    max = end;
                }
            });
        }
        
        return { start: min, end: max };
    }, [tasks]);

    const generateDateChunks = useCallback((startDate: Date, endDate: Date) => {
        const dates: Date[] = [];
        let currentDate = new Date(startDate);
        
        if (viewMode === 'weekly') {
            // Start from the beginning of the week (Sunday)
            currentDate.setDate(currentDate.getDate() - currentDate.getDay());
        } else if (viewMode === 'monthly') {
            currentDate.setDate(1);
        }

        while (currentDate <= endDate) {
            dates.push(new Date(currentDate));
            if (viewMode === 'daily') {
                currentDate.setDate(currentDate.getDate() + 1);
            } else if (viewMode === 'weekly') {
                currentDate.setDate(currentDate.getDate() + 7);
            } else { // monthly
                currentDate.setMonth(currentDate.getMonth() + 1);
            }
        }
        return dates;
    }, [viewMode]);

    useEffect(() => {
        // This effect resets the auto-scroll flag only when the fundamental view mode changes.
        initialScrollDone.current = false;
    }, [viewMode]);
    
    useEffect(() => {
        let overallStartDate = new Date(dateRange.start);
        let overallEndDate = new Date(dateRange.end);

        // Add generous buffers to the date range
        if (viewMode === 'daily') {
            overallStartDate.setDate(overallStartDate.getDate() - 90);
            overallEndDate.setDate(overallEndDate.getDate() + 180);
        } else if (viewMode === 'weekly') {
            overallStartDate.setDate(overallStartDate.getDate() - (12 * 7)); // ~3 months before
            overallEndDate.setDate(overallEndDate.getDate() + (24 * 7)); // ~6 months after
        } else { // monthly
            overallStartDate.setMonth(overallStartDate.getMonth() - 6);
            overallEndDate.setMonth(overallEndDate.getMonth() + 12);
        }

        setTimelineDates(generateDateChunks(overallStartDate, overallEndDate));
    }, [viewMode, generateDateChunks, dateRange]);


    useLayoutEffect(() => {
        // Do not auto-scroll if a drag operation is in progress.
        if (dragAction) {
            return;
        }
        
        if (timelineDates.length > 0 && !initialScrollDone.current && mainScrollContainerRef.current) {
            const timelineStartMs = timelineDates[0].getTime();
            let scrollPos = 0;
            
            if (viewMode === 'daily') {
                const daysDiff = (today.getTime() - timelineStartMs) / (1000 * 3600 * 24);
                scrollPos = daysDiff * dayWidth;
            } else if (viewMode === 'weekly') {
                const daysDiff = (today.getTime() - timelineStartMs) / (1000 * 3600 * 24);
                scrollPos = (daysDiff / 7) * dayWidth;
            } else {
                const monthsDiff = (today.getFullYear() - timelineDates[0].getFullYear()) * 12 + (today.getMonth() - timelineDates[0].getMonth());
                scrollPos = monthsDiff * dayWidth;
            }
            mainScrollContainerRef.current.scrollLeft = scrollPos - (mainScrollContainerRef.current.clientWidth / 3);
            initialScrollDone.current = true;
        }
    }, [timelineDates, viewMode, dayWidth, today, dragAction]);

    const todayIndex = useMemo(() => {
        if (viewMode !== 'daily' || timelineDates.length === 0) return -1;
        const todayStr = formatDate(today, 'yyyy-MM-dd');
        return timelineDates.findIndex(d => formatDate(d, 'yyyy-MM-dd') === todayStr);
    }, [today, timelineDates, viewMode]);
    
    const monthEndIndices = useMemo(() => {
        if (viewMode !== 'weekly' || timelineDates.length < 2) {
            return new Set<number>();
        }
        const indices = new Set<number>();
        for (let i = 0; i < timelineDates.length - 1; i++) {
            const currentMonth = timelineDates[i].getMonth();
            const nextMonth = timelineDates[i+1].getMonth();
            if (currentMonth !== nextMonth) {
                indices.add(i);
            }
        }
        return indices;
    }, [timelineDates, viewMode]);
    // --- End of Gantt Logic ---

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!dragAction) return;
    
        const dx = e.clientX - dragAction.startX;
        
        const daysPerPixel = viewMode === 'daily' ? 1 / dayWidth : viewMode === 'weekly' ? 7 / dayWidth : 30.44 / dayWidth;
        const daysDiff = Math.round(dx * daysPerPixel);
        
        const ONE_DAY_MS = 86400000;
        let newStartDate: Date;
        let newEndDate: Date;
    
        if (dragAction.type === 'move') {
            newStartDate = new Date(dragAction.initialStartDate.getTime() + daysDiff * ONE_DAY_MS);
            newEndDate = new Date(dragAction.initialEndDate.getTime() + daysDiff * ONE_DAY_MS);
        } else if (dragAction.type === 'resize-end') {
            newStartDate = dragAction.initialStartDate;
            newEndDate = new Date(dragAction.initialEndDate.getTime() + daysDiff * ONE_DAY_MS);
            if (newEndDate.getTime() < newStartDate.getTime()) {
                newEndDate = new Date(newStartDate.getTime());
            }
        } else { // resize-start
            newStartDate = new Date(dragAction.initialStartDate.getTime() + daysDiff * ONE_DAY_MS);
            newEndDate = dragAction.initialEndDate;
            if (newStartDate.getTime() > newEndDate.getTime()) {
                newStartDate = new Date(newEndDate.getTime());
            }
        }
    
        setTasks(currentTasks => 
            currentTasks.map(task => 
                task.id === dragAction.task.id
                    ? { ...task, startDate: formatDate(newStartDate), endDate: formatDate(newEndDate) }
                    : task
            )
        );
    }, [dragAction, viewMode, dayWidth]);
    
    const handleMouseUp = useCallback(async () => {
        if (!dragAction || !currentUser || !project) {
            setDragAction(null);
            return;
        }
        
        const updatedTask = tasks.find(t => t.id === dragAction.task.id);
        setDragAction(null);
    
        if (!updatedTask) return;
    
        const originalStartDate = formatDate(dragAction.initialStartDate);
        const originalEndDate = formatDate(dragAction.initialEndDate);
    
        if (updatedTask.startDate !== originalStartDate || updatedTask.endDate !== originalEndDate) {
            try {
                await firestore.doc(getCollectionPath.scheduleTaskDoc(currentUser.uid, project.id, updatedTask.id))
                    .update({
                        startDate: updatedTask.startDate,
                        endDate: updatedTask.endDate,
                    });
            } catch (err) {
                console.error("Error updating task dates:", err);
                setError("タスクの日付更新に失敗しました。");
                setTasks(prevTasks => prevTasks.map(t =>
                    t.id === updatedTask.id ? { ...t, startDate: originalStartDate, endDate: originalEndDate } : t
                ));
            }
        }
    }, [dragAction, tasks, currentUser, project]);
    
    useEffect(() => {
        if (!dragAction) return;
    
        const cursorClass = dragAction.type === 'move' ? 'dragging-gantt' : 'dragging-gantt-resize';
        document.body.classList.add(cursorClass);
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp, { once: true });
        
        return () => {
            document.body.classList.remove(cursorClass);
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [dragAction, handleMouseMove, handleMouseUp]);


    useEffect(() => {
        setTasks(initialTasks.map(task => ({
            ...task,
            depth: task.depth || 0,
            parentId: task.parentId || null,
            isSectionHeader: task.isSectionHeader || false,
            isCollapsed: task.isCollapsed || false,
        })));
        if (editingTaskId && !initialTasks.find(t => t.id === editingTaskId)) {
            setEditingTaskId(null);
        }
    }, [initialTasks, editingTaskId]);
    
    const handleScrollPast = () => {
        if (mainScrollContainerRef.current) {
            let scrollAmount = 0;
            if (viewMode === 'daily') scrollAmount = 7 * dayWidth;
            else if (viewMode === 'weekly') scrollAmount = 4 * dayWidth;
            else scrollAmount = 3 * dayWidth;
            mainScrollContainerRef.current.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
        }
    };

    const handleScrollFuture = () => {
        if (mainScrollContainerRef.current) {
            let scrollAmount = 0;
            if (viewMode === 'daily') scrollAmount = 7 * dayWidth;
            else if (viewMode === 'weekly') scrollAmount = 4 * dayWidth;
            else scrollAmount = 3 * dayWidth;
            mainScrollContainerRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
        }
    };

    const handleAddItem = async (parentId: string | null, depth: number, isSection: boolean) => {
        if (!currentUser || !project) return;
        let newOrder = tasks.filter(t => t.parentId === parentId).length;
        const baseItemData = { projectId: project.id, userId: currentUser.uid, order: newOrder, parentId: parentId, depth: depth, isCollapsed: false, sheetId: sheet.id, };
        const newItemData: Omit<ScheduleTask, 'id' | 'isEditing'> = isSection ? (() => {
            const sectionCount = tasks.filter(t => t.isSectionHeader && t.depth === depth).length;
            const color = parentId ? findTopmostAncestorColor(parentId, tasks) || SECTION_COLORS[0] : SECTION_COLORS[sectionCount % SECTION_COLORS.length];
            return { ...baseItemData, name: '新規セクション', startDate: null, endDate: null, isSectionHeader: true, color: color, }
        })() : { ...baseItemData, name: '新規タスク', startDate: null, endDate: null, isSectionHeader: false, color: parentId ? (findTopmostAncestorColor(parentId, tasks) || '#a78bfa') : '#a78bfa', };
        const tasksPath = getCollectionPath.scheduleTasks(currentUser.uid, project.id);
        const docRef = await firestore.collection(tasksPath).add(newItemData);
        setEditingTaskId(docRef.id);
    };
    
    const handleUpdateTask = async (taskId: string) => {
        if (!currentUser || !project) return;
        const task = tasks.find(t => t.id === taskId);
        if (!task) return;
        const { isEditing, ...taskData } = task;
        if (!taskData.name.trim()) { setError("タスク名は必須です。"); return; }
        if (taskData.startDate && taskData.endDate && new Date(taskData.startDate) > new Date(taskData.endDate)) { setError("開始日は終了日より前に設定してください。"); return; }
        const batch = firestore.batch();
        const taskDocRef = firestore.doc(getCollectionPath.scheduleTaskDoc(currentUser.uid, project.id, taskId));
        batch.update(taskDocRef, taskData);
        const originalTask = initialTasks.find(t => t.id === taskId);
        if (task.isSectionHeader && originalTask && originalTask.color !== task.color) {
            const descendantIds: string[] = [];
            const findDescendantsRecursive = (parentId: string) => tasks.filter(t => t.parentId === parentId).forEach(child => { descendantIds.push(child.id); findDescendantsRecursive(child.id); });
            findDescendantsRecursive(taskId);
            descendantIds.forEach(descendantId => batch.update(firestore.doc(getCollectionPath.scheduleTaskDoc(currentUser.uid, project.id, descendantId)), { color: task.color }));
        }
        await batch.commit();
        setEditingTaskId(null);
        setError(null);
    };
    
    const handleCancelEdit = (taskId: string) => {
        const originalTask = initialTasks.find(t => t.id === taskId);
        if (originalTask) setTasks(prevTasks => prevTasks.map(t => t.id === taskId ? originalTask : t));
        else handleDeleteTask(taskId, true);
        setEditingTaskId(null);
        setError(null);
    };

    const handleDeleteTask = async (taskId: string, silent: boolean = false) => {
        if (!currentUser || !project) return;
        const taskToDelete = tasks.find(t => t.id === taskId);
        if (!taskToDelete) return;
        const children = tasks.filter(t => t.parentId === taskId);
        const confirmMessage = taskToDelete.isSectionHeader && children.length > 0 ? "このセクションとその全てのタスク/サブセクションを削除しますか？" : "このタスクを削除しますか？";
        if (!silent && !window.confirm(confirmMessage)) return;
        const batch = firestore.batch();
        const tasksToDeleteIds = new Set<string>([taskId]);
        const recursivelyFindChildren = (parentId: string) => tasks.filter(t => t.parentId === parentId).forEach(child => { tasksToDeleteIds.add(child.id); if (child.isSectionHeader) recursivelyFindChildren(child.id); });
        if (taskToDelete.isSectionHeader) recursivelyFindChildren(taskId);
        tasksToDeleteIds.forEach(id => batch.delete(firestore.doc(getCollectionPath.scheduleTaskDoc(currentUser.uid, project.id, id))));
        await batch.commit();
        if (editingTaskId === taskId) setEditingTaskId(null);
    };

    const handleTaskChange = <K extends keyof ScheduleTask>(taskId: string, field: K, value: ScheduleTask[K]) => {
        setTasks(prev => {
            let newTasks = prev.map(t => (t.id === taskId ? { ...t, [field]: value } : t));
            const changedTask = newTasks.find(t => t.id === taskId);
            if (changedTask?.isSectionHeader && field === 'color') {
                const newColor = value as string;
                const descendantIds = new Set<string>();
                const findDescendants = (parentId: string) => newTasks.filter(t => t.parentId === parentId).forEach(child => { descendantIds.add(child.id); findDescendants(child.id); });
                findDescendants(taskId);
                newTasks = newTasks.map(t => descendantIds.has(t.id) ? { ...t, color: newColor } : t);
            }
            return newTasks;
        });
    };
    
    const handleToggleCollapse = async (taskId: string) => {
        const task = tasks.find(t => t.id === taskId);
        if(!task || !currentUser || !project) return;
        const newCollapsedState = !task.isCollapsed;
        setTasks(prev => prev.map(t => t.id === taskId ? { ...t, isCollapsed: newCollapsedState } : t));
        await firestore.doc(getCollectionPath.scheduleTaskDoc(currentUser.uid, project.id, taskId)).update({ isCollapsed: newCollapsedState });
    };

    const handleMoveTask = async (taskId: string, direction: 'up' | 'down') => {
        if (!currentUser || !project) return;
        const taskToMove = tasks.find(t => t.id === taskId);
        if (!taskToMove) return;
        const siblings = tasks.filter(t => t.parentId === taskToMove.parentId).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        const currentIndex = siblings.findIndex(t => t.id === taskId);
        if ((direction === 'up' && currentIndex <= 0) || (direction === 'down' && currentIndex >= siblings.length - 1)) return;
        const swapIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
        [siblings[currentIndex], siblings[swapIndex]] = [siblings[swapIndex], siblings[currentIndex]];
        const updatedSiblings = siblings.map((task, index) => ({ ...task, order: index }));
        setTasks(tasks.map(originalTask => updatedSiblings.find(us => us.id === originalTask.id) || originalTask));
        const batch = firestore.batch();
        updatedSiblings.forEach(task => batch.update(firestore.doc(getCollectionPath.scheduleTaskDoc(currentUser.uid, project.id, task.id)), { order: task.order }));
        await batch.commit();
    };
    
    const handleSaveView = async () => {
        if (!currentUser) return;
        setIsSavingView(true);
        try {
          await firestore.doc(getCollectionPath.scheduleSheetDoc(currentUser.uid, project.id, sheet.id)).update({ 'viewPreferences.viewMode': viewMode });
        } catch (err) { setError("ビュー設定の保存に失敗しました。"); } finally { setIsSavingView(false); }
    };
    
    const handleDragStart = useCallback((e: React.MouseEvent, task: ScheduleTask, type: 'move' | 'resize-start' | 'resize-end') => {
        e.preventDefault();
        e.stopPropagation();
        if (!task.startDate || !task.endDate || editingTaskId) return;
    
        setDragAction({
            type,
            task,
            startX: e.clientX,
            initialStartDate: parseDateAsLocal(task.startDate)!,
            initialEndDate: parseDateAsLocal(task.endDate)!,
        });
    }, [editingTaskId]);
    
    const displayTasks = useMemo(() => {
        const buildHierarchy = (items: ScheduleTask[], parentId: string | null = null): ScheduleTask[] => {
            return items.filter(item => item.parentId === parentId).sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                .flatMap(child => [child, ...(child.isSectionHeader && !child.isCollapsed ? buildHierarchy(items, child.id) : [])]);
        };
        return buildHierarchy(tasks);
    }, [tasks]);

    const ganttTotalWidth = timelineDates.length * dayWidth;

    return (
        <div className="bg-white">
            <div className="p-4 flex justify-between items-center border-b border-slate-200">
                <div className="flex items-center gap-2">
                    <div className="inline-flex rounded-md shadow-sm" role="group">{['daily','weekly','monthly'].map(mode => <button key={mode} type="button" onClick={() => setViewMode(mode as any)} className={`px-4 py-2 text-sm font-medium border focus:z-10 focus:ring-2 focus:ring-sky-500 focus:outline-none transition-colors duration-150 first:rounded-l-md last:rounded-r-md -ml-px ${viewMode === mode ? 'bg-sky-600 text-white border-sky-600' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'}`}>{ {daily: '日', weekly: '週', monthly: '月'}[mode] }ごと</button>)}</div>
                    <div className="flex items-center gap-1 border-l border-slate-300 ml-2 pl-3"><IconButton onClick={handleScrollPast} aria-label="過去にスクロール"><ChevronLeftIcon /></IconButton><IconButton onClick={handleScrollFuture} aria-label="未来にスクロール"><ChevronRightIcon /></IconButton></div>
                    <SecondaryButton icon={<SaveIcon />} onClick={handleSaveView} disabled={isSavingView}>{isSavingView ? '保存中...' : '表示設定を保存'}</SecondaryButton>
                </div>
                <div className="flex items-center gap-2">
                    <PrimaryButton onClick={() => handleAddItem(null, 0, true)} icon={<PlusIcon />}>セクション追加</PrimaryButton>
                </div>
            </div>
            
            {error && <p className="text-red-600 bg-red-100 p-3 m-4 rounded-md">{error}</p>}
            
            <div ref={mainScrollContainerRef} className="grid overflow-auto max-h-[70vh] border-t border-slate-200 text-sm"
                 style={{ gridTemplateColumns: 'minmax(500px, auto) 1fr' }}>
                {/* Headers */}
                <div className="sticky top-0 left-0 z-30 bg-slate-100 border-b-2 border-r border-slate-200 h-[64px] grid grid-cols-5">
                    <div className="col-span-3 p-2 px-4 border-r border-slate-200 flex items-center font-semibold text-slate-700">タスク</div>
                    <div className="p-2 px-4 border-r border-slate-200 flex items-center font-semibold text-slate-700">開始日</div>
                    <div className="p-2 px-4 flex items-center font-semibold text-slate-700">締切日</div>
                </div>
                <div className="sticky top-0 z-20" style={{ width: ganttTotalWidth }}>
                    <GanttChartHeader timelineDates={timelineDates} viewMode={viewMode} dayWidth={dayWidth} />
                </div>

                {/* Body Rows */}
                {displayTasks.length > 0 ? (
                    displayTasks.map(task => {
                        const siblings = tasks.filter(t => t.parentId === task.parentId).sort((a,b) => (a.order ?? 0) - (b.order ?? 0));
                        const currentIndex = siblings.findIndex(s => s.id === task.id);
                        const canMoveUp = currentIndex > 0;
                        const canMoveDown = currentIndex < siblings.length - 1;

                        return (
                            <React.Fragment key={task.id}>
                                <div className="sticky left-0 z-30 bg-white border-r border-slate-200 shadow-[5px_0_5px_-5px_rgba(0,0,0,0.1)]">
                                    {task.isSectionHeader ? (
                                        <ScheduleSectionRow section={task} isEditing={editingTaskId === task.id} onToggleCollapse={handleToggleCollapse} onStartEdit={setEditingTaskId} onCancelEdit={handleCancelEdit} onUpdate={handleUpdateTask} onDelete={handleDeleteTask} onAddItem={handleAddItem} onTaskChange={handleTaskChange} onMoveTask={handleMoveTask} canMoveUp={canMoveUp} canMoveDown={canMoveDown} />
                                    ) : (
                                        <ScheduleTaskRow task={task} isEditing={editingTaskId === task.id} onStartEdit={setEditingTaskId} onCancelEdit={handleCancelEdit} onUpdate={handleUpdateTask} onDelete={handleDeleteTask} onTaskChange={handleTaskChange} onMoveTask={handleMoveTask} canMoveUp={canMoveUp} canMoveDown={canMoveDown} />
                                    )}
                                </div>
                                <div className="relative z-10 border-b border-slate-200" style={{ width: ganttTotalWidth }}>
                                    {/* Backgrounds */}
                                    <div className="absolute inset-0 flex z-0">
                                        {timelineDates.map((date) => {
                                            let bgColor = 'bg-transparent';
                                            if (viewMode === 'daily') {
                                                const day = date.getDay();
                                                const isHoliday = JAPANESE_PUBLIC_HOLIDAYS.some(h => h.date === formatDate(date, 'yyyy-MM-dd'));
                                                if (isHoliday || day === 0) bgColor = 'bg-rose-50/50';
                                                else if (day === 6) bgColor = 'bg-sky-50/50';
                                            }
                                            return <div key={date.toISOString()} style={{minWidth: `${dayWidth}px`, width: `${dayWidth}px`}} className={`h-full ${bgColor}`}></div>
                                        })}
                                    </div>
                                    {/* Vertical Lines */}
                                    <div className="absolute inset-0 flex z-10 pointer-events-none">
                                        {timelineDates.map((date, index) => {
                                            let borderClass = 'border-r-slate-200';
                                             if (viewMode === 'daily') {
                                                if (index < timelineDates.length - 1 && date.getMonth() !== timelineDates[index + 1].getMonth()) {
                                                    borderClass = 'border-r-slate-400';
                                                }
                                            } else if (viewMode === 'weekly') {
                                                if (monthEndIndices.has(index)) {
                                                    borderClass = 'border-r-slate-400';
                                                }
                                            } else if (viewMode === 'monthly') {
                                                if (index < timelineDates.length - 1 && date.getFullYear() !== timelineDates[index + 1].getFullYear()) {
                                                    borderClass = 'border-r-slate-400';
                                                }
                                            }
                                            return <div key={date.toISOString()} style={{minWidth: `${dayWidth}px`, width: `${dayWidth}px`}} className={`h-full border-r ${borderClass}`}></div>
                                        })}
                                    </div>
                                    {/* Today Marker */}
                                    {todayIndex >= 0 && viewMode === 'daily' && <div className="absolute top-0 bottom-0 bg-red-500/50 w-0.5 z-25" style={{ left: `${todayIndex * dayWidth + dayWidth/2}px` }}></div>}
                                    {/* Task Bar */}
                                    {(() => {
                                        const startDate = parseDateAsLocal(task.startDate);
                                        const endDate = parseDateAsLocal(task.endDate);
                                        if (!startDate || !endDate || startDate > endDate || timelineDates.length === 0) return null;
                                        const timelineStart = timelineDates[0];
                                        let left = -1, width = 0;
                                        
                                        const durationDays = (endDate.getTime() - startDate.getTime()) / 86400000 + 1;

                                        if (viewMode === 'monthly') {
                                            const startMonth = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
                                            const timelineMonthIndex = timelineDates.findIndex(d => d.getTime() === startMonth.getTime());
                                            if (timelineMonthIndex > -1) {
                                                const daysInStartMonth = getDaysInMonth(startDate);
                                                left = (timelineMonthIndex * dayWidth) + (((startDate.getDate() - 1) / daysInStartMonth) * dayWidth);
                                                const endMonth = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
                                                const endTimelineMonthIndex = timelineDates.findIndex(d => d.getTime() === endMonth.getTime());
                                                if (endTimelineMonthIndex > -1) {
                                                    const daysInEndMonth = getDaysInMonth(endDate);
                                                    const endPosition = (endTimelineMonthIndex * dayWidth) + ((endDate.getDate() / daysInEndMonth) * dayWidth);
                                                    width = endPosition - left;
                                                }
                                            }
                                        } else {
                                            const startOffsetDays = (startDate.getTime() - timelineStart.getTime()) / 86400000;
                                            
                                            if (viewMode === 'daily') {
                                                left = startOffsetDays * dayWidth;
                                                width = durationDays * dayWidth;
                                            } else { // weekly
                                                left = (startOffsetDays / 7) * dayWidth;
                                                width = (durationDays / 7) * dayWidth;
                                            }
                                        }
                                        if (width < 0) return null;
                                        const barColor = task.color || '#a78bfa';
                                        const title = `${task.name}: ${formatDate(task.startDate, 'yy/MM/dd')} - ${formatDate(task.endDate, 'yy/MM/dd')}`;
                                        
                                        const durationText = formatDuration(durationDays);

                                        const barContent = task.isSectionHeader ? (
                                            (task.depth ?? 0) === 0 ? (
                                                <div style={{ backgroundColor: barColor }} className="gantt-bar-body w-full h-5 rounded-lg flex items-center shadow-lg overflow-hidden">
                                                    <span className="text-white text-xs px-3 font-semibold tracking-wide truncate w-full flex items-baseline">
                                                        <span className="truncate">{task.name}</span>
                                                        {durationText && <span className="font-normal ml-2 opacity-90 flex-shrink-0">{durationText}</span>}
                                                    </span>
                                                </div>
                                            ) : (
                                                <div style={{ backgroundColor: hexToRgba(barColor, 0.3), borderColor: hexToRgba(barColor, 0.9) }} className="gantt-bar-body w-full h-6 rounded-md flex items-center overflow-hidden border">
                                                    <div style={{ backgroundColor: barColor }} className="w-1 h-full flex-shrink-0" />
                                                     <span className="text-slate-800 font-semibold text-xs px-2 truncate flex items-baseline">
                                                          <span className="truncate">{task.name}</span>
                                                          {durationText && <span className="font-normal ml-2 opacity-90 flex-shrink-0">{durationText}</span>}
                                                    </span>
                                                </div>
                                            )
                                        ) : (
                                            <div style={{ backgroundColor: hexToRgba(barColor, 0.3), borderColor: hexToRgba(barColor, 0.9) }} className="gantt-bar-body w-full h-8 rounded-md flex items-center overflow-hidden border">
                                                <div style={{ backgroundColor: barColor }} className="w-1 h-full flex-shrink-0" />
                                                <span className="text-slate-800 font-medium text-xs px-2 truncate flex items-baseline">
                                                    <span className="truncate">{task.name}</span>
                                                    {durationText && <span className="font-normal ml-2 text-slate-600 flex-shrink-0">{durationText}</span>}
                                                </span>
                                            </div>
                                        );

                                        return (
                                            <div
                                                className="absolute inset-y-0 flex items-center z-20 group/bar"
                                                style={{ transform: `translateX(${left}px)`, width: `${width}px` }}
                                                title={title}
                                            >
                                                <div className="gantt-resize-handle left opacity-0 group-hover/bar:opacity-100 transition-opacity" onMouseDown={e => handleDragStart(e, task, 'resize-start')} />
                                                <div className="w-full" onMouseDown={e => handleDragStart(e, task, 'move')}>
                                                    {barContent}
                                                </div>
                                                <div className="gantt-resize-handle right opacity-0 group-hover/bar:opacity-100 transition-opacity" onMouseDown={e => handleDragStart(e, task, 'resize-end')} />
                                            </div>
                                        );
                                    })()}
                                </div>
                            </React.Fragment>
                        )
                    })
                ) : (
                    <>
                        <div className="sticky left-0 bg-white border-r border-slate-200">
                           <div className="h-40 flex items-center justify-center text-slate-500">
                                タスクがありません。
                           </div>
                        </div>
                        <div className="border-b border-slate-200"></div>
                    </>
                )}
            </div>
        </div>
    );
};

const ScheduleSectionRow: React.FC<{ section: ScheduleTask; isEditing: boolean; onToggleCollapse: (id: string) => void; onStartEdit: (id: string) => void; onCancelEdit: (id: string) => void; onUpdate: (id: string) => void; onDelete: (id: string) => void; onAddItem: (parentId: string | null, depth: number, isSection: boolean) => void; onTaskChange: <K extends keyof ScheduleTask>(taskId: string, field: K, value: ScheduleTask[K]) => void; onMoveTask: (taskId: string, direction: 'up' | 'down') => void; canMoveUp: boolean; canMoveDown: boolean;}> = ({ section, isEditing, onToggleCollapse, onStartEdit, onCancelEdit, onUpdate, onDelete, onAddItem, onTaskChange, onMoveTask, canMoveUp, canMoveDown }) => {
    const [isPaletteOpen, setIsPaletteOpen] = useState(false);
    const paletteContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (isPaletteOpen && paletteContainerRef.current && !paletteContainerRef.current.contains(event.target as Node)) {
                setIsPaletteOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isPaletteOpen]);

    useEffect(() => {
        if (!isEditing) {
            setIsPaletteOpen(false);
        }
    }, [isEditing]);
    
    return (
        <div className="group grid grid-cols-5 bg-slate-50 h-[58px] relative">
            <div className="flex items-center col-span-3 px-4">
                <div style={{ paddingLeft: `${section.depth * 24}px` }} className="flex items-center gap-2 w-full">
                    <IconButton onClick={() => onToggleCollapse(section.id)} className="w-6 h-6 p-0" aria-label={section.isCollapsed ? '展開' : '折りたたむ'}><ChevronDownIcon className={`transition-transform duration-200 ${section.isCollapsed ? '-rotate-90' : ''}`} /></IconButton>
                    
                    {isEditing ? (
                        <div className="relative" ref={paletteContainerRef}>
                            <button
                                type="button"
                                onClick={() => setIsPaletteOpen(p => !p)}
                                style={{ backgroundColor: section.color || '#cccccc' }}
                                className="w-6 h-6 rounded-md border border-slate-400 flex-shrink-0"
                                aria-label="色を変更"
                            />
                            {isPaletteOpen && (
                                <div className="absolute top-full mt-2 z-20 bg-white p-2 rounded-lg shadow-xl border border-slate-200 grid grid-cols-4 gap-2">
                                    {SECTION_COLORS.map(c => (
                                        <button
                                            key={c}
                                            type="button"
                                            onClick={() => {
                                                onTaskChange(section.id, 'color', c);
                                                setIsPaletteOpen(false);
                                            }}
                                            style={{ backgroundColor: c }}
                                            className={`w-5 h-5 rounded-full border-2 border-white focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-sky-500 transition-transform hover:scale-110 ${section.color === c ? 'ring-2 ring-sky-500' : ''}`}
                                            aria-label={`色 ${c} を選択`}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div style={{ backgroundColor: section.color || '#cccccc' }} className="w-4 h-4 rounded-sm border border-slate-400 flex-shrink-0"></div>
                    )}

                    <EditableField isEditing={isEditing} value={section.name} onChange={(val) => onTaskChange(section.id, 'name', val)} inputClassName="text-sm font-semibold" placeholder="新規セクション" className="flex-grow min-w-0" />
                </div>
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center bg-white/80 backdrop-blur-sm rounded-full shadow-md px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    {isEditing ? (<><IconButton onClick={() => onUpdate(section.id)} aria-label="保存"><SaveIcon className="text-sky-600"/></IconButton><IconButton onClick={() => onCancelEdit(section.id)} aria-label="キャンセル"><CancelIcon /></IconButton></>) : (<><IconButton onClick={() => onMoveTask(section.id, 'up')} disabled={!canMoveUp} aria-label="上に移動"><ArrowUpwardIcon /></IconButton><IconButton onClick={() => onMoveTask(section.id, 'down')} disabled={!canMoveDown} aria-label="下に移動"><ArrowDownwardIcon /></IconButton><IconButton onClick={() => onStartEdit(section.id)} aria-label="編集"><EditIcon /></IconButton><IconButton onClick={() => onAddItem(section.id, section.depth + 1, false)} title="タスクを追加" aria-label="タスクを追加"><AddTaskIcon /></IconButton><IconButton onClick={() => onAddItem(section.id, section.depth + 1, true)} title="サブセクションを追加" aria-label="サブセクションを追加"><PlaylistAddIcon /></IconButton><IconButton onClick={() => onDelete(section.id)} className="hover:text-red-500" aria-label="削除"><TrashIcon /></IconButton></>)}
                </div>
            </div>
            <div className="flex items-center border-l border-slate-200 px-4"><EditableField isEditing={isEditing} value={section.startDate || ''} onChange={(val) => onTaskChange(section.id, 'startDate', val)} inputType="date" className="w-full" /></div>
            <div className="flex items-center border-l border-slate-200 px-4"><EditableField isEditing={isEditing} value={section.endDate || ''} onChange={(val) => onTaskChange(section.id, 'endDate', val)} inputType="date" className="w-full" /></div>
        </div>
    );
};

const ScheduleTaskRow: React.FC<{ task: ScheduleTask; isEditing: boolean; onStartEdit: (id: string) => void; onCancelEdit: (id: string) => void; onUpdate: (id: string) => void; onDelete: (id: string) => void; onTaskChange: <K extends keyof ScheduleTask>(taskId: string, field: K, value: ScheduleTask[K]) => void; onMoveTask: (taskId: string, direction: 'up' | 'down') => void; canMoveUp: boolean; canMoveDown: boolean;}> = ({ task, isEditing, onStartEdit, onCancelEdit, onUpdate, onDelete, onTaskChange, onMoveTask, canMoveUp, canMoveDown }) => {
    return (
        <div className="group grid grid-cols-5 bg-white h-[58px] relative">
            <div className="flex items-center col-span-3 px-4">
                <div style={{ paddingLeft: `${task.depth * 24}px` }} className="flex items-center gap-2">
                    <SubdirectoryArrowRightIcon className="text-slate-400 text-lg flex-shrink-0" />
                    <EditableField isEditing={isEditing} value={task.name} onChange={(val) => onTaskChange(task.id, 'name', val)} placeholder="新規タスク" inputClassName="text-sm" />
                </div>
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center bg-white/80 backdrop-blur-sm rounded-full shadow-md px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    {isEditing ? (<><IconButton onClick={() => onUpdate(task.id)} aria-label="保存"><SaveIcon className="text-sky-600"/></IconButton><IconButton onClick={() => onCancelEdit(task.id)} aria-label="キャンセル"><CancelIcon/></IconButton></>) : (<><IconButton onClick={() => onMoveTask(task.id, 'up')} disabled={!canMoveUp} aria-label="上に移動"><ArrowUpwardIcon /></IconButton><IconButton onClick={() => onMoveTask(task.id, 'down')} disabled={!canMoveDown} aria-label="下に移動"><ArrowDownwardIcon /></IconButton><IconButton onClick={() => onStartEdit(task.id)} aria-label="編集"><EditIcon /></IconButton><IconButton onClick={() => onDelete(task.id)} className="hover:text-red-500" aria-label="削除"><TrashIcon /></IconButton></>)}
                </div>
            </div>
            <div className="flex items-center border-l border-slate-200 px-4"><EditableField isEditing={isEditing} value={task.startDate || ''} onChange={(val) => onTaskChange(task.id, 'startDate', val)} inputType="date" className="w-full" /></div>
            <div className="flex items-center border-l border-slate-200 px-4"><EditableField isEditing={isEditing} value={task.endDate || ''} onChange={(val) => onTaskChange(task.id, 'endDate', val)} inputType="date" className="w-full" /></div>
        </div>
    );
};

export default GanttScheduleTab;