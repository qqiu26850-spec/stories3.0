
import React, { useState } from 'react';
import { Sparkles, Film, UserCircle, Plus, Play, Fire, Heart } from './Icon';
import CreateWorkflow from './CreateWorkflow';
import WorkflowRun from './WorkflowRun';
import { Workflow, WorkflowField } from '../types';

type Tab = 'short-story' | 'script' | 'my';
type ViewState = 'list' | 'create' | 'run';

const WorkflowManagement: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('short-story');
  const [view, setView] = useState<ViewState>('list');
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
  const [favoritedIds, setFavoritedIds] = useState<Set<string>>(new Set());
  const [workflows, setWorkflows] = useState<Workflow[]>([]);

  const handleSelectWorkflow = (wf: Workflow) => {
      setSelectedWorkflow(wf);
      setView('run');
  };

  const toggleFavorite = (id: string) => {
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
          category: data.type as 'short-story' | 'script',
          fields: data.fields,
          template: data.template
      };
      
      setWorkflows(prev => [newWorkflow, ...prev]);
      // Automatically favorite created workflow
      setFavoritedIds(prev => {
          const next = new Set(prev);
          next.add(newWorkflow.id);
          return next;
      });
      setActiveTab(data.type === 'novel' ? 'short-story' : data.type as any); // Default fallback
      setView('list');
  };

  if (view === 'create') {
      return <CreateWorkflow onBack={() => setView('list')} onSave={handleSaveWorkflow} />;
  }

  if (view === 'run' && selectedWorkflow) {
      return <WorkflowRun workflow={selectedWorkflow} onBack={() => setView('list')} />;
  }

  const filteredWorkflows = workflows.filter(w => {
      if (activeTab === 'my') {
          return favoritedIds.has(w.id);
      }
      return w.category === activeTab;
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8 h-full animate-fade-in">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">工作流</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">使用预设的AI工作流，标准化、高效地完成复杂的创作任务。</p>
      </div>

      <div className="flex flex-wrap gap-4 mb-8">
        <button
           onClick={() => setActiveTab('short-story')}
           className={`px-6 py-2.5 rounded-xl font-semibold flex items-center gap-2 transition-all ${activeTab === 'short-story' ? 'bg-white dark:bg-gray-800 text-sky-600 dark:text-sky-400 shadow-sm ring-1 ring-gray-200 dark:ring-gray-700' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
        >
           <Sparkles className="w-5 h-5" />
           短篇小说
        </button>
        <button
           onClick={() => setActiveTab('script')}
           className={`px-6 py-2.5 rounded-xl font-semibold flex items-center gap-2 transition-all ${activeTab === 'script' ? 'bg-white dark:bg-gray-800 text-sky-600 dark:text-sky-400 shadow-sm ring-1 ring-gray-200 dark:ring-gray-700' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
        >
           <Film className="w-5 h-5" />
           剧本
        </button>
         <button
           onClick={() => setActiveTab('my')}
           className={`px-6 py-2.5 rounded-xl font-semibold flex items-center gap-2 transition-all ${activeTab === 'my' ? 'bg-white dark:bg-gray-800 text-sky-600 dark:text-sky-400 shadow-sm ring-1 ring-gray-200 dark:ring-gray-700' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
        >
           <Heart className="w-5 h-5" />
           我的收藏
        </button>
         <button
           onClick={() => setView('create')} 
           className={`px-6 py-2.5 rounded-xl font-semibold flex items-center gap-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all ml-auto`}
        >
           <Plus className="w-5 h-5" />
           创建工作流
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredWorkflows.map(workflow => {
            const isFav = favoritedIds.has(workflow.id);
            return (
                <div key={workflow.id} onClick={() => handleSelectWorkflow(workflow)} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 hover:shadow-lg hover:border-sky-500 transition-all duration-300 cursor-pointer group relative">
                    <div className="flex justify-between items-start mb-3">
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white group-hover:text-sky-600 transition-colors">{workflow.title}</h3>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                toggleFavorite(workflow.id);
                            }}
                            className={`p-1.5 rounded-full transition-colors ${isFav ? 'text-red-500 bg-red-50 dark:bg-red-900/20' : 'text-gray-400 hover:text-red-500 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                        >
                            <Heart className={`w-5 h-5 ${isFav ? 'fill-current' : ''}`} />
                        </button>
                    </div>
                    
                    <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed mb-6 h-12 line-clamp-2">
                    {workflow.description}
                    </p>
                    
                    <div className="flex items-center justify-between text-sm text-gray-400 pt-4 border-t border-gray-100 dark:border-gray-800">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1">
                            <Play className="w-4 h-4" />
                            <span>{workflow.usageCount}</span>
                        </div>
                        <div className="flex items-center gap-1 text-orange-400">
                            <Fire className="w-4 h-4" />
                            <span>{workflow.heat}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <UserCircle className="w-4 h-4" />
                        <span>{workflow.author}</span>
                    </div>
                    </div>
                </div>
            );
        })}
        {filteredWorkflows.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center py-20 text-gray-400">
                <Sparkles className="w-12 h-12 mb-4 opacity-20" />
                <p>暂无工作流，请尝试创建一个！</p>
            </div>
        )}
      </div>
    </div>
  );
};

export default WorkflowManagement;
