
import React, { useState, useEffect, useMemo } from 'react';
import { Sparkles, Film, UserCircle, Plus, Play, Fire, Heart, Box, Search, BookOpen, Pencil, Trash, InformationCircle, Check } from './Icon';
import CreateWorkflow from './CreateWorkflow';
import WorkflowRun from './WorkflowRun';
import WorkflowDetailModal from './WorkflowDetailModal';
import DeleteConfirmationModal from './DeleteConfirmationModal';
import { Workflow, PromptCategory, PromptSubCategory } from '../types';
import { fetchWorkflows, deleteWorkflow, saveWorkflow, updateWorkflow, getCurrentUserId, incrementWorkflowUsage, fetchUserProfile, supabase, fetchWorkflowFavorites, toggleWorkflowFavoriteDB } from '../services/supabaseService';
import { GENRE_TAGS } from '../constants';

type ExtendedTab = PromptCategory | 'all' | 'favorites' | 'my-workflows';
type ViewState = 'list' | 'create' | 'run';

interface WorkflowManagementProps {
    isActive?: boolean;
}

const CATEGORY_LABELS: Record<string, string> = {
    'long-story': '长篇小说', 'short-story': '短篇小说', 'script': '剧本', 'general': '通用/全类型',
};

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

  // 顶部栏通知状态
  const [notification, setNotification] = useState<string | null>(null);

  const triggerNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  const loadData = async () => {
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

        const favs = await fetchWorkflowFavorites();
        setFavoritedIds(new Set(favs));
    } catch(e) {} finally { 
        setIsLoading(false); 
    }
  };

  useEffect(() => { if (isActive) loadData(); }, [isActive]);

  const toggleFavorite = async (id: string) => {
      const isFav = favoritedIds.has(id);
      setFavoritedIds(prev => {
          const next = new Set(prev);
          if (isFav) next.delete(id);
          else next.add(id);
          return next;
      });
      // Optimistic update, but fire off DB request
      await toggleWorkflowFavoriteDB(id, isFav);
  };

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
      await loadData();
      setDeleteModalOpen(false);
      setWorkflowToDelete(null);
      triggerNotification('工作流删除成功');
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
          triggerNotification('工作流更新成功');
        } else {
          await saveWorkflow(data.name, data.description, data.type, data.subCategories || [], data.fields, data.steps);
          triggerNotification('工作流创建成功');
          setActiveTab('all');
        }
        setView('list');
        setWorkflowToEdit(null);
        // Force reload to sync changes to cards immediately
        await loadData();
    } catch (e) {
        triggerNotification('操作失败，请重试');
    }
  };

  const handleRunClick = (e: React.MouseEvent, wf: Workflow) => {
      e.stopPropagation();
      setSelectedWorkflow(wf);
      incrementWorkflowUsage(wf.id);
      setView('run');
  };

  const getSubCategoryLabel = (id: string) => {
      const found = GENRE_TAGS.find(t => t.id === id);
      return found ? found.label : id;
  };

  if (view === 'create') return <CreateWorkflow onBack={() => { setView('list'); setWorkflowToEdit(null); }} onSave={handleSaveWorkflow} workflowToEdit={workflowToEdit} />;
  if (view === 'run' && selectedWorkflow) return <WorkflowRun workflow={selectedWorkflow} onBack={() => { setView('list'); loadData(); }} />;

  return (
    <div className="h-full animate-fade-in flex flex-col font-sans bg-white dark:bg-black">
      <WorkflowDetailModal 
        isOpen={isDetailModalOpen} 
        onClose={() => setDetailModalOpen(false)} 
        workflow={selectedWorkflow} 
        onRun={(vals) => { incrementWorkflowUsage(selectedWorkflow!.id); setDetailModalOpen(false); setView('run'); }} 
      />
      <DeleteConfirmationModal isOpen={isDeleteModalOpen} onClose={() => setDeleteModalOpen(false)} onConfirm={handleConfirmDelete} />

      {/* Top Bar: Height reduced by adjusting padding and gap */}
      <div className="flex flex-col gap-3 px-6 py-4 bg-white dark:bg-black border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
        <div className="flex flex-col xl:flex-row justify-between xl:items-center gap-4">
            <div className="flex items-center gap-4 overflow-x-auto pb-2 xl:pb-0 scrollbar-hide">
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
                        className={`px-5 py-2 rounded-xl font-bold whitespace-nowrap transition-all text-xs sm:text-sm ${activeTab === tab.id ? 'bg-blue-100 text-blue-600 shadow-md shadow-blue-500/10' : 'bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-blue-900/10'}`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>
            
            <div className="flex items-center gap-3 flex-shrink-0 self-end xl:self-auto">
                <div className="relative w-full sm:w-56">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center"><Search className="w-4 h-4 text-gray-400" /></span>
                    <input type="text" placeholder="搜索工作流..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-gray-900 text-sm rounded-xl border border-transparent focus:bg-white dark:focus:bg-black focus:border-blue-500 outline-none transition-all" />
                </div>

                <button onClick={() => setActiveTab('my-workflows')} className={`flex items-center gap-2 px-3 py-2 rounded-xl font-bold transition-all text-sm whitespace-nowrap ${activeTab === 'my-workflows' ? 'bg-blue-100 text-blue-600' : 'bg-gray-50 dark:bg-gray-900 text-gray-500 hover:bg-gray-100'}`}><UserCircle className="w-4 h-4" />我的</button>
                <button onClick={() => setActiveTab('favorites')} className={`flex items-center gap-2 px-3 py-2 rounded-xl font-bold transition-all text-sm whitespace-nowrap ${activeTab === 'favorites' ? 'bg-red-100 text-red-600' : 'bg-gray-50 dark:bg-gray-900 text-gray-500 hover:bg-gray-100'}`}><Heart className="w-4 h-4" />收藏</button>
                <button onClick={() => { setWorkflowToEdit(null); setView('create'); }} className="px-5 py-2 rounded-xl font-black bg-blue-100 text-blue-600 hover:bg-blue-200 shadow-lg shadow-blue-500/10 text-sm flex items-center gap-2 whitespace-nowrap active:scale-95 transition-all">
                    <Plus className="w-4 h-4" /> 创建
                </button>
            </div>
        </div>

        <div className="flex items-center gap-3 overflow-x-auto pb-1 scrollbar-hide">
            <span className="text-xs font-bold text-gray-400 mr-1 shrink-0 uppercase tracking-wider">题材分类:</span>
            {/* Removed font-bold from genre tabs */}
            <button onClick={() => setActiveSubCategory('all')} className={`px-4 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${activeSubCategory === 'all' ? 'bg-blue-100 text-blue-700' : 'bg-gray-50 dark:bg-gray-900 text-gray-500 hover:bg-gray-100'}`}>全部</button>
            {GENRE_TAGS.map(cat => (
                <button key={cat.id} onClick={() => setActiveSubCategory(cat.id as any)} className={`px-4 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${activeSubCategory === cat.id ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'bg-gray-50 dark:bg-gray-900 text-gray-500 hover:bg-gray-100'}`}>{cat.label}</button>
            ))}
        </div>
        
        {notification && (
            <div className="fixed top-20 right-8 z-50 flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-lg shadow-lg animate-fade-in-up text-sm font-bold">
                <Check className="w-4 h-4" />
                {notification}
            </div>
        )}
      </div>

      {/* Reduced top padding for content area */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-4 custom-scrollbar bg-gray-50/50 dark:bg-black/50">
          {isLoading ? (
              <div className="flex items-center justify-center h-64"><div className="w-10 h-10 border-4 border-t-blue-500 rounded-full animate-spin"></div></div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-10">
              {filteredWorkflows.map(workflow => (
                  <div key={workflow.id} onClick={() => { setSelectedWorkflow(workflow); setDetailModalOpen(true); }} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6 hover:shadow-xl hover:border-blue-400 transition-all cursor-pointer group flex flex-col h-full relative">
                      <div className="flex justify-between items-start mb-3">
                          <h3 className="text-base font-bold text-gray-900 dark:text-white group-hover:text-blue-600 transition-colors line-clamp-1 pr-8">{workflow.title}</h3>
                          <button onClick={(e) => { e.stopPropagation(); toggleFavorite(workflow.id); }} className={`p-1.5 rounded-full absolute top-5 right-5 transition-colors ${favoritedIds.has(workflow.id) ? 'text-red-500 bg-red-50 dark:bg-red-900/20' : 'text-gray-300 hover:text-red-500 hover:bg-red-50'}`}><Heart className={`w-5 h-5 ${favoritedIds.has(workflow.id) ? 'fill-current' : ''}`} /></button>
                      </div>
                      <p className="text-gray-500 dark:text-gray-400 text-xs leading-relaxed mb-6 line-clamp-3 flex-grow">{workflow.description}</p>
                      
                      <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-gray-800 mt-auto gap-2">
                          <div className="flex items-center gap-2 overflow-hidden flex-1">
                              <div className="flex items-center gap-1 text-xs text-orange-400 font-bold shrink-0" title={`热度: ${workflow.heat}`}>
                                  <Fire className="w-3.5 h-3.5" />
                                  {workflow.heat || 0}
                              </div>
                              <div className="w-px h-3 bg-gray-200 dark:bg-gray-700 shrink-0"></div>
                              <div className="flex items-center gap-1.5 overflow-hidden">
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold border bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800 whitespace-nowrap">
                                      {CATEGORY_LABELS[workflow.category] || '通用'}
                                  </span>
                                  {workflow.subCategories && workflow.subCategories.slice(0, 2).map((sub) => (
                                      <span key={sub} className="px-1.5 py-0.5 rounded text-[10px] font-bold border bg-purple-50 text-purple-600 border-purple-100 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-800 whitespace-nowrap">
                                          {getSubCategoryLabel(sub as string)}
                                      </span>
                                  ))}
                              </div>
                          </div>
                          
                          <div className="flex items-center gap-2 shrink-0">
                              {workflow.userId === currentUserId && (
                                  <>
                                      <button onClick={(e) => handleEdit(e, workflow)} className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"><Pencil className="w-4 h-4" /></button>
                                      <button onClick={(e) => handleOpenDelete(e, workflow)} className="p-2 text-gray-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"><Trash className="w-4 h-4" /></button>
                                  </>
                              )}
                              <button 
                                onClick={(e) => handleRunClick(e, workflow)}
                                className="ml-2 px-4 py-1.5 bg-blue-100 hover:bg-blue-200 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50 text-xs font-bold rounded-lg shadow-sm flex items-center gap-1.5 active:scale-95 transition-all"
                              >
                                <Play className="w-3 h-3" /> 运行
                              </button>
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
