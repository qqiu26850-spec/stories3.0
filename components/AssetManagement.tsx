
import React, { useMemo, useState, useEffect } from 'react';
import { View, Asset, AssetFormData } from '../types';
import CreateAssetModal from './CreateAssetModal';
import DeleteConfirmationModal from './DeleteConfirmationModal';
import AssetDetailModal from './AssetDetailModal';
import { Pencil, Trash, Check, Tag, Search, UserCircle, BookOpen, Sparkles, Plus, X, Bars2, AdjustmentsHorizontal, Heart } from './Icon';
import { saveMaterial, fetchMaterials, deleteMaterial, toggleMaterialFavorite } from '../services/supabaseService';

type AssetLibraryView = 'character-library' | 'plot-library' | 'inspiration-library';

interface AssetManagementProps {
  view: AssetLibraryView;
  setActiveView: (view: View) => void;
  isActive: boolean;
}

const viewConfig: Record<AssetLibraryView, { title: string; assetType: Asset['type']; icon: any; color: string; }> = {
    'character-library': { title: '角色库', assetType: 'character', icon: UserCircle, color: 'sky' },
    'plot-library': { title: '剧情库', assetType: 'plot', icon: BookOpen, color: 'sky' },
    'inspiration-library': { title: '灵光库', assetType: 'inspiration', icon: Sparkles, color: 'sky' }
};

const TAG_COLORS = [
  'bg-red-50 text-red-700 border-red-100', 'bg-orange-50 text-orange-700 border-orange-100', 'bg-amber-50 text-amber-700 border-amber-100',
  'bg-green-50 text-green-700 border-green-100', 'bg-emerald-50 text-emerald-700 border-emerald-100', 'bg-sky-50 text-sky-700 border-sky-100',
  'bg-blue-50 text-blue-700 border-blue-100', 'bg-purple-50 text-purple-700 border-purple-100', 'bg-rose-50 text-rose-700 border-rose-100'
];

export const getTagStyle = (tag: string) => {
  let hash = 0; for (let i = 0; i < tag.length; i++) hash = tag.charCodeAt(i) + ((hash << 5) - hash);
  const index = Math.abs(hash) % TAG_COLORS.length; return TAG_COLORS[index];
};

