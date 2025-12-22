
import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Sparkles, Film, UserCircle, Plus, Play, Fire, Heart, Box, Search, BookOpen, Pencil, Trash, InformationCircle, Check } from './Icon';
import CreateWorkflow from './CreateWorkflow';
import WorkflowRun from './WorkflowRun';
import WorkflowDetailModal from './WorkflowDetailModal';
import DeleteConfirmationModal from './DeleteConfirmationModal';
import { Workflow, PromptCategory, PromptSubCategory } from '../types';
import { fetchWorkflows, deleteWorkflow, saveWorkflow, updateWorkflow, getCurrentUserId, incrementWorkflowUsage, fetchUserProfile, supabase } from '../services/supabaseService';
import { GENRE_TAGS } from '../constants';

type ExtendedTab = PromptCategory | 'all' | 'favorites' | 'my-workflows';
type ViewState = 'list' | 'create' | 'run';

const FAVORITES_KEY = 'qisimiaoxie_workflow_favorites_v3';

// 成功提示组件 - 可复用
export const SuccessToast: React.FC<{ message: string; isVisible: boolean }> = ({ message, isVisible }) => {
    if (!isVisible) return null;
    return createPortal(
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[9999] animate-fade-in-up">
            <div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-md border border-green-200 dark:border-green-900 px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3">
                <div className="w-6 h-6 bg-green-100 dark:bg-green-900/50 rounded-full flex items-center justify-center text-green-600 dark:text-green-400">
                    <Check className="w-4 h-4" />
                </div>
                <span className="text-sm font-bold text-gray-800 dark:text-gray-100">{message}</span>
            </div>
        </div>,
        document.body
    );
};

interface WorkflowManagementProps {
    isActive?: boolean;
}

