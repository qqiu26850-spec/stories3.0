import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Prompt } from '../types';
import { X, Sparkles, Copy, BookOpen, Film, Fire, UserCircle, Eye, EyeSlash, Check } from './Icon';
import { GENRE_TAGS } from '../constants';

interface PromptDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    prompt: Prompt | null;
    onRun?: (filledValues: Record<string, string>) => void;
}

// Internal formatting component shared with CreativeGeneration
const MiniFormattedText: React.FC<{ text: string }> = ({ text }) => {
    const counters = [0, 0, 0, 0, 0, 0];
    return (
        <div className="whitespace-pre-wrap font-sans text-gray-800 dark:text-gray-200 leading-relaxed text-sm">
            {text.split('\n').map((line, index) => {
                const trimmedLine = line.trim();
                const isMarkdownHeader = trimmedLine.startsWith('#');
                if (isMarkdownHeader) {
                    const match = trimmedLine.match(/^(#+)\s*(.*)/);
                    if (match) {
                        const level = Math.min(match[1].length, 6);
                        const content = match[2];
                        counters[level-1]++;
                        for(let i=level; i<6; i++) counters[i] = 0;
                        const prefix = counters.slice(0, level).join('.') + (level === 1 ? '.' : '') + ' ';
                        let className = "font-bold text-gray-900 dark:text-white ";
                        if (level === 1) className += "text-lg mt-4 mb-2";
                        else if (level === 2) className += "text-base mt-3 mb-1.5";
                        else className += "text-sm mt-2 mb-1";
                        return <div key={index} className={className}>{prefix}{content}</div>;
                    }
                }
                const parts = line.split(/(\*\*.*?\*\*)/g);
                return (
                    <div key={index} className="min-h-[1.5em] mb-1">
                        {parts.map((part, i) => {
                            if (part.startsWith('**') && part.endsWith('**')) {
                                return <span key={i} className="font-bold text-gray-900 dark:text-white">{part.slice(2, -2)}</span>;
                            }
                            return <span key={i}>{part}</span>;
                        })}
                    </div>
                );
            })}
        </div>
    );
};

const SUB_CATEGORY_LABELS: Record<string, string> = {
    'idea': '创意', 'golden_finger': '金手指', 'character_design': '人设', 'worldview': '世界观',
    'outline': '大纲', 'detailed_outline': '细纲', 'synopsis': '简介', 'requirements': '要求',
    'style': '风格', 'continue': '续写', 'polish': '润色', 'proofread': '校对', 'writing': '写稿',
    'general': '全类型', 'modern-romance': '现言', 'ancient-romance': '古言', 'period': '年代',
    'apocalypse': '末世', 'urban': '都市', 'fantasy': '玄幻', 'history': '历史', 'social': '世情',
    'suspense': '悬疑', 'sci-fi': '科幻'
};

const CATEGORY_LABELS: Record<string, string> = {
    'long-story': '长篇', 'short-story': '短篇', 'script': '剧本', 'general': '全类型',
};

const isGenre = (tag: string) => GENRE_TAGS.some(g => g.id === tag);

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

    const handleCopy = () => {
        let filledTemplate = prompt.template || prompt.content;
        for (const key in formState) {
            filledTemplate = filledTemplate.replace(new RegExp(`\\$\\{${key}\\}`, 'g'), formState[key]);
        }
        navigator.clipboard.writeText(filledTemplate);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
    };

    const getCategoryStyle = (cat: string) => {
        switch(cat) {
            case 'long-story': return { bg: 'bg-gradient-to-br from-violet-500 to-indigo-600', icon: BookOpen, accent: 'text-purple-600', ring: 'focus:ring-purple-500', badge: 'bg-purple-100 text-purple-700 border-purple-100' };
            case 'short-story': return { bg: 'bg-gradient-to-br from-sky-400 to-blue-600', icon: Sparkles, accent: 'text-sky-600', ring: 'focus:ring-sky-500', badge: 'bg-sky-50 text-sky-600 border-sky-100' };
            case 'script': return { bg: 'bg-gradient-to-br from-rose-400 to-red-500', icon: Film, accent: 'text-rose-600', ring: 'focus:ring-rose-500', badge: 'bg-rose-100 text-rose-700 border-rose-100' };
            default: return { bg: 'bg-gradient-to-br from-gray-500 to-zinc-600', icon: Sparkles, accent: 'text-gray-600', ring: 'focus:ring-gray-500', badge: 'bg-gray-50 text-gray-600 border-gray-100' };
        }
    };

    const style = getCategoryStyle(prompt.category);
    const CategoryIcon = style.icon;

    return createPortal(
        <div className="fixed inset-0 bg-black/60 dark:bg-black/80 flex items-center justify-center z-[9999] p-4 backdrop-blur-md transition-all duration-300" onClick={onClose}>
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col relative max-h-[90vh] animate-fade-in-up border border-gray-200 dark:border-gray-800" onClick={e => e.stopPropagation()}>
                <div className="flex items-start gap-4 p-5 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
                    <div className={`w-12 h-12 rounded-xl shadow-md flex items-center justify-center flex-shrink-0 ${style.bg} text-white`}><CategoryIcon className="w-6 h-6" /></div>
                    <div className="flex-1 pt-0.5">
                        <div className="flex justify-between items-start">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white leading-tight mb-1">{prompt.title}</h2>
                            <button onClick={onClose} className="p-1.5 -mr-2 -mt-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-[10px] mt-1">
                            <span className={`px-1.5 py-0.5 rounded font-bold border ${style.badge}`}>{CATEGORY_LABELS[prompt.category] || '全类型'}</span>
                            {prompt.subCategories?.map(tag => (
                                <span key={tag} className={`px-1.5 py-0.5 rounded font-bold border ${
                                    isGenre(tag as string) 
                                    ? 'bg-purple-50 text-purple-600 border-purple-100 dark:bg-purple-900/20 dark:border-purple-800 dark:text-purple-300' 
                                    : 'bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-300'
                                }`}>{SUB_CATEGORY_LABELS[tag] || tag}</span>
                            ))}
                            <div className="w-px h-3 bg-gray-300 dark:bg-gray-700 mx-1"></div>
                            <span className="flex items-center gap-1 text-gray-500"><UserCircle className="w-3.5 h-3.5" />{prompt.authorName || '用户'}</span>
                            <span className="flex items-center gap-1 text-orange-500"><Fire className="w-3.5 h-3.5" />{prompt.heat}</span>
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-6 bg-gray-50/50 dark:bg-black/20">
                    <div className="bg-sky-50 dark:bg-sky-900/10 p-4 rounded-xl border border-sky-100 dark:border-sky-900/30 shadow-sm">
                        <h4 className="text-sm font-black text-sky-600 dark:text-sky-400 uppercase mb-2 flex items-center gap-1">📝 简介</h4>
                        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed font-medium whitespace-pre-wrap">{prompt.description || "暂无简介"}</p>
                    </div>

                    {prompt.example && (
                         <div className="bg-amber-50/50 dark:bg-amber-900/10 p-4 rounded-xl border border-amber-100 dark:border-amber-900/30">
                            <h4 className="text-sm font-black text-amber-600 dark:text-amber-400 uppercase mb-3 flex items-center gap-1.5">
                                <Sparkles className="w-4 h-4" /> 效果预览
                            </h4>
                            <div className="bg-white/80 dark:bg-black/40 p-5 rounded-xl shadow-inner border border-amber-100/50">
                                <MiniFormattedText text={prompt.example} />
                            </div>
                        </div>
                    )}

                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2"><Sparkles className={`w-4 h-4 ${style.accent}`} />参数设置</h3>
                            <button onClick={() => setShowRawTemplate(!showRawTemplate)} className="text-xs flex items-center gap-1 text-gray-400 hover:text-sky-500 px-2 py-1 rounded hover:bg-gray-100">{showRawTemplate ? <EyeSlash className="w-3.5 h-3.5"/> : <Eye className="w-3.5 h-3.5"/>}{showRawTemplate ? '隐藏模板' : '查看模板'}</button>
                        </div>
                        {showRawTemplate && <div className="p-3 bg-gray-900 rounded-xl text-gray-300 font-mono text-xs border border-gray-700 whitespace-pre-wrap">{prompt.template}</div>}
                        <div className="grid gap-4">
                            {prompt.fields?.map((field, index) => (
                                <div key={field.id}>
                                    <label className="block text-sm font-bold text-gray-600 dark:text-gray-300 mb-1.5"><span className="opacity-50 mr-1">{index + 1}.</span> {field.label}</label>
                                    {field.type === 'textarea' ? (
                                        <textarea value={formState[field.id] || ''} onChange={(e) => setFormState(prev => ({...prev, [field.id]: e.target.value}))} className={`w-full h-24 p-3 text-sm bg-white dark:bg-gray-900 border border-gray-200 rounded-xl text-gray-900 dark:text-white outline-none shadow-sm ${style.ring} focus:ring-2 focus:border-transparent transition-all`} />
                                    ) : (
                                        <input type="text" value={formState[field.id] || ''} onChange={(e) => setFormState(prev => ({...prev, [field.id]: e.target.value}))} className={`w-full p-3 text-sm bg-white dark:bg-gray-900 border border-gray-200 rounded-xl text-gray-900 dark:text-white outline-none shadow-sm ${style.ring} focus:ring-2 focus:border-transparent transition-all`} />
                                    )}
                                    {field.description && <p className="text-[10px] text-blue-600 dark:text-blue-400 font-bold mt-1.5 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded inline-block">💡 {field.description}</p>}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
               
                <div className="p-5 bg-white dark:bg-gray-900 border-t border-gray-100 flex gap-3">
                    <button onClick={handleCopy} className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-700 font-bold hover:bg-gray-50 flex items-center justify-center gap-2 active:scale-[0.98] transition-all">
                        {copied ? <><Check className="w-5 h-5 text-green-600" /> 已复制</> : <><Copy className="w-5 h-5" /> 复制全文</>}
                    </button>
                    {onRun && <button onClick={() => onRun(formState)} className={`flex-[1.5] py-3 rounded-xl text-white font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-sky-500/20 active:scale-[0.98] ${style.bg}`}><Sparkles className="w-5 h-5" />使用 AI 生成</button>}
                </div>
            </div>
        </div>,
        document.body
    );
};

export default PromptDetailModal;