
import React from 'react';
import { CreativeModule } from '../types';
import { Icon, Sparkles, Fire, UserCircle, Globe, ListBullet, DocumentText, BookOpen } from './Icon';

// Mapping module IDs to Icons and Colors
const MODULE_CONFIG: Record<string, { icon: Icon; colorClass: string; bgClass: string }> = {
    'brainstorm': { icon: Sparkles, colorClass: 'text-purple-600 dark:text-purple-400', bgClass: 'bg-purple-100 dark:bg-purple-900/30' },
    'golden-finger': { icon: Fire, colorClass: 'text-orange-600 dark:text-orange-400', bgClass: 'bg-orange-100 dark:bg-orange-900/30' },
    'character-design': { icon: UserCircle, colorClass: 'text-blue-600 dark:text-blue-400', bgClass: 'bg-blue-100 dark:bg-blue-900/30' },
    'worldview': { icon: Globe, colorClass: 'text-emerald-600 dark:text-emerald-400', bgClass: 'bg-emerald-100 dark:bg-emerald-900/30' },
    'outline': { icon: ListBullet, colorClass: 'text-cyan-600 dark:text-cyan-400', bgClass: 'bg-cyan-100 dark:bg-cyan-900/30' },
    'detailed-outline': { icon: DocumentText, colorClass: 'text-indigo-600 dark:text-indigo-400', bgClass: 'bg-indigo-100 dark:bg-indigo-900/30' },
    'synopsis': { icon: BookOpen, colorClass: 'text-rose-600 dark:text-rose-400', bgClass: 'bg-rose-100 dark:bg-rose-900/30' },
};

interface CreativeCardProps {
  module: CreativeModule;
  onSelect: () => void;
}

const CreativeCard: React.FC<CreativeCardProps> = ({ module, onSelect }) => {
  const config = MODULE_CONFIG[module.id] || { icon: Sparkles, colorClass: 'text-sky-600', bgClass: 'bg-sky-100' };
  const IconComp = config.icon;

  return (
    <button
      onClick={onSelect}
      className="group relative bg-white dark:bg-gray-900 rounded-2xl p-6 text-left flex flex-col h-full border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden"
    >
      <div className={`absolute top-0 right-0 w-24 h-24 -mr-8 -mt-8 rounded-full opacity-20 group-hover:scale-150 transition-transform duration-500 ${config.bgClass}`} />
      
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-6 ${config.bgClass} group-hover:rotate-6 transition-transform duration-300`}>
        <IconComp className={`w-6 h-6 ${config.colorClass}`} />
      </div>

      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">{module.title}</h3>
      <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed flex-grow">
        {module.description}
      </p>
      
      <div className="mt-6 flex items-center text-sm font-semibold text-gray-400 group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
        开始创作
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 ml-2 transform group-hover:translate-x-1 transition-transform">
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
        </svg>
      </div>
    </button>
  );
};

export default CreativeCard;
