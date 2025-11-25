
import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Sparkles, Film, BookOpen, Copy, X, Search, ChevronDown, Database, Workflow } from '../Icon';
import { generateText } from '../../services/geminiService';
import { ASSETS, PROMPTS, WORKFLOWS } from '../../constants';
import { Asset, Prompt, PromptCategory, Workflow as WorkflowType } from '../../types';
import SelectablePromptCard from '../SelectablePromptCard';
import { fetchPrompts } from '../../services/supabaseService';

interface ScriptAdaptationPanelProps {
    onInsert: (text: string) => void;
}

type SelectionMode = 'prompt' | 'workflow';

// --- Reuse AssetSelectionModal ---
const ASSET_TYPES: { id: Asset['type']; label: string }[] = [
    { id: 'character', label: '角色库' },
    { id: 'plot', label: '剧情库' },
    { id: 'inspiration', label: '灵光库' },
];

const AssetSelectionModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    assets: Asset[];
    selectedAssetIds: Set<string>;
    onToggleAsset: (assetId: string) => void;
}> = ({ isOpen, onClose, assets, selectedAssetIds, onToggleAsset }) => {
    const [activeAssetType, setActiveAssetType] = useState<Asset['type']>('character');
    
    const groupedAssets = useMemo(() => {
        return assets.reduce((acc, asset) => {
            if (!acc[asset.type]) {
                acc[asset.type] = [];
            }
            acc[asset.type].push(asset);
            return acc;
        }, {} as Record<Asset['type'], Asset[]>);
    }, [assets]);

    if (!isOpen) return null;

    const assetsToShow = groupedAssets[activeAssetType] || [];

    return createPortal(
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-[9999] p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-2xl p-6 flex flex-col relative max-h-[80vh]" onClick={e => e.stopPropagation()}>
                <button onClick={onClose} className="absolute top-4 right-4 p-2 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white rounded-full hover:bg-gray-100 dark:hover:bg-gray-800">
                    <X className="w-5 h-5" />
                </button>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">关联素材库</h3>

                <div className="border-b border-gray-200 dark:border-gray-800 mb-4">
                    <div className="flex -mb-px space-x-4">
                         {ASSET_TYPES.map(tab => (
                             <button
                                key={tab.id}
                                onClick={() => setActiveAssetType(tab.id)}
                                className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
                                    activeAssetType === tab.id
                                    ? 'border-sky-500 text-sky-500'
                                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                                }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="space-y-2 overflow-y-auto flex-1 pr-2">
                     {assetsToShow.length > 0 ? assetsToShow.map(asset => (
                        <label key={asset.id} className="flex items-center p-3 bg-gray-100 dark:bg-gray-800 rounded-lg cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                            <input
                                type="checkbox"
                                checked={selectedAssetIds.has(asset.id)}
                                onChange={() => onToggleAsset(asset.id)}
                                className="h-5 w-5 rounded border-gray-300 dark:border-gray-600 text-sky-500 focus:ring-sky-500 flex-shrink-0"
                            />
                            <div className="ml-4">
                                <p className="font-semibold text-gray-900 dark:text-white">{asset.name}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1">{asset.content}</p>
                            </div>
                        </label>
                    )) : (
                        <div className="text-center py-12 text-gray-400 dark:text-gray-500">
                            <p>该分类下暂无素材。</p>
                        </div>
                    )}
                </div>

                <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-800 flex justify-end">
                    <button onClick={onClose} className="bg-sky-600 text-white font-bold py-2 px-6 rounded-md hover:bg-sky-500 transition-colors">
                        确认关联 ({selectedAssetIds.size})
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

// --- Prompt Selection Modal ---
const PROMPT_TABS: { id: PromptCategory | 'all'; label: string }[] = [
  { id: 'all', label: '全部' },
  { id: 'script', label: '剧本' },
  { id: 'short-story', label: '短篇' },
  { id: 'long-story', label: '长篇' },
];

const PromptSelectionModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onSelectPrompt: (prompt: Prompt) => void;
}> = ({ isOpen, onClose, onSelectPrompt }) => {
    const [activeTab, setActiveTab] = useState<PromptCategory | 'all'>('script');
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
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-[9999] p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-4xl p-6 flex flex-col relative max-h-[85vh]" onClick={e => e.stopPropagation()}>
                 <button onClick={onClose} className="absolute top-4 right-4 p-2 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white rounded-full hover:bg-gray-100 dark:hover:bg-gray-800">
                    <X className="w-5 h-5" />
                </button>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 flex-shrink-0">选择提示词模板</h3>
                
                <div className="flex-shrink-0 space-y-4 mb-4">
                    <div className="flex gap-4 items-center">
                        <div className="bg-gray-100 dark:bg-gray-800 p-1 rounded-lg inline-flex">
                            {PROMPT_TABS.map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${activeTab === tab.id ? 'bg-white dark:bg-gray-700 text-sky-600 dark:text-sky-400 shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                        <div className="relative flex-1">
                            <input 
                                type="text" 
                                placeholder="搜索提示词..." 
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full pl-8 pr-4 py-1.5 text-sm bg-gray-100 dark:bg-gray-800 border-transparent focus:bg-white dark:focus:bg-gray-900 border focus:border-sky-500 rounded-md focus:outline-none transition-colors"
                            />
                            <Search className="w-4 h-4 absolute left-2.5 top-2 text-gray-400" />
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto pr-2 -mr-2">
                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredPrompts.length > 0 ? filteredPrompts.map(prompt => (
                            <SelectablePromptCard
                                key={prompt.id}
                                prompt={prompt}
                                onSelect={() => {
                                    onSelectPrompt(prompt);
                                    onClose();
                                }}
                            />
                        )) : (
                             <div className="col-span-full text-center py-12 text-gray-400">
                                <p>没有找到匹配的提示词。</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

// --- Workflow Selection Modal ---
const WorkflowSelectionModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onSelectWorkflow: (workflow: WorkflowType) => void;
}> = ({ isOpen, onClose, onSelectWorkflow }) => {
    const [searchTerm, setSearchTerm] = useState('');

    const filteredWorkflows = useMemo(() => {
        return WORKFLOWS.filter(wf => {
            return !searchTerm || wf.title.toLowerCase().includes(searchTerm.toLowerCase()) || wf.description.includes(searchTerm);
        });
    }, [searchTerm]);

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-[9999] p-4" onClick={onClose}>
             <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-4xl p-6 flex flex-col relative max-h-[85vh]" onClick={e => e.stopPropagation()}>
                 <button onClick={onClose} className="absolute top-4 right-4 p-2 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white rounded-full hover:bg-gray-100 dark:hover:bg-gray-800">
                    <X className="w-5 h-5" />
                </button>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 flex-shrink-0">选择工作流</h3>
                 <div className="relative mb-4 flex-shrink-0">
                     <input 
                        type="text" 
                        placeholder="搜索工作流..." 
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full pl-8 pr-4 py-2 text-sm bg-gray-100 dark:bg-gray-800 border-transparent focus:bg-white dark:focus:bg-gray-900 border focus:border-sky-500 rounded-md focus:outline-none transition-colors"
                    />
                    <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-gray-400" />
                </div>
                <div className="flex-1 overflow-y-auto pr-2 -mr-2">
                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                         {filteredWorkflows.map(wf => (
                            <button
                                key={wf.id}
                                onClick={() => {
                                    onSelectWorkflow(wf);
                                    onClose();
                                }}
                                className="text-left p-4 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 hover:border-sky-500 border border-transparent transition-all group flex flex-col"
                            >
                                <h4 className="font-semibold text-gray-900 dark:text-white mb-1">{wf.title}</h4>
                                <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">{wf.description}</p>
                                <div className="mt-auto pt-2 flex gap-2 text-xs text-gray-400">
                                    <span>🔥 {wf.heat}</span>
                                </div>
                            </button>
                         ))}
                          {filteredWorkflows.length === 0 && (
                             <div className="col-span-full text-center py-12 text-gray-400">
                                <p>没有找到匹配的工作流。</p>
                            </div>
                        )}
                     </div>
                </div>
             </div>
        </div>,
        document.body
    );
}


const ScriptAdaptationPanel: React.FC<ScriptAdaptationPanelProps> = ({ onInsert }) => {
    // Config State
    const [model, setModel] = useState('gemini-2.5-flash');
    const [temperature, setTemperature] = useState(1);
    const [topP, setTopP] = useState(0.95);
    const [selectionMode, setSelectionMode] = useState<SelectionMode>('prompt');
    const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);
    const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowType | null>(null);
    const [selectedAssetIds, setSelectedAssetIds] = useState<Set<string>>(new Set());
    
    // Modals
    const [isAssetModalOpen, setAssetModalOpen] = useState(false);
    const [isSelectionModalOpen, setSelectionModalOpen] = useState(false);
    const [isWorkflowModalOpen, setWorkflowModalOpen] = useState(false);

    // Form State (Dynamic based on selection)
    const [formState, setFormState] = useState<Record<string, string>>({});
    
    // Result
    const [isLoading, setIsLoading] = useState(false);
    const [generatedText, setGeneratedText] = useState('');
    const [error, setError] = useState('');

    // Initialize form state when selection changes
    useEffect(() => {
        const newForm: Record<string, string> = {};
        if (selectionMode === 'prompt' && selectedPrompt) {
            selectedPrompt.fields.forEach(f => newForm[f.id] = '');
        } else if (selectionMode === 'workflow' && selectedWorkflow) {
            selectedWorkflow.fields?.forEach(f => newForm[f.variable] = '');
        }
        setFormState(newForm);
        setGeneratedText('');
        setError('');
    }, [selectedPrompt, selectedWorkflow, selectionMode]);

    const handleGenerate = async () => {
        setIsLoading(true);
        setGeneratedText('');
        setError('');

        try {
            // 1. Build Asset Context
            const assetContext = Array.from(selectedAssetIds)
                .map(id => ASSETS.find(a => a.id === id))
                .filter(Boolean)
                .map(a => `【参考素材：${a!.name}】\n${a!.content}`)
                .join('\n\n');

            // 2. Build Prompt
            let finalPrompt = '';
            let template = '';
            
            if (selectionMode === 'prompt' && selectedPrompt) {
                template = selectedPrompt.template || selectedPrompt.content;
                for (const field of selectedPrompt.fields) {
                    const val = formState[field.id] || '';
                    template = template.replace(new RegExp(`\\$\\{${field.id}\\}`, 'g'), val);
                }
            } else if (selectionMode === 'workflow' && selectedWorkflow) {
                template = selectedWorkflow.template || '';
                selectedWorkflow.fields?.forEach(field => {
                     const val = formState[field.variable] || '';
                     template = template.replace(new RegExp(`\\$\\{${field.variable}\\}`, 'g'), val);
                });
            } else {
                // No prompt/workflow selected
                throw new Error("请选择一个提示词模板或工作流");
            }

             finalPrompt = `${assetContext ? `关联素材：\n${assetContext}\n\n---\n\n` : ''}${template}`;

            const result = await generateText(finalPrompt, { model, temperature, topP });
            setGeneratedText(result);

        } catch (err: any) {
            setError(err.message || '生成失败');
        } finally {
            setIsLoading(false);
        }
    };

    const handleInputChange = (key: string, val: string) => {
        setFormState(prev => ({ ...prev, [key]: val }));
    };

    // Helper to render fields
    const renderFields = () => {
        let fields: { id: string; label: string; placeholder?: string; type: 'text' | 'textarea' }[] = [];
        
        if (selectionMode === 'prompt' && selectedPrompt) {
            fields = selectedPrompt.fields.map(f => ({ ...f, id: f.id }));
        } else if (selectionMode === 'workflow' && selectedWorkflow && selectedWorkflow.fields) {
            fields = selectedWorkflow.fields.map(f => ({ id: f.variable, label: f.label, type: f.type, placeholder: '' }));
        } else {
             return (
                 <div className="text-center py-8 text-gray-400 text-sm border border-dashed border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900/50">
                     请先选择一个{selectionMode === 'prompt' ? '提示词模板' : '工作流'}
                 </div>
             )
        }

        return (
            <div className="space-y-4">
                {fields.map(field => (
                    <div key={field.id}>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                            {field.label}
                        </label>
                         {field.type === 'textarea' ? (
                            <textarea 
                                value={formState[field.id] || ''}
                                onChange={e => handleInputChange(field.id, e.target.value)}
                                placeholder={field.placeholder}
                                className="w-full p-3 text-sm bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-sky-500 focus:outline-none resize-none shadow-sm h-32"
                            />
                        ) : (
                            <input 
                                type="text"
                                value={formState[field.id] || ''}
                                onChange={e => handleInputChange(field.id, e.target.value)}
                                placeholder={field.placeholder}
                                className="w-full p-3 text-sm bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-sky-500 focus:outline-none shadow-sm"
                            />
                        )}
                    </div>
                ))}
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-black border-l border-gray-200 dark:border-gray-800 w-full">
            {/* Header */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex items-center gap-2 text-gray-900 dark:text-white font-bold">
                <Film className="w-5 h-5 text-sky-500" />
                分集改编
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                 {/* Modals */}
                 <AssetSelectionModal 
                    isOpen={isAssetModalOpen}
                    onClose={() => setAssetModalOpen(false)}
                    assets={ASSETS}
                    selectedAssetIds={selectedAssetIds}
                    onToggleAsset={(id) => setSelectedAssetIds(prev => {
                        const next = new Set(prev);
                        if (next.has(id)) next.delete(id);
                        else next.add(id);
                        return next;
                    })}
                 />
                 <PromptSelectionModal 
                    isOpen={isSelectionModalOpen}
                    onClose={() => setSelectionModalOpen(false)}
                    onSelectPrompt={setSelectedPrompt}
                 />
                 <WorkflowSelectionModal
                    isOpen={isWorkflowModalOpen}
                    onClose={() => setWorkflowModalOpen(false)}
                    onSelectWorkflow={setSelectedWorkflow}
                 />

                {/* Configuration Card */}
                <div className="bg-white dark:bg-gray-900 p-5 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-5">
                    {/* 1. Model Selection */}
                    <div>
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">模型选择</label>
                        <select 
                            value={model} 
                            onChange={e => setModel(e.target.value)} 
                            className="w-full p-2.5 text-sm rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-sky-500 focus:outline-none transition"
                        >
                            <option value="gemini-2.5-flash">Gemini 2.5 Flash (快速)</option>
                            <option value="gemini-2.5-pro">Gemini 2.5 Pro (深度)</option>
                            <option value="deepseek-chat">DeepSeek V3</option>
                            <option value="deepseek-reasoner">DeepSeek R1 (推理)</option>
                        </select>
                    </div>

                    {/* Parameters Sliders */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 flex justify-between">
                                <span>随机性 (Temperature)</span>
                                <span className="text-gray-700 dark:text-gray-300">{temperature}</span>
                            </label>
                            <input 
                                type="range" min="0" max="2" step="0.1" 
                                value={temperature} 
                                onChange={e => setTemperature(parseFloat(e.target.value))}
                                className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 accent-sky-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 flex justify-between">
                                <span>核采样 (Top P)</span>
                                <span className="text-gray-700 dark:text-gray-300">{topP}</span>
                            </label>
                            <input 
                                type="range" min="0" max="1" step="0.05" 
                                value={topP} 
                                onChange={e => setTopP(parseFloat(e.target.value))}
                                className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 accent-sky-500"
                            />
                        </div>
                    </div>

                    {/* 2. Selection Mode (Prompt vs Workflow) */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                             <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">生成方式</label>
                             <div className="flex bg-gray-100 dark:bg-gray-800 rounded-md p-0.5">
                                 <button 
                                    onClick={() => setSelectionMode('prompt')}
                                    className={`px-2 py-0.5 text-xs rounded transition-colors ${selectionMode === 'prompt' ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}
                                 >
                                     提示词
                                 </button>
                                 <button 
                                    onClick={() => setSelectionMode('workflow')}
                                    className={`px-2 py-0.5 text-xs rounded transition-colors ${selectionMode === 'workflow' ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}
                                 >
                                     工作流
                                 </button>
                             </div>
                        </div>

                        <button 
                            onClick={() => selectionMode === 'prompt' ? setSelectionModalOpen(true) : setWorkflowModalOpen(true)}
                            className={`w-full p-3 rounded-lg border text-left transition-all group relative overflow-hidden flex items-center justify-between ${
                                (selectionMode === 'prompt' ? selectedPrompt : selectedWorkflow)
                                ? 'bg-sky-50 border-sky-300 text-sky-900 dark:bg-sky-900/30 dark:border-sky-700 dark:text-sky-100' 
                                : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500 hover:border-sky-400'
                            }`}
                        >
                            <div className="flex items-center gap-2 truncate">
                                {selectionMode === 'prompt' ? <Sparkles className="w-4 h-4" /> : <Workflow className="w-4 h-4" />}
                                <span className="truncate font-medium">
                                    {selectionMode === 'prompt' 
                                        ? (selectedPrompt ? selectedPrompt.title : '选择提示词模板')
                                        : (selectedWorkflow ? selectedWorkflow.title : '选择工作流')
                                    }
                                </span>
                            </div>
                            <ChevronDown className="w-4 h-4 opacity-50" />
                        </button>
                    </div>

                     {/* 3. Asset Association */}
                     <div>
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">关联素材 (可选)</label>
                        <button 
                            onClick={() => setAssetModalOpen(true)}
                            className={`w-full p-3 rounded-lg border text-left transition-all flex items-center justify-between ${
                                selectedAssetIds.size > 0 
                                ? 'bg-purple-50 border-purple-300 text-purple-900 dark:bg-purple-900/30 dark:border-purple-700 dark:text-purple-100' 
                                : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500 hover:border-purple-400'
                            }`}
                        >
                            <div className="flex items-center gap-2">
                                <Database className="w-4 h-4" />
                                <span className="font-medium">{selectedAssetIds.size > 0 ? `已关联 ${selectedAssetIds.size} 个素材` : '选择素材...'}</span>
                            </div>
                            {selectedAssetIds.size > 0 && <span className="text-xs bg-purple-200 dark:bg-purple-800 px-1.5 py-0.5 rounded text-purple-800 dark:text-purple-200">{selectedAssetIds.size}</span>}
                        </button>
                     </div>
                </div>

                {/* Dynamic Inputs */}
                <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-200 mb-2">输入参数</label>
                    {renderFields()}
                </div>

                {/* Action */}
                <button 
                    onClick={handleGenerate}
                    disabled={isLoading || (selectionMode === 'prompt' && !selectedPrompt) || (selectionMode === 'workflow' && !selectedWorkflow)}
                    className="w-full py-3 bg-sky-600 text-white font-bold rounded-xl hover:bg-sky-500 disabled:bg-gray-400 transition-all shadow-lg hover:shadow-sky-500/30 flex items-center justify-center gap-2"
                >
                     {isLoading ? (
                        <>
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            改编中...
                        </>
                    ) : (
                        <>
                            <Film className="w-5 h-5" />
                            开始改编
                        </>
                    )}
                </button>

                {/* Error */}
                {error && <div className="text-red-500 text-sm bg-red-50 p-2 rounded">{error}</div>}

                {/* Result */}
                {generatedText && (
                    <div className="bg-white dark:bg-gray-900 p-4 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm">
                        <div className="flex justify-between items-center mb-2">
                            <h4 className="font-bold text-gray-700 dark:text-gray-300">生成结果</h4>
                            <div className="flex gap-2">
                                <button onClick={() => navigator.clipboard.writeText(generatedText)} title="复制"><Copy className="w-4 h-4 text-gray-500 hover:text-sky-500" /></button>
                                <button onClick={() => onInsert(generatedText)} title="插入到编辑器" className="text-sky-600 text-xs font-bold hover:underline">插入正文</button>
                            </div>
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto font-mono">
                            {generatedText}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ScriptAdaptationPanel;
