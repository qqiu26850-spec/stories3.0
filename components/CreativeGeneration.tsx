
import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { CREATIVE_MODULES, PROMPTS } from '../constants';
import CreativeCard from './CreativeCard';
import { CreativeModule, Asset, Prompt, PromptCategory } from '../types';
import { generateTextStream } from '../services/geminiService';
import { ChevronDoubleLeft, Sparkles, Copy, Database, X, AdjustmentsHorizontal, Search, ChevronDown, Plus, DocumentText } from './Icon';
import SelectablePromptCard from './SelectablePromptCard';
import { fetchPrompts, saveMaterial, incrementPromptHeat } from '../services/supabaseService';
import LoadingOverlay from './LoadingOverlay';

type PromptFormState = Record<string, string>;

interface CreativeGenerationProps {
    initialData?: { prompt?: Prompt; values?: Record<string, string> };
    onClearInitialData?: () => void;
}

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
                    else if(p.main_category === 'script') appCat = 'script';
                    else if(p.main_category === 'short') appCat = 'short-story';
                    else appCat = p.main_category as PromptCategory;
                    
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
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-6xl h-[85vh] flex flex-col relative animate-fade-in-up overflow-hidden" onClick={e => e.stopPropagation()}>
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

                <div className="flex-1 overflow-y-auto p-6 bg-gray-50 dark:bg-black/20">
                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
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

const ImportAssetModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    content: string;
    onSave: (data: { name: string; type: Asset['type']; tags: string[]; content: string }) => void;
}> = ({ isOpen, onClose, content, onSave }) => {
    // ... same implementation ...
    const [name, setName] = useState('');
    const [assetContent, setAssetContent] = useState('');
    const [type, setType] = useState<Asset['type']>('inspiration');
    const [tags, setTags] = useState('');

    useEffect(() => {
        if (isOpen && content) {
            setName(content.slice(0, 15).replace(/\n/g, ' ').trim() + (content.length > 15 ? '...' : ''));
            setAssetContent(content);
        }
    }, [isOpen, content]);

    const handleSave = () => {
        const tagList = tags.split(/[,，]/).map(t => t.trim()).filter(Boolean);
        onSave({ name, type, tags: tagList, content: assetContent });
        onClose();
    };

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 bg-black/60 dark:bg-black/80 flex items-center justify-center z-[100] p-4 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg p-8 animate-fade-in-up flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-6 flex-shrink-0">
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white">导入素材库</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                        <X className="w-6 h-6" />
                    </button>
                </div>
                
                <div className="space-y-5 overflow-y-auto pr-2">
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
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">内容预览</label>
                        <textarea
                            value={assetContent}
                            onChange={e => setAssetContent(e.target.value)}
                            className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none text-gray-900 dark:text-white h-32 resize-none"
                        />
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

                <div className="mt-8 flex gap-3 flex-shrink-0">
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
  // ... state ...
  const [selectedModule, setSelectedModule] = useState<CreativeModule | null>(null);
  const [model, setModel] = useState('gemini-2.5-flash');
  const [temperature, setTemperature] = useState(1);
  const [topP, setTopP] = useState(0.95);
  const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);
  const [formState, setFormState] = useState<PromptFormState>({});
  const [freeInput, setFreeInput] = useState('');
  const [generatedText, setGeneratedText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [showLoadingOverlay, setShowLoadingOverlay] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [promptModalOpen, setPromptModalOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // ... useEffects ...
  useEffect(() => {
    if (initialData?.prompt) {
        if (!selectedModule) {
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

  useEffect(() => {
      if (selectedModule && !initialData?.prompt) {
          setFreeInput('');
          setSelectedPrompt(null);
          setFormState({});
          setGeneratedText('');
          setSuccessMessage('');
      }
  }, [selectedModule]);

  useEffect(() => {
      if (selectedPrompt) {
          setFormState(prev => {
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
      setShowLoadingOverlay(true);
      setGeneratedText('');
      
      let finalPrompt = '';
      
      if (selectedPrompt) {
          incrementPromptHeat(selectedPrompt.id);
          let template = selectedPrompt.template || selectedPrompt.content; 
          for (const field of selectedPrompt.fields) {
              const val = formState[field.id] || '';
              template = template.replace(new RegExp(`\\$\\{${field.id}\\}`, 'g'), val);
          }
          finalPrompt = template;
      } else {
          finalPrompt = freeInput;
      }

      if (selectedModule) {
          finalPrompt = `[当前创作任务：${selectedModule.title} - ${selectedModule.description}]\n\n${finalPrompt}`;
      }
      
      if (!finalPrompt.trim()) {
          setIsGenerating(false);
          setShowLoadingOverlay(false);
          return;
      }

      try {
          const stream = generateTextStream(
              finalPrompt, 
              { model, temperature, topP }
          );

          let firstChunk = true;
          for await (const chunk of stream) {
              if (firstChunk) {
                  setShowLoadingOverlay(false); 
                  firstChunk = false;
              }
              setGeneratedText(prev => prev + chunk);
          }
      } catch (e) {
          setGeneratedText(prev => prev + "\n\n[生成中断或出错，请重试]");
      } finally {
          setIsGenerating(false);
          setShowLoadingOverlay(false);
      }
  };

  const handleCopy = () => {
      navigator.clipboard.writeText(generatedText);
      setSuccessMessage('内容已复制！');
      setTimeout(() => setSuccessMessage(''), 2000);
  };

  const handleImportAsset = (data: { name: string; type: Asset['type']; tags: string[]; content: string }) => {
      let dbType: 'character' | 'plot' | 'idea' = 'idea';
      if (data.type === 'character') dbType = 'character';
      if (data.type === 'plot') dbType = 'plot';

      saveMaterial(data.name, data.content, dbType, data.tags);

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
      <div className="h-full flex flex-col bg-gray-50 dark:bg-black animate-fade-in overflow-hidden relative">
          <LoadingOverlay isVisible={showLoadingOverlay} onClose={() => setShowLoadingOverlay(false)} />
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
              
              {/* Left: Input Panel */}
              <div className="w-full lg:w-[450px] xl:w-[500px] flex flex-col border-b lg:border-b-0 lg:border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden z-10 shadow-lg lg:shadow-none">
                  {/* ... Model & Prompt sections ... */}
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
                                  <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1.5">模型</label>
                                  <select 
                                      value={model}
                                      onChange={(e) => setModel(e.target.value)}
                                      className="w-full p-2 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none"
                                  >
                                      <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                                      <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
                                      <option value="deepseek-chat">DeepSeek V3</option>
                                      <option value="deepseek-reasoner">DeepSeek R1 (推理)</option>
                                  </select>
                              </div>
                              
                              <div className="grid grid-cols-2 gap-4">
                                  <div>
                                      <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1.5 flex justify-between">
                                          <span>温度 (Randomness)</span>
                                          <span>{temperature}</span>
                                      </label>
                                      <input 
                                          type="range" min="0" max="2" step="0.1" 
                                          value={temperature}
                                          onChange={(e) => setTemperature(parseFloat(e.target.value))}
                                          className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                                      />
                                  </div>
                                  <div>
                                      <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1.5 flex justify-between">
                                          <span>核采样 (Top P)</span>
                                          <span>{topP}</span>
                                      </label>
                                      <input 
                                          type="range" min="0" max="1" step="0.05" 
                                          value={topP}
                                          onChange={(e) => setTopP(parseFloat(e.target.value))}
                                          className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                                      />
                                  </div>
                              </div>
                          </div>
                      </div>

                      {/* Section 2: Prompt Config */}
                      <div className="space-y-4">
                          <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 text-gray-800 dark:text-gray-200 font-bold text-sm uppercase tracking-wide">
                                  <div className="p-1.5 bg-purple-100 dark:bg-purple-900/30 rounded text-purple-600 dark:text-purple-400">
                                    <Sparkles className="w-4 h-4" />
                                  </div>
                                  提示词配置
                              </div>
                              <button 
                                  onClick={() => setPromptModalOpen(true)}
                                  className="text-xs font-semibold text-sky-600 hover:text-sky-700 dark:text-sky-400 dark:hover:text-sky-300 transition-colors flex items-center gap-1"
                              >
                                  <Search className="w-3 h-3" />
                                  更换模板
                              </button>
                          </div>

                          <div className="bg-gray-50 dark:bg-gray-800/50 p-5 rounded-xl border border-gray-100 dark:border-gray-800">
                              {selectedPrompt ? (
                                  <div className="space-y-4">
                                      <div className="flex items-center justify-between pb-3 border-b border-gray-200 dark:border-gray-700">
                                          <span className="text-sm font-bold text-gray-900 dark:text-white">{selectedPrompt.title}</span>
                                          <button onClick={() => setSelectedPrompt(null)} className="text-gray-400 hover:text-red-500 transition-colors text-xs">
                                              清除
                                          </button>
                                      </div>
                                      {selectedPrompt.fields.map(field => (
                                          <div key={field.id}>
                                              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1.5">{field.label}</label>
                                              {field.type === 'textarea' ? (
                                                  <textarea
                                                      value={formState[field.id] || ''}
                                                      onChange={(e) => setFormState(prev => ({...prev, [field.id]: e.target.value}))}
                                                      placeholder={field.placeholder}
                                                      className="w-full p-3 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none resize-none h-24 transition-shadow shadow-sm"
                                                  />
                                              ) : (
                                                  <input
                                                      type="text"
                                                      value={formState[field.id] || ''}
                                                      onChange={(e) => setFormState(prev => ({...prev, [field.id]: e.target.value}))}
                                                      placeholder={field.placeholder}
                                                      className="w-full p-3 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none transition-shadow shadow-sm"
                                                  />
                                              )}
                                          </div>
                                      ))}
                                  </div>
                              ) : (
                                  <div className="space-y-3">
                                      <label className="block text-xs font-bold text-gray-500 dark:text-gray-400">自由输入</label>
                                      <textarea 
                                          value={freeInput}
                                          onChange={(e) => setFreeInput(e.target.value)}
                                          placeholder="在此输入你的创作需求、故事梗概或灵感..."
                                          className="w-full p-4 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none resize-none h-40 transition-shadow shadow-sm"
                                      />
                                      <div className="text-xs text-gray-400 text-center pt-2">
                                          或者点击上方“更换模板”选择专业的结构化提示词
                                      </div>
                                  </div>
                              )}
                          </div>
                      </div>
                  </div>

                  <div className="p-5 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
                      <button
                          onClick={handleGenerate}
                          disabled={isGenerating}
                          className="w-full py-3.5 bg-gradient-to-r from-sky-600 to-purple-600 hover:from-sky-500 hover:to-purple-500 text-white font-bold rounded-xl shadow-lg hover:shadow-sky-500/30 transition-all flex items-center justify-center gap-2 transform active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
                      >
                          {isGenerating ? (
                              <>
                                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                  正在生成...
                              </>
                          ) : (
                              <>
                                  <Sparkles className="w-5 h-5" />
                                  立即生成
                              </>
                          )}
                      </button>
                  </div>
              </div>

              {/* Right: Result Panel */}
              <div className="flex-1 flex flex-col bg-gray-50 dark:bg-black overflow-hidden relative">
                  {/* Added Header for Output */}
                  {generatedText && (
                      <div className="flex-shrink-0 p-4 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex items-center gap-2 text-gray-900 dark:text-white font-bold animate-fade-in">
                          <DocumentText className="w-5 h-5 text-purple-500" />
                          <span>生成内容</span>
                      </div>
                  )}

                  <div className="flex-1 overflow-y-auto p-6 md:p-8">
                      {generatedText ? (
                          <div className="bg-white dark:bg-gray-900 p-8 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 min-h-full animate-fade-in">
                              <pre className="whitespace-pre-wrap font-sans text-gray-800 dark:text-gray-200 leading-relaxed text-lg">
                                  {generatedText}
                              </pre>
                          </div>
                      ) : (
                          <div className="h-full flex flex-col items-center justify-center text-gray-400 dark:text-gray-600 opacity-60">
                              <Sparkles className="w-24 h-24 mb-6 stroke-1" />
                              <p className="text-xl font-medium">配置左侧参数，开始创作</p>
                          </div>
                      )}
                  </div>

                  {generatedText && (
                      <div className="p-4 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex justify-end gap-3 z-10">
                          <button
                              onClick={handleCopy}
                              className="px-5 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center gap-2"
                          >
                              <Copy className="w-4 h-4" />
                              复制
                          </button>
                          <button
                              onClick={() => setImportModalOpen(true)}
                              className="px-5 py-2.5 rounded-lg bg-sky-600 text-white font-medium hover:bg-sky-500 transition-colors shadow-sm flex items-center gap-2"
                          >
                              <Database className="w-4 h-4" />
                              存入素材库
                          </button>
                      </div>
                  )}
              </div>
          </div>
      </div>
  );
};

export default CreativeGeneration;
