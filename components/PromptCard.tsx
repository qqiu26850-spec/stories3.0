
import React, { useState } from 'react';
import { Prompt, PromptSubCategory } from '../types';
import { Heart, Fire, UserCircle, Trash, Pencil } from './Icon';

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
    // Functions
    'idea': '创意',
    'golden_finger': '金手指',
    'character_design': '人设',
    'worldview': '世界观',
    'outline': '大纲',
    'detailed_outline': '细纲',
    'synopsis': '简介',
    'requirements': '要求',
    'style': '风格',
    'continue': '续写',
    'polish': '润色',
    'proofread': '校对',
    'writing': '写稿',
    // Genres
    'modern-romance': '现言',
    'ancient-romance': '古言',
    'period': '年代',
    'apocalypse': '末世',
    'urban': '都市',
    'fantasy': '玄幻',
    'history': '历史',
    'social': '世情',
    'suspense': '悬疑',
    'sci-fi': '科幻'
};

const CATEGORY_LABELS: Record<string, string> = {
    'long-story': '长篇',
    'short-story': '短篇',
    'script': '剧本',
};

const PromptCard: React.FC<PromptCardProps> = ({ prompt, onSelect, onDelete, onEdit, isFavorited = false, onToggleFavorite, isOwner }) => {
  
  return (
    <div 
        onClick={() => onSelect(prompt)}
        className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 hover:shadow-lg hover:border-sky-500 transition-all duration-300 cursor-pointer group flex flex-col h-full relative"
    >
        <div className="flex justify-between items-start mb-2">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white group-hover:text-sky-600 transition-colors line-clamp-1">{prompt.title}</h3>
            {onToggleFavorite && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onToggleFavorite(prompt.id);
                    }}
                    className={`p-1.5 rounded-full transition-colors flex-shrink-0 ${isFavorited ? 'text-red-500 bg-red-50 dark:bg-red-900/20' : 'text-gray-400 hover:text-red-500 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                    title={isFavorited ? '取消收藏' : '收藏'}
                >
                    <Heart className={`w-4 h-4 ${isFavorited ? 'fill-current' : ''}`} />
                </button>
            )}
        </div>

        <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed mb-4 line-clamp-3 flex-grow">
            {prompt.description}
        </p>
        
        {/* Single Line Footer: Tags Left, Meta Right */}
        <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-800 mt-auto gap-2">
            {/* Left: Tags */}
            <div className="flex items-center gap-1.5 overflow-hidden mask-linear-fade">
                <span className={`flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium border bg-sky-50 text-sky-600 border-sky-100 dark:bg-sky-900/20 dark:border-sky-800`}>
                    {CATEGORY_LABELS[prompt.category] || prompt.category}
                </span>
                {prompt.subCategories && prompt.subCategories.slice(0, 2).map((sub) => (
                    <span key={sub} className="flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-500 border border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700 whitespace-nowrap">
                        {SUB_CATEGORY_LABELS[sub] || sub}
                    </span>
                ))}
            </div>

            {/* Right: Meta & Actions */}
            <div className="flex items-center gap-3 flex-shrink-0 text-xs text-gray-400">
                <div className="flex items-center gap-1 text-orange-400" title="热度">
                    <Fire className="w-3 h-3" />
                    <span>{prompt.heat}</span>
                </div>
                
                <div className="flex items-center gap-1" title="创建者">
                    <UserCircle className="w-3 h-3" />
                    <span className="truncate max-w-[60px]">
                        {prompt.creator === 'user' 
                            ? (prompt.authorName || '用户') 
                            : '官方'}
                    </span>
                </div>

                {isOwner && prompt.creator === 'user' && (
                    <div className="flex gap-1 border-l border-gray-200 dark:border-gray-700 pl-2 ml-1">
                        {onEdit && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onEdit(prompt);
                                }}
                                className="hover:text-sky-500 transition-colors"
                                title="编辑"
                            >
                                <Pencil className="w-3 h-3" />
                            </button>
                        )}
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onDelete(prompt);
                            }}
                            className="hover:text-red-500 transition-colors"
                            title="删除"
                        >
                            <Trash className="w-3 h-3" />
                        </button>
                    </div>
                )}
            </div>
        </div>
    </div>
  );
};

export default PromptCard;
