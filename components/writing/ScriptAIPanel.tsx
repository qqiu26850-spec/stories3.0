
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Asset, Prompt } from '../../types';
import { generateText, generateTextStream } from '../../services/geminiService';
import { fetchMaterials, incrementPromptHeat } from '../../services/supabaseService';
import { PROMPTS } from '../../constants';
import { Sparkles, Film, X, ChevronDown, BookOpen, Copy, Trash, Stop, AdjustmentsHorizontal, Search, Database, InformationCircle, Check, ArrowPath, Plus, Play } from '../Icon';
import PromptSelectionModal from '../PromptSelectionModal';
import AssetSelectionModal from '../AssetSelectionModal';
import CustomSelect from '../CustomSelect';

interface ScriptAIPanelProps {
    onInsert: (text: string) => void;
    onStream?: (text: string, isFirst: boolean) => void;
}

type ScriptTab = 'idea' | 'script';

const WRITING_STRATEGIES = [
    "💡 提示：剧本创作强调'画面感'，避免过多的心理描写。",
    "💡 提示：动作线要清晰，指示演员的具体行为。",
    "💡 提示：对白要精炼，符合人物性格。",
    "💡 提示：场景标题要规范，明确内/外景、时间。",
    "💡 提示：冲突是戏剧的核心。",
];

const FORCE_LONG_INSTRUCTION = "\n\n【重要指令】：请尽可能详细、深入地撰写，展开环境、心理、动作等细节，严禁省略或概括。请充分利用输出长度限制，生成长篇幅的完整内容。";

