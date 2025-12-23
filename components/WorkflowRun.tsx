
import React, { useState, useEffect } from 'react';
import { Workflow } from '../types';
import { generateTextStream } from '../services/geminiService';
import { Sparkles, ChevronDoubleLeft, X, AdjustmentsHorizontal, ChevronDown, Check, Copy, Trash, Stop, InformationCircle, ArrowPath, Bolt, Play } from './Icon';
import LoadingOverlay from './LoadingOverlay';

interface WorkflowRunProps {
    workflow: Workflow;
    onBack: () => void;
}

const WorkflowRun: React.FC<WorkflowRunProps> = ({ workflow, onBack }) => {
    const [model, setModel] = useState('gemini-3-flash-preview');
    const [temperature, setTemperature] = useState(0.8);
    const [topP, setTopP] = useState(0.95);
    const [showConfig, setShowConfig] = useState(false);

    const [formState, setFormState] = useState<Record<string, string>>({});
    const [stepResults, setStepResults] = useState<Record<string, string>>({});
    const [currentStepIndex, setCurrentStepIndex] = useState<number | null>(null);
    const [nextStepIndex, setNextStepIndex] = useState<number>(0);
    const [executionStatus, setExecutionStatus] = useState<'idle' | 'running' | 'paused' | 'completed'>('idle');
    const [isLoading, setIsLoading] = useState(false);
    const [showOverlay, setShowOverlay] = useState(false);
    const [error, setError] = useState('');
    const [overlayStatus, setOverlayStatus] = useState<'loading' | 'success'>('loading');

    const handleRunWorkflow = async (startIndex: number = 0) => {
        const steps = workflow.steps || [];
        if (steps.length === 0) {
            setError('该工作流没有定义执行步骤。');
            return;
        }

        setIsLoading(true);
        setExecutionStatus('running');
        setOverlayStatus('loading');
        setShowOverlay(true);
        setError('');
        
        // Context includes form inputs and all previous step results
        const currentContext: Record<string, string> = { ...formState, ...stepResults };

        try {
            for (let i = startIndex; i < steps.length; i++) {
                const step = steps[i];
                setCurrentStepIndex(i);

                // Replace variables in prompt
                let finalPrompt = step.prompt;
                Object.keys(currentContext).forEach(key => {
                    // Simple global replacement for ${variable}
                    finalPrompt = finalPrompt.split(`\${${key}}`).join(currentContext[key] || '');
                });

                let stepContent = '';
                const stream = generateTextStream(finalPrompt, { model, temperature, topP });
                
                let isFirstChunk = true;
                for await (const chunk of stream) {
                    if (isFirstChunk) {
                        setShowOverlay(false);
                        isFirstChunk = false;
                    }
                    stepContent += chunk;
                    setStepResults(prev => ({ ...prev, [step.outputVariable]: stepContent }));
                }

                currentContext[step.outputVariable] = stepContent;
                
                // Handle manual confirmation pause
                if (step.manualConfirmation && i < steps.length - 1) {
                    setNextStepIndex(i + 1);
                    setExecutionStatus('paused');
                    setIsLoading(false);
                    setCurrentStepIndex(null);
                    return; // Exit loop to wait for user interaction
                }
            }
            setOverlayStatus('success');
            setExecutionStatus('completed');
            setCurrentStepIndex(null);
            setNextStepIndex(0); // Reset for restart
        } catch (e: any) {
            setError(e.message || '生成失败');
            setShowOverlay(false);
            setExecutionStatus('paused'); // Allow retry
        } finally {
            if (executionStatus !== 'paused') {
                setIsLoading(false);
            }
        }
    };

    const handleRegenerateStep = (stepIndex: number) => {
        // Regenerate specific step means run from that index
        handleRunWorkflow(stepIndex);
    };

    const handleContinue = () => {
        handleRunWorkflow(nextStepIndex);
    };

    const getStatusColor = (idx: number) => {
        if (currentStepIndex === idx) return 'bg-sky-500 text-white animate-pulse ring-4 ring-sky-500/20';
        if (idx < nextStepIndex || executionStatus === 'completed') return 'bg-emerald-500 text-white';
        return 'bg-gray-100 dark:bg-gray-800 text-gray-400';
    };

    return (
        <div className="p-4 sm:p-6 lg:p-8 h-full animate-fade-in flex flex-col font-sans bg-gray-50/30 dark:bg-black/20">
            <LoadingOverlay isVisible={showOverlay} onClose={() => setShowOverlay(false)} status={overlayStatus} />
            
            <div className="flex items-center justify-between mb-8">
                 <div className="flex items-center gap-4">
                    <button onClick={onBack} className="p-2 text-gray-400 hover:text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-900/20 rounded-full transition-all">
                        <ChevronDoubleLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">{workflow.title}</h1>
                        <p className="text-xs text-gray-500 font-medium">多步骤串行工作流执行中</p>
                    </div>
                 </div>
                 <div className="flex items-center gap-3">
                    <span className="px-3 py-1 bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300 rounded-lg text-[10px] font-black uppercase tracking-widest border border-sky-200 dark:border-sky-800">
                        {workflow.category === 'script' ? '影视剧本' : '短篇小说'}
                    </span>
                 </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 flex-1 overflow-hidden">
                {/* Left Form Panel */}
                <div className="lg:col-span-4 flex flex-col overflow-y-auto pr-2 space-y-6 custom-scrollbar">
                    <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-6">
                        <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-4">
                            <h3 className="font-bold text-gray-800 dark:text-white flex items-center gap-2">
                                <AdjustmentsHorizontal className="w-4 h-4 text-sky-500" />
                                参数配置
                            </h3>
                            <button onClick={() => setShowConfig(!showConfig)} className="text-[10px] font-bold text-sky-500 hover:underline">
                                {showConfig ? '隐藏设置' : '模型设置'}
                            </button>
                        </div>

                        {showConfig && (
                            <div className="space-y-4 animate-fade-in p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-800">
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase mb-2">模型</label>
                                    <select value={model} onChange={e => setModel(e.target.value)} className="w-full p-2 text-xs rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-sky-500 outline-none cursor-pointer">
                                        <option value="gemini-3-flash-preview">Gemini 3 Flash</option>
                                        <option value="deepseek-chat">DeepSeek V3</option>
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="block text-[10px] font-black text-sky-500 flex justify-between">
                                        <span>随机度: {temperature}</span>
                                    </label>
                                    <input type="range" min="0" max="1.5" step="0.1" value={temperature} onChange={e => setTemperature(parseFloat(e.target.value))} className="w-full h-1 bg-sky-200 rounded-lg appearance-none cursor-pointer accent-sky-500" />
                                </div>
                            </div>
                        )}
                        
                        <div className="space-y-5">
                            {workflow.fields?.map(field => (
                                <div key={field.id} className="space-y-2">
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 ml-1">{field.label}</label>
                                    {field.type === 'textarea' ? (
                                        <textarea
                                            value={formState[field.variable] || ''}
                                            onChange={e => setFormState(prev => ({ ...prev, [field.variable]: e.target.value }))}
                                            placeholder={`请输入${field.label}...`}
                                            className="w-full p-4 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none transition-all resize-none h-32 shadow-inner"
                                        />
                                    ) : (
                                        <input
                                            type="text"
                                            value={formState[field.variable] || ''}
                                            onChange={e => setFormState(prev => ({ ...prev, [field.variable]: e.target.value }))}
                                            placeholder={`请输入${field.label}...`}
                                            className="w-full p-4 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none transition-all shadow-inner"
                                        />
                                    )}
                                </div>
                            ))}
                        </div>
                        
                        {executionStatus === 'paused' ? (
                            <div className="flex gap-2">
                                <button 
                                    onClick={handleContinue}
                                    className="flex-1 py-4 bg-emerald-600 text-white font-black rounded-2xl hover:bg-emerald-500 transition-all shadow-xl shadow-emerald-500/30 flex items-center justify-center gap-2 active:scale-95"
                                >
                                    <Play className="w-5 h-5" /> 继续执行
                                </button>
                            </div>
                        ) : (
                            <button 
                                onClick={() => handleRunWorkflow(0)}
                                disabled={isLoading}
                                className="w-full py-4 bg-sky-600 text-white font-black rounded-2xl hover:bg-sky-500 transition-all shadow-xl shadow-sky-500/30 flex items-center justify-center gap-3 disabled:bg-gray-400 active:scale-95"
                            >
                                {isLoading ? <ArrowPath className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                                {executionStatus === 'completed' ? '重新开始' : (isLoading ? '正在执行...' : '开始自动执行')}
                            </button>
                        )}
                    </div>

                    <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 space-y-4">
                        <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">执行进度</h3>
                        <div className="space-y-4 relative">
                            {workflow.steps?.map((step, idx) => (
                                <div key={step.id} className="flex items-center gap-4 relative">
                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 transition-colors ${getStatusColor(idx)}`}>
                                        {idx < nextStepIndex || executionStatus === 'completed' ? <Check className="w-3.5 h-3.5" /> : idx + 1}
                                    </div>
                                    <div className="flex-1 flex justify-between items-center">
                                        <div className={`text-xs font-bold ${currentStepIndex === idx ? 'text-sky-600' : 'text-gray-500'}`}>
                                            {step.name}
                                        </div>
                                        {step.manualConfirmation && (
                                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-orange-100 text-orange-600 dark:bg-orange-900/30 font-medium">
                                                暂停点
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right Result Panel */}
                <div className="lg:col-span-8 bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col overflow-hidden relative">
                     <div className="flex-shrink-0 px-8 py-5 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-white dark:bg-gray-900">
                        <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <Sparkles className="w-5 h-5 text-sky-500" />
                            创作产出
                        </h3>
                        {Object.keys(stepResults).length > 0 && (
                            <div className="flex items-center gap-2">
                                <button 
                                    onClick={() => { 
                                        const fullText = Object.values(stepResults).join('\n\n---\n\n');
                                        navigator.clipboard.writeText(fullText); 
                                    }}
                                    className="px-3 py-1.5 bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 rounded-lg text-xs font-bold hover:text-sky-500 transition-colors flex items-center gap-1"
                                >
                                    <Copy className="w-3.5 h-3.5" /> 复制全部
                                </button>
                            </div>
                        )}
                     </div>

                     <div className="flex-1 overflow-y-auto p-8 relative custom-scrollbar space-y-12">
                        {workflow.steps?.map((step, idx) => {
                            const result = stepResults[step.outputVariable];
                            // Only show if we have a result OR it's the current running step
                            if (!result && currentStepIndex !== idx) return null;

                            return (
                                <div key={step.id} className="animate-fade-in space-y-4">
                                    <div className="flex items-center gap-3">
                                        <div className="h-0.5 flex-1 bg-gray-100 dark:bg-gray-800" />
                                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">{step.name}</span>
                                        <div className="h-0.5 flex-1 bg-gray-100 dark:bg-gray-800" />
                                    </div>
                                    {result ? (
                                        <div className="p-6 bg-gray-50 dark:bg-black/20 rounded-2xl border border-gray-100 dark:border-gray-800 relative group">
                                            <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                                                {/* Allow regeneration of this specific step if we are paused or done */}
                                                {(executionStatus === 'paused' && idx === nextStepIndex - 1) || executionStatus === 'completed' ? (
                                                    <button 
                                                        onClick={() => handleRegenerateStep(idx)} 
                                                        className="p-2 text-gray-400 hover:text-sky-500 bg-white dark:bg-gray-800 rounded-lg shadow-sm"
                                                        title="重新生成此步骤"
                                                    >
                                                        <ArrowPath className="w-4 h-4" />
                                                    </button>
                                                ) : null}
                                                <button 
                                                    onClick={() => navigator.clipboard.writeText(result)}
                                                    className="p-2 text-gray-400 hover:text-sky-500 bg-white dark:bg-gray-800 rounded-lg shadow-sm"
                                                    title="复制内容"
                                                >
                                                    <Copy className="w-4 h-4" />
                                                </button>
                                            </div>
                                            <div className="whitespace-pre-wrap text-base leading-loose text-gray-700 dark:text-gray-200 font-serif">
                                                {result}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="py-12 flex flex-col items-center justify-center text-sky-500 animate-pulse">
                                            <ArrowPath className="w-8 h-8 animate-spin mb-3" />
                                            <p className="text-xs font-bold uppercase tracking-widest">AI 正在构思本环节内容...</p>
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                        {!isLoading && Object.keys(stepResults).length === 0 && (
                            <div className="h-full flex flex-col items-center justify-center text-gray-300 dark:text-gray-700 opacity-40 py-20">
                                <Bolt className="w-24 h-24 mb-6" />
                                <p className="text-xl font-black italic tracking-tighter">WAITING FOR EXECUTION</p>
                                <p className="text-sm mt-2 font-medium">填写左侧参数并运行，结果将显示在这里</p>
                            </div>
                        )}
                        
                        {error && (
                            <div className="p-4 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 rounded-xl border border-rose-100 dark:border-rose-900/50 text-sm font-bold animate-shake">
                                ⚠️ 错误提示: {error}
                            </div>
                        )}
                     </div>
                </div>
            </div>
        </div>
    );
};

export default WorkflowRun;
