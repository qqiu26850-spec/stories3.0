
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Check, Sparkles, AdjustmentsHorizontal, BookOpen, Workflow } from './Icon';

const CURRENT_VERSION = 'v1.6.0';
const STORAGE_KEY = `qisimiaoxie_version_seen_${CURRENT_VERSION}`;

const VersionUpdateModal: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        const seen = localStorage.getItem(STORAGE_KEY);
        if (!seen) {
            setIsOpen(true);
        }
    }, []);

    const handleClose = () => {
        localStorage.setItem(STORAGE_KEY, 'true');
        setIsOpen(false);
    };

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in-up font-sans relative">
                {/* Decorative Header Background */}
                <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-br from-indigo-500 to-purple-600 opacity-10 pointer-events-none" />
                
                <div className="p-6 relative">
                    <button 
                        onClick={handleClose} 
                        className="absolute top-4 right-4 p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors z-10"
                    >
                        <X className="w-5 h-5" />
                    </button>

                    {/* Header */}
                    <div className="flex items-center gap-4 mb-6 mt-1">
                        <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-xl text-white shrink-0 ring-4 ring-white dark:ring-gray-900">
                            <Sparkles className="w-6 h-6 ml-0.5" />
                        </div>
                        <div className="flex flex-col pt-1">
                            <h2 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">
                                奇思妙写 <span className="text-indigo-600">{CURRENT_VERSION}</span>
                            </h2>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 font-bold tracking-wide">
                                2026.01.10 · 工作流升级 · 交互优化
                            </p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        {/* Feature 1: Workflow Follow-up */}
                        <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
                            <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                                <Workflow className="w-4 h-4 text-indigo-500" />
                                工作流精准追问
                            </h3>
                            <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                                在工作流运行结果中，选中任意一段文字即可触发“追问”按钮。AI 将结合全文背景与您的具体指令，对选中内容进行定向优化或解答。
                            </p>
                        </div>

                        {/* Feature 2: Model Upgrade */}
                        <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
                            <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                                <Sparkles className="w-4 h-4 text-indigo-500" />
                                全线模型升级
                            </h3>
                            <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                                所有创作模块默认集成 Gemini 3.0 Flash 与 DeepSeek-V3，响应速度提升 40%，指令遵循能力显著增强。
                            </p>
                        </div>

                        {/* Feature 3: Short Story Mode */}
                        <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-xl border border-indigo-100 dark:border-indigo-800">
                            <h3 className="text-sm font-bold text-indigo-800 dark:text-indigo-300 mb-2 flex items-center gap-2">
                                ✨ 体验优化
                            </h3>
                            <ul className="space-y-1.5">
                                <li className="flex items-start gap-2 text-xs text-indigo-900 dark:text-indigo-200">
                                    <span className="text-indigo-500 font-bold">•</span>
                                    <span>优化了 AI 续写逻辑，确保长文本生成时的上下文连贯性。</span>
                                </li>
                                <li className="flex items-start gap-2 text-xs text-indigo-900 dark:text-indigo-200">
                                    <span className="text-indigo-500 font-bold">•</span>
                                    <span>修复了流式输出在网络波动时的中断问题。</span>
                                </li>
                            </ul>
                        </div>
                    </div>

                    <button 
                        onClick={handleClose}
                        className="mt-6 w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-xl shadow-indigo-500/30 transition-all active:scale-95 flex items-center justify-center gap-2 text-sm"
                    >
                        <Check className="w-4 h-4" /> 立即体验新版本
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default VersionUpdateModal;
