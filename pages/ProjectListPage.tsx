import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import { Project, ProjectType } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { firestore, getCollectionPath, storage } from '../firebase';
import Modal from '../components/Modal';
import { PlusIcon, TrashIcon, ChevronRightIcon } from '../components/Icons';
import { PrimaryButton, SecondaryButton, IconButton } from '../components/common/Buttons';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { formatDate } from '../utils';

const ProjectListPage: React.FC = () => {
  const { clientId } = useParams<{ clientId: string }>();
  const [clientName, setClientName] = useState<string>('');
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoadingClient, setIsLoadingClient] = useState(true);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  
  const [showAddProjectModal, setShowAddProjectModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [modalError, setModalError] = useState<string|null>(null);
  const projectNameInputRef = useRef<HTMLInputElement>(null);
  const draggedItemIndex = useRef<number | null>(null);
  const dropTargetIndex = useRef<number | null>(null);


  useEffect(() => {
    if (!currentUser || !clientId) return;
    
    let clientUnsubscribe: (() => void) | undefined;
    let projectsUnsubscribe: (() => void) | undefined;
    let isMounted = true;

    const fetchClientDetails = () => {
        setIsLoadingClient(true);
        const clientDocRef = firestore.doc(getCollectionPath.clientDoc(currentUser.uid, clientId));
        clientUnsubscribe = clientDocRef.onSnapshot((docSnap) => {
            if (!isMounted) return;
            if (docSnap.exists) {
                setClientName(docSnap.data()!.name);
                setError(prevError => prevError === "指定されたクライアントが見つかりません。" ? null : prevError);
            } else {
                setError("指定されたクライアントが見つかりません。");
                navigate('/dashboard');
            }
            setIsLoadingClient(false);
        }, (err) => {
            if (!isMounted) return;
            console.error("Error fetching client details:", err);
            setError("クライアント情報の読み込みに失敗しました。");
            setIsLoadingClient(false);
        });
    };

    const fetchProjects = () => {
        setIsLoadingProjects(true);
        const projectsPath = getCollectionPath.projects(currentUser.uid, clientId);
        const q = firestore.collection(projectsPath).orderBy("order");
        projectsUnsubscribe = q.onSnapshot((snapshot) => {
            if (!isMounted) return;
            const fetchedProjects = snapshot.docs.map(docSnap => ({ ...docSnap.data(), id: docSnap.id } as Project));
            setProjects(fetchedProjects);
            setError(prevError => prevError === "プロジェクトの読み込みに失敗しました。" ? null : prevError);
            setIsLoadingProjects(false);
        }, (err) => {
            if (!isMounted) return;
            console.error("Error fetching projects:", err);
            setError("プロジェクトの読み込みに失敗しました。");
            setIsLoadingProjects(false);
        });
    };
    
    fetchClientDetails();
    fetchProjects();

    return () => {
        isMounted = false;
        if (clientUnsubscribe) clientUnsubscribe();
        if (projectsUnsubscribe) projectsUnsubscribe();
    };
  }, [currentUser, clientId, navigate]);
  
  const resetProjectModalState = () => {
    setNewProjectName('');
    setModalError(null);
  };

  const handleOpenAddProjectModal = () => {
    resetProjectModalState();
    setShowAddProjectModal(true); 
    setTimeout(() => projectNameInputRef.current?.focus(), 50);
  };

  const handleAddProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);
    if (!newProjectName.trim()) {
      setModalError("プロジェクト名は必須です。"); return;
    }
    if (!currentUser || !clientId) {
      setModalError("ユーザー情報またはクライアント情報が不足しています。"); return;
    }

    const projectsPath = getCollectionPath.projects(currentUser.uid, clientId);
    const projectData = {
      clientId,
      userId: currentUser.uid,
      name: newProjectName.trim(),
      order: projects.length,
    };
    let success = false;
    try {
      await firestore.collection(projectsPath).add(projectData);
      success = true;
    } catch (err) {
      console.error("Error adding project:", err);
      setModalError("プロジェクトの追加に失敗しました。");
    } finally {
        if(success) {
            setShowAddProjectModal(false);
            resetProjectModalState();
        }
    }
  };

  const handleDeleteProject = async (projectId: string) => {
      if (!currentUser || !clientId || !window.confirm("このプロジェクトと関連する全てのデータを削除しますか？この操作は元に戻せません。")) return;
      
      // Optimistic UI update
      const originalProjects = [...projects];
      setProjects(prevProjects => prevProjects.filter(p => p.id !== projectId));
      setError(null);

      try {
          const batch = firestore.batch();
          const projectDocRef = firestore.doc(getCollectionPath.projectDoc(currentUser.uid, clientId, projectId));
          
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

          const collectionsToClear = [
              getCollectionPath.incomeExpenses(currentUser.uid, projectId),
              getCollectionPath.broadcasts(currentUser.uid, projectId),
              getCollectionPath.scheduleTasks(currentUser.uid, projectId),
              getCollectionPath.kpiItems(currentUser.uid, projectId),
              getCollectionPath.kpiCustomColumns(currentUser.uid, projectId),
              getCollectionPath.kpiMeasureMasters(currentUser.uid, projectId),
              getCollectionPath.files(currentUser.uid, projectId),
          ];
          
          for(const path of collectionsToClear) {
              try {
                  const snapshot = await firestore.collection(path).get();
                  snapshot.docs.forEach(d => batch.delete(d.ref));
              } catch (e) { console.warn(`Could not fetch collection for deletion: ${path}`, e) }
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
          await batch.commit();
      } catch (err) {
          console.error("Error deleting project and related data:", err);
          setError("プロジェクトの削除に失敗しました。");
          setProjects(originalProjects); // Revert on failure
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
    
    const reorderedProjects = [...projects];
    const [draggedItem] = reorderedProjects.splice(draggedIdx, 1);
    reorderedProjects.splice(targetIdx, 0, draggedItem);
    
    setProjects(reorderedProjects);

    if (!currentUser || !clientId) return;
    const batch = firestore.batch();
    const originalOrderMap = new Map(projects.map(p => [p.id, p.order]));

    reorderedProjects.forEach((project, index) => {
      if (originalOrderMap.get(project.id) !== index) {
        const projectDocRef = firestore.doc(getCollectionPath.projectDoc(currentUser.uid, clientId, project.id));
        batch.update(projectDocRef, { order: index });
      }
    });

    try {
      await batch.commit();
    } catch (err) {
      console.error("Error reordering projects:", err);
      setError("プロジェクトの並び替えに失敗しました。");
      setProjects(projects);
    }
  };


  if (isLoadingClient || (isLoadingProjects && projects.length === 0)) return <LoadingSpinner text="プロジェクト情報を読み込み中..." />;
  if (!clientId) return <Navigate to="/dashboard" />;

  return (
    <div className="space-y-6">
      <nav aria-label="breadcrumb" className="text-sm text-slate-600 mb-2">
        <ol className="flex items-center space-x-1">
          <li>
            <button onClick={() => navigate('/dashboard')} className="hover:text-sky-600 hover:underline">クライアント一覧</button>
          </li>
          <li><ChevronRightIcon className="text-slate-400" /></li>
          <li className="font-medium text-slate-700">{clientName || 'クライアント'}</li>
        </ol>
      </nav>
      <div className="flex justify-between items-center pb-4 border-b border-slate-200">
        <h2 className="text-2xl font-semibold text-slate-800">
          {clientName ? `${clientName} のプロジェクト` : 'プロジェクト管理'}
        </h2>
        <PrimaryButton
          onClick={handleOpenAddProjectModal}
          aria-label="新規プロジェクトを追加"
          icon={<PlusIcon />}
        >
          新規プロジェクト追加
        </PrimaryButton>
      </div>

      {error && <p className="text-red-600 bg-red-100 p-3 rounded-md">{error}</p>}

      {projects.length === 0 && !isLoadingProjects && (
         <div className="text-center py-12 bg-white rounded-lg shadow">
           <svg className="mx-auto h-12 w-12 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
             <path vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
           </svg>
          <h3 className="mt-2 text-lg font-medium text-slate-900">プロジェクト未登録</h3>
          <p className="mt-1 text-sm text-slate-500">このクライアントにはまだプロジェクトがありません。</p>
        </div>
      )}

      <div className="space-y-4">
        {projects.map((project, index) => (
          <div 
            key={project.id}
            draggable
            onDragStart={(e) => handleDragStart(e, index)}
            onDragEnter={() => handleDragEnter(index)}
            onDragEnd={handleDragEnd}
            onDragOver={handleDragOver}
            className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200 cursor-grab"
          >
            <div className="p-5 flex justify-between items-start">
              <div 
                onClick={() => navigate(`/clients/${clientId}/projects/${project.id}`)}
                role="link" tabIndex={0}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && navigate(`/clients/${clientId}/projects/${project.id}`)}
                aria-label={`プロジェクト ${project.name} の詳細へ`}
                className="cursor-pointer flex-grow"
              >
                <h3 className="text-lg font-semibold text-sky-700 hover:text-sky-800 transition-colors mb-1">
                  {project.name}
                </h3>
                {project.types && project.types.length > 0 && (
                  <p className="text-sm text-slate-600">
                    種類: {project.types.map(t => t === ProjectType.Other ? project.otherTypeName || t : t).join(', ')}
                  </p>
                )}
                {project.dueDate && (
                  <p className="text-sm text-slate-500">期限: {formatDate(project.dueDate)}</p>
                )}
              </div>
              <div className="flex-shrink-0 flex items-center space-x-2 ml-4">
                 <SecondaryButton 
                    onClick={(e) => { e.stopPropagation(); navigate(`/clients/${clientId}/projects/${project.id}`); }} 
                    size="sm"
                 >詳細</SecondaryButton>
                 <IconButton 
                    onClick={(e) => { e.stopPropagation(); handleDeleteProject(project.id); }} 
                    aria-label={`プロジェクト ${project.name} を削除`}
                    className="hover:text-red-600"
                ><TrashIcon/></IconButton>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showAddProjectModal && (
        <Modal title="新規プロジェクト追加" onClose={() => { setShowAddProjectModal(false); resetProjectModalState(); }}>
          <form onSubmit={handleAddProject} className="space-y-4">
            <div>
              <label htmlFor="project-name" className="block text-sm font-medium text-slate-700 mb-1">プロジェクト名</label>
              <input id="project-name" type="text" value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)} required ref={projectNameInputRef} className="block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 sm:text-sm"/>
            </div>
            {modalError && <p className="text-sm text-red-600">{modalError}</p>}
            <div className="flex justify-end space-x-3 pt-2">
              <SecondaryButton type="button" onClick={() => {setShowAddProjectModal(false); resetProjectModalState();}}>キャンセル</SecondaryButton>
              <PrimaryButton type="submit">作成</PrimaryButton>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

export default ProjectListPage;
