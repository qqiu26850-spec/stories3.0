import React from 'react';
import { Prompt } from '../types';
import { Fire, UserCircle } from './Icon';
import { GENRE_TAGS } from '../constants';

interface SelectablePromptCardProps {
  prompt: Prompt;
  onSelect: () => void;
}

const CATEGORY_LABELS: Record<string, string> = {
    'long-story': '长篇小说',
    'short-story': '短篇小说',
    'script': '剧本',
    'general': '全类型'
};

const SUB_CATEGORY_LABELS: Record<string, string> = {
    // Functions
    'idea': '创意',
    'golden_finger': '金手指',
    'character_design': '人物设定',
    'worldview': '世界观',
    'outline': '大纲',
    'detailed_outline': '细纲',
    'synopsis': '简介',
    'requirements': '写作要求',
    'style': '写作风格',
    'continue': '续写',
    'polish': '润色',
    'proofread': '校对',
    'writing': '写稿',
    // Genres
    'general': '通用',
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

const isGenre = (tag: string) => {
    return GENRE_TAGS.some(g => g.id === tag);
};

const SelectablePromptCard: React.FC<SelectablePromptCardProps> = ({ prompt, onSelect }) => {
  return (
    <button
      onClick={onSelect}
      className="w-full text-left p-5 bg-white dark:bg-gray-800 rounded-xl hover:shadow-lg hover:border-sky-500 border border-gray-200 dark:border-gray-700 transition-all group h-full flex flex-col relative"
    >
      <div className="flex justify-between items-start mb-2">
        <h4 className="font-bold text-gray-900 dark:text-white flex-grow pr-2 line-clamp-1 group-hover:text-sky-600 transition-colors">{prompt.title}</h4>
      </div>
      
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 flex-grow line-clamp-3 leading-relaxed">
        {prompt.description}
      </p>

      {/* Single Line Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-700 w-full mt-auto gap-2">
          
          {/* Left: Tags */}
          <div className="flex items-center gap-1.5 overflow-hidden flex-wrap max-h-6 flex-1">
             <span className={`flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium border bg-sky-50 text-sky-600 border-sky-100 dark:bg-sky-900/20 dark:border-sky-800 dark:text-sky-300`}>
                {CATEGORY_LABELS[prompt.category] || '全类型'}
            </span>
            {prompt.subCategories && prompt.subCategories.slice(0, 3).map((sub) => (
                <span key={sub} className={`flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium border whitespace-nowrap ${
                    isGenre(sub as string) 
                    ? 'bg-purple-50 text-purple-600 border-purple-100 dark:bg-purple-900/20 dark:border-purple-800 dark:text-purple-300' 
                    : 'bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-300'
                }`}>
                    {SUB_CATEGORY_LABELS[sub] || sub}
                </span>
            ))}
          </div>

          {/* Right: Meta */}
          <div className="flex items-center gap-3 flex-shrink-0 text-xs text-gray-400">
             <div className="flex items-center gap-1 text-orange-400">
                <Fire className="w-3 h-3" />
                <span>{prompt.heat}</span>
             </div>
             <span className="text-sky-500 font-medium opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">选择</span>
          </div>
      </div>
    </button>
  );
};

export default SelectablePromptCard;