
import React, { useState } from 'react';
import { Prompt } from '../types';
import { Heart, Fire, UserCircle, Trash } from './Icon';

interface PromptCardProps {
  prompt: Prompt;
  onSelect: (prompt: Prompt) => void;
  onDelete: (prompt: Prompt) => void;
  isFavorited?: boolean;
  onToggleFavorite?: (id: string) => void;
  isOwner?: boolean;
}

const PromptCard: React.FC<PromptCardProps> = ({ prompt, onSelect, onDelete, isFavorited = false, onToggleFavorite, isOwner }) => {
  
  return (
    <div 
        onClick={() => onSelect(prompt)}
        className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 hover:shadow-lg hover:border-sky-500 transition-all duration-300 cursor-pointer group flex flex-col h-full relative"
    >
        <div className="flex justify-between items-start mb-3">
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

        <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed mb-6 h-10 line-clamp-2 flex-grow">
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
                        ? (isOwner ? '我' : '社区用户') 
                        : '官方'}
                </span>
                {isOwner && prompt.creator === 'user' && (
                     <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onDelete(prompt);
                        }}
                        className="ml-2 p-1 hover:text-red-500 transition-colors"
                        title="删除"
                    >
                        <Trash className="w-4 h-4" />
                    </button>
                )}
            </div>
        </div>
    </div>
  );
};

export default PromptCard;
