
import React, { useState } from 'react';
import { Prompt, PromptSubCategory } from '../types';
import { Heart, Fire, UserCircle, Trash, Pencil } from './Icon';
import { GENRE_TAGS } from '../constants';

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

// 这里的映射名称与创建页面的 Label 保持一致
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
        <div className="flex justify-between items-start mb-2">
            <h3 className="text-base font-bold text-gray-900 dark:text-white group-hover:text-sky-600 transition-colors line-clamp-1">{prompt.title}</h3>
            {onToggleFavorite && (
                <button onClick={(e) => { e.stopPropagation(); onToggleFavorite(prompt.id); }} className={`p-1.5 rounded-full transition-colors ${isFavorited ? 'text-red-500 bg-red-50' : 'text-gray-400 hover:text-red-500'}`} title={isFavorited ? '取消收藏' : '收藏'}>
                    <Heart className={`w-4 h-4 ${isFavorited ? 'fill-current' : ''}`} />
                </button>
            )}
        </div>
        <p className="text-gray-500 dark:text-gray-400 text-xs leading-relaxed mb-4 line-clamp-3 flex-grow">{prompt.description}</p>
        <div className="flex items-center justify-between pt-3 border-t mt-auto gap-2">
            <div className="flex items-center gap-1.5 overflow-hidden flex-wrap max-h-12">
                {/* 主分类标签：琥珀色高亮显示，与子标签区分 */}
                <span className="flex-shrink-0 px-2 py-0.5 rounded text-[10px] font-black bg-amber-500 text-white shadow-sm ring-1 ring-amber-400/30">
                    {CATEGORY_LABELS[prompt.category] || '全类型'}
                </span>
                
                {/* 子标签：显示创建者选择的前2个关联标签 */}
                {prompt.subCategories?.slice(0, 2).map((sub) => (
                    <span key={sub} className={`flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold border whitespace-nowrap ${isGenre(sub as string) ? 'bg-purple-50 text-purple-600 border-purple-100' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>
                        {SUB_CATEGORY_LABELS[sub] || sub}
                    </span>
                ))}
            </div>
            <div className="flex items-center gap-3 flex-shrink-0 text-xs text-gray-400">
                <div className="flex items-center gap-1 text-orange-400"><Fire className="w-3 h-3" /><span>{prompt.heat}</span></div>
                {isOwner && (
                    <div className="flex gap-1 pl-2 border-l">
                        <button onClick={(e) => { e.stopPropagation(); onEdit?.(prompt); }} className="hover:text-sky-500"><Pencil className="w-3 h-3" /></button>
                        <button onClick={(e) => { e.stopPropagation(); onDelete(prompt); }} className="hover:text-red-500"><Trash className="w-3 h-3" /></button>
                    </div>
                )}
            </div>
        </div>
    </div>
  );
};

export default PromptCard;
