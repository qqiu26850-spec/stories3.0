
import React from 'react';
import { Asset } from '../types';
import { X, Trash, Pencil } from './Icon';

interface AssetDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    asset: Asset | null;
    onDelete?: (id: string) => void;
    onEdit?: (asset: Asset) => void;
}

// Tag colors palette (replicated from AssetManagement)
const TAG_COLORS = [
  'bg-red-50 text-red-700 border border-red-100 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800',
  'bg-orange-50 text-orange-700 border border-orange-100 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800',
  'bg-amber-50 text-amber-700 border border-amber-100 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800',
  'bg-yellow-50 text-yellow-700 border border-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800',
  'bg-green-50 text-green-700 border border-green-100 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800',
  'bg-emerald-50 text-emerald-700 border border-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800',
  'bg-teal-50 text-teal-700 border border-teal-100 dark:bg-teal-900/30 dark:text-teal-300 dark:border-teal-800',
  'bg-cyan-50 text-cyan-700 border border-cyan-100 dark:bg-cyan-900/30 dark:text-cyan-300 dark:border-cyan-800',
  'bg-sky-50 text-sky-700 border border-sky-100 dark:bg-sky-900/30 dark:text-sky-300 dark:border-sky-800',
  'bg-blue-50 text-blue-700 border border-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800',
  'bg-indigo-50 text-indigo-700 border border-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800',
  'bg-violet-50 text-violet-700 border border-violet-100 dark:bg-violet-900/30 dark:text-violet-300 dark:border-violet-800',
  'bg-purple-50 text-purple-700 border border-purple-100 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800',
  'bg-fuchsia-50 text-fuchsia-700 border border-fuchsia-100 dark:bg-fuchsia-900/30 dark:text-fuchsia-300 dark:border-fuchsia-800',
  'bg-pink-50 text-pink-700 border border-pink-100 dark:bg-pink-900/30 dark:text-pink-300 dark:border-pink-800',
  'bg-rose-50 text-rose-700 border border-rose-100 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-800',
];

const getTagStyle = (tag: string) => {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = tag.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % TAG_COLORS.length;
  return TAG_COLORS[index];
};

const AssetDetailModal: React.FC<AssetDetailModalProps> = ({ isOpen, onClose, asset, onDelete, onEdit }) => {
    if (!isOpen || !asset) return null;

    return (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-2xl p-6 animate-fade-in-up flex flex-col relative max-h-[90vh]" onClick={e => e.stopPropagation()}>
                <button onClick={onClose} className="absolute top-4 right-4 p-2 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 z-10">
                    <X className="w-6 h-6" />
                </button>
                
                <div className="mb-6 pr-8">
                     <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{asset.name}</h3>
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
                            {asset.type === 'character' ? '角色' : asset.type === 'plot' ? '剧情' : '灵光'}
                        </span>
                     </div>
                     {asset.tags && asset.tags.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                            {asset.tags.map((tag, index) => (
                                <span key={index} className={`text-xs px-2 py-1 rounded-md font-medium border ${getTagStyle(tag)}`}>
                                    {tag}
                                </span>
                            ))}
                        </div>
                     )}
                </div>

                <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg border border-gray-100 dark:border-gray-800">
                    <pre className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300 font-sans leading-relaxed">
                        {asset.content}
                    </pre>
                </div>
               
                <div className="flex justify-between pt-6 mt-auto border-t border-gray-100 dark:border-gray-800">
                    <div className="flex gap-2">
                        {onEdit && (
                             <button 
                                onClick={() => onEdit(asset)}
                                className="flex items-center gap-2 px-4 py-2 text-sky-600 hover:bg-sky-50 dark:text-sky-400 dark:hover:bg-sky-900/20 rounded-lg transition-colors text-sm font-medium"
                            >
                                <Pencil className="w-4 h-4" />
                                编辑
                            </button>
                        )}
                    </div>
                    {onDelete && (
                        <button 
                            onClick={() => onDelete(asset.id)}
                            className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors text-sm font-medium"
                        >
                            <Trash className="w-4 h-4" />
                            删除
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AssetDetailModal;
