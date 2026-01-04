
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Asset, Prompt, NovelSettings } from '../../types';
import { generateText, generateTextStream } from '../../services/geminiService';
import { fetchMaterials, incrementPromptHeat } from '../../services/supabaseService';
import { PROMPTS } from '../../constants';
import { Sparkles, ChevronDown, Database, BookOpen, DocumentPlus, Pencil, Copy, Trash, Stop, AdjustmentsHorizontal, Search, InformationCircle, Check, ClipboardDocumentCheck } from '../Icon';
import PromptSelectionModal from '../PromptSelectionModal';
import AssetSelectionModal from '../AssetSelectionModal';
import LoadingOverlay from '../LoadingOverlay';

type TabType = 'expand' | 'continue' | 'polish' | 'review';

interface AIFunctionPanelProps {
    contextText: string;
    selectedText: string;
    onInsert: (text: string) => void;
    onReplace: (text: string) => void;
    onStream?: (text: string, isFirst: boolean) => void;
    projectSettings?: NovelSettings;
    externalAction?: { type: TabType; text: string } | null;
}

const AIFunctionPanel: React.FC<AIFunctionPanelProps> = ({ contextText = '', selectedText = '', onInsert, onReplace, onStream, projectSettings, externalAction }) => {
    const [activeTab, setActiveTab] = useState<TabType>('expand');
    const [model, setModel] = useState('deepseek-chat');
    const [temperature, setTemperature] = useState(1);
    const [topP, setTopP] = useState(0.95);
    const [maxOutputTokens, setMaxOutputTokens] = useState(8192);
    const [showConfig, setShowConfig] = useState(false);
    const [isConfigCollapsed, setIsConfigCollapsed] = useState(false);
    
    const [selectedAssetIds, setSelectedAssetIds] = useState<Set<string>>(new Set());
    const [isProjectSettingsAssociated, setProjectSettingsAssociated] = useState(false);
    const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);
    const [assets, setAssets] = useState<Asset[]>([]);
    const [isAssetModalOpen, setAssetModalOpen] = useState(false);
    const [isPromptModalOpen, setPromptModalOpen] = useState(false);
    const [promptFilterType, setPromptFilterType] = useState<'requirements' | 'style' | 'polish'>('requirements');
    const [formState, setFormState] = useState<Record<string, string>>({});
    
    // Polish specific state
    const [polishContent, setPolishContent] = useState('');
    
    const [isLoading, setIsLoading] = useState(false);
    const [showLoadingOverlay, setShowLoadingOverlay] = useState(false);
    const [overlayStatus, setOverlayStatus] = useState<'loading' | 'success'>('loading');
    const [resultText, setResultText] = useState('');
    const [error, setError] = useState('');
    const [lastGeneratedTab, setLastGeneratedTab] = useState<TabType | null>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    // Handle external trigger (Context Menu) and initial selection
    useEffect(() => {
        if (externalAction) {
            setActiveTab(externalAction.type);
            if (externalAction.type === 'polish' || externalAction.type === 'review') {
                setPolishContent(externalAction.text);
            }
        } else if (selectedText) {
            // If user manually selects text, update polish content if in polish tab
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

    const defaultTabPrompts = useMemo(() => {
        return PROMPTS.filter(prompt => {
            const subCats = prompt.subCategories || [];
            if (activeTab === 'expand') return subCats.includes('expand');
            if (activeTab === 'continue') return subCats.includes('continue');
            if (activeTab === 'polish') return subCats.includes('polish');
            if (activeTab === 'review') return subCats.includes('proofread');
            return false;
        });
    }, [activeTab]);

    useEffect(() => {
        if (defaultTabPrompts.length > 0) {
            setSelectedPrompt(defaultTabPrompts[0]);
        } else {
            setSelectedPrompt(null);
        }
        setResultText(''); 
        setError('');
    }, [activeTab, defaultTabPrompts]);

    useEffect(() => {
        if (!selectedPrompt) return;
        const newFormState = { ...formState };
        // Clean fields if template changes
        setFormState(prev => ({ ...prev, ...newFormState }));
    }, [selectedPrompt]);

    const handleInputChange = (id: string, val: string) => {
        setFormState(prev => ({ ...prev, [id]: val }));
    };

    const handleStop = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
        setIsLoading(false);
        setShowLoadingOverlay(false);
    };

    const handleOpenPromptModal = (filter: 'requirements' | 'style' | 'polish') => {
        setPromptFilterType(filter);
        setPromptModalOpen(true);
    };

    const handleGenerate = async () => {
        setIsLoading(true);
        setOverlayStatus('loading');
        setShowLoadingOverlay(true);
        setResultText('');
        setError('');
        setLastGeneratedTab(activeTab);
        const controller = new AbortController();
        abortControllerRef.current = controller;
        try {
            const assetContext = Array.from(selectedAssetIds).map(id => assets.find(a => a.id === id)).filter(Boolean).map(a => `【参考素材：${a!.name}】\n${a!.content}`).join('\n\n');
            
            let settingsContext = '';
            if (isProjectSettingsAssociated && projectSettings) {
                settingsContext = `【作品背景设定】\n题材：${projectSettings.typeElements}\n主题：${projectSettings.theme}\n世界观：${projectSettings.worldview}\n人物基础设定：${projectSettings.characterSettings}\n梗概：${projectSettings.synopsis}`;
            }

            let finalPrompt = '';
            // For polish/review, prefer the content in the textarea. 
            // For continue/expand, prefer contextText or selectedText if context is not main focus.
            const textToProcess = (activeTab === 'polish' || activeTab === 'review') 
                ? polishContent 
                : (selectedText || contextText.slice(-2000));
            
            const instruction = activeTab === 'continue' ? '请根据上文续写' : (activeTab === 'polish' ? '请润色以下文本' : (activeTab === 'expand' ? '请扩写以下文本' : '请评审以下文本'));

            if (selectedPrompt) {
                incrementPromptHeat(selectedPrompt.id);
                let template = selectedPrompt.template || selectedPrompt.content;
                for (const field of selectedPrompt.fields) {
                    let val = formState[field.id] || '';
                    // Auto-fill context/text fields if they exist in prompt but user left empty
                    if (!val && (field.id === 'context' || field.id === 'text')) {
                        val = textToProcess;
                    }
                    template = template.replace(new RegExp(`\\$\\{${field.id}\\}`, 'g'), val);
                }
                finalPrompt = `${settingsContext ? `${settingsContext}\n\n` : ''}${assetContext ? `关联素材：\n${assetContext}\n\n---\n\n` : ''}${template}`;
            } else {
                finalPrompt = `${instruction}。\n${settingsContext ? `${settingsContext}\n\n` : ''}当前上下文/选中文本：\n${textToProcess}\n\n${assetContext ? `关联素材：\n${assetContext}` : ''}`;
            }

            if (onStream && (activeTab === 'expand' || activeTab === 'continue')) {
                const stream = generateTextStream(finalPrompt, { 
                    model, 
                    temperature, 
                    topP, 
                    maxOutputTokens, 
                    signal: controller.signal 
                });
                let isFirst = true;
                let fullText = '';
                for await (const chunk of stream) {
                    if (isFirst) setShowLoadingOverlay(false);
                    onStream(chunk, isFirst);
                    fullText += chunk;
                    setResultText(fullText);
                    isFirst = false;
                }
                setOverlayStatus('success'); 
            } else {
                const text = await generateText(finalPrompt, { 
                    model, 
                    temperature, 
                    topP, 
                    maxOutputTokens, 
                    signal: controller.signal 
                });
                // For direct insertion types
                if (activeTab === 'expand' || activeTab === 'continue') {
                    onInsert(text);
                }
                setResultText(text);
                setOverlayStatus('success');
            }
        } catch (err: any) {
            if (err.message !== 'Aborted') {
                setError(err.message || '生成失败');
                setShowLoadingOverlay(false);
            }
        } finally {
            setIsLoading(false);
            abortControllerRef.current = null;
        }
    };

    const renderTabButton = (type: TabType, label: string, Icon: React.ElementType) => (
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
            <LoadingOverlay isVisible={showLoadingOverlay} onClose={() => setShowLoadingOverlay(false)} onStop={handleStop} status={overlayStatus} />
            <AssetSelectionModal isOpen={isAssetModalOpen} onClose={() => setAssetModalOpen(false)} assets={assets} selectedAssetIds={selectedAssetIds} onToggleAsset={(id) => setSelectedAssetIds(prev => { const next = new Set(prev); if(next.has(id)) next.delete(id); else next.add(id); return next; })} />
            <PromptSelectionModal isOpen={isPromptModalOpen} onClose={() => setPromptModalOpen(false)} onSelect={(prompt) => { setSelectedPrompt(prompt); setPromptModalOpen(false); }} initialSubCategory={promptFilterType} />

            <div className="flex border-b border-gray-200 dark:border-gray-800 font-sans">
                {renderTabButton('expand', '扩写', Sparkles)}
                {renderTabButton('continue', '续写', DocumentPlus)}
                {renderTabButton('polish', '润色', Pencil)}
                {renderTabButton('review', '评审', ClipboardDocumentCheck)}
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-3 font-sans dynamic-scrollbar">
                {/* Unified Collapsible Container */}
                <div className="rounded-xl border border-sky-100 dark:border-sky-900 bg-sky-50/30 dark:bg-sky-900/10 overflow-hidden">
                    <button 
                        onClick={() => setIsConfigCollapsed(!isConfigCollapsed)} 
                        className="w-full flex items-center justify-between p-3 hover:bg-sky-50 dark:hover:bg-sky-900/20 transition-colors"
                    >
                        <span className="text-sm font-black text-gray-800 dark:text-gray-100 flex items-center gap-2">
                            <AdjustmentsHorizontal className="w-4 h-4 text-sky-500" />
                            创作配置
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
                                            <label className="block font-bold text-sky-600 flex justify-between uppercase"><span>随机度: {temperature}</span></label>
                                            <input type="range" min="0" max="1.5" step="0.1" value={temperature} onChange={e => setTemperature(parseFloat(e.target.value))} className="w-full h-1 bg-sky-200 rounded-lg appearance-none cursor-pointer accent-sky-500" />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="block font-bold text-sky-600 flex justify-between uppercase"><span>最大长度: {maxOutputTokens}</span></label>
                                            <input type="range" min="1024" max="16384" step="1024" value={maxOutputTokens} onChange={e => setMaxOutputTokens(parseInt(e.target.value))} className="w-full h-1 bg-sky-200 rounded-lg appearance-none cursor-pointer accent-sky-500" />
                                        </div>
                                    </div>
                                )}
                            </div>

                            {activeTab === 'polish' ? (
                                /* Polish Mode: Simplified Config */
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-sky-600 dark:text-sky-400 uppercase tracking-wider">润色提示词</label>
                                    <button onClick={() => handleOpenPromptModal('polish')} className="w-full p-2 rounded-lg border border-sky-100 dark:border-sky-800 bg-white dark:bg-gray-800 text-left transition-all hover:border-sky-300 group">
                                        <div className="flex items-center justify-between">
                                            <span className="font-semibold text-xs text-gray-700 dark:text-gray-200 truncate">
                                                {selectedPrompt && selectedPrompt.subCategories.includes('polish') ? selectedPrompt.title : '选择润色提示词...'}
                                            </span>
                                            <ChevronDown className="w-3 h-3 text-sky-400 opacity-50" />
                                        </div>
                                    </button>
                                </div>
                            ) : (
                                /* Standard Mode: Requirements & Style */
                                <div className="flex flex-col gap-2">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-sky-600 dark:text-sky-400 uppercase tracking-wider">写作要求</label>
                                        <button onClick={() => handleOpenPromptModal('requirements')} className="w-full p-2 rounded-lg border border-sky-100 dark:border-sky-800 bg-white dark:bg-gray-800 text-left transition-all hover:border-sky-300">
                                            <div className="flex items-center justify-between">
                                                <span className="font-semibold text-xs text-gray-700 dark:text-gray-200 truncate">{selectedPrompt && selectedPrompt.subCategories.includes('requirements') ? selectedPrompt.title : '选择要求...'}</span>
                                                <ChevronDown className="w-3 h-3 text-sky-400 opacity-50" />
                                            </div>
                                        </button>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-sky-600 dark:text-sky-400 uppercase tracking-wider">写作风格</label>
                                        <button onClick={() => handleOpenPromptModal('style')} className="w-full p-2 rounded-lg border border-sky-100 dark:border-sky-800 bg-white dark:bg-gray-800 text-left transition-all hover:border-sky-300">
                                            <div className="flex items-center justify-between">
                                                <span className="font-semibold text-xs text-gray-700 dark:text-gray-200 truncate">{selectedPrompt && selectedPrompt.subCategories.includes('style') ? selectedPrompt.title : '选择风格...'}</span>
                                                <ChevronDown className="w-3 h-3 text-sky-400 opacity-50" />
                                            </div>
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Associated Content */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-sky-600 dark:text-sky-400 uppercase tracking-wider">关联素材</label>
                                <div className="flex flex-col gap-2">
                                    <button onClick={() => setAssetModalOpen(true)} className={`w-full p-2 rounded-lg border text-left transition-all ${selectedAssetIds.size > 0 ? 'bg-sky-100 border-sky-300 text-sky-900' : 'bg-white dark:bg-gray-800 border-sky-100 dark:border-sky-800 text-gray-500 hover:border-sky-300'}`}>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2 overflow-hidden">
                                                <Database className={`w-3.5 h-3.5 flex-shrink-0 ${selectedAssetIds.size > 0 ? 'text-sky-600' : 'text-gray-400'}`} />
                                                <span className="font-semibold text-xs truncate">{selectedAssetIds.size > 0 ? selectedAssetNames : '关联人物/剧情...'}</span>
                                            </div>
                                            <ChevronDown className="w-3 h-3 text-sky-400 opacity-50 flex-shrink-0" />
                                        </div>
                                    </button>
                                    
                                    <button 
                                        onClick={() => setProjectSettingsAssociated(!isProjectSettingsAssociated)} 
                                        className={`w-full p-2 rounded-lg border text-left transition-all flex items-center justify-between ${isProjectSettingsAssociated ? 'bg-sky-100 border-sky-300 text-sky-900' : 'bg-white dark:bg-gray-800 border-sky-100 dark:border-sky-800 text-gray-500 hover:border-sky-300'}`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <BookOpen className={`w-3.5 h-3.5 flex-shrink-0 ${isProjectSettingsAssociated ? 'text-sky-600' : 'text-gray-400'}`} />
                                            <span className="font-semibold text-xs">{isProjectSettingsAssociated ? '已关联设定' : '关联作品设定'}</span>
                                        </div>
                                        {isProjectSettingsAssociated ? <Check className="w-3.5 h-3.5 text-sky-500" /> : <ChevronDown className="w-3 h-3 text-sky-400 opacity-50" />}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {activeTab === 'polish' && (
                    <div className="space-y-2 mt-2">
                        <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider ml-1">待润色/评审文本</label>
                        <textarea 
                            value={polishContent} 
                            onChange={(e) => setPolishContent(e.target.value)} 
                            placeholder="请选中正文内容或在此粘贴..."
                            className="w-full h-32 p-3 text-xs bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl focus:ring-2 focus:ring-sky-500 outline-none resize-none shadow-sm"
                        />
                    </div>
                )}

                {selectedPrompt ? (
                    <div className="space-y-3 animate-fade-in border-t border-gray-100 dark:border-gray-800 pt-3">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-gray-900 dark:text-white">参数填写</span>
                            <button onClick={() => setSelectedPrompt(null)} className="text-[10px] text-gray-400 hover:text-rose-500">重置</button>
                        </div>
                        {selectedPrompt.fields.map((field, index) => {
                            if (field.id === 'context' || field.id === 'text') return null;
                            return (
                                <div key={field.id}>
                                    <div className="flex justify-between items-center mb-1">
                                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                                            {index + 1}. {field.label}
                                            {field.required !== false && <span className="ml-0.5 text-red-500">*</span>}
                                        </label>
                                        {field.maxLength && (
                                            <span className={`text-[9px] ${(formState[field.id]?.length || 0) >= field.maxLength ? 'text-red-500' : 'text-gray-400'}`}>
                                                {formState[field.id]?.length || 0}/{field.maxLength}
                                            </span>
                                        )}
                                    </div>
                                    {field.type === 'textarea' ? (
                                        <textarea 
                                            rows={2}
                                            value={formState[field.id] || ''} 
                                            onChange={e => handleInputChange(field.id, e.target.value)} 
                                            placeholder={field.placeholder} 
                                            maxLength={field.maxLength}
                                            className="w-full p-2 text-xs bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none resize-none shadow-sm" 
                                        />
                                    ) : (
                                        <input 
                                            type="text" 
                                            value={formState[field.id] || ''} 
                                            onChange={e => handleInputChange(field.id, e.target.value)} 
                                            placeholder={field.placeholder} 
                                            maxLength={field.maxLength}
                                            className="w-full p-2 text-xs bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none shadow-sm" 
                                        />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                ) : (
                     !['polish', 'review'].includes(activeTab) && (
                        <div className="text-xs text-gray-400 italic p-4 text-center border border-dashed border-gray-200 dark:border-gray-800 rounded-xl bg-gray-50/50">
                            请在上方选择模板，或直接点击生成。
                        </div>
                     )
                )}
                
                <button onClick={isLoading ? handleStop : handleGenerate} className={`w-full py-3 font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] text-sm mt-4 ${isLoading ? 'bg-red-500 hover:bg-red-600 text-white shadow-red-500/30' : 'bg-sky-600 hover:bg-sky-500 text-white shadow-sky-500/20 disabled:bg-gray-400 disabled:cursor-not-allowed'}`}>
                    {isLoading ? <><Stop className="w-4 h-4" />停止</> : <><Sparkles className="w-4 h-4" />{activeTab === 'review' ? '开始评审' : '立即生成'}</>}
                </button>
                {error && <div className="p-2 bg-red-50 text-red-600 text-xs rounded-lg border border-red-100 text-center">{error}</div>}
                {resultText && (
                    <div className="space-y-2 pt-3 border-t border-gray-100 dark:border-gray-800 animate-fade-in-up">
                        <div className="flex justify-between items-center">
                            <h4 className="text-xs font-bold text-gray-800 dark:text-white flex items-center gap-2">生成结果 {(lastGeneratedTab === 'expand' || lastGeneratedTab === 'continue') && <span className="text-[10px] font-normal text-green-600 bg-green-50 px-2 py-0.5 rounded-full">已插入</span>}</h4>
                            <div className="flex gap-1">
                                <button onClick={() => navigator.clipboard.writeText(resultText)} className="p-1 text-gray-500 hover:text-sky-600 bg-gray-100 hover:bg-sky-50 rounded transition-colors"><Copy className="w-3.5 h-3.5" /></button>
                                <button onClick={() => setResultText('')} className="p-1 text-gray-500 hover:text-red-600 bg-gray-100 hover:bg-red-50 rounded transition-colors"><Trash className="w-3.5 h-3.5" /></button>
                            </div>
                        </div>
                        <div className="p-3 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 text-xs leading-relaxed text-gray-700 dark:text-gray-300 whitespace-pre-wrap max-h-48 overflow-y-auto shadow-inner">{resultText}</div>
                        {lastGeneratedTab === 'polish' && <button onClick={() => onReplace(resultText)} className="w-full py-2 bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400 font-bold rounded-lg hover:bg-sky-200 transition-colors text-xs">替换选中文本</button>}
                    </div>
                )}
            </div>
        </div>
    );
};

export default AIFunctionPanel;
