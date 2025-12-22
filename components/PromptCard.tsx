import React, { useState } from 'react';
import { Prompt, PromptSubCategory } from '../types';
import { Heart, Fire, UserCircle, Trash, Pencil } from './Icon';
import { GENRE_TAGS, FUNCTIONAL_TAGS } from '../constants';

interface PromptCardProps {
  prompt: Prompt;
  onSelect: (prompt: Prompt) => void;
  onDelete: (prompt: Prompt) => void;
  onEdit?: (prompt: Prompt) => void;
  isFavorited?: boolean;
  onToggleFavorite?: (id: string) => void;
  isOwner?: boolean;
}

const SUB_CATEGORY_LABELS: Record<string, string> = {
    'idea': '创意', 'golden_finger': '金手指', 'character_design': '人物设定', 'worldview': '世界观',
    'outline': '大纲', 'detailed_outline': '细纲', 'synopsis': '简介', 'requirements': '写作要求',
    'style': '写作风格', 'continue': '续写', 'polish': '润色', 'proofread': '校对', 'writing': '写稿',
    'general': '通用', 'modern-romance': '现言', 'ancient-romance': '古言', 'period': '年代',
    'apocalypse': '末世', 'urban': '都市', 'fantasy': '玄幻', 'history': '历史', 'social': '世情',
    'suspense': '悬疑', 'sci-fi': '科幻'
};

const CATEGORY_LABELS: Record<string, string> = {
    'long-story': '长篇小说', 
    'short-story': '短篇小说', 
    'script': '剧本', 
    'general': '全类型'
};

const isGenre = (tag: string) => GENRE_TAGS.some(g => g.id === tag);

const PromptCard: React.FC<PromptCardProps> = ({ prompt, onSelect, onDelete, onEdit, isFavorited = false, onToggleFavorite, isOwner }) => {
  return (
    <div onClick={() => onSelect(prompt)} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 hover:shadow-lg hover:border-sky-500 transition-all duration-300 cursor-pointer group flex flex-col h-full relative">
        <div className="flex justify-between items-start mb-2 gap-2">
            <h3 className="text-sm sm:text-[15px] font-bold text-gray-900 dark:text-white group-hover:text-sky-600 transition-colors line-clamp-2 leading-snug flex-1" title={prompt.title}>
                {prompt.title}
            </h3>
            {onToggleFavorite && (
                <button onClick={(e) => { e.stopPropagation(); onToggleFavorite(prompt.id); }} className={`p-1.5 rounded-full transition-colors shrink-0 ${isFavorited ? 'text-red-500 bg-red-50' : 'text-gray-400 hover:text-red-500'}`} title={isFavorited ? '取消收藏' : '收藏'}>
                    <Heart className={`w-4 h-4 ${isFavorited ? 'fill-current' : ''}`} />
                </button>
            )}
        </div>
        <p className="text-gray-500 dark:text-gray-400 text-[11px] leading-relaxed mb-4 line-clamp-2 flex-grow">{prompt.description}</p>
        <div className="flex flex-col gap-3 pt-3 border-t mt-auto">
            <div className="flex flex-wrap gap-1.5 overflow-hidden">
                {/* 总是显示主分类 */}
                <span className="flex-shrink-0 px-1.5 py-0.5 rounded text-[9px] font-black border bg-sky-50 text-sky-600 border-sky-100 dark:bg-sky-900/40 dark:text-sky-400 dark:border-sky-800 uppercase tracking-tighter">
                    {CATEGORY_LABELS[prompt.category] || '全类型'}
                </span>
                {/* 显示题材和功能标签 */}
                {prompt.subCategories?.map((sub) => (
                    <span key={sub} className={`flex-shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold border whitespace-nowrap ${isGenre(sub as string) ? 'bg-purple-50 text-purple-600 border-purple-100 dark:bg-purple-900/30 dark:text-purple-400' : 'bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-900/30 dark:text-blue-400'}`}>
                        {SUB_CATEGORY_LABELS[sub] || sub}
                    </span>
                ))}
            </div>
            <div className="flex items-center justify-between text-[10px] text-gray-400">
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 text-orange-400 font-bold"><Fire className="w-3 h-3" /><span>{prompt.heat}</span></div>
                    <div className="flex items-center gap-1"><UserCircle className="w-3 h-3" /><span>{prompt.authorName || '用户'}</span></div>
                </div>
                {isOwner && (
                    <div className="flex gap-2 pl-2 border-l border-gray-100 dark:border-gray-800">
                        <button onClick={(e) => { e.stopPropagation(); onEdit?.(prompt); }} className="hover:text-sky-500 transition-colors"><Pencil className="w-3 h-3" /></button>
                        <button onClick={(e) => { e.stopPropagation(); onDelete(prompt); }} className="hover:text-red-500 transition-colors"><Trash className="w-3 h-3" /></button>
                    </div>
                )}
            </div>
        </div>
    </div>
  );
};

export default PromptCard;