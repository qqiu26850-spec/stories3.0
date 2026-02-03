
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { CREATIVE_MODULES } from '../constants';
import CreativeCard from './CreativeCard';
import { CreativeModule, Asset, Prompt } from '../types';
import { generateTextStream } from '../services/geminiService';
import { ChevronDoubleLeft, Sparkles, Copy, Database, AdjustmentsHorizontal, Search, DocumentText, X, BookOpen, ChevronDown, Check, Stop, InformationCircle, ArrowPath, Play } from './Icon';
import PromptSelectionModal from './PromptSelectionModal';
import AssetSelectionModal from './AssetSelectionModal'; 
import { saveMaterial, incrementPromptHeat, fetchMaterials } from '../services/supabaseService';
import LoadingOverlay from './LoadingOverlay';
import ImportAssetModal from './ImportAssetModal';
import CustomSelect from './CustomSelect';

interface CreativeGenerationProps {
  initialData?: {
    prompt?: Prompt;
    values?: Record<string, string>;
  };
  onClearInitialData?: () => void;
}

// 修改：增加更严格的“纯净输出”指令，禁止角色扮演式的开场白
const FORCE_LONG_INSTRUCTION = "\n\n【重要指令】：\n1. 请尽可能详细、深入地撰写，展开环境、心理、动作等细节。\n2. **严禁输出**任何与正文无关的对话填充内容（如：“你好！我是xx大神”、“根据您的要求...”、“以下是为您生成的...”等）。\n3. **直接输出**创作内容本身，不要有开场白或结束语。\n4. 请充分利用输出长度限制，生成长篇幅的完整内容。";

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

