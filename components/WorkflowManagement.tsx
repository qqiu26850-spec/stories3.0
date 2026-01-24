
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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

// Helper to look up genre label
const getGenreLabel = (id: string) => {
    const found = GENRE_TAGS.find(g => g.id === id);
    return found ? found.label : null;
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
  
  const observerTarget = useRef(null);

  // Success Notification Text (Green)
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [showSuccess, setShowSuccess] = useState(false);

  const triggerSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  const fetchAndMapWorkflows = async (pageNum: number, currentTab: string, search: string) => {
      const options: any = { page: pageNum, limit: 20, search };

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
                    steps: content?.steps || [],
                    createdAt: wf.created_at
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
        const mapped = await fetchAndMapWorkflows(targetPage, activeTab, searchTerm);
        
        if (reset) {
            setDbWorkflows(mapped);
        } else {
            setDbWorkflows(prev => [...prev, ...mapped]);
            setPage(targetPage);
        }

        if (mapped.length < 20) setHasMore(false);

    } catch(e) {
        console.error("Workflow load error", e);
    } finally { 
        setIsLoading(false); 
        setIsLoadingMore(false);
    }
  }, [activeTab, page, searchTerm]);

  // Debounced search handler
  useEffect(() => {
      const delayDebounceFn = setTimeout(() => {
          if (isActive) {
              loadData(true);
          }
      }, 500);

      return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, isActive, activeTab]);

  useEffect(() => { 
      if (isActive) {
          // Initial load handled by search debounce effect
      }
  }, [isActive]);

  // Infinite Scroll Observer
  useEffect(() => {
      const observer = new IntersectionObserver(
          entries => {
              if (entries[0].isIntersecting && hasMore && !isLoading && !isLoadingMore) {
                  loadData(false);
              }
          },
          { threshold: 0.1 }
      );

      if (observerTarget.current) {
          observer.observe(observerTarget.current);
      }

      return () => {
          if (observerTarget.current) {
              observer.unobserve(observerTarget.current);
          }
      };
  }, [hasMore, isLoading, isLoadingMore, loadData]);

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

  // Client-side subcategory filter (remains client-side for now as API handles category/search)
  const filteredWorkflows = useMemo(() => {
    return dbWorkflows.filter(w => {
      if (activeSubCategory !== 'all' && !w.subCategories?.includes(activeSubCategory)) return false;
      return true;
    });
  }, [activeSubCategory, dbWorkflows]);

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
      triggerSuccess('工作流删除成功');
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
          triggerSuccess('工作流更新成功');
        } else {
          await saveWorkflow(data.name, data.description, data.type, data.subCategories || [], data.fields, data.steps);
          triggerSuccess('工作流创建成功');
          setActiveTab('all');
        }
        setView('list');
        setWorkflowToEdit(null);
        loadData(true);
    } catch (e) {
        // Handle error implicitly or add error toast
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
    <div className="h-full animate-fade-in flex flex-col font-sans bg-white dark:bg-black p-4 sm:p-6 lg:p-8">
      <WorkflowDetailModal 
        isOpen={isDetailModalOpen} 
        onClose={() => setDetailModalOpen(false)} 
        workflow={selectedWorkflow} 
        onRun={(vals) => { incrementWorkflowUsage(selectedWorkflow!.id); setDetailModalOpen(false); setView('run'); }} 
      />
      <DeleteConfirmationModal isOpen={isDeleteModalOpen} onClose={() => setDeleteModalOpen(false)} onConfirm={handleConfirmDelete} />

      {/* Top Bar */}
      <div className="flex flex-col gap-4 mb-6 flex-shrink-0">
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
                        className={`px-4 py-2 rounded-xl font-semibold whitespace-nowrap transition-all text-sm ${activeTab === tab.id ? 'bg-sky-600 text-white shadow-md' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100'}`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>
            
            <div className="flex items-center gap-3 flex-shrink-0 self-end xl:self-auto">
                {showSuccess && (
                    <span className="text-xs font-bold text-emerald-500 animate-fade-in transition-all whitespace-nowrap flex items-center gap-1.5">
                        <div className="w-5 h-5 bg-emerald-50 dark:bg-emerald-900/30 rounded-full flex items-center justify-center">
                            <Check className="w-3 h-3" />
                        </div>
                        {successMessage}
                    </span>
                )}
                
                <div className="relative w-full sm:w-56">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center"><Search className="w-4 h-4 text-gray-400" /></span>
                    <input type="text" placeholder="搜索工作流..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-9 pr-4 py-2 bg-white dark:bg-gray-800 text-sm rounded-xl border border-gray-200 focus:ring-2 focus:ring-sky-500 outline-none transition-all" />
                </div>

                <button onClick={() => loadData(true)} className="p-2 rounded-xl text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" title="刷新列表">
                    <ArrowPath className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                </button>

                <button onClick={() => setActiveTab('my-workflows')} className={`flex items-center gap-2 px-3 py-2 rounded-xl font-semibold transition-all text-sm whitespace-nowrap ${activeTab === 'my-workflows' ? 'bg-sky-100 text-sky-600' : 'bg-white dark:bg-gray-800 text-gray-500 hover:bg-gray-100'}`}><UserCircle className="w-4 h-4" />我的</button>
                <button onClick={() => setActiveTab('favorites')} className={`flex items-center gap-2 px-3 py-2 rounded-xl font-semibold transition-all text-sm whitespace-nowrap ${activeTab === 'favorites' ? 'bg-red-100 text-red-600' : 'bg-white dark:bg-gray-800 text-gray-500 hover:bg-gray-100'}`}><Heart className="w-4 h-4" />收藏</button>
                <button onClick={() => { setWorkflowToEdit(null); setView('create'); }} className="px-4 py-2 rounded-xl font-bold bg-sky-600 text-white hover:bg-sky-500 shadow-lg shadow-sky-500/20 text-sm flex items-center gap-1 whitespace-nowrap active:scale-95 transition-all">
                    <Plus className="w-4 h-4" /> 创建
                </button>
            </div>
        </div>

        <div className="flex flex-col gap-4 justify-between items-start bg-gray-100 dark:bg-gray-900/50 p-3 rounded-xl">
            <div className="w-full space-y-2">
                <div className="flex flex-wrap gap-2 items-center">
                    <span className="text-xs font-bold text-gray-400 mr-1 shrink-0">题材分类:</span>
                    <button onClick={() => setActiveSubCategory('all')} className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${activeSubCategory === 'all' ? 'bg-sky-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-500'}`}>全部</button>
                    {GENRE_TAGS.map(cat => (
                        <button key={cat.id} onClick={() => setActiveSubCategory(cat.id as any)} className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${activeSubCategory === cat.id ? 'bg-purple-100 text-purple-700' : 'bg-white dark:bg-gray-800 text-gray-500'}`}>
                            {cat.label}
                        </button>
                    ))}
                </div>
            </div>
        </div>
      </div>

      {/* Grid Content */}
      <div className="flex-1 overflow-y-auto pr-2 -mr-2">
          {isLoading ? (
              <div className="flex items-center justify-center h-64">
                  <div className="w-10 h-10 border-4 border-t-sky-500 rounded-full animate-spin"></div>
              </div>
          ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-6">
                    {filteredWorkflows.map(wf => (
                        <div 
                            key={wf.id} 
                            onClick={() => handleSelectWorkflow(wf)}
                            className="bg-white dark:bg-gray-900 rounded-2xl p-4 border border-gray-100 dark:border-gray-800 hover:border-sky-300 dark:hover:border-sky-700 hover:shadow-xl transition-all cursor-pointer group flex flex-col h-[210px]"
                        >
                            <div className="flex justify-between items-start mb-2">
                                <div className="flex gap-2 mb-1 opacity-0">
                                </div>
                                <button 
                                    onClick={(e) => toggleFavorite(e, wf.id)}
                                    className={`p-1.5 rounded-full hover:bg-gray-100 transition-colors ${favoritedIds.has(wf.id) ? 'text-red-500' : 'text-gray-300 hover:text-red-400'}`}
                                >
                                    <Heart className={`w-4 h-4 ${favoritedIds.has(wf.id) ? 'fill-current' : ''}`} />
                                </button>
                            </div>
                            
                            <div className="-mt-8">
                                <h3 className="font-bold text-gray-900 dark:text-white text-lg mb-2 line-clamp-1 group-hover:text-sky-600 transition-colors pr-2">{wf.title}</h3>
                                <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-4 leading-relaxed flex-grow">
                                    {wf.description || '暂无描述'}
                                </p>
                            </div>
                            
                            <div className="flex items-center justify-between mt-auto pt-3 border-t border-gray-100 dark:border-gray-800 gap-2">
                                {/* Left Side: Tags and Info */}
                                <div className="flex items-center gap-2 overflow-hidden flex-1 min-w-0">
                                    <div className="flex gap-1 flex-shrink-0">
                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-50 text-sky-600 font-bold border border-sky-100 whitespace-nowrap dark:bg-sky-900/30 dark:text-sky-400 dark:border-sky-800">{CATEGORY_LABELS[wf.category] || '全类型'}</span>
                                        {wf.subCategories && wf.subCategories.length > 0 && (
                                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-50 text-purple-600 font-bold border border-purple-100 whitespace-nowrap dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800">
                                                {getGenreLabel(wf.subCategories[0] as string)}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 text-[10px] text-gray-400 flex-shrink-0 truncate">
                                        <div className="flex items-center gap-0.5"><Fire className="w-3 h-3 text-orange-400" /> {wf.usageCount}</div>
                                        <div className="flex items-center gap-0.5 truncate"><UserCircle className="w-3 h-3" /> {wf.author}</div>
                                    </div>
                                </div>
                                
                                <div className="flex items-center gap-1 flex-shrink-0">
                                    {wf.userId === currentUserId && (
                                        <>
                                            <button onClick={(e) => handleEdit(e, wf)} className="p-1.5 text-gray-400 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                                            <button onClick={(e) => handleOpenDelete(e, wf)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash className="w-3.5 h-3.5" /></button>
                                        </>
                                    )}
                                    <button 
                                        onClick={(e) => handleRunClick(e, wf)}
                                        className="flex items-center gap-1 px-2 py-1 bg-sky-100 text-sky-600 rounded-lg hover:bg-sky-600 hover:text-white transition-all shadow-sm group-hover:scale-105 active:scale-95 ml-1"
                                        title="立即运行"
                                    >
                                        <Play className="w-3 h-3" />
                                        <span className="text-xs font-bold whitespace-nowrap">立即运行</span>
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
                
                {/* Infinite Scroll Sentinel */}
                {hasMore && (
                    <div ref={observerTarget} className="py-6 text-center flex justify-center">
                        <div className="w-6 h-6 border-2 border-sky-500 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                )}
              </>
          )}
      </div>
    </div>
  );
};

export default WorkflowManagement;