const CollapsibleSection: React.FC<{ title: string; icon: any; color: string; children: React.ReactNode; defaultOpen?: boolean }> = ({ title, icon: Icon, color, children, defaultOpen = true }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    const themeColor = 'sky'; 
    
    return (
        <div className={`rounded-xl border transition-all ${isOpen ? `bg-${themeColor}-50/10 dark:bg-${themeColor}-900/5 border-${themeColor}-100 dark:border-${themeColor}-900` : `bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800`}`}>
            <button onClick={() => setIsOpen(!isOpen)} className="w-full flex items-center justify-between p-3">
                <div className={`flex items-center gap-2 text-xs font-bold uppercase tracking-wider ${isOpen ? `text-${themeColor}-600 dark:text-${themeColor}-400` : 'text-gray-500'}`}>
                    <Icon className="w-4 h-4" />
                    {title}
                </div>
                <ChevronDown className={`w-3 h-3 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && <div className="px-3 pb-3">{children}</div>}
        </div>
    );
};

const ScriptAIPanel: React.FC<ScriptAIPanelProps> = ({ onInsert, onStream }) => {
    const [activeTab, setActiveTab] = useState<ScriptTab>('idea');
    const [model, setModel] = useState('deepseek-chat');
    const [temperature, setTemperature] = useState(1);
    const [topP, setTopP] = useState(0.95);
    const [maxOutputTokens, setMaxOutputTokens] = useState(8192);
    const [showConfig, setShowConfig] = useState(false);
    
    const [isAssetModalOpen, setAssetModalOpen] = useState(false);
    const [isPromptModalOpen, setPromptModalOpen] = useState(false);
    const [promptFilterType, setPromptFilterType] = useState<'requirements' | 'style'>('requirements');
    const [selectedAssetIds, setSelectedAssetIds] = useState<Set<string>>(new Set());
    const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);
    const [assets, setAssets] = useState<Asset[]>([]);
    
    const [customInput, setCustomInput] = useState('');
    const [formState, setFormState] = useState<Record<string, string>>({});
    
    // New Loading & Result Logic
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedIdeas, setGeneratedIdeas] = useState<string[]>([]);
    const [generatedText, setGeneratedText] = useState('');
    const [error, setError] = useState('');
    const [strategyIndex, setStrategyIndex] = useState(0);
    const abortControllerRef = useRef<AbortController | null>(null);

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

    const selectedAssetNames = useMemo(() => {
        return Array.from(selectedAssetIds)
            .map(id => assets.find(a => a.id === id)?.name)
            .filter(Boolean)
            .join(', ');
    }, [selectedAssetIds, assets]);

    // Strategies Rotation
    useEffect(() => {
        let interval: any;
        if (isGenerating) {
            interval = setInterval(() => {
                setStrategyIndex(prev => (prev + 1) % WRITING_STRATEGIES.length);
            }, 3000);
        }
        return () => clearInterval(interval);
    }, [isGenerating]);

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

    const handleOpenPromptModal = (filter: 'requirements' | 'style') => {
        setPromptFilterType(filter);
        setPromptModalOpen(true);
    };

    const handleStop = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
        setIsGenerating(false);
    };

    const handleGenerate = async () => {
        setIsGenerating(true);
        setGeneratedIdeas([]);
        setGeneratedText('');
        setError('');
        const controller = new AbortController();
        abortControllerRef.current = controller;
        try {
            const assetContext = Array.from(selectedAssetIds).map(id => assets.find(a => a.id === id)).filter(Boolean).map(a => `【参考素材：${a!.name}】\n${a!.content}`).join('\n\n');
            let finalPrompt = '';
            let promptContent = '';
            if (selectedPrompt) {
                incrementPromptHeat(selectedPrompt.id);
                promptContent = selectedPrompt.template || selectedPrompt.content;
                for (const field of selectedPrompt.fields) {
                    const val = formState[field.id] || '';
                    promptContent = promptContent.replace(new RegExp(`\\$\\{${field.id}\\}`, 'g'), val);
                }
            } else promptContent = customInput;
            
            // Clean output instruction
            const cleanInstruction = "IMPORTANT: Output ONLY the script/idea content. Do NOT include any filler text.";

            if (activeTab === 'idea') finalPrompt = `${cleanInstruction}\n请根据以下信息，生成3个剧本创意方案。\n\n${promptContent}\n${assetContext ? `关联素材：\n${assetContext}\n` : ''}`;
            else finalPrompt = `${cleanInstruction}\n请写一段影视剧本正文。包含场景标题、场景描述、动作、对白。\n\n${promptContent}\n${assetContext ? `关联素材：\n${assetContext}\n` : ''}`;
            
            // Append Force Long Instruction for script content only
            if (activeTab === 'script') {
                finalPrompt += FORCE_LONG_INSTRUCTION;
            }

            if (activeTab === 'idea') {
                const result = await generateText(finalPrompt, { 
                    model, 
                    temperature, 
                    topP, 
                    maxOutputTokens, 
                    signal: controller.signal 
                });
                const ideas = result.split(/【方案[一二三]】/).filter(s => s.trim().length > 10);
                setGeneratedIdeas(ideas.length === 0 ? [result] : ideas.map(s => s.trim()));
            } else {
                // Stream to panel result
                const stream = generateTextStream(finalPrompt, { 
                    model, 
                    temperature, 
                    topP, 
                    maxOutputTokens, 
                    signal: controller.signal 
                });
                
                for await (const chunk of stream) {
                    setGeneratedText(prev => prev + chunk);
                }
            }
        } catch (err: any) {
            if (err.message !== 'Aborted') {
                setError(err.message || '生成失败');
            }
        } finally {
            setIsGenerating(false);
            abortControllerRef.current = null;
        }
    };

    const handleContinue = async () => {
        if (isGenerating) return;
        setIsGenerating(true);
        setError('');
        
        const tail = generatedText.slice(-3000); 
        const continuePrompt = `IMPORTANT: Output ONLY the continued script content.\n请紧接着以下内容继续生成，保持风格和逻辑连贯，不要重复上文结尾。\n\n【上文回顾】：\n...${tail}\n\n${FORCE_LONG_INSTRUCTION}`;

        const controller = new AbortController();
        abortControllerRef.current = controller;

        try {
            const stream = generateTextStream(continuePrompt, { 
                model, 
                temperature, 
                topP, 
                maxOutputTokens, 
                signal: controller.signal 
            });
            for await (const chunk of stream) {
                setGeneratedText(prev => prev + chunk);
            }
        } catch (err: any) {
            if (err.message !== 'Aborted') {
                setError(err.message || '生成失败');
            }
        } finally {
            setIsGenerating(false);
            abortControllerRef.current = null;
        }
    };

    const MODEL_OPTIONS = [
        { value: "deepseek-chat", label: "奇思版 (DeepSeek)" },
        { value: "gemini-3-flash-preview", label: "妙写版 (Gemini 3.0 Flash)" },
        { value: "doubao-flash", label: "速写版 (豆包)" }
    ];

    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-black border-l border-gray-200 dark:border-gray-800 w-full font-sans">
            <AssetSelectionModal isOpen={isAssetModalOpen} onClose={() => setAssetModalOpen(false)} assets={assets} selectedAssetIds={selectedAssetIds} onToggleAsset={(id) => setSelectedAssetIds(prev => { const next = new Set(prev); if(next.has(id)) next.delete(id); else next.add(id); return next; })} />
            <PromptSelectionModal isOpen={isPromptModalOpen} onClose={() => setPromptModalOpen(false)} onSelect={(prompt) => { setSelectedPrompt(prompt); setPromptModalOpen(false); }} initialSubCategory={promptFilterType} />
            
            <div className="p-4 border-b border-gray-200 bg-white dark:bg-gray-900 flex items-center gap-2 font-bold font-sans"><Film className="w-5 h-5 text-sky-500" />分集改编</div>

            <div className="flex-1 overflow-y-auto p-2 space-y-3 font-sans dynamic-scrollbar">
                {/* ... existing collapsible sections ... */}
                <CollapsibleSection title="参数填写" icon={AdjustmentsHorizontal} color="sky">
                    <div className="flex flex-col gap-2 font-sans">
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <CustomSelect 
                                    value={model} 
                                    onChange={setModel} 
                                    options={MODEL_OPTIONS}
                                />
                            </div>
                            <button onClick={() => setShowConfig(!showConfig)} className="px-2 py-1.5 text-xs font-bold rounded-lg border border-sky-100 transition-all flex items-center gap-1 font-sans bg-white hover:bg-sky-50 text-gray-500 hover:text-sky-600"><AdjustmentsHorizontal className="w-4 h-4" />参数</button>
                        </div>
                    </div>

                    {showConfig && (
                        <div className="mt-2 bg-white/50 dark:bg-black/20 p-2 rounded-lg border border-sky-100 dark:border-sky-800 grid grid-cols-1 gap-2 animate-fade-in text-[10px]">
                            <div className="space-y-1">
                                <label className="block font-bold text-sky-500 flex justify-between uppercase">
                                    <span>温度: {temperature}</span>
                                </label>
                                <input type="range" min="0" max="1.5" step="0.1" value={temperature} onChange={e => setTemperature(parseFloat(e.target.value))} className="w-full h-1 bg-sky-200 rounded-lg appearance-none cursor-pointer accent-sky-500" />
                            </div>
                            <div className="space-y-1">
                                <label className="block font-bold text-sky-500 flex justify-between uppercase">
                                    <span>核采样: {topP}</span>
                                </label>
                                <input type="range" min="0" max="1" step="0.05" value={topP} onChange={e => setTopP(parseFloat(e.target.value))} className="w-full h-1 bg-sky-200 rounded-lg appearance-none cursor-pointer accent-sky-500" />
                            </div>
                        </div>
                    )}
                </CollapsibleSection>

                <CollapsibleSection title="写作要求 & 风格" icon={Sparkles} color="sky">
                    <div className="flex flex-col gap-2 font-sans">
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-sky-600 dark:text-sky-400 uppercase tracking-wider">写作要求</label>
                            <button onClick={() => handleOpenPromptModal('requirements')} className={`w-full p-2 rounded-lg border border-sky-100 dark:border-sky-800 bg-white dark:bg-gray-800 text-left transition-all relative overflow-hidden group hover:border-sky-300`}>
                                <div className="flex items-center justify-between text-[11px] font-semibold truncate text-gray-600 dark:text-gray-300">
                                    <span>{selectedPrompt && selectedPrompt.subCategories.includes('requirements') ? selectedPrompt.title : '选择要求...'}</span>
                                    <ChevronDown className="w-3 h-3 text-sky-400 opacity-50" />
                                </div>
                            </button>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-sky-600 dark:text-sky-400 uppercase tracking-wider">写作风格</label>
                            <button onClick={() => handleOpenPromptModal('style')} className={`w-full p-2 rounded-lg border text-left transition-all relative overflow-hidden font-sans ${selectedPrompt && selectedPrompt.subCategories.includes('style') ? 'bg-pink-50 border-pink-300 text-pink-900' : 'bg-white dark:bg-gray-800 border-sky-100 dark:border-sky-800 text-gray-500 hover:border-sky-300'}`}>
                                <div className="flex items-center justify-between text-[11px] font-semibold truncate text-gray-600 dark:text-gray-300">
                                    <span>{selectedPrompt && selectedPrompt.subCategories.includes('style') ? selectedPrompt.title : '选择风格...'}</span>
                                    <ChevronDown className="w-3 h-3 text-sky-400 opacity-50" />
                                </div>
                            </button>
                        </div>
                    </div>
                </CollapsibleSection>

                <CollapsibleSection title="关联素材" icon={Database} color="sky">
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-sky-600 dark:text-sky-400 uppercase tracking-wider">素材选择</label>
                        <button onClick={() => setAssetModalOpen(true)} className={`w-full p-2 rounded-lg border text-left transition-all font-sans ${selectedAssetIds.size > 0 ? 'bg-sky-100 border-sky-300 text-sky-900' : 'bg-white dark:bg-gray-800 border-sky-100 dark:border-sky-800 text-gray-500 hover:border-sky-300'}`}>
                            <div className="flex items-center justify-between text-[11px] font-semibold truncate">
                                <div className="flex items-center gap-1.5 overflow-hidden">
                                    <Database className={`w-3.5 h-3.5 flex-shrink-0 ${selectedAssetIds.size > 0 ? 'text-sky-600' : 'text-gray-400'}`} />
                                    <span className="truncate">{selectedAssetIds.size > 0 ? selectedAssetNames : '点击关联设定...'}</span>
                                </div>
                                <ChevronDown className="w-3 h-3 text-sky-400 opacity-50 flex-shrink-0" />
                            </div>
                        </button>
                    </div>
                </CollapsibleSection>

                <div className="space-y-4">
                    {selectedPrompt ? (
                        <div className="p-3 bg-white/50 dark:bg-black/20 rounded-xl border border-sky-100 dark:border-sky-800 space-y-3 shadow-sm animate-fade-in">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold text-sky-600 dark:text-sky-400 uppercase tracking-wider">模板参数</span>
                                <button onClick={() => setSelectedPrompt(null)} className="text-[10px] text-gray-400 hover:text-red-500 font-medium">清空模板</button>
                            </div>
                            {selectedPrompt.fields.map((field, index) => (
                                <div key={field.id} className="space-y-1.5">
                                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300">
                                        {index + 1}. {field.label}
                                        {field.required !== false && <span className="ml-0.5 text-red-500">*</span>}
                                    </label>
                                    {field.type === 'textarea' ? (
                                        <textarea 
                                            rows={2}
                                            value={formState[field.id] || ''} 
                                            onChange={e => handleInputChange(field.id, e.target.value)} 
                                            placeholder={field.placeholder || "请输入..."}
                                            className="w-full p-2 text-xs bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none resize-none" 
                                        />
                                    ) : (
                                        <input 
                                            type="text" 
                                            value={formState[field.id] || ''} 
                                            onChange={e => handleInputChange(field.id, e.target.value)} 
                                            placeholder={field.placeholder || "请输入..."}
                                            className="w-full p-2 text-xs bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none" 
                                        />
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-sky-600 dark:text-sky-400 uppercase tracking-wider">自定义要求</label>
                            <textarea 
                                value={customInput} 
                                onChange={(e) => setCustomInput(e.target.value)} 
                                placeholder={activeTab === 'idea' ? "例如：想一个发生在火星的悬疑故事..." : "例如：写一段主角在废弃工厂发现秘密的戏..."}
                                className="w-full h-24 p-3 text-xs bg-white dark:bg-gray-800 border border-sky-100 dark:border-sky-800 rounded-xl focus:ring-2 focus:ring-sky-500 outline-none resize-none shadow-sm"
                            />
                        </div>
                    )}
                </div>

                {!isGenerating && !generatedText && (
                    <button onClick={handleGenerate} className="w-full py-3 font-bold rounded-xl transition-all shadow-lg active:scale-[0.98] flex items-center justify-center gap-2 bg-sky-600 text-white font-sans mt-2 text-sm">
                         <Sparkles className="w-4 h-4" /> 生成内容
                    </button>
                )}

                {/* Loading / Result Area */}
                {(isGenerating || generatedText || generatedIdeas.length > 0) && (
                    <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800 animate-fade-in-up">
                        {isGenerating && !generatedText && generatedIdeas.length === 0 && (
                            <div className="p-6 bg-white dark:bg-gray-900 rounded-xl border border-sky-100 dark:border-sky-800 flex flex-col items-center justify-center text-center space-y-4 shadow-sm">
                                <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                                <div className="text-sm font-bold text-gray-800 dark:text-gray-200 animate-pulse">AI 正在创作...</div>
                                <div className="text-[10px] text-sky-600 dark:text-sky-400 font-medium italic transition-opacity duration-500 px-4">
                                    {WRITING_STRATEGIES[strategyIndex]}
                                </div>
                                <button onClick={handleStop} className="mt-2 text-xs text-red-500 hover:text-red-600 flex items-center gap-1 font-bold">
                                    <Stop className="w-3 h-3" /> 停止生成
                                </button>
                            </div>
                        )}

                        {activeTab === 'idea' && generatedIdeas.length > 0 && !isGenerating && (
                            <div className="space-y-3">
                                {generatedIdeas.map((idea, idx) => (
                                    <div key={idx} className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm hover:border-sky-300 transition-colors group">
                                        <h4 className="text-xs font-bold text-sky-600 dark:text-sky-400 mb-2">方案 {idx + 1}</h4>
                                        <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed mb-3 whitespace-pre-wrap">{idea}</p>
                                        <div className="flex gap-2 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => navigator.clipboard.writeText(idea)} className="p-1.5 text-gray-400 hover:text-sky-600 transition-colors" title="复制"><Copy className="w-3.5 h-3.5" /></button>
                                        </div>
                                    </div>
                                ))}
                                <button onClick={handleGenerate} className="w-full py-2.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 font-bold rounded-xl hover:bg-gray-200 transition-colors flex items-center justify-center gap-2 text-xs">
                                    <ArrowPath className="w-3.5 h-3.5" /> 换一批
                                </button>
                            </div>
                        )}

                        {activeTab === 'script' && generatedText && (
                            <div className="space-y-3">
                                <div className="flex justify-between items-center font-sans">
                                    <h4 className="text-sm font-bold text-gray-800 dark:text-white flex items-center gap-2 font-sans">生成结果</h4>
                                    <div className="flex gap-2 font-sans">
                                        <button onClick={() => navigator.clipboard.writeText(generatedText)} className="p-1.5 text-gray-500 hover:text-sky-600 hover:bg-white rounded transition-colors font-sans"><Copy className="w-4 h-4" /></button>
                                        <button onClick={() => setGeneratedText('')} className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-white rounded transition-colors font-sans"><Trash className="w-4 h-4" /></button>
                                    </div>
                                </div>
                                <div className="p-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 text-sm leading-relaxed text-gray-700 dark:text-gray-300 whitespace-pre-wrap max-h-64 overflow-y-auto shadow-inner font-mono">{generatedText}</div>
                                
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => onInsert(generatedText)} 
                                        className="flex-1 py-2.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 font-bold rounded-lg hover:bg-emerald-200 transition-colors text-sm font-sans flex items-center justify-center gap-1"
                                    >
                                        <Plus className="w-3 h-3" /> 插入剧本
                                    </button>
                                    {!isGenerating && (
                                        <div className="flex gap-2">
                                            <button onClick={handleContinue} className="px-3 py-2.5 bg-sky-100 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400 font-bold rounded-lg hover:bg-sky-200 transition-colors text-xs flex items-center gap-1" title="续写更多内容">
                                                <Play className="w-3 h-3" /> 继续生成
                                            </button>
                                            <button onClick={handleGenerate} className="px-3 py-2.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 font-bold rounded-lg hover:bg-gray-200 transition-colors text-sm font-sans flex items-center gap-1">
                                                <ArrowPath className="w-3 h-3" /> 重试
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {error && <div className="mt-2 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-lg border border-red-100 dark:border-red-900/50 font-sans">{error}</div>}
            </div>
        </div>
    );
};

export default ScriptAIPanel;
