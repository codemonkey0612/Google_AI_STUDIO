

// FIX: Define and export the User interface and remove circular import.
export interface User {
  uid: string;
  email: string | null;
}

export interface Client {
  id: string;
  name: string;
  userId: string;
  order: number;
}

export enum ProjectType {
  Website = 'ウェブサイト制作',
  AdCampaign = '広告キャンペーン',
  SystemDevelopment = 'システム開発',
  Other = 'その他',
}

export interface Project {
  id: string;
  clientId: string;
  userId: string;
  name: string;
  types?: ProjectType[];
  otherTypeName?: string;
  dueDate?: string;
  order: number;
}

export interface BaseSheet {
  id: string;
  projectId: string;
  userId: string;
  name: string;
  order: number;
}
export interface IncomeExpenseSheet extends BaseSheet {
  viewPreferences?: {
    collapsedParents?: string[];
    visibleColumns?: {
      purchase: boolean;
      estimate: boolean;
      grossProfit: boolean;
    };
  };
}
export interface ScheduleSheet extends BaseSheet {
  viewPreferences?: {
    viewMode?: 'daily' | 'weekly' | 'monthly';
  };
}
export interface KpiSheet extends BaseSheet {
  viewPreferences?: {
    visibleComparisons?: Record<string, { prevMonth: boolean; lastYear: boolean }>;
    filters?: {
      type: 'range' | 'month';
      startDate: string | null;
      endDate: string | null;
      startMonth: string | null;
      endMonth: string | null;
    };
  };
}

export interface TimeScheduleSheet extends BaseSheet {
  dates: string[];
  viewPreferences?: {
    startHour?: number;
    endHour?: number;
    timeGridMinutes?: 5 | 10 | 15 | 30;
    hiddenSectionIds?: string[];
  };
}

export interface TimeScheduleSection {
  id: string;
  sheetId: string;
  projectId: string;
  userId: string;
  name: string;
  order: number;
  color: string;
}


export interface IncomeExpenseItem {
  id:string;
  overview: string;
  quantity: number;
  unit: string;
  purchaseUnitPrice: number;
  estimateUnitPrice?: number;
  saleUnitPrice?: number;
  supplier?: string;
  notes?: string;
  projectId: string;
  userId: string;
  order: number;
  depth: number;
  parentId: string | null;
  sheetId?: string;
  isEditing?: boolean;
}

export interface ScheduleTask {
  id: string;
  name: string;
  startDate: string | null;
  endDate: string | null;
  isDisplayed?: boolean;
  projectId: string;
  userId: string;
  order: number;
  depth: number;
  parentId: string | null;
  isSectionHeader: boolean;
  isCollapsed: boolean;
  color?: string;
  sheetId?: string;
  isEditing?: boolean;
}

export interface TimeScheduleEntry {
  id: string;
  sheetId: string;
  projectId: string;
  userId: string;
  title: string;
  date: string; // "YYYY-MM-DD"
  startTime: string; // "HH:mm"
  endTime: string; // "HH:mm"
  description?: string;
  location?: string;
  color: string;
  sectionId?: string | null;
  parentId: string | null;
  depth: number;
}

export enum ProjectDetailTab {
  IncomeExpense = '収支管理',
  Schedule = 'スケジュール',
  Kpi = 'KPI管理',
  Memo = 'メモ',
  Bookmark = 'ブックマーク',
  File = 'ファイル',
}

export interface KpiItem {
  id: string;
  projectId: string;
  userId: string;
  name: string;
  description?: string;
  order: number;
  sheetId?: string;
}

export interface KpiCustomColumn {
    id: string;
    projectId: string;
    userId: string;
    name: string;
    type: 'text' | 'image';
    order: number;
    isVisible: boolean;
    sheetId?: string;
}

export interface KpiRecord {
    id: string;
    projectId: string;
    userId: string;
    startDate: string;
    endDate: string;
    periodLabel: string;
    values: { [kpiItemId: string]: number | null };
    customColumns: { [customColumnId: string]: string };
    order?: number;
    createdAt?: any;
    sheetId?: string;
    isEditing?: boolean;
}

export interface KpiMeasureColumn {
    id: string;
    projectId: string;
    userId: string;
    kpiMeasureId: string;
    name: string;
    type: 'text' | 'number' | 'date' | 'image' | 'kpi';
    order: number;
    isEditing?: boolean;
}

export interface KpiMeasureRow {
    id: string;
    projectId: string;
    userId: string;
    kpiMeasureId: string;
    name: string;
    order: number;
    values: { [columnId: string]: string | number | null };
    masterRowId?: string;
}

export interface KpiMeasure {
    id: string;
    projectId: string;
    userId: string;
    kpiRecordId: string;
    name: string;
    order: number;
    masterId: string | null;
    viewPreferences?: {
      visibleComparisons?: Record<string, { prevMonth: boolean; lastYear: boolean }>;
      hiddenRowIds?: string[];
      hiddenColumnIds?: string[];
    };
}

export interface KpiMeasureMaster {
    id: string;
    projectId: string;
    userId: string;
    name: string;
    columns: Array<{
        id: string;
        name: string;
        type: KpiMeasureColumn['type'];
        order: number;
    }>;
    rows: Array<{
        id: string;
        name: string;
        order: number;
    }>;
}

export interface ItemMaster {
    id: string;
    projectId: string;
    userId: string;
    name: string;
}

export interface Memo {
  id: string;
  projectId: string;
  userId: string;
  title: string;
  content: string;
  color: string;
  createdAt: any;
  updatedAt: any;
  order: number;
  groupId: string | null;
}

export interface MemoGroup {
  id: string;
  projectId: string;
  userId: string;
  name: string;
  order: number;
}

export interface BookmarkGroup {
  id: string;
  projectId: string;
  userId: string;
  name: string;
  order: number;
}

export interface FileGroup {
  id: string;
  projectId: string;
  userId: string;
  name: string;
  order: number;
}

export interface Bookmark {
  id: string;
  projectId: string;
  userId: string;
  url: string;
  title: string;
  description: string;
  createdAt: any;
  order: number;
  groupId: string | null;
}

export interface ProjectFile {
  id: string;
  projectId: string;
  userId: string;
  name: string;
  description: string;
  url: string;
  storagePath: string;
  size: number;
  type: string;
  createdAt: any;
  order: number;
  groupId: string | null;
}