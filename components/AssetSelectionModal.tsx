
import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Asset } from '../types';
import { X, Search, UserCircle, BookOpen, Sparkles, Check, Tag, Database, Heart } from './Icon';

interface AssetSelectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    assets: Asset[];
    selectedAssetIds: Set<string>;
    onToggleAsset: (id: string) => void;
}

type TabType = 'all' | 'character' | 'plot' | 'inspiration' | 'favorites';

const TAG_COLORS = [
  'bg-red-50 text-red-700 border border-red-100 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800',
  'bg-orange-50 text-orange-700 border border-orange-100 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800',
  'bg-amber-50 text-amber-700 border border-amber-100 dark:bg-amber-900/30 dark:text-amber-300 dark:border-orange-800',
  'bg-yellow-50 text-yellow-700 border border-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800',
  'bg-green-50 text-green-700 border border-green-100 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800',
  'bg-emerald-50 text-emerald-700 border border-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800',
  'bg-sky-50 text-sky-700 border border-sky-100 dark:bg-sky-900/30 dark:text-sky-300 dark:border-sky-800',
  'bg-blue-50 text-blue-700 border border-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800',
  'bg-purple-50 text-purple-700 border border-purple-100 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800',
  'bg-rose-50 text-rose-700 border border-rose-100 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-800'
];

const getTagStyle = (tag: string) => {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) hash = tag.charCodeAt(i) + ((hash << 5) - hash);
  const index = Math.abs(hash) % TAG_COLORS.length;
  return TAG_COLORS[index];
};

