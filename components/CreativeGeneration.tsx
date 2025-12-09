
import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { CREATIVE_MODULES, ASSETS, PROMPTS } from '../constants';
import CreativeCard from './CreativeCard';
import { CreativeModule, Asset, Prompt, PromptCategory } from '../types';
import { generateTextStream } from '../services/geminiService';
import { ChevronDoubleLeft, Sparkles, Copy, ArrowPath, Database, X, AdjustmentsHorizontal, Search, ChevronDown, Plus } from './Icon';
import SelectablePromptCard from './SelectablePromptCard';
import { fetchPrompts, saveMaterial } from '../services/supabaseService';

// --- Types ---
type PromptFormState = Record<string, string>;

interface CreativeGenerationProps {
    initialData?: { prompt?: Prompt; values?: Record<string, string> };
    onClearInitialData?: () => void;
}

// --- Loading Overlay Component ---
const LOADING_TIPS = [
    "提示：好的人物需要有缺陷，完美的英雄往往令人乏味。",
    "提示：'展示，不要告诉' (Show, don't tell) 是写作的金科玉律。",
    "提示：尝试从反派的视角思考，这会让冲突更加真实。",
    "提示：环境描写可以烘托氛围，也是人物心境的投射。",
    "提示：每一个场景都应该推动剧情发展或深化人物关系。",
    "提示：对话应该潜台词，人们往往不说出他们真正的想法。",
    "提示：在此期间，你可以喝口水，放松一下眼睛。"
];

