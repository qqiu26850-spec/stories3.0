
import React, { useState, useEffect } from 'react';
import { Prompt } from '../types';
import { Fire, UserCircle, Heart } from './Icon';
import { GENRE_TAGS } from '../constants';

interface SelectablePromptCardProps {
  prompt: Prompt;
  onSelect: () => void;
}

const FAVORITES_STORAGE_KEY = 'qisimiaoxie_prompt_favorites_v2';

const CATEGORY_LABELS: Record<string, string> = {
    'long-story': '长篇小说',
    'short-story': '短篇小说',
    'script': '剧本',
    'general': '全类型'
};

const SUB_CATEGORY_LABELS: Record<string, string> = {
    'idea': '创意', 'golden_finger': '金手指', 'character_design': '人物设定', 'worldview': '世界观',
    'outline': '大纲', 'detailed_outline': '细纲', 'synopsis': '简介', 'requirements': '写作要求',
    'style': '写作风格', 'continue': '续写', 'polish': '润色', 'proofread': '校对', 'writing': '写稿',
    'expand': '扩写', 'imitate': '仿写',
    'general': '通用', 'modern-romance': '现言', 'ancient-romance': '古言', 'period': '年代',
    'apocalypse': '末世', 'urban': '都市', 'fantasy': '玄幻', 'history': '历史', 'social': '世情',
    'suspense': '悬疑', 'sci-fi': '科幻', 'comic-drama': '漫剧', 'live-action': '实拍剧'
};

const isGenre = (tag: string) => GENRE_TAGS.some(g => g.id === tag);

const SelectablePromptCard: React.FC<SelectablePromptCardProps> = ({ prompt, onSelect }) => {
  const [isFavorited, setIsFavorited] = useState(false);

  // 同步收藏状态
  useEffect(() => {
    const stored = localStorage.getItem(FAVORITES_STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) setIsFavorited(parsed.includes(prompt.id));
      } catch (e) {}
    }
  }, [prompt.id]);

  const handleToggleFavorite = (e: React.MouseEvent) => {
    e.stopPropagation();
    const stored = localStorage.getItem(FAVORITES_STORAGE_KEY);
    let favorites = [];
    try { favorites = JSON.parse(stored || '[]'); } catch (e) {}
    
    if (isFavorited) {
      favorites = favorites.filter((id: string) => id !== prompt.id);
    } else {
      favorites.push(prompt.id);
    }
    
    localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favorites));
    setIsFavorited(!isFavorited);
  };

  return (
    <div
      onClick={onSelect}
      className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 hover:shadow-lg hover:border-sky-500 transition-all duration-300 cursor-pointer group flex flex-col h-full relative"
    >
        <div className="flex justify-between items-start mb-1">
            <h3 className="text-[15px] font-bold text-gray-900 dark:text-white group-hover:text-sky-600 transition-colors line-clamp-1 tracking-tight pr-6" title={prompt.title}>
                {prompt.title}
            </h3>
            <button 
                onClick={handleToggleFavorite} 
                className={`absolute top-4 right-4 p-1.5 rounded-full transition-colors z-10 ${isFavorited ? 'text-red-500 bg-red-50' : 'text-gray-400 hover:text-red-500'}`}
            >
                <Heart className={`w-4 h-4 ${isFavorited ? 'fill-current' : ''}`} />
            </button>
        </div>
        
        <p className="text-gray-500 dark:text-gray-400 text-xs leading-relaxed mb-4 line-clamp-3 flex-grow">
            {prompt.description}
        </p>

        <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-800 mt-auto gap-2">
            <div className="flex items-center gap-1.5 overflow-hidden flex-wrap max-h-6 flex-1">
                <span className="flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold border bg-sky-50 text-sky-600 border-sky-100 dark:bg-sky-900/20 dark:text-sky-400 dark:border-sky-800">
                    {CATEGORY_LABELS[prompt.category] || '全类型'}
                </span>
                {prompt.subCategories && prompt.subCategories.slice(0, 2).map((sub) => (
                    <span key={sub} className={`flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold border whitespace-nowrap ${isGenre(sub as string) ? 'bg-purple-50 text-purple-600 border-purple-100 dark:bg-purple-900/20 dark:text-purple-300' : 'bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-900/20 dark:text-blue-300'}`}>
                        {SUB_CATEGORY_LABELS[sub] || sub}
                    </span>
                ))}
            </div>
            
            <div className="flex items-center gap-3 flex-shrink-0 text-xs text-gray-400">
                <div className="flex items-center gap-1 text-orange-400">
                    <Fire className="w-3 h-3" />
                    <span>{prompt.heat}</span>
                </div>
                <div className="flex items-center gap-1">
                    <UserCircle className="w-3 h-3" />
                    <span className="max-w-[60px] truncate">{prompt.authorName || '用户'}</span>
                </div>
            </div>
        </div>
    </div>
  );
};

export default SelectablePromptCard;
