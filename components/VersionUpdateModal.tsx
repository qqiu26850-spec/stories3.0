
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Sparkles, X, Check, Play, AdjustmentsHorizontal, DocumentPlus } from './Icon';

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
                <div className="absolute top-0 left-0 right-0 h-28 bg-gradient-to-br from-sky-500 to-purple-600 opacity-10 pointer-events-none" />
                
                <div className="p-6 relative">
                    <button 
                        onClick={handleClose} 
                        className="absolute top-3 right-3 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors z-10"
                    >
                        <X className="w-5 h-5" />
                    </button>

                    {/* Header: Icon Side-by-Side with Title */}
                    <div className="flex items-center gap-5 mb-8 px-2 mt-2">
                        <div className="w-14 h-14 bg-gradient-to-br from-sky-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg text-white shrink-0">
                            <Play className="w-7 h-7 ml-1" />
                        </div>
                        <div className="flex flex-col">
                            <h2 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">
                                奇思妙写 <span className="text-sky-600">{CURRENT_VERSION}</span>
                            </h2>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-medium tracking-wide">
                                突破长度限制，创作无限续航
                            </p>
                        </div>
                    </div>

                    <div className="space-y-6">
                        {/* Section 1 */}
                        <div className="space-y-2">
                            <h3 className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <span className="p-1 bg-sky-100 dark:bg-sky-900/30 rounded text-sky-600 dark:text-sky-400"><Play className="w-3 h-3" /></span>
                                新增：智能续写功能
                            </h3>
                            <ul className="text-[11px] text-gray-600 dark:text-gray-300 space-y-2 pl-2 leading-relaxed">
                                <li className="flex gap-2">
                                    <span className="text-sky-500 font-bold mt-0.5">•</span>
                                    <span><strong>突破限制：</strong>当模型输出因长度限制而中断时，点击底部的<span className="text-sky-600 dark:text-sky-400 font-bold mx-1">“继续生成”</span>按钮，AI 将无缝衔接上文继续创作。</span>
                                </li>
                                <li className="flex gap-2">
                                    <span className="text-sky-500 font-bold mt-0.5">•</span>
                                    <span><strong>逻辑连贯：</strong>系统会自动读取生成的末尾内容作为上下文，确保续写内容在风格和逻辑上的高度一致。</span>
                                </li>
                            </ul>
                        </div>

                        {/* Section 2 */}
                        <div className="space-y-2">
                            <h3 className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <span className="p-1 bg-purple-100 dark:bg-purple-900/30 rounded text-purple-600 dark:text-purple-400"><DocumentPlus className="w-3 h-3" /></span>
                                全场景覆盖
                            </h3>
                            <ul className="text-[11px] text-gray-600 dark:text-gray-300 space-y-2 pl-2 leading-relaxed">
                                <li className="flex gap-2">
                                    <span className="text-purple-500 font-bold mt-0.5">•</span>
                                    <span><strong>多模块支持：</strong>无论是“创意生成”模块，还是创作中心的“长篇小说”、“短篇故事”、“剧本改编”面板，均已全线支持。</span>
                                </li>
                                <li className="flex gap-2">
                                    <span className="text-purple-500 font-bold mt-0.5">•</span>
                                    <span><strong>工作流集成：</strong>在执行复杂工作流时，如果步骤输出被截断，也可以手动点击继续，确保结果完整。</span>
                                </li>
                            </ul>
                        </div>

                        {/* Section 3 */}
                        <div className="space-y-2">
                            <h3 className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <span className="p-1 bg-amber-100 dark:bg-amber-900/30 rounded text-amber-600 dark:text-amber-400"><AdjustmentsHorizontal className="w-3 h-3" /></span>
                                体验优化
                            </h3>
                            <ul className="text-[11px] text-gray-600 dark:text-gray-300 space-y-2 pl-2 leading-relaxed">
                                <li className="flex gap-2">
                                    <span className="text-amber-500 font-bold mt-0.5">•</span>
                                    <span><strong>视觉反馈：</strong>优化了生成中的加载状态提示和按钮布局，操作反馈更清晰直观。</span>
                                </li>
                                <li className="flex gap-2">
                                    <span className="text-amber-500 font-bold mt-0.5">•</span>
                                    <span><strong>文本处理：</strong>优化了生成的纯文本渲染效果，自动过滤无关标记，阅读体验更沉浸。</span>
                                </li>
                            </ul>
                        </div>
                    </div>

                    <button 
                        onClick={handleClose}
                        className="mt-8 w-full py-3 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-xl shadow-lg shadow-sky-500/30 transition-all active:scale-95 flex items-center justify-center gap-2 text-sm"
                    >
                        <Check className="w-4 h-4" /> 开启无缝创作体验
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default VersionUpdateModal;
