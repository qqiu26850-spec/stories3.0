
import React, { useState, useEffect } from 'react';
import { Workflow } from '../types';
import { generateTextStream } from '../services/geminiService';
import { Sparkles, ChevronDoubleLeft, X, AdjustmentsHorizontal, ChevronDown, InformationCircle } from './Icon';

interface WorkflowRunProps {
    workflow: Workflow;
    onBack: () => void;
}

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
    const [model, setModel] = useState('gemini-3-flash-preview');
    const [temperature, setTemperature] = useState(0.7);
    const [topP, setTopP] = useState(0.95);
    const [showConfig, setShowConfig] = useState(false);

    const [formState, setFormState] = useState<Record<string, string>>({});
    const [isLoading, setIsLoading] = useState(false);
    const [showOverlay, setShowOverlay] = useState(false);
    const [result, setResult] = useState('');
    const [error, setError] = useState('');

    const handleGenerate = async () => {
        setIsLoading(true);
        setShowOverlay(true);
        setResult('');
        setError('');
        try {
            let prompt = workflow.template || '';
            workflow.fields?.forEach(field => {
                const value = formState[field.variable] || '';
                prompt = prompt.replace(new RegExp(`\\$\\{${field.variable}\\}`, 'g'), value);
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
        } catch (e: any) {
            setError(e.message || '生成失败');
            setResult(prev => prev + "\n\n[生成中断]");
        } finally {
            setIsLoading(false);
            setShowOverlay(false);
        }
    };

    return (
        <div className="p-4 sm:p-6 lg:p-8 h-full animate-fade-in flex flex-col">
            <div className="flex items-center gap-4 mb-6">
                 <button onClick={onBack} className="p-2 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                    <ChevronDoubleLeft className="w-5 h-5" />
                 </button>
                 <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{workflow.title}</h1>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 flex-1 overflow-hidden">
                <div className="lg:col-span-1 flex flex-col overflow-y-auto pr-2 space-y-6">
                    <div className="bg-white dark:bg-gray-900 p-6 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
                         <h3 className="font-bold text-gray-900 dark:text-white mb-2">工作流简介</h3>
                         <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">{workflow.description}</p>
                    </div>

                    <div className="bg-white dark:bg-gray-900 p-6 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-6">
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">模型与参数</label>
                                <button onClick={() => setShowConfig(!showConfig)} className="text-[10px] text-sky-500 font-bold hover:underline">
                                    {showConfig ? '收起参数' : '调整参数'}
                                </button>
                            </div>
                            <div className="relative">
                                <select value={model} onChange={e => setModel(e.target.value)} className="w-full p-3 text-sm rounded-lg bg-gray-50 dark:bg-gray-800 border focus:ring-2 focus:ring-sky-500 outline-none appearance-none cursor-pointer">
                                    <option value="gemini-3-flash-preview">谷歌极速 (Gemini 3 Flash)</option>
                                    <option value="gemini-3-pro-preview">谷歌深度 (Gemini 3 Pro)</option>
                                    <option value="deepseek-chat">DeepSeek V3</option>
                                </select>
                                <ChevronDown className="w-4 h-4 absolute right-3 top-3.5 text-gray-400 pointer-events-none" />
                            </div>

                            {showConfig && (
                                <div className="mt-4 p-3 bg-gray-50 dark:bg-black/20 rounded-lg border space-y-4 animate-fade-in text-[10px]">
                                    <div className="space-y-1">
                                        <label className="block font-black text-sky-500 flex justify-between uppercase">
                                            <span>温度 (Temperature): {temperature}</span>
                                        </label>
                                        <input type="range" min="0" max="1.5" step="0.1" value={temperature} onChange={e => setTemperature(parseFloat(e.target.value))} className="w-full h-1 bg-sky-200 rounded-lg appearance-none cursor-pointer accent-sky-500" />
                                        <p className="text-gray-400 leading-tight">控制生成结果的惊艳度。值越高，输出越不可预测。</p>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="block font-black text-sky-500 flex justify-between uppercase">
                                            <span>核采样 (Top P): {topP}</span>
                                        </label>
                                        <input type="range" min="0" max="1" step="0.05" value={topP} onChange={e => setTopP(parseFloat(e.target.value))} className="w-full h-1 bg-sky-200 rounded-lg appearance-none cursor-pointer accent-sky-500" />
                                        <p className="text-gray-400 leading-tight">控制候选词范围。值越高，AI 使用冷门词汇的概率越高。</p>
                                    </div>
                                </div>
                            )}
                        </div>
                        
                        {/* ... form state ... */}
                        {workflow.fields && workflow.fields.length > 0 && (
                            <div className="space-y-4">
                                {workflow.fields.map(field => (
                                    <div key={field.id}>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{field.label}</label>
                                        {field.type === 'textarea' ? (
                                            <textarea value={formState[field.variable] || ''} onChange={e => setFormState(prev => ({ ...prev, [field.variable]: e.target.value }))} placeholder={`请输入${field.label}...`} className="w-full p-3 text-sm bg-white dark:bg-gray-800 border border-gray-200 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none h-24" />
                                        ) : (
                                            <input type="text" value={formState[field.variable] || ''} onChange={e => setFormState(prev => ({ ...prev, [field.variable]: e.target.value }))} placeholder={`请输入${field.label}...`} className="w-full p-3 text-sm bg-white dark:bg-gray-800 border border-gray-200 rounded-lg focus:ring-2 focus:ring-sky-500" />
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                        
                        <button onClick={handleGenerate} disabled={isLoading} className="w-full py-3 bg-sky-600 text-white font-bold rounded-xl hover:bg-sky-500 transition-all flex items-center justify-center gap-2 disabled:bg-gray-400">
                            {isLoading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Sparkles className="w-5 h-5" />}
                            运行工作流
                        </button>
                    </div>
                </div>

                <div className="lg:col-span-2 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm flex flex-col overflow-hidden relative">
                     <LoadingOverlay isVisible={showOverlay} onClose={() => setShowOverlay(false)} />
                     <h3 className="font-bold text-gray-900 dark:text-white mb-4 flex-shrink-0">执行结果</h3>
                     {result ? (
                         <div className="flex-1 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg">
                             {result}
                         </div>
                     ) : (
                         <div className="flex-1 flex items-center justify-center text-gray-400 dark:text-gray-600 flex-col">
                             <Sparkles className="w-16 h-16 mb-4 opacity-10" />
                             <p>结果将显示在这里</p>
                         </div>
                     )}
                </div>
            </div>
        </div>
    );
};

export default WorkflowRun;
