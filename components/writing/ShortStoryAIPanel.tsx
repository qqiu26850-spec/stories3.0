
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Asset, Prompt, Workflow, NovelSettings } from '../../types';
import { generateText, generateTextStream } from '../../services/geminiService';
import { fetchMaterials, incrementPromptHeat } from '../../services/supabaseService';
import { PROMPTS, WORKFLOWS as MOCK_WORKFLOWS } from '../../constants';
// Added Database to the imports
import { Sparkles, DocumentPlus, Pencil, ClipboardDocumentCheck, X, ChevronDown, Workflow as WorkflowIcon, BookOpen, Copy, Trash, Stop, AdjustmentsHorizontal, Search, InformationCircle, Check, Database } from '../Icon';
import PromptSelectionModal from '../PromptSelectionModal';
import AssetSelectionModal from '../AssetSelectionModal';
import LoadingOverlay from '../LoadingOverlay';

type ShortStoryTab = 'original' | 'imitate' | 'polish' | 'review';

interface ShortStoryAIPanelProps {
    contextText: string;
    selectedText: string;
    onInsert: (text: string) => void;
    onReplace: (text: string) => void;
    onStream?: (text: string, isFirst: boolean) => void;
    projectSettings?: NovelSettings;
}

const CollapsibleSection: React.FC<{ title: string; icon: any; color: string; children: React.ReactNode; defaultOpen?: boolean }> = ({ title, icon: Icon, color, children, defaultOpen = true }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    return (
        <div className={`rounded-xl border transition-all ${isOpen ? `bg-${color}-50/30 dark:bg-${color}-900/10 border-${color}-200 dark:border-${color}-800` : `bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800`}`}>
            <button onClick={() => setIsOpen(!isOpen)} className="w-full flex items-center justify-between p-3">
                <div className={`flex items-center gap-2 text-xs font-bold uppercase tracking-wider ${isOpen ? `text-${color}-600 dark:text-${color}-400` : 'text-gray-500'}`}>
                    <Icon className="w-4 h-4" />
                    {title}
                </div>
                <ChevronDown className={`w-3 h-3 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && <div className="px-3 pb-3">{children}</div>}
        </div>
    );
};

const ShortStoryAIPanel: React.FC<ShortStoryAIPanelProps> = ({ contextText = '', selectedText = '', onInsert, onReplace, onStream, projectSettings }) => {
    const [activeTab, setActiveTab] = useState<ShortStoryTab>('original');
    const [model, setModel] = useState('deepseek-chat');
    const [temperature, setTemperature] = useState(1);
    const [topP, setTopP] = useState(0.95);
    const [maxOutputTokens, setMaxOutputTokens] = useState(8192);
    const [showConfig, setShowConfig] = useState(false);
    const [selectedWorkflow, setSelectedWorkflow] = useState(MOCK_WORKFLOWS[0]?.id || '');
    const [selectedAssetIds, setSelectedAssetIds] = useState<Set<string>>(new Set());
    const [isProjectSettingsAssociated, setProjectSettingsAssociated] = useState(false);
    const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);
    const [assets, setAssets] = useState<Asset[]>([]);
    const [isAssetModalOpen, setAssetModalOpen] = useState(false);
    const [isPromptModalOpen, setPromptModalOpen] = useState(false);
    const [promptFilterType, setPromptFilterType] = useState<'requirements' | 'style'>('requirements');
    const [promptInput, setPromptInput] = useState('');
    const [referenceText, setReferenceText] = useState('');
    const [formState, setFormState] = useState<Record<string, string>>({});
    const [isLoading, setIsLoading] = useState(false);
    const [showLoadingOverlay, setShowLoadingOverlay] = useState(false);
    const [overlayStatus, setOverlayStatus] = useState<'loading' | 'success'>('loading');
    const [resultText, setResultText] = useState('');
    const [error, setError] = useState('');
    const [lastGeneratedTab, setLastGeneratedTab] = useState<ShortStoryTab | null>(null);
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

    useEffect(() => {
        setPromptInput('');
        setReferenceText('');
        setResultText('');
        setError('');
        setSelectedPrompt(null);
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
        setIsLoading(false);
        setShowLoadingOverlay(false);
    };

    const handleOpenPromptModal = (filter: 'requirements' | 'style') => {
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
                settingsContext = `【作品背景设定】\n题材：${projectSettings.typeElements}\n主题：${projectSettings.theme}\n梗概：${projectSettings.synopsis}\n人物设定：${projectSettings.characterSettings}`;
            }

            let finalPrompt = '';
            if (selectedPrompt) {
                incrementPromptHeat(selectedPrompt.id);
                let template = selectedPrompt.template || selectedPrompt.content;
                for (const field of selectedPrompt.fields) {
                    const val = formState[field.id] || '';
                    template = template.replace(new RegExp(`\\$\\{${field.id}\\}`, 'g'), val);
                }
                finalPrompt = `${settingsContext ? `${settingsContext}\n\n` : ''}${assetContext ? `关联素材：\n${assetContext}\n\n---\n\n` : ''}${template}`;
            } else {
                const currentContext = contextText.slice(-2000);
                let basePrompt = '';
                if (activeTab === 'original') basePrompt = `请根据以下要求写一段短篇小说的正文。\n\n【要求】：${promptInput}`;
                else if (activeTab === 'imitate') basePrompt = `请模仿以下参考文本的风格，并根据新的要求进行创作。\n\n【参考文本风格】：${referenceText}\n\n【新内容要求】：${promptInput}`;
                else if (activeTab === 'polish') {
                    // Fix: Use selectedText if available, otherwise context
                    const textToPolish = selectedText || currentContext;
                    basePrompt = `请对以下文本进行润色优化，使其更具文学性，风格要求：${promptInput || '通用文学风格'}。\n\n【待润色文本】：\n${textToPolish}`;
                } else if (activeTab === 'review') {
                     const textToReview = selectedText || currentContext;
                     basePrompt = `请作为一名专业的文学编辑，对以下文本进行评审，指出优缺点并给出修改建议。关注点：${promptInput || '情节逻辑、人物塑造'}。\n\n【待评审文本】：\n${textToReview}`;
                }
                
                finalPrompt = `${settingsContext ? `${settingsContext}\n\n` : ''}${assetContext ? `关联素材：\n${assetContext}\n\n` : ''}${basePrompt}`;
            }

            if (onStream && (activeTab === 'original' || activeTab === 'imitate')) {
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
                if (activeTab === 'original' || activeTab === 'imitate') onInsert(text);
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
            <LoadingOverlay isVisible={showLoadingOverlay} onClose={() => setShowLoadingOverlay(false)} onStop={handleStop} status={overlayStatus} />
            <AssetSelectionModal isOpen={isAssetModalOpen} onClose={() => setAssetModalOpen(false)} assets={assets} selectedAssetIds={selectedAssetIds} onToggleAsset={(id) => setSelectedAssetIds(prev => { const next = new Set(prev); if(next.has(id)) next.delete(id); else next.add(id); return next; })} />
            <PromptSelectionModal isOpen={isPromptModalOpen} onClose={() => setPromptModalOpen(false)} onSelect={(prompt) => { setSelectedPrompt(prompt); setPromptModalOpen(false); }} initialSubCategory={promptFilterType} />

            <div className="flex border-b border-gray-200 dark:border-gray-800 font-sans">
                {renderTabButton('original', '原创', Sparkles)}
                {renderTabButton('imitate', '仿写', DocumentPlus)}
                {renderTabButton('polish', '润色', Pencil)}
                {renderTabButton('review', '评审', ClipboardDocumentCheck)}
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 font-sans">
                <CollapsibleSection title="模型配置" icon={AdjustmentsHorizontal} color="sky">
                     <div className="flex flex-col gap-2">
                        <div className="flex gap-2 font-sans">
                            <div className="relative flex-1">
                                <select value={model} onChange={e => setModel(e.target.value)} className="w-full py-2 pl-3 pr-8 text-xs font-medium bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-200 focus:ring-1 focus:ring-sky-500 outline-none appearance-none cursor-pointer font-sans">
                                    <option value="deepseek-chat">奇思版 (DeepSeek)</option>
                                    <option value="gemini-2.0-flash">妙写版 (Gemini)</option>
                                    <option value="doubao-flash">速写版 (豆包)</option>
                                </select>
                                <ChevronDown className="w-3 h-3 text-gray-400 absolute right-2.5 top-3 pointer-events-none" />
                            </div>
                            <button onClick={() => setShowConfig(!showConfig)} className={`px-3 py-2 text-xs font-bold rounded-lg border transition-all flex items-center gap-1 font-sans ${showConfig ? 'bg-sky-100 text-sky-600 border-sky-200 dark:bg-sky-900/30 dark:border-sky-800' : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>参数</button>
                        </div>
                    </div>
                    {showConfig && (
                        <div className="mt-3 bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg border border-gray-100 dark:border-gray-800 grid grid-cols-1 gap-4 animate-fade-in text-[10px] font-sans">
                            <div className="space-y-1">
                                <label className="block font-black text-sky-500 flex justify-between uppercase"><span>随机度 (Temperature): {temperature}</span></label>
                                <input type="range" min="0" max="1.5" step="0.1" value={temperature} onChange={e => setTemperature(parseFloat(e.target.value))} className="w-full h-1 bg-sky-200 rounded-lg appearance-none cursor-pointer accent-sky-500" />
                            </div>
                            <div className="space-y-1">
                                <label className="block font-black text-sky-500 flex justify-between uppercase"><span>核采样 (Top P): {topP}</span></label>
                                <input type="range" min="0" max="1" step="0.05" value={topP} onChange={e => setTopP(parseFloat(e.target.value))} className="w-full h-1 bg-sky-200 rounded-lg appearance-none cursor-pointer accent-sky-500" />
                            </div>
                            <div className="space-y-1">
                                <label className="block font-black text-sky-500 flex justify-between uppercase"><span>最大长度 (Max Tokens): {maxOutputTokens}</span></label>
                                <input type="range" min="1024" max="16384" step="1024" value={maxOutputTokens} onChange={e => setMaxOutputTokens(parseInt(e.target.value))} className="w-full h-1 bg-sky-200 rounded-lg appearance-none cursor-pointer accent-sky-500" />
                            </div>
                        </div>
                    )}
                </CollapsibleSection>
                
                <CollapsibleSection title="写作要求 & 风格" icon={Sparkles} color="purple">
                    <div className="grid grid-cols-2 gap-3 font-sans">
                        <div className="flex flex-col gap-1.5 font-sans">
                            <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">写作要求</label>
                            <button onClick={() => handleOpenPromptModal('requirements')} className={`w-full p-2.5 rounded-lg border text-left transition-all group relative overflow-hidden font-sans ${selectedPrompt && selectedPrompt.subCategories.includes('requirements') ? 'bg-purple-50 border-purple-300 text-purple-900 dark:bg-purple-900/30 dark:border-purple-700 dark:text-purple-100' : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500 hover:border-purple-400'}`}>
                                <div className="flex items-center justify-between relative z-10 font-sans">
                                    <span className="font-semibold truncate text-[11px]">{selectedPrompt && selectedPrompt.subCategories.includes('requirements') ? selectedPrompt.title : '选择要求...'}</span>
                                    <ChevronDown className="w-3 h-3 opacity-50" />
                                </div>
                            </button>
                        </div>
                        <div className="flex flex-col gap-1.5 font-sans">
                            <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">写作风格</label>
                            <button onClick={() => handleOpenPromptModal('style')} className={`w-full p-2.5 rounded-lg border text-left transition-all group relative overflow-hidden font-sans ${selectedPrompt && selectedPrompt.subCategories.includes('style') ? 'bg-pink-50 border-pink-300 text-pink-900 dark:bg-pink-900/30 dark:border-pink-700 dark:text-pink-100' : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500 hover:border-pink-400'}`}>
                                <div className="flex items-center justify-between relative z-10 font-sans">
                                    <span className="font-semibold truncate text-[11px]">{selectedPrompt && selectedPrompt.subCategories.includes('style') ? selectedPrompt.title : '选择风格...'}</span>
                                    <ChevronDown className="w-3 h-3 opacity-50" />
                                </div>
                            </button>
                        </div>
                    </div>
                </CollapsibleSection>

                <CollapsibleSection title="关联素材" icon={Database} color="amber">
                    <div className="flex flex-col gap-2 font-sans">
                        <div className="space-y-2">
                            <button onClick={() => setAssetModalOpen(true)} className={`w-full p-3 rounded-lg border text-left transition-all font-sans ${selectedAssetIds.size > 0 ? 'bg-amber-50 border-amber-300 text-amber-900 dark:bg-amber-900/30 dark:border-amber-700 dark:text-amber-100' : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500 hover:border-amber-400'}`}>
                                <div className="flex items-center justify-between font-sans">
                                    <div className="flex items-center gap-2 font-sans overflow-hidden">
                                        <Database className={`w-4 h-4 flex-shrink-0 ${selectedAssetIds.size > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-400'}`} />
                                        <span className="font-semibold text-xs truncate">{selectedAssetIds.size > 0 ? selectedAssetNames : '关联人物/剧情/设定...'}</span>
                                    </div>
                                    <ChevronDown className="w-4 h-4 opacity-50 flex-shrink-0" />
                                </div>
                            </button>
                            
                            <button 
                                onClick={() => setProjectSettingsAssociated(!isProjectSettingsAssociated)} 
                                className={`w-full p-3 rounded-lg border text-left transition-all font-sans flex items-center justify-between ${isProjectSettingsAssociated ? 'bg-emerald-50 border-emerald-300 text-emerald-900 dark:bg-emerald-900/30 dark:border-emerald-700 dark:text-emerald-100' : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500 hover:border-emerald-400'}`}
                            >
                                <div className="flex items-center gap-2 font-sans">
                                    <BookOpen className={`w-4 h-4 flex-shrink-0 ${isProjectSettingsAssociated ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400'}`} />
                                    <span className="font-semibold text-xs">{isProjectSettingsAssociated ? 'AI 已关联作品设定' : '关联作品设定 (世界观/人物等)'}</span>
                                </div>
                                {isProjectSettingsAssociated ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <ChevronDown className="w-4 h-4 opacity-50" />}
                            </button>
                        </div>
                    </div>
                </CollapsibleSection>

                {selectedPrompt ? (
                    <div className="space-y-4 animate-fade-in font-sans border-t border-gray-100 dark:border-gray-800 pt-4">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-bold text-gray-900 dark:text-white">参数配置</span>
                            <button onClick={() => setSelectedPrompt(null)} className="text-[10px] text-gray-400 hover:text-rose-500">重置</button>
                        </div>
                        {selectedPrompt.fields.map((field, index) => (
                            <div key={field.id} className="font-sans">
                                <div className="flex justify-between items-center mb-1.5">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 font-sans">
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
                        ))}
                    </div>
                ) : (
                     <div className="space-y-4 font-sans">
                        {(activeTab === 'imitate') && (
                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-200 mb-2">参考风格文本</label>
                                <textarea 
                                    value={referenceText} 
                                    onChange={e => setReferenceText(e.target.value)} 
                                    placeholder="粘贴一段您希望AI模仿风格的文字..." 
                                    className="w-full h-24 p-3 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none resize-none shadow-sm font-sans" 
                                />
                            </div>
                        )}
                        
                        {(activeTab === 'polish' || activeTab === 'review') && selectedText && (
                            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800 text-xs text-blue-600 dark:text-blue-400 flex items-center gap-2 mb-2">
                                <Check className="w-3 h-3" /> 已引用选中正文 ({selectedText.length}字)
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-200 mb-2">
                                {activeTab === 'original' ? '创作要求' : activeTab === 'imitate' ? '新内容要求' : activeTab === 'polish' ? '润色要求' : '评审关注点'}
                            </label>
                            <textarea 
                                value={promptInput} 
                                onChange={e => setPromptInput(e.target.value)} 
                                placeholder={
                                    activeTab === 'original' ? "请输入故事的情节、氛围或具体要求..." : 
                                    activeTab === 'imitate' ? "请输入希望生成的新故事情节..." :
                                    activeTab === 'polish' ? "例如：增加环境描写，风格更压抑..." :
                                    "例如：检查逻辑漏洞，分析人物动机..."
                                }
                                className="w-full h-32 p-3 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none resize-none shadow-sm font-sans" 
                            />
                        </div>
                     </div>
                )}

                <button onClick={isLoading ? handleStop : handleGenerate} className={`w-full py-3.5 font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] font-sans ${isLoading ? 'bg-red-500 hover:bg-red-600 text-white hover:shadow-red-500/30' : 'bg-sky-600 hover:bg-sky-500 text-white hover:shadow-sky-500/20 disabled:bg-gray-400 disabled:cursor-not-allowed'}`}>
                    {isLoading ? <><Stop className="w-5 h-5" />停止生成</> : <><Sparkles className="w-5 h-5" />{activeTab === 'review' ? '开始智能评审' : '立即生成内容'}</>}
                </button>
                {error && <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-lg border border-red-100 dark:border-red-900/50 font-sans">{error}</div>}
                {resultText && (
                    <div className="space-y-3 pt-4 border-t border-gray-200 dark:border-gray-800 animate-fade-in-up font-sans">
                        <div className="flex justify-between items-center font-sans">
                            <h4 className="text-sm font-bold text-gray-800 dark:text-white flex items-center gap-2 font-sans">生成结果 {(lastGeneratedTab === 'original' || lastGeneratedTab === 'imitate') && <span className="text-xs font-normal text-green-600 bg-green-100 dark:bg-green-900/30 px-2 py-0.5 rounded-full font-sans">已插入正文 (灰色字体)</span>}</h4>
                            <div className="flex gap-2 font-sans">
                                <button onClick={() => navigator.clipboard.writeText(resultText)} className="p-1.5 text-gray-500 hover:text-sky-600 hover:bg-sky-50 rounded transition-colors font-sans"><Copy className="w-4 h-4" /></button>
                                <button onClick={() => setResultText('')} className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors font-sans"><Trash className="w-4 h-4" /></button>
                            </div>
                        </div>
                        <div className="p-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 text-sm leading-relaxed text-gray-700 dark:text-gray-300 whitespace-pre-wrap max-h-64 overflow-y-auto shadow-inner font-sans">{resultText}</div>
                        {lastGeneratedTab === 'polish' && <button onClick={() => onReplace(resultText)} className="w-full py-2.5 bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400 font-bold rounded-lg hover:bg-sky-200 transition-colors text-sm font-sans">替换选中文本</button>}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ShortStoryAIPanel;
