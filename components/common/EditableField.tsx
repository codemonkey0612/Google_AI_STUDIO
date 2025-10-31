import React, { useState, useEffect } from 'react';
import { formatDate, formatKpiNumber } from '../../utils';

export interface EditableFieldProps<T> {
  value: T;
  onChange: (value: T) => void;
  isEditing: boolean;
  inputType?: 'text' | 'number' | 'date' | 'textarea' | 'select' | 'color';
  selectOptions?: Array<{ value: string | number; label: string }>;
  placeholder?: string;
  className?: string; 
  inputClassName?: string; 
  multiline?: boolean;
  numericMin?: number;
  numericStep?: number;
  prefix?: string;
  suffix?: string;
  disabled?: boolean;
  label?: string; 
  onBlur?: (event: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  inputRef?: React.RefObject<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>;
  readOnly?: boolean; 
  textColorClass?: string;
  truncateLength?: number;
  emptyNumericIs?: 'zero' | 'null';
}

export const EditableField = <T extends string | number | null>({
  value: propValue,
  onChange,
  isEditing,
  inputType = 'text',
  selectOptions,
  placeholder,
  className = '', 
  inputClassName: customInputClassName = 'w-full',
  multiline = false,
  numericMin,
  numericStep,
  prefix,
  suffix,
  disabled = false,
  label,
  onBlur,
  inputRef,
  readOnly = false,
  textColorClass,
  truncateLength,
  emptyNumericIs = 'zero',
}: EditableFieldProps<T>) => {
  const [internalValue, setInternalValue] = useState<string>('');

  useEffect(() => {
    if (isEditing) {
      if (propValue === null || propValue === undefined || (typeof propValue === 'number' && isNaN(propValue))) {
        setInternalValue('');
      } else {
        setInternalValue(String(propValue));
      }
    }
  }, [propValue, isEditing]);


  const baseInputClasses = "px-2 py-1 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500 text-xs";
  
  if (!isEditing || readOnly) {
    // FIX: Cannot find namespace 'JSX'. Changed to React.ReactNode.
    let displayContent: React.ReactNode;

    if (inputType === 'color' && typeof propValue === 'string') {
        return (
             <span className={`py-1 inline-flex items-center gap-2 ${className}`}>
                <span style={{ backgroundColor: propValue }} className="w-4 h-4 rounded border border-slate-400"></span>
                <span className={textColorClass || ''}>{propValue}</span>
            </span>
        );
    } else if (propValue === undefined || propValue === null || propValue === '' || (typeof propValue === 'number' && isNaN(propValue))) {
        if (inputType === 'date' || inputType === 'number') {
            return <span className="text-slate-400">-</span>;
        }
        displayContent = <span className="text-slate-400">{placeholder || (readOnly && isEditing ? '自動算出' : 'N/A')}</span>;
    } else if (inputType === 'date') {
        displayContent = formatDate(propValue as string, 'yyyy/MM/dd');
    } else if (typeof propValue === 'number' && inputType === 'number') {
        displayContent = formatKpiNumber(propValue);
    } else {
        if (truncateLength && typeof propValue === 'string' && propValue.length > truncateLength) {
            displayContent = propValue.substring(0, truncateLength) + '...';
        } else {
            displayContent = propValue;
        }
    }
    
    return ( 
      <span className={`py-1 ${className} ${readOnly && isEditing ? 'bg-slate-100 px-2 rounded' : ''} ${textColorClass || ''}`} title={typeof propValue === 'string' || typeof propValue === 'number' ? String(propValue) : undefined}>
        {prefix && <span className="mr-1 text-slate-500">{prefix}</span>}
        {displayContent}
        {suffix && <span className="ml-1 text-slate-500">{suffix}</span>}
      </span>
    );
  }

  const handleInternalChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const targetValue = e.target.value;
    if (inputType === 'number') {
      if (/^-?\d*\.?\d*$/.test(targetValue) || targetValue === '' || targetValue === '-') {
        setInternalValue(targetValue);
      }
    } else {
      setInternalValue(targetValue);
      onChange(targetValue as T);
    }
  };

  const handleInternalBlur = (event: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    if (inputType === 'number') {
        if (internalValue.trim() === '' || internalValue.trim() === '-') {
            onChange(emptyNumericIs === 'null' ? (null as T) : (0 as T));
        } else {
            const parsed = parseFloat(internalValue);
            onChange(isNaN(parsed) ? (emptyNumericIs === 'null' ? (null as T) : (0 as T)) : (parsed as T));
        }
    }
    if (onBlur) {
        onBlur(event);
    }
  };

  const commonProps = {
    value: internalValue,
    onChange: handleInternalChange,
    onBlur: handleInternalBlur,
    placeholder,
    disabled,
    'aria-label': label || placeholder || 'editable field',
    ref: inputRef as any,
    className: `${baseInputClasses} ${customInputClassName} ${inputType === 'color' ? 'p-0 h-8 w-16' : ''}`
  };

  if (inputType === 'select' && selectOptions) {
    return (
      <select {...commonProps}>
        {selectOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
      </select>
    );
  }

  if (multiline || inputType === 'textarea') {
    return <textarea {...commonProps} rows={2} />;
  }
  
  return (
      <div className={`flex items-center ${className}`}>
        {prefix && <span className="mr-1 text-slate-500">{prefix}</span>}
        <input
          type={inputType === 'number' ? 'text' : inputType}
          inputMode={inputType === 'number' ? 'decimal' : undefined}
          min={inputType === 'number' ? numericMin : undefined}
          step={inputType === 'number' ? numericStep : undefined}
          {...commonProps}
        />
        {suffix && <span className="ml-1 text-slate-500">{suffix}</span>}
      </div>
  );
};
