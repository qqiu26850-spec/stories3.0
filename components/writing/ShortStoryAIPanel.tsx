
// ... existing imports ...
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Asset, Prompt, Workflow } from '../../types';
import { generateText, generateTextStream } from '../../services/geminiService';
import { fetchMaterials, incrementPromptHeat } from '../../services/supabaseService';
import { PROMPTS, WORKFLOWS as MOCK_WORKFLOWS } from '../../constants';
import { Sparkles, DocumentPlus, Pencil, ClipboardDocumentCheck, X, ChevronDown, Workflow as WorkflowIcon, BookOpen, Copy, Trash, Stop, AdjustmentsHorizontal } from '../Icon';
import PromptSelectionModal from '../PromptSelectionModal';
import AssetSelectionModal from '../AssetSelectionModal';
import LoadingOverlay from '../LoadingOverlay';

// ... (ShortStoryAIPanelProps) ...
type ShortStoryTab = 'original' | 'imitate' | 'polish' | 'review';

interface ShortStoryAIPanelProps {
    contextText: string;
    selectedText: string;
    onInsert: (text: string) => void;
    onReplace: (text: string) => void;
    onStream?: (text: string, isFirst: boolean) => void;
}

const ShortStoryAIPanel: React.FC<ShortStoryAIPanelProps> = ({ contextText = '', selectedText = '', onInsert, onReplace, onStream }) => {
    // ... state ...
    const [activeTab, setActiveTab] = useState<ShortStoryTab>('original');
    
    // Global Config for this Panel
    const [model, setModel] = useState('deepseek-chat'); // DeepSeek default
    const [temperature, setTemperature] = useState(1);
    const [topP, setTopP] = useState(0.95);
    const [showConfig, setShowConfig] = useState(false); // New config toggle

    const [selectedWorkflow, setSelectedWorkflow] = useState(MOCK_WORKFLOWS[0]?.id || '');
    const [selectedAssetIds, setSelectedAssetIds] = useState<Set<string>>(new Set());
    const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);
    const [assets, setAssets] = useState<Asset[]>([]);

    // ... (modal states, input states, result states) ...
    const [isAssetModalOpen, setAssetModalOpen] = useState(false);
    const [isPromptModalOpen, setPromptModalOpen] = useState(false);
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

    const handleStop = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
        setIsLoading(false);
        setShowLoadingOverlay(false);
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
            const assetContext = Array.from(selectedAssetIds)
                .map(id => assets.find(a => a.id === id))
                .filter(Boolean)
                .map(a => `【参考素材：${a!.name}】\n${a!.content}`)
                .join('\n\n');

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

                const workflowName = MOCK_WORKFLOWS.find(w => w.id === selectedWorkflow)?.title;
                if (workflowName) {
                    finalPrompt = `[工作流：${workflowName}]\n${finalPrompt}`;
                }
            }

            if (onStream && (activeTab === 'original' || activeTab === 'imitate')) {
                const stream = generateTextStream(finalPrompt, { model, temperature, topP, signal: controller.signal });
                let isFirst = true;
                let fullText = '';
                
                for await (const chunk of stream) {
                    if (isFirst) {
                        setShowLoadingOverlay(false);
                    }
                    onStream(chunk, isFirst);
                    fullText += chunk;
                    setResultText(fullText);
                    isFirst = false;
                }
                setOverlayStatus('success');
            } else {
                const text = await generateText(finalPrompt, { model, temperature, topP, signal: controller.signal });
                if (activeTab === 'original' || activeTab === 'imitate') {
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

    const renderTabButton = (type: ShortStoryTab, label: string, Icon: React.ElementType) => (
        <button
            onClick={() => setActiveTab(type)}
            className={`flex-1 py-2 flex flex-col items-center justify-center gap-1 transition-colors border-b-2 ${
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
        <div className="flex flex-col h-full bg-gray-50 dark:bg-black border-l border-gray-200 dark:border-gray-800">
            {/* ... Overlay & Modals ... */}
            <LoadingOverlay 
                isVisible={showLoadingOverlay} 
                onClose={() => setShowLoadingOverlay(false)} 
                onStop={handleStop}
                status={overlayStatus}
            />
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
                onSelect={(prompt) => {
                    setSelectedPrompt(prompt);
                    setPromptModalOpen(false);
                }}
            />

            <div className="flex border-b border-gray-200 dark:border-gray-800">
                {renderTabButton('original', '原创', Sparkles)}
                {renderTabButton('imitate', '仿写', DocumentPlus)}
                {renderTabButton('polish', '润色', Pencil)}
                {renderTabButton('review', '评审', ClipboardDocumentCheck)}
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8">
                
                {/* Updated Compact Model Config */}
                <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">模型配置</label>
                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <select 
                                value={model} 
                                onChange={e => setModel(e.target.value)} 
                                className="w-full py-2 pl-3 pr-8 text-xs font-medium rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:ring-1 focus:ring-sky-500 outline-none appearance-none cursor-pointer"
                            >
                                <option value="deepseek-chat">深思通用 (DeepSeek V3)</option>
                                <option value="deepseek-reasoner">深思推理 (DeepSeek R1)</option>
                                <option value="gemini-2.5-flash">谷歌极速 (Gemini Flash)</option>
                                <option value="gemini-2.5-pro">谷歌深度 (Gemini Pro)</option>
                            </select>
                            <ChevronDown className="w-3 h-3 text-gray-400 absolute right-2.5 top-3 pointer-events-none" />
                        </div>
                        <button 
                            onClick={() => setShowConfig(!showConfig)}
                            className={`px-3 py-2 text-xs font-bold rounded-lg border transition-all flex items-center gap-1 ${showConfig ? 'bg-sky-100 text-sky-600 border-sky-200 dark:bg-sky-900/30 dark:border-sky-800' : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                        >
                            <AdjustmentsHorizontal className="w-4 h-4" />
                            参数
                        </button>
                    </div>

                    {showConfig && (
                        <div className="bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg border border-gray-100 dark:border-gray-800 grid grid-cols-2 gap-4 animate-fade-in text-sm">
                            <div className="col-span-2 text-[10px] text-gray-400 bg-white dark:bg-black/20 p-2 rounded mb-1">
                                💡 小说创作建议：温度 0.7-0.9 (更有创意)，核采样 0.9 (标准)
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 flex justify-between items-center">
                                    <span>随机度</span>
                                    <span className="text-gray-700 dark:text-gray-300 font-mono">{temperature}</span>
                                </label>
                                <input 
                                    type="range" min="0" max="1.5" step="0.1" 
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
                    )}
                </div>

                {/* Rest of the UI */}
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
                                    <span className="font-semibold truncate text-xs">{selectedPrompt ? selectedPrompt.title : '点击选择提示词模板...'}</span>
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
                                    className="w-full py-2.5 pl-3 pr-8 text-xs rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:ring-1 focus:ring-sky-500 outline-none appearance-none cursor-pointer"
                                >
                                    {MOCK_WORKFLOWS.map(wf => (
                                        <option key={wf.id} value={wf.id}>{wf.title}</option>
                                    ))}
                                </select>
                                <WorkflowIcon className="w-3 h-3 absolute left-3 top-3 text-gray-400 pointer-events-none" />
                                <ChevronDown className="w-3 h-3 text-gray-400 absolute right-2.5 top-3 pointer-events-none" />
                            </div>
                        </div>
                    )}
                     <div className={selectedPrompt ? "col-span-2" : "col-span-1"}>
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">关联素材</label>
                        <button 
                            onClick={() => setAssetModalOpen(true)}
                            className={`w-full p-2.5 text-sm rounded-lg border focus:ring-2 focus:ring-sky-500 focus:outline-none transition shadow-sm flex items-center justify-between ${selectedAssetIds.size > 0 ? 'bg-sky-50 border-sky-200 text-sky-700 dark:bg-sky-900/30 dark:border-sky-800 dark:text-sky-400' : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'}`}
                        >
                            <span className="truncate text-xs">{selectedAssetIds.size > 0 ? `已选 ${selectedAssetIds.size} 项` : '选择素材'}</span>
                            <BookOpen className="w-4 h-4 flex-shrink-0" />
                        </button>
                    </div>

                <hr className="border-gray-200 dark:border-gray-800" />

                {/* ... (rest of prompts and results UI) ... */}
                <div className="space-y-4">
                    {selectedPrompt ? (
                        <div className="space-y-4 animate-fade-in">
                            <div className="flex items-center justify-between pb-2 border-b border-gray-200 dark:border-gray-800">
                                <span className="text-sm font-bold text-gray-900 dark:text-white">参数配置</span>
                            </div>
                            {selectedPrompt.fields.map((field, index) => (
                                <div key={field.id}>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                        {index + 1}. {field.label}
                                        {field.required !== false && <span className="text-red-500 ml-0.5">*</span>}
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
                                    {field.description && <p className="text-[10px] text-gray-400 mt-1">{field.description}</p>}
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

                {/* Action Button */}
                <button 
                    onClick={isLoading ? handleStop : handleGenerate}
                    disabled={false}
                    className={`w-full py-3.5 font-bold rounded-xl transition-all shadow-lg active:scale-[0.98] flex items-center justify-center gap-2 ${
                        isLoading
                        ? 'bg-red-500 hover:bg-red-600 text-white'
                        : 'bg-sky-600 hover:bg-sky-500 text-white disabled:bg-gray-400'
                    }`}
                >
                     {isLoading ? (
                        <>
                            <Stop className="w-5 h-5" />
                            停止生成
                        </>
                    ) : (
                        <>
                            <Sparkles className="w-5 h-5" />
                            生成{activeTab === 'imitate' ? '仿写' : (activeTab === 'polish' ? '润色' : '内容')}
                        </>
                    )}
                </button>

                {error && <div className="text-red-500 text-sm bg-red-50 p-2 rounded">{error}</div>}

                {/* Result */}
                {resultText && (
                    <div className="bg-white dark:bg-gray-900 p-4 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm mt-4">
                        <div className="flex justify-between items-center mb-2">
                            <h4 className="font-bold text-gray-700 dark:text-gray-300">生成结果</h4>
                            <div className="flex gap-2">
                                <button onClick={() => navigator.clipboard.writeText(resultText)} title="复制"><Copy className="w-4 h-4 text-gray-500 hover:text-sky-500" /></button>
                                <button onClick={() => onInsert(resultText)} title="插入到编辑器" className="text-sky-600 text-xs font-bold hover:underline">插入正文</button>
                            </div>
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto font-mono">
                            {resultText}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ShortStoryAIPanel;