// 辅助函数：清洗 Placeholder，移除英文和变量符号
const cleanPlaceholder = (text: string | undefined, label: string) => {
    if (!text) return `请输入${label}...`;
    let cleaned = text.replace(/\$\{[^}]+\}/g, '');
    cleaned = cleaned.replace(/[a-zA-Z]/g, '');
    cleaned = cleaned.trim();
    cleaned = cleaned.replace(/^[:：]\s*/, '');
    if (!/[\u4e00-\u9fa50-9]/.test(cleaned)) {
         return `请输入${label}...`;
    }
    return cleaned;
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
    
    // 新增：用于存储上一次完整的 Prompt，以便在“继续生成”时保持上下文一致性
    const lastPromptRef = useRef<string>('');
    const abortControllerRef = useRef<AbortController | null>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const isUserScrollingRef = useRef(false);

    // 判断文本是否被截断（非自然结尾）
    const isLikelyTruncated = useMemo(() => {
        if (!generatedText) return false;
        const trimmed = generatedText.trim();
        const endingPunctuation = /[.!?;:。”！？…—~】]$/;
        return !endingPunctuation.test(trimmed);
    }, [generatedText]);

    useEffect(() => {
        if (assetModalOpen) {
            const loadAssets = async () => {
                const data = await fetchMaterials();
                setAssets(data.map((item: any) => ({
                    id: item.id, name: item.name, type: item.type === 'idea' ? 'inspiration' : item.type, content: item.content, tags: item.tags || []
                })));
            };
            loadAssets();
        }
    }, [assetModalOpen]);

    useEffect(() => {
        const loadAssets = async () => {
            const data = await fetchMaterials();
            setAssets(data.map((item: any) => ({
                id: item.id, name: item.name, type: item.type === 'idea' ? 'inspiration' : item.type, content: item.content, tags: item.tags || []
            })));
        };
        loadAssets();
    }, []);

    const selectedAssetNames = useMemo(() => Array.from(selectedAssetIds).map(id => assets.find(a => a.id === id)?.name).filter(Boolean).join(', '), [selectedAssetIds, assets]);

    useEffect(() => {
        if (isGenerating && !isUserScrollingRef.current && scrollContainerRef.current) {
            scrollContainerRef.current.scrollTo({ top: scrollContainerRef.current.scrollHeight, behavior: 'auto' });
        }
    }, [generatedText, isGenerating]);

    const handleScroll = () => {
        if (scrollContainerRef.current) {
            const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
            const isAtBottom = scrollHeight - scrollTop - clientHeight <= 50;
            isUserScrollingRef.current = !isAtBottom;
        }
    };

    const handleStop = () => {
        if (abortControllerRef.current) abortControllerRef.current.abort();
        setIsGenerating(false);
        setIsWaitingForFirstChunk(false);
        setShowLoadingOverlay(false);
    };

    const resetState = () => {
        setFormState({});
        setFreeInput('');
        setGeneratedText('');
        setSelectedPrompt(null);
        setSelectedAssetIds(new Set());
        setSuccessMessage('');
        setIsGenerating(false);
        setIsWaitingForFirstChunk(false);
        isUserScrollingRef.current = false;
        lastPromptRef.current = '';
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
    };

    const handleSelectModule = (m: CreativeModule) => {
        resetState();
        setSelectedModule(m);
    };

    const handleExitModule = () => {
        resetState();
        setSelectedModule(null);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, fieldId: string) => {
        if (e.target.files && e.target.files.length > 0) {
            const files = Array.from(e.target.files);
            const readers = files.map((file: File) => {
                return new Promise<string>((resolve) => {
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                        resolve(`【文件: ${file.name}】\n${ev.target?.result as string}\n`);
                    };
                    reader.readAsText(file);
                });
            });

            Promise.all(readers).then(contents => {
                setFormState(prev => ({
                    ...prev,
                    [fieldId]: (prev[fieldId] || '') + contents.join('\n')
                }));
            });
        }
    };

    const handleGenerate = async () => {
        if (isGenerating) { handleStop(); return; }
        setIsGenerating(true);
        setIsWaitingForFirstChunk(true);
        isUserScrollingRef.current = false;
        setGeneratedText('');
        
        let basePrompt = selectedPrompt ? selectedPrompt.template : freeInput;
        if (selectedPrompt) {
            incrementPromptHeat(selectedPrompt.id);
            selectedPrompt.fields.forEach(f => basePrompt = basePrompt.replace(new RegExp(`\\$\\{${f.id}\\}`, 'g'), formState[f.id] || ''));
        }
        const assetContext = Array.from(selectedAssetIds).map(id => assets.find(a => a.id === id)).filter(Boolean).map(a => `【参考：${a!.name}】\n${a!.content}`).join('\n\n');
        
        let finalPrompt = assetContext ? `${assetContext}\n\n---\n\n${basePrompt}` : basePrompt;
        
        // 保存原始 Prompt 以便续写使用
        lastPromptRef.current = finalPrompt;

        // Append verbose instruction
        finalPrompt += FORCE_LONG_INSTRUCTION;

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

    const handleContinue = async () => {
        if (isGenerating) return;
        setIsGenerating(true);
        isUserScrollingRef.current = false;
        
        // 关键修改：续写时必须带上原始 Prompt，确保 AI 知道自己在写什么（例如：是在写大纲还是正文）
        // 否则 AI 容易忘记上下文，开始瞎编正文
        const originalInstruction = lastPromptRef.current;
        
        // 取末尾 3000 字作为上下文衔接
        const tailContext = generatedText.slice(-3000); 
        
        const continuePrompt = `
${originalInstruction}

---
【系统提示】：
上文输出因长度限制被中断。请严格基于上方【原始指令】的要求，紧接着下方的【已生成内容末尾】，继续生成剩余内容。
请保持与上文完全一致的输出格式、风格、人称和逻辑。
**不要重复**下方已提供的内容，直接无缝接续。

【已生成内容末尾】：
${tailContext}

${FORCE_LONG_INSTRUCTION}
`;

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
        } catch (e) {
            console.error("Continue generation failed", e);
        } finally { 
            setIsGenerating(false); 
        }
    };

    const handleImportAsset = (data: { name: string; type: Asset['type']; tags: string[]; content: string }) => {
        saveMaterial(data.name, data.content, data.type === 'inspiration' ? 'idea' : data.type, data.tags);
        setSuccessMessage('已导入素材库');
        setShowInlineSuccess(true);
        setTimeout(() => setShowInlineSuccess(false), 3000);
    };

    const MODEL_OPTIONS = [
        { value: "deepseek-chat", label: "奇思版 (DeepSeek)" },
        { value: "gemini-3-flash-preview", label: "妙写版 (Gemini 3.0 Flash)" },
        { value: "gemini-3-pro-preview", label: "深度版 (Gemini 3.0 Pro)" }, // 新增
        { value: "doubao-flash", label: "速写版 (豆包)" }
    ];

    if (!selectedModule) {
        return (
            <div className="p-8 h-full animate-fade-in font-sans">
                <div className="mb-8"><h1 className="text-3xl font-bold text-gray-900 dark:text-white">创意生成</h1></div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {CREATIVE_MODULES.map(m => <CreativeCard key={m.id} module={m} onSelect={() => handleSelectModule(m)} />)}
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
                    <button onClick={handleExitModule} className="p-2 rounded-full hover:bg-gray-100 text-gray-500"><ChevronDoubleLeft className="w-5 h-5" /></button>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">{selectedModule.title}</h2>
                </div>
            </div>

            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
                {/* 修改：减少左侧栏宽度，约减少 1/7 */}
                <div className="w-full lg:w-[370px] xl:w-[410px] flex flex-col border-r border-gray-200 bg-white dark:bg-gray-900 overflow-hidden z-10 [scrollbar-gutter:stable] font-sans">
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
                                        <CustomSelect 
                                            value={model} 
                                            onChange={setModel} 
                                            options={MODEL_OPTIONS}
                                        />
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
                                                {f.type === 'file' ? (
                                                    <div className="w-full p-3 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl transition-all font-sans">
                                                        <input 
                                                            type="file"
                                                            multiple
                                                            accept=".txt,.md,.json,.csv"
                                                            onChange={(e) => handleFileChange(e, f.id)}
                                                            className="block w-full text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
                                                        />
                                                        {formState[f.id] && (
                                                            <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-900 rounded text-[10px] text-gray-600 dark:text-gray-400 truncate">
                                                                已加载内容 (预览): {formState[f.id].substring(0, 50)}...
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : f.type === 'textarea' ? (
                                                    <textarea 
                                                        value={formState[f.id] || ''} 
                                                        onChange={e => setFormState({...formState, [f.id]: e.target.value})} 
                                                        placeholder={cleanPlaceholder(f.placeholder, f.label)} 
                                                        maxLength={f.maxLength}
                                                        className="w-full p-3 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm min-h-[100px] shadow-sm transition-all font-sans" 
                                                    />
                                                ) : (
                                                    <input 
                                                        type="text" 
                                                        value={formState[f.id] || ''} 
                                                        onChange={e => setFormState({...formState, [f.id]: e.target.value})} 
                                                        placeholder={cleanPlaceholder(f.placeholder, f.label)} 
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

                    <div className="p-2 border-t bg-white dark:bg-gray-900 font-sans">
                        <button onClick={handleGenerate} className={`w-full py-2 rounded-2xl font-black text-white shadow-xl flex items-center justify-center gap-2 transition-all active:scale-95 ${isGenerating ? 'bg-rose-500 shadow-rose-500/20' : 'bg-sky-600 hover:bg-sky-50 shadow-sky-500/20'}`}>
                            {isGenerating ? <><Stop className="w-5 h-5" />停止生成</> : <><Sparkles className="w-5 h-5" />开始创作</>}
                        </button>
                    </div>
                </div>

                <div className="flex-1 bg-gray-50 dark:bg-black/50 flex flex-col overflow-hidden font-sans">
                    <div className="w-full bg-white dark:bg-gray-900 h-full shadow-sm flex flex-col relative overflow-hidden font-sans">
                        {!generatedText && !isWaitingForFirstChunk ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 opacity-50 p-8"><Sparkles className="w-20 h-20 mb-6" /><p className="text-lg font-medium">在左侧输入灵感，开启 AI 创作之旅</p></div>
                        ) : (
                            <>
                                {/* 修改：减少顶部栏高度，padding 从 py-4 改为 py-3 */}
                                <div className="flex-shrink-0 bg-white dark:bg-gray-900 px-8 py-3 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center z-10 font-sans">
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
                                <div className="flex-1 overflow-y-auto px-10 py-8 relative font-sans scroll-smooth" ref={scrollContainerRef} onScroll={handleScroll}>
                                    {isWaitingForFirstChunk && (
                                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/60 dark:bg-gray-900/60 backdrop-blur-sm z-10 animate-fade-in font-sans">
                                            <div className="w-12 h-12 border-4 border-sky-200 border-t-sky-600 rounded-full animate-spin mb-4"></div>
                                            <p className="text-sky-600 font-bold text-sm animate-pulse tracking-widest">AI 思考中...</p>
                                        </div>
                                    )}
                                    <FormattedText text={generatedText} />
                                    {/* Smart Continue/Regenerate Button */}
                                    {!isGenerating && generatedText && (
                                        <div className="mt-8 mb-4 flex justify-center animate-fade-in">
                                            {isLikelyTruncated ? (
                                                <button 
                                                    onClick={handleContinue}
                                                    className="px-6 py-2.5 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-full shadow-lg hover:shadow-sky-500/30 flex items-center gap-2 transition-all active:scale-95 text-sm"
                                                >
                                                    <Play className="w-4 h-4" /> 继续生成 (内容截断)
                                                </button>
                                            ) : (
                                                <button 
                                                    onClick={handleGenerate}
                                                    className="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold rounded-full shadow-sm hover:shadow-md flex items-center gap-2 transition-all active:scale-95 text-sm"
                                                >
                                                    <ArrowPath className="w-4 h-4" /> 重新生成
                                                </button>
                                            )}
                                        </div>
                                    )}
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
