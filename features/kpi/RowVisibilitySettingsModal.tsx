import React, { useState } from 'react';
import { KpiMeasureRow } from '../../types';
import Modal from '../../components/Modal';
import { PrimaryButton, SecondaryButton } from '../../components/common/Buttons';

export const RowVisibilitySettingsModal: React.FC<{
    rows: KpiMeasureRow[];
    initialHiddenIds: Set<string>;
    onSave: (newHiddenIds: Set<string>) => Promise<void>;
    onClose: () => void;
}> = ({ rows, initialHiddenIds, onSave, onClose }) => {
    const [hiddenIds, setHiddenIds] = useState<Set<string>>(initialHiddenIds);
    const [loading, setLoading] = useState(false);

    const handleToggle = (rowId: string) => {
        setHiddenIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(rowId)) {
                newSet.delete(rowId);
            } else {
                newSet.add(rowId);
            }
            return newSet;
        });
    };

    const handleSave = async () => {
        setLoading(true);
        await onSave(hiddenIds);
        setLoading(false);
    };

    return (
        <Modal title="項目の表示設定" onClose={onClose}>
            <div className="space-y-4">
                <p className="text-sm text-slate-600">表示する項目を選択してください。この設定はこのテーブルにのみ適用されます。</p>
                <div className="max-h-80 overflow-y-auto space-y-2 pr-2 border rounded-md p-2 bg-slate-50">
                    {rows.map(row => (
                        <label key={row.id} className="flex items-center space-x-3 p-2 rounded-md hover:bg-slate-100 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={!hiddenIds.has(row.id)}
                                onChange={() => handleToggle(row.id)}
                                className="h-4 w-4 text-sky-600 border-slate-300 rounded focus:ring-sky-500"
                            />
                            <span className="text-sm text-slate-800">{row.name}</span>
                        </label>
                    ))}
                </div>
                <div className="flex justify-end space-x-3 pt-4 border-t border-slate-200">
                    <SecondaryButton onClick={onClose} disabled={loading}>キャンセル</SecondaryButton>
                    <PrimaryButton onClick={handleSave} disabled={loading}>
                        {loading ? "保存中..." : "保存"}
                    </PrimaryButton>
                </div>
            </div>
        </Modal>
    );
};
