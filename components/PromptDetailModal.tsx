
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Prompt } from '../types';
import { X, Sparkles, Copy, BookOpen, Film, Fire, UserCircle, Eye, EyeSlash, Check } from './Icon';

interface PromptDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    prompt: Prompt | null;
    onRun?: (filledValues: Record<string, string>) => void;
}

const PromptDetailModal: React.FC<PromptDetailModalProps> = ({ isOpen, onClose, prompt, onRun }) => {
    const [formState, setFormState] = useState<Record<string, string>>({});
    const [copied, setCopied] = useState(false);
    const [showRawTemplate, setShowRawTemplate] = useState(false);

    useEffect(() => {
        if (prompt) {
            const initialFormState = prompt.fields.reduce((acc, field) => {
                acc[field.id] = '';
                return acc;
            }, {} as Record<string, string>);
            setFormState(initialFormState);
            setCopied(false);
            setShowRawTemplate(false);
        }
    }, [prompt]);

    if (!isOpen || !prompt) return null;

    const handleFormChange = (id: string, value: string) => {
        setFormState(prev => ({ ...prev, [id]: value }));
    };

    const getFilledTemplate = () => {
        let filledTemplate = prompt.template || prompt.content;
        if (prompt.fields) {
            for (const key in formState) {
                filledTemplate = filledTemplate.replace(new RegExp(`\\$\\{${key}\\}`, 'g'), formState[key]);
            }
        }
        return filledTemplate;
    };

    const handleCopy = () => {
        const text = getFilledTemplate();
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
    };
    
    const handleRun = () => {
        if (onRun) {
            onRun(formState);
        }
    };

    const isTemplateBased = prompt.fields && prompt.fields.length > 0;

    // Aesthetic Helpers
    const getCategoryStyle = (cat: string) => {
        switch(cat) {
            case 'long-story': return { 
                bg: 'bg-gradient-to-br from-violet-500 via-purple-600 to-indigo-600', 
                icon: BookOpen, 
                label: '长篇小说',
                accent: 'text-purple-600 dark:text-purple-400',
                ring: 'focus:ring-purple-500',
                badge: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
            };
            case 'short-story': return { 
                bg: 'bg-gradient-to-br from-sky-400 via-blue-500 to-cyan-600', 
                icon: Sparkles, 
                label: '短篇小说',
                accent: 'text-sky-600 dark:text-sky-400',
                ring: 'focus:ring-sky-500',
                badge: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300'
            };
            case 'script': return { 
                bg: 'bg-gradient-to-br from-rose-400 via-pink-500 to-red-500', 
                icon: Film, 
                label: '剧本创作',
                accent: 'text-rose-600 dark:text-rose-400',
                ring: 'focus:ring-rose-500',
                badge: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300'
            };
            default: return { 
                bg: 'bg-gradient-to-br from-slate-500 via-gray-600 to-zinc-600', 
                icon: Sparkles, 
                label: '通用',
                accent: 'text-gray-600 dark:text-gray-400',
                ring: 'focus:ring-gray-500',
                badge: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300'
            };
        }
    };

    const style = getCategoryStyle(prompt.category);
    const CategoryIcon = style.icon;

    return createPortal(
        <div className="fixed inset-0 bg-black/60 dark:bg-black/80 flex items-center justify-center z-[9999] p-4 backdrop-blur-md transition-all duration-300" onClick={onClose}>
            <div 
                className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col relative max-h-[90vh] animate-fade-in-up border border-gray-200 dark:border-gray-800" 
                onClick={e => e.stopPropagation()}
            >
                {/* Clean Compact Header (Removed Large Blank Banner) */}
                <div className="flex items-start justify-between p-6 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 z-20 relative">
                    <div className="flex items-start gap-5 pr-8">
                        <div className={`w-14 h-14 rounded-2xl shadow-lg flex items-center justify-center flex-shrink-0 ${style.bg} text-white`}>
                            <CategoryIcon className="w-8 h-8" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white leading-tight mb-2">
                                {prompt.title}
                            </h2>
                            <div className="flex flex-wrap items-center gap-2">
                                <span className={`px-2 py-0.5 rounded text-xs font-bold ${style.badge}`}>
                                    {style.label}
                                </span>
                                <span className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded text-xs font-medium text-gray-600 dark:text-gray-400">
                                    <UserCircle className="w-3 h-3" />
                                    {prompt.creator === 'system' ? '官方' : (prompt.authorName || '用户')}
                                </span>
                                <span className="flex items-center gap-1 bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 px-2 py-0.5 rounded text-xs font-medium">
                                    <Fire className="w-3 h-3" />
                                    {prompt.heat}
                                </span>
                                {prompt.subCategories?.slice(0, 3).map(tag => (
                                    <span key={tag} className="text-xs px-2 py-0.5 rounded border border-gray-200 dark:border-gray-700 text-gray-500">
                                        #{tag}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                    <button 
                        onClick={onClose} 
                        className="p-2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors -mr-2 -mt-2"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Main Content Area */}
                <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 bg-white dark:bg-gray-900">
                    {/* Description Box */}
                    <div className="bg-gray-50 dark:bg-gray-800/50 p-5 rounded-xl border border-gray-100 dark:border-gray-800/50 relative">
                        <h4 className="text-xs font-bold text-gray-400 uppercase mb-2 tracking-wider">简介</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                            {prompt.description}
                        </p>
                    </div>

                    {/* Configuration Form */}
                    {isTemplateBased ? (
                        <div className="space-y-5">
                            <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-800">
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                    <Sparkles className={`w-5 h-5 ${style.accent}`} />
                                    配置参数
                                </h3>
                                <button 
                                    onClick={() => setShowRawTemplate(!showRawTemplate)}
                                    className="text-xs flex items-center gap-1 text-gray-400 hover:text-sky-500 transition-colors px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
                                >
                                    {showRawTemplate ? <EyeSlash className="w-3.5 h-3.5"/> : <Eye className="w-3.5 h-3.5"/>}
                                    {showRawTemplate ? '隐藏代码' : '查看代码'}
                                </button>
                            </div>

                            {showRawTemplate && (
                                <div className="p-4 bg-gray-900 rounded-xl text-gray-300 font-mono text-xs overflow-x-auto border border-gray-700 shadow-inner animate-fade-in">
                                    {prompt.template}
                                </div>
                            )}

                            <div className="grid gap-5">
                                {prompt.fields.map(field => (
                                    <div key={field.id} className="group">
                                        <label htmlFor={field.id} className={`block text-sm font-bold text-gray-600 dark:text-gray-300 mb-2 transition-colors group-focus-within:${style.accent.split(' ')[0]}`}>
                                            {field.label}
                                            {field.required !== false && <span className="text-red-500 ml-1">*</span>}
                                            {field.required === false && <span className="text-gray-400 text-xs font-normal ml-1">(选填)</span>}
                                        </label>
                                        {field.type === 'textarea' ? (
                                            <textarea
                                                id={field.id}
                                                value={formState[field.id] || ''}
                                                onChange={(e) => handleFormChange(field.id, e.target.value)}
                                                placeholder={field.placeholder}
                                                className={`w-full h-28 p-3 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white outline-none transition-all resize-none shadow-sm hover:border-gray-300 dark:hover:border-gray-600 ${style.ring} focus:ring-2 focus:border-transparent`}
                                            />
                                        ) : (
                                            <input
                                                type="text"
                                                id={field.id}
                                                value={formState[field.id] || ''}
                                                onChange={(e) => handleFormChange(field.id, e.target.value)}
                                                placeholder={field.placeholder}
                                                className={`w-full p-3 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white outline-none transition-all shadow-sm hover:border-gray-300 dark:hover:border-gray-600 ${style.ring} focus:ring-2 focus:border-transparent`}
                                            />
                                        )}
                                        {field.description && (
                                            <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-500">{field.description}</p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                         <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 shadow-sm">
                            <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                                <span className="w-1 h-4 rounded-full bg-sky-500"></span>
                                提示词内容
                            </h4>
                            <div className="max-h-60 overflow-y-auto custom-scrollbar">
                                <pre className="whitespace-pre-wrap text-sm text-gray-600 dark:text-gray-400 font-mono leading-relaxed bg-gray-50 dark:bg-black/30 p-4 rounded-lg border border-gray-100 dark:border-gray-800/50">
                                    {prompt.content}
                                </pre>
                            </div>
                        </div>
                    )}
                </div>
               
                {/* Footer Action Bar */}
                <div className="flex-shrink-0 p-5 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 flex gap-3 z-10 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.02)]">
                    <button
                        onClick={handleCopy}
                        className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-bold hover:bg-gray-50 dark:hover:bg-gray-800 transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
                    >
                        {copied ? (
                            <span className="text-green-600 dark:text-green-400 flex items-center gap-2 animate-fade-in">
                                <Check className="w-5 h-5" /> 已复制
                            </span>
                        ) : (
                            <>
                                <Copy className="w-5 h-5" />
                                复制全文
                            </>
                        )}
                    </button>
                    {onRun && (
                        <button
                            onClick={handleRun}
                            className={`flex-[1.5] py-3 rounded-xl text-white font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-sky-500/20 active:scale-[0.98] hover:shadow-sky-500/40 hover:-translate-y-0.5 ${style.bg}`}
                        >
                            <Sparkles className="w-5 h-5" />
                            使用 AI 生成
                        </button>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
};

export default PromptDetailModal;
