import React, { useState } from 'react';
import Modal from '../../components/Modal';
import { PrimaryButton, SecondaryButton } from '../../components/common/Buttons';

export const RegisterMasterModal: React.FC<{
    onRegister: (masterName: string) => Promise<void>;
    onClose: () => void;
}> = ({ onRegister, onClose }) => {
    const [name, setName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) {
            setError("マスター名は必須です。");
            return;
        }
        setLoading(true);
        setError('');
        try {
            await onRegister(name.trim());
        } catch (err: any) {
            setError(err.message || "マスターの登録に失敗しました。");
            setLoading(false);
        }
    };
    
    return (
        <Modal title="マスターとして登録" onClose={onClose}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <p className="text-sm text-slate-600">現在のテーブルの列構成を新しいマスターとして保存します。他の施策で再利用できるようになります。</p>
                <div>
                    <label htmlFor="master-name" className="block text-sm font-medium text-slate-700 mb-1">
                        マスター名
                    </label>
                    <input
                        id="master-name"
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        className="block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                        placeholder="例: 標準広告施策テンプレート"
                    />
                </div>
                {error && <p className="text-sm text-red-600">{error}</p>}
                <div className="flex justify-end space-x-3 pt-2">
                    <SecondaryButton type="button" onClick={onClose} disabled={loading}>キャンセル</SecondaryButton>
                    <PrimaryButton type="submit" disabled={loading}>
                        {loading ? "登録中..." : "登録"}
                    </PrimaryButton>
                </div>
            </form>
        </Modal>
    );
};
