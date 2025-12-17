
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Prompt } from '../types';
import { X, Sparkles, Copy, BookOpen, Film, Fire, UserCircle, Eye, EyeSlash } from './Icon';

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
            case 'long-story': return { bg: 'bg-gradient-to-r from-violet-600 to-indigo-600', icon: BookOpen, label: '长篇小说' };
            case 'short-story': return { bg: 'bg-gradient-to-r from-sky-500 to-blue-600', icon: Sparkles, label: '短篇小说' };
            case 'script': return { bg: 'bg-gradient-to-r from-rose-500 to-pink-600', icon: Film, label: '剧本创作' };
            default: return { bg: 'bg-gradient-to-r from-gray-600 to-gray-800', icon: Sparkles, label: '通用' };
        }
    };

    const style = getCategoryStyle(prompt.category);
    const CategoryIcon = style.icon;

    return createPortal(
        <div className="fixed inset-0 bg-black/60 dark:bg-black/80 flex items-center justify-center z-[9999] p-4 backdrop-blur-sm" onClick={onClose}>
            <div 
                className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col relative max-h-[90vh] animate-fade-in-up border border-gray-200 dark:border-gray-800" 
                onClick={e => e.stopPropagation()}
            >
                {/* Header Section with Gradient */}
                <div className={`h-32 ${style.bg} relative flex-shrink-0`}>
                    <button 
                        onClick={onClose} 
                        className="absolute top-4 right-4 p-2 bg-black/20 hover:bg-black/40 text-white rounded-full transition-colors backdrop-blur-sm z-10"
                    >
                        <X className="w-5 h-5" />
                    </button>
                    {/* Decorative Circles */}
                    <div className="absolute top-0 left-0 w-full h-full overflow-hidden opacity-30">
                        <div className="absolute -top-10 -left-10 w-40 h-40 bg-white rounded-full mix-blend-overlay filter blur-2xl"></div>
                        <div className="absolute top-10 right-10 w-32 h-32 bg-white rounded-full mix-blend-overlay filter blur-2xl"></div>
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="flex-1 overflow-y-auto px-8 pb-8">
                    {/* Icon & Title Group - Overlapping Header */}
                    <div className="flex flex-col relative -mt-10 mb-6">
                        <div className="w-20 h-20 bg-white dark:bg-gray-900 rounded-2xl shadow-lg flex items-center justify-center mb-4 border-4 border-white dark:border-gray-900">
                            <CategoryIcon className={`w-10 h-10 ${style.bg.replace('bg-gradient-to-r', 'text-transparent bg-clip-text')}`} />
                        </div>
                        
                        <div className="flex flex-col gap-2">
                            <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white leading-tight">
                                {prompt.title}
                            </h2>
                            <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                                <span className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded text-xs font-medium">
                                    <UserCircle className="w-3.5 h-3.5" />
                                    {prompt.creator === 'system' ? '官方' : (prompt.authorName || '用户')}
                                </span>
                                <span className="flex items-center gap-1 bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 px-2 py-0.5 rounded text-xs font-medium">
                                    <Fire className="w-3.5 h-3.5" />
                                    {prompt.heat} 热度
                                </span>
                                {prompt.subCategories?.map(tag => (
                                    <span key={tag} className="text-xs px-2 py-0.5 rounded border border-gray-200 dark:border-gray-700">
                                        #{tag}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="space-y-8">
                        {/* Description */}
                        <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-100 dark:border-gray-800">
                            <h4 className="text-xs font-bold text-gray-400 uppercase mb-2 tracking-wider">简介</h4>
                            <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed">
                                {prompt.description}
                            </p>
                        </div>

                        {/* Configuration Form */}
                        {isTemplateBased ? (
                            <div>
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                        <Sparkles className="w-5 h-5 text-sky-500" />
                                        配置参数
                                    </h3>
                                    <button 
                                        onClick={() => setShowRawTemplate(!showRawTemplate)}
                                        className="text-xs flex items-center gap-1 text-gray-400 hover:text-sky-500 transition-colors"
                                    >
                                        {showRawTemplate ? <EyeSlash className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
                                        {showRawTemplate ? '隐藏模板代码' : '查看模板代码'}
                                    </button>
                                </div>

                                {showRawTemplate && (
                                    <div className="mb-6 p-4 bg-gray-900 rounded-lg text-gray-300 font-mono text-xs overflow-x-auto border border-gray-700 shadow-inner">
                                        {prompt.template}
                                    </div>
                                )}

                                <div className="space-y-5">
                                    {prompt.fields.map(field => (
                                        <div key={field.id} className="group">
                                            <label htmlFor={field.id} className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 group-focus-within:text-sky-600 dark:group-focus-within:text-sky-400 transition-colors">
                                                {field.label}
                                            </label>
                                            {field.type === 'textarea' ? (
                                                <textarea
                                                    id={field.id}
                                                    value={formState[field.id] || ''}
                                                    onChange={(e) => handleFormChange(field.id, e.target.value)}
                                                    placeholder={field.placeholder}
                                                    className="w-full h-32 p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition-all resize-y shadow-sm hover:border-gray-300 dark:hover:border-gray-600 text-sm leading-relaxed"
                                                />
                                            ) : (
                                                <input
                                                    type="text"
                                                    id={field.id}
                                                    value={formState[field.id] || ''}
                                                    onChange={(e) => handleFormChange(field.id, e.target.value)}
                                                    placeholder={field.placeholder}
                                                    className="w-full p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition-all shadow-sm hover:border-gray-300 dark:hover:border-gray-600 text-sm"
                                                />
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                             <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 shadow-sm">
                                <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-3">提示词内容</h4>
                                <pre className="whitespace-pre-wrap text-sm text-gray-600 dark:text-gray-400 font-mono leading-relaxed bg-gray-50 dark:bg-black/20 p-4 rounded-lg">
                                    {prompt.content}
                                </pre>
                            </div>
                        )}
                    </div>
                </div>
               
                {/* Footer Action Bar */}
                <div className="flex-shrink-0 p-6 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 flex gap-4 z-10">
                    <button
                        onClick={handleCopy}
                        className="flex-1 py-3.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-bold hover:bg-gray-50 dark:hover:bg-gray-800 transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
                    >
                        {copied ? (
                            <span className="text-green-600 dark:text-green-400 flex items-center gap-2">
                                <span className="text-lg">✓</span> 已复制
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
                            className={`flex-[2] py-3.5 rounded-xl text-white font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-sky-500/20 active:scale-[0.98] hover:shadow-sky-500/40 ${style.bg}`}
                        >
                            <Sparkles className="w-5 h-5" />
                            使用 AI 立即生成
                        </button>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
};

export default PromptDetailModal;
