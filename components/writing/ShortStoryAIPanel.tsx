
import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Sparkles, DocumentPlus, ClipboardDocumentCheck, ChatBubbleLeftRight, Copy, Trash, BookOpen, Pencil, Workflow, Search, X, ChevronDown, Database } from '../Icon';
import { generateText } from '../../services/geminiService';
import { ASSETS, PROMPTS } from '../../constants';
import { Asset, Prompt, PromptCategory } from '../../types';
import SelectablePromptCard from '../SelectablePromptCard';
import { fetchPrompts } from '../../services/supabaseService';

interface ShortStoryAIPanelProps {
    contextText?: string;
    selectedText?: string;
    onInsert: (text: string) => void;
    onReplace: (text: string) => void;
}

type ShortStoryTab = 'original' | 'imitate' | 'polish' | 'review';

const MOCK_WORKFLOWS = [
    { id: 'wf-1', name: '通用小说创作' },
    { id: 'wf-2', name: '悬疑推理专用' },
    { id: 'wf-3', name: '情感文风优化' },
];

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
  { id: 'short-story', label: '短篇' },
  { id: 'long-story', label: '长篇' },
  { id: 'script', label: '剧本' },
];

const PromptSelectionModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onSelectPrompt: (prompt: Prompt) => void;
}> = ({ isOpen, onClose, onSelectPrompt }) => {
    const [activeTab, setActiveTab] = useState<PromptCategory | 'all'>('short-story');
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


const ShortStoryAIPanel: React.FC<ShortStoryAIPanelProps> = ({ contextText = '', selectedText = '', onInsert, onReplace }) => {
    const [activeTab, setActiveTab] = useState<ShortStoryTab>('original');
    
    // Global Config for this Panel
    const [model, setModel] = useState('gemini-2.5-flash');
    const [temperature, setTemperature] = useState(1);
    const [topP, setTopP] = useState(0.95);
    const [selectedWorkflow, setSelectedWorkflow] = useState(MOCK_WORKFLOWS[0].id);
    const [selectedAssetIds, setSelectedAssetIds] = useState<Set<string>>(new Set());
    const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);

    // Modals
    const [isAssetModalOpen, setAssetModalOpen] = useState(false);
    const [isPromptModalOpen, setPromptModalOpen] = useState(false);

    // Input State
    const [promptInput, setPromptInput] = useState('');
    const [referenceText, setReferenceText] = useState(''); // For imitate
    const [formState, setFormState] = useState<Record<string, string>>({}); // For dynamic prompts
    
    // Result State
    const [isLoading, setIsLoading] = useState(false);
    const [resultText, setResultText] = useState('');
    const [error, setError] = useState('');
    const [lastGeneratedTab, setLastGeneratedTab] = useState<ShortStoryTab | null>(null);

    // Reset inputs when tab changes
    useEffect(() => {
        setPromptInput('');
        setReferenceText('');
        setResultText('');
        setError('');
        setSelectedPrompt(null); // Reset prompt when switching tabs
    }, [activeTab]);

    // Initialize form state when prompt changes
    useEffect(() => {
        if (selectedPrompt) {
            const newForm: Record<string, string> = {};
            selectedPrompt.fields.forEach(f => newForm[f.id] = '');
            setFormState(newForm);
        } else {
            setFormState({});
        }
    }, [selectedPrompt]);

    // Auto-fill inputs based on tab and selection
    useEffect(() => {
        if (activeTab === 'polish' && selectedText) {
             // Polish tab works best with selected text
        } else if (activeTab === 'imitate' && selectedText && !referenceText) {
            setReferenceText(selectedText);
        }
    }, [activeTab, selectedText]);

    const handleInputChange = (id: string, val: string) => {
        setFormState(prev => ({ ...prev, [id]: val }));
    };

    const handleGenerate = async () => {
        setIsLoading(true);
        setResultText('');
        setError('');
        setLastGeneratedTab(activeTab);

        try {
            // 1. Build Asset Context
            const assetContext = Array.from(selectedAssetIds)
                .map(id => ASSETS.find(a => a.id === id))
                .filter(Boolean)
                .map(a => `【参考素材：${a!.name}】\n${a!.content}`)
                .join('\n\n');

            // 2. Build Prompt
            let finalPrompt = '';
            
            if (selectedPrompt) {
                // If a prompt is selected, use its template and fields
                let template = selectedPrompt.template || selectedPrompt.content;
                for (const field of selectedPrompt.fields) {
                    const val = formState[field.id] || '';
                    template = template.replace(new RegExp(`\\$\\{${field.id}\\}`, 'g'), val);
                }
                finalPrompt = `${assetContext ? `关联素材：\n${assetContext}\n\n---\n\n` : ''}${template}`;
            } else {
                // Fallback to tab-specific logic
                const currentContext = contextText.slice(-2000); // Context for continuity

                if (activeTab === 'original') {
                    finalPrompt = `请根据以下要求写一段短篇小说的正文。\n\n【要求】：${promptInput}\n\n${assetContext ? `\n${assetContext}` : ''}`;
                } else if (activeTab === 'imitate') {
                    finalPrompt = `请模仿以下参考文本的风格，并根据新的要求进行创作。\n\n【参考文本风格】：${referenceText}\n\n【新内容要求】：${promptInput}\n\n${assetContext ? `\n${assetContext}` : ''}`;
                } else if (activeTab === 'polish') {
                    const textToPolish = selectedText || currentContext;
                    finalPrompt = `请对以下文本进行润色优化，使其更具文学性，风格要求：${promptInput || '通用文学风格'}。\n\n【待润色文本】：\n${textToPolish}\n\n${assetContext ? `\n${assetContext}` : ''}`;
                } else if (activeTab === 'review') {
                     const textToReview = selectedText || currentContext;
                     finalPrompt = `请作为一名专业的文学编辑，对以下文本进行评审，指出优缺点并给出修改建议。关注点：${promptInput || '情节逻辑、人物塑造'}。\n\n【待评审文本】：\n${textToReview}`;
                }

                // Workflow simulation (appending instruction)
                const workflowName = MOCK_WORKFLOWS.find(w => w.id === selectedWorkflow)?.name;
                if (workflowName) {
                    finalPrompt = `[工作流：${workflowName}]\n${finalPrompt}`;
                }
            }

            const text = await generateText(finalPrompt, { model, temperature, topP });
            
            // 3. Handle Output
            if (activeTab === 'original' || activeTab === 'imitate') {
                onInsert(text);
            }
            
            setResultText(text);

        } catch (err: any) {
            setError(err.message || '生成失败');
        } finally {
            setIsLoading(false);
        }
    };

    const renderTabButton = (type: ShortStoryTab, label: string, Icon: React.ElementType) => (
        <button
            onClick={() => setActiveTab(type)}
            className={`flex-1 py-4 flex flex-col items-center justify-center gap-2 transition-colors border-b-2 ${
                activeTab === type 
                    ? 'border-sky-500 text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-900/20' 
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800'
            }`}
        >
            <Icon className="w-6 h-6" />
            <span className="text-base font-bold">{label}</span>
        </button>
    );

    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-black border-l border-gray-200 dark:border-gray-800">
            <AssetSelectionModal 
                isOpen={isAssetModalOpen} 
                onClose={() => setAssetModalOpen(false)}
                assets={ASSETS}
                selectedAssetIds={selectedAssetIds}
                onToggleAsset={(id) => {
                    setSelectedAssetIds(prev => {
                        const next = new Set(prev);
                        if (next.has(id)) next.delete(id);
                        else next.add(id);
                        return next;
                    });
                }}
            />
            <PromptSelectionModal 
                isOpen={isPromptModalOpen}
                onClose={() => setPromptModalOpen(false)}
                onSelectPrompt={setSelectedPrompt}
            />

            {/* 1. Tabs */}
            <div className="flex border-b border-gray-200 dark:border-gray-800">
                {renderTabButton('original', '原创', Sparkles)}
                {renderTabButton('imitate', '仿写', DocumentPlus)}
                {renderTabButton('polish', '润色', Pencil)}
                {renderTabButton('review', '评审', ClipboardDocumentCheck)}
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8">
                
                {/* 2. Global Config Area */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">模型配置</label>
                        <select 
                            value={model} 
                            onChange={e => setModel(e.target.value)} 
                            className="w-full p-2.5 text-sm rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-sky-500 focus:outline-none transition shadow-sm"
                        >
                            <option value="gemini-2.5-flash">Gemini 2.5 Flash (快速)</option>
                            <option value="gemini-2.5-pro">Gemini 2.5 Pro (深度)</option>
                            <option value="deepseek-chat">DeepSeek V3</option>
                            <option value="deepseek-reasoner">DeepSeek R1 (推理)</option>
                        </select>
                    </div>
                    
                    {/* Parameters Sliders - Horizontal Layout */}
                    <div className="col-span-2 grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 flex justify-between items-center">
                                <span>随机度</span>
                                <span className="text-gray-700 dark:text-gray-300 font-mono">{temperature}</span>
                            </label>
                            <input 
                                type="range" min="0" max="2" step="0.1" 
                                value={temperature} 
                                onChange={e => setTemperature(parseFloat(e.target.value))}
                                className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 accent-sky-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 flex justify-between items-center">
                                <span>核采样</span>
                                <span className="text-gray-700 dark:text-gray-300 font-mono">{topP}</span>
                            </label>
                            <input 
                                type="range" min="0" max="1" step="0.05" 
                                value={topP} 
                                onChange={e => setTopP(parseFloat(e.target.value))}
                                className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 accent-sky-500"
                            />
                        </div>
                    </div>

                    <div className="col-span-2">
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">提示词选择</label>
                        <button 
                            onClick={() => setPromptModalOpen(true)}
                            className={`w-full p-3 rounded-lg border text-left transition-all group relative overflow-hidden ${
                                selectedPrompt 
                                ? 'bg-sky-50 border-sky-300 text-sky-900 dark:bg-sky-900/30 dark:border-sky-700 dark:text-sky-100' 
                                : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-500 hover:border-sky-400'
                            }`}
                        >
                            <div className="flex items-center justify-between relative z-10">
                                <div className="flex items-center gap-2 overflow-hidden">
                                    <Sparkles className={`w-4 h-4 flex-shrink-0 ${selectedPrompt ? 'text-sky-600 dark:text-sky-400' : 'text-gray-400'}`} />
                                    <span className="font-semibold truncate">{selectedPrompt ? selectedPrompt.title : '点击选择提示词模板...'}</span>
                                </div>
                                {selectedPrompt ? (
                                    <X className="w-4 h-4 opacity-50 hover:opacity-100" onClick={(e) => { e.stopPropagation(); setSelectedPrompt(null); }} />
                                ) : (
                                    <ChevronDown className="w-4 h-4 opacity-50" />
                                )}
                            </div>
                        </button>
                    </div>

                    {!selectedPrompt && (
                        <div className="col-span-1">
                            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">选择工作流</label>
                            <div className="relative">
                                <select 
                                    value={selectedWorkflow} 
                                    onChange={e => setSelectedWorkflow(e.target.value)} 
                                    className="w-full p-2.5 pl-9 text-sm rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-sky-500 focus:outline-none transition shadow-sm appearance-none"
                                >
                                    {MOCK_WORKFLOWS.map(wf => (
                                        <option key={wf.id} value={wf.id}>{wf.name}</option>
                                    ))}
                                </select>
                                <Workflow className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                            </div>
                        </div>
                    )}
                     <div className={selectedPrompt ? "col-span-2" : "col-span-1"}>
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">关联素材</label>
                        <button 
                            onClick={() => setAssetModalOpen(true)}
                            className={`w-full p-2.5 text-sm rounded-lg border focus:ring-2 focus:ring-sky-500 focus:outline-none transition shadow-sm flex items-center justify-between ${selectedAssetIds.size > 0 ? 'bg-sky-50 border-sky-200 text-sky-700 dark:bg-sky-900/30 dark:border-sky-800 dark:text-sky-400' : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'}`}
                        >
                            <span className="truncate">{selectedAssetIds.size > 0 ? `已选 ${selectedAssetIds.size} 项` : '选择素材'}</span>
                            <BookOpen className="w-4 h-4 flex-shrink-0" />
                        </button>
                    </div>
                </div>

                <hr className="border-gray-200 dark:border-gray-800" />

                {/* 3. Dynamic Input Area based on Tab or Selected Prompt */}
                <div className="space-y-4">
                    {selectedPrompt ? (
                        <div className="space-y-4 animate-fade-in">
                            <div className="flex items-center justify-between pb-2 border-b border-gray-200 dark:border-gray-800">
                                <span className="text-sm font-bold text-gray-900 dark:text-white">参数配置</span>
                            </div>
                            {selectedPrompt.fields.map(field => (
                                <div key={field.id}>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                        {field.label}
                                    </label>
                                    {field.type === 'textarea' ? (
                                        <textarea 
                                            value={formState[field.id] || ''}
                                            onChange={e => handleInputChange(field.id, e.target.value)}
                                            placeholder={field.placeholder}
                                            className="w-full p-3 text-sm bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 focus:outline-none resize-none transition-shadow shadow-sm h-24"
                                        />
                                    ) : (
                                        <input 
                                            type="text"
                                            value={formState[field.id] || ''}
                                            onChange={e => handleInputChange(field.id, e.target.value)}
                                            placeholder={field.placeholder}
                                            className="w-full p-3 text-sm bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 focus:outline-none transition-shadow shadow-sm"
                                        />
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <>
                            {activeTab === 'original' && (
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-200 mb-2">创作要求</label>
                                    <textarea 
                                        value={promptInput}
                                        onChange={e => setPromptInput(e.target.value)}
                                        placeholder="请输入你的故事构思、核心梗概或具体要求..."
                                        className="w-full h-40 p-3 text-sm bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-sky-500 focus:outline-none resize-none shadow-sm"
                                    />
                                </div>
                            )}

                            {activeTab === 'imitate' && (
                                <>
                                     <div>
                                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-200 mb-2">参考范文 / 风格来源</label>
                                        <textarea 
                                            value={referenceText}
                                            onChange={e => setReferenceText(e.target.value)}
                                            placeholder="在此粘贴你想模仿的文本段落..."
                                            className="w-full h-24 p-3 text-sm bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-sky-500 focus:outline-none resize-none shadow-sm mb-4"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-200 mb-2">新内容要求</label>
                                        <textarea 
                                            value={promptInput}
                                            onChange={e => setPromptInput(e.target.value)}
                                            placeholder="描述你希望生成的新内容..."
                                            className="w-full h-24 p-3 text-sm bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-sky-500 focus:outline-none resize-none shadow-sm"
                                        />
                                    </div>
                                </>
                            )}

                            {activeTab === 'polish' && (
                                <div>
                                    <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg mb-4 text-sm text-blue-800 dark:text-blue-300 flex items-start gap-2">
                                        <div className="mt-0.5">ℹ️</div>
                                        <div>
                                            {selectedText ? '已读取编辑器中选中的文本进行润色。' : '未选中文本，将尝试读取光标附近的内容。'}
                                        </div>
                                    </div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-200 mb-2">润色方向</label>
                                    <input 
                                        type="text"
                                        value={promptInput}
                                        onChange={e => setPromptInput(e.target.value)}
                                        placeholder="例如：更有画面感、增加心理描写、文风犀利点..."
                                        className="w-full p-3 text-sm bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-sky-500 focus:outline-none shadow-sm"
                                    />
                                </div>
                            )}

                             {activeTab === 'review' && (
                                <div>
                                     <div className="bg-purple-50 dark:bg-purple-900/20 p-3 rounded-lg mb-4 text-sm text-purple-800 dark:text-purple-300 flex items-start gap-2">
                                        <div className="mt-0.5">ℹ️</div>
                                        <div>
                                            AI将对你的文本进行专业分析并给出建议。
                                        </div>
                                    </div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-200 mb-2">关注重点 (可选)</label>
                                    <input 
                                        type="text"
                                        value={promptInput}
                                        onChange={e => setPromptInput(e.target.value)}
                                        placeholder="例如：逻辑漏洞、人物性格一致性..."
                                        className="w-full p-3 text-sm bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-sky-500 focus:outline-none shadow-sm"
                                    />
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* 4. Generate Button */}
                <button 
                    onClick={handleGenerate}
                    disabled={isLoading || (activeTab === 'imitate' && !referenceText && !selectedPrompt)}
                    className="w-full py-4 bg-sky-600 text-white font-bold text-lg rounded-xl hover:bg-sky-500 disabled:bg-gray-400 transition-all shadow-lg hover:shadow-sky-500/30 flex items-center justify-center gap-2"
                >
                    {isLoading ? (
                        <>
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            创作中...
                        </>
                    ) : (
                        <>
                            <Sparkles className="w-5 h-5" />
                            开始{activeTab === 'original' ? '创作' : activeTab === 'imitate' ? '仿写' : activeTab === 'polish' ? '润色' : '评审'}
                        </>
                    )}
                </button>

                {/* Error Message */}
                {error && (
                    <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-lg">
                        {error}
                    </div>
                )}

                {/* 5. Result Area */}
                {resultText && (
                    <div className="space-y-3 pt-6 border-t border-gray-200 dark:border-gray-800 animate-fade-in-up">
                        <div className="flex justify-between items-center">
                            <h4 className="text-base font-bold text-gray-800 dark:text-white flex items-center gap-2">
                                生成结果
                                {((activeTab === 'original' || activeTab === 'imitate') && !selectedPrompt) && (
                                    <span className="text-xs font-normal text-green-600 bg-green-100 px-2 py-0.5 rounded-full">已插入</span>
                                )}
                            </h4>
                            <div className="flex gap-2">
                                <button 
                                    onClick={() => navigator.clipboard.writeText(resultText)}
                                    className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 hover:text-sky-600 transition-colors"
                                    title="复制"
                                >
                                    <Copy className="w-4 h-4" />
                                </button>
                                <button 
                                    onClick={() => setResultText('')}
                                    className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 hover:text-red-600 transition-colors"
                                    title="清除"
                                >
                                    <Trash className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        <div className="p-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 text-sm leading-relaxed text-gray-700 dark:text-gray-300 whitespace-pre-wrap max-h-80 overflow-y-auto shadow-inner">
                            {resultText}
                        </div>
                        
                        {activeTab === 'polish' && (
                            <button 
                                onClick={() => onReplace(resultText)}
                                className="w-full py-3 bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400 font-bold rounded-lg hover:bg-sky-200 dark:hover:bg-sky-900/50 transition-colors text-sm"
                            >
                                替换选中文本
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ShortStoryAIPanel;
