
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { generateTextStream } from '../services/geminiService';
import { ChatBubbleOvalLeftEllipsis, X, Stop, Sparkles, Plus, ArrowPath, Copy, Box, Pencil } from './Icon';
import PromptSelectionModal from './PromptSelectionModal';
import { Prompt } from '../types';
import CustomSelect from './CustomSelect';

interface FollowUpModalProps {
    isOpen: boolean;
    onClose: () => void;
    targetText: string;
    context: string;
    initialMode: 'selection' | 'full';
    onApply: (text: string, type: 'insert' | 'replace') => void;
    rewriteMode?: boolean;
}

const FollowUpModal: React.FC<FollowUpModalProps> = ({ isOpen, onClose, targetText, context, initialMode, onApply, rewriteMode }) => {
    const [query, setQuery] = useState('');
    const [result, setResult] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [activeMode, setActiveMode] = useState<'selection' | 'full'>(initialMode);
    
    // Modal specific model settings
    const [modalModel, setModalModel] = useState('deepseek-chat');
    const [isPromptModalOpen, setPromptModalOpen] = useState(false);
    
    const abortControllerRef = useRef<AbortController | null>(null);

    useEffect(() => {
        if (isOpen) {
            setQuery('');
            setResult('');
            setIsGenerating(false);
            setActiveMode(targetText ? initialMode : 'full');
        }
    }, [isOpen, targetText, initialMode]);

    const handleGenerate = async () => {
        if (!query.trim()) return; 
        
        setIsGenerating(true);
        setResult('');
        
        const controller = new AbortController();
        abortControllerRef.current = controller;

        let prompt = '';
        const systemInstruction = "IMPORTANT: You are a creative writing assistant. Output ONLY the requested text content. Do NOT include conversational fillers like 'Here is the rewrite', 'Sure', 'Okay', or markdown code blocks unless explicitly asked for code.";

        if (activeMode === 'selection') {
            prompt = `${systemInstruction}
请基于下方的【全文背景】和用户【选中的文本片段】，回答用户的【追问/指令】。
你的回答必须针对选中的内容进行处理，同时不脱离全文设定的背景。
请直接输出修改后或生成的正文内容，不要有任何多余的废话。

${rewriteMode ? '【特别指令】：你现在处于“AI改写”模式。请根据用户的补充要求，对选中的文本进行改写，确保改写后的内容与前文和后文衔接自然，且保持原有的剧本格式。' : ''}

【全文背景】：
${context.slice(0, 3000)}${context.length > 3000 ? '...' : ''}

【选中的文本片段】：
${targetText}

【用户的追问/指令】：
${query}`;
        } else {
            prompt = `${systemInstruction}
请基于下方的【当前内容】，回答用户的【追问/指令】。
你的回答应当是对当前内容的补充、解释或修改建议。
请直接输出结果正文，不要有任何多余的废话。

【当前内容】：
${context.slice(0, 3000)}${context.length > 3000 ? '...' : ''}

【用户的追问/指令】：
${query}`;
        }

        try {
            const stream = generateTextStream(prompt, {
                model: modalModel,
                temperature: 0.8,
                topP: 0.95,
                signal: controller.signal
            });

            for await (const chunk of stream) {
                setResult(prev => prev + chunk);
            }
        } catch (e: any) {
            if (e.message !== 'Aborted') {
                setResult(`生成出错: ${e.message}`);
            }
        } finally {
            setIsGenerating(false);
            abortControllerRef.current = null;
        }
    };

    const handleStop = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
        setIsGenerating(false);
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(result);
    };

    const handlePromptSelect = (prompt: Prompt) => {
        setQuery(prev => (prev ? prev + '\n' : '') + `[任务：${prompt.title}] ${prompt.description}`);
        setPromptModalOpen(false);
    }

    const MODEL_OPTIONS = [
        { value: 'gemini-4-hydrogen', label: 'Gemini 4 Hydrogen' },
        { value: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash Lite' },
        { value: 'deepseek-chat', label: 'DeepSeek V3' }
    ];

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
            {isPromptModalOpen && (
                <div style={{zIndex: 110}}>
                    <PromptSelectionModal isOpen={true} onClose={() => setPromptModalOpen(false)} onSelect={handlePromptSelect} />
                </div>
            )}
            
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[85vh] animate-fade-in-up font-sans" onClick={e => e.stopPropagation()}>
                <div className="flex-shrink-0 p-4 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        {rewriteMode ? <Pencil className="w-5 h-5 text-sky-500" /> : <ChatBubbleOvalLeftEllipsis className="w-5 h-5 text-sky-500" />}
                        {rewriteMode ? 'AI 智能改写' : 'AI 智能追问'}
                    </h3>
                    <button type="button" onClick={onClose} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors text-gray-400">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                    <div className="flex gap-2 items-center">
                        <div className="w-48">
                            <CustomSelect 
                                value={modalModel} 
                                onChange={setModalModel} 
                                options={MODEL_OPTIONS}
                            />
                        </div>

                        <div className="flex p-1 bg-gray-100 dark:bg-gray-800 rounded-lg flex-1 h-[34px]">
                            <button
                                onClick={() => setActiveMode('full')}
                                className={`flex-1 text-xs font-bold rounded-md transition-all flex items-center justify-center ${activeMode === 'full' ? 'bg-white dark:bg-gray-700 text-sky-600 dark:text-sky-400 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
                            >
                                全文/本段
                            </button>
                            <button
                                onClick={() => setActiveMode('selection')}
                                disabled={!targetText}
                                className={`flex-1 text-xs font-bold rounded-md transition-all flex items-center justify-center ${activeMode === 'selection' ? 'bg-white dark:bg-gray-700 text-sky-600 dark:text-sky-400 shadow-sm' : 'text-gray-500 dark:text-gray-400'} ${!targetText ? 'opacity-50 cursor-not-allowed' : 'hover:text-gray-900 dark:hover:text-white'}`}
                            >
                                针对选中
                            </button>
                        </div>
                    </div>

                    {activeMode === 'selection' && (
                        <div className="bg-gray-50 dark:bg-gray-800/50 p-3 rounded-xl border border-gray-100 dark:border-gray-800">
                            <div className="text-[10px] font-bold text-gray-400 uppercase mb-1">已选中文本</div>
                            <div className="text-xs text-gray-600 dark:text-gray-300 line-clamp-3 italic">
                                “{targetText}”
                            </div>
                        </div>
                    )}

                    <div className="space-y-2">
                            <textarea 
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                                placeholder={rewriteMode 
                                    ? "请输入改写要求，例如：让这段对话更幽默一点..." 
                                    : (activeMode === 'selection' 
                                        ? "请输入针对选中文本的追问或修改指令..." 
                                        : "请输入针对全文/本段的追问...")}
                                className="w-full h-24 p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-sky-500 outline-none text-sm resize-none"
                            />
                        <div className="flex justify-between items-center">
                            <button onClick={() => setPromptModalOpen(true)} className="text-xs text-sky-600 hover:text-sky-500 font-bold flex items-center gap-1">
                                <Box className="w-3.5 h-3.5" /> 引用提示词
                            </button>
                            {isGenerating ? (
                                <button type="button" onClick={handleStop} className="px-4 py-2 bg-red-50 text-red-600 rounded-lg text-xs font-bold hover:bg-red-100 transition-colors flex items-center gap-1">
                                    <Stop className="w-3.5 h-3.5" /> 停止
                                </button>
                            ) : (
                                <button type="button" onClick={handleGenerate} disabled={!query.trim()} className="px-4 py-2 bg-sky-600 text-white rounded-lg text-xs font-bold hover:bg-sky-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1">
                                    <Sparkles className="w-3.5 h-3.5" /> {rewriteMode ? '开始改写' : '发送追问'}
                                </button>
                            )}
                        </div>
                    </div>

                    {result && (
                        <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-gray-800 animate-fade-in">
                            <div className="flex justify-between items-center">
                                <span className="text-xs font-bold text-sky-600 dark:text-sky-400">AI 回复</span>
                            </div>
                            <div className="p-4 bg-sky-50/30 dark:bg-sky-900/10 rounded-xl text-sm text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-wrap">
                                {result}
                            </div>
                            {!isGenerating && (
                                <div className="flex gap-2 justify-end pt-1">
                                    <button 
                                        onClick={() => { onApply(result, 'insert'); onClose(); }}
                                        className="px-3 py-1.5 bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400 rounded-lg text-xs font-bold hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors flex items-center gap-1"
                                    >
                                        <Plus className="w-3.5 h-3.5" /> 插入正文
                                    </button>
                                    {activeMode === 'selection' && (
                                        <button 
                                            onClick={() => { onApply(result, 'replace'); onClose(); }}
                                            className="px-3 py-1.5 bg-orange-50 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400 rounded-lg text-xs font-bold hover:bg-orange-100 dark:hover:bg-orange-900/30 transition-colors flex items-center gap-1"
                                        >
                                            <ArrowPath className="w-3.5 h-3.5" /> 替换原文
                                        </button>
                                    )}
                                    <button 
                                        onClick={handleCopy}
                                        className="px-3 py-1.5 bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 rounded-lg text-xs font-bold hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors flex items-center gap-1"
                                    >
                                        <Copy className="w-3.5 h-3.5" /> 复制
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
};

export default FollowUpModal;