const LoadingOverlay: React.FC<{ isVisible: boolean; onClose: () => void }> = ({ isVisible, onClose }) => {
    const [seconds, setSeconds] = useState(0);
    const [tipIndex, setTipIndex] = useState(0);

    useEffect(() => {
        let interval: any;
        if (isVisible) {
            setSeconds(0);
            interval = setInterval(() => {
                setSeconds(s => s + 1);
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [isVisible]);
    
    useEffect(() => {
        if(isVisible && seconds > 0 && seconds % 5 === 0) {
             setTipIndex(prev => (prev + 1) % LOADING_TIPS.length);
        }
    }, [seconds, isVisible]);

    if (!isVisible) return null;

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/20 backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 w-80 text-center mx-4 animate-fade-in-up relative">
                <button 
                    onClick={onClose}
                    className="absolute top-2 right-2 p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    title="关闭/取消"
                >
                    <X className="w-5 h-5" />
                </button>

                <div className="relative w-12 h-12 mx-auto mb-4">
                    <div className="absolute inset-0 border-2 border-gray-100 dark:border-gray-800 rounded-full"></div>
                    <div className="absolute inset-0 border-2 border-sky-500 rounded-full border-t-transparent animate-spin"></div>
                    <Sparkles className="absolute inset-0 w-5 h-5 m-auto text-sky-500 animate-pulse" />
                </div>
                
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">AI 正在创作...</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-mono mb-4">已耗时: {seconds} 秒</p>
                
                <div className="bg-sky-50 dark:bg-sky-900/20 p-3 rounded-xl border border-sky-100 dark:border-sky-800/50 min-h-[80px] flex items-center justify-center">
                    <p className="text-xs text-sky-700 dark:text-sky-300 font-medium transition-all duration-500 leading-relaxed">
                        {LOADING_TIPS[tipIndex]}
                    </p>
                </div>
            </div>
        </div>,
        document.body
    );
};

// --- Prompt Selection Modal ---
const PROMPT_TABS: { id: PromptCategory | 'all'; label: string }[] = [
  { id: 'all', label: '全部' },
  { id: 'long-story', label: '长篇' },
  { id: 'short-story', label: '短篇' },
  { id: 'script', label: '剧本' },
];

const PromptSelectionModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onSelect: (prompt: Prompt) => void;
}> = ({ isOpen, onClose, onSelect }) => {
    const [activeTab, setActiveTab] = useState<PromptCategory | 'all'>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [allPrompts, setAllPrompts] = useState<Prompt[]>(PROMPTS);

    useEffect(() => {
        const loadPrompts = async () => {
            const dbPrompts = await fetchPrompts();
            if (dbPrompts) {
                const mapped: Prompt[] = dbPrompts.map((p: any) => {
                    let appCat: PromptCategory = 'short-story';
                    if(p.main_category === 'long') appCat = 'long-story';
                    if(p.main_category === 'script') appCat = 'script';
                    
                    let parsedContent: any = {};
                    try {
                        parsedContent = JSON.parse(p.content);
                    } catch (e) {
                        parsedContent = { template: p.content };
                    }

                    return {
                        id: p.id,
                        title: p.title,
                        description: parsedContent.description || '用户自定义提示词',
                        content: parsedContent.template || p.content,
                        category: appCat,
                        subCategories: p.sub_category ? [p.sub_category as any] : [],
                        fields: parsedContent.fields || [],
                        template: parsedContent.template || p.content,
                        heat: 0,
                        creator: 'user'
                    };
                });
                setAllPrompts([...mapped, ...PROMPTS]);
            }
        };
        if (isOpen) {
            loadPrompts();
        }
    }, [isOpen]);

    const filteredPrompts = useMemo(() => {
        return allPrompts.filter(prompt => {
            const categoryMatch = activeTab === 'all' || prompt.category === activeTab;
            const searchMatch = !searchTerm || prompt.title.toLowerCase().includes(searchTerm.toLowerCase()) || prompt.description.includes(searchTerm);
            return categoryMatch && searchMatch;
        });
    }, [activeTab, searchTerm, allPrompts]);

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 bg-black/60 dark:bg-black/80 flex items-center justify-center z-[100] p-4 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col relative animate-fade-in-up overflow-hidden" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-gray-900/50">
                    <div className="flex items-center gap-6">
                        <h3 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <Sparkles className="w-7 h-7 text-sky-500" />
                            选择提示词模板
                        </h3>
                        <div className="flex bg-gray-200 dark:bg-gray-800 rounded-lg p-1">
                            {PROMPT_TABS.map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`px-4 py-1.5 text-sm font-bold rounded-md transition-all ${
                                        activeTab === tab.id 
                                        ? 'bg-white dark:bg-gray-700 text-sky-600 dark:text-sky-400 shadow-sm' 
                                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                                    }`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                        <div className="relative w-72">
                            <input 
                                type="text" 
                                placeholder="搜索模板..." 
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full focus:ring-2 focus:ring-sky-500 focus:outline-none transition-shadow shadow-sm"
                            />
                            <Search className="w-5 h-5 absolute left-3.5 top-2.5 text-gray-400" />
                        </div>
                        <button onClick={onClose} className="p-2 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors">
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 bg-gray-50 dark:bg-black/20">
                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredPrompts.length > 0 ? filteredPrompts.map(prompt => (
                            <div key={prompt.id} className="h-full transform hover:scale-[1.02] transition-transform">
                                <SelectablePromptCard
                                    prompt={prompt}
                                    onSelect={() => {
                                        onSelect(prompt);
                                        onClose();
                                    }}
                                />
                            </div>
                        )) : (
                            <div className="col-span-full flex flex-col items-center justify-center py-32 text-gray-400">
                                <Sparkles className="w-20 h-20 mb-6 opacity-20" />
                                <p className="text-xl font-medium">未找到匹配的模板</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

// --- Import Asset Modal ---
const ImportAssetModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    content: string;
    onSave: (data: { name: string; type: Asset['type']; tags: string[] }) => void;
}> = ({ isOpen, onClose, content, onSave }) => {
    const [name, setName] = useState('');
    const [type, setType] = useState<Asset['type']>('inspiration');
    const [tags, setTags] = useState('');

    useEffect(() => {
        if (isOpen && content) {
            setName(content.slice(0, 15).replace(/\n/g, ' ').trim() + (content.length > 15 ? '...' : ''));
        }
    }, [isOpen, content]);

    const handleSave = () => {
        const tagList = tags.split(/[,，]/).map(t => t.trim()).filter(Boolean);
        onSave({ name, type, tags: tagList });
        onClose();
    };

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 bg-black/60 dark:bg-black/80 flex items-center justify-center z-[100] p-4 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md p-8 animate-fade-in-up" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white">导入素材库</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                        <X className="w-6 h-6" />
                    </button>
                </div>
                
                <div className="space-y-5">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">素材名称</label>
                        <input 
                            type="text" 
                            value={name}
                            onChange={e => setName(e.target.value)}
                            className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none text-gray-900 dark:text-white"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">分类</label>
                        <div className="grid grid-cols-3 gap-3">
                            {(['character', 'plot', 'inspiration'] as const).map(t => (
                                <button
                                    key={t}
                                    onClick={() => setType(t)}
                                    className={`py-3 px-2 text-sm rounded-lg border transition-all font-medium ${
                                        type === t 
                                        ? 'bg-sky-50 dark:bg-sky-900/30 border-sky-500 text-sky-700 dark:text-sky-400 shadow-sm' 
                                        : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                                    }`}
                                >
                                    {t === 'character' ? '角色' : t === 'plot' ? '剧情' : '灵感'}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">标签</label>
                        <input 
                            type="text" 
                            value={tags}
                            onChange={e => setTags(e.target.value)}
                            placeholder="例如：科幻, 反转 (逗号分隔)"
                            className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none text-gray-900 dark:text-white"
                        />
                    </div>
                </div>

                <div className="mt-8 flex gap-3">
                    <button onClick={onClose} className="flex-1 py-3 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-bold rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                        取消
                    </button>
                    <button onClick={handleSave} className="flex-1 py-3 bg-sky-600 text-white font-bold rounded-lg hover:bg-sky-500 shadow-lg hover:shadow-sky-500/30 transition-all">
                        保存素材
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

const CreativeGeneration: React.FC<CreativeGenerationProps> = ({ initialData, onClearInitialData }) => {
  const [selectedModule, setSelectedModule] = useState<CreativeModule | null>(null);
  
  // Generation State
  const [model, setModel] = useState('gemini-2.5-flash');
  const [temperature, setTemperature] = useState(1);
  const [topP, setTopP] = useState(0.95);
  
  // Prompt & Input State
  const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);
  const [formState, setFormState] = useState<PromptFormState>({});
  const [freeInput, setFreeInput] = useState('');

  const [generatedText, setGeneratedText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  
  // UI State
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [promptModalOpen, setPromptModalOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // Handle incoming initial data from props (e.g. from Prompt Library)
  useEffect(() => {
    if (initialData?.prompt) {
        // If we have a prompt coming in, assume we are in a generic "Creative Mode" or default to Brainstorm
        if (!selectedModule) {
             // Find a default module or create a placeholder 'Custom' context if needed.
             // For now, let's just set it to 'brainstorm' or keep null if the UI supports prompt-only generation without module
             setSelectedModule(CREATIVE_MODULES[0]); 
        }
        setSelectedPrompt(initialData.prompt);
        if (initialData.values) {
            setFormState(initialData.values);
        }
        if (onClearInitialData) {
            onClearInitialData();
        }
    }
  }, [initialData, selectedModule, onClearInitialData]);


  // Reset state when module changes, but preserve if we just set it via initialData
  // Note: We need to be careful not to clear what we just set in the above useEffect
  useEffect(() => {
      if (selectedModule && !initialData?.prompt) {
          setFreeInput('');
          setSelectedPrompt(null);
          setFormState({});
          setGeneratedText('');
          setSuccessMessage('');
      }
  }, [selectedModule]); // initialData.prompt dependency removed to avoid loop, handled logic inside

  // Auto-init form state when prompt selected (only if not already populated by initialData)
  useEffect(() => {
      if (selectedPrompt) {
          setFormState(prev => {
               // Only initialize fields that are empty
              const next = { ...prev };
              selectedPrompt.fields.forEach(field => {
                  if (next[field.id] === undefined) {
                      next[field.id] = '';
                  }
              });
              return next;
          });
      } else {
          setFormState({});
      }
  }, [selectedPrompt]);

  const handleGenerate = async () => {
      setIsGenerating(true);
      setGeneratedText('');
      
      let finalPrompt = '';
      
      // Construct prompt
      if (selectedPrompt) {
          let template = selectedPrompt.template;
          for (const field of selectedPrompt.fields) {
              const val = formState[field.id] || '';
              template = template.replace(new RegExp(`\\$\\{${field.id}\\}`, 'g'), val);
          }
          finalPrompt = template;
      } else {
          finalPrompt = freeInput;
      }

      // Prepend module context if available
      if (selectedModule) {
          finalPrompt = `[当前创作任务：${selectedModule.title} - ${selectedModule.description}]\n\n${finalPrompt}`;
      }
      
      if (!finalPrompt.trim()) {
          setIsGenerating(false);
          return;
      }

      try {
          const stream = generateTextStream(
              finalPrompt, 
              { model, temperature, topP }
          );

          for await (const chunk of stream) {
              setGeneratedText(prev => prev + chunk);
          }
      } catch (e) {
          setGeneratedText(prev => prev + "\n\n[生成中断或出错，请重试]");
      } finally {
          setIsGenerating(false);
      }
  };

  const handleCopy = () => {
      navigator.clipboard.writeText(generatedText);
      setSuccessMessage('内容已复制！');
      setTimeout(() => setSuccessMessage(''), 2000);
  };

  const handleImportAsset = (data: { name: string; type: Asset['type']; tags: string[] }) => {
      // Map app types to DB types
      let dbType: 'character' | 'plot' | 'idea' = 'idea';
      if (data.type === 'character') dbType = 'character';
      if (data.type === 'plot') dbType = 'plot';

      saveMaterial(data.name, generatedText, dbType, data.tags);

      setSuccessMessage('已成功导入素材库！');
      setTimeout(() => setSuccessMessage(''), 2000);
  };

  if (!selectedModule) {
      return (
          <div className="p-4 sm:p-6 lg:p-8 h-full animate-fade-in">
              <div className="mb-8">
                  <h1 className="text-3xl font-bold text-gray-900 dark:text-white">创意生成</h1>
                  <p className="text-gray-500 dark:text-gray-400 mt-1">选择一个创作模块，开始你的灵感之旅。</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {CREATIVE_MODULES.map((module) => (
                      <CreativeCard 
                          key={module.id} 
                          module={module} 
                          onSelect={() => setSelectedModule(module)}
                      />
                  ))}
              </div>
          </div>
      );
  }

  return (
      <div className="h-full flex flex-col bg-gray-50 dark:bg-black animate-fade-in overflow-hidden">
          {/* Header */}
          <div className="flex-shrink-0 flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm z-20">
              <div className="flex items-center gap-3">
                  <button 
                      onClick={() => setSelectedModule(null)}
                      className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition-colors"
                  >
                      <ChevronDoubleLeft className="w-5 h-5" />
                  </button>
                  <div>
                      <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                          {selectedModule.title}
                          <span className="text-xs font-normal text-gray-500 border border-gray-200 dark:border-gray-700 px-2 py-0.5 rounded-full bg-gray-50 dark:bg-gray-800">创作模式</span>
                      </h2>
                  </div>
              </div>
              {successMessage && (
                  <div className="px-4 py-2 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 rounded-lg text-sm font-bold animate-pulse shadow-sm">
                      {successMessage}
                  </div>
              )}
          </div>

          {/* Split Content */}
          <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
              
              <ImportAssetModal 
                isOpen={importModalOpen} 
                onClose={() => setImportModalOpen(false)} 
                content={generatedText}
                onSave={handleImportAsset}
              />
              <PromptSelectionModal
                isOpen={promptModalOpen}
                onClose={() => setPromptModalOpen(false)}
                onSelect={setSelectedPrompt}
              />

              {/* Left: Input Panel */}
              <div className="w-full lg:w-[450px] xl:w-[500px] flex flex-col border-b lg:border-b-0 lg:border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden z-10 shadow-lg lg:shadow-none">
                  <div className="flex-1 overflow-y-auto p-5 space-y-8">
                      
                      {/* Section 1: Model Selection */}
                      <div className="space-y-4">
                          <div className="flex items-center gap-2 text-gray-800 dark:text-gray-200 font-bold text-sm uppercase tracking-wide">
                              <div className="p-1.5 bg-blue-100 dark:bg-blue-900/30 rounded text-blue-600 dark:text-blue-400">
                                <AdjustmentsHorizontal className="w-4 h-4" />
                              </div>
                              模型配置
                          </div>
                          
                          <div className="bg-gray-50 dark:bg-gray-800/50 p-5 rounded-xl border border-gray-100 dark:border-gray-800 space-y-5">
                              <div>
                               