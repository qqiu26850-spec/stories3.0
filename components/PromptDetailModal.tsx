
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
                ring: 'focus:ring-purple-500'
            };
            case 'short-story': return { 
                bg: 'bg-gradient-to-br from-sky-400 via-blue-500 to-cyan-600', 
                icon: Sparkles, 
                label: '短篇小说',
                accent: 'text-sky-600 dark:text-sky-400',
                ring: 'focus:ring-sky-500'
            };
            case 'script': return { 
                bg: 'bg-gradient-to-br from-rose-400 via-pink-500 to-red-500', 
                icon: Film, 
                label: '剧本创作',
                accent: 'text-rose-600 dark:text-rose-400',
                ring: 'focus:ring-rose-500'
            };
            default: return { 
                bg: 'bg-gradient-to-br from-slate-500 via-gray-600 to-zinc-600', 
                icon: Sparkles, 
                label: '通用',
                accent: 'text-gray-600 dark:text-gray-400',
                ring: 'focus:ring-gray-500'
            };
        }
    };

    const style = getCategoryStyle(prompt.category);
    const CategoryIcon = style.icon;

    return createPortal(
        <div className="fixed inset-0 bg-black/60 dark:bg-black/80 flex items-center justify-center z-[9999] p-4 backdrop-blur-md transition-all duration-300" onClick={onClose}>
            <div 
                className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col relative max-h-[90vh] animate-fade-in-up border border-gray-200 dark:border-gray-800" 
                onClick={e => e.stopPropagation()}
            >
                {/* Header Section with Decorative Elements */}
                <div className={`h-28 ${style.bg} relative flex-shrink-0 overflow-hidden group`}>
                    <div className="absolute inset-0 bg-white/10 dark:bg-black/10"></div>
                    
                    {/* Abstract Shapes */}
                    <div className="absolute -top-10 -right-10 w-48 h-48 bg-white/20 rounded-full blur-3xl group-hover:scale-110 transition-transform duration-700"></div>
                    <div className="absolute top-10 left-[-20px] w-32 h-32 bg-white/20 rounded-full blur-2xl"></div>
                    
                    <button 
                        onClick={onClose} 
                        className="absolute top-4 right-4 p-2 bg-black/10 hover:bg-black/30 text-white rounded-full transition-all backdrop-blur-sm z-20"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Main Content Area */}
                <div className="flex-1 overflow-y-auto px-8 pb-8 relative">
                    {/* Icon & Title Group - Overlapping Header */}
                    <div className="flex items-end gap-5 -mt-10 mb-6 relative z-10">
                        <div className="w-20 h-20 bg-white dark:bg-gray-900 rounded-2xl shadow-xl flex items-center justify-center border-4 border-white dark:border-gray-900 transform transition-transform hover:scale-105">
                            <CategoryIcon className={`w-10 h-10 ${style.accent}`} />
                        </div>
                        
                        <div className="flex-1 pb-1">
                            <div className="flex items-center gap-2 mb-1">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400`}>
                                    {style.label}
                                </span>
                                {prompt.subCategories?.slice(0,2).map(tag => (
                                    <span key={tag} className="px-2 py-0.5 rounded text-[10px] font-medium border border-gray-200 dark:border-gray-700 text-gray-500">
                                        #{tag}
                                    </span>
                                ))}
                            </div>
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white leading-tight line-clamp-1" title={prompt.title}>
                                {prompt.title}
                            </h2>
                        </div>
                    </div>

                    <div className="space-y-6">
                        {/* Meta Info Bar */}
                        <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 pb-4 border-b border-gray-100 dark:border-gray-800">
                            <span className="flex items-center gap-1.5">
                                <UserCircle className="w-4 h-4" />
                                作者: <span className="font-medium text-gray-900 dark:text-white">{prompt.creator === 'system' ? '官方' : (prompt.authorName || '用户')}</span>
                            </span>
                            <span className="w-px h-3 bg-gray-300 dark:bg-gray-700"></span>
                            <span className="flex items-center gap-1.5 text-orange-500">
                                <Fire className="w-4 h-4" />
                                热度: {prompt.heat}
                            </span>
                        </div>

                        {/* Description */}
                        <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-100 dark:border-gray-800/50 relative">
                            <h4 className="text-[10px] font-bold text-gray-400 uppercase mb-2 tracking-widest">简介</h4>
                            <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                                {prompt.description}
                            </p>
                        </div>

                        {/* Configuration Form */}
                        {isTemplateBased ? (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                        <Sparkles className={`w-4 h-4 ${style.accent}`} />
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
                                    <div className="p-3 bg-gray-900 rounded-lg text-gray-300 font-mono text-xs overflow-x-auto border border-gray-700 shadow-inner animate-fade-in">
                                        {prompt.template}
                                    </div>
                                )}

                                <div className="grid gap-4">
                                    {prompt.fields.map(field => (
                                        <div key={field.id} className="group">
                                            <label htmlFor={field.id} className={`block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1.5 transition-colors group-focus-within:${style.accent.split(' ')[0]}`}>
                                                {field.label}
                                                {field.required !== false && <span className="text-red-500 ml-0.5">*</span>}
                                                {field.required === false && <span className="text-gray-400 font-normal ml-1 text-[10px]">(选填)</span>}
                                            </label>
                                            {field.type === 'textarea' ? (
                                                <textarea
                                                    id={field.id}
                                                    value={formState[field.id] || ''}
                                                    onChange={(e) => handleFormChange(field.id, e.target.value)}
                                                    placeholder={field.placeholder}
                                                    className={`w-full h-24 p-3 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white outline-none transition-all resize-none shadow-sm hover:border-gray-300 dark:hover:border-gray-600 ${style.ring} focus:ring-2 focus:border-transparent`}
                                                />
                                            ) : (
                                                <input
                                                    type="text"
                                                    id={field.id}
                                                    value={formState[field.id] || ''}
                                                    onChange={(e) => handleFormChange(field.id, e.target.value)}
                                                    placeholder={field.placeholder}
                                                    className={`w-full p-3 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white outline-none transition-all shadow-sm hover:border-gray-300 dark:hover:border-gray-600 ${style.ring} focus:ring-2 focus:border-transparent`}
                                                />
                                            )}
                                            {field.description && (
                                                <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">{field.description}</p>
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
