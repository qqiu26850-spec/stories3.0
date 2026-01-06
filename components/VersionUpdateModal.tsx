
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Check, Sparkles, AdjustmentsHorizontal, BookOpen } from './Icon';

const CURRENT_VERSION = 'v1.5.0';
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
                                2026.01.06 · 体验升级 · 专注创作
                            </p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        {/* Feature 1: Short Story Mode */}
                        <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
                            <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                                <BookOpen className="w-4 h-4 text-indigo-500" />
                                短篇模式精简
                            </h3>
                            <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                                为短篇创作量身定制。移除章节列表与标题栏，提供纯净的沉浸式单页写作环境。
                            </p>
                        </div>

                        {/* Feature 2: Settings Redesign */}
                        <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
                            <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                                <AdjustmentsHorizontal className="w-4 h-4 text-indigo-500" />
                                设定面板重构
                            </h3>
                            <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                                告别繁杂的输入框。全新的卡片式管理 + 弹窗录入，让作品设定管理更加条理清晰。
                            </p>
                        </div>

                        {/* Feature 3: Interaction Optimization */}
                        <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-xl border border-indigo-100 dark:border-indigo-800">
                            <h3 className="text-sm font-bold text-indigo-800 dark:text-indigo-300 mb-2 flex items-center gap-2">
                                ✨ 交互精度提升
                            </h3>
                            <ul className="space-y-1.5">
                                <li className="flex items-start gap-2 text-xs text-indigo-900 dark:text-indigo-200">
                                    <span className="text-indigo-500 font-bold">•</span>
                                    <span>AI 面板的“需修改内容”现仅在<strong>主动选中</strong>文本时自动填充，避免误操作。</span>
                                </li>
                                <li className="flex items-start gap-2 text-xs text-indigo-900 dark:text-indigo-200">
                                    <span className="text-indigo-500 font-bold">•</span>
                                    <span>模型参数（温度、Top P）增加了详细的中文释义。</span>
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
