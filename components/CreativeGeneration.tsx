
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { CREATIVE_MODULES } from '../constants';
import CreativeCard from './CreativeCard';
import { CreativeModule, Asset, Prompt } from '../types';
import { generateTextStream } from '../services/geminiService';
import { ChevronDoubleLeft, Sparkles, Copy, Database, AdjustmentsHorizontal, Search, DocumentText, X, BookOpen, ChevronDown, Check, Stop, InformationCircle } from './Icon';
import PromptSelectionModal from './PromptSelectionModal';
import AssetSelectionModal from './AssetSelectionModal'; 
import { saveMaterial, incrementPromptHeat, fetchMaterials } from '../services/supabaseService';
import LoadingOverlay from './LoadingOverlay';
import ImportAssetModal from './ImportAssetModal';

interface CreativeGenerationProps {
  initialData?: {
    prompt?: Prompt;
    values?: Record<string, string>;
  };
  onClearInitialData?: () => void;
}

// 辅助函数：去除 Markdown 标记转为纯文本
const stripMarkdown = (text: string) => {
    return text
        .replace(/#+\s/g, '') // 去除标题 #
        .replace(/\*\*|\*/g, '') // 去除加粗和斜体 *
        .replace(/>\s/g, '') // 去除引用 >
        .replace(/!\[.*?\]\(.*?\)/g, '') // 去除图片
        .replace(/\[(.*?)\]\(.*?\)/g, '$1') // 去除链接，保留文字
        .replace(/`{1,3}.*?`{1,3}/gs, '') // 去除代码块
        .replace(/<think>[\s\S]*?<\/think>/g, '') // 去除 R1 思索过程
        .trim();
};

const FormattedText: React.FC<{ text: string }> = ({ text }) => {
    const cleanedText = text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

    return (
        <div className="whitespace-pre-wrap font-sans text-gray-800 dark:text-gray-200 leading-relaxed text-sm">
            {cleanedText.split('\n').map((line, index) => {
                const trimmedLine = line.trim();
                const isMarkdownHeader = trimmedLine.startsWith('#');
                
                if (isMarkdownHeader) {
                    const match = trimmedLine.match(/^(#+)\s*(.*)/);
                    if (match) {
                        const level = Math.min(match[1].length, 6);
                        const content = match[2];
                        
                        let className = "font-bold text-gray-900 dark:text-white ";
                        if (level === 1) className += "text-xl mt-6 mb-4";
                        else if (level === 2) className += "text-lg mt-5 mb-3";
                        else className += "text-base mt-4 mb-2";
                        
                        return <div key={index} className={className}>{content}</div>;
                    }
                }
                
                const parts = line.split(/(\*\*.*?\*\*)/g);
                return (
                    <div key={index} className="min-h-[1.5em] mb-1">
                        {parts.map((part, i) => {
                            if (part.startsWith('**') && part.endsWith('**')) {
                                return <span key={i} className="font-bold text-gray-900 dark:text-white">{part.slice(2, -2)}</span>;
                            }
                            return <span key={i}>{part}</span>;
                        })}
                    </div>
                );
            })}
        </div>
    );
};

const CreativeGeneration: React.FC<CreativeGenerationProps> = ({ initialData, onClearInitialData }) => {
    const [selectedModule, setSelectedModule] = useState<CreativeModule | null>(null);
    const [model, setModel] = useState('deepseek-chat');
    const [temperature, setTemperature] = useState(1);
    const [topP, setTopP] = useState(0.95);
    const [maxOutputTokens, setMaxOutputTokens] = useState(8192);
    const [showConfig, setShowConfig] = useState(false);
    const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);
    // Fix: Replaced undefined PromptFormState with Record<string, string>
    const [formState, setFormState] = useState<Record<string, string>>({});
    const [freeInput, setFreeInput] = useState('');
    const [generatedText, setGeneratedText] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [isWaitingForFirstChunk, setIsWaitingForFirstChunk] = useState(false);
    const [showLoadingOverlay, setShowLoadingOverlay] = useState(false);
    const [importModalOpen, setImportModalOpen] = useState(false);
    const [promptModalOpen, setPromptModalOpen] = useState(false);
    const [assetModalOpen, setAssetModalOpen] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [showInlineSuccess, setShowInlineSuccess] = useState(false);
    const [assets, setAssets] = useState<Asset[]>([]);
    const [selectedAssetIds, setSelectedAssetIds] = useState<Set<string>>(new Set());
    
    const abortControllerRef = useRef<AbortController | null>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const loadAssets = async () => {
            const data = await fetchMaterials();
            setAssets(data.map((item: any) => ({
                id: item.id,
                name: item.name,
                type: item.type === 'idea' ? 'inspiration' : item.type,
                content: item.content,
                tags: item.tags || [],
            })));
        };
        loadAssets();
    }, []);

    const selectedAssetNames = useMemo(() => Array.from(selectedAssetIds).map(id => assets.find(a => a.id === id)?.name).filter(Boolean).join(', '), [selectedAssetIds, assets]);

    useEffect(() => {
        if (isGenerating && scrollContainerRef.current) {
            scrollContainerRef.current.scrollTo({ top: scrollContainerRef.current.scrollHeight, behavior: 'auto' });
        }
    }, [generatedText, isGenerating]);

    const handleStop = () => {
        if (abortControllerRef.current) abortControllerRef.current.abort();
        setIsGenerating(false);
        setIsWaitingForFirstChunk(false);
        setShowLoadingOverlay(false);
    };

    const handleGenerate = async () => {
        if (isGenerating) { handleStop(); return; }
        setIsGenerating(true);
        setIsWaitingForFirstChunk(true);
        setGeneratedText('');
        let basePrompt = selectedPrompt ? selectedPrompt.template : freeInput;
        if (selectedPrompt) {
            incrementPromptHeat(selectedPrompt.id);
            selectedPrompt.fields.forEach(f => basePrompt = basePrompt.replace(new RegExp(`\\$\\{${f.id}\\}`, 'g'), formState[f.id] || ''));
        }
        const assetContext = Array.from(selectedAssetIds).map(id => assets.find(a => a.id === id)).filter(Boolean).map(a => `【参考：${a!.name}】\n${a!.content}`).join('\n\n');
        const finalPrompt = assetContext ? `${assetContext}\n\n---\n\n${basePrompt}` : basePrompt;
        const controller = new AbortController(); abortControllerRef.current = controller;
        try {
            const stream = generateTextStream(finalPrompt, { 
                model, 
                temperature, 
                topP, 
                maxOutputTokens, 
                signal: controller.signal 
            });
            let first = true;
            for await (const chunk of stream) {
                if (first) { 
                    setShowLoadingOverlay(false); 
                    setIsWaitingForFirstChunk(false);
                    first = false; 
                }
                setGeneratedText(prev => prev + chunk);
            }
            setSuccessMessage('生成完毕');
            setShowInlineSuccess(true);
            setTimeout(() => setShowInlineSuccess(false), 3000);
        } catch (e) {} finally { setIsGenerating(false); setIsWaitingForFirstChunk(false); setShowLoadingOverlay(false); }
    };

    const handleImportAsset = (data: { name: string; type: Asset['type']; tags: string[]; content: string }) => {
        saveMaterial(data.name, data.content, data.type === 'inspiration' ? 'idea' : data.type, data.tags);
        setSuccessMessage('已导入素材库');
        setShowInlineSuccess(true);
        setTimeout(() => setShowInlineSuccess(false), 3000);
    };

    if (!selectedModule) {
        return (
            <div className="p-8 h-full animate-fade-in font-sans">
                <div className="mb-8"><h1 className="text-3xl font-bold text-gray-900 dark:text-white">创意生成</h1></div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {CREATIVE_MODULES.map(m => <CreativeCard key={m.id} module={m} onSelect={() => setSelectedModule(m)} />)}
                </div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col bg-gray-50 dark:bg-black overflow-hidden relative font-sans">
            <LoadingOverlay isVisible={showLoadingOverlay} onClose={handleStop} />
            <ImportAssetModal isOpen={importModalOpen} onClose={() => setImportModalOpen(false)} content={generatedText} onSave={handleImportAsset} />
            {promptModalOpen && <PromptSelectionModal isOpen={promptModalOpen} onClose={() => setPromptModalOpen(false)} onSelect={setSelectedPrompt} initialSubCategory={selectedModule.subCategories[0] as any} />}
            <AssetSelectionModal isOpen={assetModalOpen} onClose={() => setAssetModalOpen(false)} assets={assets} selectedAssetIds={selectedAssetIds} onToggleAsset={(id) => setSelectedAssetIds(prev => { const next = new Set(prev); if(next.has(id)) next.delete(id); else next.add(id); return next; })} />

            <div className="flex-shrink-0 flex items-center justify-between p-4 border-b border-gray-200 bg-white dark:bg-gray-900 z-20 shadow-sm font-sans">
                <div className="flex items-center gap-3">
                    <button onClick={() => setSelectedModule(null)} className="p-2 rounded-full hover:bg-gray-100 text-gray-500"><ChevronDoubleLeft className="w-5 h-5" /></button>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">{selectedModule.title}</h2>
                </div>
            </div>

            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
                <div className="w-full lg:w-[432px] xl:w-[480px] flex flex-col border-r border-gray-200 bg-white dark:bg-gray-900 overflow-hidden z-10 [scrollbar-gutter:stable] font-sans">
                    <div className="flex-1 overflow-y-auto px-5 py-6 space-y-8">
                        <div className="space-y-3">
                            <div className="flex items-center gap-2 text-sky-600 dark:text-sky-400 font-bold text-sm uppercase tracking-wider">
                                <div className="p-1.5 bg-sky-100 dark:bg-sky-900/30 rounded-lg">
                                    <AdjustmentsHorizontal className="w-4 h-4" />
                                </div>
                                模型配置
                            </div>
                            <div className="bg-sky-50/50 dark:bg-sky-900/5 p-4 rounded-2xl border border-sky-100 dark:border-sky-900/30">
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <select value={model} onChange={e => setModel(e.target.value)} className="w-full py-2 pl-3 pr-8 text-xs font-bold bg-white dark:bg-gray-800 border border-sky-100 dark:border-sky-800 rounded-lg text-gray-700 dark:text-gray-200 outline-none appearance-none cursor-pointer font-sans">
                                            <option value="deepseek-chat">深思通用 (DeepSeek V3)</option>
                                            <option value="deepseek-reasoner">深思推理 (DeepSeek R1)</option>
                                            <option value="doubao-pro-32k">豆包 Pro (Doubao)</option>
                                            <option value="gemini-3-flash-preview">谷歌极速 (Gemini 3 Flash)</option>
                                            <option value="gemini-3-pro-preview">谷歌深度 (Gemini 3 Pro)</option>
                                        </select>
                                        <ChevronDown className="w-3 h-3 text-sky-400 absolute right-2.5 top-3 pointer-events-none" />
                                    </div>
                                    <button onClick={() => setShowConfig(!showConfig)} className="px-3 py-2 text-xs font-bold rounded-lg border border-sky-100 bg-white dark:bg-gray-800 text-sky-600 flex items-center gap-1 hover:bg-sky-50 font-sans"><AdjustmentsHorizontal className="w-4 h-4" />参数</button>
                                </div>
                                {showConfig && (
                                    <div className="mt-4 pt-4 border-t border-sky-100/50 space-y-6 animate-fade-in font-sans">
                                        <div className="space-y-2">
                                            <label className="block text-[10px] font-black text-sky-400 flex justify-between uppercase">
                                                <span>温度 (Temperature): {temperature}</span>
                                            </label>
                                            <input type="range" min="0" max="1.5" step="0.1" value={temperature} onChange={e => setTemperature(parseFloat(e.target.value))} className="w-full h-1 bg-sky-100 rounded-lg appearance-none cursor-pointer accent-sky-500" />
                                            <p className="text-[10px] text-gray-400 leading-relaxed italic">
                                                <InformationCircle className="w-3 h-3 inline mr-1" />
                                                控制创作随机性。值越高越有“创意”，值越低越严谨、稳定。
                                            </p>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="block text-[10px] font-black text-sky-400 flex justify-between uppercase">
                                                <span>核采样 (Top P): {topP}</span>
                                            </label>
                                            <input type="range" min="0" max="1" step="0.05" value={topP} onChange={e => setTopP(parseFloat(e.target.value))} className="w-full h-1 bg-sky-100 rounded-lg appearance-none cursor-pointer accent-sky-500" />
                                            <p className="text-[10px] text-gray-400 leading-relaxed italic">
                                                <InformationCircle className="w-3 h-3 inline mr-1" />
                                                控制词汇多样性。值越高选词越丰富，值越低则更倾向于常用、稳妥的词汇。
                                            </p>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="block text-[10px] font-black text-sky-400 flex justify-between uppercase">
                                                <span>最大长度 (Max Tokens): {maxOutputTokens}</span>
                                            </label>
                                            <input type="range" min="1024" max="16384" step="1024" value={maxOutputTokens} onChange={e => setMaxOutputTokens(parseInt(e.target.value))} className="w-full h-1 bg-sky-100 rounded-lg appearance-none cursor-pointer accent-sky-500" />
                                            <p className="text-[10px] text-gray-400 leading-relaxed italic">
                                                <InformationCircle className="w-3 h-3 inline mr-1" />
                                                控制生成内容的最大长度。
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400 font-bold text-sm uppercase tracking-wider">
                                <div className="p-1.5 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                                    <Sparkles className="w-4 h-4" />
                                </div>
                                提示词与素材
                            </div>
                            <div className="grid grid-cols-2 gap-3 font-sans">
                                <button onClick={() => setPromptModalOpen(true)} className={`p-3 rounded-2xl border transition-all flex flex-col items-center gap-2 ${selectedPrompt ? 'bg-purple-50 border-purple-300 text-purple-900 shadow-inner' : 'bg-white dark:bg-gray-900 border-gray-100 text-gray-500 hover:border-purple-300'}`}>
                                    <Search className="w-6 h-6 flex-shrink-0" />
                                    <span className="font-bold text-[11px] truncate w-full text-center">{selectedPrompt ? selectedPrompt.title : '选择提示词'}</span>
                                </button>
                                <button onClick={() => setAssetModalOpen(true)} className={`p-3 rounded-2xl border transition-all flex flex-col items-center gap-2 ${selectedAssetIds.size > 0 ? 'bg-purple-50 border-purple-300 text-purple-900 shadow-inner' : 'bg-white dark:bg-gray-900 border-gray-100 text-gray-500 hover:border-purple-300'}`}>
                                    <Database className="w-6 h-6 flex-shrink-0" />
                                    <span className="font-bold text-[11px] truncate w-full text-center">{selectedAssetIds.size > 0 ? selectedAssetNames : '关联素材'}</span>
                                </button>
                            </div>
                        </div>

                        <div className="space-y-4 font-sans">
                            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-sm uppercase tracking-wider">
                                <div className="p-1.5 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                                    <DocumentText className="w-4 h-4" />
                                </div>
                                创作内容
                            </div>
                            <div className="bg-emerald-50/20 dark:bg-emerald-900/5 p-4 rounded-2xl border border-emerald-100/50 space-y-5">
                                {selectedPrompt ? (
                                    <div className="space-y-5 animate-fade-in">
                                        {selectedPrompt.fields.map((f, i) => (
                                            <div key={f.id} className="space-y-2">
                                                <div className="flex justify-between items-center mr-1">
                                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 ml-1">
                                                        {i+1}. {f.label}
                                                        {f.required !== false ? (
                                                            <span className="ml-1 text-red-500 font-normal">* (必填)</span>
                                                        ) : (
                                                            <span className="ml-1 text-gray-400 font-normal"> (选填)</span>
                                                        )}
                                                    </label>
                                                    {f.maxLength && (
                                                        <span className={`text-[10px] ${(formState[f.id]?.length || 0) > f.maxLength ? 'text-red-500 font-bold' : 'text-gray-400'}`}>
                                                            {formState[f.id]?.length || 0} / {f.maxLength}
                                                        </span>
                                                    )}
                                                </div>
                                                {f.type === 'textarea' ? (
                                                    <textarea 
                                                        value={formState[f.id] || ''} 
                                                        onChange={e => setFormState({...formState, [f.id]: e.target.value})} 
                                                        placeholder={f.placeholder} 
                                                        maxLength={f.maxLength}
                                                        className="w-full p-3 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm min-h-[100px] shadow-sm transition-all font-sans" 
                                                    />
                                                ) : (
                                                    <input 
                                                        type="text" 
                                                        value={formState[f.id] || ''} 
                                                        onChange={e => setFormState({...formState, [f.id]: e.target.value})} 
                                                        placeholder={f.placeholder} 
                                                        maxLength={f.maxLength}
                                                        className="w-full p-3 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm shadow-sm transition-all font-sans" 
                                                    />
                                                )}
                                                {f.description && <p className="text-[10px] text-blue-600 dark:text-blue-400 font-bold mt-1.5 ml-1 leading-relaxed">💡 {f.description}</p>}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <textarea value={freeInput} onChange={e => setFreeInput(e.target.value)} placeholder="请输入您的创作灵感或详细要求..." className="w-full h-40 p-4 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm resize-none shadow-sm transition-all font-sans" />
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="p-3 border-t bg-white dark:bg-gray-900 font-sans">
                        <button onClick={handleGenerate} className={`w-full py-2 rounded-2xl font-black text-white shadow-xl flex items-center justify-center gap-2 transition-all active:scale-95 ${isGenerating ? 'bg-rose-500 shadow-rose-500/20' : 'bg-sky-600 hover:bg-sky-500 shadow-sky-500/20'}`}>
                            {isGenerating ? <><Stop className="w-5 h-5" />停止生成</> : <><Sparkles className="w-5 h-5" />开始创作</>}
                        </button>
                    </div>
                </div>

                <div className="flex-1 bg-gray-50 dark:bg-black/50 flex flex-col items-center overflow-hidden font-sans">
                    <div className="w-full max-w-5xl bg-white dark:bg-gray-900 h-full shadow-sm border-x border-gray-100 dark:border-gray-800 flex flex-col relative overflow-hidden font-sans">
                        {!generatedText && !isWaitingForFirstChunk ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 opacity-50 p-8"><Sparkles className="w-20 h-20 mb-6" /><p className="text-lg font-medium">在左侧输入灵感，开启 AI 创作之旅</p></div>
                        ) : (
                            <>
                                <div className="flex-shrink-0 bg-white dark:bg-gray-900 px-8 py-4 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center z-10 font-sans">
                                    <div className="flex items-center gap-2 text-gray-900 dark:text-white font-bold text-lg">
                                        <Sparkles className="w-5 h-5 text-sky-500" />
                                        <span>生成结果</span>
                                        {showInlineSuccess && (
                                            <span className="ml-3 text-xs font-bold text-emerald-500 animate-fade-in flex items-center gap-1">
                                                <Check className="w-3.5 h-3.5" /> {successMessage}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => { navigator.clipboard.writeText(generatedText); setSuccessMessage('已复制'); setShowInlineSuccess(true); setTimeout(()=>setShowInlineSuccess(false),3000); }} className="flex items-center gap-1.5 text-sm font-bold px-4 py-2 rounded-lg bg-sky-100 text-sky-700 hover:bg-sky-200 transition-colors font-sans"><Copy className="w-4 h-4" /> 复制</button>
                                        <button onClick={() => setImportModalOpen(true)} className="flex items-center gap-1.5 text-sm font-bold px-4 py-2 rounded-lg bg-purple-100 text-purple-700 hover:bg-purple-200 transition-colors font-sans"><Database className="w-4 h-4" /> 导入素材库</button>
                                    </div>
                                </div>
                                <div className="flex-1 overflow-y-auto px-10 py-8 relative font-sans" ref={scrollContainerRef}>
                                    {isWaitingForFirstChunk && (
                                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/60 dark:bg-gray-900/60 backdrop-blur-sm z-10 animate-fade-in font-sans">
                                            <div className="w-12 h-12 border-4 border-sky-200 border-t-sky-600 rounded-full animate-spin mb-4"></div>
                                            <p className="text-sky-600 font-bold text-sm animate-pulse tracking-widest">AI 思考中...</p>
                                        </div>
                                    )}
                                    <FormattedText text={generatedText} />
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CreativeGeneration;
