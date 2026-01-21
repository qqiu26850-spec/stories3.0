
import React, { useState, useEffect, useRef } from 'react';
import { Workflow, Asset, Prompt } from '../types';
import { generateTextStream } from '../services/geminiService';
import { Sparkles, ChevronDoubleLeft, AdjustmentsHorizontal, Check, Copy, Stop, ArrowPath, Play, Database, ChatBubbleOvalLeftEllipsis, DocumentPlus, X } from './Icon';
import ImportAssetModal from './ImportAssetModal';
import SaveToCreationModal from './SaveToCreationModal';
import { saveMaterial } from '../services/supabaseService';
import FollowUpModal from './FollowUpModal';
import CustomSelect from './CustomSelect';

interface WorkflowRunProps {
    workflow: Workflow;
    onBack: () => void;
}

const FORCE_LONG_INSTRUCTION = "\n\n【重要指令】：请尽可能详细、深入地撰写，展开环境、心理、动作等细节，严禁省略或概括。请充分利用输出长度限制，生成长篇幅的完整内容。";

const stripMarkdown = (text: string) => {
    return text
        .replace(/#+\s/g, '')
        .replace(/\*\*|\*/g, '')
        .replace(/>\s/g, '')
        .replace(/!\[.*?\]\(.*?\)/g, '')
        .replace(/\[(.*?)\]\(.*?\)/g, '$1')
        .replace(/`{1,3}.*?`{1,3}/gs, '')
        .replace(/<think>[\s\S]*?<\/think>/g, '')
        .trim();
};

const escapeHtml = (text: string) => {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
};

const convertMarkdownToHtml = (text: string) => {
    const cleanedText = text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
    
    return cleanedText.split('\n').map(line => {
        let content = line.trim();
        if (!content) return '<p><br></p>';
        
        let isHeader = false;
        if (content.startsWith('#')) {
            const match = content.match(/^(#+)\s*(.*)/);
            if (match) {
                content = match[2];
                isHeader = true;
            }
        }
        
        content = escapeHtml(content);
        content = content.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
        
        if (isHeader) {
            return `<p><b>${content}</b></p>`;
        }
        return `<p>${content}</p>`;
    }).join('');
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
                        if (level === 1) className += "text-base mt-4 mb-2";
                        else if (level === 2) className += "text-sm mt-3 mb-1.5";
                        else className += "text-xs mt-2 mb-1";
                        
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

// Simple Loading Overlay for WorkflowRun to replace the external component if needed or use the existing one if compatible
const LoadingOverlay: React.FC<{ isVisible: boolean; onClose: () => void }> = ({ isVisible, onClose }) => {
    const [seconds, setSeconds] = useState(0);

    useEffect(() => {
        let interval: any;
        if (isVisible) {
            setSeconds(0);
            interval = setInterval(() => {
                setSeconds(s => s + 1);
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [isVisible]);

    useEffect(() => {
        if (isVisible && seconds >= 10) {
            onClose();
        }
    }, [seconds, isVisible, onClose]);

    if (!isVisible) return null;

    return (
        <div className="absolute inset-0 z-50 flex items-center justify-center">
            <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 w-80 text-center mx-4 animate-fade-in-up relative">
                <button 
                    onClick={onClose}
                    className="absolute top-2 right-2 p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    title="关闭/取消"
                >
                    <X className="w-5 h-5" />
                </button>

                <div className="relative w-12 h-12 mx-auto mb-4">
                    <div className="absolute inset-0 border-2 border-gray-100 dark:border-gray-800 rounded-full"></div>
                    <div className="absolute inset-0 border-2 border-sky-500 rounded-full border-t-transparent animate-spin"></div>
                    <Sparkles className="absolute inset-0 w-5 h-5 m-auto text-sky-500 animate-pulse" />
                </div>
                
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">AI 正在创作...</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-mono mb-4">已耗时: {seconds} 秒</p>
                <p className="text-xs text-gray-400">弹窗将在 10 秒后自动关闭</p>
            </div>
        </div>
    );
};

const WorkflowRun: React.FC<WorkflowRunProps> = ({ workflow, onBack }) => {
    const [model, setModel] = useState('deepseek-chat');
    const modelRef = useRef(model);
    const [temperature, setTemperature] = useState(0.8);
    const [topP, setTopP] = useState(0.95);
    const [maxOutputTokens, setMaxOutputTokens] = useState(8192);
    const [showConfig, setShowConfig] = useState(true);

    const [formState, setFormState] = useState<Record<string, string>>({});
    const [stepResults, setStepResults] = useState<Record<string, string>>({});
    const [currentStepIndex, setCurrentStepIndex] = useState<number | null>(null);
    const [nextStepIndex, setNextStepIndex] = useState<number>(0);
    const [executionStatus, setExecutionStatus] = useState<'idle' | 'running' | 'paused' | 'completed'>('idle');
    const [isLoading, setIsLoading] = useState(false);
    const [showOverlay, setShowOverlay] = useState(false);
    const [error, setError] = useState('');
    
    const [importModalOpen, setImportModalOpen] = useState(false);
    const [importContent, setImportContent] = useState('');
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    
    const [activeFollowUp, setActiveFollowUp] = useState<{ target: string; context: string; variable: string; initialMode: 'selection' | 'full' } | null>(null);
    
    const [saveModalOpen, setSaveModalOpen] = useState(false);
    const [saveModalContent, setSaveModalContent] = useState('');

    const abortControllerRef = useRef<AbortController | null>(null);
    const resultRefs = useRef<Record<string, HTMLDivElement | null>>({});

    useEffect(() => {
        modelRef.current = model;
    }, [model]);

    const triggerSuccess = (msg: string) => {
        setSuccessMessage(msg);
        setTimeout(() => setSuccessMessage(null), 3000);
    };

    const handleImportAsset = async (data: { name: string; type: Asset['type']; tags: string[]; content: string }) => {
        await saveMaterial(data.name, data.content, data.type === 'inspiration' ? 'idea' : data.type, data.tags);
        triggerSuccess('素材已导入');
    };

    const handleOpenSaveModal = (text: string) => {
        setSaveModalContent(convertMarkdownToHtml(text));
        setSaveModalOpen(true);
    };

    const handleTriggerFollowUp = (stepContent: string, variable: string) => {
        const selection = window.getSelection();
        let text = '';
        if (selection && selection.toString().trim()) {
            text = selection.toString().trim();
        }
        
        setActiveFollowUp({
            target: text,
            context: stepContent,
            variable: variable,
            initialMode: text ? 'selection' : 'full'
        });
    };

    const handleApplyFollowUpResult = (newText: string, type: 'insert' | 'replace') => {
        if (!activeFollowUp) return;

        setStepResults(prev => {
            const currentContent = prev[activeFollowUp.variable] || '';
            let updatedContent = currentContent;

            if (type === 'replace' && activeFollowUp.target) {
                updatedContent = currentContent.replace(activeFollowUp.target, newText);
            } else {
                if (activeFollowUp.target && currentContent.includes(activeFollowUp.target)) {
                     const parts = currentContent.split(activeFollowUp.target);
                     updatedContent = parts[0] + activeFollowUp.target + '\n' + newText + parts.slice(1).join(activeFollowUp.target);
                } else {
                    updatedContent = currentContent + '\n\n' + newText;
                }
            }
            return { ...prev, [activeFollowUp.variable]: updatedContent };
        });
        
        triggerSuccess('内容已更新');
        setActiveFollowUp(null);
    };

    const handleStop = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
        setIsLoading(false);
        setShowOverlay(false);
        setExecutionStatus('paused');
    };

    const handleRunWorkflow = async (startIndex: number = 0) => {
        const steps = workflow.steps || [];
        if (steps.length === 0) {
            setError('该工作流没有定义执行步骤。');
            return;
        }

        // If starting from the beginning, clear all previous results
        if (startIndex === 0) {
            setStepResults({});
            setExecutionStatus('running'); // Reset status immediately to show active UI
            setError('');
        }

        setIsLoading(true);
        if (startIndex > 0) setExecutionStatus('running');
        setError('');
        
        const currentContext: Record<string, string> = { ...formState, ...stepResults };
        const controller = new AbortController();
        abortControllerRef.current = controller;

        try {
            for (let i = startIndex; i < steps.length; i++) {
                if (controller.signal.aborted) break;
                
                const step = steps[i];
                setCurrentStepIndex(i);

                let finalPrompt = step.prompt;
                Object.keys(currentContext).forEach(key => {
                    finalPrompt = finalPrompt.split(`\${${key}}`).join(currentContext[key] || '');
                });

                // Append Force Long Instruction
                finalPrompt += FORCE_LONG_INSTRUCTION;

                let stepContent = '';
                const stream = generateTextStream(finalPrompt, { 
                    model: modelRef.current, 
                    temperature, 
                    topP, 
                    maxOutputTokens, 
                    signal: controller.signal 
                });
                
                for await (const chunk of stream) {
                    stepContent += chunk;
                    setStepResults(prev => ({ ...prev, [step.outputVariable]: stepContent }));
                }

                if (!stepContent) {
                    stepContent = ""; 
                    setStepResults(prev => ({ ...prev, [step.outputVariable]: stepContent }));
                }

                currentContext[step.outputVariable] = stepContent;
                
                if (step.manualConfirmation && i < steps.length - 1) {
                    setNextStepIndex(i + 1);
                    setExecutionStatus('paused');
                    setIsLoading(false);
                    setCurrentStepIndex(null);
                    return; 
                }
            }
            if (!controller.signal.aborted) {
                setExecutionStatus('completed');
                setCurrentStepIndex(null);
                setNextStepIndex(0); 
            }
        } catch (e: any) {
            if (e.message !== 'Aborted') {
                setError(e.message || '生成失败');
                setExecutionStatus('paused');
                setNextStepIndex(startIndex); 
            }
        } finally {
            if (executionStatus !== 'paused') {
                setIsLoading(false);
            }
            abortControllerRef.current = null;
        }
    };

    const handleRegenerateStep = (stepIndex: number) => {
        handleRunWorkflow(stepIndex);
    };

    const handleContinue = () => {
        handleRunWorkflow(nextStepIndex);
    };

    const getStatusColor = (idx: number) => {
        if (currentStepIndex === idx) return 'bg-sky-500 text-white animate-pulse ring-2 ring-sky-500/20';
        if (idx < nextStepIndex || executionStatus === 'completed') return 'bg-emerald-500 text-white';
        return 'bg-gray-100 dark:bg-gray-800 text-gray-400';
    };

    const hasResults = Object.keys(stepResults).length > 0;

    const MODEL_OPTIONS = [
        { value: 'gemini-3-flash-preview', label: '谷歌极速 (Gemini 3 Flash)' },
        { value: 'gemini-3-pro-preview', label: '谷歌深度 (Gemini 3 Pro)' },
        { value: 'deepseek-chat', label: 'DeepSeek V3' },
        { value: 'deepseek-reasoner', label: 'DeepSeek R1 (推理)' }
    ];

    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-black/20 font-sans relative">
            <ImportAssetModal isOpen={importModalOpen} onClose={() => setImportModalOpen(false)} content={importContent} onSave={handleImportAsset} />
            
            <SaveToCreationModal 
                isOpen={saveModalOpen} 
                onClose={() => setSaveModalOpen(false)} 
                content={saveModalContent} 
                onSuccess={triggerSuccess} 
            />

            <FollowUpModal 
                isOpen={!!activeFollowUp} 
                onClose={() => setActiveFollowUp(null)} 
                targetText={activeFollowUp?.target || ''}
                context={activeFollowUp?.context || ''}
                initialMode={activeFollowUp?.initialMode || 'full'}
                onApply={handleApplyFollowUpResult}
            />
            
            {successMessage && (
                <div className="fixed top-20 right-8 z-50 px-4 py-2 bg-emerald-500 text-white rounded-lg shadow-lg animate-fade-in-up text-sm font-bold flex items-center gap-2">
                    <Check className="w-4 h-4" /> {successMessage}
                </div>
            )}

            {/* Top Bar */}
            <div className="flex items-center justify-between px-4 py-2 bg-sky-50/80 dark:bg-sky-900/10 border-b border-sky-100 dark:border-sky-800 flex-shrink-0 h-14 z-10">
                 <div className="flex items-center gap-3">
                    <button type="button" onClick={onBack} className="p-1.5 text-sky-600 hover:text-sky-700 hover:bg-sky-100 dark:text-sky-400 dark:hover:bg-sky-900/30 rounded-full transition-all">
                        <ChevronDoubleLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-base font-black text-sky-700 dark:text-sky-400 tracking-tight leading-tight">{workflow.title}</h1>
                    </div>
                 </div>
                 
                 <div className="flex items-center gap-2 overflow-x-auto no-scrollbar px-2">
                    {workflow.steps?.map((step, idx) => (
                        <div key={step.id} className="flex items-center gap-2">
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 transition-colors ${getStatusColor(idx)}`}>
                                {idx < nextStepIndex || executionStatus === 'completed' ? <Check className="w-3 h-3" /> : idx + 1}
                            </div>
                            <span className={`text-[10px] font-bold whitespace-nowrap hidden md:inline ${currentStepIndex === idx ? 'text-sky-600' : 'text-gray-400'}`}>
                                {step.name}
                            </span>
                            {idx < (workflow.steps?.length || 0) - 1 && <div className="w-3 h-0.5 bg-gray-200 dark:bg-gray-700" />}
                        </div>
                    ))}
                 </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-2 flex-1 overflow-hidden p-2">
                {/* Left Column: Config & Form */}
                <div className="lg:col-span-4 flex flex-col bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl shadow-sm overflow-hidden h-full">
                    {/* Scrollable Area */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: 'none' }}>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-2">
                                <h3 className="text-sm font-bold text-gray-800 dark:text-white flex items-center gap-2">
                                    <AdjustmentsHorizontal className="w-4 h-4 text-sky-500" />
                                    参数配置
                                </h3>
                                <button type="button" onClick={() => setShowConfig(!showConfig)} className="text-[10px] font-bold text-sky-500 hover:underline">
                                    {showConfig ? '收起' : '展开'}
                                </button>
                            </div>

                            {showConfig && (
                                <div className="space-y-3 animate-fade-in p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-700">
                                    <div>
                                        <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">模型</label>
                                        <CustomSelect 
                                            value={model} 
                                            onChange={setModel} 
                                            options={MODEL_OPTIONS}
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="block text-[10px] font-black text-sky-500 flex justify-between">
                                            <span>最大长度: {maxOutputTokens}</span>
                                        </label>
                                        <input type="range" min="1024" max="16384" step="1024" value={maxOutputTokens} onChange={e => setMaxOutputTokens(parseInt(e.target.value))} className="w-full h-1 bg-sky-200 rounded-lg appearance-none cursor-pointer accent-sky-500" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="block text-[10px] font-black text-sky-500 flex justify-between">
                                            <span>随机度: {temperature}</span>
                                        </label>
                                        <input type="range" min="0" max="1.5" step="0.1" value={temperature} onChange={e => setTemperature(parseFloat(e.target.value))} className="w-full h-1 bg-sky-200 rounded-lg appearance-none cursor-pointer accent-sky-500" />
                                    </div>
                                </div>
                            )}
                            
                            <div className="space-y-4">
                                {workflow.fields?.map((field, idx) => (
                                    <div key={field.id} className="space-y-1">
                                        <div className="flex justify-between items-center mr-1">
                                            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 ml-1">
                                                <span className="opacity-50 mr-1">{idx + 1}.</span> 
                                                {field.label}
                                                {field.required !== false ? (
                                                    <span className="ml-1 text-red-500 font-normal">* (必填)</span>
                                                ) : (
                                                    <span className="ml-1 text-gray-400 font-normal"> (选填)</span>
                                                )}
                                            </label>
                                            {field.maxLength && (
                                                <span className={`text-[9px] ${(formState[field.variable]?.length || 0) > field.maxLength ? 'text-red-500 font-bold' : 'text-gray-400'}`}>
                                                    {formState[field.variable]?.length || 0} / {field.maxLength}
                                                </span>
                                            )}
                                        </div>
                                        {field.type === 'textarea' ? (
                                            <textarea
                                                value={formState[field.variable] || ''}
                                                onChange={e => setFormState(prev => ({ ...prev, [field.variable]: e.target.value }))}
                                                placeholder={`请输入${field.label}...`}
                                                className="w-full p-3 text-xs bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none transition-all resize-none h-24 shadow-sm"
                                                maxLength={field.maxLength}
                                            />
                                        ) : (
                                            <input
                                                type="text"
                                                value={formState[field.variable] || ''}
                                                onChange={e => setFormState(prev => ({ ...prev, [field.variable]: e.target.value }))}
                                                placeholder={`请输入${field.label}...`}
                                                className="w-full p-3 text-xs bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none transition-all shadow-sm"
                                                maxLength={field.maxLength}
                                            />
                                        )}
                                        {field.description && <p className="text-[10px] text-blue-500 dark:text-blue-400 ml-1 leading-tight">{field.description}</p>}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Fixed Bottom Button Area */}
                    <div className="p-4 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 flex-shrink-0">
                        {isLoading ? (
                             <button 
                                onClick={handleStop}
                                className="w-full py-3 bg-red-500 text-white font-black rounded-xl hover:bg-red-600 transition-all shadow-lg shadow-red-500/30 flex items-center justify-center gap-2 active:scale-95"
                            >
                                <Stop className="w-4 h-4" /> 暂停生成
                            </button>
                        ) : executionStatus === 'paused' ? (
                            <div className="flex gap-2">
                                <button 
                                    onClick={() => handleRunWorkflow(0)} // Reset
                                    className="flex-1 py-3 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 font-bold rounded-xl hover:bg-gray-200 transition-all flex items-center justify-center gap-2 active:scale-95"
                                >
                                    <ArrowPath className="w-4 h-4" /> 重新开始
                                </button>
                                <button 
                                    onClick={handleContinue}
                                    className="flex-[2] py-3 bg-emerald-600 text-white font-black rounded-xl hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-500/30 flex items-center justify-center gap-2 active:scale-95"
                                >
                                    <Play className="w-4 h-4" /> 继续执行
                                </button>
                            </div>
                        ) : (
                            <button 
                                onClick={() => handleRunWorkflow(0)}
                                className="w-full py-3 bg-sky-600 text-white font-black rounded-xl hover:bg-sky-500 transition-all shadow-lg shadow-sky-500/30 flex items-center justify-center gap-2 active:scale-95"
                            >
                                <Sparkles className="w-4 h-4" />
                                {executionStatus === 'completed' ? '重新生成' : '开始运行'}
                            </button>
                        )}
                        {error && <div className="mt-2 p-2 bg-red-50 text-red-600 text-xs rounded-lg text-center">{error}</div>}
                    </div>
                </div>

                {/* Right Column: Output Results */}
                <div className="lg:col-span-8 bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 flex flex-col overflow-hidden h-full">
                     <div className="flex-shrink-0 px-6 py-3 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center h-12 bg-gray-50/30">
                        <h3 className="font-bold text-base text-gray-800 dark:text-white flex items-center gap-2">
                            <Sparkles className="w-5 h-5 text-sky-500" />
                            文本生成
                            {isLoading && <span className="text-[10px] font-normal text-sky-500 animate-pulse ml-2 flex items-center gap-1"><ArrowPath className="w-3 h-3 animate-spin" /> AI 正在创作...</span>}
                        </h3>
                        {hasResults && (
                            <button 
                                type="button"
                                onClick={() => { 
                                    const fullText = Object.values(stepResults).map(stripMarkdown).join('\n\n---\n\n');
                                    navigator.clipboard.writeText(fullText); 
                                    triggerSuccess('全文已复制');
                                }}
                                className="text-gray-400 hover:text-sky-500 transition-colors"
                                title="复制全文"
                            >
                                <Copy className="w-4 h-4" />
                            </button>
                        )}
                     </div>

                     <div className="flex-1 overflow-y-auto p-4 relative custom-scrollbar space-y-6">
                        {!hasResults && !isLoading && executionStatus === 'idle' ? (
                            <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-60">
                                <div className="w-20 h-20 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
                                    <Sparkles className="w-10 h-10 text-gray-300 dark:text-gray-600" />
                                </div>
                                <p className="text-sm font-medium">请配置左侧参数并点击运行</p>
                                <p className="text-xs mt-1 text-gray-300 dark:text-gray-600">AI 将按照设定的步骤为您生成内容</p>
                            </div>
                        ) : (
                            workflow.steps?.map((step, idx) => {
                                const result = stepResults[step.outputVariable];
                                if (!result && currentStepIndex !== idx) return null;
                                const isFinished = !!result;

                                return (
                                    <div key={step.id} className="animate-fade-in space-y-2">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-3">
                                                <div className="h-px w-8 bg-gray-200 dark:bg-gray-800" />
                                                <span className="text-xs font-black text-sky-600 dark:text-sky-400 uppercase tracking-[0.1em]">{step.name}</span>
                                                {isFinished && (
                                                    <span className="text-[10px] text-green-500 bg-green-50 dark:bg-green-900/30 px-1.5 py-0.5 rounded font-bold ml-2 border border-green-100 dark:border-green-900">
                                                        输出完成
                                                    </span>
                                                )}
                                                <div className="h-px w-8 bg-gray-200 dark:bg-gray-800" />
                                            </div>
                                            
                                            {/* Buttons moved to header row */}
                                            {result && (
                                                <div className="flex items-center gap-2">
                                                    <button 
                                                        type="button"
                                                        onClick={() => handleTriggerFollowUp(result, step.outputVariable)} 
                                                        className="flex items-center gap-1 px-3 py-1 text-xs font-bold bg-sky-50 text-sky-600 hover:bg-sky-100 dark:bg-sky-900/20 dark:text-sky-400 dark:hover:bg-sky-900/40 rounded-lg transition-colors border border-sky-100 dark:border-sky-800"
                                                    >
                                                        <ChatBubbleOvalLeftEllipsis className="w-3.5 h-3.5" /> 
                                                        智能追问
                                                    </button>
                                                    <button 
                                                        type="button"
                                                        onClick={() => {
                                                            const plain = stripMarkdown(result);
                                                            setImportContent(plain);
                                                            setImportModalOpen(true);
                                                        }}
                                                        className="flex items-center gap-1 px-3 py-1 text-xs font-bold text-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-colors border border-transparent hover:border-purple-100"
                                                    >
                                                        <Database className="w-3.5 h-3.5" /> 存素材
                                                    </button>
                                                    <button 
                                                        type="button"
                                                        onClick={() => handleOpenSaveModal(result)}
                                                        className="flex items-center gap-1 px-3 py-1 text-xs font-bold text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors border border-transparent hover:border-emerald-100"
                                                    >
                                                        <DocumentPlus className="w-3.5 h-3.5" /> 存入创作中心
                                                    </button>
                                                    {/* Allow Retry for specific steps */}
                                                    <button 
                                                        type="button"
                                                        onClick={() => handleRegenerateStep(idx)} 
                                                        className="flex items-center gap-1 px-3 py-1 text-xs font-bold text-gray-500 hover:text-sky-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors border border-transparent hover:border-gray-200"
                                                        title="重新生成此步骤"
                                                    >
                                                        <ArrowPath className="w-3.5 h-3.5" /> 重试
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                        
                                        <div 
                                            className="bg-gray-50 dark:bg-black/20 rounded-xl border border-gray-100 dark:border-gray-800 relative group shadow-sm overflow-hidden"
                                        >
                                            <div 
                                                ref={(el) => { resultRefs.current[step.outputVariable] = el; }}
                                                className="w-full min-h-[300px] p-6 text-sm leading-7 text-gray-800 dark:text-gray-200 font-sans outline-none"
                                                onMouseUp={() => handleTriggerFollowUp(result, step.outputVariable)} // Allow selection trigger
                                            >
                                                {result ? (
                                                    <FormattedText text={result} />
                                                ) : (currentStepIndex === idx ? (
                                                    <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                                                        <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin mb-3"></div>
                                                        <p className="text-sm font-medium animate-pulse">内容生成中...</p>
                                                    </div>
                                                ) : "")}
                                            </div>
                                            
                                            {result && (
                                                <div className="absolute bottom-4 right-4 text-[10px] text-gray-300 font-mono pointer-events-none bg-white/80 dark:bg-black/50 px-2 py-1 rounded backdrop-blur-sm">
                                                    {stripMarkdown(result).length} 字
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                     </div>
                </div>
            </div>
        </div>
    );
};

export default WorkflowRun;
