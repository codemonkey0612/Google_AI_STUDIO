import { Client, Project, ProjectType, IncomeExpenseItem, ScheduleTask } from './types';

// Dummy data is no longer the primary source when user is logged in.
// It can be used for reference or for UI development without auth, but
// Firestore will be the source of truth.
// For simplicity, we'll keep them here but note they might not align with Firestore structure directly
// (e.g. missing userId, projectId) after Firestore integration.

export const DUMMY_CLIENTS: Client[] = [
  // { id: 'client-1', name: 'クライアントA', userId: 'dummyUser' },
];

export const DUMMY_PROJECTS: Project[] = [
  // { id: 'project-1a', clientId: 'client-1', userId: 'dummyUser', name: 'プロジェクトA 詳細', types: [ProjectType.AdCampaign], dueDate: '2024-12-31' },
];

export const DUMMY_INCOME_EXPENSE_ITEMS: IncomeExpenseItem[] = [
 /* { 
    id: 'ie-1', 
    overview: 'ポスターデザイン制作', 
    quantity: 1, 
    unit: '式', 
    purchaseUnitPrice: 0, 
    saleUnitPrice: 75000, 
    supplier: 'デザイン会社Y', 
    notes: '初期デザイン案, バナーも',
    projectId: 'project-1a',
    userId: 'dummyUser'
  },*/
];


export const DUMMY_SCHEDULE_TASKS: ScheduleTask[] = [
  //{ id: 'task-1', name: '企画立案フェーズ', startDate: '2024-10-01', endDate: '2024-10-07', isDisplayed: true, projectId: 'project-1a', userId: 'dummyUser' },
];

export const JAPANESE_PUBLIC_HOLIDAYS: Array<{ date: string, name: string }> = [
  // 2023
  { date: '2023-01-01', name: '元日' },
  { date: '2023-01-02', name: '振替休日' },
  { date: '2023-01-09', name: '成人の日' },
  { date: '2023-02-11', name: '建国記念の日' },
  { date: '2023-02-23', name: '天皇誕生日' },
  { date: '2023-03-21', name: '春分の日' },
  { date: '2023-04-29', name: '昭和の日' },
  { date: '2023-05-03', name: '憲法記念日' },
  { date: '2023-05-04', name: 'みどりの日' },
  { date: '2023-05-05', name: 'こどもの日' },
  { date: '2023-07-17', name: '海の日' },
  { date: '2023-08-11', name: '山の日' },
  { date: '2023-09-18', name: '敬老の日' },
  { date: '2023-09-23', name: '秋分の日' },
  { date: '2023-10-09', name: 'スポーツの日' },
  { date: '2023-11-03', name: '文化の日' },
  { date: '2023-11-23', name: '勤労感謝の日' },
  // 2024
  { date: '2024-01-01', name: '元日' },
  { date: '2024-01-08', name: '成人の日' },
  { date: '2024-02-11', name: '建国記念の日' },
  { date: '2024-02-12', name: '振替休日' },
  { date: '2024-02-23', name: '天皇誕生日' },
  { date: '2024-03-20', name: '春分の日' },
  { date: '2024-04-29', name: '昭和の日' },
  { date: '2024-05-03', name: '憲法記念日' },
  { date: '2024-05-04', name: 'みどりの日' },
  { date: '2024-05-05', name: 'こどもの日' },
  { date: '2024-05-06', name: '振替休日' },
  { date: '2024-07-15', name: '海の日' },
  { date: '2024-08-11', name: '山の日' },
  { date: '2024-08-12', name: '振替休日' },
  { date: '2024-09-16', name: '敬老の日' },
  { date: '2024-09-22', name: '秋分の日' },
  { date: '2024-09-23', name: '振替休日' },
  { date: '2024-10-14', name: 'スポーツの日' },
  { date: '2024-11-03', name: '文化の日' },
  { date: '2024-11-04', name: '振替休日' },
  { date: '2024-11-23', name: '勤労感謝の日' },
  // 2025
  { date: '2025-01-01', name: '元日' },
  { date: '2025-01-13', name: '成人の日' },
  { date: '2025-02-11', name: '建国記念の日' },
  { date: '2025-02-24', name: '振替休日' },
  { date: '2025-03-20', name: '春分の日' },
  { date: '2025-04-29', name: '昭和の日' },
  { date: '2025-05-03', name: '憲法記念日' },
  { date: '2025-05-04', name: 'みどりの日' },
  { date: '2025-05-05', name: 'こどもの日' },
  { date: '2025-05-06', name: '振替休日' },
  { date: '2025-07-21', name: '海の日' },
  { date: '2025-08-11', name: '山の日' },
  { date: '2025-09-15', name: '敬老の日' },
  { date: '2025-09-23', name: '秋分の日' },
  { date: '2025-10-13', name: 'スポーツの日' },
  { date: '2025-11-03', name: '文化の日' },
  { date: '2025-11-24', name: '振替休日' },
  // 2026
  { date: '2026-01-01', name: '元日' },
  { date: '2026-01-12', name: '成人の日' },
  { date: '2026-02-11', name: '建国記念の日' },
  { date: '2026-02-23', name: '天皇誕生日' },
  { date: '2026-03-20', name: '春分の日' },
  { date: '2026-04-29', name: '昭和の日' },
  { date: '2026-05-03', name: '憲法記念日' },
  { date: '2026-05-04', name: 'みどりの日' },
  { date: '2026-05-05', name: 'こどもの日' },
  { date: '2026-05-06', name: '振替休日' },
  { date: '2026-07-20', name: '海の日' },
  { date: '2026-08-11', name: '山の日' },
  { date: '2026-09-21', name: '敬老の日' },
  { date: '2026-09-23', name: '秋分の日' },
  { date: '2026-10-12', name: 'スポーツの日' },
  { date: '2026-11-03', name: '文化の日' },
  { date: '2026-11-23', name: '勤労感謝の日' },
];
