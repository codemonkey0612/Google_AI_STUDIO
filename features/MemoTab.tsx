import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Memo, MemoGroup, Project } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { firestore, getCollectionPath, firebase } from '../firebase';
import { TrashIcon, PaletteIcon, PlusIcon, MoreVertIcon, EditIcon, SaveIcon, CancelIcon, DragHandleIcon } from '../components/Icons';
import { PrimaryButton, SecondaryButton, IconButton } from '../components/common/Buttons';
import Modal from '../components/Modal';

interface MemoTabProps {
  project: Project;
  initialMemos: Memo[];
  initialMemoGroups: MemoGroup[];
}

const MEMO_COLORS = {
    white: { hex: '#FFFFFF', bg: 'bg-white', border: 'border-slate-300' },
    red: { hex: '#FEE2E2', bg: 'bg-rose-100', border: 'border-rose-300' },
    amber: { hex: '#FEF3C7', bg: 'bg-amber-100', border: 'border-amber-300' },
    green: { hex: '#D1FAE5', bg: 'bg-emerald-100', border: 'border-emerald-300' },
    blue: { hex: '#E0F2FE', bg: 'bg-sky-100', border: 'border-sky-300' },
    gray: { hex: '#E5E7EB', bg: 'bg-slate-200', border: 'border-slate-400' },
    fuchsia: { hex: '#F5D0FE', bg: 'bg-fuchsia-100', border: 'border-fuchsia-300' },
};

const ColorPalette: React.FC<{ onSelect: (color: string) => void; onClose: () => void }> = ({ onSelect, onClose }) => {
    const paletteRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (paletteRef.current && !paletteRef.current.contains(event.target as Node)) {
                onClose();
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [onClose]);

    return (
        <div ref={paletteRef} className="absolute bottom-10 left-0 z-20 bg-white p-3 rounded-lg shadow-xl border border-slate-200 grid grid-cols-4 gap-2">
            {Object.values(MEMO_COLORS).map(color => (
                <button
                    key={color.hex}
                    onClick={(e) => { e.stopPropagation(); onSelect(color.hex); }}
                    style={{ backgroundColor: color.hex }}
                    className={`w-6 h-6 rounded-full border border-slate-300 hover:scale-110 transition-transform focus:outline-none focus:ring-2 focus:ring-sky-500`}
                    aria-label={`色 ${color.hex} を選択`}
                />
            ))}
        </div>
    );
};

const MemoCard: React.FC<{
    memo: Memo;
    onSelect: () => void;
    onUpdate: (id: string, updates: Partial<Memo>) => void;
    onDelete: (id: string) => void;
    onDragStart: (e: React.DragEvent, memo: Memo) => void;
    onDragEnd: (e: React.DragEvent) => void;
    onDrop: (e: React.DragEvent, memo: Memo) => void;
    onDragOver: (e: React.DragEvent) => void;
}> = ({ memo, onSelect, onUpdate, onDelete, onDragStart, onDragEnd, onDrop, onDragOver }) => {
    const [showPalette, setShowPalette] = useState(false);
    const colorStyle = MEMO_COLORS[Object.keys(MEMO_COLORS).find(key => MEMO_COLORS[key as keyof typeof MEMO_COLORS].hex === memo.color) as keyof typeof MEMO_COLORS] || MEMO_COLORS.white;

    return (
        <div
            onClick={onSelect}
            draggable
            onDragStart={(e) => onDragStart(e, memo)}
            onDragEnd={onDragEnd}
            onDrop={(e) => { e.stopPropagation(); onDrop(e, memo); }}
            onDragOver={onDragOver}
            className={`rounded-lg border shadow-sm hover:shadow-lg transition-shadow duration-200 cursor-pointer flex flex-col p-4 h-full ${colorStyle.bg} ${colorStyle.border}`}
        >
            {memo.title && <h4 className="font-semibold text-slate-800 mb-2 break-words">{memo.title}</h4>}
            <p className="text-slate-700 text-sm whitespace-pre-wrap break-words flex-grow">{memo.content}</p>
            <div className="flex justify-end items-center mt-3 h-8 relative">
                <div className="flex items-center gap-1">
                    <IconButton aria-label="色を変更" onClick={(e) => { e.stopPropagation(); setShowPalette(p => !p); }}><PaletteIcon /></IconButton>
                    <IconButton aria-label="削除" onClick={(e) => { e.stopPropagation(); if (window.confirm("このメモを削除しますか？")) onDelete(memo.id); }} className="hover:text-red-500"><TrashIcon /></IconButton>
                </div>
                {showPalette && <ColorPalette onSelect={(color) => { onUpdate(memo.id, { color }); setShowPalette(false); }} onClose={() => setShowPalette(false)} />}
            </div>
        </div>
    );
};

