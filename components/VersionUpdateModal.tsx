
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Check, Sparkles, ClipboardDocumentCheck, AdjustmentsHorizontal } from './Icon';

const CURRENT_VERSION = 'v1.8.0';
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
                            <ClipboardDocumentCheck className="w-6 h-6" />
                        </div>
                        <div className="flex flex-col pt-1">
                            <h2 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">
                                奇思妙写 <span className="text-indigo-600 dark:text-indigo-400">{CURRENT_VERSION}</span>
                            </h2>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 font-bold tracking-wide">
                                2026.11.12 · 智能审稿比对中心重磅上线
                            </p>
                        </div>
                    </div>

                    <div className="space-y-3.5">
                        {/* Feature 1: Manuscript Review & Typo & Character Check */}
                        <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
                            <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-1.5 flex items-center gap-2">
                                <ClipboardDocumentCheck className="w-4 h-4 text-indigo-500" />
                                双栏智能审稿 · 错别字与人物同音严查
                            </h3>
                            <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                                创作中心下方新增「审稿」入口，支持原稿/仿写双栏录入与 Word 导入。自动标注错别字并支持一键修复；结合语境与百家姓规则精准提取人物称谓（杜绝常见词误判，自动剥离前导介词），严查重名与同音谐音并支持手动增删名单及一键替换。
                            </p>
                        </div>

                        {/* Feature 2: Similarity Palette & AI Rewrite */}
                        <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
                            <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-1.5 flex items-center gap-2">
                                <Sparkles className="w-4 h-4 text-sky-500" />
                                调色盘查重分级 &amp; AI 智能降重
                            </h3>
                            <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                                按字数加权评估整体相似度并智能豁免日常简短口语，分别提示整体与局部实质雷同长句。点击调色盘任意高亮句即可对照原句并生成 3 组全新句式的 AI 降重方案（内置超时保底，流畅不卡顿）。
                            </p>
                        </div>

                        {/* Feature 3: Free Resizing & One-Click Clear */}
                        <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-xl border border-indigo-100 dark:border-indigo-800">
                            <h3 className="text-sm font-bold text-indigo-800 dark:text-indigo-300 mb-1.5 flex items-center gap-2">
                                <AdjustmentsHorizontal className="w-4 h-4" />
                                面板自由拖拽 &amp; 一键全清复位
                            </h3>
                            <p className="text-xs text-indigo-900 dark:text-indigo-200 leading-relaxed">
                                下方审稿面板可在收起态至紧贴汇总栏之间任意高度自由拖拽并支持「收起/展开」高度记忆；顶部新增带二次确认弹窗的「全部清除」按钮，一键恢复初始待输入界面，方便连续检查多本小说。
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
