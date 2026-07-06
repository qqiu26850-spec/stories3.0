
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Asset, Prompt, NovelSettings, Chapter } from '../../types';
import { generateTextStream } from '../../services/geminiService';
import { fetchMaterials, incrementPromptHeat } from '../../services/supabaseService';
import { PROMPTS } from '../../constants';
import { Sparkles, ChevronDown, Database, BookOpen, DocumentPlus, Pencil, Copy, Trash, Stop, AdjustmentsHorizontal, ClipboardDocumentCheck, Check, ArrowPath, Plus, X, InformationCircle, Play } from '../Icon';
import PromptSelectionModal from '../PromptSelectionModal';
import AssetSelectionModal from '../AssetSelectionModal';
import { createPortal } from 'react-dom';
import CustomSelect from '../CustomSelect';

type TabType = 'expand' | 'continue' | 'polish' | 'review';

const WRITING_STRATEGIES = [
    "💡 提示：'展示，不要告诉' (Show, don't tell) 是写作的金科玉律。",
    "💡 提示：好的人物需要有缺陷，完美的英雄往往令人乏味。",
    "💡 提示：每一个场景都应该推动剧情发展或深化人物关系。",
    "💡 提示：对话应该有潜台词，人们往往不说出他们真正的想法。",
    "💡 提示：给主角一个难以两全的困境，迫使他们做出选择。",
    "💡 提示：尝试从反派的视角思考，这会让冲突更加真实。",
    "💡 提示：环境描写可以烘托氛围，也是人物心境的投射。",
];

const FORCE_LONG_INSTRUCTION = "\n\n【专业创作指令】：\n1. **深度扩写模式**：请采用“分层迭代生成”策略。不要概括情节，而是通过大量的细节描写（环境烘托、动作拆解、心理独白、感官体验）来丰富内容。如果用户要求长篇幅，请务必通过极其细腻的描写来达到字数要求，严禁敷衍或提前收尾。\n2. **字数突破**：请充分利用输出长度限制，将每一个细小的动作和心理变化都展开撰写，确保单次输出尽可能充实且逻辑严密。\n3. **严禁输出**任何与正文无关的对话填充内容（如：“你好！我是xx大神”、“根据您的要求...”、“以下是为您生成的...”等）。\n4. **直接输出**创作内容本身，不要有开场白或结束语。\n5. **逻辑一致性**：严格遵循前文设定的角色性格、世界观和逻辑。";

interface AIFunctionPanelProps {
    contextText: string;
    selectedText: string;
    onInsert: (text: string) => void;
    onReplace: (text: string) => void;
    onStream?: (text: string, isFirst: boolean) => void;
    projectSettings?: NovelSettings;
    externalAction?: { type: TabType; text: string } | null;
    chapters?: Chapter[];
}

const Toast: React.FC<{ message: string; isVisible: boolean }> = ({ message, isVisible }) => {
    if (!isVisible) return null;
    return createPortal(
        <div className="fixed top-20 right-8 z-[100] animate-fade-in-up">
            <div className="bg-gray-800 text-white px-4 py-2 rounded-lg shadow-lg text-xs font-bold flex items-center gap-2">
                <InformationCircle className="w-4 h-4 text-yellow-400" />
                {message}
            </div>
        </div>,
        document.body
    );
};

