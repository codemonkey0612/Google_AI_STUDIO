import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { TimeScheduleEntry, Project, TimeScheduleSheet, TimeScheduleSection } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { firestore, getCollectionPath, firebase } from '../firebase';
import { PlusIcon, SaveIcon, CancelIcon, TrashIcon, ChevronLeftIcon, ChevronRightIcon, CogIcon, SubdirectoryArrowRightIcon, ArrowUpwardIcon, ArrowDownwardIcon, LocationIcon, EyeIcon, EyeSlashIcon } from '../components/Icons';
import { PrimaryButton, SecondaryButton, IconButton } from '../components/common/Buttons';
import Modal from '../components/Modal';
import { formatDate, hexToRgba } from '@/utils';

const PREDEFINED_SECTION_COLORS = ['#3b82f6', '#10b981', '#f97316', '#8b5cf6', '#ec4899', '#ef4444', '#14b8a6', '#64748b'];

const formatDuration = (startTime: string, endTime: string): string => {
    try {
        if (startTime === endTime) return '';
        const startMinutes = parseInt(startTime.split(':')[0]) * 60 + parseInt(startTime.split(':')[1]);
        const endMinutes = parseInt(endTime.split(':')[0]) * 60 + parseInt(endTime.split(':')[1]);
        const diff = endMinutes - startMinutes;
        if (diff <= 0) return '';

        const hours = Math.floor(diff / 60);
        const minutes = diff % 60;

        let durationStr = '';
        if (hours > 0) durationStr += `${hours}時間`;
        if (minutes > 0) durationStr += `${minutes}分`;

        return durationStr;
    } catch {
        return '';
    }
};

const minutesToTime = (totalMinutes: number): string => {
    const hour = Math.floor(totalMinutes / 60) % 24;
    const minute = totalMinutes % 60;
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
};

// --- Layout Calculation for Overlapping Events ---
type EntryWithLayout = TimeScheduleEntry & {
    top: number;
    height: number;
    left: number;
    width: number;
    contentWidthPercent: number;
};

