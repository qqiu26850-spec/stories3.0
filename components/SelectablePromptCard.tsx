
import React from 'react';
import { Prompt } from '../types';
import { Fire } from './Icon';

interface SelectablePromptCardProps {
  prompt: Prompt;
  onSelect: () => void;
}

const CATEGORY_LABELS: Record<string, string> = {
    'long-story': '长篇',
    'short-story': '短篇',
    'script': '剧本',
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

      <div className="mt-auto pt-3 border-t border-gray-100 dark:border-gray-700 w-full">
          <div className="flex flex-wrap gap-1.5 mb-2">
             <span className={`px-2 py-0.5 rounded text-[10px] font-medium border bg-sky-50 text-sky-600 border-sky-100 dark:bg-sky-900/20 dark:border-sky-800`}>
                {CATEGORY_LABELS[prompt.category] || prompt.category}
            </span>
            {prompt.subCategories && prompt.subCategories.slice(0, 2).map((sub) => (
                <span key={sub} className="px-2 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-500 border border-gray-200 dark:bg-gray-900 dark:text-gray-400 dark:border-gray-600">
                    {SUB_CATEGORY_LABELS[sub] || sub}
                </span>
            ))}
          </div>
          <div className="flex items-center justify-between text-xs text-gray-400">
             <div className="flex items-center gap-1 text-orange-400">
                <Fire className="w-3 h-3" />
                <span>{prompt.heat}</span>
             </div>
             <span className="text-sky-500 font-medium opacity-0 group-hover:opacity-100 transition-opacity">选择 →</span>
          </div>
      </div>
    </button>
  );
};

export default SelectablePromptCard;