const AIFunctionPanel: React.FC<AIFunctionPanelProps> = ({ contextText = '', selectedText = '', onInsert, onReplace, onStream, projectSettings, externalAction, chapters = [] }) => {
    const [activeTab, setActiveTab] = useState<TabType>('expand');
    const [model, setModel] = useState('deepseek-chat');
    const [temperature, setTemperature] = useState(1);
    const [topP, setTopP] = useState(0.95);
    const [maxOutputTokens, setMaxOutputTokens] = useState(8192);
    const [showConfig, setShowConfig] = useState(false);
    const [isConfigCollapsed, setIsConfigCollapsed] = useState(false);
    
    const [selectedAssetIds, setSelectedAssetIds] = useState<Set<string>>(new Set());
    const [isProjectSettingsAssociated, setProjectSettingsAssociated] = useState(false);
    const [associatedChapterIds, setAssociatedChapterIds] = useState<Set<string>>(new Set());
    const [isChapterSelectorOpen, setIsChapterSelectorOpen] = useState(false);
    const [isFullTextAssociated, setIsFullTextAssociated] = useState(false);

    const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);
    const [assets, setAssets] = useState<Asset[]>([]);
    const [isAssetModalOpen, setAssetModalOpen] = useState(false);
    const [isPromptModalOpen, setPromptModalOpen] = useState(false);
    const [promptFilterType, setPromptFilterType] = useState<'requirements' | 'style' | 'polish'>('requirements');
    const [formState, setFormState] = useState<Record<string, string>>({});
    const [customInput, setCustomInput] = useState('');
    const [polishContent, setPolishContent] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [resultText, setResultText] = useState('');
    const [error, setError] = useState('');
    const [strategyIndex, setStrategyIndex] = useState(0);
    const [toastMsg, setToastMsg] = useState('');
    const [lastGeneratedTab, setLastGeneratedTab] = useState<TabType | null>(null);
    const lastPromptRef = useRef<string>('');
    
    const abortControllerRef = useRef<AbortController | null>(null);
    const resultContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (externalAction) {
            setActiveTab(externalAction.type);
            if (externalAction.type === 'polish' || externalAction.type === 'review') {
                setPolishContent(externalAction.text);
            }
        } else if (selectedText) {
            setPolishContent(selectedText);
        }
    }, [externalAction, selectedText]);

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
        setIsGenerating(false);
        setCustomInput('');
    }, [activeTab, defaultTabPrompts]);

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

    const showToast = (msg: string) => {
        setToastMsg(msg);
        setTimeout(() => setToastMsg(''), 3000);
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
                settingsContext = `【作品背景设定】\n题材：${projectSettings.typeElements}\n主题：${projectSettings.theme}\n世界观：${projectSettings.worldview}\n人物基础设定：${projectSettings.characterSettings}\n梗概：${projectSettings.synopsis}\n特定词条：${projectSettings.specificTerms}\n\n`;
            }

            let chapterContext = '';
            if (associatedChapterIds.size > 0 && chapters.length > 0) {
                const selectedChaptersContent = chapters
                    .filter(c => associatedChapterIds.has(c.id))
                    .map(c => `【参考章节：${c.title}】\n${c.content}`)
                    .join('\n\n');
                if (selectedChaptersContent) chapterContext += `${selectedChaptersContent}\n\n`;
            }
            if (isFullTextAssociated && contextText) {
                chapterContext += `【当前正文背景】\n${contextText}\n\n`;
            }

            const textToProcess = (activeTab === 'polish' || activeTab === 'review') 
                ? polishContent 
                : (selectedText || contextText.slice(-2000));

            let finalPrompt = '';

            if (selectedPrompt) {
                incrementPromptHeat(selectedPrompt.id);
                let basePrompt = selectedPrompt.template || selectedPrompt.content;
                for (const field of selectedPrompt.fields) {
                    let val = formState[field.id] || '';
                    if (!val && (field.id === 'context' || field.id === 'text' || field.id === 'content' || field.id === 'selection')) {
                        val = textToProcess;
                    }
                    basePrompt = basePrompt.replace(new RegExp(`\\$\\{${field.id}\\}`, 'g'), val);
                }
                finalPrompt = `${settingsContext}${chapterContext}${assetContext ? `【关联素材】\n${assetContext}\n\n---\n\n` : ''}${basePrompt}`;
            } else {
                const instruction = activeTab === 'continue' ? '请根据上文续写' : (activeTab === 'polish' ? '请润色以下文本' : (activeTab === 'expand' ? '请扩写以下文本' : '请评审以下文本'));
                const userReq = customInput ? `\n【用户具体要求】：${customInput}` : '';
                finalPrompt = `${settingsContext}${chapterContext}${assetContext ? `【关联素材】\n${assetContext}\n\n` : ''}${instruction}${userReq}。\n\n【待处理文本/上下文】：\n${textToProcess}`;
            }

            finalPrompt += FORCE_LONG_INSTRUCTION;
            lastPromptRef.current = finalPrompt;

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
            if (err.message !== 'Aborted') setError(err.message || '生成失败');
        } finally {
            setIsGenerating(false);
            abortControllerRef.current = null;
        }
    };

    const handleContinue = async () => {
        if (isGenerating) return;
        setIsGenerating(true);
        setError('');
        const tail = resultText.slice(-3000); 
        const originalPrompt = lastPromptRef.current;
        
        const continuePrompt = `
${originalPrompt}

---
【系统提示】：
上文输出因长度限制被中断。请严格基于上方【原始指令】的要求，紧接着下方的【已生成内容末尾】，继续生成剩余内容。
请保持与上文完全一致的输出格式、风格、人称和逻辑。
**不要重复**下方已提供的内容，直接无缝接续。

【已生成内容末尾】：
...${tail}

${FORCE_LONG_INSTRUCTION}
`;
        const controller = new AbortController();
        abortControllerRef.current = controller;
        try {
            const stream = generateTextStream(continuePrompt, { model, temperature, topP, maxOutputTokens, signal: controller.signal });
            for await (const chunk of stream) setResultText(prev => prev + chunk);
        } catch (err: any) {
            if (err.message !== 'Aborted') setError(err.message || '生成失败');
        } finally {
            setIsGenerating(false);
            abortControllerRef.current = null;
        }
    };

    const handleInsertCheck = () => {
        // Logic to support specific segment insertion
        const selection = window.getSelection();
        let textToInsert = resultText;
        
        // If user selected text within the result container, only insert that part
        if (selection && selection.toString().trim() && resultContainerRef.current?.contains(selection.anchorNode)) {
            textToInsert = selection.toString().trim();
            showToast('已插入选定片段...');
        } else {
            showToast(lastGeneratedTab === 'polish' ? '将替换选中的文本...' : '请确保光标定位在您想插入的地方');
        }

        if (lastGeneratedTab === 'polish') onReplace(textToInsert);
        else onInsert(textToInsert);
    };

    const renderTabButton = (type: TabType, label: string, Icon: React.ElementType) => (
        <button
            onClick={() => { setActiveTab(type); setResultText(''); }}
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

    const MODEL_OPTIONS = [
        { value: "deepseek-chat", label: "奇思版 (DeepSeek)" },
        { value: "gemini-3.5-flash", label: "妙写版 (Gemini 3.5 Flash)" },
        { value: "gemini-3.5-pro", label: "深度版 (Gemini 3.5 Pro)" },
        { value: "doubao-flash", label: "速写版 (豆包)" }
    ];

    if (resultText || isGenerating) {
        return (
            <div className="flex flex-col h-full bg-white dark:bg-gray-900 relative">
                <Toast message={toastMsg} isVisible={!!toastMsg} />
                {isGenerating && !resultText && (
                    <div className="absolute inset-0 z-50 bg-white/95 dark:bg-gray-900/95 flex flex-col items-center justify-center text-center p-6">
                        <div className="w-12 h-12 border-4 border-sky-200 border-t-sky-600 rounded-full animate-spin mb-4"></div>
                        <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-2">AI 正在创作中...</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 italic px-4">{WRITING_STRATEGIES[strategyIndex]}</p>
                        <button onClick={handleStop} className="px-6 py-2 bg-red-50 text-red-600 border border-red-200 rounded-full hover:bg-red-100 transition-colors text-sm font-bold flex items-center gap-2"><Stop className="w-4 h-4" /> 停止生成</button>
                    </div>
                )}
                <div className="flex justify-between items-center p-4 border-b border-sky-100 dark:border-sky-900 bg-sky-50/50 dark:bg-sky-900/20">
                    <h3 className="text-sm font-bold text-gray-800 dark:text-white flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-sky-500" />生成结果
                        {isGenerating && <ArrowPath className="w-3.5 h-3.5 text-sky-500 animate-spin" />}
                    </h3>
                    <div className="flex gap-2 items-center">
                        <button onClick={() => navigator.clipboard.writeText(resultText)} className="p-1.5 text-gray-500 hover:text-sky-600 hover:bg-white rounded transition-colors flex items-center gap-1" title="复制全选"><Copy className="w-4 h-4" /></button>
                        <button onClick={() => setResultText('')} className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-white rounded transition-colors" title="关闭"><X className="w-4 h-4" /></button>
                    </div>
                </div>
                <div ref={resultContainerRef} className="flex-1 overflow-y-auto p-4 custom-scrollbar select-text">
                    <div className="text-sm leading-relaxed text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-sans">{resultText}</div>
                </div>
                <div className="p-4 border-t border-gray-100 dark:border-gray-800 flex gap-2">
                    <button onClick={handleInsertCheck} className="flex-1 py-2.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 font-bold rounded-lg hover:bg-emerald-200 transition-colors text-sm font-sans flex items-center justify-center gap-1">
                        {activeTab === 'polish' ? '替换选中' : <><Plus className="w-3 h-3" /> 插入正文</>}
                    </button>
                    {isGenerating ? (
                        <button onClick={handleStop} className="flex-1 px-4 py-2.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 font-bold rounded-lg hover:bg-red-200 transition-colors text-sm font-sans flex items-center justify-center gap-1"><Stop className="w-3 h-3" /> 停止</button>
                    ) : (
                        <>
                            <button onClick={handleContinue} className="flex-1 px-3 py-2.5 bg-sky-100 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400 font-bold rounded-lg hover:bg-sky-200 transition-colors text-sm font-sans flex items-center justify-center gap-1"><Play className="w-3 h-3" /> 续写</button>
                            <button onClick={handleGenerate} className="flex-1 px-3 py-2.5 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 font-bold rounded-lg hover:bg-orange-200 transition-colors text-sm font-sans flex items-center justify-center gap-1"><ArrowPath className="w-3 h-3" /> 重试</button>
                        </>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-black border-l border-gray-200 dark:border-gray-800 font-sans relative">
            <AssetSelectionModal isOpen={isAssetModalOpen} onClose={() => setAssetModalOpen(false)} assets={assets} selectedAssetIds={selectedAssetIds} onToggleAsset={(id) => setSelectedAssetIds(prev => { const next = new Set(prev); if(next.has(id)) next.delete(id); else next.add(id); return next; })} />
            <PromptSelectionModal isOpen={isPromptModalOpen} onClose={() => setPromptModalOpen(false)} onSelect={(prompt) => { setSelectedPrompt(prompt); setPromptModalOpen(false); }} initialSubCategory={promptFilterType} />

            <div className="flex border-b border-gray-200 dark:border-gray-800 font-sans flex-shrink-0">
                {renderTabButton('expand', '扩写', Sparkles)}
                {renderTabButton('continue', '续写', DocumentPlus)}
                {renderTabButton('polish', '润色', Pencil)}
                {renderTabButton('review', '评审', ClipboardDocumentCheck)}
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-4 font-sans dynamic-scrollbar relative">
                <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden shadow-sm">
                    <button onClick={() => setIsConfigCollapsed(!isConfigCollapsed)} className="w-full flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                        <span className="text-sm font-black text-blue-700 dark:text-blue-400 flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-[10px]">1</span>模型参数配置
                        </span>
                        <ChevronDown className={`w-3 h-3 text-gray-400 transition-transform ${isConfigCollapsed ? 'rotate-180' : ''}`} />
                    </button>
                    {!isConfigCollapsed && (
                        <div className="px-3 pb-4 space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">模型选择</label>
                                <div className="flex gap-2 font-sans">
                                    <div className="relative flex-1"><CustomSelect value={model} onChange={setModel} options={MODEL_OPTIONS}/></div>
                                    <button onClick={() => setShowConfig(!showConfig)} className={`px-3 py-2 text-xs font-bold rounded-lg border transition-all flex items-center gap-1 ${showConfig ? 'bg-sky-50 text-sky-600 border-sky-200' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}>参数</button>
                                </div>
                                {showConfig && (
                                    <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 grid grid-cols-1 gap-4 animate-fade-in text-xs">
                                        <div className="space-y-1">
                                            <label className="block font-bold text-gray-700 dark:text-gray-300 flex justify-between"><span>随机度 (Temperature): {temperature}</span></label>
                                            <input type="range" min="0" max="1.5" step="0.1" value={temperature} onChange={e => setTemperature(parseFloat(e.target.value))} className="w-full h-1 bg-sky-200 rounded-lg appearance-none cursor-pointer accent-sky-500" />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="block font-bold text-gray-700 dark:text-gray-300 flex justify-between"><span>核采样 (Top P): {topP}</span></label>
                                            <input type="range" min="0" max="1" step="0.05" value={topP} onChange={e => setTopP(parseFloat(e.target.value))} className="w-full h-1 bg-sky-200 rounded-lg appearance-none cursor-pointer accent-sky-500" />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="block font-bold text-gray-700 dark:text-gray-300 flex justify-between"><span>最大长度 (Tokens): {maxOutputTokens}</span></label>
                                            <input type="range" min="1024" max="16384" step="1024" value={maxOutputTokens} onChange={e => setMaxOutputTokens(parseInt(e.target.value))} className="w-full h-1 bg-sky-200 rounded-lg appearance-none cursor-pointer accent-sky-500" />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden animate-fade-in shadow-sm">
                    <div className="p-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                        <span className="text-sm font-black text-blue-700 dark:text-blue-400 flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-[10px]">2</span>需修改的正文内容
                        </span>
                    </div>
                    <div className="p-3">
                        <textarea value={polishContent} onChange={(e) => setPolishContent(e.target.value)} placeholder={activeTab === 'continue' ? "上文内容..." : "请在正文中选择一段文本，内容将自动填充至此..."} className="w-full h-32 p-3 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-sky-500 outline-none resize-none shadow-inner" />
                        {polishContent.length === 0 && <p className="text-[10px] text-orange-500 mt-1.5 ml-1 flex items-center gap-1 font-medium"><InformationCircle className="w-3 h-3" /> 请先在左侧编辑器中选择文本</p>}
                    </div>
                </div>

                <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden animate-fade-in shadow-sm">
                    <div className="p-3 border-b border-gray-100 dark:border-gray-800"><span className="text-sm font-black text-blue-700 dark:text-blue-400 flex items-center gap-2"><span className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-[10px]">3</span>提示词选择 & 关联素材</span></div>
                    <div className="p-3 space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">提示词选择</label>
                            <button onClick={() => handleOpenPromptModal(activeTab === 'polish' ? 'polish' : 'proofread' as any)} className="w-full p-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-left transition-all hover:border-sky-300 group">
                                <div className="flex items-center justify-between"><span className={`font-bold text-sm truncate ${selectedPrompt ? 'text-sky-600 dark:text-sky-400' : 'text-gray-500 dark:text-gray-400'}`}>{selectedPrompt ? selectedPrompt.title : (activeTab === 'polish' ? '选择润色提示词...' : '选择评审提示词...')}</span><ChevronDown className="w-3 h-3 text-gray-400 group-hover:text-sky-500" /></div>
                            </button>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">关联素材与上下文</label>
                            <div className="flex flex-col gap-2">
                                <button onClick={() => setAssetModalOpen(true)} className={`w-full p-2.5 rounded-lg border text-left transition-all font-sans ${selectedAssetIds.size > 0 ? 'bg-sky-100 border-sky-300 text-sky-900' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500 hover:border-sky-300'}`}><div className="flex items-center justify-between"><div className="flex items-center gap-2 overflow-hidden"><Database className={`w-3.5 h-3.5 flex-shrink-0 ${selectedAssetIds.size > 0 ? 'text-sky-600' : 'text-gray-400'}`} /><span className="font-semibold text-xs truncate">{selectedAssetIds.size > 0 ? selectedAssetNames : '关联人物/剧情...'}</span></div><ChevronDown className="w-3 h-3 text-gray-400 opacity-50 flex-shrink-0" /></div></button>
                                <div className="grid grid-cols-2 gap-2">
                                    <button onClick={() => setProjectSettingsAssociated(!isProjectSettingsAssociated)} className={`w-full p-2.5 rounded-lg border text-left transition-all flex items-center justify-between ${isProjectSettingsAssociated ? 'bg-sky-50 border-sky-300 text-sky-900' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500 hover:border-sky-300'}`}><div className="flex items-center gap-2"><BookOpen className={`w-3.5 h-3.5 flex-shrink-0 ${isProjectSettingsAssociated ? 'text-sky-600' : 'text-gray-400'}`} /><span className="font-semibold text-xs whitespace-nowrap">作品设定</span></div>{isProjectSettingsAssociated && <Check className="w-3.5 h-3.5 text-sky-500" />}</button>
                                    <div className="relative">
                                        <button onClick={() => setIsChapterSelectorOpen(!isChapterSelectorOpen)} className={`w-full p-2.5 rounded-lg border text-left transition-all flex items-center justify-between ${associatedChapterIds.size > 0 || isFullTextAssociated ? 'bg-sky-50 border-sky-300 text-sky-900' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500 hover:border-sky-300'}`}><div className="flex items-center gap-2"><BookOpen className={`w-3.5 h-3.5 flex-shrink-0 ${associatedChapterIds.size > 0 || isFullTextAssociated ? 'text-sky-600' : 'text-gray-400'}`} /><span className="font-semibold text-xs whitespace-nowrap">关联章节</span></div><ChevronDown className="w-3 h-3 text-gray-400 opacity-50 flex-shrink-0" /></button>
                                        {isChapterSelectorOpen && (<><div className="fixed inset-0 z-40" onClick={() => setIsChapterSelectorOpen(false)} /><div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 z-50 p-2 animate-fade-in max-h-60 overflow-y-auto custom-scrollbar"><label className="flex items-center gap-2 p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg cursor-pointer transition-colors border-b border-gray-100 dark:border-gray-700 mb-1"><input type="checkbox" checked={isFullTextAssociated} onChange={() => setIsFullTextAssociated(!isFullTextAssociated)} className="rounded border-gray-300 text-sky-600 focus:ring-sky-500 w-3.5 h-3.5"/><span className="text-xs font-bold text-sky-600 dark:text-sky-400">当前全文</span></label><div className="text-[10px] font-bold text-gray-400 px-2 py-1 uppercase">其他章节</div>{chapters.length > 0 ? chapters.map(ch => (<label key={ch.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg cursor-pointer transition-colors"><input type="checkbox" checked={associatedChapterIds.has(ch.id)} onChange={() => setAssociatedChapterIds(prev => { const next = new Set(prev); if(next.has(ch.id)) next.delete(ch.id); else next.add(ch.id); return next; })} className="rounded border-gray-300 text-sky-600 focus:ring-sky-500 w-3.5 h-3.5"/><span className="text-xs text-gray-700 dark:text-gray-300 truncate">{ch.title || '未命名'}</span></label>)) : <div className="p-2 text-xs text-gray-400 text-center">暂无章节</div>}</div></>)}
                                    </div>
                                </div>
                            </div>
                        </div>
                        {selectedPrompt && (
                            <div className="space-y-4 pt-3 border-t border-gray-100 dark:border-gray-700"><div className="flex items-center justify-between"><span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">模板参数</span><button onClick={() => setSelectedPrompt(null)} className="text-[10px] text-gray-400 hover:text-rose-500 font-medium">重置</button></div>{selectedPrompt.fields.map((field, index) => { if (field.id === 'context' || field.id === 'text') return null; return (<div key={field.id} className="space-y-1.5"><div className="flex justify-between items-center"><label className="block text-sm font-bold text-gray-700 dark:text-gray-300">{index + 1}. {field.label}{field.required !== false && <span className="ml-0.5 text-red-500">*</span>}</label></div>{field.type === 'textarea' ? <textarea rows={3} value={formState[field.id] || ''} onChange={e => handleInputChange(field.id, e.target.value)} placeholder={field.placeholder || "请输入..."} className="w-full p-3 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none resize-y shadow-inner" /> : <input type="text" value={formState[field.id] || ''} onChange={e => handleInputChange(field.id, e.target.value)} placeholder={field.placeholder || "请输入..."} className="w-full p-3 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none shadow-inner" />}{field.description && <p className="text-[10px] text-sky-500 dark:text-sky-400 flex items-start gap-1 leading-tight mt-0.5"><InformationCircle className="w-3 h-3 shrink-0" />{field.description}</p>}</div>); })}</div>
                        )}
                        {!selectedPrompt && <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-gray-800"><label className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">自定义要求</label><textarea value={customInput} onChange={(e) => setCustomInput(e.target.value)} placeholder="请输入具体的创作要求..." className="w-full h-24 p-3 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none resize-none shadow-inner" /></div>}
                    </div>
                </div>
                {!isGenerating && !resultText && <button onClick={handleGenerate} className="w-full py-3.5 font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] font-sans bg-sky-600 hover:bg-sky-500 text-white disabled:bg-gray-400"><Sparkles className="w-5 h-5" />{activeTab === 'review' ? '开始智能评审' : '立即生成内容'}</button>}
            </div>
        </div>
    );
};

export default AIFunctionPanel;
