
import React, { useState, useEffect, useMemo } from 'react';
/* Added InformationCircle to the imports below */
import { Sparkles, Film, UserCircle, Plus, Play, Fire, Heart, Box, Search, BookOpen, Pencil, Trash, InformationCircle } from './Icon';
import CreateWorkflow from './CreateWorkflow';
import WorkflowRun from './WorkflowRun';
import WorkflowDetailModal from './WorkflowDetailModal';
import DeleteConfirmationModal from './DeleteConfirmationModal';
import { Workflow, PromptCategory } from '../types';

type ExtendedTab = PromptCategory | 'all' | 'favorites' | 'my-workflows';
type ViewState = 'list' | 'create' | 'run';

const FAVORITES_KEY = 'qisimiaoxie_workflow_favorites_v2';
const CUSTOM_WORKFLOWS_KEY = 'qisimiaoxie_custom_workflows';

const WorkflowManagement: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ExtendedTab>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [view, setView] = useState<ViewState>('list');
  
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
  const [workflowToEdit, setWorkflowToEdit] = useState<Workflow | null>(null);
  const [isDetailModalOpen, setDetailModalOpen] = useState(false);
  const [isDeleteModalOpen, setDeleteModalOpen] = useState(false);
  const [workflowToDelete, setWorkflowToDelete] = useState<Workflow | null>(null);

  const [favoritedIds, setFavoritedIds] = useState<Set<string>>(new Set());
  const [customWorkflows, setCustomWorkflows] = useState<Workflow[]>([]);

  // 加载本地存储
  useEffect(() => {
    const storedFavs = localStorage.getItem(FAVORITES_KEY);
    if (storedFavs) try { setFavoritedIds(new Set(JSON.parse(storedFavs))); } catch(e){}

    const storedWorkflows = localStorage.getItem(CUSTOM_WORKFLOWS_KEY);
    if (storedWorkflows) try { setCustomWorkflows(JSON.parse(storedWorkflows)); } catch(e){}
  }, []);

  // 持久化
  useEffect(() => {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(Array.from(favoritedIds)));
  }, [favoritedIds]);

  useEffect(() => {
    localStorage.setItem(CUSTOM_WORKFLOWS_KEY, JSON.stringify(customWorkflows));
  }, [customWorkflows]);

  const allWorkflows = useMemo(() => [...SYSTEM_WORKFLOWS, ...customWorkflows], [customWorkflows]);

  const filteredWorkflows = useMemo(() => {
    return allWorkflows.filter(w => {
      if (activeTab === 'favorites') return favoritedIds.has(w.id);
      if (activeTab === 'my-workflows') return w.author === '我';
      if (activeTab !== 'all' && w.category !== activeTab) return false;
      
      const term = searchTerm.toLowerCase();
      return !term || w.title.toLowerCase().includes(term) || w.description.toLowerCase().includes(term);
    });
  }, [activeTab, searchTerm, allWorkflows, favoritedIds]);

  const handleCardClick = (wf: Workflow) => {
    setSelectedWorkflow(wf);
    setDetailModalOpen(true);
  };

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

  const handleConfirmDelete = () => {
    if (workflowToDelete) {
      setCustomWorkflows(prev => prev.filter(w => w.id !== workflowToDelete.id));
      setDeleteModalOpen(false);
      setWorkflowToDelete(null);
    }
  };

  const toggleFavorite = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setFavoritedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSaveWorkflow = (data: any) => {
    if (workflowToEdit) {
      // 更新现有
      setCustomWorkflows(prev => prev.map(w => w.id === workflowToEdit.id ? { ...w, ...data, title: data.name } : w));
    } else {
      // 新增
      const newWorkflow: Workflow = {
        id: `wf-${Date.now()}`,
        title: data.name,
        description: data.description,
        usageCount: '0',
        heat: 0,
        author: '我',
        category: data.type as any,
        fields: data.fields,
        steps: data.steps
      };
      setCustomWorkflows(prev => [newWorkflow, ...prev]);
    }
    setView('list');
    setWorkflowToEdit(null);
  };

  const handleRunFromDetail = (filledValues: Record<string, string>) => {
    // 这里为了演示简单，直接进入运行页，WorkflowRun 内部会处理初始值
    setDetailModalOpen(false);
    setView('run');
  };

  if (view === 'create') return <CreateWorkflow onBack={() => { setView('list'); setWorkflowToEdit(null); }} onSave={handleSaveWorkflow} workflowToEdit={workflowToEdit} />;
  if (view === 'run' && selectedWorkflow) return <WorkflowRun workflow={selectedWorkflow} onBack={() => setView('list')} />;

  return (
    <div className="p-4 sm:p-6 lg:p-8 h-full animate-fade-in flex flex-col font-sans">
      <WorkflowDetailModal 
        isOpen={isDetailModalOpen} 
        onClose={() => setDetailModalOpen(false)} 
        workflow={selectedWorkflow} 
        onRun={handleRunFromDetail} 
      />
      <DeleteConfirmationModal isOpen={isDeleteModalOpen} onClose={() => setDeleteModalOpen(false)} onConfirm={handleConfirmDelete} />

      {/* 顶部导航栏 - 与提示词库截图保持一致 */}
      <div className="flex flex-col gap-4 mb-6 flex-shrink-0">
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
                        className={`px-4 py-2 rounded-xl font-bold whitespace-nowrap transition-all text-sm ${activeTab === tab.id ? 'bg-sky-600 text-white shadow-md' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100'}`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>
            
            <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                <div className="flex gap-2">
                     <button onClick={() => setActiveTab('my-workflows')} className={`flex items-center gap-2 px-3 py-2 rounded-xl font-bold transition-all text-sm ${activeTab === 'my-workflows' ? 'bg-sky-100 text-sky-600' : 'bg-white dark:bg-gray-800 text-gray-500'}`}><UserCircle className="w-4 h-4" />我的工作流</button>
                     <button onClick={() => setActiveTab('favorites')} className={`flex items-center gap-2 px-3 py-2 rounded-xl font-bold transition-all text-sm ${activeTab === 'favorites' ? 'bg-red-100 text-red-600' : 'bg-white dark:bg-gray-800 text-gray-500'}`}><Heart className="w-4 h-4" />我的收藏</button>
                    <button onClick={() => { setWorkflowToEdit(null); setView('create'); }} className="px-4 py-2 rounded-xl font-black bg-sky-600 text-white hover:bg-sky-500 shadow-lg shadow-sky-500/20 text-sm flex items-center gap-1"><Plus className="w-4 h-4" />创建</button>
                </div>
            </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-4 justify-between items-center bg-gray-100 dark:bg-gray-900/50 p-3 rounded-2xl border border-gray-200 dark:border-gray-800">
            <div className="flex items-center gap-2 text-xs font-bold text-gray-500">
                <InformationCircle className="w-4 h-4 text-sky-500" />
                工作流可以将多个 AI 处理环节串联，实现从构思到正文的一站式自动化生产。
            </div>
            <div className="relative w-full lg:w-80">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center"><Search className="w-4 h-4 text-gray-400" /></span>
                <input 
                    type="text" 
                    placeholder="搜索工作流名称、简介..." 
                    value={searchTerm} 
                    onChange={e => setSearchTerm(e.target.value)} 
                    className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-800 text-sm rounded-xl border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-sky-500 outline-none transition-all" 
                />
            </div>
        </div>
      </div>

      {/* 工作流列表 */}
      <div className="flex-1 overflow-y-auto pr-2 -mr-2 custom-scrollbar">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-10">
            {filteredWorkflows.map(workflow => {
                const isFav = favoritedIds.has(workflow.id);
                const isOwner = workflow.author === '我';
                return (
                    <div 
                        key={workflow.id} 
                        onClick={() => handleCardClick(workflow)} 
                        className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 hover:shadow-xl hover:border-sky-500 transition-all duration-300 cursor-pointer group flex flex-col h-full relative"
                    >
                        <div className="flex justify-between items-start mb-1">
                            <h3 className="text-[15px] font-bold text-gray-900 dark:text-white group-hover:text-sky-600 transition-colors line-clamp-1 tracking-tight" title={workflow.title}>
                                {workflow.title}
                            </h3>
                            <button
                                onClick={(e) => toggleFavorite(e, workflow.id)}
                                className={`p-1.5 rounded-full transition-colors z-10 ${isFav ? 'text-red-500 bg-red-50' : 'text-gray-300 hover:text-red-500'}`}
                            >
                                <Heart className={`w-4 h-4 ${isFav ? 'fill-current' : ''}`} />
                            </button>
                        </div>
                        
                        <p className="text-gray-500 dark:text-gray-400 text-xs leading-relaxed mb-4 line-clamp-3 flex-grow">
                            {workflow.description}
                        </p>
                        
                        <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-800 mt-auto gap-2">
                            <div className="flex items-center gap-1.5 overflow-hidden flex-wrap max-h-6">
                                <span className="flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold border bg-sky-50 text-sky-600 border-sky-100 dark:bg-sky-900/20 dark:text-sky-400 dark:border-sky-800">
                                    {workflow.category === 'script' ? '剧本' : workflow.category === 'short-story' ? '短篇' : '长篇'}
                                </span>
                                <span className="flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold border bg-purple-50 text-purple-600 border-purple-100 dark:bg-purple-900/20 dark:text-purple-300">
                                    {workflow.steps?.length || 0} 步
                                </span>
                            </div>
                            <div className="flex items-center gap-3 flex-shrink-0 text-xs text-gray-400">
                                <div className="flex items-center gap-1 text-orange-400 font-bold">
                                    <Fire className="w-3 h-3" />
                                    <span>{workflow.heat || 0}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <UserCircle className="w-3 h-3" />
                                    <span className="max-w-[60px] truncate">{workflow.author}</span>
                                </div>
                                {isOwner && (
                                    <div className="flex gap-1.5 pl-2 border-l border-gray-100 dark:border-gray-800">
                                        <button onClick={(e) => handleEdit(e, workflow)} className="text-gray-400 hover:text-sky-500 transition-colors" title="编辑"><Pencil className="w-3.5 h-3.5" /></button>
                                        <button onClick={(e) => handleOpenDelete(e, workflow)} className="text-gray-400 hover:text-rose-500 transition-colors" title="删除"><Trash className="w-3.5 h-3.5" /></button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })}
            {filteredWorkflows.length === 0 && (
                <div className="col-span-full flex flex-col items-center justify-center py-24 text-gray-400 bg-gray-50/50 dark:bg-gray-900/20 rounded-3xl border-2 border-dashed border-gray-200 dark:border-gray-800">
                    <Box className="w-16 h-16 mb-4 opacity-10" />
                    <p className="text-lg font-medium">该分类下暂无工作流</p>
                    <button onClick={() => setView('create')} className="mt-4 text-sky-500 hover:underline font-bold">立即创建一个</button>
                </div>
            )}
          </div>
      </div>
    </div>
  );
};

const SYSTEM_WORKFLOWS: Workflow[] = [
  {
    id: 'wf-sys-1',
    title: '全自动短篇小说生产线',
    description: '从灵感、大纲到正文一键生成的完整流程，保证逻辑一致。',
    usageCount: '25.1k',
    heat: 18900,
    author: '官方',
    category: 'short-story',
    fields: [
        { id: 'f1', label: '核心关键词', variable: 'keywords', type: 'text' },
        { id: 'f2', label: '期望风格', variable: 'style', type: 'text' }
    ],
    steps: [
        { id: 's1', name: '步骤1：生成三个创意构思', prompt: '请根据关键词 ${keywords}，生成三个风格为 ${style} 的小说创意脑洞方案。', outputVariable: 'ideas' },
        { id: 's2', name: '步骤2：基于创意完善大纲', prompt: '从以下方案中任选一个最精彩的：\n${ideas}\n\n请为其编写一份详细的起承转合大纲。', outputVariable: 'outline' },
        { id: 's3', name: '步骤3：生成正文开头', prompt: '基于大纲内容：\n${outline}\n\n请以此创作一段风格为 ${style} 的小说开篇，不少于800字。', outputVariable: 'content' }
    ]
  },
  {
    id: 'wf-sys-2',
    title: '三幕式剧本拆解器',
    description: '输入梗概，自动拆解并生成每个场景的具体动作和对白草稿。',
    usageCount: '12.4k',
    heat: 9580,
    author: '官方',
    category: 'script',
    fields: [
        { id: 'f1', label: '故事梗概', variable: 'synopsis', type: 'textarea' }
    ],
    steps: [
        { id: 's1', name: '环节1：三幕结构化', prompt: '请将故事梗概：${synopsis}，拆解为标准电影三幕式结构。', outputVariable: 'structure' },
        { id: 's2', name: '环节2：场景化细分', prompt: '基于结构：\n${structure}\n\n请列出关键的5个分镜场景描述。', outputVariable: 'scenes' }
    ]
  }
];

export default WorkflowManagement;
