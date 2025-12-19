import React, { useState, useEffect } from 'react';
import { Asset } from '../types';
import { X, Check, ArrowPath } from './Icon';
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
    const [editedContent, setEditedContent] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [localAsset, setLocalAsset] = useState<Asset | null>(initialAsset);

    useEffect(() => {
        if (isOpen && initialAsset) {
            setLocalAsset(initialAsset);
            setEditedContent(initialAsset.content);
        }
    }, [isOpen, initialAsset]);

    const handleSave = async () => {
        if (!localAsset) return;
        setIsSaving(true);
        try {
            await updateMaterial(localAsset.id, { content: editedContent });
            setLocalAsset({...localAsset, content: editedContent});
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
                    <div className="flex items-center gap-3 overflow-hidden">
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white truncate">{localAsset.name}</h3>
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
               
                <div className="flex-shrink-0 py-2.5 px-6 border-t border-gray-100 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-900/80 backdrop-blur-md flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap gap-2 max-w-[60%] overflow-x-auto no-scrollbar">
                        {localAsset.tags.map((tag, i) => (
                            <span key={i} className={`text-[10px] px-2 py-0.5 rounded-md font-medium border whitespace-nowrap ${getTagStyle(tag)}`}>{tag}</span>
                        ))}
                    </div>
                    <div className="flex items-center gap-3 ml-auto">
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