import React, { useMemo, useState, useEffect } from 'react';
import { View, Asset, AssetFormData } from '../types';
import CreateAssetModal from './CreateAssetModal';
import DeleteConfirmationModal from './DeleteConfirmationModal';
import AssetDetailModal from './AssetDetailModal';
import { Pencil, Trash, Check, Tag, Search, UserCircle, BookOpen, Sparkles, Plus, X, Bars2 } from './Icon';
import { saveMaterial, fetchMaterials, deleteMaterial } from '../services/supabaseService';
import { createPortal } from 'react-dom';

type AssetLibraryView = 'character-library' | 'plot-library' | 'inspiration-library';

interface AssetManagementProps {
  view: AssetLibraryView;
  setActiveView: (view: View) => void;
  isActive: boolean;
}

const viewConfig: Record<AssetLibraryView, { title: string; assetType: Asset['type']; description: string; icon: any; color: string; }> = {
    'character-library': { title: '角色库', assetType: 'character', description: '管理角色设定与人际关系', icon: UserCircle, color: 'sky' },
    'plot-library': { title: '剧情库', assetType: 'plot', description: '整理核心情节与故事线索', icon: BookOpen, color: 'purple' },
    'inspiration-library': { title: '灵光库', assetType: 'inspiration', description: '记录随笔、灵感与独特设定', icon: Sparkles, color: 'amber' }
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

const SuccessToast: React.FC<{ message: string; isVisible: boolean }> = ({ message, isVisible }) => {
    if (!isVisible) return null;
    return createPortal(
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[9999] animate-fade-in-up">
            <div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-md border border-green-200 dark:border-green-900 px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3">
                <div className="w-6 h-6 bg-green-100 dark:bg-green-900/50 rounded-full flex items-center justify-center text-green-600 dark:text-green-400">
                    <Check className="w-4 h-4" />
                </div>
                <span className="text-sm font-bold text-gray-800 dark:text-gray-100">{message}</span>
            </div>
        </div>,
        document.body
    );
};

const AssetManagement: React.FC<AssetManagementProps> = ({ view, setActiveView, isActive }) => {
    const { title, assetType, description, color, icon: ViewIcon } = viewConfig[view];
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
                id: item.id, name: item.name, type: item.type === 'idea' ? 'inspiration' : item.type, content: item.content, tags: item.tags || []
            }));
            setAssets(mappedAssets);
            
            // 从素材中提取初始标签并与现有排序后的标签合并
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
        const matchesSearch = !searchTerm || a.name.toLowerCase().includes(searchTerm.toLowerCase()) || a.content.toLowerCase().includes(searchTerm.toLowerCase());
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

    // 标签编辑方法
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

    // 拖拽排序逻辑
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

    const getAccentBorderClass = () => {
        if (assetType === 'character') return 'hover:border-sky-400 hover:ring-2 hover:ring-sky-500/10';
        if (assetType === 'plot') return 'hover:border-purple-400 hover:ring-2 hover:ring-purple-500/10';
        return 'hover:border-amber-400 hover:ring-2 hover:ring-amber-500/10';
    };

    return (
        <div className="p-8 h-full animate-fade-in flex flex-col font-sans bg-gray-50/50 dark:bg-black/20 overflow-hidden">
            <SuccessToast message={successMessage} isVisible={showToast} />
            <CreateAssetModal isOpen={isCreateModalOpen} onClose={() => setCreateModalOpen(false)} onSave={handleSaveAsset} assetType={assetType} />
            <DeleteConfirmationModal isOpen={isDeleteModalOpen} onClose={() => setDeleteModalOpen(false)} onConfirm={handleConfirmDelete} />
            <AssetDetailModal isOpen={isDetailModalOpen} onClose={() => setDetailModalOpen(false)} asset={selectedAsset} onSaveSuccess={() => { loadAssets(); triggerToast('内容已更新'); }} />

            <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-6 flex-shrink-0">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <div className={`p-2 rounded-xl bg-${color}-100 dark:bg-${color}-900/30 text-${color}-600 dark:text-${color}-400 shadow-sm`}>
                            <ViewIcon className="w-6 h-6" />
                        </div>
                        <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">{title}</h1>
                    </div>
                    <p className="text-gray-500 dark:text-gray-400 font-medium ml-11">{description}</p>
                </div>
                
                <div className="flex items-center gap-3">
                    <div className="relative group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-sky-500 transition-colors" />
                        <input 
                            type="text" 
                            placeholder="搜索素材..." 
                            value={searchTerm} 
                            onChange={e => setSearchTerm(e.target.value)} 
                            className="w-48 lg:w-64 pl-10 pr-4 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl focus:ring-2 focus:ring-sky-500/50 outline-none transition-all shadow-sm text-sm"
                        />
                    </div>
                    <button 
                        onClick={() => setCreateModalOpen(true)} 
                        className={`px-6 py-2.5 bg-sky-600 text-white font-bold rounded-xl hover:bg-sky-500 shadow-lg shadow-sky-500/30 transition-all active:scale-95 flex items-center gap-2 whitespace-nowrap`}
                    >
                        <Sparkles className="w-4 h-4" />
                        新建素材
                    </button>
                </div>
            </div>

            {/* 标签管理栏 */}
            <div className="flex flex-col gap-3 mb-8 flex-shrink-0">
                <div className="flex items-center justify-between px-1">
                    <div className="flex flex-wrap gap-2 items-center flex-1 pr-4">
                        <button 
                            onClick={() => setSelectedTag('all')} 
                            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${selectedTag === 'all' ? 'bg-sky-600 text-white shadow-md' : 'bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 text-gray-500 hover:bg-gray-100'}`}
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
                                    className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${selectedTag === tag ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300 ring-2 ring-sky-500/30' : 'bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 text-gray-500 hover:bg-gray-50'}`}
                                >
                                    {isTagEditing && <Bars2 className="w-3 h-3 opacity-40" />}
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
                            <div className="flex items-center gap-2 animate-fade-in">
                                <input 
                                    type="text" 
                                    value={newTagInput}
                                    onChange={e => setNewTagInput(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleAddTag()}
                                    placeholder="新标签..."
                                    className="px-3 py-1 text-xs border border-sky-200 dark:border-sky-800 bg-white dark:bg-gray-800 rounded-lg outline-none focus:ring-1 focus:ring-sky-500 w-24 transition-all"
                                />
                                <button onClick={handleAddTag} className="p-1.5 bg-sky-100 text-sky-600 rounded-lg hover:bg-sky-200 transition-colors"><Plus className="w-3 h-3" /></button>
                            </div>
                        )}
                    </div>
                    
                    <button 
                        onClick={() => setIsTagEditing(!isTagEditing)} 
                        className={`text-xs font-black px-3 py-1.5 rounded-lg transition-all ${isTagEditing ? 'bg-sky-100 text-sky-600 ring-1 ring-sky-500/50' : 'text-gray-400 hover:text-sky-500 hover:bg-sky-50'}`}
                    >
                        {isTagEditing ? '完成编辑' : '管理分类'}
                    </button>
                </div>
            </div>

            {isLoading ? <div className="flex-1 flex items-center justify-center"><div className="w-10 h-10 border-4 border-t-sky-500 border-gray-200 rounded-full animate-spin"></div></div> : (
                <div className="flex-1 overflow-y-auto px-1 -mx-1 pb-12 custom-scrollbar">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 content-start">
                        {filteredAssets.map(asset => (
                            <div 
                                key={asset.id} 
                                onClick={() => handleOpenEdit(asset)} 
                                className={`group relative bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 transition-all duration-300 cursor-pointer flex flex-col aspect-square overflow-hidden shadow-sm hover:shadow-2xl hover:-translate-y-2 ${getAccentBorderClass()}`}
                            >
                                <div className="p-7 flex flex-col h-full">
                                    <div className="mb-4">
                                        {/* 标题限制20字 */}
                                        <h3 className="text-xl font-bold text-gray-900 dark:text-white truncate pr-2 group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors" title={asset.name}>
                                            {asset.name.length > 20 ? asset.name.substring(0, 20) + '...' : asset.name}
                                        </h3>
                                    </div>
                                    
                                    <div className="relative flex-grow overflow-hidden">
                                        {/* 确保没有空白内容展示，使用 line-clamp 保持排版，配合 line-clamp-6 */}
                                        <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed whitespace-pre-wrap font-medium line-clamp-6">
                                            {asset.content.trim() || "暂无描述内容..."}
                                        </p>
                                        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-white dark:from-gray-900 to-transparent opacity-80" />
                                    </div>

                                    {/* 底部操作区：标签与按钮同一水平 */}
                                    <div className="mt-4 pt-4 border-t border-gray-50 dark:border-gray-800 flex items-center justify-between gap-4">
                                        <div className="flex flex-wrap gap-2 flex-1 min-w-0">
                                            {asset.tags.length > 0 ? asset.tags.slice(0, 2).map((tag, i) => (
                                                <span key={i} className={`text-[10px] px-2.5 py-0.5 rounded-lg font-black tracking-wider border uppercase truncate max-w-[80px] ${getTagStyle(tag)}`}>
                                                    {tag}
                                                </span>
                                            )) : (
                                                <span className="text-[10px] text-gray-300 dark:text-gray-600 font-bold italic">未分类</span>
                                            )}
                                            {asset.tags.length > 2 && <span className="text-[10px] text-gray-400 shrink-0">+{asset.tags.length - 2}</span>}
                                        </div>

                                        <div className="flex gap-1 shrink-0">
                                            <button 
                                                onClick={e => { e.stopPropagation(); handleOpenEdit(asset); }} 
                                                className="p-2 text-gray-400 hover:text-sky-500 hover:bg-sky-50 dark:hover:bg-sky-900/20 rounded-lg transition-all" 
                                                title="修改"
                                            >
                                                <Pencil className="w-4 h-4" />
                                            </button>
                                            <button 
                                                onClick={e => { e.stopPropagation(); setAssetToDeleteId(asset.id); setDeleteModalOpen(true); }} 
                                                className="p-2 text-gray-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-all" 
                                                title="删除"
                                            >
                                                <Trash className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {filteredAssets.length === 0 && (
                            <div className="col-span-full py-32 text-center flex flex-col items-center bg-white/50 dark:bg-gray-900/30 rounded-3xl border-2 border-dashed border-gray-200 dark:border-gray-800">
                                <div className="w-20 h-20 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
                                    <Search className="w-10 h-10 text-gray-300" />
                                </div>
                                <h3 className="text-xl font-bold text-gray-400">未找到相关素材</h3>
                                <p className="text-gray-400 text-sm mt-1">换个关键词试试，或者新建一个素材</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default AssetManagement;