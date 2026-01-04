
import React, { useState, useEffect, useRef } from 'react';
import { Workflow, Asset } from '../types';
import { generateTextStream } from '../services/geminiService';
import { Sparkles, ChevronDoubleLeft, AdjustmentsHorizontal, Check, Copy, Stop, ArrowPath, Bolt, Play, Database } from './Icon';
import ImportAssetModal from './ImportAssetModal';
import { saveMaterial } from '../services/supabaseService';

interface WorkflowRunProps {
    workflow: Workflow;
    onBack: () => void;
}

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
                        if (level === 1) className += "text-lg mt-4 mb-2";
                        else if (level === 2) className += "text-base mt-3 mb-1.5";
                        else className += "text-sm mt-2 mb-1";
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

const WorkflowRun: React.FC<WorkflowRunProps> = ({ workflow, onBack }) => {
    const [model, setModel] = useState('deepseek-chat');
    const [temperature, setTemperature] = useState(0.8);
    const [topP, setTopP] = useState(0.95);
    const [maxOutputTokens, setMaxOutputTokens] = useState(8192);
    const [showConfig, setShowConfig] = useState(false);

    const [formState, setFormState] = useState<Record<string, string>>({});
    const [stepResults, setStepResults] = useState<Record<string, string>>({});
    const [currentStepIndex, setCurrentStepIndex] = useState<number | null>(null);
    const [nextStepIndex, setNextStepIndex] = useState<number>(0);
    const [executionStatus, setExecutionStatus] = useState<'idle' | 'running' | 'paused' | 'completed'>('idle');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    
    // Import Modal State
    const [importModalOpen, setImportModalOpen] = useState(false);
    const [importContent, setImportContent] = useState('');
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    
    const abortControllerRef = useRef<AbortController | null>(null);

    const triggerSuccess = (msg: string) => {
        setSuccessMessage(msg);
        setTimeout(() => setSuccessMessage(null), 3000);
    };

    const handleImportAsset = async (data: { name: string; type: Asset['type']; tags: string[]; content: string }) => {
        await saveMaterial(data.name, data.content, data.type === 'inspiration' ? 'idea' : data.type, data.tags);
        triggerSuccess('素材已导入');
    };

    const handleImportSelection = () => {
        const selection = window.getSelection();
        const text = selection?.toString();
        if(text && text.trim().length > 0) {
            setImportContent(text);
            setImportModalOpen(true);
        } else {
            // If no text selected, try to find text from the active or last result
            const lastKey = Object.keys(stepResults).pop();
            if (lastKey) {
                setImportContent(stripMarkdown(stepResults[lastKey]));
                setImportModalOpen(true);
            }
        }
    };

    const handleStop = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
        setIsLoading(false);
        setExecutionStatus('paused');
    };

    const handleRunWorkflow = async (startIndex: number = 0) => {
        const steps = workflow.steps || [];
        if (steps.length === 0) {
            setError('该工作流没有定义执行步骤。');
            return;
        }

        setIsLoading(true);
        setExecutionStatus('running');
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

                let stepContent = '';
                const stream = generateTextStream(finalPrompt, { 
                    model, 
                    temperature, 
                    topP, 
                    maxOutputTokens, 
                    signal: controller.signal 
                });
                
                for await (const chunk of stream) {
                    stepContent += chunk;
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

    return (
        <div className="p-4 h-full animate-fade-in flex flex-col font-sans bg-gray-50/30 dark:bg-black/20 relative">
            <ImportAssetModal isOpen={importModalOpen} onClose={() => setImportModalOpen(false)} content={importContent} onSave={handleImportAsset} />
            
            {successMessage && (
                <div className="fixed top-20 right-8 z-50 px-4 py-2 bg-emerald-500 text-white rounded-lg shadow-lg animate-fade-in-up text-sm font-bold flex items-center gap-2">
                    <Check className="w-4 h-4" /> {successMessage}
                </div>
            )}

            {/* Header: Compact, Title Left, Progress Right */}
            <div className="flex items-center justify-between mb-4 bg-white dark:bg-gray-900 p-3 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 flex-shrink-0 h-16">
                 <div className="flex items-center gap-3">
                    <button onClick={onBack} className="p-1.5 text-gray-400 hover:text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-900/20 rounded-full transition-all">
                        <ChevronDoubleLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-lg font-black text-gray-900 dark:text-white tracking-tight leading-tight">{workflow.title}</h1>
                    </div>
                 </div>
                 
                 {/* Execution Progress in Header */}
                 <div className="flex items-center gap-2 overflow-x-auto no-scrollbar px-2">
                    {workflow.steps?.map((step, idx) => (
                        <div key={step.id} className="flex items-center gap-2">
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 transition-colors ${getStatusColor(idx)}`}>
                                {idx < nextStepIndex || executionStatus === 'completed' ? <Check className="w-3 h-3" /> : idx + 1}
                            </div>
                            <span className={`text-[10px] font-bold whitespace-nowrap hidden md:inline ${currentStepIndex === idx ? 'text-sky-600' : 'text-gray-400'}`}>
                                {step.name}
                            </span>
                            {idx < (workflow.steps?.length || 0) - 1 && <div className="w-3 h-0.5 bg-gray-100 dark:bg-gray-800" />}
                        </div>
                    ))}
                 </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1 overflow-hidden">
                {/* Left Form Panel */}
                <div className="lg:col-span-4 flex flex-col overflow-y-auto pr-1 space-y-4 custom-scrollbar">
                    <div className="bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
                        <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-2">
                            <h3 className="text-sm font-bold text-gray-800 dark:text-white flex items-center gap-2">
                                <AdjustmentsHorizontal className="w-4 h-4 text-sky-500" />
                                参数配置
                            </h3>
                            <button onClick={() => setShowConfig(!showConfig)} className="text-[10px] font-bold text-sky-500 hover:underline">
                                {showConfig ? '收起配置' : '模型设置'}
                            </button>
                        </div>

                        {showConfig && (
                            <div className="space-y-3 animate-fade-in p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-800">
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">模型</label>
                                    <select value={model} onChange={e => setModel(e.target.value)} className="w-full p-1.5 text-xs rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-sky-500 outline-none cursor-pointer">
                                        <option value="deepseek-chat">奇思版</option>
                                        <option value="gemini-2.0-flash">妙写版</option>
                                        <option value="doubao-flash">速写版</option>
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="block text-[10px] font-black text-sky-500 flex justify-between">
                                        <span>随机度: {temperature}</span>
                                    </label>
                                    <input type="range" min="0" max="1.5" step="0.1" value={temperature} onChange={e => setTemperature(parseFloat(e.target.value))} className="w-full h-1 bg-sky-200 rounded-lg appearance-none cursor-pointer accent-sky-500" />
                                </div>
                                <div className="space-y-1">
                                    <label className="block text-[10px] font-black text-sky-500 flex justify-between">
                                        <span>核采样: {topP}</span>
                                    </label>
                                    <input type="range" min="0" max="1" step="0.05" value={topP} onChange={e => setTopP(parseFloat(e.target.value))} className="w-full h-1 bg-sky-200 rounded-lg appearance-none cursor-pointer accent-sky-500" />
                                </div>
                                <div className="space-y-1">
                                    <label className="block text-[10px] font-black text-sky-500 flex justify-between">
                                        <span>最大长度: {maxOutputTokens}</span>
                                    </label>
                                    <input type="range" min="1024" max="16384" step="1024" value={maxOutputTokens} onChange={e => setMaxOutputTokens(parseInt(e.target.value))} className="w-full h-1 bg-sky-200 rounded-lg appearance-none cursor-pointer accent-sky-500" />
                                </div>
                            </div>
                        )}
                        
                        <div className="space-y-4">
                            {workflow.fields?.map((field, idx) => (
                                <div key={field.id} className="space-y-1">
                                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 ml-1 flex items-center justify-between">
                                        <span>
                                            <span className="opacity-50 mr-1">{idx + 1}.</span> 
                                            {field.label}
                                            {field.required !== false && <span className="text-red-500 ml-0.5">*</span>}
                                        </span>
                                        <span className="text-[10px] text-gray-400 font-normal scale-90 origin-right">
                                            {field.required !== false ? '必填' : '选填'}
                                        </span>
                                    </label>
                                    {field.type === 'textarea' ? (
                                        <textarea
                                            value={formState[field.variable] || ''}
                                            onChange={e => setFormState(prev => ({ ...prev, [field.variable]: e.target.value }))}
                                            placeholder={`请输入${field.label}...`}
                                            className="w-full p-3 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none transition-all resize-none h-24 shadow-inner"
                                        />
                                    ) : (
                                        <input
                                            type="text"
                                            value={formState[field.variable] || ''}
                                            onChange={e => setFormState(prev => ({ ...prev, [field.variable]: e.target.value }))}
                                            placeholder={`请输入${field.label}...`}
                                            className="w-full p-3 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none transition-all shadow-inner"
                                        />
                                    )}
                                    {field.description && <p className="text-[10px] text-blue-500 dark:text-blue-400 ml-1 leading-tight">{field.description}</p>}
                                </div>
                            ))}
                        </div>
                        
                        {isLoading ? (
                             <button 
                                onClick={handleStop}
                                className="w-full py-3 bg-red-500 text-white font-black rounded-xl hover:bg-red-600 transition-all shadow-lg shadow-red-500/30 flex items-center justify-center gap-2 active:scale-95"
                            >
                                <Stop className="w-4 h-4" /> 停止生成
                            </button>
                        ) : executionStatus === 'paused' ? (
                            <div className="flex gap-2">
                                <button 
                                    onClick={handleContinue}
                                    className="flex-1 py-3 bg-emerald-600 text-white font-black rounded-xl hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-500/30 flex items-center justify-center gap-2 active:scale-95"
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
                                {executionStatus === 'completed' ? '重新开始' : '开始运行'}
                            </button>
                        )}
                    </div>
                </div>

                {/* Right Result Panel */}
                <div className="lg:col-span-8 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col overflow-hidden relative">
                     <div className="flex-shrink-0 px-6 py-3 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-white dark:bg-gray-900 h-12">
                        <h3 className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-sky-500" />
                            创作产出
                            {isLoading && <span className="text-[10px] font-normal text-sky-500 animate-pulse ml-2 flex items-center gap-1"><ArrowPath className="w-3 h-3 animate-spin" /> AI 正在思考...</span>}
                        </h3>
                        {Object.keys(stepResults).length > 0 && (
                            <div className="flex items-center gap-2">
                                <button 
                                    onClick={handleImportSelection}
                                    className="px-3 py-1.5 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded-lg text-xs font-bold hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors flex items-center gap-1"
                                    title="选中内容后点击导入"
                                >
                                    <Database className="w-3.5 h-3.5" /> 导入选中文字
                                </button>
                                <button 
                                    onClick={() => { 
                                        const fullText = Object.values(stepResults).map(stripMarkdown).join('\n\n---\n\n');
                                        navigator.clipboard.writeText(fullText); 
                                        triggerSuccess('全文已复制');
                                    }}
                                    className="px-3 py-1.5 bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 rounded-lg text-xs font-bold hover:text-sky-500 transition-colors flex items-center gap-1"
                                >
                                    <Copy className="w-3.5 h-3.5" /> 复制全文
                                </button>
                            </div>
                        )}
                     </div>

                     <div className="flex-1 overflow-y-auto p-6 relative custom-scrollbar space-y-8">
                        {workflow.steps?.map((step, idx) => {
                            const result = stepResults[step.outputVariable];
                            // Only show if we have a result OR it's the current running step
                            if (!result && currentStepIndex !== idx) return null;

                            return (
                                <div key={step.id} className="animate-fade-in space-y-2">
                                    <div className="flex items-center gap-3">
                                        <div className="h-px flex-1 bg-gray-100 dark:bg-gray-800" />
                                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">{step.name}</span>
                                        <div className="h-px flex-1 bg-gray-100 dark:bg-gray-800" />
                                    </div>
                                    {result ? (
                                        <div className="p-5 bg-gray-50 dark:bg-black/20 rounded-xl border border-gray-100 dark:border-gray-800 relative group">
                                            {/* Step Toolbar */}
                                            <div className="flex justify-end gap-2 mb-2 pb-2 border-b border-gray-200 dark:border-gray-700 opacity-80">
                                                <button 
                                                    onClick={() => {
                                                        const plain = stripMarkdown(result);
                                                        setImportContent(plain);
                                                        setImportModalOpen(true);
                                                    }}
                                                    className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-purple-500 hover:bg-purple-100 dark:hover:bg-purple-900/30 rounded transition-colors"
                                                >
                                                    <Database className="w-3 h-3" /> 导入素材
                                                </button>
                                                <button 
                                                    onClick={() => {
                                                        navigator.clipboard.writeText(stripMarkdown(result));
                                                        triggerSuccess('内容已复制');
                                                    }}
                                                    className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-gray-500 hover:text-sky-500 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                                                >
                                                    <Copy className="w-3 h-3" /> 复制
                                                </button>
                                                {(executionStatus === 'paused' && idx === nextStepIndex - 1) || executionStatus === 'completed' ? (
                                                    <button 
                                                        onClick={() => handleRegenerateStep(idx)} 
                                                        className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-gray-500 hover:text-sky-500 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                                                        title="重新生成此步骤"
                                                    >
                                                        <ArrowPath className="w-3 h-3" /> 重试
                                                    </button>
                                                ) : null}
                                            </div>
                                            {/* Render formatting text instead of raw markdown */}
                                            <FormattedText text={result} />
                                        </div>
                                    ) : (
                                        <div className="py-8 flex flex-col items-center justify-center text-sky-500 animate-pulse bg-gray-50/50 rounded-xl">
                                            <div className="w-2 h-2 bg-sky-500 rounded-full animate-ping mb-2"></div>
                                            <p className="text-[10px] font-bold uppercase tracking-widest">AI 正在构思本环节内容...</p>
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                        {!isLoading && Object.keys(stepResults).length === 0 && (
                            <div className="h-full flex flex-col items-center justify-center text-gray-300 dark:text-gray-700 opacity-40 py-10">
                                <Bolt className="w-20 h-20 mb-4" />
                                <p className="text-lg font-black italic tracking-tighter">WAITING FOR EXECUTION</p>
                                <p className="text-xs mt-1 font-medium">填写左侧参数并运行，结果将显示在这里</p>
                            </div>
                        )}
                        
                        {error && (
                            <div className="p-3 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 rounded-xl border border-rose-100 dark:border-rose-900/50 text-xs font-bold animate-shake text-center">
                                ⚠️ {error}
                            </div>
                        )}
                     </div>
                </div>
            </div>
        </div>
    );
};

export default WorkflowRun;
