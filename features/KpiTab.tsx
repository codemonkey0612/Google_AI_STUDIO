



import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Project, KpiItem, KpiRecord, KpiCustomColumn, KpiSheet } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { firestore, getCollectionPath, firebase, storage } from '../firebase';
import Modal from '../components/Modal';
import { PlusIcon, SaveIcon, CancelIcon, TrashIcon, EditIcon, CogIcon, CloudUploadIcon, ArrowUpwardIcon, ArrowDownwardIcon, TableViewIcon, ShowChartIcon, BarChartIcon, FilterListIcon, FileDownloadIcon, ContentCopyIcon } from '../components/Icons';
import { PrimaryButton, SecondaryButton, IconButton } from '../components/common/Buttons';
import { EditableField } from '../components/common/EditableField';
import { hexToRgba, formatDate, formatKpiNumber } from '../../utils';
import { ComparisonDisplay, ImageUploadField } from './kpi/KpiComponents';

const CHART_COLORS = [
    '#0284c7', // sky-700
    '#059669', // emerald-600
    '#6d28d9', // violet-700
    '#c026d3', // fuchsia-600
    '#db2777', // pink-600
    '#e11d48', // rose-600
    '#d97706', // amber-600
];

const KpiChartPanel: React.FC<{ items: KpiItem[], records: KpiRecord[] }> = ({ items, records }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const chartRef = useRef<any>(null); // Using 'any' for Chart.js instance

    const [visibleKpiIds, setVisibleKpiIds] = useState<Set<string>>(() => new Set(items.slice(0, 5).map(i => i.id)));

    const handleToggleKpi = (itemId: string) => {
        setVisibleKpiIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(itemId)) {
                newSet.delete(itemId);
            } else {
                newSet.add(itemId);
            }
            return newSet;
        });
    };

    const monthlyRecords = useMemo(() => {
        return records
            .filter(r => /^\d{4}年\d{1,2}月$/.test(r.periodLabel))
            .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
    }, [records]);


    useEffect(() => {
        if (!canvasRef.current || monthlyRecords.length < 2) {
             if(chartRef.current) {
                chartRef.current.destroy();
                chartRef.current = null;
             }
             return;
        }

        const ctx = canvasRef.current.getContext('2d');
        if (!ctx) return;
        
        if (chartRef.current) {
            chartRef.current.destroy();
        }

        const labels = monthlyRecords.map(r => r.periodLabel);
        const datasets = items
            .filter(item => visibleKpiIds.has(item.id))
            .map((item, index) => ({
                label: item.name,
                data: monthlyRecords.map(record => record.values[item.id] ?? null),
                borderColor: CHART_COLORS[index % CHART_COLORS.length],
                backgroundColor: hexToRgba(CHART_COLORS[index % CHART_COLORS.length], 0.1),
                tension: 0.1,
                fill: false,
                pointRadius: 4,
                pointHoverRadius: 6,
            }));

        chartRef.current = new (window as any).Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets,
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                    },
                },
                scales: {
                    x: {
                        display: true,
                        title: {
                            display: true,
                            text: '期間'
                        },
                        ticks: {
                            callback: function(value: any, index: any, ticks: any) {
                                const label = this.getLabelForValue(value);
                                if (!label) return '';
                                
                                const prevLabel = index > 0 ? this.getLabelForValue(ticks[index - 1].value) : null;
                                
                                const currentYear = label.substring(0, 4);
                                const prevYear = prevLabel ? prevLabel.substring(0, 4) : null;
    
                                if (index === 0 || currentYear !== prevYear) {
                                    return label; // e.g., "2024年5月"
                                } else {
                                    const monthPart = label.match(/(\d{1,2}月)/);
                                    return monthPart ? monthPart[1] : label; // e.g., "6月"
                                }
                            }
                        }
                    },
                    y: {
                        display: true,
                        title: {
                            display: true,
                            text: '値'
                        },
                        beginAtZero: true
                    }
                }
            },
        });
        
        return () => {
            if (chartRef.current) {
                chartRef.current.destroy();
                chartRef.current = null;
            }
        };
    }, [items, monthlyRecords, visibleKpiIds]);
    
    if (items.length === 0) return null;

    return (
        <div className="border border-slate-200 p-4 rounded-lg bg-slate-50">
            <h4 className="text-lg font-semibold text-slate-700 mb-4 flex items-center gap-2"><ShowChartIcon />KPIトレンドグラフ</h4>
            <div className="mb-4 flex flex-wrap gap-x-4 gap-y-2">
                {items.map(item => (
                    <label key={item.id} className="flex items-center space-x-2 cursor-pointer text-sm">
                        <input
                            type="checkbox"
                            checked={visibleKpiIds.has(item.id)}
                            onChange={() => handleToggleKpi(item.id)}
                            className="h-4 w-4 text-sky-600 border-slate-300 rounded focus:ring-sky-500"
                        />
                        <span className="text-slate-700">{item.name}</span>
                    </label>
                ))}
            </div>
            <div className="relative h-80">
                {monthlyRecords.length < 2 ? (
                    <div className="flex items-center justify-center h-full bg-slate-100 rounded-md">
                        <p className="text-slate-500">グラフを表示するには、月次のKPIレコードが2つ以上必要です。</p>
                    </div>
                ) : (
                    <canvas ref={canvasRef}></canvas>
                )}
            </div>
        </div>
    );
};

interface KpiManagementTabProps {
  project: Project;
  sheet: KpiSheet;
  initialKpiItems: KpiItem[];
  initialKpiRecords: KpiRecord[];
  initialKpiCustomColumns: KpiCustomColumn[];
}

