
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Asset, Prompt, PromptSubCategory } from '../../types';
import { generateText, generateTextStream } from '../../services/geminiService';
import { fetchMaterials, incrementPromptHeat } from '../../services/supabaseService';
import { Sparkles, Film, ChevronDown, Database, Copy, Stop, AdjustmentsHorizontal, Check, ArrowPath, Play, Pencil, ClipboardDocumentCheck, DocumentPlus, Trash, Plus, InformationCircle, X } from '../Icon';
import PromptSelectionModal from '../PromptSelectionModal';
import AssetSelectionModal from '../AssetSelectionModal';
import CustomSelect from '../CustomSelect';
import { createPortal } from 'react-dom';

interface ScriptAIPanelProps {
    onInsert: (text: string) => void;
    onReplace?: (text: string) => void;
    onStream?: (text: string, isFirst: boolean) => void;
    selectedText?: string;
    externalAction?: { type: 'polish' | 'expand' | 'ask'; text: string } | null;
}

type ScriptTab = 'polish' | 'review';

const WRITING_STRATEGIES = [
    "💡 提示：剧本创作强调'画面感'，避免过多的心理描写。",
    "💡 提示：动作线要清晰，指示演员的具体行为。",
    "💡 提示：对白要精炼，符合人物性格。",
    "💡 提示：场景标题要规范，明确内/外景、时间。",
    "💡 提示：冲突是戏剧的核心。",
];

const FORCE_LONG_INSTRUCTION = "\n\n【重要指令】：\n1. 请尽可能详细、深入地撰写，展开环境、心理、动作等细节。\n2. **严禁输出**任何与正文无关的对话填充内容（如：“你好！我是xx大神”、“根据您的要求...”、“以下是为您生成的...”等）。\n3. **直接输出**创作内容本身，不要有开场白或结束语。\n4. 请充分利用输出长度限制，生成长篇幅的完整内容。";

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

