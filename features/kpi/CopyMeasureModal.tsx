import React, { useState, useEffect } from 'react';
import { KpiRecord, KpiMeasure, Project } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { firestore, getCollectionPath } from '../../firebase';
import Modal from '../../components/Modal';
import { PrimaryButton, SecondaryButton } from '../../components/common/Buttons';
import LoadingSpinner from '../../components/common/LoadingSpinner';

interface CopyMeasureModalProps {
    project: Project;
    currentRecordId: string;
    allKpiRecords: KpiRecord[];
    onClose: () => void;
    onCopy: (sourceRecordId: string, sourceMeasureId: string) => Promise<void>;
    parentMeasureId?: string; // For sub-measures
}

export const CopyMeasureModal: React.FC<CopyMeasureModalProps> = ({ project, currentRecordId, allKpiRecords, onClose, onCopy, parentMeasureId }) => {
    const { currentUser } = useAuth();
    const [selectedRecordId, setSelectedRecordId] = useState<string>('');
    const [measuresInRecord, setMeasuresInRecord] = useState<KpiMeasure[]>([]);
    const [selectedMeasureId, setSelectedMeasureId] = useState<string>('');
    const [loadingMeasures, setLoadingMeasures] = useState(false);
    const [isCopying, setIsCopying] = useState(false);
    const [error, setError] = useState('');

    const availableRecords = allKpiRecords
        .filter(r => r.id !== currentRecordId)
        .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());

    useEffect(() => {
        if (!selectedRecordId || !currentUser) {
            setMeasuresInRecord([]);
            setSelectedMeasureId('');
            return;
        }

        const fetchMeasures = async () => {
            setLoadingMeasures(true);
            setSelectedMeasureId('');
            try {
                // For now, only top-level measures can be copied as a starting point.
                // Copying sub-measures from other records adds significant complexity.
                const measuresPath = getCollectionPath.kpiMeasures(currentUser.uid, project.id, selectedRecordId);
                const snapshot = await firestore.collection(measuresPath).orderBy('order').get();
                setMeasuresInRecord(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as KpiMeasure)));
            } catch (err) {
                console.error(err);
                setError('施策の読み込みに失敗しました。');
            } finally {
                setLoadingMeasures(false);
            }
        };

        fetchMeasures();
    }, [selectedRecordId, currentUser, project.id]);

    const handleCopy = async () => {
        if (!selectedRecordId || !selectedMeasureId) {
            setError('コピー元の期間と施策を選択してください。');
            return;
        }
        setIsCopying(true);
        setError('');
        try {
            await onCopy(selectedRecordId, selectedMeasureId);
        } catch (err: any) {
            setError(err.message || 'コピーに失敗しました。');
        } finally {
            setIsCopying(false);
        }
    };

    return (
        <Modal title="他の月の施策をコピー" onClose={onClose}>
            <div className="space-y-4">
                {error && <p className="text-sm text-red-600 bg-red-100 p-2 rounded-md">{error}</p>}
                <div>
                    <label htmlFor="source-record" className="block text-sm font-medium text-slate-700 mb-1">コピー元の期間</label>
                    <select
                        id="source-record"
                        value={selectedRecordId}
                        onChange={e => setSelectedRecordId(e.target.value)}
                        className="block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                    >
                        <option value="">期間を選択...</option>
                        {availableRecords.map(rec => (
                            <option key={rec.id} value={rec.id}>{rec.periodLabel}</option>
                        ))}
                    </select>
                </div>

                {loadingMeasures ? (
                    <LoadingSpinner text="施策を読み込み中..." />
                ) : measuresInRecord.length > 0 && (
                    <div>
                        <label htmlFor="source-measure" className="block text-sm font-medium text-slate-700 mb-1">コピーする施策</label>
                        <select
                            id="source-measure"
                            value={selectedMeasureId}
                            onChange={e => setSelectedMeasureId(e.target.value)}
                            className="block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                        >
                            <option value="">施策を選択...</option>
                            {measuresInRecord.map(m => (
                                <option key={m.id} value={m.id}>{m.name}</option>
                            ))}
                        </select>
                    </div>
                )}
                
                <div className="flex justify-end space-x-3 pt-2">
                    <SecondaryButton onClick={onClose} disabled={isCopying}>キャンセル</SecondaryButton>
                    <PrimaryButton onClick={handleCopy} disabled={!selectedMeasureId || isCopying}>
                        {isCopying ? 'コピー中...' : 'コピー実行'}
                    </PrimaryButton>
                </div>
            </div>
        </Modal>
    );
};
