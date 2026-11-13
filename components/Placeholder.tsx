
import React from 'react';
import { View } from '../types';

interface PlaceholderProps {
  view: View;
}

const viewToLabel: Record<View, string> = {
    'creative-generation': '创意生成',
    'novel-management': '长篇小说',
    'script-management': '剧本生成',
    'hit-copywriting': '短篇小说',
    'prompt-library': '提示词库',
    'workflow': '工作流',
    'character-library': '角色库',
    'plot-library': '剧情库',
    'inspiration-library': '灵光库',
    'personal-center': '个人中心',
    'help': '使用帮助',
    'prompt-library-novel': '小说提示词库',
    'prompt-library-marketing': '营销提示词库',
    'prompt-library-image': '绘图提示词库',
    'manuscript-review': '审稿',
};

const Placeholder: React.FC<PlaceholderProps> = ({ view }) => {
  return (
    <div className="p-4 sm:p-6 lg:p-8 h-full">
        <div className="flex items-center justify-center h-full bg-gray-100 dark:bg-gray-900 rounded-xl">
        <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">{viewToLabel[view]}</h2>
            <p className="text-gray-500 dark:text-gray-400 text-lg">此功能正在开发中，敬请期待！</p>
        </div>
        </div>
    </div>
  );
};

export default Placeholder;
