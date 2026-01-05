
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Sparkles, X, Check, BookOpen, Database, Box } from './Icon';

const CURRENT_VERSION = 'v1.3.0';
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
                <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-br from-sky-500 to-purple-600 opacity-10 pointer-events-none" />
                
                <div className="p-8 relative">
                    <button 
                        onClick={handleClose} 
                        className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>

                    <div className="flex flex-col items-center text-center mb-8">
                        <div className="w-16 h-16 bg-gradient-to-br from-sky-400 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg mb-4 text-white rotate-3">
                            <Sparkles className="w-8 h-8" />
                        </div>
                        <h2 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">
                            奇思妙写 <span className="text-sky-600">{CURRENT_VERSION}</span> 更新
                        </h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 font-medium">
                            为您带来更流畅、更美观的创作体验
                        </p>
                    </div>

                    <div className="space-y-6">
                        {/* Section 1 */}
                        <div className="space-y-3">
                            <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <span className="p-1 bg-sky-100 dark:bg-sky-900/30 rounded text-sky-600 dark:text-sky-400"><BookOpen className="w-3.5 h-3.5" /></span>
                                创作中心升级
                            </h3>
                            <ul className="text-xs text-gray-600 dark:text-gray-300 space-y-2 pl-2 leading-relaxed">
                                <li className="flex gap-2">
                                    <span className="text-sky-500 font-bold">•</span>
                                    <span><strong>生成体验优化：</strong>AI 结果页现已全屏覆盖，并采用沉浸式纯文本渲染（移除 Markdown 格式），阅读更舒适。</span>
                                </li>
                                <li className="flex gap-2">
                                    <span className="text-sky-500 font-bold">•</span>
                                    <span><strong>便捷操作：</strong>结果页底部新增“插入正文”与“停止生成”按钮，交互更高效。</span>
                                </li>
                                <li className="flex gap-2">
                                    <span className="text-sky-500 font-bold">•</span>
                                    <span><strong>工具栏更新：</strong>优化了字号调节与斜体图标设计，移除冗余分割线，界面更清爽。</span>
                                </li>
                            </ul>
                        </div>

                        {/* Section 2 */}
                        <div className="space-y-3">
                            <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <span className="p-1 bg-purple-100 dark:bg-purple-900/30 rounded text-purple-600 dark:text-purple-400"><Database className="w-3.5 h-3.5" /></span>
                                素材库焕新
                            </h3>
                            <ul className="text-xs text-gray-600 dark:text-gray-300 space-y-2 pl-2 leading-relaxed">
                                <li className="flex gap-2">
                                    <span className="text-purple-500 font-bold">•</span>
                                    <span><strong>视觉轻量化：</strong>卡片高度缩减，采用纯白背景并去除了标题分割线，浏览更轻松。</span>
                                </li>
                                <li className="flex gap-2">
                                    <span className="text-purple-500 font-bold">•</span>
                                    <span><strong>详情页重构：</strong>顶部与底部布局更紧凑，标签管理移至底部，并隐藏了滚动条，最大化内容展示区域。</span>
                                </li>
                            </ul>
                        </div>

                        {/* Section 3 */}
                        <div className="space-y-3">
                            <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <span className="p-1 bg-amber-100 dark:bg-amber-900/30 rounded text-amber-600 dark:text-amber-400"><Box className="w-3.5 h-3.5" /></span>
                                提示词与功能优化
                            </h3>
                            <ul className="text-xs text-gray-600 dark:text-gray-300 space-y-2 pl-2 leading-relaxed">
                                <li className="flex gap-2">
                                    <span className="text-amber-500 font-bold">•</span>
                                    <span><strong>新增功能：</strong>提示词库新增“仿写”标签与分类；搜索框位置调整至更顺手区域。</span>
                                </li>
                                <li className="flex gap-2">
                                    <span className="text-amber-500 font-bold">•</span>
                                    <span><strong>体验修复：</strong>全面汉化提示词标签；修复了工作流中非本人创建者昵称显示为匿名的问题。</span>
                                </li>
                            </ul>
                        </div>
                    </div>

                    <button 
                        onClick={handleClose}
                        className="mt-8 w-full py-3 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-xl shadow-lg shadow-sky-500/30 transition-all active:scale-95 flex items-center justify-center gap-2"
                    >
                        <Check className="w-4 h-4" /> 开启新版本体验
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default VersionUpdateModal;
