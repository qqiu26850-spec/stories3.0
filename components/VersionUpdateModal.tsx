import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Check, Sparkles, ClipboardDocumentCheck, AdjustmentsHorizontal } from './Icon';

const CURRENT_VERSION = 'v1.9.0';
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
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto animate-fade-in-up font-sans relative">
                {/* Decorative Header Background */}
                <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-br from-sky-500 to-indigo-600 opacity-10 pointer-events-none" />
                
                <div className="p-6 relative">
                    <button 
                        onClick={handleClose} 
                        className="absolute top-4 right-4 p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors z-10"
                    >
                        <X className="w-5 h-5" />
                    </button>

                    {/* Header */}
                    <div className="flex items-center gap-4 mb-5 mt-1">
                        <div className="w-12 h-12 bg-gradient-to-br from-sky-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-xl text-white shrink-0 ring-4 ring-white dark:ring-gray-900">
                            <Sparkles className="w-6 h-6" />
                        </div>
                        <div className="flex flex-col pt-1">
                            <h2 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">
                                奇思妙写 <span className="text-indigo-600 dark:text-indigo-400">{CURRENT_VERSION}</span>
                            </h2>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 font-bold tracking-wide">
                                2026.11.13 · 全文语义审稿与万字长篇直出升级
                            </p>
                        </div>
                    </div>

                    <div className="space-y-3.5">
                        {/* Feature 1: Full-Context AI Semantic Review & Verification */}
                        <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
                            <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-1.5 flex items-center gap-2">
                                <ClipboardDocumentCheck className="w-4 h-4 text-indigo-500" />
                                AI 全文语义审稿 · 待核对与冲突忽略
                            </h3>
                            <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                                结合双栏完整语境精准识别真实人物与别名归并、人设前后一致性、上下文错别字及高相似桥段；支持存疑角色人工「确认为人物 / 不是人物 / 修改」、同音换序冲突「忽略 / 取消忽略」，并区分「重试失败部分」与「局部复检变更」。
                            </p>
                        </div>

                        {/* Feature 2: Floating Toolbar & Clean Summary Header */}
                        <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
                            <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-1.5 flex items-center gap-2">
                                <AdjustmentsHorizontal className="w-4 h-4 text-sky-500" />
                                审稿悬浮折叠工具栏 &amp; 精简汇总栏
                            </h3>
                            <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                                向下滚动仿写正文离开原工具栏时，右上角自动浮现轻量展开入口，随时切换「审稿问题高亮 / 相似度调色盘」且不改变阅读滚动位置；顶部汇总栏精简为「整体相似度｜审稿耗时」，视野更开阔。
                            </p>
                        </div>

                        {/* Feature 3: Fast Streaming & Multi-Act 10k+ Imitation Generation */}
                        <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-xl border border-indigo-100 dark:border-indigo-800">
                            <h3 className="text-sm font-bold text-indigo-800 dark:text-indigo-300 mb-1.5 flex items-center gap-2">
                                <Sparkles className="w-4 h-4" />
                                流式秒级响应 &amp; 3.1 万字仿写多幕直出
                            </h3>
                            <p className="text-xs text-indigo-900 dark:text-indigo-200 leading-relaxed">
                                全面修复历史 3.5 模型及流式长考无响应问题；各创作面板「最大长度」滑块上限提升至 <span className="font-bold">32768</span>，使用 Gemini 3.1 Flash Lite 等模型拉高滑块生成仿写或长篇正文时，自动启用多幕无缝接力直出万字长文。
                            </p>
                        </div>
                    </div>

                    <button 
                        onClick={handleClose}
                        className="mt-5 w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-xl shadow-indigo-500/30 transition-all active:scale-95 flex items-center justify-center gap-2 text-sm"
                    >
                        <Check className="w-4 h-4" /> 立即体验
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default VersionUpdateModal;
