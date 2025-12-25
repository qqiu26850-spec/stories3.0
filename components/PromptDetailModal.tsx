
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Prompt } from '../types';
import { X, Sparkles, Copy, BookOpen, Film, Fire, UserCircle, Eye, EyeSlash, Check, Bolt } from './Icon';
import { GENRE_TAGS } from '../constants';

interface PromptDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    prompt: Prompt | null;
    onRun?: (filledValues: Record<string, string>) => void;
}

const SUB_CATEGORY_LABELS: Record<string, string> = {
    'idea': '创意', 'golden_finger': '金手指', 'character_design': '人物设定', 'worldview': '世界观',
    'outline': '大纲', 'detailed_outline': '细纲', 'synopsis': '简介', 'requirements': '写作要求',
    'style': '写作风格', 'continue': '续写', 'polish': '润色', 'proofread': '校对', 'writing': '写稿',
    'expand': '扩写',
    'general': '通用', 'modern-romance': '现言', 'ancient-romance': '古言', 'period': '年代',
    'apocalypse': '末世', 'urban': '都市', 'fantasy': '玄幻', 'history': '历史', 'social': '世情',
    'suspense': '悬疑', 'sci-fi': '科幻'
};

const CATEGORY_LABELS: Record<string, string> = {
    'long-story': '长篇', 'short-story': '短篇', 'script': '剧本', 'general': '全类型',
};

const isGenre = (tag: string) => GENRE_TAGS.some(g => g.id === tag);

const PromptDetailModal: React.FC<PromptDetailModalProps> = ({ isOpen, onClose, prompt, onRun }) => {
    const [copied, setCopied] = useState(false);
    const [showRawTemplate, setShowRawTemplate] = useState(false);
    const [formState, setFormState] = useState<Record<string, string>>({});

    useEffect(() => {
        if (prompt) {
            const initial: Record<string, string> = {};
            prompt.fields?.forEach(f => initial[f.id] = '');
            setFormState(initial);
        }
    }, [prompt]);

    if (!isOpen || !prompt) return null;

    const handleCopy = () => {
        navigator.clipboard.writeText(prompt.template || prompt.content);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleRun = () => {
        if (onRun) {
            onRun(formState);
        }
    }

    const handleInputChange = (id: string, value: string) => {
        setFormState(prev => ({ ...prev, [id]: value }));
    };

    return createPortal(
        <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col relative max-h-[90vh] animate-fade-in-up font-sans" onClick={e => e.stopPropagation()}>
                <div className="p-5 border-b border-gray-100 dark:border-gray-800 flex justify-between items-start bg-white dark:bg-gray-900">
                    <div className="flex-1">
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{prompt.title}</h2>
                        <div className="flex flex-wrap gap-2 text-[10px]">
                            <span className="px-2 py-0.5 rounded font-bold bg-sky-50 text-sky-600 border border-sky-100">{CATEGORY_LABELS[prompt.category] || '全类型'}</span>
                            {prompt.subCategories?.map(tag => (
                                <span key={tag} className={`px-2 py-0.5 rounded font-bold border ${isGenre(tag as string) ? 'bg-purple-50 text-purple-600 border-purple-100' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>{SUB_CATEGORY_LABELS[tag] || tag}</span>
                            ))}
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600"><X className="w-6 h-6"/></button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6 font-sans">
                    <div className="space-y-4">
                        <div className="bg-sky-50 dark:bg-sky-900/10 p-4 rounded-xl space-y-2 border border-sky-100 dark:border-sky-800/50">
                            <h4 className="text-xs font-bold text-sky-600 flex items-center gap-1.5"><BookOpen className="w-3.5 h-3.5" /> 简介</h4>
                            <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">{prompt.description}</p>
                        </div>

                        {prompt.example && (
                            <div className="bg-orange-50 dark:bg-orange-900/10 p-4 rounded-xl space-y-2 border border-orange-100 dark:border-orange-800/50">
                                <h4 className="text-xs font-bold text-orange-600 flex items-center gap-1.5"><Bolt className="w-3.5 h-3.5" /> 效果示例</h4>
                                <div className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap opacity-90">
                                    {prompt.example}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="space-y-4 pt-2">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2"><Sparkles className="w-4 h-4 text-sky-500" />参数设置预览</h3>
                            <button onClick={() => setShowRawTemplate(!showRawTemplate)} className="text-[10px] text-gray-400 hover:text-sky-500 flex items-center gap-1">{showRawTemplate ? <EyeSlash className="w-3 h-3"/> : <Eye className="w-3 h-3"/>}查看模板</button>
                        </div>
                        {showRawTemplate && <div className="p-3 bg-gray-900 rounded-lg text-gray-300 font-mono text-[10px] whitespace-pre-wrap border border-gray-800">{prompt.template}</div>}
                        <div className="space-y-5">
                            {prompt.fields?.map((field, index) => (
                                <div key={field.id} className="space-y-2">
                                    <div className="flex justify-between items-center">
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                            <span className="opacity-50 mr-1">{index + 1}.</span> 
                                            {field.label}
                                            {field.required !== false ? (
                                                <span className="ml-1 text-red-500 font-normal">*</span>
                                            ) : (
                                                <span className="ml-1 text-gray-400 font-normal"> (选填)</span>
                                            )}
                                        </label>
                                        {field.maxLength && (
                                            <span className={`text-[10px] ${(formState[field.id]?.length || 0) > field.maxLength ? 'text-red-500 font-bold' : 'text-gray-400'}`}>
                                                {formState[field.id]?.length || 0} / {field.maxLength}
                                            </span>
                                        )}
                                    </div>
                                    {field.type === 'textarea' ? (
                                        <textarea
                                            value={formState[field.id] || ''}
                                            onChange={e => handleInputChange(field.id, e.target.value)}
                                            className="w-full h-24 p-3 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-sky-500 outline-none resize-none transition-all shadow-sm"
                                            placeholder={field.placeholder || "此处填写内容..."}
                                            maxLength={field.maxLength}
                                        />
                                    ) : (
                                        <input
                                            type="text"
                                            value={formState[field.id] || ''}
                                            onChange={e => handleInputChange(field.id, e.target.value)}
                                            className="w-full p-3 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-sky-500 outline-none transition-all shadow-sm"
                                            placeholder={field.placeholder || "此处填写内容..."}
                                            maxLength={field.maxLength}
                                        />
                                    )}
                                    {field.description && <p className="text-[10px] text-blue-600 dark:text-blue-400 mt-1 flex items-center gap-1 opacity-80 font-medium">💡 {field.description}</p>}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
               
                <div className="p-5 border-t border-gray-100 dark:border-gray-800 flex gap-3 bg-white dark:bg-gray-900">
                    <button onClick={handleCopy} className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-gray-700 font-bold hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center justify-center gap-2 transition-all">
                        {copied ? <Check className="w-5 h-5 text-green-500" /> : <Copy className="w-5 h-5" />}
                        {copied ? '已复制' : '复制模板'}
                    </button>
                    {onRun && <button onClick={handleRun} className="flex-[1.5] py-3 rounded-xl bg-sky-600 text-white font-bold flex items-center justify-center gap-2 shadow-lg shadow-sky-500/20 active:scale-95 transition-all hover:bg-sky-500"><Sparkles className="w-5 h-5" />去创作</button>}
                </div>
            </div>
        </div>,
        document.body
    );
};

export default PromptDetailModal;
