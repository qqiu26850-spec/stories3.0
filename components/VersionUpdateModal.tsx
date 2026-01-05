
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Check, Play } from './Icon';

const CURRENT_VERSION = 'v1.4.0';
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
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-fade-in-up font-sans relative">
                {/* Decorative Header Background */}
                <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-br from-sky-500 to-blue-600 opacity-10 pointer-events-none" />
                
                <div className="p-8 relative">
                    <button 
                        onClick={handleClose} 
                        className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors z-10"
                    >
                        <X className="w-6 h-6" />
                    </button>

                    {/* Header: Icon Side-by-Side with Title */}
                    <div className="flex items-center gap-6 mb-8 mt-2">
                        <div className="w-16 h-16 bg-gradient-to-br from-sky-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-xl text-white shrink-0 ring-4 ring-white dark:ring-gray-900">
                            <Play className="w-8 h-8 ml-1" />
                        </div>
                        <div className="flex flex-col pt-2">
                            <h2 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">
                                奇思妙写 <span className="text-sky-600">{CURRENT_VERSION}</span>
                            </h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 font-bold tracking-wide">
                                无限续写 · 突破篇幅限制
                            </p>
                        </div>
                    </div>

                    <div className="space-y-6">
                        {/* Feature Intro Box */}
                        <div className="bg-sky-50 dark:bg-sky-900/20 p-5 rounded-2xl border border-sky-100 dark:border-sky-800">
                            <h3 className="text-lg font-bold text-sky-800 dark:text-sky-300 mb-3 flex items-center gap-2">
                                ✨ 新增：智能续写 (Continue Generation)
                            </h3>
                            <p className="text-base text-gray-700 dark:text-gray-300 leading-relaxed">
                                长篇创作不再受限！当 AI 输出的内容因长度限制而中断时，编辑器底部会自动出现续写按钮。
                            </p>
                        </div>

                        {/* How to use */}
                        <div className="space-y-3 px-1">
                            <h4 className="text-base font-bold text-gray-900 dark:text-white">如何使用？</h4>
                            <ul className="space-y-4">
                                <li className="flex items-start gap-4">
                                    <div className="w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 flex items-center justify-center font-bold text-sm shrink-0 mt-0.5">1</div>
                                    <p className="text-base text-gray-600 dark:text-gray-300 leading-snug">
                                        在任意创作界面（创意生成、小说、剧本）生成内容。
                                    </p>
                                </li>
                                <li className="flex items-start gap-4">
                                    <div className="w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 flex items-center justify-center font-bold text-sm shrink-0 mt-0.5">2</div>
                                    <div className="text-base text-gray-600 dark:text-gray-300 leading-snug">
                                        若内容未完结，点击底部的
                                        <span className="inline-flex items-center gap-1 mx-2 px-3 py-1 rounded-lg bg-sky-600 text-white text-xs font-bold shadow-sm align-middle">
                                            <Play className="w-3 h-3" /> 继续生成
                                        </span>
                                        按钮。
                                    </div>
                                </li>
                                <li className="flex items-start gap-4">
                                    <div className="w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 flex items-center justify-center font-bold text-sm shrink-0 mt-0.5">3</div>
                                    <p className="text-base text-gray-600 dark:text-gray-300 leading-snug">
                                        AI 将自动读取上文逻辑，<span className="text-sky-600 font-bold">无缝衔接</span>继续创作。
                                    </p>
                                </li>
                            </ul>
                        </div>
                    </div>

                    <button 
                        onClick={handleClose}
                        className="mt-10 w-full py-4 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-2xl shadow-xl shadow-sky-500/30 transition-all active:scale-95 flex items-center justify-center gap-2 text-base"
                    >
                        <Check className="w-5 h-5" /> 立即体验
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default VersionUpdateModal;
