import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Client } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { firestore, getCollectionPath, storage } from '../firebase';
import Modal from '../components/Modal';
import { PlusIcon, EditIcon, TrashIcon } from '../components/Icons';
import { PrimaryButton, SecondaryButton, IconButton } from '../components/common/Buttons';
import LoadingSpinner from '../components/common/LoadingSpinner';

const ClientListPage: React.FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  const [showClientModal, setShowClientModal] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [clientModalName, setClientModalName] = useState('');
  const [clientModalError, setClientModalError] = useState<string | null>(null);
  const clientNameInputRef = useRef<HTMLInputElement>(null);
  const draggedItemIndex = useRef<number | null>(null);
  const dropTargetIndex = useRef<number | null>(null);


  useEffect(() => {
    if (!currentUser) return;
    setIsLoading(true);
    const clientsPath = getCollectionPath.clients(currentUser.uid);
    const q = firestore.collection(clientsPath).orderBy("order");
    
    const unsubscribe = q.onSnapshot((snapshot) => {
      const fetchedClients = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Client));
      setClients(fetchedClients);
      setError(null);
      setIsLoading(false);
    }, (err) => {
      console.error("Error fetching clients:", err);
      setError("クライアントの読み込みに失敗しました。");
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, [currentUser]);

  const resetClientModalState = () => {
    setEditingClient(null);
    setClientModalName('');
    setClientModalError(null);
  }

  const openAddClientModal = () => {
    resetClientModalState();
    setShowClientModal(true);
    setTimeout(() => clientNameInputRef.current?.focus(), 50);
  };

  const openEditClientModal = (client: Client) => {
    setEditingClient(client);
    setClientModalName(client.name);
    setShowClientModal(true);
    setClientModalError(null);
    setTimeout(() => clientNameInputRef.current?.focus(), 50);
  };
  
  const handleSaveClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientModalName.trim() || !currentUser) {
        setClientModalError("クライアント名は必須です。");
        return;
    }
    setClientModalError(null);
    const trimmedName = clientModalName.trim();
    let success = false;
    try {
        if (editingClient) { 
            const clientDocRef = firestore.doc(getCollectionPath.clientDoc(currentUser.uid, editingClient.id));
            await clientDocRef.update({ name: trimmedName });
        } else { 
            const clientsPath = getCollectionPath.clients(currentUser.uid);
            const newOrder = clients.length;
            await firestore.collection(clientsPath).add({ name: trimmedName, userId: currentUser.uid, order: newOrder });
        }
        success = true;
    } catch (err) {
        console.error("Error saving client:", err);
        setClientModalError(editingClient ? "クライアントの更新に失敗しました。" : "クライアントの追加に失敗しました。");
    } finally {
        if (success || !editingClient) { 
             setShowClientModal(false);
             resetClientModalState();
        } else if (editingClient && !success) {
            // For edit errors, keep modal open with error
        }
    }
  };

  const handleDeleteClient = async (clientId: string) => {
    if (!currentUser || !window.confirm("このクライアントと関連する全てのプロジェクトを削除しますか？この操作は元に戻せません。")) return;
    
    // Optimistic UI update
    const originalClients = [...clients];
    setClients(prevClients => prevClients.filter(c => c.id !== clientId));
    setError(null);
    
    try {
      const batch = firestore.batch();
      const clientDocRef = firestore.doc(getCollectionPath.clientDoc(currentUser.uid, clientId));
    
      const projectsPath = getCollectionPath.projects(currentUser.uid, clientId);
      const projectsSnapshot = await firestore.collection(projectsPath).get();
    
      for (const projectDocSnap of projectsSnapshot.docs) {
        const projectId = projectDocSnap.id;
        
        // --- Nested Project Deletion Logic ---

        // Handle storage file deletion first
        const filesPath = getCollectionPath.files(currentUser.uid, projectId);
        const filesSnapshot = await firestore.collection(filesPath).get();
        for (const fileDoc of filesSnapshot.docs) {
            const data = fileDoc.data();
            if (data.storagePath) {
                try {
                    await storage.ref(data.storagePath).delete();
                } catch (e) {
                    console.warn(`Storage file deletion failed for ${data.storagePath}, continuing Firestore cleanup.`);
                }
            }
        }
        
        const projectDocRef = firestore.doc(getCollectionPath.projectDoc(currentUser.uid, clientId, projectId));
        const collectionsToClear = [
          getCollectionPath.incomeExpenses(currentUser.uid, projectId),
          getCollectionPath.broadcasts(currentUser.uid, projectId),
          getCollectionPath.scheduleTasks(currentUser.uid, projectId),
          getCollectionPath.kpiItems(currentUser.uid, projectId),
          getCollectionPath.kpiCustomColumns(currentUser.uid, projectId),
          getCollectionPath.kpiMeasureMasters(currentUser.uid, projectId),
          getCollectionPath.files(currentUser.uid, projectId),
        ];
        
        for (const path of collectionsToClear) {
          const snapshot = await firestore.collection(path).get();
          snapshot.docs.forEach(d => batch.delete(d.ref));
        }

        const kpiRecordsPath = getCollectionPath.kpiRecords(currentUser.uid, projectId);
        const kpiRecordsSnapshot = await firestore.collection(kpiRecordsPath).get();
        for (const recordDoc of kpiRecordsSnapshot.docs) {
          const kpiMeasuresPath = getCollectionPath.kpiMeasures(currentUser.uid, projectId, recordDoc.id);
          const measuresSnapshot = await firestore.collection(kpiMeasuresPath).get();
          for(const measureDoc of measuresSnapshot.docs) {
            const measureId = measureDoc.id;
            const columnsPath = getCollectionPath.kpiMeasureColumns(currentUser.uid, projectId, recordDoc.id, measureId);
            const columnsSnapshot = await firestore.collection(columnsPath).get();
            columnsSnapshot.docs.forEach(d => batch.delete(d.ref));

            const rowsPath = getCollectionPath.kpiMeasureRows(currentUser.uid, projectId, recordDoc.id, measureId);
            const rowsSnapshot = await firestore.collection(rowsPath).get();
            rowsSnapshot.docs.forEach(d => batch.delete(d.ref));
            batch.delete(measureDoc.ref);
          }
          batch.delete(recordDoc.ref);
        }
        
        batch.delete(projectDocRef);
        // --- End Nested Project Deletion Logic ---
      }
      batch.delete(clientDocRef); 
      await batch.commit();
    } catch (err) {
      console.error("Error deleting client and related data:", err);
      setError("クライアントの削除に失敗しました。");
      setClients(originalClients); // Revert on failure
    }
  };
  
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    draggedItemIndex.current = index;
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnter = (index: number) => {
    dropTargetIndex.current = index;
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };
  
  const handleDragEnd = async () => {
    const draggedIdx = draggedItemIndex.current;
    const targetIdx = dropTargetIndex.current;

    draggedItemIndex.current = null;
    dropTargetIndex.current = null;

    if (draggedIdx === null || targetIdx === null || draggedIdx === targetIdx) return;
    
    const reorderedClients = [...clients];
    const [draggedItem] = reorderedClients.splice(draggedIdx, 1);
    reorderedClients.splice(targetIdx, 0, draggedItem);
    
    // Optimistic UI update
    setClients(reorderedClients);

    if (!currentUser) return;
    const batch = firestore.batch();
    const originalOrderMap = new Map(clients.map(c => [c.id, c.order]));

    reorderedClients.forEach((client, index) => {
      if (originalOrderMap.get(client.id) !== index) {
        const clientDocRef = firestore.doc(getCollectionPath.clientDoc(currentUser.uid, client.id));
        batch.update(clientDocRef, { order: index });
      }
    });

    try {
      await batch.commit();
    } catch (err) {
      console.error("Error reordering clients:", err);
      setError("クライアントの並び替えに失敗しました。");
      setClients(clients); // Revert on failure
    }
  };


  if (isLoading && clients.length === 0) return <LoadingSpinner text="クライアント情報を読み込み中..." />;
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center pb-4 border-b border-slate-200">
        <h2 className="text-2xl font-semibold text-slate-800">クライアント管理</h2>
        <PrimaryButton
          onClick={openAddClientModal}
          aria-label="新規クライアント追加"
          icon={<PlusIcon />}
        >
          クライアント追加
        </PrimaryButton>
      </div>

      {error && <p className="text-red-600 bg-red-100 p-3 rounded-md">{error}</p>}
      
      {clients.length === 0 && !isLoading && (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <svg className="mx-auto h-12 w-12 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M5 6h14M5 10h14M5 14h14M5 18h14" />
          </svg>
          <h3 className="mt-2 text-lg font-medium text-slate-900">クライアント未登録</h3>
          <p className="mt-1 text-sm text-slate-500">最初のクライアントを追加して始めましょう。</p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {clients.map((client, index) => (
          <div 
            key={client.id}
            draggable
            onDragStart={(e) => handleDragStart(e, index)}
            onDragEnter={() => handleDragEnter(index)}
            onDragEnd={handleDragEnd}
            onDragOver={handleDragOver}
            onClick={() => navigate(`/clients/${client.id}/projects`)}
            role="link"
            tabIndex={0}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && navigate(`/clients/${client.id}/projects`)}
            aria-label={`クライアント ${client.name} のプロジェクト一覧へ`}
            className="bg-white rounded-lg shadow-lg hover:shadow-xl transition-shadow duration-300 overflow-hidden cursor-pointer flex flex-col justify-between"
          >
            <div className="p-5">
              <h3 className="text-lg font-semibold text-sky-700 mb-2 truncate">
                {client.name}
              </h3>
            </div>
            <div className="flex justify-end space-x-2 p-3 bg-slate-50 border-t border-slate-200">
                <IconButton 
                    onClick={(e) => { e.stopPropagation(); openEditClientModal(client); }} 
                    aria-label={`クライアント ${client.name} を編集`}
                ><EditIcon /></IconButton>
                <IconButton 
                    onClick={(e) => { e.stopPropagation(); handleDeleteClient(client.id);}} 
                    aria-label={`クライアント ${client.name} を削除`}
                    className="hover:text-red-600"
                ><TrashIcon /></IconButton>
            </div>
          </div>
        ))}
      </div>

      {showClientModal && (
        <Modal title={editingClient ? "クライアント編集" : "新規クライアント追加"} onClose={() => { setShowClientModal(false); resetClientModalState(); }}>
          <form onSubmit={handleSaveClient} className="space-y-4">
            <div>
              <label htmlFor="client-modal-name" className="block text-sm font-medium text-slate-700 mb-1">クライアント名</label>
              <input
                id="client-modal-name"
                type="text"
                value={clientModalName}
                onChange={(e) => setClientModalName(e.target.value)}
                required
                ref={clientNameInputRef}
                aria-label="クライアント名"
                className="block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 sm:text-sm"
              />
            </div>
            {clientModalError && <p className="text-sm text-red-600">{clientModalError}</p>}
            <div className="flex justify-end space-x-3 pt-2">
              <SecondaryButton type="button" onClick={() => { setShowClientModal(false); resetClientModalState(); }}>キャンセル</SecondaryButton>
              <PrimaryButton type="submit">保存</PrimaryButton>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
export default ClientListPage;
