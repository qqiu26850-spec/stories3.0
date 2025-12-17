
import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Asset } from '../types';
import { X, Search, UserCircle, BookOpen, Sparkles, Check } from './Icon';

interface AssetSelectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    assets: Asset[];
    selectedAssetIds: Set<string>;
    onToggleAsset: (id: string) => void;
}

type TabType = 'all' | 'character' | 'plot' | 'inspiration';

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

const AssetSelectionModal: React.FC<AssetSelectionModalProps> = ({ isOpen, onClose, assets, selectedAssetIds, onToggleAsset }) => {
    const [activeTab, setActiveTab] = useState<TabType>('all');
    const [searchTerm, setSearchTerm] = useState('');

    const filteredAssets = useMemo(() => {
        return assets.filter(asset => {
            const typeMatch = activeTab === 'all' || 
                              (activeTab === 'inspiration' ? (asset.type === 'inspiration') : asset.type === activeTab);
            
            const searchMatch = !searchTerm || 
                                asset.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                asset.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                asset.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));

            return typeMatch && searchMatch;
        });
    }, [assets, activeTab, searchTerm]);

    if (!isOpen) return null;

    const tabs: { id: TabType; label: string; icon: any }[] = [
        { id: 'all', label: '全部', icon: BookOpen },
        { id: 'character', label: '角色', icon: UserCircle },
        { id: 'plot', label: '剧情', icon: BookOpen },
        { id: 'inspiration', label: '灵光', icon: Sparkles },
    ];

    return createPortal(
        <div className="fixed inset-0 bg-black/60 dark:bg-black/80 flex items-center justify-center z-[100] p-4 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-6xl h-[80vh] flex flex-col animate-fade-in-up overflow-hidden" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="flex-shrink-0 p-5 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-gray-900/50">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">选择关联素材</h3>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-full transition-colors text-gray-500">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Toolbar: Categories + Search (Side by Side) */}
                <div className="flex-shrink-0 p-4 border-b border-gray-100 dark:border-gray-800 flex flex-col md:flex-row items-center gap-4">
                    {/* Tabs */}
                    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide flex-1 w-full md:w-auto">
                        {tabs.map(tab => {
                            const Icon = tab.icon;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                                        activeTab === tab.id 
                                        ? 'bg-sky-600 text-white shadow-md' 
                                        : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
                                    }`}
                                >
                                    <Icon className="w-4 h-4" />
                                    {tab.label}
                                </button>
                            );
                        })}
                    </div>

                    {/* Search */}
                    <div className="relative w-full md:w-64 flex-shrink-0">
                        <input 
                            type="text" 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="搜索素材..."
                            className="w-full pl-10 pr-4 py-2 bg-gray-100 dark:bg-gray-800 border-none rounded-lg text-sm focus:ring-2 focus:ring-sky-500 outline-none transition-all"
                        />
                        <Search className="w-4 h-4 absolute left-3.5 top-2.5 text-gray-400" />
                    </div>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto p-4 bg-gray-50 dark:bg-black/20">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {filteredAssets.map(asset => {
                            const isSelected = selectedAssetIds.has(asset.id);
                            return (
                                <div 
                                    key={asset.id} 
                                    onClick={() => onToggleAsset(asset.id)}
                                    className={`p-4 rounded-xl border cursor-pointer transition-all group relative overflow-hidden flex flex-col ${
                                        isSelected 
                                        ? 'border-sky-500 bg-sky-50 dark:bg-sky-900/20 shadow-sm ring-1 ring-sky-500' 
                                        : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-sky-300 dark:hover:border-sky-700 hover:shadow-md'
                                    }`}
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex-1 min-w-0 pr-2">
                                            <span className={`text-xs font-bold px-2 py-0.5 rounded-md mr-2 align-middle ${
                                                asset.type === 'character' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' :
                                                asset.type === 'plot' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' :
                                                'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                                            }`}>
                                                {asset.type === 'character' ? '角色' : asset.type === 'plot' ? '剧情' : '灵光'}
                                            </span>
                                            <h4 className="font-bold text-gray-900 dark:text-white inline align-middle truncate">{asset.name}</h4>
                                        </div>
                                        {isSelected && (
                                            <div className="w-5 h-5 bg-sky-500 rounded-full flex items-center justify-center text-white shadow-sm flex-shrink-0">
                                                <Check className="w-3 h-3" />
                                            </div>
                                        )}
                                    </div>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-3 leading-relaxed mb-3 flex-1">
                                        {asset.content}
                                    </p>
                                    <div className="flex flex-wrap gap-1.5 mt-auto">
                                        {asset.tags.slice(0, 3).map((tag, i) => (
                                            <span key={i} className={`text-xs px-1.5 py-0.5 rounded border ${getTagStyle(tag)}`}>
                                                {tag}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                        {filteredAssets.length === 0 && (
                            <div className="col-span-full flex flex-col items-center justify-center py-20 text-gray-400">
                                <Search className="w-12 h-12 mb-4 opacity-20" />
                                <p>未找到匹配的素材</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="flex-shrink-0 p-4 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex justify-between items-center">
                    <span className="text-sm text-gray-500">已选择 <span className="font-bold text-sky-600">{selectedAssetIds.size}</span> 个素材</span>
                    <button onClick={onClose} className="px-8 py-2.5 bg-sky-600 text-white rounded-lg font-bold hover:bg-sky-500 transition-colors shadow-lg shadow-sky-500/20">
                        确认
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default AssetSelectionModal;