const AssetManagement: React.FC<AssetManagementProps> = ({ view, setActiveView, isActive }) => {
    const { title, assetType, color, icon: ViewIcon } = viewConfig[view];
    const [assets, setAssets] = useState<Asset[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isCreateModalOpen, setCreateModalOpen] = useState(false);
    const [isDeleteModalOpen, setDeleteModalOpen] = useState(false);
    const [isDetailModalOpen, setDetailModalOpen] = useState(false);
    const [assetToDeleteId, setAssetToDeleteId] = useState<string | null>(null);
    const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedTag, setSelectedTag] = useState<string | 'all'>('all');
    
    // 标签管理状态
    const [customTags, setCustomTags] = useState<string[]>([]);
    const [isTagEditing, setIsTagEditing] = useState(false);
    const [newTagInput, setNewTagInput] = useState('');
    const [draggingTagIndex, setDraggingTagIndex] = useState<number | null>(null);

    const [successMessage, setSuccessMessage] = useState('');
    const [showToast, setShowToast] = useState(false);

    const triggerToast = (msg: string) => {
        setSuccessMessage(msg);
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);
    };

    const loadAssets = async () => {
        if (!isActive) return; 
        setIsLoading(true);
        try {
            const data = await fetchMaterials(assetType === 'inspiration' ? 'idea' : assetType);
            const mappedAssets = data.map((item: any) => ({
                id: item.id, name: item.name, type: item.type === 'idea' ? 'inspiration' : item.type, content: item.content, tags: item.tags || [], isFavorite: item.isFavorite
            }));
            setAssets(mappedAssets);
            
            const tagsFromData = new Set<string>();
            mappedAssets.forEach(a => a.tags.forEach(t => tagsFromData.add(t)));
            const savedTags = JSON.parse(localStorage.getItem(`tags_${assetType}`) || '[]');
            const uniqueTags = Array.from(new Set([...savedTags, ...Array.from(tagsFromData)]));
            setCustomTags(uniqueTags);
        } catch (e) {} finally { setIsLoading(false); }
    };

    useEffect(() => { loadAssets(); }, [assetType, isActive]);

    useEffect(() => {
        if (customTags.length > 0) {
            localStorage.setItem(`tags_${assetType}`, JSON.stringify(customTags));
        }
    }, [customTags, assetType]);

    const filteredAssets = useMemo(() => assets.filter(a => {
        const term = searchTerm.toLowerCase();
        const matchesSearch = !searchTerm || 
            a.name.toLowerCase().includes(term) || 
            a.content.toLowerCase().includes(term) ||
            a.tags.some(t => t.toLowerCase().includes(term));
            
        const matchesTag = selectedTag === 'all' || a.tags.includes(selectedTag);
        return matchesSearch && matchesTag;
    }), [assets, searchTerm, selectedTag]);

    const handleSaveAsset = async (formData: AssetFormData) => {
        const tags = formData.tags ? formData.tags.split(/[,，]/).map(t => t.trim()).filter(Boolean) : [];
        const content = formData.notes || formData.personality || formData.plotPoints || '';
        await saveMaterial(formData.name, content, assetType === 'inspiration' ? 'idea' : assetType, tags);
        setCreateModalOpen(false); 
        triggerToast('素材保存成功');
        loadAssets();
    };

    const handleConfirmDelete = async () => {
        if (assetToDeleteId) { 
            await deleteMaterial(assetToDeleteId); 
            setAssets(prev => prev.filter(a => a.id !== assetToDeleteId)); 
            setDeleteModalOpen(false); 
            if (selectedAsset?.id === assetToDeleteId) setDetailModalOpen(false); 
            triggerToast('素材已成功删除');
        }
    };

    const handleOpenEdit = (asset: Asset) => {
        setSelectedAsset(asset);
        setDetailModalOpen(true);
    };

    const handleAddTag = () => {
        if (newTagInput.trim() && !customTags.includes(newTagInput.trim())) {
            setCustomTags(prev => [...prev, newTagInput.trim()]);
            setNewTagInput('');
        }
    };

    const handleRemoveTag = (tag: string) => {
        setCustomTags(prev => prev.filter(t => t !== tag));
        if (selectedTag === tag) setSelectedTag('all');
    };

    const onDragStart = (index: number) => setDraggingTagIndex(index);
    const onDragOver = (e: React.DragEvent) => e.preventDefault();
    const onDrop = (index: number) => {
        if (draggingTagIndex === null) return;
        const newTags = [...customTags];
        const [movedTag] = newTags.splice(draggingTagIndex, 1);
        newTags.splice(index, 0, movedTag);
        setCustomTags(newTags);
        setDraggingTagIndex(null);
    };

    const handleToggleFavorite = async (e: React.MouseEvent, assetId: string, currentStatus: boolean) => {
        e.stopPropagation();
        // Optimistic update
        setAssets(prev => prev.map(a => a.id === assetId ? { ...a, isFavorite: !currentStatus } : a));
        await toggleMaterialFavorite(assetId, !currentStatus);
    };

    return (
        <div className="p-4 sm:p-6 lg:p-8 h-full animate-fade-in flex flex-col font-sans bg-gray-50/50 dark:bg-black/20 overflow-hidden">
            <CreateAssetModal isOpen={isCreateModalOpen} onClose={() => setCreateModalOpen(false)} onSave={handleSaveAsset} assetType={assetType} existingTags={customTags} />
            <DeleteConfirmationModal isOpen={isDeleteModalOpen} onClose={() => setDeleteModalOpen(false)} onConfirm={handleConfirmDelete} />
            <AssetDetailModal isOpen={isDetailModalOpen} onClose={() => setDetailModalOpen(false)} asset={selectedAsset} onSaveSuccess={() => { loadAssets(); triggerToast('内容已更新'); }} />

            <div className="mb-4 flex flex-col md:flex-row md:items-center justify-between gap-4 flex-shrink-0">
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl bg-${color}-100 dark:bg-${color}-900/30 text-${color}-600 dark:text-${color}-400 shadow-sm flex-shrink-0`}>
                        <ViewIcon className="w-5 h-5" />
                    </div>
                    <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">{title}</h1>
                </div>
                
                <div className="flex items-center gap-4">
                    {showToast && (
                        <span className="text-base font-bold text-sky-600 dark:text-sky-400 animate-fade-in transition-all">
                            {successMessage}
                        </span>
                    )}
                    <div className="relative group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 group-focus-within:text-sky-500 transition-colors" />
                        <input 
                            type="text" 
                            placeholder="搜索素材..." 
                            value={searchTerm} 
                            onChange={e => setSearchTerm(e.target.value)} 
                            className="w-40 lg:w-56 pl-9 pr-4 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl focus:ring-2 focus:ring-sky-500/50 outline-none transition-all shadow-sm text-xs"
                        />
                    </div>
                    <button 
                        onClick={() => setCreateModalOpen(true)} 
                        className={`px-5 py-2 bg-sky-600 text-white font-bold rounded-xl hover:bg-sky-500 shadow-lg shadow-sky-500/30 transition-all active:scale-95 flex items-center gap-2 whitespace-nowrap text-xs`}
                    >
                        <Sparkles className="w-3.5 h-3.5" />
                        新建素材
                    </button>
                </div>
            </div>

            <div className="flex flex-col gap-2 mb-4 flex-shrink-0">
                <div className="flex items-center justify-between px-1">
                    <div className="flex flex-wrap gap-1.5 items-center flex-1 pr-4">
                        <button 
                            onClick={() => setSelectedTag('all')} 
                            className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${selectedTag === 'all' ? 'bg-sky-600 text-white shadow-md' : 'bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 text-gray-500 hover:bg-gray-100'}`}
                        >
                            全部
                        </button>
                        
                        {customTags.map((tag, index) => (
                            <div
                                key={tag}
                                draggable={isTagEditing}
                                onDragStart={() => onDragStart(index)}
                                onDragOver={onDragOver}
                                onDrop={() => onDrop(index)}
                                className={`group relative flex items-center transition-all ${isTagEditing ? 'cursor-move active:scale-95' : ''}`}
                            >
                                <button 
                                    onClick={() => !isTagEditing && setSelectedTag(tag)} 
                                    className={`px-3 py-1.5 rounded-full text-[11px] font-medium transition-all whitespace-nowrap flex items-center gap-1 ${selectedTag === tag ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300 ring-1 ring-sky-500/30' : 'bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 text-gray-500 hover:bg-gray-50'}`}
                                >
                                    {isTagEditing && <Bars2 className="w-3 h-3 opacity-50" />}
                                    {tag}
                                    {isTagEditing && (
                                        <X 
                                            className="w-3 h-3 hover:text-rose-500 transition-colors cursor-pointer" 
                                            onClick={(e) => { e.stopPropagation(); handleRemoveTag(tag); }}
                                        />
                                    )}
                                </button>
                            </div>
                        ))}

                        {isTagEditing && (
                            <div className="flex items-center gap-1.5 animate-fade-in">
                                <input 
                                    type="text" 
                                    value={newTagInput}
                                    onChange={e => setNewTagInput(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleAddTag()}
                                    placeholder="新标签..."
                                    className="px-3 py-1.5 text-[11px] border border-sky-200 dark:border-sky-800 bg-white dark:bg-gray-800 rounded-xl outline-none focus:ring-2 focus:ring-sky-500 w-24 transition-all shadow-sm"
                                />
                                <button onClick={handleAddTag} className="p-1.5 bg-sky-600 text-white rounded-xl hover:bg-sky-500 transition-colors shadow-md flex items-center justify-center"><Plus className="w-3.5 h-3.5" /></button>
                            </div>
                        )}
                    </div>
                    
                    <button 
                        onClick={() => setIsTagEditing(!isTagEditing)} 
                        className={`flex items-center gap-1.5 text-xs font-bold px-4 py-1.5 rounded-xl transition-all shadow-sm ${isTagEditing ? 'bg-sky-600 text-white ring-1 ring-sky-500/50' : 'bg-white dark:bg-gray-800 text-gray-600 border border-gray-100 dark:border-gray-800 hover:text-sky-600 hover:border-sky-200'}`}
                    >
                        <AdjustmentsHorizontal className="w-4 h-4" />
                        {isTagEditing ? '完成' : '管理标签'}
                    </button>
                </div>
            </div>

            {isLoading ? <div className="flex-1 flex items-center justify-center"><div className="w-10 h-10 border-4 border-t-sky-500 border-gray-200 rounded-full animate-spin"></div></div> : (
                <div className="flex-1 overflow-y-auto px-1 -mx-1 pb-8 custom-scrollbar">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 content-start">
                        {filteredAssets.map(asset => (
                            <div 
                                key={asset.id} 
                                onClick={() => handleOpenEdit(asset)} 
                                className="group relative bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 transition-all duration-300 cursor-pointer flex flex-col h-[260px] overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 hover:border-sky-500 hover:ring-2 hover:ring-sky-500/20"
                            >
                                <div className="flex flex-col h-full">
                                    {/* 顶部标题栏 */}
                                    <div className="px-5 py-3 bg-sky-50 dark:bg-sky-900/20 flex justify-between items-start">
                                        <h3 className="text-lg font-bold text-gray-900 dark:text-white truncate group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors pr-6" title={asset.name}>
                                            {asset.name.length > 15 ? asset.name.substring(0, 15) + '...' : asset.name}
                                        </h3>
                                        <button 
                                            onClick={(e) => handleToggleFavorite(e, asset.id, !!asset.isFavorite)} 
                                            className={`p-1 transition-colors ${asset.isFavorite ? 'text-red-500' : 'text-gray-300 hover:text-red-400'}`}
                                        >
                                            <Heart className={`w-4 h-4 ${asset.isFavorite ? 'fill-current' : ''}`} />
                                        </button>
                                    </div>
                                    
                                    {/* 正文区域 */}
                                    <div className="relative flex-grow overflow-hidden px-5 py-3">
                                        <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed whitespace-pre-wrap line-clamp-6">
                                            {asset.content.trim() || "暂无内容..."}
                                        </p>
                                        <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-white dark:from-gray-900 to-transparent opacity-90" />
                                    </div>

                                    {/* 底部栏 */}
                                    <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between gap-3 bg-white dark:bg-gray-900">
                                        <div className="flex flex-wrap gap-1 flex-1 min-w-0">
                                            {asset.tags.length > 0 ? asset.tags.slice(0, 3).map((tag, i) => (
                                                <span key={i} className={`text-[10px] px-1.5 py-0.5 rounded-md border truncate max-w-[60px] ${getTagStyle(tag)} font-normal`}>
                                                    {tag}
                                                </span>
                                            )) : (
                                                <span className="text-[10px] text-gray-300 dark:text-gray-600 font-normal italic">未分类</span>
                                            )}
                                            {asset.tags.length > 3 && <span className="text-[10px] text-gray-400 shrink-0 font-normal">...</span>}
                                        </div>

                                        <div className="flex gap-1 shrink-0">
                                            <button 
                                                onClick={e => { e.stopPropagation(); handleOpenEdit(asset); }} 
                                                className="p-1.5 text-gray-400 hover:text-sky-500 hover:bg-sky-100 dark:hover:bg-sky-900/40 rounded-lg transition-all" 
                                                title="修改"
                                            >
                                                <Pencil className="w-3.5 h-3.5" />
                                            </button>
                                            <button 
                                                onClick={e => { e.stopPropagation(); setAssetToDeleteId(asset.id); setDeleteModalOpen(true); }} 
                                                className="p-1.5 text-gray-400 hover:text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-900/40 rounded-lg transition-all" 
                                                title="删除"
                                            >
                                                <Trash className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {filteredAssets.length === 0 && (
                            <div className="col-span-full py-20 text-center flex flex-col items-center bg-white/50 dark:bg-gray-900/30 rounded-3xl border-2 border-dashed border-gray-200 dark:border-gray-800">
                                <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-3">
                                    <Search className="w-8 h-8 text-gray-300" />
                                </div>
                                <h3 className="text-lg font-bold text-gray-400">未找到相关素材</h3>
                                <p className="text-gray-400 text-xs mt-1">尝试其他关键词或新建一个</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default AssetManagement;
