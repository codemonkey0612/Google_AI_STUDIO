import React, { useState, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { storage } from '../../firebase';
import { Project } from '../../types';
import { SecondaryButton } from '../../components/common/Buttons';
import { CloudUploadIcon, ArrowUpwardIcon, ArrowDownwardIcon } from '../../components/Icons';
import { formatKpiNumber } from '../../utils';

export const ComparisonDisplay: React.FC<{ value: number | null | undefined, baseValue: number | null | undefined, showSign?: boolean, showParens?: boolean }> = ({ value, baseValue, showSign = true, showParens = true }) => {
    if (value === null || value === undefined || isNaN(value)) {
        return <span className="text-slate-400">-</span>;
    }
    const isPositive = value > 0;
    const isNegative = value < 0;
    const colorClass = isPositive ? 'text-green-600' : isNegative ? 'text-red-600' : 'text-slate-500';
    const formattedValue = formatKpiNumber(Math.abs(value));

    let percentage: number | null = null;
    if(baseValue !== null && baseValue !== undefined && Math.abs(baseValue) > 0) {
        percentage = (value / baseValue) * 100;
    }
    
    return (
        <div className="flex flex-col items-end">
            <span className={`flex items-center justify-end gap-1 font-medium ${colorClass}`}>
              {isPositive && <ArrowUpwardIcon className="text-xs" />}
              {isNegative && <ArrowDownwardIcon className="text-xs" />}
              {showSign && (isPositive ? '+' : isNegative ? '−' : '')}
              {formattedValue}
            </span>
            {percentage !== null && !isNaN(percentage) && (
                 <span className={`text-xs mt-0.5 ${colorClass}`}>
                    {showParens && '('}{formatKpiNumber(percentage)}%{showParens && ')'}
                 </span>
            )}
        </div>
    );
};

export const ImageUploadField: React.FC<{
    value: string;
    onChange: (url: string) => void;
    project: Project;
    isEditing?: boolean;
}> = ({ value, onChange, project, isEditing = true }) => {
    const { currentUser } = useAuth();
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState<string|null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            handleUpload(file);
        }
        e.target.value = ''; // Reset file input to allow re-selecting the same file
    };

    const handleUpload = (file: File) => {
        if (!currentUser || !project) {
            setError("ユーザー認証またはプロジェクト情報がありません。");
            return;
        }
        setUploading(true);
        setProgress(0);
        setError(null);

        const fileId = `${Date.now()}-${file.name}`;
        const storagePath = `users/${currentUser.uid}/kpiImages/${project.id}/${fileId}`;

        const storageRef = storage.ref(storagePath);
        const uploadTask = storageRef.put(file);

        uploadTask.on('state_changed',
            (snapshot) => { // Progress
                const prog = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
                setProgress(prog);
            },
            (error: any) => { // Error
                console.error("Firebase Storage Upload Error:", error);
                let message = "アップロードに失敗しました。";
                switch (error.code) {
                    case 'storage/unauthorized':
                        message = "権限がありません。FirebaseコンソールでStorageのルールを確認してください。";
                        break;
                    case 'storage/canceled':
                        message = "アップロードがキャンセルされました。";
                        break;
                    case 'storage/unknown':
                        message = "不明なエラーです。Cloud StorageのCORS設定が正しいか確認してください。";
                        break;
                    default:
                        message = `予期せぬエラーが発生しました: ${error.message}`;
                }
                setError(message);
                setUploading(false);
            },
            async () => { // Complete
                try {
                    const downloadURL = await uploadTask.snapshot.ref.getDownloadURL();
                    onChange(downloadURL);
                } catch (e: any) {
                    console.error("Error getting download URL:", e);
                    setError("URLの取得に失敗しました。");
                } finally {
                    setUploading(false);
                }
            }
        );
    };

    if (!isEditing) {
        return value ? <img src={value} alt="プレビュー" className="w-24 h-24 object-cover rounded-md" /> : <span className="text-slate-400">-</span>;
    }

    return (
        <div className="w-24">
            {value && !uploading && <img src={value} alt="プレビュー" className="w-24 h-24 object-cover rounded-md mb-2" />}
            
            {uploading && (
                <div className="w-24 h-24 flex flex-col items-center justify-center bg-slate-100 rounded-md mb-2">
                    <div className="w-full bg-slate-200 rounded-full h-2.5 mx-2">
                        <div className="bg-sky-600 h-2.5 rounded-full" style={{ width: `${progress}%` }}></div>
                    </div>
                    <span className="text-xs mt-2">{progress}%</span>
                </div>
            )}
            
            {!uploading && (
                 <SecondaryButton 
                    type="button" 
                    onClick={() => fileInputRef.current?.click()} 
                    icon={<CloudUploadIcon />}
                    size="sm"
                    className="text-xs px-2 py-1 w-full justify-center"
                >
                    {value ? '変更' : 'アップロード'}
                </SecondaryButton>
            )}

            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                accept="image/*"
                className="hidden"
                disabled={uploading}
            />
            {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
        </div>
    );
};
