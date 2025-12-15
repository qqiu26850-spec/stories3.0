
import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Asset, Prompt, Workflow } from '../../types';
import { generateText, generateTextStream } from '../../services/geminiService';
import { fetchMaterials, fetchPrompts, incrementPromptHeat } from '../../services/supabaseService';
import { PROMPTS, WORKFLOWS as MOCK_WORKFLOWS } from '../../constants';
import { Sparkles, DocumentPlus, Pencil, ClipboardDocumentCheck, X, ChevronDown, Workflow as WorkflowIcon, BookOpen, Copy, Trash } from '../Icon';
import SelectablePromptCard from '../SelectablePromptCard';

type ShortStoryTab = 'original' | 'imitate' | 'polish' | 'review';

interface ShortStoryAIPanelProps {
    contextText: string;
    selectedText: string;
    onInsert: (text: string) => void;
    onReplace: (text: string) => void;
    onStream?: (text: string, isFirst: boolean) => void;
}

const AssetSelectionModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    assets: Asset[];
    selectedAssetIds: Set<string>;
    onToggleAsset: (id: string) => void;
}> = ({ isOpen, onClose, assets, selectedAssetIds, onToggleAsset }) => {
    if (!isOpen) return null;
    return createPortal(
        <div className="fixed inset-0 bg-black/60 dark:bg-black/80 flex items-center justify-center z-[100] p-4 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-2xl p-6 flex flex-col max-h-[85vh] animate-fade-in-up" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">选择素材</h3>
                    <button onClick={onClose}><X className="w-5 h-5 text-gray-500" /></button>
                </div>
                <div className="flex-1 overflow-y-auto space-y-3 p-1">
                    {assets.map(asset => (
                        <div key={asset.id} 
                             onClick={() => onToggleAsset(asset.id)}
                             className={`p-4 rounded-lg border cursor-pointer transition-all ${selectedAssetIds.has(asset.id) ? 'border-sky-500 bg-sky-50 dark:bg-sky-900/20' : 'border-gray-200 dark:border-gray-800 hover:border-sky-300'}`}
                        >
                            <div className="flex justify-between items-center">
                                <h4 className="font-bold text-gray-800 dark:text-gray-200">{asset.name}</h4>
                                {selectedAssetIds.has(asset.id) && <div className="w-3 h-3 bg-sky-500 rounded-full" />}
                            </div>
                            <p className="text-xs text-gray-500 mt-1 line-clamp-2">{asset.content}</p>
                        </div>
                    ))}
                    {assets.length === 0 && <div className="text-center text-gray-500 py-8">暂无素材</div>}
                </div>
                <button onClick={onClose} className="mt-4 w-full py-2 bg-sky-600 text-white rounded-lg font-bold">确定</button>
            </div>
        </div>,
        document.body
    );
};

const PromptSelectionModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onSelectPrompt: (prompt: Prompt) => void;
}> = ({ isOpen, onClose, onSelectPrompt }) => {
    const [localPrompts, setLocalPrompts] = useState<Prompt[]>([]);
    
    useEffect(() => {
        if(isOpen) {
            const load = async () => {
                const dbPrompts = await fetchPrompts();
                const mapped = dbPrompts ? dbPrompts.map((p: any) => {
                    let parsed: any = {};
                    try { parsed = JSON.parse(p.content); } catch (e) {}
                    return {
                        id: p.id,
                        title: p.title,
                        description: parsed.description || p.description,
                        content: parsed.template || p.content,
                        category: p.main_category === 'long' ? 'long-story' : p.main_category === 'script' ? 'script' : 'short-story',
                        subCategories: p.sub_category ? [p.sub_category] : [],
                        fields: parsed.fields || [],
                        template: parsed.template || p.content,
                        heat: p.usage_count,
                        creator: 'user'
                    } as Prompt;
                }) : [];
                setLocalPrompts([...mapped, ...PROMPTS]);
            };
            load();
        }
    }, [isOpen]);

    if (!isOpen) return null;
    return createPortal(
        <div className="fixed inset-0 bg-black/60 dark:bg-black/80 flex items-center justify-center z-[100] p-4 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col animate-fade-in-up" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-800">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">选择提示词模板</h3>
                    <button onClick={onClose}><X className="w-5 h-5 text-gray-500" /></button>
                </div>
                <div className="flex-1 overflow-y-auto p-6 bg-gray-50 dark:bg-black/20">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {localPrompts.map(p => (
                            <SelectablePromptCard key={p.id} prompt={p} onSelect={() => { onSelectPrompt(p); onClose(); }} />
                        ))}
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

const ShortStoryAIPanel: React.FC<ShortStoryAIPanelProps> = ({ contextText = '', selectedText = '', onInsert, onReplace, onStream }) => {
    const [activeTab, setActiveTab] = useState<ShortStoryTab>('original');
    
    // Global Config for this Panel
    const [model, setModel] = useState('gemini-2.5-flash');
    const [temperature, setTemperature] = useState(1);
    const [topP, setTopP] = useState(0.95);
    const [selectedWorkflow, setSelectedWorkflow] = useState(MOCK_WORKFLOWS[0]?.id || '');
    const [selectedAssetIds, setSelectedAssetIds] = useState<Set<string>>(new Set());
    const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);
    const [assets, setAssets] = useState<Asset[]>([]);

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

    useEffect(() => {
        const loadAssets = async () => {
            const data = await fetchMaterials();
            const mappedAssets: Asset[] = data.map((item: any) => ({
                id: item.id,
                name: item.name || item.title,
                type: item.type === 'idea' ? 'inspiration' : item.type,
                content: item.content,
                tags: item.tags || [],
                data: { name: item.name }
            }));
            setAssets(mappedAssets);
        };
        loadAssets();
    }, []);

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
                .map(id => assets.find(a => a.id === id))
                .filter(Boolean)
                .map(a => `【参考素材：${a!.name}】\n${a!.content}`)
                .join('\n\n');

            // 2. Build Prompt
            let finalPrompt = '';
            
            if (selectedPrompt) {
                incrementPromptHeat(selectedPrompt.id); // Increment usage if prompt selected
                
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
                const workflowName = MOCK_WORKFLOWS.find(w => w.id === selectedWorkflow)?.title;
                if (workflowName) {
                    finalPrompt = `[工作流：${workflowName}]\n${finalPrompt}`;
                }
            }

            // Stream Handling
            if (onStream && (activeTab === 'original' || activeTab === 'imitate')) {
                const stream = generateTextStream(finalPrompt, { model, temperature, topP });
                let isFirst = true;
                let fullText = '';
                
                for await (const chunk of stream) {
                    onStream(chunk, isFirst);
                    fullText += chunk;
                    setResultText(fullText);
                    isFirst = false;
                }
            } else {
                const text = await generateText(finalPrompt, { model, temperature, topP });
                if (activeTab === 'original' || activeTab === 'imitate') {
                    onInsert(text);
                }
                setResultText(text);
            }

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
                assets={assets}
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

            <div className="flex border-b border-gray-200 dark:border-gray-800">
                {renderTabButton('original', '原创', Sparkles)}
                {renderTabButton('imitate', '仿写', DocumentPlus)}
                {renderTabButton('polish', '润色', Pencil)}
                {renderTabButton('review', '评审', ClipboardDocumentCheck)}
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8">
                
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
                                        <option key={wf.id} value={wf.id}>{wf.title}</option>
                                    ))}
                                </select>
                                <WorkflowIcon className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
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

                {error && (
                    <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-lg">
                        {error}
                    </div>
                )}

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
