
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Workflow } from '../types';
/* Added Play to the imports below */
import { X, Sparkles, Copy, BookOpen, Fire, UserCircle, Check, Bolt, DocumentText, Play } from './Icon';

interface WorkflowDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    workflow: Workflow | null;
    onRun?: (filledValues: Record<string, string>) => void;
}

const CATEGORY_LABELS: Record<string, string> = {
    'long-story': '长篇', 'short-story': '短篇', 'script': '剧本', 'general': '通用',
};

const WorkflowDetailModal: React.FC<WorkflowDetailModalProps> = ({ isOpen, onClose, workflow, onRun }) => {
    const [formState, setFormState] = useState<Record<string, string>>({});
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (workflow) {
            const initialFormState = workflow.fields?.reduce((acc, field) => {
                acc[field.variable] = '';
                return acc;
            }, {} as Record<string, string>);
            setFormState(initialFormState || {});
        }
    }, [workflow]);

    if (!isOpen || !workflow) return null;

    const handleCopyLogic = () => {
        const text = `工作流：${workflow.title}\n描述：${workflow.description}\n步骤数：${workflow.steps?.length || 0}`;
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    // Fix: Explicitly ensuring createPortal receives correct number of arguments (JSX, container)
    return createPortal(
        <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col relative max-h-[90vh] animate-fade-in-up font-sans" onClick={e => e.stopPropagation()}>
                <div className="p-5 border-b border-gray-100 dark:border-gray-800 flex justify-between items-start bg-white dark:bg-gray-900">
                    <div className="flex-1">
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{workflow.title}</h2>
                        <div className="flex flex-wrap gap-2 text-[10px]">
                            <span className="px-2 py-0.5 rounded font-bold bg-sky-50 text-sky-600 border border-sky-100 dark:bg-sky-900/30 dark:text-sky-400 dark:border-sky-800">{CATEGORY_LABELS[workflow.category] || '全类型'}</span>
                            <span className="px-2 py-0.5 rounded font-bold bg-purple-50 text-purple-600 border border-purple-100 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800">
                                自动化链路：{workflow.steps?.length || 0} 步骤
                            </span>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600"><X className="w-6 h-6"/></button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6 font-sans">
                    <div className="space-y-4">
                        <div className="bg-sky-50 dark:bg-sky-900/10 p-4 rounded-xl space-y-2 border border-sky-100 dark:border-sky-800/50">
                            <h4 className="text-xs font-bold text-sky-600 flex items-center gap-1.5"><BookOpen className="w-3.5 h-3.5" /> 工作流介绍</h4>
                            <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">{workflow.description}</p>
                        </div>

                        <div className="bg-purple-50 dark:bg-purple-900/10 p-4 rounded-xl space-y-3 border border-purple-100 dark:border-purple-800/50">
                            <h4 className="text-xs font-bold text-purple-600 flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5" /> 创作流程预览</h4>
                            <div className="space-y-2">
                                {workflow.steps?.map((step, idx) => (
                                    <div key={idx} className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                                        <span className="w-5 h-5 rounded-full bg-purple-100 dark:bg-purple-900/50 text-purple-600 flex items-center justify-center font-bold text-[10px]">{idx + 1}</span>
                                        <span>{step.name}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4 pt-2">
                        <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-2">
                            <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2"><Bolt className="w-4 h-4 text-amber-500" />参数填写预览</h3>
                            <span className="text-[10px] text-gray-400 italic">运行前需填写的初始表单</span>
                        </div>
                        <div className="space-y-5">
                            {workflow.fields?.map((field, index) => (
                                <div key={field.id} className="space-y-2">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                        <span className="opacity-50 mr-1">{index + 1}.</span> {field.label}
                                        <span className="ml-1 text-red-500 font-normal">*</span>
                                    </label>
                                    {field.type === 'textarea' ? (
                                        <textarea 
                                            value={formState[field.variable] || ''} 
                                            onChange={e => setFormState({...formState, [field.variable]: e.target.value})} 
                                            placeholder={`请输入${field.label}...`}
                                            className="w-full h-24 p-3 text-sm bg-gray-50 dark:bg-gray-800 border dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none transition-all shadow-sm" 
                                        />
                                    ) : (
                                        <input 
                                            type="text" 
                                            value={formState[field.variable] || ''} 
                                            onChange={e => setFormState({...formState, [field.variable]: e.target.value})} 
                                            placeholder={`请输入${field.label}...`}
                                            className="w-full p-3 text-sm bg-gray-50 dark:bg-gray-800 border dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none transition-all shadow-sm" 
                                        />
                                    )}
                                </div>
                            ))}
                            {(!workflow.fields || workflow.fields.length === 0) && (
                                <div className="text-xs text-gray-400 italic py-4 text-center">该工作流无须填入初始参数。</div>
                            )}
                        </div>
                    </div>
                </div>
               
                <div className="p-5 border-t border-gray-100 dark:border-gray-800 flex gap-3 bg-white dark:bg-gray-900">
                    <button onClick={handleCopyLogic} className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-gray-700 font-bold hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center justify-center gap-2 transition-all">
                        {copied ? <Check className="w-5 h-5 text-green-500" /> : <DocumentText className="w-5 h-5" />}
                        {copied ? '已复制概要' : '复制工作流信息'}
                    </button>
                    {onRun && <button onClick={() => onRun(formState)} className="flex-[1.5] py-3 rounded-xl bg-sky-600 text-white font-bold flex items-center justify-center gap-2 shadow-lg shadow-sky-500/20 active:scale-95 transition-all hover:bg-sky-500 font-black"><Play className="w-5 h-5" />立即运行流程</button>}
                </div>
            </div>
        </div>,
        document.body
    );
};

export default WorkflowDetailModal;
