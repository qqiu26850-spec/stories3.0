
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Workflow } from '../types';
import { X, Sparkles, BookOpen, Bolt, Play, InformationCircle } from './Icon';

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

    const formattedDate = workflow.createdAt ? new Date(workflow.createdAt).toLocaleDateString() : '';

    return createPortal(
        <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col relative max-h-[90vh] animate-fade-in-up font-sans" onClick={e => e.stopPropagation()}>
                <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-start bg-white dark:bg-gray-900">
                    <div className="flex-1">
                        <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-3 flex items-baseline gap-3">
                            {workflow.title}
                            {formattedDate && <span className="text-xs text-gray-400 font-normal">{formattedDate}</span>}
                        </h2>
                        <div className="flex flex-wrap gap-2 text-xs font-bold">
                            <span className="px-2.5 py-1 rounded-md bg-purple-50 text-purple-600 border border-purple-100 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800">{CATEGORY_LABELS[workflow.category] || '全类型'}</span>
                            {/* Changed Automation Chain badge color from gray to blue */}
                            <span className="px-2.5 py-1 rounded-md bg-blue-50 text-blue-600 border border-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800">
                                自动化链路：{workflow.steps?.length || 0} 步骤
                            </span>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"><X className="w-6 h-6"/></button>
                </div>

                <div className="flex-1 overflow-y-auto p-8 space-y-8 font-sans">
                    <div className="space-y-5">
                        <div className="bg-purple-50/50 dark:bg-purple-900/10 p-6 rounded-2xl space-y-3 border border-purple-100 dark:border-purple-800/50">
                            <h4 className="text-lg font-bold text-purple-700 dark:text-purple-300 flex items-center gap-2"><BookOpen className="w-5 h-5" /> 工作流介绍</h4>
                            {/* Added whitespace-pre-wrap to support line breaks */}
                            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed font-medium whitespace-pre-wrap">{workflow.description}</p>
                        </div>

                        <div className="bg-white dark:bg-gray-800/20 p-6 rounded-2xl space-y-4 border border-gray-100 dark:border-gray-800">
                            <h4 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2"><Sparkles className="w-5 h-5 text-amber-500" /> 创作流程预览</h4>
                            <div className="space-y-3 pl-2">
                                {workflow.steps?.map((step, idx) => (
                                    <div key={idx} className="flex items-center gap-3 text-sm font-medium text-gray-600 dark:text-gray-400">
                                        <div className="w-6 h-6 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-500 flex items-center justify-center font-bold text-xs shadow-sm">{idx + 1}</div>
                                        <span>{step.name}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="space-y-6 pt-2">
                        <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2"><Bolt className="w-5 h-5 text-sky-500" />参数填写预览</h3>
                            <span className="text-xs font-bold text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">仅供预览，不可编辑</span>
                        </div>
                        <div className="space-y-6">
                            {workflow.fields?.map((field, index) => (
                                <div key={field.id} className="space-y-2 opacity-80">
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">
                                        <span className="opacity-50 mr-2">{index + 1}.</span> {field.label}
                                        <span className="ml-1 text-red-500 font-normal">*</span>
                                    </label>
                                    {field.type === 'textarea' ? (
                                        <textarea 
                                            readOnly
                                            disabled
                                            value=""
                                            placeholder={`[预览] 请输入${field.label}...`}
                                            className="w-full h-20 p-3 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none resize-none cursor-not-allowed" 
                                        />
                                    ) : (
                                        <input 
                                            type="text" 
                                            readOnly
                                            disabled
                                            value=""
                                            placeholder={`[预览] 请输入${field.label}...`}
                                            className="w-full p-3 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none cursor-not-allowed" 
                                        />
                                    )}
                                    {field.description && (
                                        <div className="flex items-start gap-1.5 mt-1.5">
                                            <InformationCircle className="w-3.5 h-3.5 text-blue-500 mt-0.5 shrink-0" />
                                            <p className="text-xs text-blue-600 dark:text-blue-400 font-medium leading-relaxed">{field.description}</p>
                                        </div>
                                    )}
                                </div>
                            ))}
                            {(!workflow.fields || workflow.fields.length === 0) && (
                                <div className="text-sm text-gray-400 italic py-8 text-center bg-gray-50 dark:bg-gray-900 rounded-xl border border-dashed border-gray-200 dark:border-gray-800">
                                    该工作流无须填入初始参数。
                                </div>
                            )}
                        </div>
                    </div>
                </div>
               
                <div className="p-6 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 flex justify-end">
                    {onRun && (
                        <button 
                            onClick={() => onRun(formState)} 
                            className="w-full sm:w-auto px-12 py-3.5 rounded-xl bg-purple-600 text-white font-black flex items-center justify-center gap-2 shadow-xl shadow-purple-500/20 active:scale-95 transition-all hover:bg-purple-500 text-base"
                        >
                            <Play className="w-5 h-5" /> 立即运行流程
                        </button>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
};

export default WorkflowDetailModal;
