import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Asset, Prompt } from '../../types';
import { generateText, generateTextStream } from '../../services/geminiService';
import { fetchMaterials, fetchPrompts, incrementPromptHeat } from '../../services/supabaseService';
import { PROMPTS } from '../../constants';
import { Sparkles, Film, X, ChevronDown, BookOpen, Copy, Trash } from '../Icon';
import SelectablePromptCard from '../SelectablePromptCard';

interface ScriptAIPanelProps {
    onInsert: (text: string) => void;
    onStream?: (text: string, isFirst: boolean) => void;
}

type ScriptTab = 'idea' | 'script';

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

const ScriptAIPanel: React.FC<ScriptAIPanelProps> = ({ onInsert, onStream }) => {
    const [activeTab, setActiveTab] = useState<ScriptTab>('idea');
    
    // Common Config
    const [model, setModel] = useState('gemini-2.5-flash');
    const [temperature, setTemperature] = useState(1);
    const [topP, setTopP] = useState(0.95);
    
    // Modal States
    const [isAssetModalOpen, setAssetModalOpen] = useState(false);
    const [isPromptModalOpen, setPromptModalOpen] = useState(false);

    const [selectedAssetIds, setSelectedAssetIds] = useState<Set<string>>(new Set());
    const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);
    const [assets, setAssets] = useState<Asset[]>([]);
    
    // Input
    const [customInput, setCustomInput] = useState('');
    const [formState, setFormState] = useState<Record<string, string>>({});

    // Result
    const [isLoading, setIsLoading] = useState(false);
    const [generatedIdeas, setGeneratedIdeas] = useState<string[]>([]); // For Idea tab
    const [generatedText, setGeneratedText] = useState(''); // For Script tab
    const [error, setError] = useState('');

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

    // Reset form state when prompt changes
    useEffect(() => {
        if (selectedPrompt) {
            const newForm: Record<string, string> = {};
            selectedPrompt.fields.forEach(f => newForm[f.id] = '');
            setFormState(newForm);
        } else {
            setFormState({});
        }
    }, [selectedPrompt]);

    const handleInputChange = (id: string, val: string) => {
        setFormState(prev => ({ ...prev, [id]: val }));
    };

    const handleGenerate = async () => {
        setIsLoading(true);
        setGeneratedIdeas([]);
        setGeneratedText('');
        setError('');

        try {
            // 1. Build Asset Context
            const assetContext = Array.from(selectedAssetIds)
                .map(id => assets.find(a => a.id === id))
                .filter(Boolean)
                .map(a => `【参考素材：${a!.name}】\n${a!.content}`)
                .join('\n\n');

            // 2. Build Prompt
            let finalPrompt = '';
            let promptContent = '';

            if (selectedPrompt) {
                incrementPromptHeat(selectedPrompt.id); // Increment usage if prompt selected
                
                promptContent = selectedPrompt.template || selectedPrompt.content;
                for (const field of selectedPrompt.fields) {
                    const val = formState[field.id] || '';
                    promptContent = promptContent.replace(new RegExp(`\\$\\{${field.id}\\}`, 'g'), val);
                }
            } else {
                promptContent = customInput;
            }

            if (activeTab === 'idea') {
                finalPrompt = `请根据以下信息，生成3个截然不同的剧本创意方案。
每个方案请用【方案一】、【方案二】、【方案三】作为开头进行分隔。
每个方案应包含：标题、一句话梗概、核心冲突、简要剧情走向。

${selectedPrompt ? `【创作模板】\n${promptContent}\n` : `【创作需求】\n${promptContent}\n`}
${assetContext ? `关联素材：\n${assetContext}\n` : ''}
`;
            } else {
                // Script
                finalPrompt = `请写一段标准的影视剧本正文。格式要求：包含场景标题（INT./EXT.）、场景描述、人物动作、对白。
${selectedPrompt ? `【创作模板】\n${promptContent}\n` : `【创作需求】\n${promptContent}\n`}
${assetContext ? `关联素材：\n${assetContext}\n` : ''}
`;
            }

            if (activeTab === 'idea') {
                const result = await generateText(finalPrompt, { model, temperature, topP });
                // Parse ideas
                const ideas = result.split(/【方案[一二三]】/).filter(s => s.trim().length > 10);
                if (ideas.length === 0) {
                    setGeneratedIdeas([result]); // Fallback if split fails
                } else {
                    setGeneratedIdeas(ideas.map(s => s.trim()));
                }
            } else {
                if (onStream) {
                    const stream = generateTextStream(finalPrompt, { model, temperature, topP });
                    let isFirst = true;
                    let fullText = '';
                    for await (const chunk of stream) {
                        onStream(chunk, isFirst);
                        fullText += chunk;
                        setGeneratedText(fullText);
                        isFirst = false;
                    }
                } else {
                    const result = await generateText(finalPrompt, { model, temperature, topP });
                    setGeneratedText(result);
                }
            }

        } catch (err: any) {
            setError(err.message || '生成失败');
        } finally {
            setIsLoading(false);
        }
    };

    const renderTabButton = (type: ScriptTab, label: string, Icon: React.ElementType) => (
        <button
            onClick={() => setActiveTab(type)}
            className={`flex-1 py-2 flex items-center justify-center gap-2 transition-colors border-b-2 ${
                activeTab === type 
                    ? 'border-sky-500 text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-900/20' 
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800'
            }`}
        >
            <Icon className="w-4 h-4" />
            <span className="text-sm font-bold">{label}</span>
        </button>
    );

    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-black border-l border-gray-200 dark:border-gray-800 w-full">
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
                {renderTabButton('idea', '创意', Sparkles)}
                {renderTabButton('script', '剧本', Film)}
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                
                <div className="space-y-4 bg-white dark:bg-gray-900 p-4 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">模型选择</label>
                        <select 
                            value={model} 
                            onChange={e => setModel(e.target.value)} 
                            className="w-full p-2 text-sm rounded bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:ring-1 focus:ring-sky-500 focus:outline-none"
                        >
                            <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                            <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
                            <option value="deepseek-chat">DeepSeek V3</option>
                            <option value="deepseek-reasoner">DeepSeek R1 (推理)</option>
                        </select>
                    </div>

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
                    
                    <div className="space-y-2">
                        <button 
                            onClick={() => setPromptModalOpen(true)}
                            className={`w-full py-2 px-3 text-sm rounded border transition-colors flex items-center justify-between group ${selectedPrompt ? 'bg-sky-50 border-sky-300 text-sky-700 dark:bg-sky-900/30 dark:border-sky-700 dark:text-sky-400' : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 hover:border-sky-400'}`}
                        >
                            <div className="flex items-center gap-2 truncate">
                                <Sparkles className="w-4 h-4 flex-shrink-0" />
                                <span className="truncate">{selectedPrompt ? selectedPrompt.title : '选择提示词模板'}</span>
                            </div>
                            {selectedPrompt ? (
                                <X 
                                    className="w-4 h-4 opacity-50 hover:opacity-100 z-10" 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedPrompt(null);
                                    }}
                                />
                            ) : (
                                <ChevronDown className="w-4 h-4 opacity-50" />
                            )}
                        </button>

                        <button 
                            onClick={() => setAssetModalOpen(true)}
                            className={`w-full py-2 px-3 text-sm rounded border transition-colors flex items-center justify-between ${selectedAssetIds.size > 0 ? 'bg-sky-50 border-sky-300 text-sky-700 dark:bg-sky-900/30 dark:border-sky-700 dark:text-sky-400' : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 hover:border-sky-400'}`}
                        >
                            <div className="flex items-center gap-2">
                                <BookOpen className="w-4 h-4 flex-shrink-0" />
                                <span>关联素材库</span>
                            </div>
                             {selectedAssetIds.size > 0 && <span className="text-xs bg-purple-200 dark:bg-purple-800 px-1.5 py-0.5 rounded">{selectedAssetIds.size}</span>}
                        </button>
                    </div>
                </div>

                <div>
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
                        <div>
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-200 mb-2">
                                {activeTab === 'idea' ? '创意需求 / 核心梗概' : '场景描述 / 剧情段落'}
                            </label>
                            <textarea 
                                value={customInput}
                                onChange={e => setCustomInput(e.target.value)}
                                placeholder={activeTab === 'idea' ? '例如：写一个关于时间旅行的悬疑故事...' : '输入具体的场景信息或剧情要求...'}
                                className="w-full h-32 p-3 text-sm bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-sky-500 focus:outline-none resize-none shadow-sm"
                            />
                        </div>
                    )}
                </div>

                <button 
                    onClick={handleGenerate}
                    disabled={isLoading}
                    className="w-full py-3 bg-sky-600 text-white font-bold text-lg rounded-xl hover:bg-sky-500 disabled:bg-gray-400 transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
                >
                     {isLoading ? (
                        <>
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            思考中...
                        </>
                    ) : (
                        <>
                            <Sparkles className="w-5 h-5" />
                            生成{activeTab === 'idea' ? '创意' : '剧本'}
                        </>
                    )}
                </button>

                {error && <div className="text-red-500 text-sm bg-red-50 p-2 rounded">{error}</div>}

                {activeTab === 'idea' && generatedIdeas.length > 0 && (
                    <div className="space-y-4">
                        <h4 className="font-bold text-gray-700 dark:text-gray-300">生成结果 (可多选)</h4>
                        {generatedIdeas.map((idea, idx) => (
                            <div key={idx} className="bg-white dark:bg-gray-900 p-4 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm hover:border-sky-400 transition-all group">
                                <div className="flex justify-between items-start mb-2">
                                    <span className="text-xs font-bold bg-sky-100 text-sky-600 px-2 py-1 rounded">方案 {idx + 1}</span>
                                    <button 
                                        onClick={() => onInsert(idea)}
                                        className="text-xs bg-sky-50 text-sky-600 px-2 py-1 rounded opacity-0 group-hover:opacity-100 hover:bg-sky-100 transition-all"
                                    >
                                        采纳此方案
                                    </button>
                                </div>
                                <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">{idea}</p>
                            </div>
                        ))}
                    </div>
                )}

                {activeTab !== 'idea' && generatedText && (
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

export default ScriptAIPanel;