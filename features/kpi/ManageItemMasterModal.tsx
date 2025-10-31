import React, { useState } from 'react';
import { Project, ItemMaster } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { firestore, getCollectionPath } from '../../firebase';
import Modal from '../../components/Modal';
import { PlusIcon, TrashIcon } from '../../components/Icons';
import { PrimaryButton, SecondaryButton, IconButton } from '../../components/common/Buttons';

interface ManageItemMasterModalProps {
  project: Project;
  initialItems: ItemMaster[];
  onUpdate: () => void; // To refetch
  onClose: () => void;
}

const ManageItemMasterModal: React.FC<ManageItemMasterModalProps> = ({ project, initialItems, onUpdate, onClose }) => {
    const { currentUser } = useAuth();
    const [items, setItems] = useState<ItemMaster[]>(() => JSON.parse(JSON.stringify(initialItems.sort((a,b) => a.name.localeCompare(b.name)))));
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleAddItem = () => {
        if (!currentUser) return;
        const newItem: ItemMaster = {
            id: `new-${Date.now()}`,
            projectId: project.id,
            userId: currentUser.uid,
            name: '',
        };
        setItems([...items, newItem]);
    };

    const handleDeleteItem = (idToDelete: string) => {
        setItems(prev => prev.filter(item => item.id !== idToDelete));
    };

    const handleItemChange = (id: string, name: string) => {
        setItems(items.map(item => item.id === id ? { ...item, name } : item));
    };

    const handleSaveChanges = async () => {
        if (!currentUser) return;
        setLoading(true);
        setError(null);

        try {
            const batch = firestore.batch();
            const path = getCollectionPath.itemMasters(currentUser.uid, project.id);
            
            const finalItems = items;
            const finalItemIds = new Set(finalItems.map(i => i.id));
            const deletedItems = initialItems.filter(initial => !finalItemIds.has(initial.id));

            for (const deleted of deletedItems) {
                batch.delete(firestore.doc(`${path}/${deleted.id}`));
            }

            for (const item of finalItems) {
                if (!item.name.trim()) {
                    throw new Error("項目名は必須です。");
                }
                
                const data = {
                    projectId: item.projectId,
                    userId: item.userId,
                    name: item.name.trim(),
                };

                if (item.id.startsWith('new-')) {
                    batch.set(firestore.collection(path).doc(), data);
                } else {
                    const originalItem = initialItems.find(i => i.id === item.id);
                    if(originalItem && originalItem.name !== item.name.trim()){
                         batch.update(firestore.doc(`${path}/${item.id}`), data);
                    }
                }
            }

            await batch.commit();
            onUpdate();
            onClose();
        } catch (e: any) {
            setError(e.message || "保存中にエラーが発生しました。");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal title="項目マスター管理" onClose={onClose} size="lg">
            <div className="space-y-4 flex flex-col" style={{minHeight: '400px'}}>
                <div className="text-sm p-3 bg-slate-50 rounded-md">施策テーブルで頻繁に使用する項目名を登録しておくと、ドロップダウンから選択して簡単に追加できます。</div>
                {error && <p className="text-sm text-red-600 bg-red-100 p-3 rounded-md">{error}</p>}
                
                <div className="space-y-2 flex-grow max-h-96 overflow-y-auto pr-2">
                    {items.map((item) => (
                        <div key={item.id} className="flex items-center gap-2 p-2 rounded-md hover:bg-slate-100">
                           <input type="text" placeholder="項目名" value={item.name} onChange={e => handleItemChange(item.id, e.target.value)} className="px-2 py-1 border border-slate-300 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500 text-sm w-full" />
                           <IconButton onClick={() => handleDeleteItem(item.id)} className="hover:text-red-500" aria-label="削除"><TrashIcon/></IconButton>
                        </div>
                    ))}
                </div>
                
                <div className="border-t border-slate-200 pt-4 space-y-4">
                    <PrimaryButton icon={<PlusIcon />} onClick={handleAddItem} size="sm">項目を追加</PrimaryButton>
                    <div className="flex justify-end space-x-3">
                        <SecondaryButton onClick={onClose} disabled={loading}>キャンセル</SecondaryButton>
                        <PrimaryButton onClick={handleSaveChanges} disabled={loading}>
                            {loading ? "保存中..." : "変更を保存"}
                        </PrimaryButton>
                    </div>
                </div>
            </div>
        </Modal>
    );
};

export default ManageItemMasterModal;
