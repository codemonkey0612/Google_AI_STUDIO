import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Bookmark, BookmarkGroup, Project } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { firestore, getCollectionPath, firebase } from '../firebase';
import { PlusIcon, TrashIcon, EditIcon, LinkIcon, MoreVertIcon, SaveIcon, CancelIcon, DragHandleIcon } from '../components/Icons';
import { PrimaryButton, SecondaryButton, IconButton } from '../components/common/Buttons';
import Modal from '../components/Modal';
import { GoogleGenAI } from "@google/genai";

// FIX: Removed unnecessary type assertion for API_KEY.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

interface BookmarkTabProps {
  project: Project;
  initialBookmarks: Bookmark[];
  initialBookmarkGroups: BookmarkGroup[];
}

const BookmarkModal: React.FC<{
    project: Project;
    bookmarkToEdit: Bookmark | null;
    groupId: string | null;
    onClose: () => void;
    bookmarkCount: number;
}> = ({ project, bookmarkToEdit, groupId, onClose, bookmarkCount }) => {
    const { currentUser } = useAuth();
    const [url, setUrl] = useState(bookmarkToEdit?.url || '');
    const [title, setTitle] = useState(bookmarkToEdit?.title || '');
    const [description, setDescription] = useState(bookmarkToEdit?.description || '');
    const [isLoadingTitle, setIsLoadingTitle] = useState(false);
    const [error, setError] = useState('');

    const handleFetchTitle = async () => {
        if (!url.trim()) {
            setError('URLを入力してください。');
            return;
        }
        setError('');
        setIsLoadingTitle(true);
        try {
            const prompt = `このURLのウェブページのタイトルを教えてください: ${url}。タイトルのみを返してください。`;
            const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
            const fetchedTitle = response.text.trim();
            if (fetchedTitle) {
                setTitle(fetchedTitle);
            } else {
                setError('タイトルを取得できませんでした。手動で入力してください。');
            }
        } catch (e) {
            console.error("Error fetching title with Gemini:", e);
            setError('タイトル取得中にエラーが発生しました。');
        } finally {
            setIsLoadingTitle(false);
        }
    };
    
    const handleSave = async () => {
        if (!currentUser || !url.trim() || !title.trim()) {
            setError('URLとタイトルは必須です。');
            return;
        }
        
        const bookmarkData = { projectId: project.id, userId: currentUser.uid, url, title, description };

        try {
            if (bookmarkToEdit) {
                const bookmarkDocRef = firestore.doc(getCollectionPath.bookmarkDoc(currentUser.uid, project.id, bookmarkToEdit.id));
                await bookmarkDocRef.update(bookmarkData);
            } else {
                const bookmarksCollectionRef = firestore.collection(getCollectionPath.bookmarks(currentUser.uid, project.id));
                await bookmarksCollectionRef.add({ ...bookmarkData, groupId, order: bookmarkCount, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
            }
            onClose();
        } catch (e) {
            console.error("Error saving bookmark:", e);
            setError('ブックマークの保存に失敗しました。');
        }
    };

    return (
        <Modal title={bookmarkToEdit ? "ブックマークを編集" : "ブックマークを追加"} onClose={onClose}>
            <div className="space-y-4">
                {error && <p className="text-sm text-red-600 bg-red-100 p-2 rounded-md">{error}</p>}
                <div>
                    <label htmlFor="bookmark-url" className="block text-sm font-medium text-slate-700 mb-1">URL</label>
                    <div className="flex gap-2">
                        <input id="bookmark-url" type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://example.com" required className="block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500"/>
                        <SecondaryButton onClick={handleFetchTitle} disabled={isLoadingTitle || !url.trim()}>{isLoadingTitle ? '取得中...' : 'タイトル取得'}</SecondaryButton>
                    </div>
                </div>
                <div>
                    <label htmlFor="bookmark-title" className="block text-sm font-medium text-slate-700 mb-1">タイトル</label>
                    <input id="bookmark-title" type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="ページのタイトル" required className="block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500"/>
                </div>
                <div>
                    <label htmlFor="bookmark-desc" className="block text-sm font-medium text-slate-700 mb-1">説明（任意）</label>
                    <textarea id="bookmark-desc" value={description} onChange={e => setDescription(e.target.value)} placeholder="このURLに関するメモ" rows={4} className="block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500"/>
                </div>
                <div className="flex justify-end space-x-3 pt-2">
                    <SecondaryButton onClick={onClose}>キャンセル</SecondaryButton>
                    <PrimaryButton onClick={handleSave}>保存</PrimaryButton>
                </div>
            </div>
        </Modal>
    );
};

const BookmarkCard: React.FC<{ bookmark: Bookmark; onEdit: () => void; onDelete: () => void; onDragStart: (e: React.DragEvent) => void; onDragEnd: (e: React.DragEvent) => void; onDrop: (e: React.DragEvent) => void; onDragOver: (e: React.DragEvent) => void; }> = ({ bookmark, onEdit, onDelete, onDragStart, onDragEnd, onDrop, onDragOver }) => (
    <div
        draggable
        onDragStart={onDragStart} onDragEnd={onDragEnd} onDrop={onDrop} onDragOver={onDragOver}
        className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 hover:shadow-md transition-shadow group"
    >
        <div className="flex justify-between items-start">
            <div className="flex-grow min-w-0">
                <a href={bookmark.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-sky-700 hover:underline break-words">{bookmark.title}</a>
                <p className="text-xs text-slate-500 mt-1 truncate" title={bookmark.url}>{bookmark.url}</p>
            </div>
            <div className="flex-shrink-0 ml-4 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                <IconButton onClick={onEdit} aria-label="編集"><EditIcon /></IconButton>
                <IconButton onClick={onDelete} className="hover:text-red-500" aria-label="削除"><TrashIcon /></IconButton>
            </div>
        </div>
        {bookmark.description && <p className="mt-3 text-sm text-slate-600 bg-slate-50 p-3 rounded-md whitespace-pre-wrap break-words">{bookmark.description}</p>}
    </div>
);

const BookmarkGroupHeader: React.FC<{ project: Project; group?: BookmarkGroup; name: string; bookmarkCount: number; }> = ({ project, group, name, bookmarkCount }) => {
    const { currentUser } = useAuth();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isEditingName, setIsEditingName] = useState(false);
    const [editedName, setEditedName] = useState(name);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => { setEditedName(name); }, [name]);
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(event.target as Node)) setIsMenuOpen(false); };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleUpdateName = async () => {
        if (!currentUser || !group || !editedName.trim()) { setIsEditingName(false); setEditedName(name); return; }
        setIsEditingName(false);
        if (editedName.trim() === name) return;
        await firestore.doc(getCollectionPath.bookmarkGroupDoc(currentUser.uid, project.id, group.id)).update({ name: editedName.trim() });
    };

    const handleDeleteGroup = async () => {
        if (!currentUser || !group || !window.confirm(`グループ「${name}」を削除しますか？\n中のブックマークは「未分類」に移動します。`)) return;
        const batch = firestore.batch();
        const bookmarksSnapshot = await firestore.collection(getCollectionPath.bookmarks(currentUser.uid, project.id)).where('groupId', '==', group.id).get();
        bookmarksSnapshot.forEach(doc => batch.update(doc.ref, { groupId: null }));
        batch.delete(firestore.doc(getCollectionPath.bookmarkGroupDoc(currentUser.uid, project.id, group.id)));
        await batch.commit();
    };

    return (
        <div className="flex justify-between items-center px-1 py-2">
            <div className="flex items-center gap-3 min-w-0">
                {group && <span className="text-slate-400"><DragHandleIcon /></span>}
                <div className="flex items-center gap-2 min-w-0">
                    {isEditingName ? (
                        <input type="text" value={editedName} onChange={e => setEditedName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleUpdateName()} onBlur={handleUpdateName} className="px-2 py-1 border-b-2 border-sky-500 focus:outline-none bg-transparent font-semibold text-lg text-slate-800" autoFocus />
                    ) : (
                        <h4 className="font-semibold text-lg text-slate-800 truncate">{name}</h4>
                    )}
                    <span className="text-sm font-medium bg-slate-200 text-slate-600 rounded-full px-2 py-0.5">{bookmarkCount}</span>
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

const BookmarkTab: React.FC<BookmarkTabProps> = ({ project, initialBookmarks, initialBookmarkGroups }) => {
    const { currentUser } = useAuth();
    const [bookmarks, setBookmarks] = useState<Bookmark[]>(initialBookmarks);
    const [groups, setGroups] = useState<BookmarkGroup[]>(initialBookmarkGroups);
    const [modalState, setModalState] = useState<{ isOpen: boolean; editingBookmark: Bookmark | null; groupId: string | null }>({ isOpen: false, editingBookmark: null, groupId: null });
    
    const [draggedBookmarkId, setDraggedBookmarkId] = useState<string | null>(null);
    const [dragOverGroupId, setDragOverGroupId] = useState<string | null>(null);
    const draggedBookmarkRef = useRef<Bookmark | null>(null);
    const draggedGroupIndex = useRef<number | null>(null);
    const dropTargetGroupIndex = useRef<number | null>(null);

    useEffect(() => setBookmarks(initialBookmarks), [initialBookmarks]);
    useEffect(() => setGroups(initialBookmarkGroups), [initialBookmarkGroups]);

    const sortedGroups = useMemo(() => [...groups].sort((a, b) => a.order - b.order), [groups]);
    const bookmarksByGroup = useMemo(() => {
        const grouped: Map<string | null, Bookmark[]> = new Map([[null, []]]);
        sortedGroups.forEach(g => grouped.set(g.id, []));
        bookmarks.forEach(bookmark => {
            const groupId = bookmark.groupId && grouped.has(bookmark.groupId) ? bookmark.groupId : null;
            grouped.get(groupId)!.push(bookmark);
        });
        grouped.forEach(list => list.sort((a, b) => a.order - b.order));
        return grouped;
    }, [bookmarks, sortedGroups]);

    const handleDeleteBookmark = async (bookmarkId: string) => {
        if (!currentUser) return;
        await firestore.doc(getCollectionPath.bookmarkDoc(currentUser.uid, project.id, bookmarkId)).delete();
    };

    const handleAddGroup = async () => {
        if (!currentUser) return;
        await firestore.collection(getCollectionPath.bookmarkGroups(currentUser.uid, project.id)).add({ name: '新しいグループ', order: groups.length, projectId: project.id, userId: currentUser.uid });
    };

    const handleBookmarkDragStart = (e: React.DragEvent, bookmark: Bookmark) => {
        e.dataTransfer.setData('application/x-bookmark-id', bookmark.id);
        e.dataTransfer.effectAllowed = 'move';
        draggedBookmarkRef.current = bookmark;
        setTimeout(() => setDraggedBookmarkId(bookmark.id), 0);
    };

    const handleDragEnd = () => {
        setDraggedBookmarkId(null);
        draggedBookmarkRef.current = null;
        setDragOverGroupId(null);
    };

    const updateBookmarkOrder = async (dragged: Bookmark, targetGroupId: string | null, targetIndex: number) => {
        if (!currentUser) return;
        const sourceGroupId = dragged.groupId || null;
        const batch = firestore.batch();
        const targetGroupBms = bookmarks.filter(b => (b.groupId || null) === targetGroupId && b.id !== dragged.id).sort((a, b) => a.order - b.order);
        targetGroupBms.splice(targetIndex, 0, dragged);
        targetGroupBms.forEach((b, idx) => batch.update(firestore.doc(getCollectionPath.bookmarkDoc(currentUser.uid, project.id, b.id)), { order: idx, groupId: targetGroupId }));
        if (sourceGroupId !== targetGroupId) {
            bookmarks.filter(b => (b.groupId || null) === sourceGroupId && b.id !== dragged.id).sort((a, b) => a.order - b.order)
                .forEach((b, idx) => batch.update(firestore.doc(getCollectionPath.bookmarkDoc(currentUser.uid, project.id, b.id)), { order: idx }));
        }
        await batch.commit();
    };

    const handleBookmarkDrop = async (targetGroupId: string | null, targetBookmarkId?: string) => {
        const dragged = draggedBookmarkRef.current;
        if (!dragged) return;
        const targetIndex = targetBookmarkId ? bookmarksByGroup.get(targetGroupId)?.findIndex(b => b.id === targetBookmarkId) ?? 0 : bookmarksByGroup.get(targetGroupId)?.length ?? 0;
        await updateBookmarkOrder(dragged, targetGroupId, targetIndex);
    };

    const handleGroupDragStart = (e: React.DragEvent, index: number) => { draggedGroupIndex.current = index; e.dataTransfer.effectAllowed = 'move'; };
    const handleGroupDragEnter = (index: number) => { if (draggedGroupIndex.current !== null) dropTargetGroupIndex.current = index; };
    const handleGroupDragEnd = async () => {
        const draggedIdx = draggedGroupIndex.current; const targetIdx = dropTargetGroupIndex.current;
        draggedGroupIndex.current = null; dropTargetGroupIndex.current = null;
        if (draggedIdx === null || targetIdx === null || draggedIdx === targetIdx) return;
        
        const reordered = [...sortedGroups];
        const [item] = reordered.splice(draggedIdx, 1);
        reordered.splice(targetIdx, 0, item);
        
        if (!currentUser) return;
        const batch = firestore.batch();
        reordered.forEach((g, idx) => batch.update(firestore.doc(getCollectionPath.bookmarkGroupDoc(currentUser.uid, project.id, g.id)), { order: idx }));
        await batch.commit();
    };
    
    return (
        <div className="p-4 bg-slate-50 space-y-6">
            <div className="flex justify-between items-center">
                <h3 className="text-xl font-semibold text-slate-800 flex items-center gap-2"><LinkIcon />ブックマーク</h3>
                <PrimaryButton onClick={handleAddGroup} icon={<PlusIcon />}>グループを追加</PrimaryButton>
            </div>
            <div className="space-y-8">
                {[null, ...sortedGroups.map(g => g.id)].map((groupId, groupIndex) => {
                    const group = groupId ? sortedGroups.find(g => g.id === groupId) : null;
                    const groupBookmarks = bookmarksByGroup.get(groupId) || [];
                    return (
                        <div key={groupId || 'uncategorized'}
                            draggable={!!group} onDragStart={e => group && handleGroupDragStart(e, groupIndex - 1)} onDragEnter={() => group && handleGroupDragEnter(groupIndex - 1)} onDragEnd={handleGroupDragEnd} onDragOver={e => e.preventDefault()} className={group ? 'cursor-grab' : ''}
                        >
                            <div onDrop={() => handleBookmarkDrop(groupId)} onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverGroupId(groupId); }}
                                className={`p-4 rounded-lg border border-slate-200 bg-white/50 transition-colors duration-200 ${draggedBookmarkId && dragOverGroupId === groupId ? 'bg-sky-100 ring-2 ring-sky-400' : ''}`}
                            >
                                <BookmarkGroupHeader project={project} group={group || undefined} name={group?.name || '未分類'} bookmarkCount={groupBookmarks.length} />
                                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 min-h-[100px]">
                                    {groupBookmarks.map(bookmark => (
                                        <div key={bookmark.id} className={draggedBookmarkId === bookmark.id ? 'opacity-30' : ''}>
                                            <BookmarkCard bookmark={bookmark} onEdit={() => setModalState({ isOpen: true, editingBookmark: bookmark, groupId })}
                                                onDelete={() => window.confirm(`「${bookmark.title}」を削除しますか？`) && handleDeleteBookmark(bookmark.id)}
                                                onDragStart={e => handleBookmarkDragStart(e, bookmark)} onDragEnd={handleDragEnd}
                                                onDrop={e => { e.stopPropagation(); handleBookmarkDrop(groupId, bookmark.id); }} onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
                                            />
                                        </div>
                                    ))}
                                    <div className="flex items-center justify-center">
                                        <SecondaryButton onClick={() => setModalState({ isOpen: true, editingBookmark: null, groupId })} icon={<PlusIcon />} className="w-full h-full">ブックマークを追加</SecondaryButton>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
            {modalState.isOpen && <BookmarkModal project={project} bookmarkToEdit={modalState.editingBookmark} groupId={modalState.groupId} onClose={() => setModalState({ isOpen: false, editingBookmark: null, groupId: null })} bookmarkCount={bookmarks.length} />}
        </div>
    );
};

export default BookmarkTab;