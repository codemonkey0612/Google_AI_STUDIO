import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Project, KpiMeasureColumn, KpiMeasureMaster, KpiMeasureRow } from '../../types';
import { EditableField } from '../../components/common/EditableField';
import { ImageUploadField, ComparisonDisplay } from './KpiComponents';
import { IconButton } from '../../components/common/Buttons';
import { SaveIcon, CancelIcon, EditIcon, TrashIcon, DragHandleIcon } from '../../components/Icons';
import { formatKpiNumber } from '@/utils';

export const MeasureRow: React.FC<{
    row: KpiMeasureRow,
    measureId: string;
    customColumns: (KpiMeasureColumn | KpiMeasureMaster['columns'][0])[],
    kpiColumns: (KpiMeasureColumn | KpiMeasureMaster['columns'][0])[],
    project: Project,
    isEditing: boolean,
    onStartEdit: () => void,
    onCancelEdit: () => void,
    onUpdate: (rowId: string, newValues: Record<string, any>) => Promise<void>,
    onDelete: (rowId: string) => void,
    prevMonthData: { rows: Map<string, KpiMeasureRow>; columns: (KpiMeasureColumn | KpiMeasureMaster['columns'][0])[] } | null;
    lastYearData: { rows: Map<string, KpiMeasureRow>; columns: (KpiMeasureColumn | KpiMeasureMaster['columns'][0])[] } | null;
    isMasterLinked: boolean;
    visibleComparisons: Record<string, { prevMonth: boolean, lastYear: boolean }>;
    canDrag: boolean;
    onDragStart: (e: React.DragEvent) => void;
    onDragEnter: (e: React.DragEvent) => void;
    onDragEnd: (e: React.DragEvent) => void;
    onDragOver: (e: React.DragEvent) => void;
}> = ({ row, measureId, customColumns, kpiColumns, project, isEditing, onStartEdit, onCancelEdit, onUpdate, onDelete, prevMonthData, lastYearData, isMasterLinked, visibleComparisons, canDrag, onDragStart, onDragEnter, onDragEnd, onDragOver }) => {
    const [editedData, setEditedData] = useState<KpiMeasureRow>(row);
    const { clientId, projectId, recordId } = useParams<{ clientId: string; projectId: string; recordId: string; }>();

    useEffect(() => {
        setEditedData(row);
    }, [row, isEditing]);

    const handleValueChange = (columnId: string, value: string | number | null) => {
        setEditedData(prev => ({
            ...prev,
            values: {
                ...prev.values,
                [columnId]: value
            }
        }));
    };
    
    const handleNameChange = (name: string) => {
        setEditedData(prev => ({...prev, name }));
    };

    const handleSave = async () => {
        const updates: Record<string, any> = {};
        if (editedData.name !== row.name) {
            updates.name = editedData.name;
        }
        if (JSON.stringify(editedData.values) !== JSON.stringify(row.values)) {
            updates.values = editedData.values;
        }
    
        if (Object.keys(updates).length > 0) {
            try {
                await onUpdate(row.id, updates);
                // On success, the parent component will set isEditing to false.
            } catch (error) {
                // Error is handled and displayed by the parent component.
                console.error("Update failed in MeasureRow:", error);
            }
        } else {
            // No changes, just exit editing mode.
            onCancelEdit();
        }
    };
    
    const handleCancel = () => {
        setEditedData(row);
        onCancelEdit();
    };

    const getComparisonValue = (
        comparisonData: { rows: Map<string, KpiMeasureRow>; columns: (KpiMeasureColumn | KpiMeasureMaster['columns'][0])[] } | null,
        currentCol: (KpiMeasureColumn | KpiMeasureMaster['columns'][0])
    ): number | null => {
        if (!comparisonData) return null;

        // When master is linked, only match by masterRowId
        if (isMasterLinked) {
            if (!row.masterRowId) return null;
            const comparisonRow = comparisonData.rows.get(row.masterRowId);
            if (!comparisonRow) return null;
            
            // Find column by master column id
            const comparisonCol = comparisonData.columns.find(c => c.id === currentCol.id);
            if (!comparisonCol) return null;

            const value = comparisonRow.values[comparisonCol.id];
            return typeof value === 'number' ? value : null;
        }

        // When not master linked, match by name
        const comparisonRow = comparisonData.rows.get(row.name);
        if (!comparisonRow) return null;

        // Find column by name and type
        const comparisonCol = comparisonData.columns.find(c => c.name === currentCol.name && c.type === 'kpi');
        if (!comparisonCol) return null;

        const value = comparisonRow.values[comparisonCol.id];
        return typeof value === 'number' ? value : null;
    };
    
    const detailUrl = `/clients/${clientId}/projects/${projectId}/kpi/${recordId}/measure/${measureId}/row/${row.id}`;

    const nameField = (
        <EditableField
            isEditing={isEditing && !isMasterLinked}
            value={editedData.name}
            onChange={(val) => handleNameChange(val as string)}
            placeholder="項目名"
            readOnly={isMasterLinked}
        />
    );
    
    return (
        <tr 
            className={`group ${isEditing ? 'bg-sky-50' : 'hover:bg-slate-50'}`}
            draggable={canDrag}
            onDragStart={onDragStart}
            onDragEnter={onDragEnter}
            onDragEnd={onDragEnd}
            onDragOver={onDragOver}
        >
            <td 
                className="p-2 border-b border-l border-slate-200 align-top whitespace-nowrap"
            >
                <div className="flex items-center gap-1">
                    {canDrag && <span className="cursor-grab text-slate-400"><DragHandleIcon /></span>}
                    {isEditing && !isMasterLinked ? (
                        nameField
                    ) : (
                        <Link to={detailUrl} className="hover:underline text-sky-700 font-medium block w-full truncate" title={editedData.name}>
                            {editedData.name}
                        </Link>
                    )}
                </div>
            </td>

            {customColumns.map(col => {
                const currentValue = editedData.values?.[col.id] ?? null;
                const editableField = (
                    <EditableField<string | number | null>
                        isEditing={isEditing}
                        value={currentValue ?? null}
                        onChange={val => handleValueChange(col.id, val)}
                        inputType={col.type === 'number' ? 'number' : col.type === 'date' ? 'date' : 'text'}
                        placeholder="-"
                        multiline={col.type === 'text'}
                        inputClassName={col.type === 'text' ? "w-full" : undefined}
                        truncateLength={col.type === 'text' ? 40 : undefined}
                        emptyNumericIs={col.type === 'number' ? 'null' : undefined}
                    />
                );

                return (
                    <td key={col.id} className="p-2 border-b border-l border-slate-200 align-top">
                        {col.type === 'image' ? (
                            <ImageUploadField 
                                isEditing={isEditing}
                                value={(currentValue as string) || ''}
                                onChange={url => handleValueChange(col.id, url)}
                                project={project}
                            />
                        ) : (
                           editableField
                        )}
                    </td>
                );
            })}

            {kpiColumns.map(col => {
                const currentValue = editedData.values?.[col.id] ?? null;
                 const prevMonthValue = getComparisonValue(prevMonthData, col);
                 const lastYearValue = getComparisonValue(lastYearData, col);

                 const currentNumericValue = typeof currentValue === 'number' ? currentValue : null;
                 const prevMonthDiff = (currentNumericValue !== null && prevMonthValue !== null) ? currentNumericValue - prevMonthValue : null;
                 const lastYearDiff = (currentNumericValue !== null && lastYearValue !== null) ? currentNumericValue - lastYearValue : null;
                
                 const isPrevMonthVisible = visibleComparisons[col.id]?.prevMonth ?? true;
                 const isLastYearVisible = visibleComparisons[col.id]?.lastYear ?? true;
                
                 return (
                     <React.Fragment key={col.id}>
                        <td className="p-2 border-b border-l border-slate-200 text-right align-top">
                            <EditableField<number | null>
                                isEditing={isEditing}
                                value={currentNumericValue ?? null}
                                onChange={(val) => handleValueChange(col.id, val)}
                                inputType="number"
                                inputClassName="w-24 text-right"
                                placeholder="-"
                                emptyNumericIs="null"
                            />
                        </td>
                        {isPrevMonthVisible && (
                            <td className="p-2 border-b border-slate-200 text-right align-top">
                                <ComparisonDisplay value={prevMonthDiff} baseValue={prevMonthValue} />
                            </td>
                        )}
                        {isLastYearVisible && (
                            <td className="p-2 border-b border-slate-200 text-right align-top">
                                {lastYearValue !== null ? <span>{formatKpiNumber(lastYearValue)}</span> : <span className="text-slate-400">-</span>}
                            </td>
                        )}
                        {isLastYearVisible && (
                            <td className="p-2 border-b border-r border-slate-200 text-right align-top">
                                <ComparisonDisplay value={lastYearDiff} baseValue={lastYearValue} />
                            </td>
                        )}
                     </React.Fragment>
                 )
            })}

             <td className="p-2 border-b border-r border-slate-200 align-middle">
                <div className="flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    {isEditing ? (
                        <>
                            <IconButton onClick={handleSave} aria-label="保存"><SaveIcon className="text-sky-600"/></IconButton>
                            <IconButton onClick={handleCancel} aria-label="キャンセル"><CancelIcon /></IconButton>
                        </>
                    ) : (
                        <>
                            <IconButton onClick={onStartEdit} aria-label="編集"><EditIcon/></IconButton>
                            {!isMasterLinked && <IconButton onClick={() => onDelete(row.id)} className="hover:text-red-500" aria-label="削除"><TrashIcon/></IconButton>}
                        </>
                    )}
                </div>
            </td>
        </tr>
    );
};
