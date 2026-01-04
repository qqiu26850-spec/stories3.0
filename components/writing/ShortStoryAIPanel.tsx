
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Asset, Prompt, Workflow, NovelSettings } from '../../types';
import { generateText, generateTextStream } from '../../services/geminiService';
import { fetchMaterials, incrementPromptHeat } from '../../services/supabaseService';
import { PROMPTS, WORKFLOWS as MOCK_WORKFLOWS } from '../../constants';
import { Sparkles, DocumentPlus, Pencil, ClipboardDocumentCheck, X, ChevronDown, Workflow as WorkflowIcon, BookOpen, Copy, Trash, Stop, AdjustmentsHorizontal, Search, InformationCircle, Check, Database, ArrowPath, Plus } from '../Icon';
import PromptSelectionModal from '../PromptSelectionModal';
import AssetSelectionModal from '../AssetSelectionModal';

type ShortStoryTab = 'original' | 'imitate' | 'polish' | 'review';

const WRITING_STRATEGIES = [
    "💡 提示：短篇小说需要一个有力的开头，迅速抓住读者的注意力。",
    "💡 提示：减少不必要的次要情节，保持故事紧凑。",
    "💡 提示：结尾应该给读者留下深刻印象，或是反转，或是余韵。",
    "💡 提示：用最少的文字传达最多的信息。",
    "💡 提示：每一个字都应该为主题服务。",
];

interface ShortStoryAIPanelProps {
    contextText: string;
    selectedText: string;
    onInsert: (text: string) => void;
    onReplace: (text: string) => void;
    onStream?: (text: string, isFirst: boolean) => void;
    projectSettings?: NovelSettings;
    externalAction?: { type: 'polish' | 'review' | 'expand' | 'continue'; text: string } | null;
}

