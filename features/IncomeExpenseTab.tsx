import React, { useState, useEffect, useMemo, useRef } from 'react';
import { IncomeExpenseItem, Project, IncomeExpenseSheet } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { firestore, getCollectionPath } from '../firebase';
import { PlusIcon, SaveIcon, CancelIcon, TrashIcon, EditIcon, FilterListIcon, PlaylistAddIcon, ArrowUpwardIcon, ArrowDownwardIcon, ChevronDownIcon } from '../components/Icons';
import { PrimaryButton, SecondaryButton, IconButton } from '../components/common/Buttons';
import { EditableField } from '../components/common/EditableField';

interface IncomeExpenseManagementTabProps {
  project: Project;
  sheet: IncomeExpenseSheet;
  initialItems: IncomeExpenseItem[];
}

const IncomeExpenseManagementTab: React.FC<IncomeExpenseManagementTabProps> = ({ project, sheet, initialItems }) => {
  const [items, setItems] = useState<IncomeExpenseItem[]>(initialItems);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { currentUser } = useAuth();
  
  const [collapsedParents, setCollapsedParents] = useState<Set<string>>(() => new Set(sheet.viewPreferences?.collapsedParents || []));
  const [showColumnFilter, setShowColumnFilter] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState(() => sheet.viewPreferences?.visibleColumns || {
    purchase: true,
    estimate: true,
    grossProfit: true,
  });

  const [isSavingView, setIsSavingView] = useState(false);
  const newItemOverviewRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const newItems = initialItems.map(item => ({...item, depth: item.depth || 0, parentId: item.parentId || null }));
    setItems(newItems);
    if (editingItemId && !newItems.find(item => item.id === editingItemId)) {
        setEditingItemId(null);
    }
  }, [initialItems, editingItemId]);
  
  const parentIdsWithChildren = useMemo(() => {
    return new Set(items.map(i => i.parentId).filter(Boolean) as string[]);
  }, [items]);

  type DerivedItem = IncomeExpenseItem & { calculationStatus: { purchase: boolean; estimate: boolean; } };

  const derivedItems = useMemo(() => {
    // 1. Initialize a map with calculation status for each item.
    const itemMap = new Map(items.map(i => [i.id, { ...i, calculationStatus: { purchase: false, estimate: false } } as DerivedItem]));
    
    // 2. Sort items by depth, from deepest to shallowest. This is crucial for the recursive calculation.
    const sortedItems = [...items].sort((a, b) => (b.depth ?? 0) - (a.depth ?? 0));

    // 3. Iterate through sorted items, calculating totals for parents.
    for (const item of sortedItems) {
        // If the current item is a parent of any other item...
        if (parentIdsWithChildren.has(item.id)) {
            const children = items.filter(child => child.parentId === item.id);
            
            // Check if any children (which have already been processed) have values that should be summed.
            const hasValuedPurchaseChild = children.some(child => {
                const childData = itemMap.get(child.id)!;
                // A child has a "value" if its own price is > 0 OR it's a sub-total (calculationStatus.purchase is true)
                return childData.calculationStatus.purchase || Number(child.purchaseUnitPrice) > 0;
            });

            const hasValuedEstimateChild = children.some(child => {
                const childData = itemMap.get(child.id)!;
                return childData.calculationStatus.estimate || Number(child.estimateUnitPrice) > 0;
            });

            // If there's anything to sum up, proceed with calculation.
            if (hasValuedPurchaseChild || hasValuedEstimateChild) {
                const { totalPurchase, totalEstimate } = children.reduce((acc, child) => {
                    const childData = itemMap.get(child.id)!;
                    
                    // If the child is already a calculated sum, use its value directly.
                    // Otherwise, calculate its value from its own unit price and quantity.
                    const purchase = childData.calculationStatus.purchase 
                        ? childData.purchaseUnitPrice 
                        : (Number(childData.purchaseUnitPrice) * Number(childData.quantity));
                    const estimate = childData.calculationStatus.estimate
                        ? childData.estimateUnitPrice
                        : (Number(childData.estimateUnitPrice) * Number(childData.quantity));

                    acc.totalPurchase += isNaN(purchase) ? 0 : purchase;
                    acc.totalEstimate += isNaN(estimate) ? 0 : estimate;
                    return acc;
                }, { totalPurchase: 0, totalEstimate: 0 });

                const currentItem = itemMap.get(item.id)!;

                // Update the parent item's data in the map.
                if (hasValuedPurchaseChild) {
                    currentItem.purchaseUnitPrice = totalPurchase;
                    currentItem.calculationStatus.purchase = true;
                }
                if (hasValuedEstimateChild) {
                    currentItem.estimateUnitPrice = totalEstimate;
                    currentItem.calculationStatus.estimate = true;
                }
                
                // Mark this item as a "summary" row.
                currentItem.quantity = 1;
                currentItem.unit = '式';
            }
        }
    }
    // 4. Return the final list of items with all calculations applied.
    return items.map(item => itemMap.get(item.id)!).filter(Boolean) as DerivedItem[];
  }, [items, parentIdsWithChildren]);
  
  const summaryCalculations = useMemo(() => {
    const topLevelItems = derivedItems.filter(item => item.depth === 0);
    const totalPurchase = topLevelItems.reduce((sum, item) => {
        const itemPurchaseAmount = item.calculationStatus.purchase ? item.purchaseUnitPrice : (Number(item.purchaseUnitPrice) * Number(item.quantity));
        return sum + itemPurchaseAmount;
    }, 0);
    const totalEstimate = topLevelItems.reduce((sum, item) => {
        const itemEstimateAmount = item.calculationStatus.estimate ? item.estimateUnitPrice : (Number(item.estimateUnitPrice) * Number(item.quantity));
        return sum + itemEstimateAmount;
    }, 0);

    const grossProfit = totalEstimate - totalPurchase;
    const grossProfitMargin = totalEstimate !== 0 ? (grossProfit / totalEstimate) * 100 : 0;
    return { totalPurchase, totalEstimate, grossProfit, grossProfitMargin };
  }, [derivedItems]);
  
  const { totalPurchase, totalEstimate, grossProfit, grossProfitMargin } = summaryCalculations;
  
  const displayItems = useMemo(() => {
    const result: DerivedItem[] = [];
    
    const buildDisplayList = (parentId: string | null) => {
        const children = derivedItems
            .filter(i => i.parentId === parentId)
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        
        children.forEach(child => {
            result.push(child);
            if (!collapsedParents.has(child.id)) {
                buildDisplayList(child.id);
            }
        });
    };
    
    buildDisplayList(null);
    return result;
  }, [derivedItems, collapsedParents]);


  const handleAddItem = async (parentId: string | null = null, depth: number = 0) => {
    if (!currentUser || !project) return;
    setError(null);
    
    let newOrder = items.filter(i => i.parentId === parentId).length;

    const newItemData: Omit<IncomeExpenseItem, 'id'> = {
      overview: depth > 0 ? '新規明細' : '新規項目', 
      quantity: 1, 
      unit: '式', 
      purchaseUnitPrice: 0, 
      estimateUnitPrice: 0, 
      notes: '', 
      projectId: project.id,
      userId: currentUser.uid,
      order: newOrder,
      parentId: parentId,
      depth: depth,
      sheetId: sheet.id,
    };
    try {
      const itemsPath = getCollectionPath.incomeExpenses(currentUser.uid, project.id);
      const docRef = await firestore.collection(itemsPath).add(newItemData);
      setEditingItemId(docRef.id); 
      setTimeout(() => newItemOverviewRef.current?.focus(), 100); 
    } catch (err) {
      console.error("Error adding item:", err);
      setError("項目の追加に失敗しました。");
    }
  };

  const handleUpdateItem = async (itemId: string) => {
    if (!currentUser || !project) return;
    setError(null);

    const itemToSave = items.find(i => i.id === itemId);
    if (!itemToSave) {
        setError("更新対象の項目が見つかりません。");
        return;
    }
    
    const { isEditing, ...itemData } = itemToSave; 
    if (!itemData.overview || itemData.overview.trim() === "") {
        setError("概要は必須です。");
        return;
    }

    const itemDocRef = firestore.doc(getCollectionPath.incomeExpenseDoc(currentUser.uid, project.id, itemId));
    try {
      await itemDocRef.update(itemData);
      setEditingItemId(null); 
    } catch (err) {
      console.error("Error updating item:", err);
      setError("項目の更新に失敗しました。");
    }
  };
  
  const handleCancelEdit = (itemId: string) => {
    setError(null);
    const item = items.find(i => i.id === itemId); 
    const initialItemData = initialItems.find(i => i.id === itemId);

    if (item && ((item.overview === "新規項目" || item.overview === "新規明細") || item.overview.trim() === "") && item.id === editingItemId && !initialItemData) { 
        handleDeleteItem(itemId, true); 
    } else if (initialItemData) {
        setItems(prevItems => prevItems.map(i => i.id === itemId ? {...initialItemData, depth: initialItemData.depth || 0, parentId: initialItemData.parentId || null} : i));
    }
    setEditingItemId(null);
  };

  const handleDeleteItem = async (itemId: string, silent: boolean = false) => {
    if (!currentUser || !project) return;
    
    const hasChildren = items.some(i => i.parentId === itemId);
    const confirmMessage = hasChildren
        ? "この項目とその全てのサブ項目を削除しますか？"
        : "この項目を削除しますか？";

    if (!silent && !window.confirm(confirmMessage)) return;
    setError(null);
    
    const batch = firestore.batch();
    const itemsToDeleteIds = new Set<string>();

    const findChildrenRecursive = (id: string) => {
        itemsToDeleteIds.add(id);
        items.filter(i => i.parentId === id).forEach(child => {
            findChildrenRecursive(child.id);
        });
    };

    findChildrenRecursive(itemId);

    itemsToDeleteIds.forEach(idToDelete => {
        const itemDocRef = firestore.doc(getCollectionPath.incomeExpenseDoc(currentUser.uid, project.id, idToDelete));
        batch.delete(itemDocRef);
    });

    try {
      await batch.commit();
      if (itemsToDeleteIds.has(editingItemId || '')) {
          setEditingItemId(null);
      }
    } catch (err) {
      console.error("Error deleting item(s):", err);
      setError("項目の削除に失敗しました。");
    }
  };


  const handleItemChange = (itemId: string, field: keyof IncomeExpenseItem, value: any) => {
    setItems(prevItems => prevItems.map(item =>
      item.id === itemId ? { ...item, [field]: value } : item
    ));
  };
  
  const handleMoveItem = async (itemId: string, direction: 'up' | 'down') => {
    if (!currentUser || !project) return;
    
    const itemToMove = items.find(i => i.id === itemId);
    if (!itemToMove) return;

    const siblings = items
      .filter(i => i.parentId === itemToMove.parentId)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    const currentIndex = siblings.findIndex(i => i.id === itemId);

    if (direction === 'up' && currentIndex > 0) {
      [siblings[currentIndex], siblings[currentIndex - 1]] = [siblings[currentIndex - 1], siblings[currentIndex]];
    } else if (direction === 'down' && currentIndex < siblings.length - 1) {
      [siblings[currentIndex], siblings[currentIndex + 1]] = [siblings[currentIndex + 1], siblings[currentIndex]];
    } else {
      return; 
    }
    
    const updatedSiblings = siblings.map((sibling, index) => ({...sibling, order: index}));

    const finalItems = items.map(originalItem => {
        const updated = updatedSiblings.find(us => us.id === originalItem.id);
        return updated || originalItem;
    });

    setItems(finalItems);
    
    const batch = firestore.batch();
    updatedSiblings.forEach(sibling => {
      const itemDocRef = firestore.doc(getCollectionPath.incomeExpenseDoc(currentUser.uid, project.id, sibling.id));
      batch.update(itemDocRef, { order: sibling.order });
    });

    try {
      await batch.commit();
    } catch (err) {
        console.error("Error reordering items:", err);
        setError("項目の並び替えに失敗しました。");
        setItems(initialItems.map(item => ({...item, depth: item.depth || 0, parentId: item.parentId || null })));
    }
  };

  const handleToggleCollapse = (parentId: string) => {
    setCollapsedParents(prev => {
      const newSet = new Set(prev);
      if (newSet.has(parentId)) {
        newSet.delete(parentId);
      } else {
        newSet.add(parentId);
      }
      return newSet;
    });
  };

  const handleColumnVisibilityChange = (column: keyof typeof visibleColumns, isVisible: boolean) => {
    setVisibleColumns(prev => ({ ...prev, [column]: isVisible }));
  };

  const handleSaveView = async () => {
    if (!currentUser) return;
    setIsSavingView(true);
    setError(null);
    try {
      const sheetDocRef = firestore.doc(getCollectionPath.incomeExpenseSheetDoc(currentUser.uid, project.id, sheet.id));
      await sheetDocRef.update({
        'viewPreferences.collapsedParents': Array.from(collapsedParents),
        'viewPreferences.visibleColumns': visibleColumns,
      });
    } catch (err) {
      console.error("Failed to save view preferences:", err);
      setError("ビュー設定の保存に失敗しました。");
    } finally {
      setIsSavingView(false);
    }
  };

  const visibleColumnOptions = [
    { key: 'purchase', label: '仕入' },
    { key: 'estimate', label: '見積' },
    { key: 'grossProfit', label: '粗利' },
  ] as const;
  
  const emptyStateColSpan = 5 + (visibleColumns.purchase ? 2 : 0) + (visibleColumns.estimate ? 2 : 0) + (visibleColumns.grossProfit ? 2 : 0);

  return (
    <div className="bg-white p-4 sm:p-6 space-y-6">
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pb-4 border-b border-slate-200">
          {visibleColumns.purchase && <div><p className="text-sm text-slate-500">仕入合計</p><p className="text-2xl font-semibold text-rose-800">{isNaN(totalPurchase) ? '-' : `¥${totalPurchase.toLocaleString()}`}</p></div>}
          {visibleColumns.estimate && <div><p className="text-sm text-slate-500">見積合計</p><p className="text-2xl font-semibold text-blue-800">{isNaN(totalEstimate) ? '-' : `¥${totalEstimate.toLocaleString()}`}</p></div>}
          {visibleColumns.grossProfit && <div><p className="text-sm text-slate-500">粗利益</p><p className={`text-2xl font-semibold ${grossProfit >= 0 ? 'text-amber-800' : 'text-red-600'}`}>{isNaN(grossProfit) ? '-' : `${grossProfit < 0 ? '-' : ''}¥${Math.abs(grossProfit).toLocaleString()}`}</p></div>}
          {visibleColumns.grossProfit && <div><p className="text-sm text-slate-500">粗利率</p><p className={`text-2xl font-semibold text-slate-800`}>{isNaN(grossProfitMargin) ? '-' : grossProfitMargin.toFixed(1)}%</p></div>}
        </div>
        
        {error && <p className="text-red-600 bg-red-100 p-3 rounded-md mb-4">{error}</p>}
        
        <div className="overflow-x-auto text-xs">
          <table className="min-w-full border-collapse table-fixed">
              <thead className="bg-slate-50 text-slate-600">
                  <tr>
                      <th rowSpan={2} className="p-2 text-left font-medium border-b-2 border-slate-200 w-[300px] align-bottom">概要</th>
                      <th rowSpan={2} className="p-2 w-40 text-left font-medium border-b-2 border-slate-200 align-bottom">数量/単位</th>
                      
                      {visibleColumns.purchase && <th colSpan={2} className="p-2 text-center font-semibold border-b-2 border-slate-200 bg-rose-200 text-rose-800">仕入</th>}
                      {visibleColumns.estimate && <th colSpan={2} className="p-2 text-center font-semibold border-b-2 border-slate-200 bg-blue-200 text-blue-800">見積</th>}
                      {visibleColumns.grossProfit && <th colSpan={2} className="p-2 text-center font-semibold border-b-2 border-slate-200 bg-amber-200 text-amber-800">粗利</th>}
                      
                      <th rowSpan={2} className="p-2 w-[150px] text-left font-medium border-b-2 border-slate-200 align-bottom">備考</th>
                      <th rowSpan={2} className="p-2 w-40 border-b-2 border-slate-200 align-bottom"></th>
                  </tr>
                  <tr>
                      {visibleColumns.purchase && <>
                          <th className="p-2 w-32 text-right font-medium border-b-2 border-slate-200 bg-rose-100">単価</th>
                          <th className="p-2 w-32 text-right font-medium border-b-2 border-slate-200 bg-rose-100">金額</th>
                      </>}
                      {visibleColumns.estimate && <>
                          <th className="p-2 w-32 text-right font-medium border-b-2 border-slate-200 bg-blue-100">単価</th>
                          <th className="p-2 w-32 text-right font-medium border-b-2 border-slate-200 bg-blue-100">金額</th>
                      </>}
                      {visibleColumns.grossProfit && <>
                          <th className="p-2 w-32 text-right font-medium border-b-2 border-slate-200 bg-amber-100">単価</th>
                          <th className="p-2 w-32 text-right font-medium border-b-2 border-slate-200 bg-amber-100">金額</th>
                      </>}
                  </tr>
              </thead>
            <tbody>
              {displayItems.map((item) => {
                const isItemEditing = editingItemId === item.id;
                const hasChildren = parentIdsWithChildren.has(item.id);

                const calculationStatus = item.calculationStatus || { purchase: false, estimate: false };
                const isPurchaseCalculated = calculationStatus.purchase;
                const isEstimateCalculated = calculationStatus.estimate;
                const isSummaryRow = isPurchaseCalculated || isEstimateCalculated;

                const purchaseAmount = isPurchaseCalculated ? item.purchaseUnitPrice : Number(item.purchaseUnitPrice) * Number(item.quantity);
                const estimateAmount = isEstimateCalculated ? item.estimateUnitPrice : Number(item.estimateUnitPrice) * Number(item.quantity);
                const itemGrossProfit = estimateAmount - purchaseAmount;
                
                const rowBgClass = isItemEditing ? 'bg-sky-50/50' : (item.depth === 0 ? 'bg-slate-50' : 'bg-white');
                
                const siblings = items.filter(i => i.parentId === item.parentId).sort((a,b) => (a.order ?? 0) - (b.order ?? 0));
                const currentIndex = siblings.findIndex(s => s.id === item.id);
                const canMoveUp = currentIndex > 0;
                const canMoveDown = currentIndex < siblings.length - 1;

                return (
                  <tr 
                    key={item.id} 
                    className={`${rowBgClass} group`}
                  >
                    <td className="p-2 text-left border-b border-slate-200 align-middle">
                      <div style={{ paddingLeft: `${(item.depth || 0) * 24}px` }} className="flex items-center gap-2">
                          {hasChildren ? (
                              <IconButton onClick={() => handleToggleCollapse(item.id)} className="w-5 h-5 p-0" aria-label={collapsedParents.has(item.id) ? '明細を展開' : '明細を折りたたむ'}>
                                  <ChevronDownIcon className={`transition-transform duration-200 ${collapsedParents.has(item.id) ? '-rotate-90' : ''}`} />
                              </IconButton>
                          ) : (
                              item.depth > 0 ?
                                  <span className="inline-flex items-center justify-center w-5 text-slate-500 text-xl font-bold flex-shrink-0">└</span> :
                                  <span className="w-5 h-5"></span>
                          )}
                          <div className="truncate flex-grow min-w-0" title={item.overview}>
                              <EditableField
                                  isEditing={isItemEditing}
                                  value={item.overview}
                                  onChange={(val) => handleItemChange(item.id, 'overview', val)}
                                  placeholder={item.depth > 0 ? '新規明細' : '新規項目'}
                                  inputRef={isItemEditing ? newItemOverviewRef : undefined}
                              />
                          </div>
                      </div>
                    </td>
                    <td className="p-2 text-left border-b border-slate-200 align-middle">
                       {!isSummaryRow ? (
                          <div className="flex items-center gap-1">
                            <EditableField isEditing={isItemEditing} value={Number(item.quantity)} onChange={(val) => handleItemChange(item.id, 'quantity', val)} inputType="number" inputClassName="w-16 text-right" placeholder="0" />
                            <EditableField isEditing={isItemEditing} value={item.unit} onChange={(val) => handleItemChange(item.id, 'unit', val)} inputClassName="w-16" placeholder="単位" />
                          </div>
                        ) : <span className="px-2 py-1 text-slate-400">1 式</span>
                      }
                    </td>

                    {/* Purchase */}
                    {visibleColumns.purchase && <>
                      <td className="p-2 text-right border-b border-slate-200 align-middle">
                        <EditableField
                          isEditing={isItemEditing}
                          value={Number(item.purchaseUnitPrice)}
                          onChange={(val) => handleItemChange(item.id, 'purchaseUnitPrice', val)}
                          inputType="number"
                          prefix="¥"
                          inputClassName="w-24 text-right"
                          placeholder="0"
                          readOnly={isPurchaseCalculated}
                        />
                      </td>
                      <td className="p-2 text-right border-b border-slate-200 align-middle text-rose-800">
                          {isNaN(purchaseAmount) ? '-' : `¥${purchaseAmount.toLocaleString()}`}
                      </td>
                    </>}
                    
                    {/* Estimate */}
                    {visibleColumns.estimate && <>
                      <td className="p-2 text-right border-b border-slate-200 align-middle">
                        <EditableField
                          isEditing={isItemEditing}
                          value={Number(item.estimateUnitPrice)}
                          onChange={(val) => handleItemChange(item.id, 'estimateUnitPrice', val)}
                          inputType="number"
                          prefix="¥"
                          inputClassName="w-24 text-right"
                          placeholder="0"
                          readOnly={isEstimateCalculated}
                        />
                      </td>
                      <td className="p-2 text-right border-b border-slate-200 align-middle text-blue-800">
                          {isNaN(estimateAmount) ? '-' : `¥${estimateAmount.toLocaleString()}`}
                      </td>
                    </>}
                    
                     {/* Gross Profit */}
                     {visibleColumns.grossProfit && <>
                      <td className={`p-2 text-right border-b border-slate-200 align-middle ${itemGrossProfit < 0 ? 'text-red-600' : 'text-red-600'}`}>
                        {!isSummaryRow && (isNaN(itemGrossProfit) ? '-' : `${itemGrossProfit < 0 ? '-' : ''}¥${Math.abs(itemGrossProfit / (Number(item.quantity) || 1)).toLocaleString(undefined, { maximumFractionDigits: 0 })}`)}
                      </td>
                      <td className={`p-2 text-right border-b border-slate-200 align-middle ${itemGrossProfit < 0 ? 'text-red-600' : 'text-amber-800'}`}>
                        {isNaN(itemGrossProfit) ? '-' : `${itemGrossProfit < 0 ? '-' : ''}¥${Math.abs(itemGrossProfit).toLocaleString()}`}
                      </td>
                    </>}

                    <td className="p-2 text-left border-b border-slate-200 align-middle">
                      <div className="w-[150px] overflow-x-auto whitespace-nowrap">
                          <EditableField isEditing={isItemEditing} value={item.notes || ''} onChange={(val) => handleItemChange(item.id, 'notes', val)} placeholder="-" inputClassName="w-full"/>
                      </div>
                    </td>
                    <td className="p-2 border-b border-slate-200 align-middle">
                      <div className="flex items-center justify-end opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-200">
                          {isItemEditing ? (
                              <>
                                  <IconButton onClick={() => handleUpdateItem(item.id)} aria-label="保存"><SaveIcon className="text-sky-600"/></IconButton>
                                  <IconButton onClick={() => handleCancelEdit(item.id)} aria-label="キャンセル"><CancelIcon /></IconButton>
                              </>
                          ) : (
                              <>
                                  <IconButton onClick={() => handleMoveItem(item.id, 'up')} disabled={!canMoveUp} aria-label="上に移動"><ArrowUpwardIcon /></IconButton>
                                  <IconButton onClick={() => handleMoveItem(item.id, 'down')} disabled={!canMoveDown} aria-label="下に移動"><ArrowDownwardIcon /></IconButton>
                                  <IconButton onClick={() => setEditingItemId(item.id)} aria-label="編集"><EditIcon /></IconButton>
                                  <IconButton onClick={() => handleAddItem(item.id, (item.depth || 0) + 1)} aria-label="明細追加"><PlaylistAddIcon /></IconButton>
                                  <IconButton onClick={() => handleDeleteItem(item.id)} className="hover:text-red-500" aria-label="削除"><TrashIcon /></IconButton>
                              </>
                          )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {displayItems.length === 0 && (
                  <tr>
                      <td colSpan={emptyStateColSpan} className="text-center py-12 text-slate-500">
                        <p>データがありません。</p>
                        <PrimaryButton onClick={() => handleAddItem()} icon={<PlusIcon />} className="mt-4">
                          最初の項目を追加
                        </PrimaryButton>
                      </td>
                  </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <div className="flex justify-between items-center pt-4">
        <PrimaryButton onClick={() => handleAddItem()} icon={<PlusIcon />}>
          項目を追加
        </PrimaryButton>
        <div className="flex justify-end items-center gap-2">
            <SecondaryButton
                icon={<SaveIcon />}
                onClick={handleSaveView}
                disabled={isSavingView}
            >
                {isSavingView ? '保存中...' : '現在の表示を保存'}
            </SecondaryButton>
            <div className="relative">
              <SecondaryButton icon={<FilterListIcon />} onClick={() => setShowColumnFilter(!showColumnFilter)}>
                表示列の管理
              </SecondaryButton>
              {showColumnFilter && (
                <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-200 rounded-md shadow-lg z-20 py-2">
                  <p className="px-4 py-2 text-sm font-semibold text-slate-700 border-b border-slate-200">表示グループを選択</p>
                  <div className="px-4 py-2 space-y-2">
                  {visibleColumnOptions.map(col => (
                    <label key={col.key} className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={visibleColumns[col.key]}
                        onChange={(e) => handleColumnVisibilityChange(col.key, e.target.checked)}
                        className="h-4 w-4 text-sky-600 border-slate-300 rounded focus:ring-sky-500"
                      />
                      <span className="text-sm text-slate-600">{col.label}</span>
                    </label>
                  ))}
                  </div>
                </div>
              )}
            </div>
        </div>
      </div>
    </div>
  );
};

export default IncomeExpenseManagementTab;