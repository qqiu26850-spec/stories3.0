
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
    'writing': '写稿'
};

const PromptCard: React.FC<PromptCardProps> = ({ prompt, onSelect, onDelete, onEdit, isFavorited = false, onToggleFavorite, isOwner }) => {
  
  return (
    <div 
        onClick={() => onSelect(prompt)}
        className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 hover:shadow-lg hover:border-sky-500 transition-all duration-300 cursor-pointer group flex flex-col h-full relative"
    >
        <div className="flex justify-between items-start mb-2">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white group-hover:text-sky-600 transition-colors line-clamp-1">{prompt.title}</h3>
            {onToggleFavorite && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onToggleFavorite(prompt.id);
                    }}
                    className={`p-1.5 rounded-full transition-colors ${isFavorited ? 'text-red-500 bg-red-50 dark:bg-red-900/20' : 'text-gray-400 hover:text-red-500 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                    title={isFavorited ? '取消收藏' : '收藏'}
                >
                    <Heart className={`w-5 h-5 ${isFavorited ? 'fill-current' : ''}`} />
                </button>
            )}
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-1.5 mb-3">
            <span className={`px-2 py-0.5 rounded text-[10px] font-medium border ${
                prompt.category === 'long-story' ? 'bg-purple-50 text-purple-600 border-purple-100 dark:bg-purple-900/20 dark:border-purple-800' :
                prompt.category === 'script' ? 'bg-pink-50 text-pink-600 border-pink-100 dark:bg-pink-900/20 dark:border-pink-800' :
                'bg-sky-50 text-sky-600 border-sky-100 dark:bg-sky-900/20 dark:border-sky-800'
            }`}>
                {prompt.category === 'long-story' ? '长篇' : prompt.category === 'script' ? '剧本' : '短篇'}
            </span>
            {prompt.subCategories && prompt.subCategories.map((sub) => (
                <span key={sub} className="px-2 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-500 border border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700">
                    {SUB_CATEGORY_LABELS[sub] || sub}
                </span>
            ))}
        </div>

        <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed mb-4 line-clamp-3 flex-grow">
            {prompt.description}
        </p>
        
        <div className="flex items-center justify-between text-sm text-gray-400 pt-4 border-t border-gray-100 dark:border-gray-800 mt-auto">
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-1 text-orange-400">
                    <Fire className="w-4 h-4" />
                    <span>{prompt.heat}</span>
                </div>
            </div>
            <div className="flex items-center gap-1.5">
                <UserCircle className="w-4 h-4" />
                <span>
                    {prompt.creator === 'user' 
                        ? (prompt.authorName || '社区用户') 
                        : '官方'}
                </span>
                {isOwner && prompt.creator === 'user' && (
                    <div className="flex gap-1 ml-2">
                        {onEdit && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onEdit(prompt);
                                }}
                                className="p-1 hover:text-sky-500 transition-colors"
                                title="编辑"
                            >
                                <Pencil className="w-4 h-4" />
                            </button>
                        )}
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onDelete(prompt);
                            }}
                            className="p-1 hover:text-red-500 transition-colors"
                            title="删除"
                        >
                            <Trash className="w-4 h-4" />
                        </button>
                    </div>
                )}
            </div>
        </div>
    </div>
  );
};

export default PromptCard;
