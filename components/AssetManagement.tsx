
import React, { useMemo, useState, useEffect } from 'react';
import { ASSETS } from '../constants';
import { View, Asset, AssetFormData } from '../types';
import CreateAssetModal from './CreateAssetModal';
import DeleteConfirmationModal from './DeleteConfirmationModal';
import AssetDetailModal from './AssetDetailModal';
import { Pencil, Trash } from './Icon';
import { saveMaterial, fetchMaterials, deleteMaterial } from '../services/supabaseService';

type AssetLibraryView = 'character-library' | 'plot-library' | 'inspiration-library';

interface AssetManagementProps {
  view: AssetLibraryView;
  setActiveView: (view: View) => void;
}

const viewConfig: Record<AssetLibraryView, { title: string; assetType: Asset['type']; description: string; }> = {
    'character-library': {
        title: '角色库',
        assetType: 'character',
        description: '管理你所有的角色设定，随时调用。'
    },
    'plot-library': {
        title: '剧情库',
        assetType: 'plot',
        description: '保存和整理关键的故事情节和线索。'
    },
    'inspiration-library': {
        title: '灵光库',
        assetType: 'inspiration',
        description: '记录一闪而过的灵感、世界观和独特设定。'
    }
}

// Updated styles: All borders are now gray as requested ("细线条颜色均改为灰色")
const ASSET_STYLES: Record<Asset['type'], { border: string }> = {
    character: {
        border: 'border-gray-200 dark:border-gray-800',
    },
    plot: {
        border: 'border-gray-200 dark:border-gray-800',
    },
    inspiration: {
        border: 'border-gray-200 dark:border-gray-800',
    }
};

// Tag colors palette
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

const formatAssetContent = (type: Asset['type'], data: AssetFormData): string => {
    switch (type) {
        case 'character':
            return [
                data.goldenFinger && `【金手指】: ${data.goldenFinger}`,
                data.personality && `【性格特点】: ${data.personality}`,
                data.relationships && `【人物关系】: ${data.relationships}`,
                data.notes && `【补充内容】: ${data.notes}`
            ].filter(Boolean).join('\n');
        case 'plot':
            return [
                data.plotPoints && `【情节点】: ${data.plotPoints}`,
                data.scene && `【场景】: ${data.scene}`
            ].filter(Boolean).join('\n');
        case 'inspiration':
             return [
                data.genre && `【题材】: ${data.genre}`,
                data.elements && `【元素】: ${data.elements}`,
                data.coreTrope && `【核心梗】: ${data.coreTrope}`,
                data.goldenFinger && `【金手指】: ${data.goldenFinger}`,
                data.notes && `【补充内容】: ${data.notes}`
            ].filter(Boolean).join('\n');
        default:
            return '';
    }
}

