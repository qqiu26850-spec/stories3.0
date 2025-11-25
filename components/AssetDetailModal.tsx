
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
                                <span key={index} className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-md">
                                    #{tag}
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
