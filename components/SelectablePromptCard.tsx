import React from 'react';
import { Prompt } from '../types';

interface SelectablePromptCardProps {
  prompt: Prompt;
  onSelect: () => void;
}

const SelectablePromptCard: React.FC<SelectablePromptCardProps> = ({ prompt, onSelect }) => {
  return (
    <button
      onClick={onSelect}
      className="w-full text-left p-4 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 hover:border-sky-500 border border-transparent transition-all group h-full flex flex-col"
    >
      <div className="flex justify-between items-start">
        <h4 className="font-semibold text-gray-900 dark:text-white flex-grow pr-2">{prompt.title}</h4>
        <div className="flex-shrink-0 flex items-center text-sm text-orange-400 bg-orange-400/10 px-2 py-1 rounded-full">
          <span>🔥</span>
          <span className="ml-1 font-medium">{prompt.heat}</span>
        </div>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 flex-grow">
        {prompt.description}
      </p>
      <div className="mt-3 text-sky-500 dark:text-sky-400 opacity-0 group-hover:opacity-100 transition-opacity text-sm font-semibold">
        选择此模板 →
      </div>
    </button>
  );
};

export default SelectablePromptCard;