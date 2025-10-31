import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ProjectFile, Project, FileGroup } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { firestore, storage, getCollectionPath, firebase } from '../firebase';
import { PlusIcon, TrashIcon, EditIcon, SaveIcon, CancelIcon, AttachFileIcon, CloudUploadIcon, DragHandleIcon, FileDownloadIcon, DocumentTextIcon, PictureAsPdfIcon, MoreVertIcon } from '../components/Icons';
import { PrimaryButton, SecondaryButton, IconButton } from '../components/common/Buttons';
import { EditableField } from '../components/common/EditableField';
import { formatDate } from '../utils';

const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

interface FileTabProps {
  project: Project;
  initialFiles: ProjectFile[];
  initialFileGroups: FileGroup[];
}

interface UploadProgress {
    id: string;
    name: string;
    progress: number;
    error?: string;
}

const FileCard: React.FC<{ file: ProjectFile; onUpdate: (id: string, updates: Partial<ProjectFile>) => void; onDelete: (file: ProjectFile) => void; }> = ({ file, onUpdate, onDelete }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editedDesc, setEditedDesc] = useState(file.description);
    
    const getFileIcon = (mimeType: string) => {
        if (mimeType.startsWith('image/')) return <PictureAsPdfIcon className="text-rose-500" style={{fontVariationSettings: "'FILL' 1"}} />;
        if (mimeType === 'application/pdf') return <PictureAsPdfIcon className="text-red-500" />;
        return <DocumentTextIcon className="text-slate-500" />;
    };
    
    const handleSave = () => {
        if (editedDesc !== file.description) onUpdate(file.id, { description: editedDesc });
        setIsEditing(false);
    };

    return (
        <div className="bg-white p-3 rounded-lg shadow-sm border border-slate-200 hover:shadow-md transition-shadow group flex flex-col h-full">
            <div className="flex items-start gap-3">
                <span className="text-2xl mt-1">{getFileIcon(file.type)}</span>
                <div className="flex-grow min-w-0">
                    <a href={file.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-slate-800 hover:underline break-all" title={file.name}>{file.name}</a>
                    <p className="text-xs text-slate-500 mt-0.5">{formatBytes(file.size)} &bull; {file.createdAt ? formatDate(file.createdAt.toDate(), 'yy/MM/dd') : ''}</p>
                </div>
            </div>
            <div className="mt-2 flex-grow">
                {isEditing ? (
                     <textarea value={editedDesc} onChange={e => setEditedDesc(e.target.value)} rows={3} className="w-full text-sm p-1 border border-slate-300 rounded-md" autoFocus onBlur={handleSave} />
                ) : (
                    <p onClick={() => setIsEditing(true)} className={`text-sm text-slate-600 p-1 rounded-md min-h-[4rem] whitespace-pre-wrap break-words ${!file.description && 'text-slate-400 italic'}`}>{file.description || '説明を追加...'}</p>
                )}
            </div>
            <div className="flex justify-end items-center mt-2 h-8">
                <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                    {isEditing ? (
                        <>
                           <IconButton onClick={handleSave} aria-label="保存"><SaveIcon className="text-sky-600"/></IconButton>
                           <IconButton onClick={() => setIsEditing(false)} aria-label="キャンセル"><CancelIcon /></IconButton>
                        </>
                    ) : (
                        <>
                            <a href={file.url} target="_blank" rel="noopener noreferrer" download={file.name} aria-label="ダウンロード" className="p-1.5 rounded-full text-slate-500 hover:bg-slate-100 hover:text-sky-600"><FileDownloadIcon /></a>
                            <IconButton onClick={() => setIsEditing(true)} aria-label="編集"><EditIcon /></IconButton>
                            <IconButton onClick={() => onDelete(file)} className="hover:text-red-500" aria-label="削除"><TrashIcon /></IconButton>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

const FileGroupHeader: React.FC<{ project: Project; group?: FileGroup; name: string; fileCount: number; }> = ({ project, group, name, fileCount }) => {
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
        await firestore.doc(getCollectionPath.fileGroupDoc(currentUser.uid, project.id, group.id)).update({ name: editedName.trim() });
    };

    const handleDeleteGroup = async () => {
        if (!currentUser || !group || !window.confirm(`グループ「${name}」を削除しますか？\n中のファイルは「未分類」に移動します。`)) return;
        const batch = firestore.batch();
        const filesSnapshot = await firestore.collection(getCollectionPath.files(currentUser.uid, project.id)).where('groupId', '==', group.id).get();
        filesSnapshot.forEach(doc => batch.update(doc.ref, { groupId: null }));
        batch.delete(firestore.doc(getCollectionPath.fileGroupDoc(currentUser.uid, project.id, group.id)));
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
                    <span className="text-sm font-medium bg-slate-200 text-slate-600 rounded-full px-2 py-0.5">{fileCount}</span>
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

const FileTab: React.FC<FileTabProps> = ({ project, initialFiles, initialFileGroups }) => {
    const { currentUser } = useAuth();
    const [files, setFiles] = useState<ProjectFile[]>(initialFiles);
    const [groups, setGroups] = useState<FileGroup[]>(initialFileGroups);
    const [uploadProgress, setUploadProgress] = useState<Record<string, UploadProgress>>({});
    
    const [draggedFileId, setDraggedFileId] = useState<string | null>(null);
    const [dragOverGroupId, setDragOverGroupId] = useState<string | null>(null);
    const draggedFileRef = useRef<ProjectFile | null>(null);
    const draggedGroupIndex = useRef<number | null>(null);
    const dropTargetGroupIndex = useRef<number | null>(null);
    const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

    useEffect(() => setFiles(initialFiles), [initialFiles]);
    useEffect(() => setGroups(initialFileGroups), [initialFileGroups]);

    const sortedGroups = useMemo(() => [...groups].sort((a, b) => a.order - b.order), [groups]);
    const filesByGroup = useMemo(() => {
        const grouped: Map<string | null, ProjectFile[]> = new Map([[null, []]]);
        sortedGroups.forEach(g => grouped.set(g.id, []));
        files.forEach(file => {
            const groupId = file.groupId && grouped.has(file.groupId) ? file.groupId : null;
            grouped.get(groupId)!.push(file);
        });
        grouped.forEach(list => list.sort((a, b) => a.order - b.order));
        return grouped;
    }, [files, sortedGroups]);

    const handleAddGroup = async () => {
        if (!currentUser) return;
        await firestore.collection(getCollectionPath.fileGroups(currentUser.uid, project.id)).add({ name: '新しいグループ', order: groups.length, projectId: project.id, userId: currentUser.uid });
    };

    const uploadFile = (file: File, groupId: string | null) => {
        if (!currentUser) return;
        const uploadId = `${Date.now()}-${file.name}`;
        const storagePath = `users/${currentUser.uid}/projectFiles/${project.id}/${uploadId}`;
        const uploadTask = storage.ref(storagePath).put(file);

        setUploadProgress(prev => ({ ...prev, [uploadId]: { id: uploadId, name: file.name, progress: 0 } }));

        uploadTask.on('state_changed',
            (snapshot) => setUploadProgress(prev => {
                if (!prev[uploadId]) return prev;
                return { ...prev, [uploadId]: { ...prev[uploadId], progress: Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100) } };
            }),
            (error: any) => {
                console.error("Firebase Storage Upload Error:", error);
                let message = "アップロードに失敗しました。";
                switch (error.code) {
                    case 'storage/unauthorized':
                        message = "権限がありません。Firebaseのルールを確認してください。";
                        break;
                    case 'storage/canceled':
                        message = "アップロードがキャンセルされました。";
                        break;
                    case 'storage/unknown':
                        message = "不明なエラーです。Cloud StorageのCORS設定を確認してください。";
                        break;
                    default:
                        message = `予期せぬエラー: ${error.message}`;
                }
                setUploadProgress(prev => {
                    const currentUpload = prev[uploadId] || { id: uploadId, name: file.name, progress: 0 };
                    return { ...prev, [uploadId]: { ...currentUpload, error: message } };
                });
            },
            async () => {
                try {
                    const downloadURL = await uploadTask.snapshot.ref.getDownloadURL();
                    await firestore.collection(getCollectionPath.files(currentUser!.uid, project.id)).add({
                        projectId: project.id, userId: currentUser.uid, name: file.name, description: '', url: downloadURL, storagePath,
                        size: file.size, type: file.type, createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                        order: filesByGroup.get(groupId)?.length || 0, groupId,
                    });
                    setTimeout(() => {
                        setUploadProgress(prev => { const newP = { ...prev }; delete newP[uploadId]; return newP; });
                    }, 1000);
                } catch (e) {
                    console.error("Error saving file metadata:", e);
                    setUploadProgress(prev => {
                        const currentUpload = prev[uploadId] || { id: uploadId, name: file.name, progress: 100 };
                        return { ...prev, [uploadId]: { ...currentUpload, error: "メタデータの保存に失敗しました。" } };
                    });
                }
            }
        );
    };

    const handleDeleteFile = async (file: ProjectFile) => {
        if (!currentUser || !window.confirm(`ファイル「${file.name}」を削除しますか？`)) return;
        await storage.ref(file.storagePath).delete();
        await firestore.doc(getCollectionPath.fileDoc(currentUser.uid, project.id, file.id)).delete();
    };
    
    const handleUpdateFile = async (fileId: string, updates: Partial<ProjectFile>) => {
        if(!currentUser) return;
        await firestore.doc(getCollectionPath.fileDoc(currentUser.uid, project.id, fileId)).update(updates);
    };
    
    const handleFileDragStart = (e: React.DragEvent, file: ProjectFile) => {
        e.dataTransfer.setData('application/x-file-id', file.id);
        e.dataTransfer.effectAllowed = 'move';
        draggedFileRef.current = file;
        setTimeout(() => setDraggedFileId(file.id), 0);
    };
    const handleDragEnd = () => { setDraggedFileId(null); draggedFileRef.current = null; setDragOverGroupId(null); };
    
    const updateFileOrder = async (dragged: ProjectFile, targetGroupId: string | null, targetIndex: number) => {
        if (!currentUser) return;
        const sourceGroupId = dragged.groupId || null;
        const batch = firestore.batch();
        const targetGroupFiles = files.filter(f => (f.groupId || null) === targetGroupId && f.id !== dragged.id).sort((a,b) => a.order - b.order);
        targetGroupFiles.splice(targetIndex, 0, dragged);
        targetGroupFiles.forEach((f, idx) => batch.update(firestore.doc(getCollectionPath.fileDoc(currentUser.uid, project.id, f.id)), { order: idx, groupId: targetGroupId }));
        if (sourceGroupId !== targetGroupId) {
            files.filter(f => (f.groupId || null) === sourceGroupId && f.id !== dragged.id).sort((a,b) => a.order - b.order)
                .forEach((f, idx) => batch.update(firestore.doc(getCollectionPath.fileDoc(currentUser.uid, project.id, f.id)), { order: idx }));
        }
        await batch.commit();
    };

    const handleFileDrop = async (targetGroupId: string | null, targetFileId?: string) => {
        const dragged = draggedFileRef.current;
        if (!dragged) return;
        const targetIndex = targetFileId ? filesByGroup.get(targetGroupId)?.findIndex(f => f.id === targetFileId) ?? 0 : filesByGroup.get(targetGroupId)?.length ?? 0;
        await updateFileOrder(dragged, targetGroupId, targetIndex);
    };

    const handleGroupDragStart = (e: React.DragEvent, index: number) => { draggedGroupIndex.current = index; e.dataTransfer.effectAllowed = 'move'; };
    const handleGroupDragEnter = (index: number) => { if (draggedGroupIndex.current !== null) dropTargetGroupIndex.current = index; };
    const handleGroupDragEnd = async () => {
        const draggedIdx = draggedGroupIndex.current; const targetIdx = dropTargetGroupIndex.current;
        draggedGroupIndex.current = null; dropTargetGroupIndex.current = null;
        if (draggedIdx === null || targetIdx === null || draggedIdx === targetIdx) return;
        const reordered = [...sortedGroups]; const [item] = reordered.splice(draggedIdx, 1); reordered.splice(targetIdx, 0, item);
        if (!currentUser) return;
        const batch = firestore.batch();
        reordered.forEach((g, idx) => batch.update(firestore.doc(getCollectionPath.fileGroupDoc(currentUser.uid, project.id, g.id)), { order: idx }));
        await batch.commit();
    };
    
    return (
        <div className="p-4 bg-slate-50 space-y-6">
            <div className="flex justify-between items-center">
                <h3 className="text-xl font-semibold text-slate-800 flex items-center gap-2"><AttachFileIcon />ファイル</h3>
                <PrimaryButton onClick={handleAddGroup} icon={<PlusIcon />}>グループを追加</PrimaryButton>
            </div>
            
            {Object.values(uploadProgress).length > 0 && (
                <div className="space-y-3 p-4 bg-white rounded-lg border border-slate-200">
                    <h4 className="font-semibold text-slate-700 text-base">アップロード中</h4>
                    {Object.values(uploadProgress).map(up => (
                        <div key={up.id} className="text-sm">
                            <div className="flex justify-between items-center mb-1">
                                <p className="truncate text-slate-600 max-w-xs sm:max-w-md" title={up.name}>{up.name}</p>
                                {up.error ? (
                                    <p className="text-red-600 font-medium">失敗</p>
                                ) : (
                                    <p className="text-slate-500 font-medium">{up.progress}%</p>
                                )}
                            </div>
                            <div className="w-full bg-slate-200 rounded-full h-2.5 relative overflow-hidden">
                                {up.error ? (
                                    <div className="bg-red-200 h-2.5 w-full"></div>
                                ) : (
                                    <div className="bg-sky-600 h-2.5 rounded-full transition-all duration-300 ease-linear" style={{ width: `${up.progress}%` }}></div>
                                )}
                            </div>
                            {up.error && (
                                <p className="text-xs text-red-500 mt-1">{up.error}</p>
                            )}
                        </div>
                    ))}
                </div>
            )}
            
            <div className="space-y-8">
                {[null, ...sortedGroups.map(g => g.id)].map((groupId, groupIndex) => {
                    const group = groupId ? sortedGroups.find(g => g.id === groupId) : null;
                    const groupFiles = filesByGroup.get(groupId) || [];
                    return (
                        <div key={groupId || 'uncategorized'}
                            draggable={!!group} onDragStart={e => group && handleGroupDragStart(e, groupIndex - 1)} onDragEnter={() => group && handleGroupDragEnter(groupIndex - 1)} onDragEnd={handleGroupDragEnd} onDragOver={e => e.preventDefault()} className={group ? 'cursor-grab' : ''}
                        >
                            <div onDrop={e => { e.preventDefault(); if (e.dataTransfer.files.length > 0) Array.from(e.dataTransfer.files).forEach(f => uploadFile(f, groupId)); else handleFileDrop(groupId); setDragOverGroupId(null); }} onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverGroupId(groupId); }} onDragLeave={() => setDragOverGroupId(null)}
                                className={`p-4 rounded-lg border border-slate-200 bg-white/50 transition-colors duration-200 ${dragOverGroupId === groupId ? 'bg-sky-100 ring-2 ring-sky-400' : ''}`}>
                                <FileGroupHeader project={project} group={group || undefined} name={group?.name || '未分類'} fileCount={groupFiles.length} />
                                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 min-h-[150px]">
                                    {groupFiles.map(file => (
                                        <div key={file.id} className={draggedFileId === file.id ? 'opacity-30' : ''}>
                                            <FileCard file={file} onUpdate={handleUpdateFile} onDelete={handleDeleteFile} />
                                        </div>
                                    ))}
                                    <div className="flex items-center justify-center p-4 rounded-lg border-2 border-dashed border-slate-300 hover:border-sky-500 hover:bg-slate-100 transition-colors text-slate-500 cursor-pointer" onClick={() => fileInputRefs.current?.[String(groupId)]?.click()}>
                                        <div className="text-center">
                                            <CloudUploadIcon className="mx-auto text-2xl" />
                                            <span className="text-sm mt-1 block">ファイルを選択<br/>またはドロップ</span>
                                            <input type="file" multiple ref={el => { fileInputRefs.current[String(groupId)] = el; }} onChange={e => e.target.files && Array.from(e.target.files).forEach(f => uploadFile(f, groupId))} className="hidden" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default FileTab;