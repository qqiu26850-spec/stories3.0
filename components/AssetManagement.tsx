
import React, { useMemo, useState, useEffect } from 'react';
import { ASSETS } from '../constants';
import { View, Asset, AssetFormData } from '../types';
import CreateAssetModal from './CreateAssetModal';
import DeleteConfirmationModal from './DeleteConfirmationModal';
import AssetDetailModal from './AssetDetailModal';
import { Pencil, Trash, Check } from './Icon';
import { saveMaterial, fetchMaterials, deleteMaterial } from '../services/supabaseService';

type AssetLibraryView = 'character-library' | 'plot-library' | 'inspiration-library';

interface AssetManagementProps {
  view: AssetLibraryView;
  setActiveView: (view: View) => void;
  isActive: boolean;
}

const viewConfig: Record<AssetLibraryView, { title: string; assetType: Asset['type']; description: string; }> = {
    'character-library': { title: '角色库', assetType: 'character', description: '管理你所有的角色设定，随时调用。' },
    'plot-library': { title: '剧情库', assetType: 'plot', description: '保存和整理关键的故事情节和线索。' },
    'inspiration-library': { title: '灵光库', assetType: 'inspiration', description: '记录一闪而过的灵感、世界观和独特设定。' }
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
    const { title, assetType, description } = viewConfig[view];
    const [assets, setAssets] = useState<Asset[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isCreateModalOpen, setCreateModalOpen] = useState(false);
    const [isDeleteModalOpen, setDeleteModalOpen] = useState(false);
    const [isDetailModalOpen, setDetailModalOpen] = useState(false);
    const [assetToDeleteId, setAssetToDeleteId] = useState<string | null>(null);
    const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
    const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
    const [successMessage, setSuccessMessage] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    const loadAssets = async () => {
        if (!isActive) return; setIsLoading(true);
        try {
            const data = await fetchMaterials(assetType === 'inspiration' ? 'idea' : assetType);
            setAssets(data.map((item: any) => ({
                id: item.id, name: item.name, type: item.type === 'idea' ? 'inspiration' : item.type, content: item.content, tags: item.tags || []
            })));
        } catch (e) {} finally { setIsLoading(false); }
    };

    useEffect(() => { loadAssets(); }, [assetType, isActive]);

    const filteredAssets = useMemo(() => assets.filter(a => !searchTerm || a.name.toLowerCase().includes(searchTerm.toLowerCase()) || a.content.toLowerCase().includes(searchTerm.toLowerCase())), [assets, searchTerm]);

    const handleSaveAsset = async (formData: AssetFormData) => {
        const tags = formData.tags ? formData.tags.split(/[,，]/).map(t => t.trim()).filter(Boolean) : [];
        const content = formData.notes || formData.personality || formData.plotPoints || editingAsset?.content || '';
        await saveMaterial(formData.name, content, assetType === 'inspiration' ? 'idea' : assetType, tags);
        setCreateModalOpen(false); setEditingAsset(null); loadAssets();
    };

    const handleConfirmDelete = async () => {
        if (assetToDeleteId) { await deleteMaterial(assetToDeleteId); setAssets(prev => prev.filter(a => a.id !== assetToDeleteId)); setDeleteModalOpen(false); if (selectedAsset?.id === assetToDeleteId) setDetailModalOpen(false); }
    };

    return (
        <div className="p-8 h-full animate-fade-in flex flex-col">
            <CreateAssetModal isOpen={isCreateModalOpen} onClose={() => setCreateModalOpen(false)} onSave={handleSaveAsset} assetType={assetType} assetToEdit={editingAsset} />
            <DeleteConfirmationModal isOpen={isDeleteModalOpen} onClose={() => setDeleteModalOpen(false)} onConfirm={handleConfirmDelete} />
            <AssetDetailModal isOpen={isDetailModalOpen} onClose={() => setDetailModalOpen(false)} asset={selectedAsset} onDelete={setAssetToDeleteId} onEdit={setEditingAsset} />

            <div className="mb-8 flex justify-between items-center">
                <div><h1 className="text-3xl font-bold text-gray-900 dark:text-white">{title}</h1><p className="text-gray-500 mt-1">{description}</p></div>
                <button onClick={() => setCreateModalOpen(true)} className="px-6 py-3 bg-sky-600 text-white font-bold rounded-xl hover:bg-sky-500 shadow-lg shadow-sky-500/20">+ 新建素材</button>
            </div>

            <div className="mb-6"><input type="text" placeholder="搜索素材..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full max-w-md px-4 py-2.5 bg-white dark:bg-gray-900 border rounded-xl focus:ring-2 focus:ring-sky-500 outline-none shadow-sm" /></div>

            {isLoading ? <div className="flex justify-center py-20"><div className="w-10 h-10 border-4 border-t-sky-500 rounded-full animate-spin"></div></div> : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {filteredAssets.map(asset => (
                        <div key={asset.id} onClick={() => { setSelectedAsset(asset); setDetailModalOpen(true); }} className="bg-white dark:bg-gray-900 p-8 rounded-2xl border border-gray-100 dark:border-gray-800 hover:shadow-2xl hover:border-sky-400 transition-all group cursor-pointer flex flex-col h-full relative">
                            <div className="flex justify-between items-start mb-4">
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white truncate pr-2">{asset.name}</h3>
                                <div className="opacity-0 group-hover:opacity-100 flex gap-2"><button onClick={e => { e.stopPropagation(); setEditingAsset(asset); setCreateModalOpen(true); }} className="p-1.5 text-gray-400 hover:text-sky-500 transition-colors"><Pencil className="w-5 h-5" /></button><button onClick={e => { e.stopPropagation(); setAssetToDeleteId(asset.id); setDeleteModalOpen(true); }} className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"><Trash className="w-5 h-5" /></button></div>
                            </div>
                            <p className="text-gray-500 dark:text-gray-400 text-sm mb-6 line-clamp-6 leading-loose whitespace-pre-wrap flex-grow">{asset.content}</p>
                            <div className="flex flex-wrap gap-2">{asset.tags.map((tag, i) => <span key={i} className={`text-xs px-2 py-1 rounded font-bold border ${getTagStyle(tag)}`}>{tag}</span>)}</div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default AssetManagement;
