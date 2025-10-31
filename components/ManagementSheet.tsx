import React, { useState } from 'react';
// FIX: Import BaseSheet and update props to use it, resolving type errors in ProjectDetailPage.
import { BaseSheet } from '../types';
import { ChevronDownIcon, EditIcon, TrashIcon, SaveIcon, CancelIcon, ContentCopyIcon, TodayIcon, ArrowUpwardIcon, ArrowDownwardIcon } from './Icons';
import { IconButton } from './common/Buttons';

interface ManagementSheetProps {
  sheet: BaseSheet;
  onUpdateName: (id: string, newName: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onDuplicate: (sheet: BaseSheet) => void;
  onEditDetails?: (sheet: BaseSheet) => void;
  children: React.ReactNode;
  onMove?: (id: string, direction: 'up' | 'down') => void;
  isFirst?: boolean;
  isLast?: boolean;
}

export const ManagementSheet: React.FC<ManagementSheetProps> = ({ sheet, onUpdateName, onDelete, onDuplicate, onEditDetails, children, onMove, isFirst, isLast }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(sheet.name);

  const handleSaveName = async () => {
    if (editedName.trim() && editedName.trim() !== sheet.name) {
      await onUpdateName(sheet.id, editedName.trim());
    }
    setIsEditingName(false);
  };

  const handleCancelEdit = () => {
    setEditedName(sheet.name);
    setIsEditingName(false);
  };

  return (
    <div className="bg-white rounded-lg shadow-md border border-slate-200">
      <div className="flex justify-between items-center p-3 sm:p-4 bg-slate-50 rounded-t-lg border-b border-slate-200">
        <div className="flex items-center gap-2 flex-grow min-w-0">
          <IconButton onClick={() => setIsCollapsed(!isCollapsed)} aria-label={isCollapsed ? '展開' : '折りたたむ'}>
            <ChevronDownIcon className={`transition-transform duration-200 ${isCollapsed ? '-rotate-90' : ''}`} />
          </IconButton>
          {isEditingName ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                onBlur={handleSaveName}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleSaveName();
                  if (e.key === 'Escape') handleCancelEdit();
                }}
                className="text-lg font-semibold px-2 py-1 border border-slate-300 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500"
                autoFocus
              />
              <IconButton onClick={handleSaveName} aria-label="保存"><SaveIcon className="text-sky-600" /></IconButton>
              <IconButton onClick={handleCancelEdit} aria-label="キャンセル"><CancelIcon /></IconButton>
            </div>
          ) : (
            <h3 className="text-lg font-semibold text-slate-800 cursor-pointer truncate" onClick={() => setIsEditingName(true)} title={sheet.name}>
              {sheet.name}
            </h3>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {onMove && (
            <>
              <IconButton onClick={() => onMove(sheet.id, 'up')} disabled={isFirst} aria-label="上に移動"><ArrowUpwardIcon /></IconButton>
              <IconButton onClick={() => onMove(sheet.id, 'down')} disabled={isLast} aria-label="下に移動"><ArrowDownwardIcon /></IconButton>
            </>
          )}
          {onEditDetails && <IconButton onClick={() => onEditDetails(sheet)} aria-label="日付を編集"><TodayIcon /></IconButton>}
          <IconButton onClick={() => setIsEditingName(true)} aria-label="名前を編集"><EditIcon /></IconButton>
          <IconButton onClick={() => onDuplicate(sheet)} aria-label="シートを複製"><ContentCopyIcon /></IconButton>
          <IconButton onClick={() => onDelete(sheet.id)} className="hover:text-red-500" aria-label="シートを削除"><TrashIcon /></IconButton>
        </div>
      </div>
      {!isCollapsed && (
        <div className="p-0">
          {children}
        </div>
      )}
    </div>
  );
};
