import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import 'firebase/compat/storage';

// IMPORTANT: Replace this with your actual Firebase project configuration!
// You can get this from the Firebase console:
// Project settings > General > Your apps > Firebase SDK snippet > Config
const firebaseConfig = {
  apiKey: "AIzaSyDEoNwZ5Scdx3Gx-rqXwtqZAp-cIxB2OMw",
  authDomain: "projectmanagementsystem-3820.firebaseapp.com",
  projectId: "projectmanagementsystem-3820",
  storageBucket: "projectmanagementsystem-3820.appspot.com",
  messagingSenderId: "46472240769",
  appId: "1:46472240769:web:514e1e85f550b0c95ab780"
};

// **Critical Check for Placeholder Values**
// Adjusted to only check for generic placeholders, assuming user-provided values might be valid for their specific (sample) project.
const IS_GENERIC_PLACEHOLDER_CONFIG =
  firebaseConfig.apiKey === "YOUR_API_KEY" ||
  firebaseConfig.authDomain === "YOUR_AUTH_DOMAIN" ||
  firebaseConfig.projectId === "YOUR_PROJECT_ID" ||
  firebaseConfig.storageBucket === "YOUR_STORAGE_BUCKET" ||
  firebaseConfig.messagingSenderId === "YOUR_MESSAGING_SENDER_ID" ||
  firebaseConfig.appId === "YOUR_APP_ID";

if (IS_GENERIC_PLACEHOLDER_CONFIG) {
  const errorMessage = `
******************************************************************************************
CRITICAL FIREBASE CONFIGURATION ERROR:
Your firebase.ts file still contains generic placeholder values
(e.g., apiKey: "YOUR_API_KEY", projectId: "YOUR_PROJECT_ID").
You MUST replace these with your actual Firebase project's configuration
values from the Firebase console (Project settings > General > Your apps > Config).
The application cannot initialize Firebase and will not work until this is corrected.
******************************************************************************************
  `;
  console.error(errorMessage);
  throw new Error(errorMessage.replace(/\*/g, '')); // Throw error to halt execution
}

let app: firebase.app.App;
if (!firebase.apps.length) {
  app = firebase.initializeApp(firebaseConfig);
} else {
  app = firebase.app();
}

const auth = firebase.auth();
const firestore = firebase.firestore();
const storage = firebase.storage();