const ScriptAIPanel: React.FC<ScriptAIPanelProps> = ({ onInsert, onReplace, onStream, selectedText = '', externalAction }) => {
    const [activeTab, setActiveTab] = useState<ScriptTab>('polish');
    const [model, setModel] = useState('deepseek-chat');
    const [temperature, setTemperature] = useState(1);
    const [topP, setTopP] = useState(0.95);
    const [maxOutputTokens, setMaxOutputTokens] = useState(8192);
    const [showConfig, setShowConfig] = useState(false);
    const [isConfigCollapsed, setIsConfigCollapsed] = useState(false);
    
    const [isAssetModalOpen, setAssetModalOpen] = useState(false);
    const [isPromptModalOpen, setPromptModalOpen] = useState(false);
    const [promptFilterType, setPromptFilterType] = useState<PromptSubCategory>('polish');
    const [selectedAssetIds, setSelectedAssetIds] = useState<Set<string>>(new Set());
    const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);
    const [assets, setAssets] = useState<Asset[]>([]);
    
    const [polishContent, setPolishContent] = useState('');
    const [formState, setFormState] = useState<Record<string, string>>({});
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedText, setGeneratedText] = useState('');
    const [error, setError] = useState('');
    const [strategyIndex, setStrategyIndex] = useState(0);
    const [toastMsg, setToastMsg] = useState('');
    
    const abortControllerRef = useRef<AbortController | null>(null);
    const resultContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (externalAction) {
            if (externalAction.type === 'polish') {
                setActiveTab('polish');
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
        return Array.from(selectedAssetIds).map(id => assets.find(a => a.id === id)?.name).filter(Boolean).join(', ');
    }, [selectedAssetIds, assets]);

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

    const handleOpenPromptModal = (filter: PromptSubCategory) => {
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

    const showToast = (msg: string) => {
        setToastMsg(msg);
        setTimeout(() => setToastMsg(''), 3000);
    };

    const handleGenerate = async () => {
        if (!polishContent) { alert('请先选择或输入待处理文本'); return; }
        setIsGenerating(true);
        setGeneratedText('');
        setError('');
        const controller = new AbortController();
        abortControllerRef.current = controller;
        try {
            const assetContext = Array.from(selectedAssetIds).map(id => assets.find(a => a.id === id)).filter(Boolean).map(a => `【参考素材：${a!.name}】\n${a!.content}`).join('\n\n');
            let promptContent = '';
            if (selectedPrompt) {
                incrementPromptHeat(selectedPrompt.id);
                promptContent = selectedPrompt.template || selectedPrompt.content;
                for (const field of selectedPrompt.fields) {
                    const val = formState[field.id] || '';
                    promptContent = promptContent.replace(new RegExp(`\\$\\{${field.id}\\}`, 'g'), val);
                }
            } 
            const cleanInstruction = "IMPORTANT: Output ONLY the script/idea content. Do NOT include any filler text. Do NOT use markdown code blocks.";
            let finalPrompt = '';
            if (activeTab === 'polish') {
                finalPrompt = `${cleanInstruction}\n请润色以下剧本片段。${assetContext ? `\n参考素材：\n${assetContext}` : ''}\n\n【待润色内容】：\n${polishContent}\n\n${promptContent ? `【要求】：${promptContent}` : ''}`;
            } else if (activeTab === 'review') {
                finalPrompt = `${cleanInstruction}\n请作为资深编剧评审以下剧本片段。${assetContext ? `\n参考素材：\n${assetContext}` : ''}\n\n【待评审内容】：\n${polishContent}\n\n${promptContent ? `【关注】：${promptContent}` : ''}`;
            } 
            finalPrompt += FORCE_LONG_INSTRUCTION;
            const stream = generateTextStream(finalPrompt, { model, temperature, topP, maxOutputTokens, signal: controller.signal });
            for await (const chunk of stream) setGeneratedText(prev => prev + chunk);
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
        const tail = generatedText.slice(-3000); 
        const continuePrompt = `IMPORTANT: Output ONLY the continued script content.\n请紧接着以下内容继续生成，保持风格和逻辑连贯，不要重复上文结尾。\n\n【上文回顾】：\n...${tail}\n\n${FORCE_LONG_INSTRUCTION}`;
        const controller = new AbortController();
        abortControllerRef.current = controller;
        try {
            const stream = generateTextStream(continuePrompt, { model, temperature, topP, maxOutputTokens, signal: controller.signal });
            for await (const chunk of stream) setGeneratedText(prev => prev + chunk);
        } catch (err: any) {
            if (err.message !== 'Aborted') setError(err.message || '生成失败');
        } finally {
            setIsGenerating(false);
            abortControllerRef.current = null;
        }
    };

    const handleInsertResult = () => {
        const selection = window.getSelection();
        let textToInsert = generatedText;
        
        // Snippet insertion support
        if (selection && selection.toString().trim() && resultContainerRef.current?.contains(selection.anchorNode)) {
            textToInsert = selection.toString().trim();
            showToast('已插入选定剧本片段...');
        } else {
            showToast('正在插入剧本内容...');
        }

        if (activeTab === 'polish' && onReplace) {
            onReplace(textToInsert);
        } else {
            onInsert(textToInsert);
        }
    };

    const renderTabButton = (type: ScriptTab, label: string, Icon: React.ElementType) => (
        <button onClick={() => { setActiveTab(type); setGeneratedText(''); }} className={`flex-1 py-3 flex flex-col items-center justify-center gap-1.5 transition-colors border-b-2 font-sans h-12 ${activeTab === type ? 'border-sky-500 text-sky-600 dark:text-sky-400 bg-white dark:bg-gray-800' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800'}`}><Icon className="w-4 h-4" /><span className="text-xs font-bold">{label}</span></button>
    );

    const MODEL_OPTIONS = [
        { value: "deepseek-chat", label: "奇思版 (DeepSeek)" },
        { value: "gemini-3-flash-preview", label: "妙写版 (Gemini 3.0 Flash)" },
        { value: "doubao-flash", label: "速写版 (豆包)" }
    ];

    if (generatedText || isGenerating) {
        return (
            <div className="flex flex-col h-full bg-white dark:bg-gray-900 relative">
                <Toast message={toastMsg} isVisible={!!toastMsg} />
                {isGenerating && !generatedText && (
                    <div className="absolute inset-0 z-50 bg-white/95 dark:bg-gray-900/95 flex flex-col items-center justify-center text-center p-6"><div className="w-12 h-12 border-4 border-sky-200 border-t-sky-600 rounded-full animate-spin mb-4"></div><h3 className="text-lg font-bold text-gray-800 dark:text-white mb-2">AI 正在创作中...</h3><p className="text-sm text-gray-500 dark:text-gray-400 mb-6 italic px-4">{WRITING_STRATEGIES[strategyIndex]}</p><button onClick={handleStop} className="px-6 py-2 bg-red-50 text-red-600 border border-red-200 rounded-full hover:bg-red-100 transition-colors text-sm font-bold flex items-center gap-2"><Stop className="w-4 h-4" /> 停止生成</button></div>
                )}
                <div className="flex justify-between items-center p-4 border-b border-sky-100 dark:border-sky-900 bg-sky-50/50 dark:bg-sky-900/20"><h3 className="text-sm font-bold text-gray-800 dark:text-white flex items-center gap-2"><Sparkles className="w-4 h-4 text-sky-500" />生成结果{isGenerating && <ArrowPath className="w-3.5 h-3.5 text-sky-500 animate-spin" />}</h3><div className="flex gap-2"><button onClick={() => navigator.clipboard.writeText(generatedText)} className="p-1.5 text-gray-500 hover:text-sky-600 hover:bg-white rounded transition-colors" title="复制全选"><Copy className="w-4 h-4" /></button><button onClick={() => setGeneratedText('')} className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-white rounded transition-colors" title="关闭"><X className="w-4 h-4" /></button></div></div>
                <div ref={resultContainerRef} className="flex-1 overflow-y-auto p-4 custom-scrollbar select-text"><div className="text-sm leading-relaxed text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-mono">{generatedText}</div></div>
                <div className="p-4 border-t border-gray-100 dark:border-gray-800 flex gap-2"><button onClick={handleInsertResult} className="flex-1 py-2.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 font-bold rounded-lg hover:bg-emerald-200 transition-colors text-sm font-sans flex items-center justify-center gap-1">{activeTab === 'polish' ? '替换原文' : <><Plus className="w-3 h-3" /> 插入剧本</>}</button>{isGenerating ? <button onClick={handleStop} className="flex-1 px-4 py-2.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 font-bold rounded-lg hover:bg-red-200 transition-colors text-sm font-sans flex items-center justify-center gap-1"><Stop className="w-3 h-3" /> 停止</button> : <button onClick={handleGenerate} className="flex-1 px-3 py-2.5 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 font-bold rounded-lg hover:bg-orange-200 transition-colors text-sm font-sans flex items-center justify-center gap-1"><ArrowPath className="w-3 h-3" /> 重试</button>}</div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-white dark:bg-black border-l border-gray-200 dark:border-gray-800 w-full font-sans">
            <AssetSelectionModal isOpen={isAssetModalOpen} onClose={() => setAssetModalOpen(false)} assets={assets} selectedAssetIds={selectedAssetIds} onToggleAsset={(id) => setSelectedAssetIds(prev => { const next = new Set(prev); if(next.has(id)) next.delete(id); else next.add(id); return next; })} />
            <PromptSelectionModal isOpen={isPromptModalOpen} onClose={() => setPromptModalOpen(false)} onSelect={(prompt) => { setSelectedPrompt(prompt); setPromptModalOpen(false); }} initialSubCategory={promptFilterType} />
            <div className="flex border-b border-gray-200 dark:border-gray-800 font-sans flex-shrink-0 bg-gray-50/50 dark:bg-gray-900">{renderTabButton('polish', '润色', Pencil)}{renderTabButton('review', '评审', ClipboardDocumentCheck)}</div>
            <div className="flex-1 overflow-y-auto font-sans dynamic-scrollbar bg-white dark:bg-gray-900">
                <div className="border-b border-gray-100 dark:border-gray-800"><button onClick={() => setIsConfigCollapsed(!isConfigCollapsed)} className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"><span className="text-sm font-black text-sky-600 dark:text-sky-400 flex items-center gap-2"><span className="w-5 h-5 rounded-full bg-sky-100 text-sky-600 flex items-center justify-center text-[10px]">1</span>模型参数配置</span><ChevronDown className={`w-3 h-3 text-gray-400 transition-transform ${isConfigCollapsed ? 'rotate-180' : ''}`} /></button>{!isConfigCollapsed && <div className="px-4 pb-4 space-y-4"><div className="space-y-1.5"><label className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">模型选择</label><div className="flex gap-2 font-sans"><div className="relative flex-1"><CustomSelect value={model} onChange={setModel} options={MODEL_OPTIONS} /></div><button onClick={() => setShowConfig(!showConfig)} className={`px-3 py-2 text-xs font-bold rounded-lg border transition-all flex items-center gap-1 font-sans ${showConfig ? 'bg-sky-50 text-sky-600 border-sky-200' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}>参数</button></div>{showConfig && <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 grid grid-cols-1 gap-4 animate-fade-in text-xs"><div className="space-y-1"><label className="block font-bold text-gray-700 dark:text-gray-300 flex justify-between"><span>温度: {temperature}</span></label><input type="range" min="0" max="1.5" step="0.1" value={temperature} onChange={e => setTemperature(parseFloat(e.target.value))} className="w-full h-1 bg-sky-200 rounded-lg appearance-none cursor-pointer accent-sky-500" /></div><div className="space-y-1"><label className="block font-bold text-gray-700 dark:text-gray-300 flex justify-between"><span>核采样: {topP}</span></label><input type="range" min="0" max="1" step="0.05" value={topP} onChange={e => setTopP(parseFloat(e.target.value))} className="w-full h-1 bg-sky-200 rounded-lg appearance-none cursor-pointer accent-sky-500" /></div><div className="space-y-1"><label className="block font-bold text-gray-700 dark:text-gray-300 flex justify-between"><span>最大长度: {maxOutputTokens}</span></label><input type="range" min="1024" max="16384" step="1024" value={maxOutputTokens} onChange={e => setMaxOutputTokens(parseInt(e.target.value))} className="w-full h-1 bg-sky-200 rounded-lg appearance-none cursor-pointer accent-sky-500" /></div></div>}</div></div>}</div>
                <div className="border-b border-gray-100 dark:border-gray-800"><div className="p-4 flex items-center justify-between"><span className="text-sm font-black text-sky-600 dark:text-sky-400 flex items-center gap-2"><span className="w-5 h-5 rounded-full bg-sky-100 text-sky-600 flex items-center justify-center text-[10px]">2</span>需修改的正文内容</span></div><div className="px-4 pb-4"><textarea value={polishContent} onChange={(e) => setPolishContent(e.target.value)} placeholder="请在正文中选择一段文本..." className="w-full h-32 p-3 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-sky-500 outline-none resize-none shadow-inner" />{polishContent.length === 0 && <p className="text-[10px] text-orange-500 mt-1.5 ml-1 flex items-center gap-1 font-medium"><InformationCircle className="w-3 h-3" /> 请先在左侧编辑器中选择文本</p>}</div></div>
                <div className="border-b border-gray-100 dark:border-gray-800"><div className="p-4"><span className="text-sm font-black text-sky-600 dark:text-sky-400 flex items-center gap-2"><span className="w-5 h-5 rounded-full bg-sky-100 text-sky-600 flex items-center justify-center text-[10px]">3</span>提示词选择 & 关联素材</span></div><div className="px-4 pb-4 space-y-4"><div className="space-y-1.5"><label className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">提示词选择</label><button onClick={() => handleOpenPromptModal(activeTab === 'polish' ? 'polish' : 'proofread')} className="w-full p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-left transition-all hover:border-sky-300 group hover:shadow-sm"><div className="flex items-center justify-between"><span className={`font-bold text-sm truncate ${selectedPrompt ? 'text-sky-600 dark:text-sky-400' : 'text-gray-500 dark:text-gray-400'}`}>{selectedPrompt ? selectedPrompt.title : (activeTab === 'polish' ? '选择润色提示词...' : '选择评审提示词...')}</span><ChevronDown className="w-3 h-3 text-gray-400 group-hover:text-sky-500" /></div></button></div><div className="space-y-1.5"><label className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">关联素材</label><button onClick={() => setAssetModalOpen(true)} className={`w-full p-3 rounded-lg border text-left transition-all font-sans hover:shadow-sm ${selectedAssetIds.size > 0 ? 'bg-sky-50 border-sky-300 text-sky-900' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500 hover:border-sky-300'}`}><div className="flex items-center justify-between text-[11px] font-semibold truncate"><div className="flex items-center gap-1.5 overflow-hidden"><Database className={`w-3.5 h-3.5 flex-shrink-0 ${selectedAssetIds.size > 0 ? 'text-sky-600' : 'text-gray-400'}`} /><span className="truncate">{selectedAssetIds.size > 0 ? selectedAssetNames : '点击关联设定...'}</span></div><ChevronDown className="w-3 h-3 text-sky-400 opacity-50 flex-shrink-0" /></div></button></div>{selectedPrompt && (<div className="space-y-4 pt-3 border-t border-gray-100 dark:border-gray-700"><div className="flex items-center justify-between"><span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">模板参数</span><button onClick={() => setSelectedPrompt(null)} className="text-[10px] text-gray-400 hover:text-rose-500 font-medium">重置</button></div>{selectedPrompt.fields.map((field, index) => { if (field.id === 'context' || field.id === 'text') return null; return (<div key={field.id} className="space-y-1.5"><div className="flex justify-between items-center"><label className="block text-sm font-bold text-gray-700 dark:text-gray-300">{index + 1}. {field.label}{field.required !== false && <span className="ml-0.5 text-red-500">*</span>}</label></div>{field.type === 'textarea' ? <textarea rows={3} value={formState[field.id] || ''} onChange={e => handleInputChange(field.id, e.target.value)} placeholder={field.placeholder || "请输入..."} className="w-full p-3 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none resize-y shadow-inner" /> : <input type="text" value={formState[field.id] || ''} onChange={e => handleInputChange(field.id, e.target.value)} placeholder={field.placeholder || "请输入..."} className="w-full p-3 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none shadow-inner" />}</div>); })}</div>)}</div></div>
                <div className="p-4">{!isGenerating && !generatedText && <button onClick={handleGenerate} className="w-full py-3.5 font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] font-sans bg-sky-600 hover:bg-sky-500 text-white disabled:bg-gray-400"><Sparkles className="w-4 h-4" /> {activeTab === 'review' ? '开始智能评审' : '立即生成内容'}</button>}</div>
            </div>
        </div>
    );
};

export default ScriptAIPanel;
