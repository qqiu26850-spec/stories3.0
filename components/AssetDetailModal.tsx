import React, { useState, useEffect } from 'react';
import { Asset } from '../types';
import { X, Check, ArrowPath, Plus, Pencil } from './Icon';
import { updateMaterial } from '../services/supabaseService';

interface AssetDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    asset: Asset | null;
    onDelete?: (id: string) => void;
    onSaveSuccess?: () => void;
}

const TAG_COLORS = [
  'bg-red-50 text-red-700 border border-red-100 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800',
  'bg-orange-50 text-orange-700 border border-orange-100 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800',
  'bg-amber-50 text-amber-700 border border-amber-100 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800',
  'bg-yellow-50 text-yellow-700 border border-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800',
  'bg-green-50 text-green-700 border border-green-100 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800',
  'bg-emerald-50 text-emerald-700 border border-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800',
  'bg-sky-50 text-sky-700 border border-sky-100 dark:bg-sky-900/30 dark:text-sky-300 dark:border-sky-800',
  'bg-blue-50 text-blue-700 border border-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800',
  'bg-purple-50 text-purple-700 border border-purple-100 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800',
  'bg-rose-50 text-rose-700 border border-rose-100 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-800'
];

const getTagStyle = (tag: string) => {
  let hash = 0; for (let i = 0; i < tag.length; i++) hash = tag.charCodeAt(i) + ((hash << 5) - hash);
  const index = Math.abs(hash) % TAG_COLORS.length; return TAG_COLORS[index];
};

const AssetDetailModal: React.FC<AssetDetailModalProps> = ({ isOpen, onClose, asset: initialAsset, onSaveSuccess }) => {
    const [editedName, setEditedName] = useState('');
    const [editedContent, setEditedContent] = useState('');
    const [tags, setTags] = useState<string[]>([]);
    const [newTag, setNewTag] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [localAsset, setLocalAsset] = useState<Asset | null>(initialAsset);

    useEffect(() => {
        if (isOpen && initialAsset) {
            setLocalAsset(initialAsset);
            setEditedName(initialAsset.name);
            setEditedContent(initialAsset.content);
            setTags(initialAsset.tags || []);
        }
    }, [isOpen, initialAsset]);

    const handleAddTag = (e?: React.FormEvent) => {
        e?.preventDefault();
        const trimmed = newTag.trim();
        if (trimmed && !tags.includes(trimmed)) {
            setTags(prev => [...prev, trimmed]);
            setNewTag('');
        }
    };

    const handleRemoveTag = (tagToRemove: string) => {
        setTags(prev => prev.filter(t => t !== tagToRemove));
    };

    const handleSave = async () => {
        if (!localAsset) return;
        if (!editedName.trim()) {
            alert('素材名称不能为空');
            return;
        }
        setIsSaving(true);
        try {
            await updateMaterial(localAsset.id, { 
                name: editedName,
                content: editedContent,
                tags: tags
            });
            setLocalAsset({...localAsset, name: editedName, content: editedContent, tags: tags});
            if (onSaveSuccess) onSaveSuccess();
            onClose();
        } catch (e) {
            console.error("Save failed", e);
        } finally { setIsSaving(false); }
    };

    if (!isOpen || !localAsset) return null;

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-6xl h-[90vh] animate-fade-in-up flex flex-col relative overflow-hidden font-sans" onClick={e => e.stopPropagation()}>
                <div className="flex-shrink-0 p-5 border-b border-gray-100 dark:border-gray-800 bg-sky-50/50 dark:bg-sky-900/10 flex justify-between items-center">
                    <div className="flex items-center gap-4 flex-1 mr-4">
                        <div className="relative flex-1 group">
                            <input 
                                type="text"
                                value={editedName}
                                onChange={e => setEditedName(e.target.value)}
                                placeholder="输入素材标题..."
                                className="w-full bg-transparent border-none focus:ring-0 text-xl font-bold text-gray-900 dark:text-white truncate py-1 hover:bg-white/50 dark:hover:bg-black/20 rounded transition-colors"
                            />
                            <Pencil className="w-4 h-4 text-sky-400 absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity" />
                        </div>
                        <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-bold bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300 flex-shrink-0">
                            {localAsset.type === 'character' ? '角色设定' : localAsset.type === 'plot' ? '剧情线索' : '灵感随笔'}
                        </span>
                    </div>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-8 bg-white dark:bg-gray-900 font-sans">
                    <textarea 
                        value={editedContent} 
                        onChange={e => setEditedContent(e.target.value)} 
                        autoFocus 
                        className="w-full h-full min-h-[400px] bg-transparent outline-none text-base leading-relaxed font-serif text-gray-800 dark:text-gray-200 resize-none placeholder:text-gray-300"
                        placeholder="在此展开描写素材的细节内容..."
                    />
                </div>
               
                <div className="flex-shrink-0 py-4 px-6 border-t border-gray-100 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-900/80 backdrop-blur-md flex flex-col gap-4">
                    <div className="flex flex-col gap-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                            素材标签管理
                        </label>
                        <div className="flex flex-wrap gap-2 items-center">
                            {tags.map((tag, i) => (
                                <span key={i} className={`group flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-md font-bold border ${getTagStyle(tag)}`}>
                                    {tag}
                                    <button 
                                        onClick={() => handleRemoveTag(tag)}
                                        className="hover:text-red-600 transition-colors opacity-60 group-hover:opacity-100"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </span>
                            ))}
                            <div className="flex items-center gap-2 ml-1">
                                <input 
                                    type="text"
                                    value={newTag}
                                    onChange={e => setNewTag(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleAddTag()}
                                    placeholder="添加标签..."
                                    className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1 text-[10px] outline-none focus:ring-1 focus:ring-sky-500 w-24"
                                />
                                <button 
                                    onClick={() => handleAddTag()}
                                    className="p-1.5 bg-sky-100 text-sky-600 rounded-md hover:bg-sky-200 transition-colors"
                                >
                                    <Plus className="w-3 h-3" />
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-100 dark:border-gray-800">
                        <button onClick={onClose} className="px-5 py-1.5 text-sm text-gray-500 font-bold hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">取消</button>
                        <button onClick={handleSave} disabled={isSaving} className="px-6 py-1.5 text-sm bg-sky-600 text-white rounded-lg font-bold flex items-center gap-2 hover:bg-sky-500 shadow-md shadow-sky-500/20 transition-all active:scale-95 disabled:bg-gray-400">
                            {isSaving ? <ArrowPath className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                            保存更新
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AssetDetailModal;