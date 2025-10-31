import { firebase, firestore, getCollectionPath } from '../../firebase';
import { KpiMeasure, Project, User } from '../../types';

/**
 * Deeply copies a KPI measure, including all its columns, rows, and nested sub-measures.
 * Can be used for duplicating within the same record or copying from another record.
 */
export const copyMeasureDeep = async (
    batch: firebase.firestore.WriteBatch,
    currentUser: User,
    projectId: string,
    source: { recordId: string; measureId: string; parentMeasureId?: string; parentRowId?: string; },
    destination: { recordId: string; newName: string; newOrder: number; parentMeasureId?: string; parentRowId?: string; }
) => {
    // 1. Get original measure doc
    let originalMeasureDocRef: firebase.firestore.DocumentReference;
    if (source.parentRowId && source.parentMeasureId) {
        originalMeasureDocRef = firestore.doc(getCollectionPath.kpiMeasureRowSubMeasureDoc(currentUser.uid, projectId, source.recordId, source.parentMeasureId, source.parentRowId, source.measureId));
    } else {
        originalMeasureDocRef = firestore.doc(getCollectionPath.kpiMeasureDoc(currentUser.uid, projectId, source.recordId, source.measureId));
    }
    const originalMeasureDoc = await originalMeasureDocRef.get();
    if (!originalMeasureDoc.exists) throw new Error("複製元の施策が見つかりません。");
    const originalMeasureData = originalMeasureDoc.data() as KpiMeasure;

    // 2. Prepare new measure data (remove original id, update name and order)
    const { id, ...newMeasureData } = { ...originalMeasureData };
    newMeasureData.name = destination.newName;
    newMeasureData.order = destination.newOrder;
    newMeasureData.kpiRecordId = destination.recordId;
    
    // 3. Get new measure collection path and create new doc in batch
    let newMeasureCollectionPath: string;
    if (destination.parentRowId && destination.parentMeasureId) {
        newMeasureCollectionPath = getCollectionPath.kpiMeasureRowSubMeasures(currentUser.uid, projectId, destination.recordId, destination.parentMeasureId, destination.parentRowId);
    } else {
        newMeasureCollectionPath = getCollectionPath.kpiMeasures(currentUser.uid, projectId, destination.recordId);
    }
    const newMeasureRef = firestore.collection(newMeasureCollectionPath).doc();
    batch.set(newMeasureRef, newMeasureData);

    // 4. Recursive function to copy all sub-collections (columns, rows, and nested measures)
    const copyContents = async (
        originalParentRef: firebase.firestore.DocumentReference,
        newParentRef: firebase.firestore.DocumentReference
    ) => {
        // Copy columns
        const columnsSnapshot = await originalParentRef.collection('columns').get();
        columnsSnapshot.forEach(doc => {
            batch.set(newParentRef.collection('columns').doc(), doc.data());
        });

        // Copy rows
        const rowsSnapshot = await originalParentRef.collection('rows').get();
        for (const rowDoc of rowsSnapshot.docs) {
            const newRowRef = newParentRef.collection('rows').doc();
            batch.set(newRowRef, rowDoc.data());

            // Recursively copy sub-measures for each row
            const subMeasuresSnapshot = await rowDoc.ref.collection('measures').get();
            for (const subMeasureDoc of subMeasuresSnapshot.docs) {
                const newSubMeasureRef = newRowRef.collection('measures').doc();
                batch.set(newSubMeasureRef, subMeasureDoc.data());
                // Recurse!
                await copyContents(subMeasureDoc.ref, newSubMeasureRef);
            }
        }
    };

    // 5. Start recursive copy from the top-level measure
    await copyContents(originalMeasureDocRef, newMeasureRef);
};