const AddMemoCard: React.FC<{ onAdd: (title: string, content: string) => void }> = ({ onAdd }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const cardRef = useRef<HTMLDivElement>(null);

    const handleSave = () => {
        if (title.trim() || content.trim()) {
            onAdd(title.trim(), content.trim());
        }
        setTitle('');
        setContent('');
        setIsEditing(false);
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (isEditing && cardRef.current && !cardRef.current.contains(event.target as Node)) {
                handleSave();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isEditing, title, content]);


    if (!isEditing) {
        return (
            <button
                onClick={() => setIsEditing(true)}
                className="w-full h-full min-h-[120px] text-center p-4 rounded-lg border-2 border-dashed border-slate-300 hover:border-sky-500 hover:bg-slate-100 transition-colors flex items-center justify-center text-slate-500"
            >
                <PlusIcon />
                <span className="ml-2">メモを追加</span>
            </button>
        );
    }

    return (
        <div ref={cardRef} className="bg-white p-3 rounded-lg shadow-md border border-sky-400 space-y-2 h-full">
            <input type="text" placeholder="タイトル" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full px-1 py-1 border-none focus:ring-0 text-md font-semibold placeholder-slate-400" autoFocus />
            <textarea placeholder="メモを追加..." value={content} onChange={(e) => setContent(e.target.value)} className="w-full px-1 py-1 border-none focus:ring-0 text-sm placeholder-slate-400 resize-none" rows={3} />
            <div className="flex justify-end gap-2">
                <PrimaryButton onClick={handleSave} size="sm">追加</PrimaryButton>
            </div>
        </div>
    );
};

