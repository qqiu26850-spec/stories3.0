import React, { useState, useEffect } from 'react';
import { Workflow } from '../types';
import { generateTextStream } from '../services/geminiService';
// Added InformationCircle to fix the missing import error
import { Sparkles, ChevronDoubleLeft, X, AdjustmentsHorizontal, ChevronDown, Check, Copy, Trash, Stop, InformationCircle } from './Icon';
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
    const [isLoading, setIsLoading] = useState(false);
    const [showOverlay, setShowOverlay] = useState(false);
    const [result, setResult] = useState('');
    const [error, setError] = useState('');
    const [overlayStatus, setOverlayStatus] = useState<'loading' | 'success'>('loading');

    const handleGenerate = async () => {
        setIsLoading(true);
        setOverlayStatus('loading');
        setShowOverlay(true);
        setResult('');
        setError('');
        try {
            let prompt = workflow.template || '';
            workflow.fields?.forEach(field => {
                const value = formState[field.variable] || '';
                // 递归替换所有出现的变量
                prompt = prompt.split(`\${${field.variable}}`).join(value);
            });

            const stream = generateTextStream(prompt, { model, temperature, topP });
            
            let isFirst = true;
            for await (const chunk of stream) {
                if (isFirst) {
                    setShowOverlay(false);
                    isFirst = false;
                }
                setResult(prev => prev + chunk);
            }
            setOverlayStatus('success');
        } catch (e: any) {
            setError(e.message || '生成失败');
            setShowOverlay(false);
        } finally {
            setIsLoading(false);
        }
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
                        <p className="text-xs text-gray-500 font-medium">正在运行工作流模板</p>
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
                                {showConfig ? '隐藏模型设置' : '模型设置'}
                            </button>
                        </div>

                        {showConfig && (
                            <div className="space-y-4 animate-fade-in p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-800">
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase mb-2">选择模型</label>
                                    <div className="relative">
                                        <select value={model} onChange={e => setModel(e.target.value)} className="w-full p-2 text-xs rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-sky-500 outline-none appearance-none cursor-pointer">
                                            <option value="gemini-3-flash-preview">Gemini 3 Flash (极速)</option>
                                            <option value="gemini-3-pro-preview">Gemini 3 Pro (深度)</option>
                                            <option value="deepseek-chat">DeepSeek V3 (强文本)</option>
                                        </select>
                                        <ChevronDown className="w-3.5 h-3.5 absolute right-2 top-2.5 text-gray-400 pointer-events-none" />
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    {/* Corrected text-sky-50 to text-sky-500 for visibility */}
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
                                            className="w-full p-3 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none transition-all resize-none h-32 shadow-inner"
                                        />
                                    ) : (
                                        <input
                                            type="text"
                                            value={formState[field.variable] || ''}
                                            onChange={e => setFormState(prev => ({ ...prev, [field.variable]: e.target.value }))}
                                            placeholder={`请输入${field.label}...`}
                                            className="w-full p-3 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none transition-all shadow-inner"
                                        />
                                    )}
                                </div>
                            ))}
                        </div>
                        
                        <button 
                            onClick={handleGenerate}
                            disabled={isLoading}
                            className="w-full py-4 bg-sky-600 text-white font-black rounded-2xl hover:bg-sky-500 transition-all shadow-xl shadow-sky-500/30 flex items-center justify-center gap-3 disabled:bg-gray-400 active:scale-95"
                        >
                            {isLoading ? <Stop className="w-5 h-5 animate-pulse" /> : <Sparkles className="w-5 h-5" />}
                            {isLoading ? '正在处理...' : '执行工作流'}
                        </button>
                    </div>

                    <div className="p-5 bg-blue-50/50 dark:bg-blue-900/10 rounded-2xl border border-blue-100 dark:border-blue-900/30">
                        {/* InformationCircle is now imported */}
                        <h4 className="text-xs font-bold text-blue-600 mb-2 flex items-center gap-1.5 uppercase tracking-widest"><InformationCircle className="w-4 h-4"/> 提示词预览</h4>
                        <div className="text-[10px] text-gray-500 dark:text-gray-400 font-mono leading-relaxed break-all opacity-80 line-clamp-4">
                            {workflow.template}
                        </div>
                    </div>
                </div>

                {/* Right Result Panel */}
                <div className="lg:col-span-8 bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col overflow-hidden relative">
                     <div className="flex-shrink-0 px-8 py-4 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-white dark:bg-gray-900">
                        <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <Check className="w-5 h-5 text-emerald-500" />
                            生成结果
                        </h3>
                        {result && (
                            <div className="flex items-center gap-2">
                                <button 
                                    onClick={() => { navigator.clipboard.writeText(result); }}
                                    className="p-2 text-gray-400 hover:text-sky-500 transition-colors"
                                    title="复制全文"
                                >
                                    <Copy className="w-4 h-4" />
                                </button>
                                <button 
                                    onClick={() => setResult('')}
                                    className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                                    title="清空"
                                >
                                    <Trash className="w-4 h-4" />
                                </button>
                            </div>
                        )}
                     </div>

                     <div className="flex-1 overflow-y-auto p-8 relative custom-scrollbar bg-white dark:bg-gray-900">
                        {result ? (
                            <div className="whitespace-pre-wrap text-base leading-loose text-gray-700 dark:text-gray-200 font-serif">
                                {result}
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-gray-400 dark:text-gray-600 opacity-40">
                                <Sparkles className="w-24 h-24 mb-6" />
                                <p className="text-xl font-medium">等待运行...</p>
                                <p className="text-sm mt-2">请在左侧填写参数并点击“执行工作流”</p>
                            </div>
                        )}
                        {error && (
                            <div className="mt-4 p-4 bg-red-50 text-red-600 rounded-xl border border-red-100 text-sm font-bold animate-fade-in">
                                ❌ 错误: {error}
                            </div>
                        )}
                     </div>
                </div>
            </div>
        </div>
    );
};

export default WorkflowRun;