const WorkflowManagement: React.FC<WorkflowManagementProps> = ({ isActive = true }) => {
  const [activeTab, setActiveTab] = useState<ExtendedTab>('all');
  const [activeSubCategory, setActiveSubCategory] = useState<PromptSubCategory | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [view, setView] = useState<ViewState>('list');
  
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
  const [workflowToEdit, setWorkflowToEdit] = useState<Workflow | null>(null);
  const [isDetailModalOpen, setDetailModalOpen] = useState(false);
  const [isDeleteModalOpen, setDeleteModalOpen] = useState(false);
  const [workflowToDelete, setWorkflowToDelete] = useState<Workflow | null>(null);

  const [favoritedIds, setFavoritedIds] = useState<Set<string>>(new Set());
  const [dbWorkflows, setDbWorkflows] = useState<Workflow[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 浮动提示状态
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const loadData = async () => {
    if (!isActive && dbWorkflows.length > 0) return;
    setIsLoading(true);
    try {
        const userId = await getCurrentUserId();
        setCurrentUserId(userId);
        
        let { data, error } = await supabase.from('workflows').select(`*, profiles(username)`).order('usage_count', { ascending: false });
        
        if (error) {
            const fallback = await supabase.from('workflows').select(`*`).order('usage_count', { ascending: false });
            data = fallback.data;
        }

        if (data) {
            const mapped: Workflow[] = data.map((wf: any) => {
                let content: any = {};
                try { content = typeof wf.content === 'string' ? JSON.parse(wf.content) : wf.content; } catch(e) {}
                
                let mainCat: PromptCategory = 'short-story';
                if(wf.main_category === 'long') mainCat = 'long-story';
                else if(wf.main_category === 'script') mainCat = 'script';
                else if(wf.main_category === 'general') mainCat = 'general';
                else if(wf.main_category === 'short') mainCat = 'short-story';
                
                return {
                    id: wf.id,
                    title: wf.title,
                    description: wf.description,
                    usageCount: wf.usage_count || 0,
                    heat: wf.usage_count || 0,
                    author: wf.profiles?.username || '匿名用户',
                    userId: wf.user_id,
                    category: mainCat,
                    subCategories: wf.sub_categories || [],
                    fields: content?.fields || [],
                    steps: content?.steps || []
                };
            });
            setDbWorkflows(mapped);
        }

        const storedFavs = localStorage.getItem(FAVORITES_KEY);
        if (storedFavs) try { setFavoritedIds(new Set(JSON.parse(storedFavs))); } catch(e){}
    } catch(e) {} finally { 
        setIsLoading(false); 
    }
  };

  useEffect(() => { if (isActive) loadData(); }, [isActive]);

  useEffect(() => {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(Array.from(favoritedIds)));
  }, [favoritedIds]);

  const filteredWorkflows = useMemo(() => {
    return dbWorkflows.filter(w => {
      if (activeTab === 'favorites') return favoritedIds.has(w.id);
      if (activeTab === 'my-workflows') return w.userId === currentUserId;
      if (activeTab !== 'all' && w.category !== activeTab) return false;
      if (activeSubCategory !== 'all' && !w.subCategories?.includes(activeSubCategory)) return false;
      
      const term = searchTerm.toLowerCase();
      return !term || w.title.toLowerCase().includes(term) || w.description.toLowerCase().includes(term);
    });
  }, [activeTab, activeSubCategory, searchTerm, dbWorkflows, favoritedIds, currentUserId]);

  const handleEdit = (e: React.MouseEvent, wf: Workflow) => {
    e.stopPropagation();
    setWorkflowToEdit(wf);
    setView('create');
  };

  const handleOpenDelete = (e: React.MouseEvent, wf: Workflow) => {
    e.stopPropagation();
    setWorkflowToDelete(wf);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (workflowToDelete) {
      await deleteWorkflow(workflowToDelete.id);
      loadData();
      setDeleteModalOpen(false);
      setWorkflowToDelete(null);
      triggerToast('工作流已成功删除');
    }
  };

  const handleSaveWorkflow = async (data: any) => {
    try {
        if (workflowToEdit) {
          await updateWorkflow(workflowToEdit.id, {
              title: data.name,
              description: data.description,
              category: data.type,
              subCategories: data.subCategories,
              fields: data.fields,
              steps: data.steps
          });
          triggerToast('更新成功');
        } else {
          await saveWorkflow(data.name, data.description, data.type, data.subCategories || [], data.fields, data.steps);
          triggerToast('发布成功');
          setActiveTab('all');
        }
        setView('list');
        setWorkflowToEdit(null);
        await loadData();
    } catch (e) {
        triggerToast('操作失败，请重试');
    }
  };

  if (view === 'create') return <CreateWorkflow onBack={() => { setView('list'); setWorkflowToEdit(null); }} onSave={handleSaveWorkflow} workflowToEdit={workflowToEdit} />;
  if (view === 'run' && selectedWorkflow) return <WorkflowRun workflow={selectedWorkflow} onBack={() => setView('list')} />;

  return (
    <div className="h-full animate-fade-in flex flex-col font-sans bg-white dark:bg-black">
      <SuccessToast message={toastMessage} isVisible={showToast} />
      <WorkflowDetailModal 
        isOpen={isDetailModalOpen} 
        onClose={() => setDetailModalOpen(false)} 
        workflow={selectedWorkflow} 
        onRun={(vals) => { incrementWorkflowUsage(selectedWorkflow!.id); setDetailModalOpen(false); setView('run'); }} 
      />
      <DeleteConfirmationModal isOpen={isDeleteModalOpen} onClose={() => setDeleteModalOpen(false)} onConfirm={handleConfirmDelete} />

      <div className="flex flex-col gap-4 p-4 sm:p-6 lg:p-8 pb-4 bg-white dark:bg-black border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
        <div className="flex justify-between items-center">
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide flex-1">
                {[
                    { id: 'all', label: '全部' },
                    { id: 'short-story', label: '短篇小说' },
                    { id: 'long-story', label: '长篇小说' },
                    { id: 'script', label: '剧本' },
                    { id: 'general', label: '全类型' },
                ].map(tab => (
                    <button 
                        key={tab.id} 
                        onClick={() => setActiveTab(tab.id as any)} 
                        className={`px-4 py-2 rounded-xl font-bold whitespace-nowrap transition-all text-sm ${activeTab === tab.id ? 'bg-sky-600 text-white shadow-md' : 'bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-300 hover:bg-gray-100'}`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>
            
            <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                <button onClick={() => setActiveTab('my-workflows')} className={`flex items-center gap-2 px-3 py-2 rounded-xl font-bold transition-all text-sm ${activeTab === 'my-workflows' ? 'bg-sky-100 text-sky-600' : 'bg-white dark:bg-gray-900 text-gray-500'}`}><UserCircle className="w-4 h-4" />我的</button>
                <button onClick={() => setActiveTab('favorites')} className={`flex items-center gap-2 px-3 py-2 rounded-xl font-bold transition-all text-sm ${activeTab === 'favorites' ? 'bg-red-100 text-red-600' : 'bg-white dark:bg-gray-900 text-gray-500'}`}><Heart className="w-4 h-4" />收藏</button>
                <button onClick={() => { setWorkflowToEdit(null); setView('create'); }} className="px-4 py-2 rounded-xl font-black bg-sky-600 text-white hover:bg-sky-500 shadow-lg shadow-sky-500/20 text-sm flex items-center gap-1"><Plus className="w-4 h-4" />创建</button>
            </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-4 justify-between items-start bg-gray-50 dark:bg-gray-900 p-3 rounded-2xl border border-gray-100 dark:border-gray-800">
            <div className="flex-1 w-full overflow-hidden">
                <div className="flex flex-wrap gap-2 items-center">
                    <span className="text-[10px] font-bold text-gray-400 mr-1 shrink-0">题材分类:</span>
                    <button onClick={() => setActiveSubCategory('all')} className={`px-3 py-1 text-[10px] font-bold rounded-lg transition-colors ${activeSubCategory === 'all' ? 'bg-sky-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-500'}`}>全部</button>
                    {GENRE_TAGS.map(cat => (
                        <button key={cat.id} onClick={() => setActiveSubCategory(cat.id as any)} className={`px-3 py-1 text-[10px] font-bold rounded-lg transition-colors ${activeSubCategory === cat.id ? 'bg-purple-100 text-purple-700' : 'bg-white dark:bg-gray-800 text-gray-500'}`}>{cat.label}</button>
                    ))}
                </div>
            </div>
            <div className="relative w-full lg:w-64">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center"><Search className="w-4 h-4 text-gray-400" /></span>
                <input type="text" placeholder="搜索工作流..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-900 text-sm rounded-xl border border-gray-200 dark:border-gray-800 focus:ring-2 focus:ring-sky-500 outline-none" />
            </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 custom-scrollbar bg-gray-50/50 dark:bg-black/50">
          {isLoading ? (
              <div className="flex items-center justify-center h-64"><div className="w-10 h-10 border-4 border-t-sky-500 rounded-full animate-spin"></div></div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-10">
              {filteredWorkflows.map(workflow => (
                  <div key={workflow.id} onClick={() => { setSelectedWorkflow(workflow); setDetailModalOpen(true); }} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5 hover:shadow-xl hover:border-sky-500 transition-all cursor-pointer group flex flex-col h-full relative">
                      <div className="flex justify-between items-start mb-1">
                          <h3 className="text-[15px] font-bold text-gray-900 dark:text-white group-hover:text-sky-600 transition-colors line-clamp-1">{workflow.title}</h3>
                          <button onClick={(e) => { e.stopPropagation(); setFavoritedIds(prev => { const n = new Set(prev); if(n.has(workflow.id)) n.delete(workflow.id); else n.add(workflow.id); return n; }); }} className={`p-1.5 rounded-full ${favoritedIds.has(workflow.id) ? 'text-red-500 bg-red-50' : 'text-gray-400 hover:text-red-500'}`}><Heart className={`w-4 h-4 ${favoritedIds.has(workflow.id) ? 'fill-current' : ''}`} /></button>
                      </div>
                      <p className="text-gray-500 dark:text-gray-400 text-xs leading-relaxed mb-4 line-clamp-3 flex-grow">{workflow.description}</p>
                      <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-800 mt-auto gap-2">
                          <div className="flex items-center gap-1.5 overflow-hidden">
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold border bg-sky-50 text-sky-600 border-sky-100 dark:bg-sky-900/20">
                                  {workflow.category === 'script' ? '剧本' : workflow.category === 'short-story' ? '短篇' : '长篇'}
                              </span>
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold border bg-purple-50 text-purple-600 border-purple-100 dark:bg-purple-900/20">{workflow.steps?.length || 0}步</span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-gray-400 shrink-0">
                              <div className="flex items-center gap-1 text-orange-400 font-bold"><Fire className="w-3 h-3" />{workflow.heat || 0}</div>
                              {workflow.userId === currentUserId && (
                                  <div className="flex gap-1.5 pl-2 border-l border-gray-100 dark:border-gray-800">
                                      <button onClick={(e) => handleEdit(e, workflow)} className="hover:text-sky-500"><Pencil className="w-3.5 h-3.5" /></button>
                                      <button onClick={(e) => handleOpenDelete(e, workflow)} className="hover:text-rose-500"><Trash className="w-3.5 h-3.5" /></button>
                                  </div>
                              )}
                          </div>
                      </div>
                  </div>
              ))}
            </div>
          )}
      </div>
    </div>
  );
};

export default WorkflowManagement;
