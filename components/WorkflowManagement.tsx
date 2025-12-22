
import React, { useState, useEffect } from 'react';
import { Sparkles, Film, UserCircle, Plus, Play, Fire, Heart } from './Icon';
import CreateWorkflow from './CreateWorkflow';
import WorkflowRun from './WorkflowRun';
import { Workflow } from '../types';

type Tab = 'short-story' | 'script' | 'my';
type ViewState = 'list' | 'create' | 'run';

const FAVORITES_KEY = 'qisimiaoxie_workflow_favorites';

const WorkflowManagement: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('short-story');
  const [view, setView] = useState<ViewState>('list');
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
  const [favoritedIds, setFavoritedIds] = useState<Set<string>>(new Set());
  const [customWorkflows, setCustomWorkflows] = useState<Workflow[]>([]);

  // 加载收藏
  useEffect(() => {
    const stored = localStorage.getItem(FAVORITES_KEY);
    if (stored) try { setFavoritedIds(new Set(JSON.parse(stored))); } catch(e){}
  }, []);

  // 持久化收藏
  useEffect(() => {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(Array.from(favoritedIds)));
  }, [favoritedIds]);

  const handleSelectWorkflow = (wf: Workflow) => {
      setSelectedWorkflow(wf);
      setView('run');
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
      const newWorkflow: Workflow = {
          id: `wf-${Date.now()}`,
          title: data.name,
          description: data.description,
          usageCount: '0',
          heat: 0,
          author: '我',
          category: data.type === 'novel' ? 'short-story' : data.type as any,
          fields: data.fields,
          template: data.template
      };
      setCustomWorkflows(prev => [newWorkflow, ...prev]);
      setFavoritedIds(prev => new Set(prev).add(newWorkflow.id));
      setView('list');
  };

  // 模拟系统预设数据 + 用户自定义数据
  const allWorkflows = [...SYSTEM_WORKFLOWS, ...customWorkflows];

  const filteredWorkflows = allWorkflows.filter(w => {
      if (activeTab === 'my') return favoritedIds.has(w.id);
      return w.category === activeTab;
  });

  if (view === 'create') return <CreateWorkflow onBack={() => setView('list')} onSave={handleSaveWorkflow} />;
  if (view === 'run' && selectedWorkflow) return <WorkflowRun workflow={selectedWorkflow} onBack={() => setView('list')} />;

  return (
    <div className="p-4 sm:p-6 lg:p-8 h-full animate-fade-in flex flex-col font-sans">
      <div className="mb-8 flex justify-between items-end">
        <div>
            <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">创作工作流</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">结构化生产工具，将您的创作逻辑转化为自动化生产线。</p>
        </div>
        <button
           onClick={() => setView('create')} 
           className="px-6 py-2.5 bg-sky-600 text-white font-bold rounded-xl hover:bg-sky-500 transition-all shadow-lg shadow-sky-500/20 active:scale-95 flex items-center gap-2"
        >
           <Plus className="w-5 h-5" />
           自定义工作流
        </button>
      </div>

      <div className="flex gap-2 mb-8 bg-gray-100 dark:bg-gray-900 p-1 rounded-xl w-fit">
        {[
            { id: 'short-story', label: '短篇小说', icon: Sparkles },
            { id: 'script', label: '影视剧本', icon: Film },
            { id: 'my', label: '我的收藏', icon: Heart },
        ].map(tab => (
            <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as Tab)}
                className={`px-6 py-2 rounded-lg font-bold flex items-center gap-2 transition-all ${
                    activeTab === tab.id 
                    ? 'bg-white dark:bg-gray-800 text-sky-600 dark:text-sky-400 shadow-sm' 
                    : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-300'
                }`}
            >
                <tab.icon className="w-4 h-4" />
                {tab.label}
            </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 overflow-y-auto pr-2 custom-scrollbar">
        {filteredWorkflows.map(workflow => {
            const isFav = favoritedIds.has(workflow.id);
            return (
                <div 
                    key={workflow.id} 
                    onClick={() => handleSelectWorkflow(workflow)} 
                    className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 hover:shadow-xl hover:border-sky-500 transition-all duration-300 cursor-pointer group flex flex-col h-full relative"
                >
                    <div className="flex justify-between items-start mb-2">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white group-hover:text-sky-600 transition-colors truncate pr-8" title={workflow.title}>
                            {workflow.title}
                        </h3>
                        <button
                            onClick={(e) => toggleFavorite(e, workflow.id)}
                            className={`absolute top-6 right-6 p-1.5 rounded-full transition-colors z-10 ${isFav ? 'text-red-500 bg-red-50' : 'text-gray-300 hover:text-red-500'}`}
                        >
                            <Heart className={`w-4 h-4 ${isFav ? 'fill-current' : ''}`} />
                        </button>
                    </div>
                    
                    <p className="text-gray-500 dark:text-gray-400 text-xs leading-relaxed mb-6 line-clamp-3 flex-grow">
                        {workflow.description}
                    </p>
                    
                    <div className="flex items-center justify-between text-[11px] text-gray-400 pt-4 border-t border-gray-100 dark:border-gray-800 mt-auto">
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1 text-orange-400 font-bold">
                                <Fire className="w-3 h-3" />
                                <span>{workflow.heat || 0}</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <UserCircle className="w-3 h-3" />
                                <span className="max-w-[70px] truncate">{workflow.author}</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-1 bg-sky-50 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400 px-2 py-0.5 rounded font-bold border border-sky-100 dark:border-sky-800">
                             运行
                        </div>
                    </div>
                </div>
            );
        })}
        {filteredWorkflows.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center py-24 text-gray-400 bg-gray-50/50 dark:bg-gray-900/20 rounded-3xl border-2 border-dashed border-gray-200 dark:border-gray-800">
                <Sparkles className="w-16 h-16 mb-4 opacity-10" />
                <p className="text-lg font-medium">该分类下暂无工作流</p>
                <button onClick={() => setView('create')} className="mt-4 text-sky-500 hover:underline font-bold">创建一个？</button>
            </div>
        )}
      </div>
    </div>
  );
};

const SYSTEM_WORKFLOWS: Workflow[] = [
  {
    id: 'wf-sys-1',
    title: '悬疑反转生成器',
    description: '专为悬疑小说设计，基于核心梗概自动生成3个令人意想不到的结尾反转方案。',
    usageCount: '12.4k',
    heat: 9580,
    author: '官方',
    category: 'short-story',
    fields: [
        { id: 'f1', label: '故事梗概', variable: 'synopsis', type: 'textarea' },
        { id: 'f2', label: '核心谜题', variable: 'mystery', type: 'text' }
    ],
    template: '请根据以下故事梗概：${synopsis}，以及核心谜题：${mystery}，设计3个出人意料的结局反转。'
  },
  {
    id: 'wf-sys-2',
    title: '三幕式结构拆解',
    description: '输入故事大纲，自动拆解为标准的电影三幕式结构（建置、对抗、结局）。',
    usageCount: '5.2k',
    heat: 4500,
    author: '官方',
    category: 'script',
    fields: [
        { id: 'f1', label: '故事大纲', variable: 'outline', type: 'textarea' },
        { id: 'f2', label: '类型片种', variable: 'genre', type: 'text' }
    ],
    template: '请将这个${genre}类型的故事大纲：${outline}，拆解为标准的三幕式结构。'
  }
];

export default WorkflowManagement;