// Firestore collection path helpers (remain largely the same conceptually)
const getCollectionPath = {
  userRoot: (userId: string) => `users/${userId}`,
  clients: (userId: string) => `${getCollectionPath.userRoot(userId)}/clients`,
  clientDoc: (userId: string, clientId: string) => `${getCollectionPath.clients(userId)}/${clientId}`,
  
  projects: (userId: string, clientId: string) => `${getCollectionPath.clientDoc(userId, clientId)}/projects`,
  projectDoc: (userId: string, clientId: string, projectId: string) => `${getCollectionPath.projects(userId, clientId)}/${projectId}`,
  
  incomeExpenses: (userId: string, projectId: string) => `${getCollectionPath.userRoot(userId)}/incomeExpenses/${projectId}/items`,
  incomeExpenseDoc: (userId: string, projectId: string, itemId: string) => `${getCollectionPath.incomeExpenses(userId, projectId)}/${itemId}`,
  incomeExpenseSheets: (userId: string, projectId: string) => `${getCollectionPath.userRoot(userId)}/incomeExpenseSheets/${projectId}/sheets`,
  incomeExpenseSheetDoc: (userId: string, projectId: string, sheetId: string) => `${getCollectionPath.incomeExpenseSheets(userId, projectId)}/${sheetId}`,

  broadcasts: (userId: string, projectId: string) => `${getCollectionPath.userRoot(userId)}/broadcasts/${projectId}/items`,
  broadcastDoc: (userId: string, projectId: string, broadcastId: string) => `${getCollectionPath.broadcasts(userId, projectId)}/${broadcastId}`,

  scheduleTasks: (userId: string, projectId: string) => `${getCollectionPath.userRoot(userId)}/scheduleTasks/${projectId}/tasks`,
  scheduleTaskDoc: (userId: string, projectId: string, taskId: string) => `${getCollectionPath.scheduleTasks(userId, projectId)}/${taskId}`,
  scheduleSheets: (userId: string, projectId: string) => `${getCollectionPath.userRoot(userId)}/scheduleSheets/${projectId}/sheets`,
  scheduleSheetDoc: (userId: string, projectId: string, sheetId: string) => `${getCollectionPath.scheduleSheets(userId, projectId)}/${sheetId}`,
  
  timeScheduleSheets: (userId: string, projectId: string) => `${getCollectionPath.userRoot(userId)}/timeScheduleSheets/${projectId}/sheets`,
  timeScheduleSheetDoc: (userId: string, projectId: string, sheetId: string) => `${getCollectionPath.timeScheduleSheets(userId, projectId)}/${sheetId}`,
  timeScheduleEntries: (userId: string, projectId: string) => `${getCollectionPath.userRoot(userId)}/timeScheduleEntries/${projectId}/entries`,
  timeScheduleEntryDoc: (userId: string, projectId: string, entryId: string) => `${getCollectionPath.timeScheduleEntries(userId, projectId)}/${entryId}`,
  timeScheduleSections: (userId: string, projectId: string, sheetId: string) => `${getCollectionPath.timeScheduleSheetDoc(userId, projectId, sheetId)}/sections`,
  timeScheduleSectionDoc: (userId: string, projectId: string, sheetId: string, sectionId: string) => `${getCollectionPath.timeScheduleSections(userId, projectId, sheetId)}/${sectionId}`,


  kpiItems: (userId: string, projectId: string) => `${getCollectionPath.userRoot(userId)}/kpiItems/${projectId}/items`,
  kpiItemDoc: (userId: string, projectId: string, itemId: string) => `${getCollectionPath.kpiItems(userId, projectId)}/${itemId}`,

  // FIX: Add missing kpiCustomColumns and kpiCustomColumnDoc path helpers.
  kpiCustomColumns: (userId: string, projectId: string) => `${getCollectionPath.userRoot(userId)}/kpiCustomColumns/${projectId}/items`,
  kpiCustomColumnDoc: (userId: string, projectId: string, columnId: string) => `${getCollectionPath.kpiCustomColumns(userId, projectId)}/${columnId}`,

  kpiRecords: (userId: string, projectId: string) => `${getCollectionPath.userRoot(userId)}/kpiRecords/${projectId}/items`,
  kpiRecordDoc: (userId: string, projectId: string, recordId: string) => `${getCollectionPath.kpiRecords(userId, projectId)}/${recordId}`,
  
  kpiSheets: (userId: string, projectId: string) => `${getCollectionPath.userRoot(userId)}/kpiSheets/${projectId}/sheets`,
  kpiSheetDoc: (userId: string, projectId: string, sheetId: string) => `${getCollectionPath.kpiSheets(userId, projectId)}/${sheetId}`,

  kpiMeasures: (userId: string, projectId: string, recordId: string) => `${getCollectionPath.kpiRecordDoc(userId, projectId, recordId)}/measures`,
  kpiMeasureDoc: (userId: string, projectId: string, recordId: string, measureId: string) => `${getCollectionPath.kpiMeasures(userId, projectId, recordId)}/${measureId}`,
  
  kpiMeasureColumns: (userId: string, projectId: string, recordId: string, measureId: string) => `${getCollectionPath.kpiMeasureDoc(userId, projectId, recordId, measureId)}/columns`,
  kpiMeasureColumnDoc: (userId: string, projectId: string, recordId: string, measureId: string, columnId: string) => `${getCollectionPath.kpiMeasureColumns(userId, projectId, recordId, measureId)}/${columnId}`,
  
  kpiMeasureRows: (userId: string, projectId: string, recordId: string, measureId: string) => `${getCollectionPath.kpiMeasureDoc(userId, projectId, recordId, measureId)}/rows`,
  kpiMeasureRowDoc: (userId: string, projectId: string, recordId: string, measureId: string, rowId: string) => `${getCollectionPath.kpiMeasureRows(userId, projectId, recordId, measureId)}/${rowId}`,

  // Sub-measures within a KpiMeasureRow
  kpiMeasureRowSubMeasures: (userId: string, projectId: string, recordId: string, measureId: string, rowId: string) => `${getCollectionPath.kpiMeasureRowDoc(userId, projectId, recordId, measureId, rowId)}/measures`,
  kpiMeasureRowSubMeasureDoc: (userId: string, projectId: string, recordId: string, measureId: string, rowId: string, subMeasureId: string) => `${getCollectionPath.kpiMeasureRowSubMeasures(userId, projectId, recordId, measureId, rowId)}/${subMeasureId}`,
  
  kpiMeasureRowSubMeasureColumns: (userId: string, projectId: string, recordId: string, measureId: string, rowId: string, subMeasureId: string) => `${getCollectionPath.kpiMeasureRowSubMeasureDoc(userId, projectId, recordId, measureId, rowId, subMeasureId)}/columns`,
  kpiMeasureRowSubMeasureColumnDoc: (userId: string, projectId: string, recordId: string, measureId: string, rowId: string, subMeasureId: string, columnId: string) => `${getCollectionPath.kpiMeasureRowSubMeasureColumns(userId, projectId, recordId, measureId, rowId, subMeasureId)}/${columnId}`,
  
  kpiMeasureRowSubMeasureRows: (userId: string, projectId: string, recordId: string, measureId: string, rowId: string, subMeasureId: string) => `${getCollectionPath.kpiMeasureRowSubMeasureDoc(userId, projectId, recordId, measureId, rowId, subMeasureId)}/rows`,
  kpiMeasureRowSubMeasureRowDoc: (userId: string, projectId: string, recordId: string, measureId: string, rowId: string, subMeasureId: string, subRowId: string) => `${getCollectionPath.kpiMeasureRowSubMeasureRows(userId, projectId, recordId, measureId, rowId, subMeasureId)}/${subRowId}`,

  kpiMeasureMasters: (userId: string, projectId: string) => `${getCollectionPath.userRoot(userId)}/kpiMeasureMasters/${projectId}/items`,
  kpiMeasureMasterDoc: (userId: string, projectId: string, masterId: string) => `${getCollectionPath.kpiMeasureMasters(userId, projectId)}/${masterId}`,
  
  itemMasters: (userId: string, projectId: string) => `${getCollectionPath.userRoot(userId)}/itemMasters/${projectId}/items`,
  itemMasterDoc: (userId: string, projectId: string, masterId: string) => `${getCollectionPath.itemMasters(userId, projectId)}/${masterId}`,

  memos: (userId: string, projectId: string) => `${getCollectionPath.userRoot(userId)}/memos/${projectId}/items`,
  memoDoc: (userId: string, projectId: string, memoId: string) => `${getCollectionPath.memos(userId, projectId)}/${memoId}`,
  
  memoGroups: (userId: string, projectId: string) => `${getCollectionPath.userRoot(userId)}/memoGroups/${projectId}/groups`,
  memoGroupDoc: (userId: string, projectId: string, groupId: string) => `${getCollectionPath.memoGroups(userId, projectId)}/${groupId}`,

  bookmarks: (userId: string, projectId: string) => `${getCollectionPath.userRoot(userId)}/bookmarks/${projectId}/items`,
  bookmarkDoc: (userId: string, projectId: string, bookmarkId: string) => `${getCollectionPath.bookmarks(userId, projectId)}/${bookmarkId}`,
  bookmarkGroups: (userId: string, projectId: string) => `${getCollectionPath.userRoot(userId)}/bookmarkGroups/${projectId}/groups`,
  bookmarkGroupDoc: (userId: string, projectId: string, groupId: string) => `${getCollectionPath.bookmarkGroups(userId, projectId)}/${groupId}`,

  files: (userId: string, projectId: string) => `${getCollectionPath.userRoot(userId)}/files/${projectId}/items`,
  fileDoc: (userId: string, projectId: string, fileId: string) => `${getCollectionPath.files(userId, projectId)}/${fileId}`,
  fileGroups: (userId: string, projectId: string) => `${getCollectionPath.userRoot(userId)}/fileGroups/${projectId}/groups`,
  fileGroupDoc: (userId: string, projectId: string, groupId: string) => `${getCollectionPath.fileGroups(userId, projectId)}/${groupId}`,
};


export { app, auth, firestore, storage, getCollectionPath, firebase };
// Export `firebase/app`'s initializeApp if needed elsewhere, though usually not.
// Export specific functions from 'firebase/auth' and 'firebase/firestore' directly in components where needed e.g.
// import { collection, doc, getDoc, setDoc } from 'firebase/firestore';
// import { createUserWithEmailAndPassword } from 'firebase/auth';