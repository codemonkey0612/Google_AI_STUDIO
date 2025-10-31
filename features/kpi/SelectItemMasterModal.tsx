import React, { useState, useMemo } from 'react';
import { ItemMaster } from '../../types';
import Modal from '../../components/Modal';
import { PrimaryButton, SecondaryButton } from '../../components/common/Buttons';

export const SelectItemMasterModal: React.FC<{
    masters: ItemMaster[];
    existingRowNames: string[];
    onAdd: (selectedMasters: ItemMaster[]) => void;
    onClose: () => void;
}> = ({ masters, existingRowNames, onAdd, onClose }) => {
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const availableMasters = useMemo(() => {
        const existingNamesSet = new Set(existingRowNames);
        return masters.filter(m => !existingNamesSet.has(m.name));
    }, [masters, existingRowNames]);

    const handleToggle = (masterId: string) => {
        setSelectedIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(masterId)) {
                newSet.delete(masterId);
            } else {
                newSet.add(masterId);
            }
            return newSet;
        });
    };
    
    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            setSelectedIds(new Set(availableMasters.map(m => m.id)));
        } else {
            setSelectedIds(new Set());
        }
    };

    const handleSubmit = () => {
        const selectedMasters = availableMasters.filter(m => selectedIds.has(m.id));
        onAdd(selectedMasters);
    };

    return (
        <Modal title="マスターから項目を追加" onClose={onClose} size="md">
            <div className="space-y-4">
                {availableMasters.length > 0 ? (
                    <>
                        <div className="border-b pb-2">
                            <label className="flex items-center space-x-2 cursor-pointer text-sm">
                                <input
                                    type="checkbox"
                                    checked={selectedIds.size === availableMasters.length && availableMasters.length > 0}
                                    onChange={handleSelectAll}
                                    className="h-4 w-4 text-sky-600 border-slate-300 rounded focus:ring-sky-500"
                                />
                                <span>すべて選択</span>
                            </label>
                        </div>
                        <div className="max-h-80 overflow-y-auto space-y-2 pr-2">
                            {availableMasters.map(master => (
                                <label key={master.id} className="flex items-center space-x-3 p-2 rounded-md hover:bg-slate-100 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={selectedIds.has(master.id)}
                                        onChange={() => handleToggle(master.id)}
                                        className="h-4 w-4 text-sky-600 border-slate-300 rounded focus:ring-sky-500"
                                    />
                                    <span className="text-sm text-slate-800">{master.name}</span>
                                </label>
                            ))}
                        </div>
                    </>
                ) : (
                    <p className="text-center text-slate-500 py-8">追加可能な項目マスターがありません。<br/>（既に追加済みか、マスターが登録されていません）</p>
                )}
                <div className="flex justify-end space-x-3 pt-4 border-t border-slate-200">
                    <SecondaryButton onClick={onClose}>キャンセル</SecondaryButton>
                    <PrimaryButton onClick={handleSubmit} disabled={selectedIds.size === 0}>
                        {selectedIds.size}件を追加
                    </PrimaryButton>
                </div>
            </div>
        </Modal>
    );
};