const AssetManagement: React.FC<AssetManagementProps> = ({ view, setActiveView }) => {
    const { title, assetType, description } = viewConfig[view];
    // Initialize with empty array, data will be fetched from Supabase
    const [assets, setAssets] = useState<Asset[]>([]);
    
    // Modal States
    const [isCreateModalOpen, setCreateModalOpen] = useState(false);
    const [isDeleteModalOpen, setDeleteModalOpen] = useState(false);
    const [isDetailModalOpen, setDetailModalOpen] = useState(false);
    
    const [assetToDeleteId, setAssetToDeleteId] = useState<string | null>(null);
    const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
    const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
    
    const [searchTerm, setSearchTerm] = useState('');

    // Fetch data from Supabase when assetType changes
    useEffect(() => {
        const loadAssets = async () => {
            try {
                // Map UI type to DB type if needed
                const typeForDb = assetType === 'inspiration' ? 'idea' : assetType;
                const data = await fetchMaterials(typeForDb);
                
                if (data) {
                    const mappedAssets: Asset[] = data.map((item: any) => ({
                        id: item.id,
                        name: item.name,
                        type: item.type === 'idea' ? 'inspiration' : item.type,
                        content: item.content,
                        tags: item.tags || [],
                        data: { name: item.name } // Provide basic data, complete parsing could be added if DB stored JSON
                    }));
                    setAssets(mappedAssets);
                }
            } catch (error) {
                console.error("Failed to load assets", error);
            }
        };
        loadAssets();
    }, [assetType]);

    const filteredAssets = useMemo(() => {
        return assets.filter(asset => {
            const typeMatch = asset.type === assetType;
            if (!typeMatch) return false;

            const term = searchTerm.toLowerCase();
            if (!term) return true;

            const nameMatch = asset.name.toLowerCase().includes(term);
            const contentMatch = asset.content.toLowerCase().includes(term);
            const tagMatch = asset.tags.some(t => t.toLowerCase().includes(term));

            return nameMatch || contentMatch || tagMatch;
        });
    }, [assetType, assets, searchTerm]);

    const handleSaveAsset = async (formData: AssetFormData) => {
        // Parse comma-separated tags
        const tags = formData.tags 
            ? formData.tags.split(/[,，]/).map(t => t.trim()).filter(Boolean)
            : [];
        
        const formattedContent = formatAssetContent(assetType, formData);

        // Map 'inspiration' to 'idea' for database compatibility
        const dbType = assetType === 'inspiration' ? 'idea' : assetType;

        // Call Supabase
        await saveMaterial(formData.name, formattedContent, dbType, tags);

        // Refresh list locally (or ideally refetch)
        const newAsset: Asset = {
            id: `asset-${Date.now()}-${Math.random()}`,
            type: assetType,
            name: formData.name,
            content: formattedContent,
            tags: tags,
            data: formData
        };
        
        if (editingAsset) {
             setAssets(prev => prev.map(a => a.id === editingAsset.id ? { ...newAsset, id: editingAsset.id } : a));
        } else {
             // Optimistic update, real ID comes from refetch next time
             setAssets(prev => [newAsset, ...prev]);
        }

        setCreateModalOpen(false);
        setEditingAsset(null);
    };

    const handleCreate = () => {
        setEditingAsset(null);
        setCreateModalOpen(true);
    }

    const handleEdit = (asset: Asset) => {
        setEditingAsset(asset);
        setCreateModalOpen(true);
    }

    const handleOpenDeleteModal = (assetId: string) => {
        setAssetToDeleteId(assetId);
        setDeleteModalOpen(true);
    };

    const handleCloseDeleteModal = () => {
        setAssetToDeleteId(null);
        setDeleteModalOpen(false);
    };

    const handleConfirmDelete = async () => {
        if (assetToDeleteId) {
            // Call Supabase delete
            await deleteMaterial(assetToDeleteId);
            
            setAssets(prevAssets => prevAssets.filter(asset => asset.id !== assetToDeleteId));
            handleCloseDeleteModal();
            // Also close detail modal if we deleted the currently viewed asset
            if (selectedAsset?.id === assetToDeleteId) {
                setDetailModalOpen(false);
                setSelectedAsset(null);
            }
        }
    };

    const handleViewDetail = (asset: Asset) => {
        setSelectedAsset(asset);
        setDetailModalOpen(true);
    };

    const handleDeleteFromDetail = (id: string) => {
        handleOpenDeleteModal(id);
    };

    return (
        <div className="p-4 sm:p-6 lg:p-8 h-full">
            <CreateAssetModal
                isOpen={isCreateModalOpen}
                onClose={() => { setCreateModalOpen(false); setEditingAsset(null); }}
                onSave={handleSaveAsset}
                assetType={assetType}
                assetToEdit={editingAsset}
            />
            <DeleteConfirmationModal
                isOpen={isDeleteModalOpen}
                onClose={handleCloseDeleteModal}
                onConfirm={handleConfirmDelete}
            />
            <AssetDetailModal
                isOpen={isDetailModalOpen}
                onClose={() => setDetailModalOpen(false)}
                asset={selectedAsset}
                onDelete={handleDeleteFromDetail}
                onEdit={handleEdit}
            />

            <div className="space-y-6 animate-fade-in">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{title}</h1>
                        <p className="text-gray-500 dark:text-gray-400 mt-1">{description}</p>
                    </div>
                    <div className="flex items-center gap-2">
                         <div className="relative flex-grow md:flex-grow-0">
                            <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                                <svg className="w-5 h-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                                </svg>
                            </span>
                            <input
                                type="text"
                                placeholder="搜索素材、标签..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg border border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-sky-500 transition-colors"
                            />
                        </div>
                         <button 
                            onClick={() => setActiveView('creative-generation')}
                            className="px-4 py-2 bg-gray-200 dark:bg-gray-800 text-gray-800 dark:text-white font-semibold rounded-lg hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors flex-shrink-0">
                            从创意生成中导入
                        </button>
                        <button 
                            onClick={handleCreate}
                            className="px-4 py-2 bg-sky-600 text-white font-semibold rounded-lg hover:bg-sky-500 transition-colors flex-shrink-0">
                            + 创建素材
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredAssets.length > 0 ? filteredAssets.map(asset => {
                        const styles = ASSET_STYLES[asset.type];
                        return (
                            <div 
                                key={asset.id} 
                                onClick={() => handleViewDetail(asset)}
                                className={`p-5 rounded-xl border flex flex-col relative group transition-all cursor-pointer shadow-sm hover:shadow-md ${styles.border} bg-white dark:bg-gray-900`}
                            >
                                <div className="mb-3 pr-16">
                                    <h3 className="font-bold text-lg text-gray-900 dark:text-white truncate">{asset.name}</h3>
                                </div>
                                
                                <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed mb-4 line-clamp-3 h-16 overflow-hidden">
                                    {asset.content}
                                </p>

                                <div className="mt-auto">
                                    <div className="flex flex-wrap gap-2">
                                        {asset.tags && asset.tags.map((tag, index) => (
                                            <span key={index} className={`text-xs px-2 py-1 rounded-md font-medium ${getTagStyle(tag)}`}>
                                                #{tag}
                                            </span>
                                        ))}
                                        {(!asset.tags || asset.tags.length === 0) && (
                                            <span className="text-xs text-gray-400 italic">无标签</span>
                                        )}
                                    </div>
                                </div>

                                {/* Beautified Action Buttons - Blended style */}
                                <div className="absolute top-3 right-3 flex gap-1 z-10 opacity-100">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleEdit(asset);
                                        }}
                                        className="p-2 text-gray-400 hover:text-sky-600 dark:text-gray-500 dark:hover:text-sky-400 rounded-full transition-all transform hover:scale-110"
                                        title="编辑"
                                    >
                                        <Pencil className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleOpenDeleteModal(asset.id);
                                        }}
                                        className="p-2 text-gray-400 hover:text-red-600 dark:text-gray-500 dark:hover:text-red-400 rounded-full transition-all transform hover:scale-110"
                                        title="删除"
                                    >
                                        <Trash className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        );
                    }) : (
                        <div className="col-span-full text-center py-16 bg-white dark:bg-gray-900 rounded-lg border-2 border-dashed border-gray-200 dark:border-gray-800">
                            <p className="text-gray-400 dark:text-gray-500">
                                {searchTerm ? `没有找到与“${searchTerm}”相关的素材。` : '你的素材库是空的。'}
                            </p>
                            <p className="text-gray-400 dark:text-gray-500 mt-1">
                                {searchTerm ? '请尝试不同的关键词。' : '尝试创建一个新的素材吧！'}
                            </p>
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
};

export default AssetManagement;