const MemoGroupHeader: React.FC<{
    project: Project;
    group?: MemoGroup;
    name: string;
    memoCount: number;
}> = ({ project, group, name, memoCount }) => {
    const { currentUser } = useAuth();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isEditingName, setIsEditingName] = useState(false);
    const [editedName, setEditedName] = useState(name);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setEditedName(name);
    }, [name]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleUpdateName = async () => {
        if (!currentUser || !group || !editedName.trim()) {
            setIsEditingName(false);
            setEditedName(name);
            return;
        }
        setIsEditingName(false);
        if (editedName.trim() === name) return;
        await firestore.doc(getCollectionPath.memoGroupDoc(currentUser.uid, project.id, group.id)).update({ name: editedName.trim() });
    };

    const handleDeleteGroup = async () => {
        if (!currentUser || !group || !window.confirm(`グループ「${name}」を削除しますか？\n中のメモは「未分類」に移動します。`)) return;

        const batch = firestore.batch();
        const memosSnapshot = await firestore.collection(getCollectionPath.memos(currentUser.uid, project.id)).where('groupId', '==', group.id).get();
        memosSnapshot.forEach(doc => {
            batch.update(doc.ref, { groupId: null });
        });
        const groupRef = firestore.doc(getCollectionPath.memoGroupDoc(currentUser.uid, project.id, group.id));
        batch.delete(groupRef);
        await batch.commit();
    };

    return (
        <div className="flex justify-between items-center px-1 py-2">
            <div className="flex items-center gap-3 min-w-0">
                {group && (
                    <span className="text-slate-400" >
                        <DragHandleIcon />
                    </span>
                )}
                <div className="flex items-center gap-2 min-w-0">
                    {isEditingName ? (
                        <input
                            type="text"
                            value={editedName}
                            onChange={e => setEditedName(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleUpdateName()}
                            onBlur={handleUpdateName}
                            className="px-2 py-1 border-b-2 border-sky-500 focus:outline-none bg-transparent font-semibold text-lg text-slate-800"
                            autoFocus
                        />
                    ) : (
                        <h4 className="font-semibold text-lg text-slate-800 truncate">{name}</h4>
                    )}
                    <span className="text-sm font-medium bg-slate-200 text-slate-600 rounded-full px-2 py-0.5">{memoCount}</span>
                </div>
            </div>
            {group && (
                <div className="relative" ref={menuRef}>
                    <IconButton onClick={() => setIsMenuOpen(p => !p)} aria-label="グループオプション"><MoreVertIcon /></IconButton>
                    {isMenuOpen && (
                        <div className="absolute right-0 top-full mt-1 w-40 bg-white rounded-md shadow-lg py-1 z-10 border border-slate-200">
                            <button onClick={() => { setIsEditingName(true); setIsMenuOpen(false); }} className="w-full text-left flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"><EditIcon className="text-base" />名前を変更</button>
                            <button onClick={handleDeleteGroup} className="w-full text-left flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"><TrashIcon className="text-base" />グループを削除</button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

const MemoGroupSection: React.FC<{
    project: Project;
    group: MemoGroup | null;
    memos: Memo[];
    onAddMemo: (title: string, content: string) => void;
    onUpdateMemo: (memoId: string, updates: Partial<Memo>) => void;
    onDeleteMemo: (memoId: string) => void;
    onSelectMemo: (memo: Memo) => void;
    onMemoDragStart: (e: React.DragEvent, memo: Memo) => void;
    onMemoDragEnd: (e: React.DragEvent) => void;
    onMemoDropOnCard: (e: React.DragEvent, targetMemo: Memo) => void;
    onMemoDropOnContainer: (e: React.DragEvent) => void;
    onDragOver: () => void;
    draggedMemoId: string | null;
    isDropTarget: boolean;
}> = ({
    project, group, memos, onAddMemo, onUpdateMemo, onDeleteMemo, onSelectMemo,
    onMemoDragStart, onMemoDragEnd, onMemoDropOnCard, onMemoDropOnContainer, onDragOver,
    draggedMemoId, isDropTarget
}) => {
    
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        onDragOver();
    };

    return (
        <div 
            onDrop={onMemoDropOnContainer}
            onDragOver={handleDragOver}
            className={`p-4 rounded-lg border border-slate-200 bg-white/50 transition-colors duration-200 ${isDropTarget ? 'bg-sky-100 ring-2 ring-sky-400' : ''}`}
        >
            <MemoGroupHeader
                project={project}
                group={group || undefined}
                name={group?.name || '未分類'}
                memoCount={memos.length}
            />
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 min-h-[150px]">
                {memos.map(memo => (
                    <div key={memo.id} className={draggedMemoId === memo.id ? 'opacity-30' : ''}>
                        <MemoCard
                            memo={memo}
                            onSelect={() => onSelectMemo(memo)}
                            onUpdate={onUpdateMemo}
                            onDelete={onDeleteMemo}
                            onDragStart={onMemoDragStart}
                            onDragEnd={onMemoDragEnd}
                            onDrop={onMemoDropOnCard}
                            onDragOver={handleDragOver}
                        />
                    </div>
                ))}
                <AddMemoCard onAdd={onAddMemo} />
            </div>
        </div>
    );
};

const MemoTab: React.FC<MemoTabProps> = ({ project, initialMemos, initialMemoGroups }) => {
    const { currentUser } = useAuth();
    const [memos, setMemos] = useState<Memo[]>(initialMemos);
    const [groups, setGroups] = useState<MemoGroup[]>(initialMemoGroups);
    const [editingMemo, setEditingMemo] = useState<Memo | null>(null);
    const [draggedMemoId, setDraggedMemoId] = useState<string | null>(null);
    const [dragOverGroupId, setDragOverGroupId] = useState<string | null>(null);
    const draggedMemoRef = useRef<Memo | null>(null);
    const draggedGroupIndex = useRef<number | null>(null);
    const dropTargetGroupIndex = useRef<number | null>(null);


    useEffect(() => setMemos(initialMemos), [initialMemos]);
    useEffect(() => setGroups(initialMemoGroups), [initialMemoGroups]);

    const sortedGroups = useMemo(() => {
        return [...groups].sort((a, b) => a.order - b.order);
    }, [groups]);

    const memosByGroup = useMemo(() => {
        const grouped: Map<string | null, Memo[]> = new Map();
        grouped.set(null, []); // For uncategorized
        sortedGroups.forEach(g => grouped.set(g.id, []));

        memos.forEach(memo => {
            const groupId = memo.groupId && grouped.has(memo.groupId) ? memo.groupId : null;
            grouped.get(groupId)!.push(memo);
        });

        grouped.forEach((memoList) => memoList.sort((a, b) => a.order - b.order));
        return grouped;
    }, [memos, sortedGroups]);

    const handleUpdateMemo = async (memoId: string, updates: Partial<Memo>) => {
        if (!currentUser) return;
        const memoDocRef = firestore.doc(getCollectionPath.memoDoc(currentUser.uid, project.id, memoId));
        await memoDocRef.update({ ...updates, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
        if (editingMemo?.id === memoId) {
            setEditingMemo(prev => prev ? { ...prev, ...updates } : null);
        }
    };

    const handleDeleteMemo = async (memoId: string) => {
        if (!currentUser) return;
        await firestore.doc(getCollectionPath.memoDoc(currentUser.uid, project.id, memoId)).delete();
    };

    const handleAddMemo = async (title: string, content: string, groupId: string | null) => {
        if (!currentUser) return;
        const memoList = memosByGroup.get(groupId) || [];
        const fullMemo = { title, content, color: '#FFFFFF', projectId: project.id, userId: currentUser.uid, groupId, order: memoList.length, createdAt: firebase.firestore.FieldValue.serverTimestamp(), updatedAt: firebase.firestore.FieldValue.serverTimestamp() };
        await firestore.collection(getCollectionPath.memos(currentUser.uid, project.id)).add(fullMemo);
    };

    const handleAddGroup = async () => {
        if (!currentUser) return;
        const newGroup = { name: '新しいグループ', order: groups.length, projectId: project.id, userId: currentUser.uid };
        await firestore.collection(getCollectionPath.memoGroups(currentUser.uid, project.id)).add(newGroup);
    };

    const handleMemoDragStart = (e: React.DragEvent, memo: Memo) => {
        e.dataTransfer.setData('application/x-memo-id', memo.id);
        e.dataTransfer.effectAllowed = 'move';
        draggedMemoRef.current = memo;
        setTimeout(() => setDraggedMemoId(memo.id), 0);
    };

    const handleDragEnd = () => {
        setDraggedMemoId(null);
        draggedMemoRef.current = null;
        setDragOverGroupId(null);
    };

    const updateMemoOrder = async (
        draggedMemo: Memo,
        targetGroupId: string | null,
        targetIndex: number
    ) => {
        if (!currentUser) return;

        const sourceGroupId = draggedMemo.groupId || null;
        const batch = firestore.batch();

        // 1. Update target group
        const targetGroupMemos = memos
            .filter(m => (m.groupId || null) === targetGroupId && m.id !== draggedMemo.id)
            .sort((a, b) => a.order - b.order);
        
        targetGroupMemos.splice(targetIndex, 0, draggedMemo);
        
        targetGroupMemos.forEach((memo, index) => {
            const updates: { order: number; groupId?: string | null } = { order: index };
            if (memo.id === draggedMemo.id) {
                updates.groupId = targetGroupId;
            }
            const memoRef = firestore.doc(getCollectionPath.memoDoc(currentUser.uid, project.id, memo.id));
            batch.update(memoRef, updates);
        });

        // 2. Update source group if it's different
        if (sourceGroupId !== targetGroupId) {
            const sourceGroupMemos = memos
                .filter(m => (m.groupId || null) === sourceGroupId && m.id !== draggedMemo.id)
                .sort((a, b) => a.order - b.order);
            
            sourceGroupMemos.forEach((memo, index) => {
                if(memo.order !== index) {
                    const memoRef = firestore.doc(getCollectionPath.memoDoc(currentUser.uid, project.id, memo.id));
                    batch.update(memoRef, { order: index });
                }
            });
        }
        
        await batch.commit();
    };

    const handleMemoDropOnCard = async (e: React.DragEvent, targetMemo: Memo) => {
        e.preventDefault();
        const draggedMemo = draggedMemoRef.current;
        if (!draggedMemo || draggedMemo.id === targetMemo.id) {
            return;
        }

        const targetGroupId = targetMemo.groupId || null;
        const memosInTargetGroup = memosByGroup.get(targetGroupId) || [];
        const targetIndex = memosInTargetGroup.findIndex(m => m.id === targetMemo.id);
        
        if (targetIndex !== -1) {
            await updateMemoOrder(draggedMemo, targetGroupId, targetIndex);
        }
    };
    
    const handleMemoDropOnContainer = async (e: React.DragEvent, targetGroupId: string | null) => {
        e.preventDefault();
        const draggedMemo = draggedMemoRef.current;
        if (!draggedMemo) return;

        // When dropping on a container, the dragged item should be placed at the END of the list.
        const memosInTargetGroup = memosByGroup.get(targetGroupId) || [];
        const targetIndex = memosInTargetGroup.length;
        
        await updateMemoOrder(draggedMemo, targetGroupId, targetIndex);
    };

    const handleGroupDragStart = (e: React.DragEvent, index: number) => {
        draggedGroupIndex.current = index;
        e.dataTransfer.effectAllowed = 'move';
    };
    
    const handleGroupDragEnter = (index: number) => {
        if (draggedGroupIndex.current !== null && draggedGroupIndex.current !== index) {
            dropTargetGroupIndex.current = index;
        }
    };
    
    const handleGroupDragEnd = async () => {
        const draggedIdx = draggedGroupIndex.current;
        const targetIdx = dropTargetGroupIndex.current;
    
        draggedGroupIndex.current = null;
        dropTargetGroupIndex.current = null;
    
        if (draggedIdx === null || targetIdx === null || draggedIdx === targetIdx) {
            return;
        }
    
        const originalGroups = groups;
        
        const reorderedSortedGroups = [...sortedGroups];
        const [draggedItem] = reorderedSortedGroups.splice(draggedIdx, 1);
        reorderedSortedGroups.splice(targetIdx, 0, draggedItem);
        
        const newGroupsState = reorderedSortedGroups.map((group, index) => ({
            ...group,
            order: index,
        }));
        
        setGroups(newGroupsState);
    
        if (!currentUser) return;
        
        const batch = firestore.batch();
        reorderedSortedGroups.forEach((group, index) => {
            if (group.order !== index) {
                const groupDocRef = firestore.doc(getCollectionPath.memoGroupDoc(currentUser.uid, project.id, group.id));
                batch.update(groupDocRef, { order: index });
            }
        });
    
        try {
            await batch.commit();
        } catch (err) {
            console.error("Error reordering memo groups:", err);
            setGroups(originalGroups);
        }
    };
    

    return (
        <>
            <div className="p-4 bg-slate-50 space-y-6">
                <div className="flex justify-end">
                    <PrimaryButton onClick={handleAddGroup} icon={<PlusIcon />}>
                        グループを追加
                    </PrimaryButton>
                </div>
                
                <div className="space-y-8">
                     <MemoGroupSection
                        project={project}
                        group={null}
                        memos={memosByGroup.get(null) || []}
                        onAddMemo={(title, content) => handleAddMemo(title, content, null)}
                        onUpdateMemo={handleUpdateMemo}
                        onDeleteMemo={handleDeleteMemo}
                        onSelectMemo={setEditingMemo}
                        onMemoDragStart={handleMemoDragStart}
                        onMemoDragEnd={handleDragEnd}
                        onMemoDropOnCard={handleMemoDropOnCard}
                        onMemoDropOnContainer={(e) => handleMemoDropOnContainer(e, null)}
                        onDragOver={() => setDragOverGroupId(null)}
                        draggedMemoId={draggedMemoId}
                        isDropTarget={draggedMemoId !== null && dragOverGroupId === null}
                    />

                    {sortedGroups.map((group, index) => (
                        <div
                            key={group.id}
                            draggable
                            onDragStart={(e) => handleGroupDragStart(e, index)}
                            onDragEnter={() => handleGroupDragEnter(index)}
                            onDragEnd={handleGroupDragEnd}
                            onDragOver={(e) => e.preventDefault()}
                            className="cursor-grab"
                        >
                            <MemoGroupSection
                                project={project}
                                group={group}
                                memos={memosByGroup.get(group.id) || []}
                                onAddMemo={(title, content) => handleAddMemo(title, content, group.id)}
                                onUpdateMemo={handleUpdateMemo}
                                onDeleteMemo={handleDeleteMemo}
                                onSelectMemo={setEditingMemo}
                                onMemoDragStart={handleMemoDragStart}
                                onMemoDragEnd={handleDragEnd}
                                onMemoDropOnCard={handleMemoDropOnCard}
                                onMemoDropOnContainer={(e) => handleMemoDropOnContainer(e, group.id)}
                                onDragOver={() => setDragOverGroupId(group.id)}
                                draggedMemoId={draggedMemoId}
                                isDropTarget={draggedMemoId !== null && dragOverGroupId === group.id}
                            />
                        </div>
                    ))}
                </div>
            </div>

            {editingMemo && (
                <Modal title="メモを編集" onClose={() => {
                    handleUpdateMemo(editingMemo.id, { title: editingMemo.title, content: editingMemo.content });
                    setEditingMemo(null);
                }}>
                    <div className="space-y-2">
                        <input type="text" placeholder="タイトル" value={editingMemo.title} onChange={(e) => setEditingMemo(m => m ? { ...m, title: e.target.value } : null)} className="w-full px-2 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-sky-500 text-md font-semibold" />
                        <textarea placeholder="メモを追加..." value={editingMemo.content} onChange={(e) => setEditingMemo(m => m ? { ...m, content: e.target.value } : null)} className="w-full px-2 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-sky-500 text-sm resize-y" rows={8} />
                    </div>
                </Modal>
            )}
        </>
    );
};

export default MemoTab;