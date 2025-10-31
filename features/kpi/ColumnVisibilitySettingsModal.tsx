import React, { useState } from 'react';
import { KpiMeasureColumn, KpiMeasureMaster } from '../../types';
import Modal from '../../components/Modal';
import { PrimaryButton, SecondaryButton } from '../../components/common/Buttons';

export const ColumnVisibilitySettingsModal: React.FC<{
    columns: (KpiMeasureColumn | KpiMeasureMaster['columns'][0])[];
    initialHiddenIds: Set<string>;
    onSave: (newHiddenIds: Set<string>) => Promise<void>;
    onClose: () => void;
}> = ({ columns, initialHiddenIds, onSave, onClose }) => {
    const [hiddenIds, setHiddenIds] = useState<Set<string>>(initialHiddenIds);
    const [loading, setLoading] = useState(false);

    const handleToggle = (colId: string) => {
        setHiddenIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(colId)) {
                newSet.delete(colId);
            } else {
                newSet.add(colId);
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
        <Modal title="列の表示設定" onClose={onClose}>
            <div className="space-y-4">
                <p className="text-sm text-slate-600">表示する列を選択してください。</p>
                <div className="max-h-80 overflow-y-auto space-y-2 pr-2 border rounded-md p-2 bg-slate-50">
                    {columns.map(col => (
                        <label key={col.id} className="flex items-center space-x-3 p-2 rounded-md hover:bg-slate-100 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={!hiddenIds.has(col.id)}
                                onChange={() => handleToggle(col.id)}
                                className="h-4 w-4 text-sky-600 border-slate-300 rounded focus:ring-sky-500"
                            />
                            <span className="text-sm text-slate-800">{col.name}</span>
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