const AssetSelectionModal: React.FC<AssetSelectionModalProps> = ({ isOpen, onClose, assets, selectedAssetIds, onToggleAsset }) => {
    const [activeTab, setActiveTab] = useState<TabType>('all');
    const [selectedTag, setSelectedTag] = useState<string | 'all'>('all');
    const [searchTerm, setSearchTerm] = useState('');

    const availableTags = useMemo(() => {
        const tags = new Set<string>();
        assets.forEach(a => {
            // Include tag if in 'all', or matching type, or if 'favorites' tab and asset is favorite
            if (activeTab === 'all' || 
                (activeTab === 'favorites' && a.isFavorite) || 
                a.type === (activeTab === 'inspiration' ? 'inspiration' : activeTab)) {
                a.tags.forEach(t => tags.add(t));
            }
        });
        return Array.from(tags);
    }, [assets, activeTab]);

    const filteredAssets = useMemo(() => {
        return assets.filter(asset => {
            // Filter by Tab
            let typeMatch = false;
            if (activeTab === 'all') typeMatch = true;
            else if (activeTab === 'favorites') typeMatch = !!asset.isFavorite;
            else typeMatch = asset.type === (activeTab === 'inspiration' ? 'inspiration' : activeTab);

            // Filter by Tag
            const tagMatch = selectedTag === 'all' || asset.tags.includes(selectedTag);
            
            // Enhanced Search: Name, Content, Tags
            const term = searchTerm.toLowerCase();
            const searchMatch = !term || 
                                asset.name.toLowerCase().includes(term) || 
                                asset.content.toLowerCase().includes(term) ||
                                asset.tags.some(t => t.toLowerCase().includes(term));

            return typeMatch && tagMatch && searchMatch;
        });
    }, [assets, activeTab, selectedTag, searchTerm]);

    if (!isOpen) return null;

    const tabs: { id: TabType; label: string; icon: any }[] = [
        { id: 'all', label: '全部', icon: BookOpen },
        { id: 'favorites', label: '收藏', icon: Heart },
        { id: 'character', label: '角色', icon: UserCircle },
        { id: 'plot', label: '剧情', icon: BookOpen },
        { id: 'inspiration', label: '灵光', icon: Sparkles },
    ];

    return createPortal(
        <div className="fixed inset-0 bg-black/60 dark:bg-black/80 flex items-center justify-center z-[100] p-4 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-6xl h-[85vh] flex flex-col relative animate-fade-in-up overflow-hidden font-sans" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="flex-shrink-0 p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50/50 dark:bg-gray-900/50">
                    <div className="flex items-center gap-4 flex-1">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2 shrink-0">
                            <Database className="w-5 h-5 text-sky-500" />
                            关联素材
                        </h3>
                        
                        <div className="flex bg-gray-200/50 dark:bg-gray-800 rounded-lg p-1 shrink-0 gap-0.5">
                            {tabs.map(tab => {
                                const Icon = tab.icon;
                                const isFav = tab.id === 'favorites';
                                return (
                                    <button
                                        key={tab.id}
                                        onClick={() => { setActiveTab(tab.id); setSelectedTag('all'); }}
                                        className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold transition-all whitespace-nowrap ${
                                            activeTab === tab.id 
                                            ? 'bg-white dark:bg-gray-700 text-sky-600 dark:text-sky-400 shadow-sm' 
                                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                                        } ${isFav && activeTab === 'favorites' ? '!text-red-500' : ''}`}
                                    >
                                        <Icon className={`w-3 h-3 ${isFav && activeTab !== 'favorites' ? 'text-gray-400 hover:text-red-400' : ''}`} />
                                        {tab.label}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Search Bar */}
                        <div className="relative flex-1 max-w-xs ml-2">
                            <input 
                                type="text" 
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="搜索名称、内容或标签..."
                                className="w-full pl-8 pr-4 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs focus:ring-2 focus:ring-sky-500 outline-none transition-all"
                            />
                            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                        </div>
                    </div>

                    <button onClick={onClose} className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-full transition-colors text-gray-400 ml-4">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Toolbar - Tag Filter */}
                <div className="flex-shrink-0 p-3 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
                    <div className="flex items-center gap-3 overflow-hidden">
                        <span className="text-[10px] font-bold text-gray-400 shrink-0 flex items-center gap-1"><Tag className="w-3 h-3"/> 标签筛选:</span>
                        <div className="flex flex-wrap gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                            <button 
                                onClick={() => setSelectedTag('all')}
                                className={`px-2.5 py-0.5 text-[10px] font-medium rounded-full transition-all border whitespace-nowrap ${selectedTag === 'all' ? 'bg-sky-600 text-white border-sky-600' : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-500 hover:border-sky-300'}`}
                            >
                                全部
                            </button>
                            {availableTags.map(tag => (
                                <button 
                                    key={tag}
                                    onClick={() => setSelectedTag(tag)}
                                    className={`px-2.5 py-0.5 text-[10px] font-medium rounded-full transition-all border whitespace-nowrap ${selectedTag === tag ? 'bg-sky-100 text-sky-700 border-sky-300 dark:bg-sky-900/50 dark:text-sky-300' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500 hover:border-sky-300'}`}
                                >
                                    {tag}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto p-5 bg-gray-50 dark:bg-black/20">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {filteredAssets.map(asset => {
                            const isSelected = selectedAssetIds.has(asset.id);
                            return (
                                <div 
                                    key={asset.id} 
                                    onClick={() => onToggleAsset(asset.id)}
                                    className={`p-4 rounded-xl border cursor-pointer transition-all group relative overflow-hidden flex flex-col h-[200px] ${
                                        isSelected 
                                        ? 'border-sky-500 bg-sky-50 dark:bg-sky-900/20 shadow-sm ring-1 ring-sky-500' 
                                        : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-sky-300 dark:hover:border-sky-700 hover:shadow-md'
                                    }`}
                                >
                                    <div className="flex justify-between items-start mb-2 gap-2">
                                        <div className="flex-1 min-w-0">
                                            <h4 className="font-bold text-gray-900 dark:text-white truncate text-[14px] leading-tight flex items-center gap-1.5" title={asset.name}>
                                                {asset.isFavorite && <Heart className="w-3 h-3 text-red-500 fill-current shrink-0" />}
                                                {asset.name}
                                            </h4>
                                            <span className={`text-[8px] font-black px-1.5 py-0.5 rounded inline-block mt-1 whitespace-nowrap uppercase tracking-tighter ${
                                                asset.type === 'character' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' :
                                                asset.type === 'plot' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' :
                                                'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                                            }`}>
                                                {asset.type === 'character' ? '角色' : asset.type === 'plot' ? '剧情' : '灵光'}
                                            </span>
                                        </div>
                                        {isSelected && (
                                            <div className="w-5 h-5 bg-sky-500 rounded-full flex items-center justify-center text-white shadow-sm flex-shrink-0">
                                                <Check className="w-3 h-3" />
                                            </div>
                                        )}
                                    </div>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-4 leading-relaxed mb-3 flex-1 overflow-hidden">
                                        {asset.content}
                                    </p>
                                    <div className="flex flex-wrap gap-1 mt-auto overflow-hidden max-h-6">
                                        {asset.tags.map((tag, i) => (
                                            <span key={i} className={`text-[9px] px-1.5 py-0.5 rounded border whitespace-nowrap font-medium inline-block ${getTagStyle(tag)}`}>
                                                {tag}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                        {filteredAssets.length === 0 && (
                            <div className="col-span-full flex flex-col items-center justify-center py-20 text-gray-400">
                                <Search className="w-12 h-12 mb-3 opacity-10" />
                                <p className="text-sm font-medium">未找到匹配素材</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="flex-shrink-0 p-4 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 flex justify-between items-center px-6">
                    <span className="text-xs text-gray-500 font-medium">已选择 <span className="font-black text-sky-600 dark:text-sky-400 text-base">{selectedAssetIds.size}</span> 项素材</span>
                    <button onClick={onClose} className="px-10 py-2 bg-sky-600 text-white rounded-lg font-bold hover:bg-sky-500 transition-all shadow-md shadow-sky-500/20 active:scale-95 text-sm">
                        确认关联
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default AssetSelectionModal;
