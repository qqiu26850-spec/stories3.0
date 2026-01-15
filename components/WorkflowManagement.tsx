
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Sparkles, Film, UserCircle, Plus, Play, Fire, Heart, Box, Search, BookOpen, Pencil, Trash, InformationCircle, Check, ArrowPath } from './Icon';
import CreateWorkflow from './CreateWorkflow';
import WorkflowRun from './WorkflowRun';
import WorkflowDetailModal from './WorkflowDetailModal';
import DeleteConfirmationModal from './DeleteConfirmationModal';
import { Workflow, PromptCategory, PromptSubCategory } from '../types';
import { fetchWorkflows, deleteWorkflow, saveWorkflow, updateWorkflow, getCurrentUserId, incrementWorkflowUsage, fetchUserProfile, fetchWorkflowFavorites, toggleWorkflowFavoriteDB } from '../services/supabaseService';
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

  // Pagination
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const [notification, setNotification] = useState<string | null>(null);

  const triggerNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  const fetchAndMapWorkflows = async (pageNum: number, currentTab: string) => {
      const options: any = { page: pageNum, limit: 20 };

      if (currentTab === 'my-workflows') {
          const uid = await getCurrentUserId();
          if (!uid) return [];
          options.userId = uid;
      } else if (currentTab === 'favorites') {
          const ids = Array.from(favoritedIds);
          if (ids.length === 0) return [];
          options.ids = ids;
      } else {
          options.category = currentTab;
      }

      const data = await fetchWorkflows(options);
      
      if (data && data.length > 0) {
          const userId = await getCurrentUserId();
          const mapped: Workflow[] = data.map((wf: any) => {
                let content: any = {};
                try { 
                    content = typeof wf.content === 'string' ? JSON.parse(wf.content) : wf.content; 
                } catch(e) {
                    console.error("Content parse error", e);
                }
                
                let mainCat: PromptCategory = 'short-story';
                if(wf.main_category === 'long') mainCat = 'long-story';
                else if(wf.main_category === 'script') mainCat = 'script';
                else if(wf.main_category === 'general') mainCat = 'general';
                else if(wf.main_category === 'short') mainCat = 'short-story';
                else if(wf.main_category) mainCat = wf.main_category as PromptCategory;
                
                let authorName = '匿名用户';
                const profile = wf.profiles; 
                
                if (profile && (profile.username || profile.nickname || profile.full_name)) {
                    authorName = profile.username || profile.nickname || profile.full_name;
                } else if (wf.user_id === userId) {
                    authorName = '我';
                }

                return {
                    id: wf.id,
                    title: wf.title,
                    description: wf.description,
                    usageCount: wf.usage_count || 0,
                    heat: wf.usage_count || 0,
                    author: authorName,
                    userId: wf.user_id,
                    category: mainCat,
                    subCategories: wf.sub_categories || [],
                    fields: content?.fields || [],
                    steps: content?.steps || []
                };
            });
            return mapped;
      }
      return [];
  };

  const loadData = useCallback(async (reset = true) => {
    if (reset) {
        setIsLoading(true);
        setPage(1);
        setHasMore(true);
        setDbWorkflows([]);
    } else {
        setIsLoadingMore(true);
    }

    try {
        const userId = await getCurrentUserId();
        setCurrentUserId(userId);
        
        // Refresh favorites if switching to favorite tab or initializing
        if (reset || activeTab === 'favorites') {
            const favs = await fetchWorkflowFavorites();
            setFavoritedIds(new Set(favs));
        }

        const targetPage = reset ? 1 : page + 1;
        const mapped = await fetchAndMapWorkflows(targetPage, activeTab);
        
        if (reset) {
            setDbWorkflows(mapped);
        } else {
            setDbWorkflows(prev => [...prev, ...mapped]);
            setPage(targetPage);
        }

        if (mapped.length < 20) setHasMore(false);

    } catch(e) {
        console.error("Workflow load error", e);
        triggerNotification('数据加载出现异常');
    } finally { 
        setIsLoading(false); 
        setIsLoadingMore(false);
    }
  }, [activeTab, page]);

  useEffect(() => { 
      if (isActive) {
          loadData(true);
      }
  }, [isActive, activeTab]);

  const handleLoadMore = () => {
      if (!hasMore || isLoadingMore) return;
      loadData(false);
  };

  const toggleFavorite = async (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      const isFav = favoritedIds.has(id);
      setFavoritedIds(prev => {
          const next = new Set(prev);
          if (isFav) next.delete(id);
          else next.add(id);
          return next;
      });
      // Optimistic update
      await toggleWorkflowFavoriteDB(id, isFav);
  };

  // Client-side subcategory filter (for now) and search
  const filteredWorkflows = useMemo(() => {
    return dbWorkflows.filter(w => {
      if (activeSubCategory !== 'all' && !w.subCategories?.includes(activeSubCategory)) return false;
      
      const term = searchTerm.toLowerCase();
      return !term || w.title.toLowerCase().includes(term) || w.description.toLowerCase().includes(term);
    });
  }, [activeSubCategory, searchTerm, dbWorkflows]);

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
      loadData(true);
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
        loadData(true);
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

  const handleSelectWorkflow = (wf: Workflow) => {
      setSelectedWorkflow(wf);
      setDetailModalOpen(true);
  }

  if (view === 'create') return <CreateWorkflow onBack={() => { setView('list'); setWorkflowToEdit(null); }} onSave={handleSaveWorkflow} workflowToEdit={workflowToEdit} />;
  if (view === 'run' && selectedWorkflow) return <WorkflowRun workflow={selectedWorkflow} onBack={() => { setView('list'); loadData(true); }} />;

  return (
    <div className="h-full animate-fade-in flex flex-col font-sans bg-white dark:bg-black">
      <WorkflowDetailModal 
        isOpen={isDetailModalOpen} 
        onClose={() => setDetailModalOpen(false)} 
        workflow={selectedWorkflow} 
        onRun={(vals) => { incrementWorkflowUsage(selectedWorkflow!.id); setDetailModalOpen(false); setView('run'); }} 
      />
      <DeleteConfirmationModal isOpen={isDeleteModalOpen} onClose={() => setDeleteModalOpen(false)} onConfirm={handleConfirmDelete} />

      {/* Notification Toast */}
      {notification && (
          <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[100] px-4 py-2 bg-gray-800 text-white rounded-full shadow-xl animate-fade-in-up flex items-center gap-2">
              <Check className="w-4 h-4 text-green-400" />
              <span className="text-sm font-bold">{notification}</span>
          </div>
      )}

      {/* Top Bar */}
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

                <button onClick={() => loadData(true)} className="p-2 rounded-xl text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" title="刷新列表">
                    <ArrowPath className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                </button>

                <button onClick={() => setActiveTab('my-workflows')} className={`flex items-center gap-2 px-3 py-2 rounded-xl font-bold transition-all text-sm whitespace-nowrap ${activeTab === 'my-workflows' ? 'bg-blue-100 text-blue-600' : 'bg-gray-50 dark:bg-gray-900 text-gray-500 hover:bg-gray-100'}`}><UserCircle className="w-4 h-4" />我的</button>
                <button onClick={() => setActiveTab('favorites')} className={`flex items-center gap-2 px-3 py-2 rounded-xl font-bold transition-all text-sm whitespace-nowrap ${activeTab === 'favorites' ? 'bg-red-100 text-red-600' : 'bg-gray-50 dark:bg-gray-900 text-gray-500 hover:bg-gray-100'}`}><Heart className="w-4 h-4" />收藏</button>
                <button onClick={() => { setWorkflowToEdit(null); setView('create'); }} className="px-5 py-2 rounded-xl font-black bg-blue-100 text-blue-600 hover:bg-blue-200 shadow-lg shadow-blue-500/10 text-sm flex items-center gap-2 whitespace-nowrap active:scale-95 transition-all">
                    <Plus className="w-4 h-4" /> 创建
                </button>
            </div>
        </div>

        <div className="flex items-center gap-3 overflow-x-auto pb-1 scrollbar-hide">
            <span className="text-xs font-bold text-gray-400 mr-1 shrink-0 uppercase tracking-wider">题材分类:</span>
            <button onClick={() => setActiveSubCategory('all')} className={`px-4 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${activeSubCategory === 'all' ? 'bg-blue-100 text-blue-700' : 'bg-gray-50 dark:bg-gray-900 text-gray-500 hover:bg-gray-100'}`}>全部</button>
            {GENRE_TAGS.map(cat => (
                <button key={cat.id} onClick={() => setActiveSubCategory(cat.id as any)} className={`px-4 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${activeSubCategory === cat.id ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'bg-gray-50 dark:bg-gray-900 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
                    {cat.label}
                </button>
            ))}
        </div>
      </div>

      {/* Grid Content */}
      <div className="flex-1 overflow-y-auto p-6 bg-gray-50 dark:bg-black/20 custom-scrollbar">
          {isLoading ? (
              <div className="flex items-center justify-center h-64">
                  <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin"></div>
              </div>
          ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {filteredWorkflows.map(wf => (
                        <div 
                            key={wf.id} 
                            onClick={() => handleSelectWorkflow(wf)}
                            className="bg-white dark:bg-gray-900 rounded-2xl p-5 border border-gray-100 dark:border-gray-800 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-xl transition-all cursor-pointer group flex flex-col h-[220px]"
                        >
                            <div className="flex justify-between items-start mb-3">
                                <div className="flex gap-2 mb-1">
                                    <span className="text-[10px] px-2 py-0.5 rounded bg-blue-50 text-blue-600 font-bold border border-blue-100">{CATEGORY_LABELS[wf.category] || '全类型'}</span>
                                </div>
                                <button 
                                    onClick={(e) => toggleFavorite(e, wf.id)}
                                    className={`p-1.5 rounded-full hover:bg-gray-100 transition-colors ${favoritedIds.has(wf.id) ? 'text-red-500' : 'text-gray-300 hover:text-red-400'}`}
                                >
                                    <Heart className={`w-4 h-4 ${favoritedIds.has(wf.id) ? 'fill-current' : ''}`} />
                                </button>
                            </div>
                            
                            <h3 className="font-bold text-gray-900 dark:text-white text-lg mb-2 line-clamp-1 group-hover:text-blue-600 transition-colors">{wf.title}</h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-3 leading-relaxed flex-grow">
                                {wf.description || '暂无描述'}
                            </p>
                            
                            <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                                <div className="flex items-center gap-3 text-xs text-gray-400">
                                    <div className="flex items-center gap-1"><Fire className="w-3.5 h-3.5 text-orange-400" /> {wf.usageCount}</div>
                                    <div className="flex items-center gap-1"><UserCircle className="w-3.5 h-3.5" /> {wf.author}</div>
                                </div>
                                
                                <div className="flex items-center gap-2">
                                    {wf.userId === currentUserId && (
                                        <>
                                            <button onClick={(e) => handleEdit(e, wf)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                                            <button onClick={(e) => handleOpenDelete(e, wf)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash className="w-3.5 h-3.5" /></button>
                                        </>
                                    )}
                                    <button 
                                        onClick={(e) => handleRunClick(e, wf)}
                                        className="p-1.5 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-600 hover:text-white transition-all shadow-sm group-hover:scale-110"
                                        title="立即运行"
                                    >
                                        <Play className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                    {filteredWorkflows.length === 0 && (
                        <div className="col-span-full flex flex-col items-center justify-center py-20 text-gray-400 opacity-60">
                            <Box className="w-16 h-16 mb-4" />
                            <p className="text-sm font-medium">暂无工作流</p>
                        </div>
                    )}
                </div>
                {hasMore && (
                    <div className="py-6 text-center">
                        <button 
                            onClick={handleLoadMore} 
                            disabled={isLoadingMore}
                            className="px-6 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 rounded-full text-xs font-bold hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center justify-center gap-2 mx-auto disabled:opacity-50 shadow-sm"
                        >
                            {isLoadingMore ? <ArrowPath className="w-3.5 h-3.5 animate-spin" /> : '加载更多'}
                        </button>
                    </div>
                )}
              </>
          )}
      </div>
    </div>
  );
};

export default WorkflowManagement;
