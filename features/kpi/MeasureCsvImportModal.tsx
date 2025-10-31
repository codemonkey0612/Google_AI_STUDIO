import React, { useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { KpiMeasure, KpiMeasureColumn, KpiMeasureMaster, KpiMeasureRow } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { firestore, getCollectionPath } from '../../firebase';
import Modal from '../../components/Modal';
import { PrimaryButton, SecondaryButton } from '../../components/common/Buttons';
import { FileDownloadIcon } from '../../components/Icons';

export const MeasureCsvImportModal: React.FC<{
    measure: KpiMeasure,
    customColumns: (KpiMeasureColumn | KpiMeasureMaster['columns'][0])[],
    kpiColumns: (KpiMeasureColumn | KpiMeasureMaster['columns'][0])[],
    rows: KpiMeasureRow[],
    onClose: () => void,
    parentRowContext?: { parentMeasureId: string; parentRowId: string; };
}> = ({ measure, customColumns, kpiColumns, rows, onClose, parentRowContext }) => {
    const { currentUser } = useAuth();
    const { projectId, recordId } = useParams<{ projectId: string, recordId: string }>();
    const [file, setFile] = useState<File | null>(null);
    const [status, setStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
    const [message, setMessage] = useState('');

    const escapeCsvCell = (cell: any): string => {
        const str = String(cell ?? '');
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
    };

    const handleDownloadTemplate = () => {
        const headers = ['itemName', ...customColumns.map(c => c.name), ...kpiColumns.map(c => c.name)];
        const dataRows = rows.map(row => {
            const rowData: any[] = [row.name];
            customColumns.forEach(col => rowData.push(row.values[col.id] ?? ''));
            kpiColumns.forEach(col => rowData.push(row.values[col.id] ?? ''));
            return rowData;
        });

        const csvContent = [headers, ...dataRows].map(row => row.map(escapeCsvCell).join(',')).join('\n');
        const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.setAttribute('download', `${measure.name}-template.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };
    
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setFile(e.target.files[0]);
            setStatus('idle');
            setMessage('');
        }
    };

    const handleImport = async () => {
        if (!file || !currentUser || !projectId || !recordId) return;
        setStatus('processing');
        setMessage('インポート処理中...');

        try {
            const text = await file.text();
            const csvRows = text.split('\n').map(row => row.trim()).filter(Boolean);
            if (csvRows.length < 2) throw new Error("CSVファイルにデータ行がありません。");
            
            const headerRow = csvRows[0].split(',');
            const allColumns = [...customColumns, ...kpiColumns];
            const colMap = new Map(allColumns.map(c => [c.name, c]));
            const rowMap = new Map(rows.map(r => [r.name, r]));
            
            const batch = firestore.batch();
            let updatedCount = 0;
            
            for (let i = 1; i < csvRows.length; i++) {
                const rowData = csvRows[i].split(',');
                const itemName = rowData[0];
                const existingRow = rowMap.get(itemName);
                
                if (existingRow) {
                    const newValues = { ...existingRow.values };
                    let hasChanged = false;
                    for (let j = 1; j < headerRow.length; j++) {
                        const colName = headerRow[j];
                        const col = colMap.get(colName);
                        if (col) {
                            const newValue = rowData[j] || '';
                            let parsedValue: string | number | null = newValue;
                            if (col.type === 'number' || col.type === 'kpi') {
                                parsedValue = parseFloat(newValue);
                                if (isNaN(parsedValue as number)) parsedValue = null;
                            }
                            if (newValues[col.id] !== parsedValue) {
                                newValues[col.id] = parsedValue;
                                hasChanged = true;
                            }
                        }
                    }
                    if (hasChanged) {
                        const rowDocRef = parentRowContext
                            ? firestore.doc(getCollectionPath.kpiMeasureRowSubMeasureRowDoc(currentUser.uid, projectId, recordId, parentRowContext.parentMeasureId, parentRowContext.parentRowId, measure.id, existingRow.id))
                            : firestore.doc(getCollectionPath.kpiMeasureRowDoc(currentUser.uid, projectId, recordId, measure.id, existingRow.id));
                        batch.update(rowDocRef, { values: newValues });
                        updatedCount++;
                    }
                }
            }
            
            await batch.commit();
            setStatus('success');
            setMessage(`インポート完了！ ${updatedCount}件の項目が更新されました。`);

        } catch (err: any) {
            setStatus('error');
            setMessage(`エラー: ${err.message}`);
            console.error(err);
        }
    };

    return (
        <Modal title={`「${measure.name}」データCSVインポート`} onClose={onClose} size="xl">
            <div className="space-y-6">
                 <div className="p-4 bg-slate-50 rounded-lg space-y-2">
                    <h4 className="font-semibold text-slate-800">ステップ1: テンプレートのダウンロード</h4>
                    <p className="text-sm text-slate-600">現在のテーブル構造に基づいたCSVテンプレートをダウンロードし、データを入力してください。</p>
                    <SecondaryButton icon={<FileDownloadIcon />} onClick={handleDownloadTemplate}>テンプレートをダウンロード</SecondaryButton>
                </div>
                <div className="p-4 bg-slate-50 rounded-lg space-y-2">
                    <h4 className="font-semibold text-slate-800">ステップ2: CSVファイルのアップロード</h4>
                    <p className="text-sm text-slate-600">入力済みのCSVファイルをアップロードしてください。`itemName`が一致する項目データのみが更新されます。</p>
                    <input type="file" accept=".csv" onChange={handleFileChange} className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-sky-50 file:text-sky-700 hover:file:bg-sky-100"/>
                </div>
                 {message && (
                    <div className={`p-3 rounded-md text-sm ${status === 'success' ? 'bg-green-100 text-green-800' : status === 'error' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}`}>
                        {message}
                    </div>
                )}
                <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                    <SecondaryButton onClick={onClose} disabled={status === 'processing'}>キャンセル</SecondaryButton>
                    <PrimaryButton onClick={handleImport} disabled={!file || status === 'processing'}>
                        {status === 'processing' ? '処理中...' : 'インポート実行'}
                    </PrimaryButton>
                </div>
            </div>
        </Modal>
    );
};