const ShortStoryAIPanel: React.FC<ShortStoryAIPanelProps> = ({ contextText = '', selectedText = '', onInsert, onReplace, onStream, projectSettings, externalAction }) => {
    const [activeTab, setActiveTab] = useState<ShortStoryTab>('original');
    const [model, setModel] = useState('deepseek-chat');
    const [temperature, setTemperature] = useState(1);
    const [topP, setTopP] = useState(0.95);
    const [maxOutputTokens, setMaxOutputTokens] = useState(8192);
    const [showConfig, setShowConfig] = useState(false);
    const [isConfigCollapsed, setIsConfigCollapsed] = useState(false);

    const [selectedWorkflow, setSelectedWorkflow] = useState(MOCK_WORKFLOWS[0]?.id || '');
    const [selectedAssetIds, setSelectedAssetIds] = useState<Set<string>>(new Set());
    const [isProjectSettingsAssociated, setProjectSettingsAssociated] = useState(false);
    const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);
    const [assets, setAssets] = useState<Asset[]>([]);
    const [isAssetModalOpen, setAssetModalOpen] = useState(false);
    const [isPromptModalOpen, setPromptModalOpen] = useState(false);
    const [promptFilterType, setPromptFilterType] = useState<'requirements' | 'style' | 'polish'>('requirements');
    
    const [promptInput, setPromptInput] = useState('');
    const [referenceText, setReferenceText] = useState('');
    const [polishContent, setPolishContent] = useState('');
    
    const [formState, setFormState] = useState<Record<string, string>>({});
    
    // New Loading & Result Logic
    const [isGenerating, setIsGenerating] = useState(false);
    const [resultText, setResultText] = useState('');
    const [error, setError] = useState('');
    const [lastGeneratedTab, setLastGeneratedTab] = useState<ShortStoryTab | null>(null);
    const [strategyIndex, setStrategyIndex] = useState(0);
    const abortControllerRef = useRef<AbortController | null>(null);

    // Handle external trigger and selection updates
    useEffect(() => {
        if (externalAction) {
            if (externalAction.type === 'polish' || externalAction.type === 'review') {
                setActiveTab(externalAction.type);
                setPolishContent(externalAction.text);
            }
        } else if (selectedText) {
            setPolishContent(selectedText);
        }
    }, [externalAction, selectedText]);

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
        setPromptInput('');
        setReferenceText('');
        setResultText('');
        setError('');
        setSelectedPrompt(null);
        setIsGenerating(false);
    }, [activeTab]);

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

    const handleStop = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
        setIsGenerating(false);
    };

    const handleOpenPromptModal = (filter: 'requirements' | 'style' | 'polish') => {
        setPromptFilterType(filter);
        setPromptModalOpen(true);
    };

    const handleGenerate = async () => {
        setIsGenerating(true);
        setResultText('');
        setError('');
        setLastGeneratedTab(activeTab);
        const controller = new AbortController();
        abortControllerRef.current = controller;
        try {
            const assetContext = Array.from(selectedAssetIds).map(id => assets.find(a => a.id === id)).filter(Boolean).map(a => `【参考素材：${a!.name}】\n${a!.content}`).join('\n\n');
            
            let settingsContext = '';
            if (isProjectSettingsAssociated && projectSettings) {
                settingsContext = `【作品背景设定】\n题材：${projectSettings.typeElements}\n主题：${projectSettings.theme}\n梗概：${projectSettings.synopsis}\n人物设定：${projectSettings.characterSettings}`;
            }

            let finalPrompt = '';
            if (selectedPrompt) {
                incrementPromptHeat(selectedPrompt.id);
                let template = selectedPrompt.template || selectedPrompt.content;
                for (const field of selectedPrompt.fields) {
                    let val = formState[field.id] || '';
                    if (!val && (field.id === 'context' || field.id === 'text')) {
                        // Use polishContent if in polish/review mode, otherwise context
                        val = (activeTab === 'polish' || activeTab === 'review') ? polishContent : contextText.slice(-2000);
                    }
                    template = template.replace(new RegExp(`\\$\\{${field.id}\\}`, 'g'), val);
                }
                finalPrompt = `${settingsContext ? `${settingsContext}\n\n` : ''}${assetContext ? `关联素材：\n${assetContext}\n\n---\n\n` : ''}${template}`;
            } else {
                const currentContext = contextText.slice(-2000);
                let basePrompt = '';
                if (activeTab === 'original') basePrompt = `请根据以下要求写一段短篇小说的正文。\n\n【要求】：${promptInput}`;
                else if (activeTab === 'imitate') basePrompt = `请模仿以下参考文本的风格，并根据新的要求进行创作。\n\n【参考文本风格】：${referenceText}\n\n【新内容要求】：${promptInput}`;
                else if (activeTab === 'polish') {
                    const textToPolish = polishContent || currentContext;
                    basePrompt = `请对以下文本进行润色优化，使其更具文学性，风格要求：${promptInput || '通用文学风格'}。\n\n【待润色文本】：\n${textToPolish}`;
                } else if (activeTab === 'review') {
                     const textToReview = polishContent || currentContext;
                     basePrompt = `请作为一名专业的文学编辑，对以下文本进行评审，指出优缺点并给出修改建议。关注点：${promptInput || '情节逻辑、人物塑造'}。\n\n【待评审文本】：\n${textToReview}`;
                }
                
                finalPrompt = `${settingsContext ? `${settingsContext}\n\n` : ''}${assetContext ? `关联素材：\n${assetContext}\n\n` : ''}${basePrompt}`;
            }

            // Stream to panel result
            const stream = generateTextStream(finalPrompt, { 
                model, 
                temperature, 
                topP, 
                maxOutputTokens, 
                signal: controller.signal 
            });
            
            for await (const chunk of stream) {
                setResultText(prev => prev + chunk);
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

    const renderTabButton = (type: ShortStoryTab, label: string, Icon: React.ElementType) => (
        <button
            onClick={() => setActiveTab(type)}
            className={`flex-1 py-2 flex flex-col items-center justify-center gap-1 transition-colors border-b-2 font-sans ${
                activeTab === type 
                    ? 'border-sky-500 text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-900/20' 
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800'
            }`}
        >
            <Icon className="w-4 h-4" />
            <span className="text-xs font-bold">{label}</span>
        </button>
    );

    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-black border-l border-gray-200 dark:border-gray-800 font-sans">
            <AssetSelectionModal isOpen={isAssetModalOpen} onClose={() => setAssetModalOpen(false)} assets={assets} selectedAssetIds={selectedAssetIds} onToggleAsset={(id) => setSelectedAssetIds(prev => { const next = new Set(prev); if(next.has(id)) next.delete(id); else next.add(id); return next; })} />
            <PromptSelectionModal isOpen={isPromptModalOpen} onClose={() => setPromptModalOpen(false)} onSelect={(prompt) => { setSelectedPrompt(prompt); setPromptModalOpen(false); }} initialSubCategory={promptFilterType} />

            <div className="flex border-b border-gray-200 dark:border-gray-800 font-sans">
                {renderTabButton('original', '原创', Sparkles)}
                {renderTabButton('imitate', '仿写', DocumentPlus)}
                {renderTabButton('polish', '润色', Pencil)}
                {renderTabButton('review', '评审', ClipboardDocumentCheck)}
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-3 font-sans dynamic-scrollbar">
                {/* Unified Collapsible Container - Lighter Blue */}
                <div className="rounded-xl border border-sky-100 dark:border-sky-900 bg-sky-50/10 dark:bg-sky-900/5 overflow-hidden">
                    <button 
                        onClick={() => setIsConfigCollapsed(!isConfigCollapsed)} 
                        className="w-full flex items-center justify-between p-3 hover:bg-sky-50 dark:hover:bg-sky-900/20 transition-colors"
                    >
                        <span className="text-sm font-black text-gray-800 dark:text-gray-100 flex items-center gap-2">
                            <AdjustmentsHorizontal className="w-4 h-4 text-sky-500" />
                            参数填写
                        </span>
                        <ChevronDown className={`w-3 h-3 text-sky-400 transition-transform ${isConfigCollapsed ? 'rotate-180' : ''}`} />
                    </button>
                    
                    {!isConfigCollapsed && (
                        <div className="px-3 pb-3 space-y-4">
                            {/* Model Config */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-sky-600 dark:text-sky-400 uppercase tracking-wider">模型配置</label>
                                <div className="flex gap-2 font-sans">
                                    <div className="relative flex-1">
                                        <select value={model} onChange={e => setModel(e.target.value)} className="w-full py-1.5 pl-2 pr-6 text-xs font-medium bg-white dark:bg-gray-800 border border-sky-100 dark:border-sky-800 rounded-lg text-gray-700 dark:text-gray-200 focus:ring-1 focus:ring-sky-500 outline-none appearance-none cursor-pointer">
                                            <option value="deepseek-chat">奇思版 (DeepSeek)</option>
                                            <option value="gemini-2.0-flash">妙写版 (Gemini)</option>
                                            <option value="doubao-flash">速写版 (豆包)</option>
                                        </select>
                                        <ChevronDown className="w-3 h-3 text-sky-400 absolute right-2 top-2.5 pointer-events-none" />
                                    </div>
                                    <button onClick={() => setShowConfig(!showConfig)} className={`px-2 py-1.5 text-xs font-bold rounded-lg border transition-all flex items-center gap-1 ${showConfig ? 'bg-sky-100 text-sky-600 border-sky-200' : 'bg-white text-gray-500 border-sky-100 hover:bg-sky-50'}`}>参数</button>
                                </div>
                                {showConfig && (
                                    <div className="mt-2 bg-white/50 dark:bg-black/20 p-2 rounded-lg border border-sky-100 dark:border-sky-800 grid grid-cols-1 gap-2 animate-fade-in text-[10px]">
                                        <div className="space-y-1">
                                            <label className="block font-bold text-sky-500 flex justify-between uppercase"><span>随机度: {temperature}</span></label>
                                            <input type="range" min="0" max="1.5" step="0.1" value={temperature} onChange={e => setTemperature(parseFloat(e.target.value))} className="w-full h-1 bg-sky-200 rounded-lg appearance-none cursor-pointer accent-sky-500" />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="block font-bold text-sky-500 flex justify-between uppercase"><span>核采样: {topP}</span></label>
                                            <input type="range" min="0" max="1" step="0.05" value={topP} onChange={e => setTopP(parseFloat(e.target.value))} className="w-full h-1 bg-sky-200 rounded-lg appearance-none cursor-pointer accent-sky-500" />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="block font-black text-sky-500 flex justify-between uppercase"><span>最大长度 (Max Tokens): {maxOutputTokens}</span></label>
                                            <input type="range" min="1024" max="16384" step="1024" value={maxOutputTokens} onChange={e => setMaxOutputTokens(parseInt(e.target.value))} className="w-full h-1 bg-sky-200 rounded-lg appearance-none cursor-pointer accent-sky-500" />
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Writing Requirements & Style - Stacked */}
                            <div className="flex flex-col gap-3">
                                <div className="flex flex-col gap-1.5 font-sans">
                                    <label className="text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider">写作要求</label>
                                    <button onClick={() => handleOpenPromptModal('requirements')} className={`w-full p-2.5 rounded-lg border text-left transition-all group relative overflow-hidden font-sans ${selectedPrompt && selectedPrompt.subCategories.includes('requirements') ? 'bg-purple-50 border-purple-300 text-purple-900 dark:bg-purple-900/30 dark:border-purple-700 dark:text-purple-100' : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500 hover:border-purple-400'}`}>
                                        <div className="flex items-center justify-between relative z-10 font-sans">
                                            <span className="font-semibold truncate text-[11px]">{selectedPrompt && selectedPrompt.subCategories.includes('requirements') ? selectedPrompt.title : '选择要求模板...'}</span>
                                            <ChevronDown className="w-3 h-3 opacity-50" />
                                        </div>
                                    </button>
                                </div>
                                <div className="flex flex-col gap-1.5 font-sans">
                                    <label className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">写作风格</label>
                                    <button onClick={() => handleOpenPromptModal('style')} className={`w-full p-2.5 rounded-lg border text-left transition-all group relative overflow-hidden font-sans ${selectedPrompt && selectedPrompt.subCategories.includes('style') ? 'bg-rose-50 border-rose-300 text-rose-900 dark:bg-rose-900/30 dark:border-rose-700 dark:text-rose-100' : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500 hover:border-rose-400'}`}>
                                        <div className="flex items-center justify-between relative z-10 font-sans">
                                            <span className="font-semibold truncate text-[11px]">{selectedPrompt && selectedPrompt.subCategories.includes('style') ? selectedPrompt.title : '选择风格模板...'}</span>
                                            <ChevronDown className="w-3 h-3 opacity-50" />
                                        </div>
                                    </button>
                                </div>
                            </div>

                            {/* Associated Content (Amber Title) */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">关联素材</label>
                                <div className="flex flex-col gap-2">
                                    <button onClick={() => setAssetModalOpen(true)} className={`w-full p-2.5 rounded-lg border text-left transition-all font-sans ${selectedAssetIds.size > 0 ? 'bg-amber-50 border-amber-300 text-amber-900 dark:bg-amber-900/30 dark:border-amber-700 dark:text-amber-100' : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500 hover:border-amber-400'}`}>
                                        <div className="flex items-center justify-between font-sans">
                                            <div className="flex items-center gap-2 font-sans overflow-hidden">
                                                <Database className={`w-3.5 h-3.5 flex-shrink-0 ${selectedAssetIds.size > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-400'}`} />
                                                <span className="font-semibold text-xs truncate">{selectedAssetIds.size > 0 ? selectedAssetNames : '关联人物/剧情/设定...'}</span>
                                            </div>
                                            <ChevronDown className="w-3.5 h-3.5 opacity-50 flex-shrink-0" />
                                        </div>
                                    </button>
                                    
                                    <button 
                                        onClick={() => setProjectSettingsAssociated(!isProjectSettingsAssociated)} 
                                        className={`w-full p-2.5 rounded-lg border text-left transition-all font-sans flex items-center justify-between ${isProjectSettingsAssociated ? 'bg-emerald-50 border-emerald-300 text-emerald-900 dark:bg-emerald-900/30 dark:border-emerald-700 dark:text-emerald-100' : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500 hover:border-emerald-400'}`}
                                    >
                                        <div className="flex items-center gap-2 font-sans">
                                            <BookOpen className={`w-3.5 h-3.5 flex-shrink-0 ${isProjectSettingsAssociated ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400'}`} />
                                            <span className="font-semibold text-xs">{isProjectSettingsAssociated ? 'AI 已关联作品设定' : '关联作品设定 (世界观/人物等)'}</span>
                                        </div>
                                        {isProjectSettingsAssociated ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <ChevronDown className="w-3.5 h-3.5 opacity-50" />}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {selectedPrompt ? (
                    <div className="space-y-4 animate-fade-in font-sans border-t border-gray-100 dark:border-gray-800 pt-4">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-bold text-gray-900 dark:text-white">模板参数填写</span>
                            <button onClick={() => setSelectedPrompt(null)} className="text-[10px] text-gray-400 hover:text-rose-500">重置</button>
                        </div>
                        {selectedPrompt.fields.map((field, index) => {
                            if (field.id === 'context' || field.id === 'text') return null; // Hide internal context fields
                            return (
                                <div key={field.id} className="font-sans">
                                    <div className="flex justify-between items-center mb-1.5">
                                        <label className="block text-[10px] font-bold text-gray-700 dark:text-gray-300 font-sans">
                                            <span className="font-sans">
                                                {index + 1}. {field.label}
                                                {field.required !== false ? (
                                                    <span className="ml-1 text-red-500 font-normal">*</span>
                                                ) : (
                                                    <span className="ml-1 text-gray-400 font-normal"> (选填)</span>
                                                )}
                                            </span>
                                        </label>
                                        {field.maxLength && (
                                            <span className={`text-[10px] ${(formState[field.id]?.length || 0) >= field.maxLength ? 'text-red-500' : 'text-gray-400'}`}>
                                                {formState[field.id]?.length || 0} / {field.maxLength}
                                            </span>
                                        )}
                                    </div>
                                    {field.type === 'textarea' ? (
                                        <textarea 
                                            rows={3} 
                                            value={formState[field.id] || ''} 
                                            onChange={e => handleInputChange(field.id, e.target.value)} 
                                            placeholder={field.placeholder} 
                                            maxLength={field.maxLength}
                                            className="w-full p-3 text-sm bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none resize-none shadow-sm font-sans" 
                                        />
                                    ) : (
                                        <input 
                                            type="text" 
                                            value={formState[field.id] || ''} 
                                            onChange={e => handleInputChange(field.id, e.target.value)} 
                                            placeholder={field.placeholder} 
                                            maxLength={field.maxLength}
                                            className="w-full p-3 text-sm bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none shadow-sm font-sans" 
                                        />
                                    )}
                                    {field.description && <p className="text-[10px] text-gray-400 mt-1 font-sans">{field.description}</p>}
                                </div>
                            );
                        })}
                    </div>
                ) : (
                     <div className="text-sm text-gray-400 italic p-6 text-center border border-dashed border-gray-300 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-900/50 font-sans">
                        请在上方选择“写作要求”或“写作风格”模板，或直接点击生成。
                     </div>
                )}
                
                {(externalAction?.text || selectedText) && (
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800 text-xs text-blue-600 dark:text-blue-400 flex items-center gap-2">
                        <Check className="w-3 h-3" /> 已引用选中正文 ({(externalAction?.text || selectedText).length}字)
                    </div>
                )}

                {!isGenerating && !resultText && (
                    <button onClick={handleGenerate} className={`w-full py-3.5 font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] font-sans bg-sky-600 hover:bg-sky-500 text-white hover:shadow-sky-500/20 disabled:bg-gray-400 disabled:cursor-not-allowed`}>
                        <Sparkles className="w-5 h-5" />{activeTab === 'review' ? '开始智能评审' : '立即生成内容'}
                    </button>
                )}

                {/* Loading & Result View */}
                {(isGenerating || resultText) && (
                    <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800 animate-fade-in-up">
                        {isGenerating && !resultText && (
                            <div className="p-6 bg-white dark:bg-gray-900 rounded-xl border border-sky-100 dark:border-sky-800 flex flex-col items-center justify-center text-center space-y-4 shadow-sm">
                                <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin"></div>
                                <div className="text-sm font-bold text-gray-800 dark:text-gray-200 animate-pulse">AI 正在思考...</div>
                                <div className="text-[10px] text-sky-600 dark:text-sky-400 font-medium italic transition-opacity duration-500 px-4">
                                    {WRITING_STRATEGIES[strategyIndex]}
                                </div>
                                <button onClick={handleStop} className="mt-2 text-xs text-red-500 hover:text-red-600 flex items-center gap-1 font-bold">
                                    <Stop className="w-3 h-3" /> 停止生成
                                </button>
                            </div>
                        )}

                        {resultText && (
                            <div className="space-y-3">
                                <div className="flex justify-between items-center font-sans">
                                    <h4 className="text-sm font-bold text-gray-800 dark:text-white flex items-center gap-2 font-sans">生成结果</h4>
                                    <div className="flex gap-2 font-sans">
                                        <button onClick={() => navigator.clipboard.writeText(resultText)} className="p-1.5 text-gray-500 hover:text-sky-600 hover:bg-sky-50 rounded transition-colors font-sans"><Copy className="w-4 h-4" /></button>
                                        <button onClick={() => setResultText('')} className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors font-sans"><Trash className="w-4 h-4" /></button>
                                    </div>
                                </div>
                                <div className="p-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 text-sm leading-relaxed text-gray-700 dark:text-gray-300 whitespace-pre-wrap max-h-64 overflow-y-auto shadow-inner font-sans">{resultText}</div>
                                
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => {
                                            if (lastGeneratedTab === 'polish') onReplace(resultText);
                                            else onInsert(resultText);
                                        }} 
                                        className="flex-1 py-2.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 font-bold rounded-lg hover:bg-emerald-200 transition-colors text-sm font-sans flex items-center justify-center gap-1"
                                    >
                                        {lastGeneratedTab === 'polish' ? '替换选中文本' : <><Plus className="w-3 h-3" /> 插入正文</>}
                                    </button>
                                    {!isGenerating && (
                                        <button onClick={handleGenerate} className="px-3 py-2.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 font-bold rounded-lg hover:bg-gray-200 transition-colors text-sm font-sans flex items-center gap-1">
                                            <ArrowPath className="w-3 h-3" /> 重试
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ShortStoryAIPanel;