const KpiManagementTab: React.FC<KpiManagementTabProps> = ({ project, sheet, initialKpiItems, initialKpiRecords, initialKpiCustomColumns }) => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  const [kpiItems, setKpiItems] = useState<KpiItem[]>(initialKpiItems);
  const [kpiRecords, setKpiRecords] = useState<KpiRecord[]>(initialKpiRecords);
  const [kpiCustomColumns, setKpiCustomColumns] = useState<KpiCustomColumn[]>(initialKpiCustomColumns);

  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [editingRecordData, setEditingRecordData] = useState<KpiRecord | null>(null);

  const [showAddModal, setShowAddModal] = useState(false);
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [showKpiSettingsModal, setShowKpiSettingsModal] = useState(false);
  const [showColumnSettingsModal, setShowColumnSettingsModal] = useState(false);
  const [showCsvImportModal, setShowCsvImportModal] = useState(false);
  
  const [showVisibilityFilter, setShowVisibilityFilter] = useState(false);
  const [visibleComparisons, setVisibleComparisons] = useState<Record<string, { prevMonth: boolean; lastYear: boolean }>>(() => {
    const saved = sheet.viewPreferences?.visibleComparisons || {};
    const newState: Record<string, { prevMonth: boolean; lastYear:boolean }> = {};
    initialKpiItems.forEach(item => {
        newState[item.id] = saved[item.id] ?? { prevMonth: true, lastYear: true };
    });
    return newState;
  });
  const [activeKpiFilter, setActiveKpiFilter] = useState<string | null>(null);

  const [filterType, setFilterType] = useState<'range' | 'month'>('month');
  const [filterStartDate, setFilterStartDate] = useState<string | null>(() => sheet.viewPreferences?.filters?.startDate || null);
  const [filterEndDate, setFilterEndDate] = useState<string | null>(() => sheet.viewPreferences?.filters?.endDate || null);
  const [filterStartMonth, setFilterStartMonth] = useState<string | null>(() => sheet.viewPreferences?.filters?.startMonth || null);
  const [filterEndMonth, setFilterEndMonth] = useState<string | null>(() => sheet.viewPreferences?.filters?.endMonth || null);

  const [tempFilterStart, setTempFilterStart] = useState(() => sheet.viewPreferences?.filters?.startDate || '');
  const [tempFilterEnd, setTempFilterEnd] = useState(() => sheet.viewPreferences?.filters?.endDate || '');
  const [tempFilterStartMonth, setTempFilterStartMonth] = useState(() => sheet.viewPreferences?.filters?.startMonth || '');
  const [tempFilterEndMonth, setTempFilterEndMonth] = useState(() => sheet.viewPreferences?.filters?.endMonth || '');

  const [isSavingView, setIsSavingView] = useState(false);

  useEffect(() => setKpiItems(initialKpiItems), [initialKpiItems]);
  useEffect(() => setKpiRecords(initialKpiRecords), [initialKpiRecords]);
  useEffect(() => setKpiCustomColumns(initialKpiCustomColumns), [initialKpiCustomColumns]);
  
  useEffect(() => {
    setVisibleComparisons(prev => {
        const newState = { ...prev };
        let hasChanged = false;
        initialKpiItems.forEach(item => {
            if (!newState[item.id]) {
                newState[item.id] = { prevMonth: true, lastYear: true };
                hasChanged = true;
            }
        });
        return hasChanged ? newState : prev;
    });
  }, [initialKpiItems]);

  const handleApplyFilter = () => {
    if (filterType === 'range') {
        setFilterStartDate(tempFilterStart || null);
        setFilterEndDate(tempFilterEnd || null);
        setFilterStartMonth(null);
        setFilterEndMonth(null);
    } else { // month
        setFilterStartMonth(tempFilterStartMonth || null);
        setFilterEndMonth(tempFilterEndMonth || null);
        setFilterStartDate(null);
        setFilterEndDate(null);
    }
  };

  const handleResetFilter = () => {
      setFilterType('month');
      setTempFilterStart('');
      setTempFilterEnd('');
      setTempFilterStartMonth('');
      setTempFilterEndMonth('');
      setFilterStartDate(null);
      setFilterEndDate(null);
      setFilterStartMonth(null);
      setFilterEndMonth(null);
  };

  const filteredRecords = useMemo(() => {
    let recordsToFilter = [...kpiRecords];

    if (filterStartMonth || filterEndMonth) {
        recordsToFilter = recordsToFilter.filter(record => {
            const match = record.periodLabel.match(/(\d{4})年(\d{1,2})月/);
            if (!match) return false; // Only filter monthly records with this filter
            
            const recordMonthKey = `${match[1]}-${String(match[2]).padStart(2, '0')}`;
            
            const isAfterStart = !filterStartMonth || recordMonthKey >= filterStartMonth;
            const isBeforeEnd = !filterEndMonth || recordMonthKey <= filterEndMonth;
            
            return isAfterStart && isBeforeEnd;
        });
    } else if (filterStartDate || filterEndDate) {
        recordsToFilter = recordsToFilter.filter(record => {
            const isAfterStart = !filterStartDate || record.startDate >= filterStartDate;
            const isBeforeEnd = !filterEndDate || record.endDate <= filterEndDate;
            return isAfterStart && isBeforeEnd;
        });
    }
    
    // Sort records by start date in descending order (newest first)
    return recordsToFilter.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
  }, [kpiRecords, filterStartDate, filterEndDate, filterStartMonth, filterEndMonth]);


  const handleVisibilityChange = (itemId: string, type: 'prevMonth' | 'lastYear', isVisible: boolean) => {
    setVisibleComparisons(prev => ({
        ...prev,
        [itemId]: {
            ...(prev[itemId] || { prevMonth: true, lastYear: true }),
            [type]: isVisible,
        }
    }));
  };

  const handleSaveView = async () => {
    if (!currentUser) return;
    setIsSavingView(true);
    setError(null);
    try {
      const sheetDocRef = firestore.doc(getCollectionPath.kpiSheetDoc(currentUser.uid, project.id, sheet.id));
      const filters = {
        type: filterType,
        startDate: filterStartDate,
        endDate: filterEndDate,
        startMonth: filterStartMonth,
        endMonth: filterEndMonth,
      };
      await sheetDocRef.update({
        'viewPreferences.visibleComparisons': visibleComparisons,
        'viewPreferences.filters': filters,
      });
    } catch (err) {
      console.error("Failed to save view preferences:", err);
      setError("ビュー設定の保存に失敗しました。");
    } finally {
      setIsSavingView(false);
    }
  };

  const monthlyRecordsMap = useMemo(() => {
    const map = new Map<string, KpiRecord>();
    kpiRecords.forEach(record => {
      const match = record.periodLabel.match(/(\d{4})年(\d{1,2})月/);
      if (match) {
        const year = parseInt(match[1], 10);
        const month = parseInt(match[2], 10);
        const key = `${year}-${String(month).padStart(2, '0')}`;
        map.set(key, record);
      }
    });
    return map;
  }, [kpiRecords]);

  const visibleCustomColumns = useMemo(() => kpiCustomColumns.filter(c => c.isVisible).sort((a,b) => a.order - b.order), [kpiCustomColumns]);
  const sortedKpiItems = useMemo(() => [...kpiItems].sort((a,b) => a.order - b.order), [kpiItems]);

  const handleToggleColumnVisibility = async (columnId: string, isVisible: boolean) => {
    if (!currentUser) return;
    const colDocRef = firestore.doc(getCollectionPath.kpiCustomColumnDoc(currentUser.uid, project.id, columnId));
    await colDocRef.update({ isVisible });
  };
  
  const handleStartEdit = (record: KpiRecord) => {
    setEditingRecordId(record.id);
    setEditingRecordData(JSON.parse(JSON.stringify(record))); // Deep copy for editing
  };
  
  const handleCancelEdit = () => {
    setEditingRecordId(null);
    setEditingRecordData(null);
    setError(null);
  };

  const handleUpdateRecord = async () => {
    if (!currentUser || !editingRecordId || !editingRecordData) return;
    const { isEditing, ...dataToSave } = editingRecordData;
    const recordDocRef = firestore.doc(getCollectionPath.kpiRecordDoc(currentUser.uid, project.id, editingRecordId));
    try {
        await recordDocRef.update(dataToSave);
        handleCancelEdit();
    } catch(err) {
        console.error("Error updating KPI record:", err);
        setError("KPIレコードの更新に失敗しました。");
    }
  };
  
  const handleDeleteRecord = async (recordId: string) => {
      if(!currentUser || !window.confirm("この期間の記録を削除しますか？")) return;
      const recordDocRef = firestore.doc(getCollectionPath.kpiRecordDoc(currentUser.uid, project.id, recordId));
      await recordDocRef.delete();
  };

  const handleEditingValueChange = (kpiItemId: string, value: number | null) => {
    setEditingRecordData(prev => {
        if (!prev) return null;
        const newValues = { ...prev.values, [kpiItemId]: value };
        return { ...prev, values: newValues };
    });
  };

  const handleEditingCustomColumnChange = (columnId: string, value: string) => {
    setEditingRecordData(prev => {
        if (!prev) return null;
        const newCustomColumns = { ...prev.customColumns, [columnId]: value };
        return { ...prev, customColumns: newCustomColumns };
    });
  };

  const handleRecordClick = (record: KpiRecord) => {
    if (editingRecordId !== record.id) {
        navigate(`/clients/${project.clientId}/projects/${project.id}/kpi/${record.id}`);
    }
  };

  const totalKpiColSpan = sortedKpiItems.reduce((acc, item) => {
    const isPrevMonthVisible = visibleComparisons[item.id]?.prevMonth ?? true;
    const isLastYearVisible = visibleComparisons[item.id]?.lastYear ?? true;
    return acc + 1 + (isPrevMonthVisible ? 1 : 0) + (isLastYearVisible ? 2 : 0);
  }, 0);
  const emptyStateColSpan = 1 + visibleCustomColumns.length + totalKpiColSpan + 1;


  return (
    <div className="bg-white p-4 sm:p-6 space-y-6">
      <KpiChartPanel items={sortedKpiItems} records={filteredRecords} />
      
      <div className="border-b border-slate-200 pb-5">
        <h3 className="text-xl font-semibold text-slate-800 flex items-center gap-2">
            <BarChartIcon />
            KPIデータ
        </h3>
        <p className="mt-1 text-sm text-slate-600">
          プロジェクトの重要業績評価指標（KPI）を時系列で記録し、進捗を追跡します。
        </p>
      </div>
      
      {error && <p className="text-red-600 bg-red-100 p-3 rounded-md">{error}</p>}
      
      <div className="flex flex-wrap gap-4 justify-between items-center">
        <div className="flex gap-2">
           <PrimaryButton icon={<PlusIcon />} onClick={() => setShowAddModal(true)}>期間を追加</PrimaryButton>
           <PrimaryButton icon={<ContentCopyIcon />} onClick={() => setShowCopyModal(true)}>期間をコピー</PrimaryButton>
           <PrimaryButton icon={<CloudUploadIcon />} onClick={() => setShowCsvImportModal(true)}>CSVインポート</PrimaryButton>
        </div>
        <div className="flex flex-wrap gap-2 items-end">
            <div className="flex items-end gap-4 border border-slate-200 p-2 rounded-lg">
                <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">フィルター種別</label>
                    <div className="flex gap-4">
                         <label className="flex items-center text-sm"><input type="radio" name="filterType" value="month" checked={filterType === 'month'} onChange={() => setFilterType('month')} className="mr-1.5 h-4 w-4 text-sky-600 focus:ring-sky-500 border-slate-300"/>月指定</label>
                         <label className="flex items-center text-sm"><input type="radio" name="filterType" value="range" checked={filterType === 'range'} onChange={() => setFilterType('range')} className="mr-1.5 h-4 w-4 text-sky-600 focus:ring-sky-500 border-slate-300"/>期間指定</label>
                    </div>
                </div>

                {filterType === 'range' ? (
                    <div className="flex items-center gap-2">
                        <input id="kpi-filter-start" type="date" value={tempFilterStart} onChange={e => setTempFilterStart(e.target.value)} className="px-2 py-1.5 border border-slate-300 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500 text-sm"/>
                        <span className="text-slate-500">-</span>
                        <input id="kpi-filter-end" type="date" value={tempFilterEnd} onChange={e => setTempFilterEnd(e.target.value)} className="px-2 py-1.5 border border-slate-300 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500 text-sm"/>
                    </div>
                ) : (
                    <div className="flex items-center gap-2">
                        <input id="kpi-filter-start-month" type="month" value={tempFilterStartMonth} onChange={e => setTempFilterStartMonth(e.target.value)} className="px-2 py-1.5 border border-slate-300 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500 text-sm"/>
                        <span className="text-slate-500">-</span>
                        <input id="kpi-filter-end-month" type="month" value={tempFilterEndMonth} onChange={e => setTempFilterEndMonth(e.target.value)} className="px-2 py-1.5 border border-slate-300 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500 text-sm"/>
                    </div>
                )}
                
                <div className="flex items-center">
                    <SecondaryButton size="sm" onClick={handleApplyFilter} className="h-[33px]">適用</SecondaryButton>
                    <IconButton onClick={handleResetFilter} aria-label="フィルターをリセット"><CancelIcon/></IconButton>
                </div>
            </div>
           <SecondaryButton
                icon={<SaveIcon />}
                onClick={handleSaveView}
                disabled={isSavingView}
            >
                {isSavingView ? '保存中...' : '現在の表示を保存'}
            </SecondaryButton>
           <SecondaryButton icon={<CogIcon />} onClick={() => setShowKpiSettingsModal(true)}>KPI項目設定</SecondaryButton>
           <SecondaryButton icon={<TableViewIcon />} onClick={() => setShowColumnSettingsModal(true)}>カスタム列設定</SecondaryButton>
            <div className="relative">
                <IconButton aria-label="表示オプション" onClick={() => setShowVisibilityFilter(c => !c)}><FilterListIcon/></IconButton>
                {showVisibilityFilter && (
                    <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-md shadow-lg z-20 py-2 text-left" onMouseLeave={()=>setShowVisibilityFilter(false)}>
                        {kpiCustomColumns.length > 0 &&
                            <div className="px-4 py-2">
                                <p className="text-sm font-semibold text-slate-700">カスタム列表示</p>
                                <div className="mt-2 space-y-2 max-h-40 overflow-y-auto">
                                    {kpiCustomColumns.map(col => (
                                        <label key={col.id} className="flex items-center space-x-2 cursor-pointer">
                                            <input type="checkbox" checked={col.isVisible} onChange={(e) => handleToggleColumnVisibility(col.id, e.target.checked)} className="h-4 w-4 text-sky-600 border-slate-300 rounded focus:ring-sky-500" />
                                            <span className="text-sm text-slate-600 font-normal">{col.name}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        }
                    </div>
                )}
            </div>
        </div>
      </div>

      <div className="overflow-x-auto text-sm bg-white">
        <table className="min-w-full border-collapse">
            <thead className="bg-slate-50 text-slate-600">
                <tr>
                    <th rowSpan={2} className="p-3 text-left font-semibold border-b-2 border-slate-200 w-48 align-bottom whitespace-nowrap">期間</th>
                    {sortedKpiItems.map(item => {
                        const isPrevMonthVisible = visibleComparisons[item.id]?.prevMonth ?? true;
                        const isLastYearVisible = visibleComparisons[item.id]?.lastYear ?? true;
                        const kpiItemColSpan = 1 + (isPrevMonthVisible ? 1 : 0) + (isLastYearVisible ? 2 : 0);
                        return (
                            <th key={item.id} colSpan={kpiItemColSpan} className="p-2 text-center font-semibold border-b-2 border-l border-slate-200" title={item.description}>
                                <div className="flex items-center justify-center gap-1 relative">
                                    <span>{item.name}</span>
                                    <IconButton
                                        onClick={() => setActiveKpiFilter(activeKpiFilter === item.id ? null : item.id)}
                                        aria-label={`${item.name}の表示オプション`}
                                        className="p-0.5"
                                    >
                                        <FilterListIcon className="text-xs"/>
                                    </IconButton>
                                    {activeKpiFilter === item.id && (
                                        <div className="absolute top-full mt-2 right-0 w-40 bg-white border border-slate-200 rounded-md shadow-lg z-20 p-2 text-left" onMouseLeave={()=>setActiveKpiFilter(null)}>
                                            <p className="text-xs font-semibold text-slate-700 mb-2">表示設定</p>
                                            <div className="space-y-2">
                                                <label className="flex items-center space-x-2 cursor-pointer">
                                                    <input type="checkbox" checked={isPrevMonthVisible} onChange={e => handleVisibilityChange(item.id, 'prevMonth', e.target.checked)} className="h-4 w-4 text-sky-600 border-slate-300 rounded focus:ring-sky-500" />
                                                    <span className="text-sm font-normal text-slate-600">前月比</span>
                                                </label>
                                                <label className="flex items-center space-x-2 cursor-pointer">
                                                    <input type="checkbox" checked={isLastYearVisible} onChange={e => handleVisibilityChange(item.id, 'lastYear', e.target.checked)} className="h-4 w-4 text-sky-600 border-slate-300 rounded focus:ring-sky-500" />
                                                    <span className="text-sm font-normal text-slate-600">昨対比</span>
                                                </label>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </th>
                        );
                    })}
                    {visibleCustomColumns.map(col => (
                        <th key={col.id} rowSpan={2} className="p-3 text-left font-semibold border-b-2 border-l border-slate-200 w-48 align-bottom">{col.name}</th>
                    ))}
                    <th rowSpan={2} className="w-24 border-b-2 border-slate-200"></th>
                </tr>
                <tr>
                    {sortedKpiItems.map(item => {
                        const isPrevMonthVisible = visibleComparisons[item.id]?.prevMonth ?? true;
                        const isLastYearVisible = visibleComparisons[item.id]?.lastYear ?? true;
                        return (
                            <React.Fragment key={`${item.id}-sub`}>
                                <th className="p-2 text-right font-medium border-b-2 border-slate-200 bg-slate-100 border-l w-32">実績</th>
                                {isPrevMonthVisible && <th className="p-2 text-right font-medium border-b-2 border-slate-200 bg-slate-100 w-32">前月比</th>}
                                {isLastYearVisible && <th className="p-2 text-right font-medium border-b-2 border-slate-200 bg-slate-100 w-32">昨年実績</th>}
                                {isLastYearVisible && <th className="p-2 text-right font-medium border-b-2 border-slate-200 bg-slate-100 w-32">昨年対比</th>}
                            </React.Fragment>
                        );
                    })}
                </tr>
            </thead>
          <tbody>
            {filteredRecords.length === 0 ? (
                <tr>
                    <td colSpan={emptyStateColSpan} className="text-center py-12 text-slate-500">
                        <p>{(filterStartDate || filterEndDate || filterStartMonth || filterEndMonth) ? '指定された期間に該当するレコードがありません。' : 'KPIレコードがありません。'}</p>
                        {!(filterStartDate || filterEndDate || filterStartMonth || filterEndMonth) && (
                            <PrimaryButton onClick={() => setShowAddModal(true)} icon={<PlusIcon />} className="mt-4">
                                最初の期間を追加
                            </PrimaryButton>
                        )}
                    </td>
                </tr>
            ) : filteredRecords.map(record => {
                const isEditing = editingRecordId === record.id;
                const data = isEditing ? editingRecordData : record;
                if(!data) return null;

                const isMonthly = /^\d{4}年\d{1,2}月$/.test(record.periodLabel);
                let prevMonthRecord: KpiRecord | undefined;
                let lastYearRecord: KpiRecord | undefined;

                if (isMonthly) {
                    const match = record.periodLabel.match(/(\d{4})年(\d{1,2})月/);
                    if (match) {
                        const year = parseInt(match[1], 10);
                        const month = parseInt(match[2], 10);
                        
                        const prevMonthDate = new Date(year, month - 1, 0);
                        const prevMonthKey = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`;
                        prevMonthRecord = monthlyRecordsMap.get(prevMonthKey);
                        
                        const lastYearKey = `${year - 1}-${String(month).padStart(2, '0')}`;
                        lastYearRecord = monthlyRecordsMap.get(lastYearKey);
                    }
                }

                return (
                    <tr key={record.id} className={`group ${isEditing ? 'bg-sky-50' : 'hover:bg-slate-50'}`}>
                        <td className="p-2 border-b border-slate-200 font-medium align-top relative cursor-pointer" onClick={() => handleRecordClick(record)}>
                             <div className="flex justify-between items-start w-full h-full">
                                <div>
                                    <p className={`font-semibold ${!isEditing ? 'text-sky-700 group-hover:underline' : ''} whitespace-nowrap`}>{data.periodLabel}</p>
                                    {!isMonthly && (
                                        <p className="text-xs font-normal text-slate-500 mt-1">{formatDate(data.startDate, 'yy/MM/dd')}~{formatDate(data.endDate, 'yy/MM/dd')}</p>
                                    )}
                                </div>
                            </div>
                        </td>
                        {sortedKpiItems.map(item => {
                           const currentValue = data.values?.[item.id] ?? null;
                           const prevMonthValue = prevMonthRecord?.values?.[item.id] ?? null;
                           const lastYearValue = lastYearRecord?.values?.[item.id] ?? null;

                           const prevMonthDiff = (currentValue !== null && prevMonthValue !== null) ? currentValue - prevMonthValue : null;
                           const lastYearDiff = (currentValue !== null && lastYearValue !== null) ? currentValue - lastYearValue : null;
                           
                           const isPrevMonthVisible = visibleComparisons[item.id]?.prevMonth ?? true;
                           const isLastYearVisible = visibleComparisons[item.id]?.lastYear ?? true;

                           return (
                            <React.Fragment key={item.id}>
                                <td className="p-2 border-b border-l border-slate-200 text-right align-top" onClick={e => e.stopPropagation()}>
                                    <EditableField<number | null>
                                        isEditing={isEditing}
                                        value={data.values?.[item.id] ?? null}
                                        onChange={val => handleEditingValueChange(item.id, val)}
                                        inputType="number"
                                        inputClassName="w-24 text-right"
                                        placeholder="-"
                                        emptyNumericIs="null"
                                    />
                                </td>
                                {isPrevMonthVisible && (
                                    <td className="p-2 border-b border-slate-200 text-right align-top">
                                        {isMonthly ? <ComparisonDisplay value={prevMonthDiff} baseValue={prevMonthValue} /> : <span className="text-slate-400">-</span>}
                                    </td>
                                )}
                                {isLastYearVisible && (
                                    <td className="p-2 border-b border-slate-200 text-right align-top">
                                        {isMonthly ? (lastYearValue !== null ? <span>{formatKpiNumber(lastYearValue)}</span> : <span className="text-slate-400">-</span>) : <span className="text-slate-400">-</span>}
                                    </td>
                                )}
                                {isLastYearVisible && (
                                    <td className="p-2 border-b border-r border-slate-200 text-right align-top">
                                        {isMonthly ? <ComparisonDisplay value={lastYearDiff} baseValue={lastYearValue} /> : <span className="text-slate-400">-</span>}
                                    </td>
                                )}
                            </React.Fragment>
                           )
                        })}
                        {visibleCustomColumns.map(col => {
                            const content = data.customColumns?.[col.id] ?? '';
                            return (
                                <td key={col.id} className="p-2 border-b border-l border-slate-200 align-top" onClick={e => e.stopPropagation()}>
                                    {col.type === 'image' ? (
                                        <ImageUploadField 
                                            isEditing={isEditing}
                                            value={content}
                                            onChange={url => handleEditingCustomColumnChange(col.id, url)}
                                            project={project}
                                        />
                                    ) : (
                                        <div className="overflow-x-auto whitespace-nowrap">
                                            <EditableField 
                                                isEditing={isEditing} 
                                                value={content} 
                                                onChange={val => handleEditingCustomColumnChange(col.id, val as string)} 
                                                placeholder="-" 
                                                inputClassName="w-full"
                                            />
                                        </div>
                                    )}
                                </td>
                            );
                        })}
                        <td className="p-2 border-b border-slate-200 align-middle text-center">
                             <div 
                                onClick={(e) => e.stopPropagation()}
                                className="flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                            >
                                {isEditing ? (
                                    <div className="flex items-center justify-center gap-1">
                                        <IconButton onClick={handleUpdateRecord} aria-label="保存"><SaveIcon className="text-sky-600"/></IconButton>
                                        <IconButton onClick={handleCancelEdit} aria-label="キャンセル"><CancelIcon/></IconButton>
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-center gap-1">
                                        <IconButton onClick={() => handleStartEdit(record)} aria-label="編集"><EditIcon/></IconButton>
                                        <IconButton onClick={() => handleDeleteRecord(record.id)} aria-label="削除" className="hover:text-red-500"><TrashIcon/></IconButton>
                                    </div>
                                )}
                            </div>
                        </td>
                    </tr>
                )
            })}
          </tbody>
        </table>
      </div>
      {showAddModal && <AddKpiRecordModal project={project} sheet={sheet} onClose={() => setShowAddModal(false)} />}
      {showCopyModal && <CopyKpiRecordModal project={project} sheet={sheet} existingRecords={kpiRecords} onClose={() => setShowCopyModal(false)} />}
      {showKpiSettingsModal && <KpiItemsSettingsModal project={project} sheet={sheet} initialItems={kpiItems} onClose={() => setShowKpiSettingsModal(false)} />}
      {showColumnSettingsModal && <KpiCustomColumnsSettingsModal project={project} sheet={sheet} initialColumns={kpiCustomColumns} onClose={() => setShowColumnSettingsModal(false)} />}
      {showCsvImportModal && <KpiCsvImportModal project={project} sheet={sheet} kpiItems={sortedKpiItems} customColumns={kpiCustomColumns} existingRecords={kpiRecords} onClose={() => setShowCsvImportModal(false)} />}
    </div>
  );
};

const CopyKpiRecordModal: React.FC<{
    project: Project;
    sheet: KpiSheet;
    existingRecords: KpiRecord[];
    onClose: () => void;
}> = ({ project, sheet, existingRecords, onClose }) => {
    const { currentUser } = useAuth();
    const [sourceRecordId, setSourceRecordId] = useState<string>('');
    const [periodType, setPeriodType] = useState<'range' | 'month' | 'day'>('month');
    const [startDate, setStartDate] = useState(formatDate(new Date()));
    const [endDate, setEndDate] = useState(formatDate(new Date()));
    const [month, setMonth] = useState(formatDate(new Date(), 'yyyy-MM'));
    const [label, setLabel] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const sortedRecords = useMemo(() => 
        [...existingRecords].sort((a,b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()),
    [existingRecords]);

    useEffect(() => {
        if (periodType === 'month') {
            const [year, m] = month.split('-');
            setLabel(`${year}年${parseInt(m, 10)}月`);
            const start = new Date(parseInt(year, 10), parseInt(m, 10) - 1, 1);
            const end = new Date(parseInt(year, 10), parseInt(m, 10), 0);
            setStartDate(formatDate(start));
            setEndDate(formatDate(end));
        } else if (periodType === 'day') {
            setLabel(formatDate(new Date(startDate), 'yyyy年MM月dd日'));
            setEndDate(startDate);
        } else { // range
            setLabel('');
        }
    }, [periodType, month, startDate]);

    const handleCopyRecord = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentUser) { setError("ユーザー情報が見つかりません。"); return; }
        if (!sourceRecordId) { setError("コピー元の期間を選択してください。"); return; }
        if (!label.trim() && periodType === 'range') { setError("期間ラベルは必須です。"); return; }
        if (!startDate || !endDate || new Date(startDate) > new Date(endDate)) { setError("期間が正しくありません。"); return; }
        
        const sourceRecord = existingRecords.find(r => r.id === sourceRecordId);
        if (!sourceRecord) { setError("コピー元のレコードが見つかりません。"); return; }
        
        setLoading(true);
        setError('');
        try {
            const { values, customColumns } = sourceRecord;
            const newRecord: Omit<KpiRecord, 'id' | 'createdAt'> = {
                projectId: project.id, userId: currentUser.uid, sheetId: sheet.id,
                startDate, endDate, periodLabel: label, values, customColumns
            };
            const recordPath = getCollectionPath.kpiRecords(currentUser.uid, project.id);
            await firestore.collection(recordPath).add({ ...newRecord, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
            onClose();
        } catch (err) {
            setError("レコードのコピーに失敗しました。");
        } finally {
            setLoading(false);
        }
    };
    
    return (
        <Modal title="期間をコピーして新規作成" onClose={onClose}>
            <form onSubmit={handleCopyRecord} className="space-y-4">
                {error && <p className="text-sm text-red-600">{error}</p>}
                <div>
                    <label htmlFor="source-record" className="block text-sm font-medium text-slate-700 mb-1">コピー元</label>
                    <select id="source-record" value={sourceRecordId} onChange={e => setSourceRecordId(e.target.value)} required className="block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500">
                        <option value="">コピー元の期間を選択...</option>
                        {sortedRecords.map(rec => <option key={rec.id} value={rec.id}>{rec.periodLabel}</option>)}
                    </select>
                </div>
                <div className="border-t pt-4 space-y-4">
                    <p className="text-sm font-medium text-slate-700">コピー先の新しい期間</p>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">期間タイプ</label>
                        <div className="flex gap-4">
                            <label className="flex items-center"><input type="radio" value="month" checked={periodType === 'month'} onChange={(e) => setPeriodType(e.target.value as any)} className="mr-1.5 h-4 w-4 text-sky-600 focus:ring-sky-500 border-slate-300" />月次</label>
                            <label className="flex items-center"><input type="radio" value="day" checked={periodType === 'day'} onChange={(e) => setPeriodType(e.target.value as any)} className="mr-1.5 h-4 w-4 text-sky-600 focus:ring-sky-500 border-slate-300" />日次</label>
                            <label className="flex items-center"><input type="radio" value="range" checked={periodType === 'range'} onChange={(e) => setPeriodType(e.target.value as any)} className="mr-1.5 h-4 w-4 text-sky-600 focus:ring-sky-500 border-slate-300" />カスタム</label>
                        </div>
                    </div>
                    {periodType === 'month' && (
                        <div>
                            <label htmlFor="month-select" className="block text-sm font-medium text-slate-700 mb-1">月を選択</label>
                            <input id="month-select" type="month" value={month} onChange={e => setMonth(e.target.value)} className="block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500"/>
                        </div>
                    )}
                    {/* Other period types UI */}
                </div>
                <div className="flex justify-end space-x-3 pt-2">
                    <SecondaryButton type="button" onClick={onClose} disabled={loading}>キャンセル</SecondaryButton>
                    <PrimaryButton type="submit" disabled={loading}>{loading ? '作成中...' : 'コピーして作成'}</PrimaryButton>
                </div>
            </form>
        </Modal>
    );
};

const AddKpiRecordModal: React.FC<{ project: Project; sheet: KpiSheet; onClose: () => void; }> = ({ project, sheet, onClose }) => {
    const { currentUser } = useAuth();
    const [periodType, setPeriodType] = useState<'range' | 'month' | 'day'>('month');
    const [startDate, setStartDate] = useState(formatDate(new Date()));
    const [endDate, setEndDate] = useState(formatDate(new Date()));
    const [month, setMonth] = useState(formatDate(new Date(), 'yyyy-MM'));
    const [label, setLabel] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (periodType === 'month') {
            const [year, m] = month.split('-');
            setLabel(`${year}年${parseInt(m, 10)}月`);
            const start = new Date(parseInt(year, 10), parseInt(m, 10) - 1, 1);
            const end = new Date(parseInt(year, 10), parseInt(m, 10), 0);
            setStartDate(formatDate(start));
            setEndDate(formatDate(end));
        } else if (periodType === 'day') {
            setLabel(formatDate(new Date(startDate), 'yyyy年MM月dd日'));
            setEndDate(startDate);
        } else { // range
            setLabel('');
        }
    }, [periodType, month, startDate]);

    const handleAddRecord = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentUser) { setError("ユーザー情報が見つかりません。"); return; }
        if (!label.trim() && periodType === 'range') { setError("期間ラベルは必須です。"); return; }
        if (!startDate || !endDate || new Date(startDate) > new Date(endDate)) { setError("期間が正しくありません。"); return; }
        setLoading(true);
        setError('');
        try {
            const newRecord: Omit<KpiRecord, 'id' | 'createdAt'> = {
                projectId: project.id,
                userId: currentUser.uid,
                sheetId: sheet.id,
                startDate,
                endDate,
                periodLabel: label,
                values: {},
                customColumns: {}
            };
            const recordPath = getCollectionPath.kpiRecords(currentUser.uid, project.id);
            await firestore.collection(recordPath).add({ ...newRecord, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
            onClose();
        } catch (err) {
            setError("レコードの追加に失敗しました。");
        } finally {
            setLoading(false);
        }
    };
    
    return (
        <Modal title="期間を追加" onClose={onClose}>
            <form onSubmit={handleAddRecord} className="space-y-4">
                {error && <p className="text-sm text-red-600">{error}</p>}
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">期間タイプ</label>
                    <div className="flex gap-4">
                        <label className="flex items-center"><input type="radio" value="month" checked={periodType === 'month'} onChange={(e) => setPeriodType(e.target.value as any)} className="mr-1.5 h-4 w-4 text-sky-600 focus:ring-sky-500 border-slate-300" />月次</label>
                        <label className="flex items-center"><input type="radio" value="day" checked={periodType === 'day'} onChange={(e) => setPeriodType(e.target.value as any)} className="mr-1.5 h-4 w-4 text-sky-600 focus:ring-sky-500 border-slate-300" />日次</label>
                        <label className="flex items-center"><input type="radio" value="range" checked={periodType === 'range'} onChange={(e) => setPeriodType(e.target.value as any)} className="mr-1.5 h-4 w-4 text-sky-600 focus:ring-sky-500 border-slate-300" />カスタム</label>
                    </div>
                </div>
                {periodType === 'month' && (
                    <div>
                        <label htmlFor="month-select" className="block text-sm font-medium text-slate-700 mb-1">月を選択</label>
                        <input id="month-select" type="month" value={month} onChange={e => setMonth(e.target.value)} className="block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500"/>
                    </div>
                )}
                {periodType === 'day' && (
                    <div>
                        <label htmlFor="date-select" className="block text-sm font-medium text-slate-700 mb-1">日を選択</label>
                        <input id="date-select" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500"/>
                    </div>
                )}
                 {periodType === 'range' && (
                    <>
                        <div>
                            <label htmlFor="label-input" className="block text-sm font-medium text-slate-700 mb-1">期間ラベル</label>
                            <input id="label-input" type="text" value={label} onChange={e => setLabel(e.target.value)} placeholder="例：Q1, 2024年上半期" className="block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500"/>
                        </div>
                        <div className="flex gap-4">
                            <div className="flex-1">
                                <label htmlFor="start-date" className="block text-sm font-medium text-slate-700 mb-1">開始日</label>
                                <input id="start-date" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500"/>
                            </div>
                            <div className="flex-1">
                                <label htmlFor="end-date" className="block text-sm font-medium text-slate-700 mb-1">終了日</label>
                                <input id="end-date" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500"/>
                            </div>
                        </div>
                    </>
                )}
                <div className="flex justify-end space-x-3 pt-2">
                    <SecondaryButton type="button" onClick={onClose} disabled={loading}>キャンセル</SecondaryButton>
                    <PrimaryButton type="submit" disabled={loading}>{loading ? '追加中...' : '追加'}</PrimaryButton>
                </div>
            </form>
        </Modal>
    );
};

const KpiItemsSettingsModal: React.FC<{ project: Project; sheet: KpiSheet; initialItems: KpiItem[]; onClose: () => void; }> = ({ project, sheet, initialItems, onClose }) => {
    const { currentUser } = useAuth();
    const [items, setItems] = useState<KpiItem[]>(() => JSON.parse(JSON.stringify(initialItems.sort((a,b) => a.order - b.order))));
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleMoveItem = (index: number, direction: 'up' | 'down') => {
        if ((direction === 'up' && index === 0) || (direction === 'down' && index === items.length - 1)) {
            return;
        }
        const newItems = [...items];
        const [movedItem] = newItems.splice(index, 1);
        const newIndex = direction === 'up' ? index - 1 : index + 1;
        newItems.splice(newIndex, 0, movedItem);
        setItems(newItems);
    };

    const handleAddItem = () => {
        if (!currentUser) return;
        const newItem: KpiItem = {
            id: `new-${Date.now()}`, projectId: project.id, userId: currentUser.uid, sheetId: sheet.id,
            name: '', description: '', order: items.length,
        };
        setItems([...items, newItem]);
    };

    const handleDeleteItem = (idToDelete: string) => {
        setItems(prev => prev.filter(item => item.id !== idToDelete));
    };

    const handleItemChange = (id: string, field: 'name' | 'description', value: string) => {
        setItems(items.map(item => item.id === id ? { ...item, [field]: value } : item));
    };

    const handleSaveChanges = async () => {
        if (!currentUser) return;
        setLoading(true);
        setError(null);
        try {
            const batch = firestore.batch();
            const path = getCollectionPath.kpiItems(currentUser.uid, project.id);
            const finalItemIds = new Set(items.map(i => i.id));
            const deletedItems = initialItems.filter(i => !finalItemIds.has(i.id));
            deletedItems.forEach(item => batch.delete(firestore.doc(`${path}/${item.id}`)));

            for (const [index, item] of items.entries()) {
                if (!item.name.trim()) throw new Error("KPI項目名は必須です。");
                const data = {
                    projectId: project.id, userId: currentUser.uid, sheetId: sheet.id,
                    name: item.name.trim(), description: item.description?.trim() || '', order: index,
                };
                if (item.id.startsWith('new-')) {
                    batch.set(firestore.collection(path).doc(), data);
                } else {
                    batch.update(firestore.doc(`${path}/${item.id}`), data);
                }
            }

            if (deletedItems.length > 0) {
                const recordsPath = getCollectionPath.kpiRecords(currentUser.uid, project.id);
                const recordsSnapshot = await firestore.collection(recordsPath).where('sheetId', '==', sheet.id).get();
                recordsSnapshot.forEach(recordDoc => {
                    const updates: { [key: string]: any } = {};
                    deletedItems.forEach(item => {
                        updates[`values.${item.id}`] = firebase.firestore.FieldValue.delete();
                    });
                    if(Object.keys(updates).length > 0) batch.update(recordDoc.ref, updates);
                });
            }

            await batch.commit();
            onClose();
        } catch (e: any) {
            setError(e.message || "保存中にエラーが発生しました。");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal title="KPI項目設定" onClose={onClose} size="2xl">
            <div className="space-y-4 flex flex-col" style={{minHeight: '400px'}}>
                {error && <p className="text-sm text-red-600 bg-red-100 p-3 rounded-md">{error}</p>}
                <div className="space-y-2 flex-grow max-h-96 overflow-y-auto pr-2">
                    {items.map((item, index) => (
                        <div key={item.id} className="flex items-center gap-2 p-2 rounded-md hover:bg-slate-100">
                           <input type="text" placeholder="KPI項目名" value={item.name} onChange={e => handleItemChange(item.id, 'name', e.target.value)} className="px-2 py-1 border border-slate-300 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500 text-sm w-1/3" />
                           <input type="text" placeholder="説明（任意）" value={item.description} onChange={e => handleItemChange(item.id, 'description', e.target.value)} className="px-2 py-1 border border-slate-300 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500 text-sm flex-grow" />
                           <IconButton onClick={() => handleMoveItem(index, 'up')} disabled={index === 0} aria-label="上に移動"><ArrowUpwardIcon /></IconButton>
                           <IconButton onClick={() => handleMoveItem(index, 'down')} disabled={index === items.length - 1} aria-label="下に移動"><ArrowDownwardIcon /></IconButton>
                           <IconButton onClick={() => handleDeleteItem(item.id)} className="hover:text-red-500" aria-label="削除"><TrashIcon/></IconButton>
                        </div>
                    ))}
                </div>
                <div className="border-t border-slate-200 pt-4 space-y-4">
                    <PrimaryButton icon={<PlusIcon />} onClick={handleAddItem} size="sm">項目を追加</PrimaryButton>
                    <div className="flex justify-end space-x-3">
                        <SecondaryButton onClick={onClose} disabled={loading}>キャンセル</SecondaryButton>
                        <PrimaryButton onClick={handleSaveChanges} disabled={loading}>{loading ? "保存中..." : "変更を保存"}</PrimaryButton>
                    </div>
                </div>
            </div>
        </Modal>
    );
};

const KpiCustomColumnsSettingsModal: React.FC<{ project: Project; sheet: KpiSheet; initialColumns: KpiCustomColumn[]; onClose: () => void; }> = ({ project, sheet, initialColumns, onClose }) => {
    const { currentUser } = useAuth();
    const [columns, setColumns] = useState<KpiCustomColumn[]>(() => JSON.parse(JSON.stringify(initialColumns.sort((a,b) => a.order - b.order))));
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    const handleMoveColumn = (index: number, direction: 'up' | 'down') => {
        if ((direction === 'up' && index === 0) || (direction === 'down' && index === columns.length - 1)) {
            return;
        }
        const newColumns = [...columns];
        const [movedItem] = newColumns.splice(index, 1);
        const newIndex = direction === 'up' ? index - 1 : index + 1;
        newColumns.splice(newIndex, 0, movedItem);
        setColumns(newColumns);
    };

    const handleAddColumn = () => {
        if (!currentUser) return;
        const newCol: KpiCustomColumn = {
            id: `new-${Date.now()}`, projectId: project.id, userId: currentUser.uid, sheetId: sheet.id,
            name: '', type: 'text', order: columns.length, isVisible: true
        };
        setColumns([...columns, newCol]);
    };

    const handleDeleteColumn = (idToDelete: string) => {
        setColumns(prev => prev.filter(col => col.id !== idToDelete));
    };

    const handleColumnChange = (id: string, field: keyof KpiCustomColumn, value: string) => {
        setColumns(columns.map(col => col.id === id ? { ...col, [field]: value } : col));
    };

    const handleSaveChanges = async () => {
        if (!currentUser) return;
        setLoading(true);
        setError(null);
        try {
            const batch = firestore.batch();
            const path = getCollectionPath.kpiCustomColumns(currentUser.uid, project.id);
            const finalColumnIds = new Set(columns.map(c => c.id));
            const deletedColumns = initialColumns.filter(c => !finalColumnIds.has(c.id));
            deletedColumns.forEach(col => batch.delete(firestore.doc(`${path}/${col.id}`)));

            for (const [index, col] of columns.entries()) {
                if (!col.name.trim()) throw new Error("列名は必須です。");
                
                const dataToSave = {
                    projectId: project.id, userId: currentUser.uid, sheetId: sheet.id,
                    name: col.name.trim(), 
                    order: index,
                    type: col.type,
                    isVisible: col.isVisible,
                };
                
                if (col.id.startsWith('new-')) {
                    batch.set(firestore.collection(path).doc(), dataToSave);
                } else {
                    batch.update(firestore.doc(`${path}/${col.id}`), dataToSave);
                }
            }
            
            if (deletedColumns.length > 0) {
                const recordsPath = getCollectionPath.kpiRecords(currentUser.uid, project.id);
                const recordsSnapshot = await firestore.collection(recordsPath).where('sheetId', '==', sheet.id).get();
                recordsSnapshot.forEach(recordDoc => {
                    const updates: { [key: string]: any } = {};
                    deletedColumns.forEach(col => {
                        updates[`customColumns.${col.id}`] = firebase.firestore.FieldValue.delete();
                    });
                    if (Object.keys(updates).length > 0) batch.update(recordDoc.ref, updates);
                });
            }
            
            await batch.commit();
            onClose();
        } catch (e: any) {
            setError(e.message || "保存中にエラーが発生しました。");
        } finally {
            setLoading(false);
        }
    };
    
    return (
        <Modal title="カスタム列設定" onClose={onClose} size="lg">
            <div className="space-y-4 flex flex-col" style={{minHeight: '400px'}}>
                {error && <p className="text-sm text-red-600 bg-red-100 p-3 rounded-md">{error}</p>}
                <div className="space-y-2 flex-grow max-h-96 overflow-y-auto pr-2">
                    {columns.map((col, index) => (
                        <div key={col.id} className="flex items-center gap-2 p-2 rounded-md hover:bg-slate-100">
                           <input type="text" placeholder="列名" value={col.name} onChange={e => handleColumnChange(col.id, 'name', e.target.value)} className="px-2 py-1 border border-slate-300 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500 text-sm flex-grow" />
                           <select value={col.type} onChange={e => handleColumnChange(col.id, 'type', e.target.value)} className="px-2 py-1 border border-slate-300 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500 text-sm">
                               <option value="text">テキスト</option>
                               <option value="image">画像</option>
                           </select>
                           <IconButton onClick={() => handleMoveColumn(index, 'up')} disabled={index === 0} aria-label="上に移動"><ArrowUpwardIcon /></IconButton>
                           <IconButton onClick={() => handleMoveColumn(index, 'down')} disabled={index === columns.length - 1} aria-label="下に移動"><ArrowDownwardIcon /></IconButton>
                           <IconButton onClick={() => handleDeleteColumn(col.id)} className="hover:text-red-500" aria-label="削除"><TrashIcon/></IconButton>
                        </div>
                    ))}
                </div>
                <div className="border-t border-slate-200 pt-4 space-y-4">
                    <PrimaryButton icon={<PlusIcon />} onClick={handleAddColumn} size="sm">列を追加</PrimaryButton>
                    <div className="flex justify-end space-x-3">
                        <SecondaryButton onClick={onClose} disabled={loading}>キャンセル</SecondaryButton>
                        <PrimaryButton onClick={handleSaveChanges} disabled={loading}>{loading ? "保存中..." : "変更を保存"}</PrimaryButton>
                    </div>
                </div>
            </div>
        </Modal>
    );
};

const KpiCsvImportModal: React.FC<{ project: Project; sheet: KpiSheet; kpiItems: KpiItem[]; customColumns: KpiCustomColumn[]; existingRecords: KpiRecord[]; onClose: () => void; }> = ({ project, sheet, kpiItems, customColumns, existingRecords, onClose }) => {
    const { currentUser } = useAuth();
    const [file, setFile] = useState<File | null>(null);
    const [status, setStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
    const [message, setMessage] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const escapeCsvCell = (cell: any): string => {
        const str = String(cell ?? '');
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
    };

    const handleDownloadTemplate = () => {
        const headers = ['periodLabel', 'startDate', 'endDate', ...kpiItems.map(i => i.name), ...customColumns.map(c => c.name)];
        const csvContent = headers.map(escapeCsvCell).join(',');
        
        const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.setAttribute('download', `kpi-template-${project.name}.csv`);
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
        if (!file || !currentUser) return;

        setStatus('processing');
        setMessage('インポート処理中...');

        try {
            const text = await file.text();
            // Simple CSV parsing: assumes no commas within quoted fields
            const rows = text.split('\n').map(row => row.trim()).filter(Boolean);
            if (rows.length < 2) throw new Error("CSVファイルにデータ行がありません。");

            const headers = rows[0].split(',').map(h => h.trim());
            const requiredHeaders = ['periodLabel', 'startDate', 'endDate'];
            if (!requiredHeaders.every(h => headers.includes(h))) {
                throw new Error(`必須の列が見つかりません: ${requiredHeaders.join(', ')}`);
            }

            const kpiItemMap = new Map(kpiItems.map(item => [item.name, item.id]));
            const customColMap = new Map(customColumns.map(col => [col.name, col.id]));
            const existingRecordsMap = new Map(existingRecords.map(rec => [rec.periodLabel, rec]));

            const batch = firestore.batch();
            const recordsPath = getCollectionPath.kpiRecords(currentUser.uid, project.id);

            let updatedCount = 0;
            let createdCount = 0;

            for (let i = 1; i < rows.length; i++) {
                const values = rows[i].split(',');
                const rowData: { [key: string]: string } = {};
                headers.forEach((header, index) => {
                    rowData[header] = values[index];
                });

                const { periodLabel, startDate, endDate } = rowData;
                if (!periodLabel || !startDate || !endDate) {
                    console.warn(`Skipping row ${i + 1}: Missing periodLabel, startDate, or endDate.`);
                    continue;
                }
                // Basic date validation
                if (isNaN(new Date(startDate).getTime()) || isNaN(new Date(endDate).getTime())) {
                     console.warn(`Skipping row ${i + 1}: Invalid date format for startDate or endDate.`);
                    continue;
                }


                const kpiValues: { [kpiItemId: string]: number | null } = {};
                const customColValues: { [customColumnId: string]: string } = {};

                Object.entries(rowData).forEach(([header, value]) => {
                    if (kpiItemMap.has(header)) {
                        const kpiId = kpiItemMap.get(header)!;
                        const numValue = parseFloat(value);
                        kpiValues[kpiId] = isNaN(numValue) ? null : numValue;
                    } else if (customColMap.has(header)) {
                        const colId = customColMap.get(header)!;
                        customColValues[colId] = value;
                    }
                });

                const existingRecord = existingRecordsMap.get(periodLabel);

                if (existingRecord) {
                    // Update existing record
                    const recordRef = firestore.doc(recordsPath + '/' + existingRecord.id);
                    batch.update(recordRef, {
                        startDate,
                        endDate,
                        values: { ...existingRecord.values, ...kpiValues },
                        customColumns: { ...existingRecord.customColumns, ...customColValues }
                    });
                    updatedCount++;
                } else {
                    // Create new record
                    const newRecordRef = firestore.collection(recordsPath).doc();
                    // FIX: Remove 'createdAt' from this object literal to match the type.
                    const newRecord: Omit<KpiRecord, 'id' | 'createdAt'> = {
                        projectId: project.id,
                        userId: currentUser.uid,
                        sheetId: sheet.id,
                        periodLabel,
                        startDate,
                        endDate,
                        values: kpiValues,
                        customColumns: customColValues,
                    };
                    batch.set(newRecordRef, { ...newRecord, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
                    createdCount++;
                }
            }

            await batch.commit();

            setStatus('success');
            setMessage(`インポート完了！ ${createdCount}件が新規追加、${updatedCount}件が更新されました。`);
        } catch (err: any) {
            setStatus('error');
            setMessage(`エラー: ${err.message}`);
            console.error(err);
        }
    };

    return (
        <Modal title="CSVインポート" onClose={onClose} size="xl">
            <div className="space-y-6">
                <div className="p-4 bg-slate-50 rounded-lg space-y-2">
                    <h4 className="font-semibold text-slate-800">ステップ1: テンプレートのダウンロード</h4>
                    <p className="text-sm text-slate-600">現在のKPI項目とカスタム列に基づいたCSVテンプレートをダウンロードし、データを入力してください。</p>
                    <SecondaryButton icon={<FileDownloadIcon />} onClick={handleDownloadTemplate}>テンプレートをダウンロード</SecondaryButton>
                </div>

                <div className="p-4 bg-slate-50 rounded-lg space-y-2">
                    <h4 className="font-semibold text-slate-800">ステップ2: CSVファイルのアップロード</h4>
                    <p className="text-sm text-slate-600">入力済みのCSVファイルをアップロードしてください。`periodLabel`が一致するレコードは更新され、一致しないものは新規追加されます。</p>
                    <input
                        type="file"
                        accept=".csv"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        className="block w-full text-sm text-slate-500
                                   file:mr-4 file:py-2 file:px-4
                                   file:rounded-full file:border-0
                                   file:text-sm file:font-semibold
                                   file:bg-sky-50 file:text-sky-700
                                   hover:file:bg-sky-100"
                    />
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


export default KpiManagementTab;