const TimeScheduleTab: React.FC<{
    project: Project;
    sheet: TimeScheduleSheet;
    initialEntries: TimeScheduleEntry[];
}> = ({ project, sheet, initialEntries }) => {
    const { currentUser } = useAuth();
    
    // Configurable time and layout settings
    const TIME_GRID_MINUTES = sheet.viewPreferences?.timeGridMinutes ?? 30;
    const GRID_HEIGHTS: Record<typeof TIME_GRID_MINUTES, number> = { 30: 24, 15: 15, 10: 12, 5: 10 };
    const GRID_INTERVAL_HEIGHT_PX = GRID_HEIGHTS[TIME_GRID_MINUTES];
    const HOUR_HEIGHT_PX = (60 / TIME_GRID_MINUTES) * GRID_INTERVAL_HEIGHT_PX;

    const START_HOUR = sheet.viewPreferences?.startHour ?? 7;
    const END_HOUR = sheet.viewPreferences?.endHour ?? 25; // Exclusive, so 25 means up to 24:59 (1am next day)
    const TOTAL_HOURS = END_HOUR > START_HOUR ? END_HOUR - START_HOUR : (24 - START_HOUR) + END_HOUR;
    const TOTAL_HEIGHT_PX = TOTAL_HOURS * HOUR_HEIGHT_PX;

    const sortedDates = useMemo(() => {
        if (!sheet || !sheet.dates) {
            return [];
        }
        return sheet.dates.slice().sort();
    }, [sheet.dates]);
    
    const [displayDate, setDisplayDate] = useState(() => {
        if (sortedDates.length > 0) {
            return new Date(sortedDates[0] + 'T00:00:00');
        }
        return new Date(); // Fallback
    });
    const [entries, setEntries] = useState<TimeScheduleEntry[]>([]);
    const [sections, setSections] = useState<TimeScheduleSection[]>([]);
    const [modalState, setModalState] = useState<{ isOpen: boolean; entry: Partial<TimeScheduleEntry> | null }>({ isOpen: false, entry: null });
    const [showSectionModal, setShowSectionModal] = useState(false);
    
    const [dragAction, setDragAction] = useState<{
        type: 'create' | 'move' | 'resize-top' | 'resize-bottom';
        entry: Partial<TimeScheduleEntry>;
        startY: number;
        gridTop: number;
        initialTop?: number;
        initialHeight?: number;
    } | null>(null);
    const scheduleContainerRef = useRef<HTMLDivElement>(null);
    const wasDraggedRef = useRef(false);
    
    const parentEntryForModal = useMemo(() => {
        if (modalState.isOpen && modalState.entry?.parentId) {
            return entries.find(e => e.id === modalState.entry!.parentId);
        }
        return null;
    }, [modalState, entries]);


    // --- Core Calculation Logic (moved inside component) ---
    const timeToMinutes = useCallback((time: string): number => {
        let [hours, minutes] = time.split(':').map(Number);
        if (hours < START_HOUR) {
            hours += 24;
        }
        return hours * 60 + minutes;
    }, [START_HOUR]);

    const calculateOverlapLayout = useCallback((entries: TimeScheduleEntry[]): Omit<EntryWithLayout, 'contentWidthPercent'>[] => {
        const minutesPerPixel = 60 / HOUR_HEIGHT_PX;
        const augmented = entries.map(entry => ({
            ...entry,
            start: timeToMinutes(entry.startTime),
            end: timeToMinutes(entry.endTime),
        })).sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));
    
        const groups: (typeof augmented)[] = [];
        if (augmented.length > 0) {
            let currentGroup = [augmented[0]];
            groups.push(currentGroup);
            let groupMaxEnd = augmented[0].end;

            for (let i = 1; i < augmented.length; i++) {
                const entry = augmented[i];
                if (entry.start < groupMaxEnd) {
                    currentGroup.push(entry);
                    groupMaxEnd = Math.max(groupMaxEnd, entry.end);
                } else {
                    currentGroup = [entry];
                    groups.push(currentGroup);
                    groupMaxEnd = entry.end;
                }
            }
        }
        
        const finalLayout: Omit<EntryWithLayout, 'contentWidthPercent'>[] = [];
    
        for (const group of groups) {
            group.sort((a, b) => a.start - b.start);
            const columns: (typeof group)[] = [];
            for (const entry of group) {
                let placedInColumn = false;
                for (const column of columns) {
                    if (column.length > 0 && column[column.length - 1].end <= entry.start) {
                        column.push(entry);
                        placedInColumn = true;
                        break;
                    }
                }
                if (!placedInColumn) {
                    columns.push([entry]);
                }
            }
            
            const numColumns = columns.length;
            for (let i = 0; i < numColumns; i++) {
                const column = columns[i];
                if (!column || column.length === 0) continue; 
                for (const entry of column) {
                    const top = (entry.start - START_HOUR * 60) / minutesPerPixel;
                    const height = (entry.end - entry.start) / minutesPerPixel;
                    finalLayout.push({ ...entry, top, height, left: (i / numColumns) * 100, width: (1 / numColumns) * 100 });
                }
            }
        }
        return finalLayout;
    }, [timeToMinutes, HOUR_HEIGHT_PX, START_HOUR]);
    
    const calculateLayout = useCallback((allEntries: TimeScheduleEntry[]): EntryWithLayout[] => {
        
        const memo = new Map<string, number>();
        const getMaxDescendantDepth = (entryId: string, entries: TimeScheduleEntry[]): number => {
            if (memo.has(entryId)) return memo.get(entryId)!;

            const children = entries.filter(e => e.parentId === entryId);
            if (children.length === 0) {
                memo.set(entryId, 0);
                return 0;
            }
            const maxDepth = 1 + Math.max(...children.map(child => getMaxDescendantDepth(child.id, entries)));
            memo.set(entryId, maxDepth);
            return maxDepth;
        };
        
        const processChildren = (parentId: string | null, parentAvailableLayout: { left: number, width: number }): EntryWithLayout[] => {
            const children = allEntries.filter(e => (e.parentId || null) === parentId);
            if (children.length === 0) return [];
            
            const relativeLayouts = calculateOverlapLayout(children);
            const layouts: EntryWithLayout[] = [];
    
            for (const relLayout of relativeLayouts) {
                const absoluteLeft = parentAvailableLayout.left + (parentAvailableLayout.width * relLayout.left / 100);
                const absoluteWidth = parentAvailableLayout.width * relLayout.width / 100;
                
                const maxDescendantDepthForThisEntry = getMaxDescendantDepth(relLayout.id, allEntries);

                let contentWidthPercent: number;
                let childrenStartPercent: number;
                
                if (maxDescendantDepthForThisEntry === 0) {
                    contentWidthPercent = 100;
                    childrenStartPercent = 100;
                } else if (maxDescendantDepthForThisEntry === 1) { // has children, no grandchildren
                    contentWidthPercent = 50;
                    childrenStartPercent = 50;
                } else { // has grandchildren or deeper
                    contentWidthPercent = 100 / 3;
                    childrenStartPercent = 100 / 3;
                }
    
                const finalLayout: EntryWithLayout = {
                    ...relLayout,
                    left: absoluteLeft,
                    width: absoluteWidth,
                    contentWidthPercent: contentWidthPercent,
                };
                layouts.push(finalLayout);
    
                if (maxDescendantDepthForThisEntry > 0) {
                    const childrenAvailableWidthPercent = 100 - childrenStartPercent;
                    const childrenAvailableLayout = {
                        left: absoluteLeft + (absoluteWidth * childrenStartPercent / 100),
                        width: absoluteWidth * childrenAvailableWidthPercent / 100,
                    };
                    layouts.push(...processChildren(relLayout.id, childrenAvailableLayout));
                }
            }
            return layouts;
        };
        
        return processChildren(null, { left: 0, width: 100 });
    }, [calculateOverlapLayout]);

    useEffect(() => {
        setEntries(initialEntries.map(e => ({...e, depth: e.depth || 0, parentId: e.parentId || null})));
    }, [initialEntries]);
    
    useEffect(() => {
        if (sortedDates.length > 0) {
            const currentDateStr = formatDate(displayDate);
            if (!sortedDates.includes(currentDateStr)) {
                setDisplayDate(new Date(sortedDates[0] + 'T00:00:00'));
            }
        }
    }, [sortedDates, displayDate]);

    useEffect(() => {
        if (!currentUser) return;
        const sectionsPath = getCollectionPath.timeScheduleSections(currentUser.uid, project.id, sheet.id);
        const q = firestore.collection(sectionsPath).orderBy('order');
        const unsubscribe = q.onSnapshot(snapshot => {
            setSections(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as TimeScheduleSection)));
        });
        return unsubscribe;
    }, [currentUser, project.id, sheet.id]);
    
    const displaySections = useMemo(() => {
        const hiddenIds = new Set(sheet.viewPreferences?.hiddenSectionIds || []);

        const sortedSections = [...sections]
            .filter(s => !hiddenIds.has(s.id))
            .sort((a, b) => a.order - b.order);

        const isScheduleVisible = !hiddenIds.has('uncategorized');

        if (sortedSections.length === 0) {
            if (!isScheduleVisible) return [];
            return [{ 
                id: 'default', 
                name: 'スケジュール', 
                color: '#0ea5e9',
                order: -1, 
                projectId: project.id, 
                sheetId: sheet.id, 
                userId: currentUser!.uid 
            }];
        }
        
        const unassignedSection: TimeScheduleSection = { 
            id: 'uncategorized', 
            name: 'スケジュール',
            color: '#0ea5e9', 
            order: -1, 
            projectId: project.id, 
            sheetId: sheet.id, 
            userId: currentUser!.uid 
        };

        if (isScheduleVisible) {
            return [unassignedSection, ...sortedSections];
        } else {
            return sortedSections;
        }

    }, [sections, project.id, sheet.id, currentUser, sheet.viewPreferences]);

    const handleAddOrUpdateEntry = useCallback(async (entryData: Partial<TimeScheduleEntry>) => {
        if (!currentUser) return;
        const { id, ...data } = entryData;
        
        if (id) { // Update
            const updatePayload: Partial<TimeScheduleEntry> = {};
            if (data.startTime) updatePayload.startTime = data.startTime;
            if (data.endTime) updatePayload.endTime = data.endTime;
            if (data.sectionId !== undefined) updatePayload.sectionId = data.sectionId;
            if (data.color) updatePayload.color = data.color;
            if (data.title) updatePayload.title = data.title;
            if (data.description !== undefined) updatePayload.description = data.description;
            if (data.date) updatePayload.date = data.date;
            if (data.location !== undefined) updatePayload.location = data.location;

            if (Object.keys(updatePayload).length > 0) {
                 await firestore.doc(getCollectionPath.timeScheduleEntryDoc(currentUser.uid, project.id, id)).update(updatePayload);
            }
        } else { // Add
            const entryPayload = {
                sheetId: sheet.id, projectId: project.id, userId: currentUser.uid,
                title: data.title!, date: data.date!, startTime: data.startTime!, endTime: data.endTime!,
                description: data.description || '', location: data.location || '', color: data.color!,
                sectionId: data.sectionId || null,
                parentId: data.parentId || null, depth: data.depth || 0,
            };
            await firestore.collection(getCollectionPath.timeScheduleEntries(currentUser.uid, project.id)).add(entryPayload);
        }
        setModalState({ isOpen: false, entry: null });
    }, [currentUser, project.id, sheet.id]);

    useEffect(() => {
        const handleGlobalMouseMove = (e: MouseEvent) => {
            if (!dragAction) return;
            e.preventDefault();

            const dy = e.clientY - dragAction.startY;
            if (!wasDraggedRef.current && Math.abs(dy) > 5) {
                wasDraggedRef.current = true;
            }

            const gridRect = scheduleContainerRef.current?.getBoundingClientRect();
            if (!gridRect) return;

            const yInGrid = Math.max(0, Math.min(e.clientY - gridRect.top, TOTAL_HEIGHT_PX));
            
            const minutesFromGridStart = (yInGrid / TOTAL_HEIGHT_PX) * TOTAL_HOURS * 60;
            const snappedMinutes = Math.round(minutesFromGridStart / TIME_GRID_MINUTES) * TIME_GRID_MINUTES;
            const currentTotalMinutes = snappedMinutes + (START_HOUR * 60);

            if (dragAction.type === 'create') {
                const startMinutes = timeToMinutes(dragAction.entry.startTime!);
                const newStartMinutes = Math.min(startMinutes, currentTotalMinutes);
                const newEndMinutes = Math.max(startMinutes, currentTotalMinutes);

                setDragAction(prev => {
                    if (!prev) return null;
                    return {
                        ...prev,
                        entry: {
                            ...prev.entry,
                            startTime: minutesToTime(newStartMinutes),
                            endTime: minutesToTime(newEndMinutes),
                        }
                    };
                });
            } else if (dragAction.type === 'move') {
                const dy = e.clientY - dragAction.startY;
                const newTop = Math.max(0, Math.min(TOTAL_HEIGHT_PX - dragAction.initialHeight!, dragAction.initialTop! + dy));
                
                const minutesFromStartPx = (newTop / TOTAL_HEIGHT_PX) * TOTAL_HOURS * 60;
                const newTotalStartMinutes = Math.round(minutesFromStartPx / TIME_GRID_MINUTES) * TIME_GRID_MINUTES + (START_HOUR * 60);
                
                const duration = timeToMinutes(dragAction.entry.endTime!) - timeToMinutes(dragAction.entry.startTime!);
                const newTotalEndMinutes = newTotalStartMinutes + duration;

                const xInGrid = e.clientX - gridRect.left - 60; // Adjust for time axis width
                const sectionWidth = (gridRect.width - 60) / displaySections.length;
                const sectionIndex = Math.max(0, Math.min(Math.floor(xInGrid / sectionWidth), displaySections.length - 1));
                const newSection = displaySections[sectionIndex];
                const newSectionId = (newSection.id === 'default' || newSection.id === 'uncategorized') ? null : newSection.id;

                setEntries(currentEntries =>
                    currentEntries.map(entry =>
                        entry.id === dragAction.entry.id
                            ? { 
                                ...entry,
                                startTime: minutesToTime(newTotalStartMinutes),
                                endTime: minutesToTime(newTotalEndMinutes),
                                sectionId: newSectionId,
                                color: newSection.color,
                            }
                            : entry
                    )
                );
            } else if (dragAction.type === 'resize-top') {
                const initialEndMinutes = timeToMinutes(dragAction.entry.endTime!);
                const newStartMinutes = Math.min(currentTotalMinutes, initialEndMinutes - TIME_GRID_MINUTES);
                setEntries(currentEntries =>
                    currentEntries.map(entry =>
                        entry.id === dragAction.entry.id
                            ? { ...entry, startTime: minutesToTime(newStartMinutes) }
                            : entry
                    )
                );
            } else if (dragAction.type === 'resize-bottom') {
                const initialStartMinutes = timeToMinutes(dragAction.entry.startTime!);
                const newEndMinutes = Math.max(currentTotalMinutes, initialStartMinutes + TIME_GRID_MINUTES);
                 setEntries(currentEntries =>
                    currentEntries.map(entry =>
                        entry.id === dragAction.entry.id
                            ? { ...entry, endTime: minutesToTime(newEndMinutes) }
                            : entry
                    )
                );
            }
        };

        const handleGlobalMouseUp = () => {
            if (!dragAction) return;
        
            const wasDragged = wasDraggedRef.current;
            const action = dragAction;
            setDragAction(null);
        
            if (action.type === 'create') {
                if (action.entry.startTime !== action.entry.endTime) {
                    setModalState({ isOpen: true, entry: action.entry });
                }
                return;
            }
        
            if (action.entry.id) {
                if (wasDragged) {
                    const updatedEntry = entries.find(e => e.id === action.entry.id);
                    if (updatedEntry) {
                        const originalEntry = initialEntries.find(e => e.id === action.entry.id);
                        const hasChanged = !originalEntry || 
                                           originalEntry.startTime !== updatedEntry.startTime ||
                                           originalEntry.endTime !== updatedEntry.endTime ||
                                           (originalEntry.sectionId || null) !== (updatedEntry.sectionId || null) ||
                                           originalEntry.color !== updatedEntry.color;
                        if (hasChanged) {
                            handleAddOrUpdateEntry({
                                id: updatedEntry.id,
                                startTime: updatedEntry.startTime,
                                endTime: updatedEntry.endTime,
                                sectionId: updatedEntry.sectionId,
                                color: updatedEntry.color,
                            });
                        }
                    }
                } else {
                    const clickedEntry = entries.find(e => e.id === action.entry.id);
                    if (clickedEntry) {
                        setModalState({ isOpen: true, entry: clickedEntry });
                    }
                }
            }
        };

        if (dragAction) {
            window.addEventListener('mousemove', handleGlobalMouseMove);
            window.addEventListener('mouseup', handleGlobalMouseUp, { once: true });
        }

        return () => {
            window.removeEventListener('mousemove', handleGlobalMouseMove);
            window.removeEventListener('mouseup', handleGlobalMouseUp);
            wasDraggedRef.current = false;
        };
    }, [dragAction, entries, initialEntries, displaySections, handleAddOrUpdateEntry, START_HOUR, TOTAL_HEIGHT_PX, TOTAL_HOURS, timeToMinutes, TIME_GRID_MINUTES]);
    
    const handleAddSubItem = (parentEntry: Partial<TimeScheduleEntry>) => {
        setModalState({isOpen: false, entry: null}); // Close current
        setTimeout(() => { // Open new one
            setModalState({
                isOpen: true,
                entry: {
                    date: parentEntry.date,
                    startTime: parentEntry.startTime,
                    endTime: parentEntry.endTime,
                    sectionId: parentEntry.sectionId,
                    parentId: parentEntry.id,
                    depth: (parentEntry.depth || 0) + 1,
                    location: parentEntry.location,
                    color: parentEntry.color,
                }
            });
        }, 50);
    };

    const handleDeleteEntry = async (entryId: string) => {
        if (!currentUser || !window.confirm("この予定と全てのサブ項目を削除しますか？")) return;
        
        const batch = firestore.batch();
        const entriesToDelete = new Set([entryId]);
        const findChildrenRecursive = (id: string) => {
            entries.filter(e => e.parentId === id).forEach(child => {
                entriesToDelete.add(child.id);
                findChildrenRecursive(child.id);
            });
        };
        findChildrenRecursive(entryId);
        
        entriesToDelete.forEach(id => {
            const docRef = firestore.doc(getCollectionPath.timeScheduleEntryDoc(currentUser.uid, project.id, id));
            batch.delete(docRef);
        });

        await batch.commit();
        setModalState({ isOpen: false, entry: null });
    };

    const handleGridMouseDown = (e: React.MouseEvent<HTMLDivElement>, sectionId: string) => {
        if ((e.target as HTMLElement).closest('.time-entry-card') || e.button !== 0) {
            return;
        }
        e.preventDefault();

        const gridRect = e.currentTarget.getBoundingClientRect();
        
        const yInGrid = e.clientY - gridRect.top;
        const minutesFromStartPx = (yInGrid / TOTAL_HEIGHT_PX) * TOTAL_HOURS * 60;
        const totalMinutes = Math.floor(minutesFromStartPx / TIME_GRID_MINUTES) * TIME_GRID_MINUTES + (START_HOUR * 60);
        const startTime = minutesToTime(totalMinutes);
        
        setDragAction({
            type: 'create',
            startY: e.clientY,
            gridTop: gridRect.top,
            entry: {
                date: formatDate(displayDate),
                startTime: startTime,
                endTime: startTime,
                sectionId: (sectionId === 'default' || sectionId === 'uncategorized') ? null : sectionId,
            }
        });
    };

    const handleEntryInteractionStart = (e: React.MouseEvent<HTMLDivElement>, entry: TimeScheduleEntry, type: 'move' | 'resize-top' | 'resize-bottom') => {
        e.preventDefault();
        e.stopPropagation();

        if (e.button !== 0) return;

        wasDraggedRef.current = false;

        const gridRect = scheduleContainerRef.current!.getBoundingClientRect();
        const entryRect = (e.target as HTMLElement).closest('.time-entry-card')!.getBoundingClientRect();

        setDragAction({
            type: type,
            startY: e.clientY,
            gridTop: gridRect.top,
            entry: { ...entry },
            initialTop: entryRect.top - gridRect.top,
            initialHeight: entryRect.height,
        });
    };

    const moveDate = (amount: number) => {
        const currentDateStr = formatDate(displayDate);
        const currentIndex = sortedDates.indexOf(currentDateStr);
        const newIndex = currentIndex + amount;

        if (newIndex >= 0 && newIndex < sortedDates.length) {
            setDisplayDate(new Date(sortedDates[newIndex] + 'T00:00:00'));
        }
    };

    const currentIndex = sortedDates.indexOf(formatDate(displayDate));
    const isFirstDay = currentIndex <= 0;
    const isLastDay = currentIndex >= sortedDates.length - 1;
    
    const entriesForDate = useMemo(() => entries.filter(e => e.date === formatDate(displayDate)), [entries, displayDate]);

    const timeGridLines = useMemo(() => {
        const lines: { top: number, isMajor: boolean }[] = [];
        const totalMinutesInRange = TOTAL_HOURS * 60;
        for (let m = 0; m <= totalMinutesInRange; m += TIME_GRID_MINUTES) {
            lines.push({
                top: (m / totalMinutesInRange) * TOTAL_HEIGHT_PX,
                isMajor: m % 60 === 0,
            });
        }
        return lines;
    }, [TOTAL_HOURS, TOTAL_HEIGHT_PX, TIME_GRID_MINUTES]);

    return (
        <div className="bg-white p-4 sm:p-6 space-y-4">
            <div className="flex justify-between items-center flex-wrap gap-4">
                <div className="flex items-center gap-2">
                    <IconButton onClick={() => moveDate(-1)} disabled={isFirstDay} aria-label="前の日"><ChevronLeftIcon /></IconButton>
                    <h4 className="text-lg font-semibold w-48 text-center">{formatDate(displayDate, 'yyyy年MM月dd日')}</h4>
                    <IconButton onClick={() => moveDate(1)} disabled={isLastDay} aria-label="次の日"><ChevronRightIcon /></IconButton>
                </div>
                <div className="flex items-center gap-2">
                    <IconButton onClick={() => setShowSectionModal(true)} aria-label="セクション・表示時間の設定"><CogIcon /></IconButton>
                </div>
            </div>

            <div className="relative flex border border-slate-200 rounded-lg overflow-hidden" ref={scheduleContainerRef}>
                {/* Time Axis */}
                <div className="w-[60px] flex-shrink-0 border-r border-slate-300 bg-slate-50 text-center">
                    <div className="h-10 border-b border-slate-300"></div>
                    <div className="relative" style={{ height: TOTAL_HEIGHT_PX }}>
                        {Array.from({ length: TOTAL_HOURS }).map((_, i) => {
                            const hour = START_HOUR + i;
                            return (
                                <div key={i} className="absolute w-full" style={{ top: i * HOUR_HEIGHT_PX, height: 0 }}>
                                    <span className="absolute -top-2.5 right-2 text-sm font-medium text-slate-600">{hour % 24}:00</span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Scrollable Content */}
                <div className="flex-grow overflow-x-auto">
                    <div className="flex flex-col min-w-full" style={{ minWidth: displaySections.length * 200 }}>
                        {/* Headers */}
                        <div className="flex sticky top-0 z-10 bg-slate-50 border-b-2 border-slate-300">
                            {displaySections.map(section => (
                                <div key={section.id || 'null'} className="flex-1 p-2 text-center border-l border-slate-300 font-semibold" style={{ minWidth: '200px', flexBasis: 0, color: section.color }}>
                                    {section.name}
                                </div>
                            ))}
                        </div>

                        {/* Grid Content */}
                        <div className="relative" style={{ height: TOTAL_HEIGHT_PX }}>
                            {/* Background Grid Lines */}
                            <div className="absolute inset-0 pointer-events-none">
                                {timeGridLines.map((line, index) => (
                                    <div
                                        key={index}
                                        className={`absolute w-full ${line.isMajor ? 'border-t border-slate-300' : 'border-t border-dashed border-slate-200'}`}
                                        style={{ top: line.top }}
                                    />
                                ))}
                            </div>
                            
                            {/* Drag-to-Create Preview */}
                            {dragAction?.type === 'create' && dragAction.entry.startTime !== dragAction.entry.endTime && (() => {
                                const sectionIndex = displaySections.findIndex(s => s.id === (dragAction.entry.sectionId || 'default') || s.id === 'uncategorized');
                                if (sectionIndex === -1) return null;
                                
                                const top = (timeToMinutes(dragAction.entry.startTime!) - START_HOUR * 60) * (HOUR_HEIGHT_PX / 60);
                                const height = (timeToMinutes(dragAction.entry.endTime!) - timeToMinutes(dragAction.entry.startTime!)) * (HOUR_HEIGHT_PX / 60);
                                const left = `${(100 / displaySections.length) * sectionIndex}%`;
                                const width = `${100 / displaySections.length}%`;
                                
                                return (
                                    <div
                                        className="absolute z-20 bg-sky-500/30 border-2 border-dashed border-sky-600 rounded-lg pointer-events-none"
                                        style={{ top, height, left, width }}
                                    />
                                );
                            })()}

                            {/* Vertical lines and events container */}
                            <div className="absolute inset-0 flex">
                                {displaySections.map(section => {
                                    const sectionEntries = entriesForDate.filter(e => {
                                        const entrySectionId = e.sectionId || null;
                                        if (section.id === 'default' || section.id === 'uncategorized') {
                                            return entrySectionId === null;
                                        }
                                        return entrySectionId === section.id;
                                    });
                                    const layout = calculateLayout(sectionEntries);

                                    return (
                                        <div
                                            key={section.id || 'null'}
                                            className="flex-1 relative border-l border-slate-300"
                                            style={{ minWidth: '200px', flexBasis: 0 }}
                                            onMouseDown={(e) => handleGridMouseDown(e, section.id)}
                                        >
                                            {layout.map(entry => {
                                                const isMilestone = entry.startTime === entry.endTime;

                                                if (isMilestone) {
                                                    return (
                                                        <div
                                                            key={entry.id}
                                                            className="absolute z-10 cursor-pointer group time-entry-card"
                                                            style={{
                                                                top: `${entry.top}px`,
                                                                left: `${entry.left}%`,
                                                                width: `${entry.width}%`,
                                                                height: `${Math.max(20, HOUR_HEIGHT_PX / 3)}px`,
                                                                transform: 'translateY(-50%)',
                                                            }}
                                                            onMouseDown={(e) => handleEntryInteractionStart(e, entry, 'move')}
                                                        >
                                                            <div className="relative w-full h-full flex items-center">
                                                                <div className="w-full h-0.5" style={{ backgroundColor: entry.color }}></div>
                                                                <div className="absolute left-2 flex items-center gap-2 text-xs bg-white/90 backdrop-blur-sm shadow px-1.5 py-0.5 rounded">
                                                                    <span className="font-semibold text-slate-800">{entry.title}</span>
                                                                    <span className="text-slate-600">{entry.startTime}</span>
                                                                    {entry.location && (
                                                                        <span className="text-slate-600 flex items-center gap-1">
                                                                            <LocationIcon className="text-xs flex-shrink-0" />
                                                                            <span>{entry.location}</span>
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                }
                                                const duration = formatDuration(entry.startTime, entry.endTime);
                                                const displayHeight = Math.max(2, entry.height);
                                                
                                                const content = (() => {
                                                    const useHorizontalLayout = displayHeight < 65;
                                                    if (useHorizontalLayout) {
                                                        const isVerySmall = displayHeight < 20;
                                                        const paddingClass = isVerySmall ? 'p-0.5 px-1.5' : 'p-1 px-2';
                                                        const fontClass = isVerySmall ? 'text-[9px]' : 'text-[11px]';
                                                        const gapClass = isVerySmall ? 'gap-x-1.5' : 'gap-x-2';
                                                        const iconClass = isVerySmall ? 'text-[10px]' : 'text-xs';
                                
                                                        return (
                                                            <div className={`${paddingClass} h-full flex items-center`}>
                                                                <div className={`w-full flex items-center flex-wrap ${gapClass} ${fontClass} gap-y-0 leading-tight overflow-hidden`}>
                                                                    <p className="font-semibold text-slate-800 truncate" title={entry.title}>{entry.title}</p>
                                                                    <span className="text-slate-600 flex-shrink-0 whitespace-nowrap">{entry.startTime}-{entry.endTime}</span>
                                                                    {duration && <span className="text-slate-500 flex-shrink-0 whitespace-nowrap">({duration})</span>}
                                                                    {entry.location && (
                                                                        <div className="flex items-center gap-1 truncate text-slate-600" title={entry.location}>
                                                                            <LocationIcon className={`${iconClass} flex-shrink-0`} />
                                                                            <span className="truncate">{entry.location}</span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    } else { // vertical layout
                                                        let fontSizeClass = 'text-xs leading-snug';
                                                        if (displayHeight > 90) fontSizeClass = 'text-sm leading-normal';
                                                        return (
                                                            <div className={`p-2 h-full flex flex-col ${fontSizeClass}`}>
                                                                <p className="font-semibold text-slate-800 break-words flex-shrink-0" title={entry.title}>{entry.title}</p>
                                                                <p className="text-slate-600 flex-shrink-0">{entry.startTime} - {entry.endTime} {duration && `(${duration})`}</p>
                                                                
                                                                <div className="mt-1 space-y-1 overflow-y-auto min-h-0 flex-grow">
                                                                    {entry.location && (
                                                                        <div className="flex items-center gap-1 text-slate-600">
                                                                            <LocationIcon className="text-xs flex-shrink-0" />
                                                                            <span className="truncate">{entry.location}</span>
                                                                        </div>
                                                                    )}
                                                                    {displayHeight >= 90 && entry.description && (
                                                                        <p className="text-slate-700 whitespace-pre-wrap break-words">{entry.description}</p>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    }
                                                })();

                                                return (
                                                    <div
                                                        key={entry.id}
                                                        className="absolute rounded cursor-pointer overflow-hidden time-entry-card"
                                                        style={{
                                                            top: `${entry.top}px`, height: `${displayHeight}px`,
                                                            left: `${entry.left}%`, width: `${entry.width}%`,
                                                            backgroundColor: hexToRgba(entry.color, 0.2),
                                                            borderLeft: `4px solid ${entry.color}`,
                                                            outline: `1px solid ${hexToRgba(entry.color, 0.4)}`,
                                                            outlineOffset: '-1px',
                                                        }}
                                                        title={`${entry.title}\n${entry.startTime} - ${entry.endTime}`}
                                                    >
                                                        <div className="resize-handle top" onMouseDown={(e) => handleEntryInteractionStart(e, entry, 'resize-top')} />
                                                        <div className="h-full" onMouseDown={(e) => handleEntryInteractionStart(e, entry, 'move')}>
                                                            <div className="flex items-start h-full">
                                                                <div className="flex-grow min-w-0 h-full flex flex-col justify-start">
                                                                    <div style={{ width: `${entry.contentWidthPercent}%` }} className="h-full flex flex-col">
                                                                       {content}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="resize-handle bottom" onMouseDown={(e) => handleEntryInteractionStart(e, entry, 'resize-bottom')} />
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Floating Action Button for mobile/tablet */}
                <div className="absolute bottom-4 right-4 z-30 lg:hidden">
                    <button
                    onClick={() => {
                        const now = new Date();
                        const minutes = now.getMinutes();
                        const roundedMinutes = Math.round(minutes / TIME_GRID_MINUTES) * TIME_GRID_MINUTES;
                        now.setMinutes(roundedMinutes, 0, 0);
                        
                        const startTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
                        now.setMinutes(now.getMinutes() + 60);
                        const endTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

                        setModalState({
                        isOpen: true,
                        entry: {
                            date: formatDate(displayDate),
                            startTime: startTime,
                            endTime: endTime,
                        },
                        });
                    }}
                    className="bg-sky-600 hover:bg-sky-700 text-white rounded-full w-14 h-14 flex items-center justify-center shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 transition-transform hover:scale-105 active:scale-95"
                    aria-label="新しい予定を追加"
                    >
                    <PlusIcon className="text-2xl" />
                    </button>
                </div>
            </div>

            {modalState.isOpen && <EntryModal entry={modalState.entry} parentEntryName={parentEntryForModal?.title} sections={sections} onSave={handleAddOrUpdateEntry} onDelete={handleDeleteEntry} onClose={() => setModalState({ isOpen: false, entry: null })} onAddSubItem={handleAddSubItem} />}
            {showSectionModal && <SectionManagementModal project={project} sheet={sheet} initialSections={sections} onClose={() => setShowSectionModal(false)} />}
        </div>
    );
};

const EntryModal: React.FC<{ entry: Partial<TimeScheduleEntry> | null; parentEntryName?: string; sections: TimeScheduleSection[]; onSave: (entry: Partial<TimeScheduleEntry>) => void; onDelete: (id: string) => void; onClose: () => void; onAddSubItem: (parentEntry: Partial<TimeScheduleEntry>) => void; }> = ({ entry, parentEntryName, sections, onSave, onDelete, onClose, onAddSubItem }) => {
    const [data, setData] = useState(() => {
        if (!entry) return null;
        if (!entry.id && !entry.color) {
            const section = sections.find(s => s.id === entry.sectionId);
            const initialColor = section ? section.color : '#0ea5e9';
            return { ...entry, color: initialColor };
        }
        return entry;
    });

    if (!data) return null;

    const handleSectionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newSectionId = e.target.value || null;
        const oldSection = sections.find(s => s.id === data.sectionId);
        const oldSectionColor = oldSection ? oldSection.color : '#0ea5e9';
        
        const newSection = sections.find(s => s.id === newSectionId);
        const newSectionColor = newSection ? newSection.color : '#0ea5e9';

        setData(d => {
            if (!d) return d;
            const updates: Partial<TimeScheduleEntry> = { sectionId: newSectionId };
            if (d.color === oldSectionColor) {
                updates.color = newSectionColor;
            }
            return { ...d, ...updates };
        });
    };

    const handleSave = () => {
        if(data.title && data.date && data.startTime && data.endTime && (data.startTime <= data.endTime || data.endTime === '00:00')) {
             if (data.startTime === data.endTime) {
                onSave(data);
                return;
             }
             if (data.startTime < data.endTime) {
                onSave(data);
             }
        }
    };
    
    return (
        <Modal title={data.id ? "予定を編集" : "予定を追加"} onClose={onClose}>
            <div className="space-y-4">
                {parentEntryName && <p className="text-sm bg-slate-100 p-2 rounded-md">親項目: <span className="font-semibold">{parentEntryName}</span></p>}
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">タイトル</label>
                    <input type="text" value={data.title || ''} onChange={e => setData(d => d ? ({...d, title: e.target.value}) : null)} className="w-full px-2 py-2 border border-slate-300 rounded-md" required autoFocus />
                </div>
                 <div className="grid grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">日付</label>
                        <input type="date" value={data.date || ''} onChange={e => setData(d => d ? ({...d, date: e.target.value}) : null)} className="w-full px-2 py-2 border border-slate-300 rounded-md" required />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">開始時刻</label>
                        <input type="time" step="300" value={data.startTime || ''} onChange={e => setData(d => d ? ({...d, startTime: e.target.value}) : null)} className="w-full px-2 py-2 border border-slate-300 rounded-md" required />
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">終了時刻</label>
                        <input type="time" step="300" value={data.endTime || ''} onChange={e => setData(d => d ? ({...d, endTime: e.target.value}) : null)} className="w-full px-2 py-2 border border-slate-300 rounded-md" required />
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">場所（任意）</label>
                    <input type="text" value={data.location || ''} onChange={e => setData(d => d ? ({...d, location: e.target.value}) : null)} className="w-full px-2 py-2 border border-slate-300 rounded-md" />
                </div>
                 <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">セクション</label>
                    <div className="flex items-center gap-2">
                        <select value={data.sectionId || ''} onChange={handleSectionChange} className="flex-grow w-full px-2 py-2 border border-slate-300 rounded-md bg-white">
                            <option value="">未割り当て</option>
                            {sections.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                        </select>
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">色</label>
                    <div className="flex flex-wrap gap-3 pt-2">
                        {PREDEFINED_SECTION_COLORS.map(color => (
                            <button
                                key={color}
                                type="button"
                                onClick={() => setData(d => d ? ({ ...d, color }) : null)}
                                style={{ backgroundColor: color }}
                                className={`w-7 h-7 rounded-full border border-slate-400 hover:scale-110 transition-transform focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-sky-500 ${data.color === color ? 'ring-2 ring-sky-500 ring-offset-2' : ''}`}
                                aria-label={`色 ${color} を選択`}
                            />
                        ))}
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">説明（任意）</label>
                    <textarea value={data.description || ''} onChange={e => setData(d => d ? ({...d, description: e.target.value}) : null)} rows={4} className="w-full px-2 py-2 border border-slate-300 rounded-md" />
                </div>
                
                <div className="flex justify-between items-center pt-4">
                     <div>
                        {data.id && (
                            <div className="flex gap-2">
                                <IconButton onClick={() => onDelete(data.id!)} className="text-red-600 hover:bg-red-50" aria-label="予定を削除"><TrashIcon /> 削除</IconButton>
                                <SecondaryButton size="sm" icon={<SubdirectoryArrowRightIcon/>} onClick={() => onAddSubItem(data)}>サブ項目を追加</SecondaryButton>
                            </div>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <SecondaryButton onClick={onClose}>キャンセル</SecondaryButton>
                        <PrimaryButton onClick={handleSave}>保存</PrimaryButton>
                    </div>
                </div>
            </div>
        </Modal>
    );
};

const SectionManagementModal: React.FC<{ project: Project; sheet: TimeScheduleSheet; initialSections: TimeScheduleSection[]; onClose: () => void; }> = ({ project, sheet, initialSections, onClose }) => {
    const { currentUser } = useAuth();
    const [sections, setSections] = useState<Partial<TimeScheduleSection>[]>(() => JSON.parse(JSON.stringify([...initialSections].sort((a,b) => a.order - b.order))));
    const [hiddenIds, setHiddenIds] = useState<Set<string>>(() => new Set(sheet.viewPreferences?.hiddenSectionIds || []));
    const [startHour, setStartHour] = useState(sheet.viewPreferences?.startHour ?? 7);
    const [endHour, setEndHour] = useState(sheet.viewPreferences?.endHour ?? 25);
    const [timeGridMinutes, setTimeGridMinutes] = useState<5 | 10 | 15 | 30>(sheet.viewPreferences?.timeGridMinutes ?? 30);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [visibleColorPickerId, setVisibleColorPickerId] = useState<string | null>(null);
    const focusOnRenderId = useRef<string | null>(null);

    const toggleVisibility = (id: string) => {
        setHiddenIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }
            return newSet;
        });
    };

    const handleMoveSection = (index: number, direction: 'up' | 'down') => {
        if ((direction === 'up' && index === 0) || (direction === 'down' && index === sections.length - 1)) {
            return;
        }
        const newSections = [...sections];
        const [movedSection] = newSections.splice(index, 1);
        const newIndex = direction === 'up' ? index - 1 : index + 1;
        newSections.splice(newIndex, 0, movedSection);
        setSections(newSections);
    };

    const handleAddSection = () => {
        if (!currentUser) return;
        const newSection: Partial<TimeScheduleSection> = {
            id: `new-${Date.now()}`,
            projectId: project.id,
            userId: currentUser.uid,
            sheetId: sheet.id,
            name: '',
            order: sections.length,
            color: PREDEFINED_SECTION_COLORS[sections.length % PREDEFINED_SECTION_COLORS.length],
        };
        focusOnRenderId.current = newSection.id!;
        setSections(prev => [...prev, newSection]);
    };

    const handleDeleteSection = (id: string) => {
        setSections(prev => prev.filter(item => item.id !== id));
    };

    const handleSectionChange = (id: string, field: 'name' | 'color', value: string) => {
        setSections(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
    };

    const handleSaveChanges = async () => {
        if (!currentUser) return;
        setLoading(true);
        setError(null);

        try {
            if (startHour >= endHour) {
                throw new Error("終了時間は開始時間より後に設定してください。");
            }

            const batch = firestore.batch();
            const path = getCollectionPath.timeScheduleSections(currentUser.uid, project.id, sheet.id);
            
            const finalItems = sections;
            const finalItemIds = new Set(finalItems.map(i => i.id));
            const deletedItems = initialSections.filter(initial => !finalItemIds.has(initial.id));

            for (const deleted of deletedItems) {
                batch.delete(firestore.doc(`${path}/${deleted.id}`));
            }

            for (const [index, item] of finalItems.entries()) {
                if (!item.name?.trim()) throw new Error("セクション名は必須です。");
                const data = {
                    projectId: project.id, userId: currentUser.uid, sheetId: sheet.id,
                    name: item.name!.trim(), color: item.color, order: index,
                };
                if (item.id!.startsWith('new-')) {
                    batch.set(firestore.collection(path).doc(), data);
                } else {
                    batch.update(firestore.doc(`${path}/${item.id}`), data);
                }
            }
            
            const sheetRef = firestore.doc(getCollectionPath.timeScheduleSheetDoc(currentUser.uid, project.id, sheet.id));
            batch.update(sheetRef, { 
                'viewPreferences.startHour': startHour, 
                'viewPreferences.endHour': endHour,
                'viewPreferences.timeGridMinutes': timeGridMinutes,
                'viewPreferences.hiddenSectionIds': Array.from(hiddenIds),
            });

            await batch.commit();
            onClose();
        } catch (e: any) {
            setError(e.message || "保存中にエラーが発生しました。");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal title="設定" onClose={onClose} size="lg">
            <div className="space-y-6 flex flex-col" style={{minHeight: '400px'}}>
                {error && <p className="text-sm text-red-600 bg-red-100 p-3 rounded-md">{error}</p>}

                <div className="space-y-3">
                    <h4 className="font-semibold text-slate-700 text-base">表示設定</h4>
                    <div className="grid grid-cols-3 gap-4 p-4 bg-slate-50 rounded-lg">
                        <div>
                            <label htmlFor="start-hour" className="block text-sm font-medium text-slate-700 mb-1">開始時間</label>
                            <select id="start-hour" value={startHour} onChange={e => setStartHour(Number(e.target.value))} className="w-full px-2 py-2 border border-slate-300 rounded-md bg-white">
                                {Array.from({ length: 24 }, (_, i) => i).map(h => <option key={h} value={h}>{`${String(h).padStart(2, '0')}:00`}</option>)}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="end-hour" className="block text-sm font-medium text-slate-700 mb-1">終了時間</label>
                            <select id="end-hour" value={endHour} onChange={e => setEndHour(Number(e.target.value))} className="w-full px-2 py-2 border border-slate-300 rounded-md bg-white">
                                {Array.from({ length: 30 }, (_, i) => i + 1).map(h => <option key={h} value={h}>{`${String(h % 24).padStart(2, '0')}:00`}{h >= 24 ? ' (翌日)' : ''}</option>)}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="time-grid" className="block text-sm font-medium text-slate-700 mb-1">時間グリッド</label>
                            <select id="time-grid" value={timeGridMinutes} onChange={e => setTimeGridMinutes(Number(e.target.value) as any)} className="w-full px-2 py-2 border border-slate-300 rounded-md bg-white">
                                <option value={30}>30分</option>
                                <option value={15}>15分</option>
                                <option value={10}>10分</option>
                                <option value={5}>5分</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div className="space-y-3">
                    <h4 className="font-semibold text-slate-700 text-base">セクション管理</h4>
                    <div className="space-y-2 flex-grow max-h-60 overflow-y-auto pr-2">
                        <div className="flex items-center gap-2 p-2 rounded-md bg-slate-50">
                            <IconButton onClick={() => toggleVisibility('uncategorized')} aria-label="表示切り替え">
                                {hiddenIds.has('uncategorized') ? <EyeSlashIcon className="text-slate-400" /> : <EyeIcon />}
                            </IconButton>
                            <span className="text-sm font-medium text-slate-700 flex-grow">スケジュール</span>
                            <span className="text-xs text-slate-500">(セクション未設定の予定)</span>
                        </div>
                        {sections.map((section, index) => (
                             <div key={section.id} className="p-2 rounded-md hover:bg-slate-100">
                                <div className="flex items-center gap-2">
                                    <IconButton onClick={() => toggleVisibility(section.id!)} aria-label="表示切り替え">
                                        {hiddenIds.has(section.id!) ? <EyeSlashIcon className="text-slate-400" /> : <EyeIcon />}
                                    </IconButton>
                                    <button type="button" onClick={() => setVisibleColorPickerId(visibleColorPickerId === section.id ? null : section.id!)} style={{ backgroundColor: section.color }} className="w-6 h-6 rounded-full border border-slate-300 flex-shrink-0"/>
                                    <input type="text" placeholder="セクション名" value={section.name} onChange={e => handleSectionChange(section.id!, 'name', e.target.value)} className="px-2 py-1 border border-slate-300 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500 text-sm flex-grow" ref={ref => { if (focusOnRenderId.current === section.id) ref?.focus(); }} />
                                    <IconButton onClick={() => handleMoveSection(index, 'up')} disabled={index === 0} aria-label="上に移動"><ArrowUpwardIcon /></IconButton>
                                    <IconButton onClick={() => handleMoveSection(index, 'down')} disabled={index === sections.length - 1} aria-label="下に移動"><ArrowDownwardIcon /></IconButton>
                                    <IconButton onClick={() => handleDeleteSection(section.id!)} className="hover:text-red-500" aria-label="削除"><TrashIcon /></IconButton>
                                </div>
                                {visibleColorPickerId === section.id && (
                                    <div className="pl-12 pt-3 flex flex-wrap gap-3">
                                        {PREDEFINED_SECTION_COLORS.map(color => (
                                            <button
                                                key={color}
                                                type="button"
                                                onClick={() => { handleSectionChange(section.id!, 'color', color); setVisibleColorPickerId(null); }}
                                                style={{ backgroundColor: color }}
                                                className={`w-6 h-6 rounded-full border border-slate-400 hover:scale-110 transition-transform focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-sky-500 ${section.color === color ? 'ring-2 ring-sky-500' : ''}`}
                                                aria-label={`色 ${color} を選択`}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                    <PrimaryButton icon={<PlusIcon />} onClick={handleAddSection} size="sm">セクションを追加</PrimaryButton>
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

export default TimeScheduleTab;