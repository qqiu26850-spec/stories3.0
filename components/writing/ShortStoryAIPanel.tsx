import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Asset, Prompt, Workflow } from '../../types';
import { generateText, generateTextStream } from '../../services/geminiService';
import { fetchMaterials, incrementPromptHeat } from '../../services/supabaseService';
import { PROMPTS, WORKFLOWS as MOCK_WORKFLOWS } from '../../constants';
import { Sparkles, DocumentPlus, Pencil, ClipboardDocumentCheck, X, ChevronDown, Workflow as WorkflowIcon, BookOpen, Copy, Trash, Stop, AdjustmentsHorizontal, Search, InformationCircle } from '../Icon';
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
}

const ShortStoryAIPanel: React.FC<ShortStoryAIPanelProps> = ({ contextText = '', selectedText = '', onInsert, onReplace, onStream }) => {
    const [activeTab, setActiveTab] = useState<ShortStoryTab>('original');
    const [model, setModel] = useState('deepseek-chat');
    const [temperature, setTemperature] = useState(1);
    const [topP, setTopP] = useState(0.95);
    const [showConfig, setShowConfig] = useState(false);
    const [selectedWorkflow, setSelectedWorkflow] = useState(MOCK_WORKFLOWS[0]?.id || '');
    const [selectedAssetIds, setSelectedAssetIds] = useState<Set<string>>(new Set());
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
            let finalPrompt = '';
            if (selectedPrompt) {
                incrementPromptHeat(selectedPrompt.id);
                let template = selectedPrompt.template || selectedPrompt.content;
                for (const field of selectedPrompt.fields) {
                    const val = formState[field.id] || '';
                    template = template.replace(new RegExp(`\\$\\{${field.id}\\}`, 'g'), val);
                }
                finalPrompt = `${assetContext ? `关联素材：\n${assetContext}\n\n---\n\n` : ''}${template}`;
            } else {
                const currentContext = contextText.slice(-2000);
                if (activeTab === 'original') finalPrompt = `请根据以下要求写一段短篇小说的正文。\n\n【要求】：${promptInput}\n\n${assetContext ? `\n${assetContext}` : ''}`;
                else if (activeTab === 'imitate') finalPrompt = `请模仿以下参考文本的风格，并根据新的要求进行创作。\n\n【参考文本风格】：${referenceText}\n\n【新内容要求】：${promptInput}\n\n${assetContext ? `\n${assetContext}` : ''}`;
                else if (activeTab === 'polish') {
                    const textToPolish = selectedText || currentContext;
                    finalPrompt = `请对以下文本进行润色优化，使其更具文学性，风格要求：${promptInput || '通用文学风格'}。\n\n【待润色文本】：\n${textToPolish}\n\n${assetContext ? `\n${assetContext}` : ''}`;
                } else if (activeTab === 'review') {
                     const textToReview = selectedText || currentContext;
                     finalPrompt = `请作为一名专业的文学编辑，对以下文本进行评审，指出优缺点并给出修改建议。关注点：${promptInput || '情节逻辑、人物塑造'}。\n\n【待评审文本】：\n${textToReview}`;
                }
                const workflowName = MOCK_WORKFLOWS.find(w => w.id === selectedWorkflow)?.title;
                if (workflowName) finalPrompt = `[工作流：${workflowName}]\n${finalPrompt}`;
            }
            if (onStream && (activeTab === 'original' || activeTab === 'imitate')) {
                const stream = generateTextStream(finalPrompt, { model, temperature, topP, signal: controller.signal });
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
                const text = await generateText(finalPrompt, { model, temperature, topP, signal: controller.signal });
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

            <div className="flex-1 overflow-y-auto p-6 space-y-8 font-sans">
                <div className="flex flex-col gap-2 font-sans">
                    <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">模型配置</label>
                    <div className="flex gap-2 font-sans">
                        <div className="relative flex-1 font-sans">
                            <select value={model} onChange={e => setModel(e.target.value)} className="w-full py-2 pl-3 pr-8 text-xs font-medium rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:ring-1 focus:ring-sky-500 outline-none appearance-none cursor-pointer font-sans">
                                <option value="deepseek-chat">深思通用 (DeepSeek V3)</option>
                                <option value="deepseek-reasoner">深思推理 (DeepSeek R1)</option>
                                <option value="gemini-3-flash-preview">谷歌极速 (Gemini 3 Flash)</option>
                                <option value="gemini-3-pro-preview">谷歌深度 (Gemini 3 Pro)</option>
                            </select>
                            <ChevronDown className="w-3 h-3 text-gray-400 absolute right-2.5 top-3 pointer-events-none" />
                        </div>
                        <button onClick={() => setShowConfig(!showConfig)} className={`px-3 py-2 text-xs font-bold rounded-lg border transition-all flex items-center gap-1 font-sans ${showConfig ? 'bg-sky-100 text-sky-600 border-sky-200 dark:bg-sky-900/30 dark:border-sky-800' : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'}`}><AdjustmentsHorizontal className="w-4 h-4" />参数</button>
                    </div>
                    {showConfig && (
                        <div className="bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg border border-gray-100 dark:border-gray-800 grid grid-cols-1 gap-4 animate-fade-in text-[10px] font-sans">
                            <div className="space-y-1">
                                <label className="block font-black text-sky-500 flex justify-between uppercase"><span>温度 (Temperature): {temperature}</span></label>
                                <input type="range" min="0" max="1.5" step="0.1" value={temperature} onChange={e => setTemperature(parseFloat(e.target.value))} className="w-full h-1 bg-sky-200 rounded-lg appearance-none cursor-pointer accent-sky-500" />
                            </div>
                            <div className="space-y-1">
                                <label className="block font-black text-sky-500 flex justify-between uppercase"><span>核采样 (Top P): {topP}</span></label>
                                <input type="range" min="0" max="1" step="0.05" value={topP} onChange={e => setTopP(parseFloat(e.target.value))} className="w-full h-1 bg-sky-200 rounded-lg appearance-none cursor-pointer accent-sky-500" />
                            </div>
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-2 gap-4 font-sans">
                    <div className="col-span-1 font-sans">
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">写作要求选择</label>
                        <button onClick={() => handleOpenPromptModal('requirements')} className={`w-full p-3 rounded-lg border text-left transition-all group relative overflow-hidden font-sans ${selectedPrompt && selectedPrompt.subCategories.includes('requirements') ? 'bg-sky-50 border-sky-300 text-sky-900 dark:bg-sky-900/30 dark:border-sky-700 dark:text-sky-100' : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-500 hover:border-sky-400'}`}>
                            <div className="flex items-center justify-between relative z-10 font-sans">
                                <span className="font-semibold truncate text-[11px]">{selectedPrompt && selectedPrompt.subCategories.includes('requirements') ? selectedPrompt.title : '选择要求...'}</span>
                                <ChevronDown className="w-3 h-3 opacity-50" />
                            </div>
                        </button>
                    </div>
                    <div className="col-span-1 font-sans">
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">写作风格选择</label>
                        <button onClick={() => handleOpenPromptModal('style')} className={`w-full p-3 rounded-lg border text-left transition-all group relative overflow-hidden font-sans ${selectedPrompt && selectedPrompt.subCategories.includes('style') ? 'bg-purple-50 border-purple-300 text-purple-900 dark:bg-purple-900/30 dark:border-purple-700 dark:text-sky-100' : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-500 hover:border-purple-400'}`}>
                            <div className="flex items-center justify-between relative z-10 font-sans">
                                <span className="font-semibold truncate text-[11px]">{selectedPrompt && selectedPrompt.subCategories.includes('style') ? selectedPrompt.title : '选择风格...'}</span>
                                <ChevronDown className="w-3 h-3 opacity-50" />
                            </div>
                        </button>
                    </div>

                    {!selectedPrompt && (
                        <div className="col-span-1 font-sans">
                            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">工作流选择 <span className="text-[10px] font-normal opacity-50">(可选)</span></label>
                            <div className="relative font-sans">
                                <select value={selectedWorkflow} onChange={e => setSelectedWorkflow(e.target.value)} className="w-full py-2.5 pl-3 pr-8 text-xs rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:ring-1 focus:ring-sky-500 outline-none appearance-none cursor-pointer font-sans">
                                    <option value="">不使用工作流</option>
                                    {MOCK_WORKFLOWS.map(wf => <option key={wf.id} value={wf.id}>{wf.title}</option>)}
                                </select>
                                <ChevronDown className="w-3 h-3 text-gray-400 absolute right-2.5 top-3.5 pointer-events-none" />
                            </div>
                        </div>
                    )}
                    <div className={`${selectedPrompt ? "col-span-2" : "col-span-1"} font-sans`}>
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">关联素材 <span className="text-[10px] font-normal opacity-50">(可选)</span></label>
                        <button onClick={() => setAssetModalOpen(true)} className={`w-full p-2.5 text-sm rounded-lg border focus:ring-2 focus:ring-sky-500 outline-none transition shadow-sm flex items-center justify-between font-sans ${selectedAssetIds.size > 0 ? 'bg-sky-50 border-sky-200 text-sky-700 dark:bg-sky-900/30 dark:border-sky-800 dark:text-sky-400' : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'}`}>
                            <span className="truncate text-[11px]">{selectedAssetIds.size > 0 ? `已选 ${selectedAssetIds.size} 项` : '点击关联设定...'}</span>
                            <BookOpen className="w-4 h-4 flex-shrink-0" />
                        </button>
                    </div>
                </div>

                <hr className="border-gray-200 dark:border-gray-800" />

                <div className="space-y-4 font-sans">
                    {selectedPrompt ? (
                        <div className="space-y-4 animate-fade-in font-sans">
                            <div className="flex items-center justify-between pb-2 border-b border-gray-200 dark:border-gray-800">
                                <span className="text-sm font-bold text-gray-900 dark:text-white">参数配置</span>
                                <button onClick={() => setSelectedPrompt(null)} className="text-[10px] text-gray-400 hover:text-rose-500">重置</button>
                            </div>
                            {selectedPrompt.fields.map((field, index) => (
                                <div key={field.id} className="font-sans">
                                    <div className="flex justify-between items-center mb-1.5">
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 font-sans">
                                            {index + 1}. {field.label}
                                            {field.required !== false ? (
                                                <span className="ml-1 text-red-500 font-normal">* (必填)</span>
                                            ) : (
                                                <span className="ml-1 text-gray-400 font-normal"> (非必填)</span>
                                            )}
                                        </label>
                                        {field.maxLength && (
                                            <span className={`text-[10px] ${(formState[field.id]?.length || 0) >= field.maxLength ? 'text-red-500' : 'text-gray-400'}`}>
                                                {formState[field.id]?.length || 0} / {field.maxLength}
                                            </span>
                                        )}
                                    </div>
                                    {field.type === 'textarea' ? (
                                        <textarea 
                                            value={formState[field.id] || ''} 
                                            onChange={e => handleInputChange(field.id, e.target.value)} 
                                            placeholder={field.placeholder} 
                                            maxLength={field.maxLength}
                                            className="w-full p-3 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none resize-none shadow-sm h-24 font-sans" 
                                        />
                                    ) : (
                                        <input 
                                            type="text" 
                                            value={formState[field.id] || ''} 
                                            onChange={e => handleInputChange(field.id, e.target.value)} 
                                            placeholder={field.placeholder} 
                                            maxLength={field.maxLength}
                                            className="w-full p-3 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none shadow-sm font-sans" 
                                        />
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <>
                            {activeTab === 'original' && (
                                <div className="font-sans">
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-200 mb-2">创作要求</label>
                                    <textarea value={promptInput} onChange={e => setPromptInput(e.target.value)} placeholder="请输入你的故事构思、核心梗概或具体要求..." className="w-full h-40 p-3 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none resize-none shadow-sm font-sans" />
                                </div>
                            )}
                            {activeTab === 'imitate' && (
                                <>
                                     <div className="font-sans">
                                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-200 mb-2">参考范文 / 风格来源</label>
                                        <textarea value={referenceText} onChange={e => setReferenceText(e.target.value)} placeholder="在此粘贴你想模仿的文本段落..." className="w-full h-24 p-3 text-sm bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none resize-none shadow-sm mb-4 font-sans" />
                                    </div>
                                    <div className="font-sans">
                                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-200 mb-2">新内容要求</label>
                                        <textarea value={promptInput} onChange={e => setPromptInput(e.target.value)} placeholder="描述你希望生成的新内容..." className="w-full h-24 p-3 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none resize-none shadow-sm font-sans" />
                                    </div>
                                </>
                            )}
                            {activeTab === 'polish' && (
                                <div className="font-sans">
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-200 mb-2">润色方向</label>
                                    <input type="text" value={promptInput} onChange={e => setPromptInput(e.target.value)} placeholder="例如：更有画面感、增加心理描写、文风犀利点..." className="w-full p-3 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none shadow-sm font-sans" />
                                </div>
                            )}
                             {activeTab === 'review' && (
                                <div className="font-sans">
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-200 mb-2">关注重点 (可选)</label>
                                    <input type="text" value={promptInput} onChange={e => setPromptInput(e.target.value)} placeholder="例如：逻辑漏洞、人设性格一致性..." className="w-full p-3 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none shadow-sm font-sans" />
                                </div>
                            )}
                        </>
                    )}
                </div>

                <button onClick={isLoading ? handleStop : handleGenerate} className={`w-full py-3.5 font-bold rounded-xl transition-all shadow-lg active:scale-[0.98] flex items-center justify-center gap-2 font-sans ${isLoading ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-sky-600 hover:bg-sky-500 text-white disabled:bg-gray-400'}`}>
                     {isLoading ? <><Stop className="w-5 h-5" />停止生成</> : <><Sparkles className="w-5 h-5" />开始生成</>}
                </button>

                {error && <div className="text-red-500 text-sm bg-red-50 p-2 rounded font-sans">{error}</div>}

                {resultText && (
                    <div className="bg-white dark:bg-gray-900 p-4 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm mt-4 font-sans">
                        <div className="flex justify-between items-center mb-2 font-sans">
                            <h4 className="font-bold text-gray-700 dark:text-gray-300 font-sans">生成结果</h4>
                            <div className="flex gap-2 font-sans">
                                <button onClick={() => navigator.clipboard.writeText(resultText)} title="复制" className="font-sans"><Copy className="w-4 h-4 text-gray-500 hover:text-sky-500" /></button>
                                <button onClick={() => onInsert(resultText)} className="text-sky-600 text-xs font-bold hover:underline font-sans">插入正文</button>
                            </div>
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto font-sans">
                            {resultText}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ShortStoryAIPanel;