
import React, { useState, useEffect } from 'react';
import { Asset } from '../types';
import { X, Check, ArrowPath } from './Icon';
import { saveMaterial } from '../services/supabaseService';

interface AssetDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    asset: Asset | null;
    onDelete?: (id: string) => void;
}

const TAG_COLORS = [
  'bg-red-50 text-red-700 border-red-100', 'bg-orange-50 text-orange-700 border-orange-100', 'bg-amber-50 text-amber-700 border-amber-100',
  'bg-green-50 text-green-700 border-green-100', 'bg-emerald-50 text-emerald-700 border-emerald-100', 'bg-sky-50 text-sky-700 border-sky-100',
  'bg-blue-50 text-blue-700 border-blue-100', 'bg-purple-50 text-purple-700 border-purple-100', 'bg-rose-50 text-rose-700 border-rose-100'
];

const getTagStyle = (tag: string) => {
  let hash = 0; for (let i = 0; i < tag.length; i++) hash = tag.charCodeAt(i) + ((hash << 5) - hash);
  const index = Math.abs(hash) % TAG_COLORS.length; return TAG_COLORS[index];
};

const AssetDetailModal: React.FC<AssetDetailModalProps> = ({ isOpen, onClose, asset: initialAsset }) => {
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
            await saveMaterial(localAsset.name, editedContent, localAsset.type === 'inspiration' ? 'idea' : localAsset.type, localAsset.tags);
            setLocalAsset({...localAsset, content: editedContent});
            onClose();
        } catch (e) {
            console.error("Save failed", e);
        } finally { setIsSaving(false); }
    };

    if (!isOpen || !localAsset) return null;

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] animate-fade-in-up flex flex-col relative overflow-hidden" onClick={e => e.stopPropagation()}>
                {/* Header: Reduced height and font size */}
                <div className="flex-shrink-0 p-4 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 flex justify-between items-center">
                    <div className="flex items-center gap-3 overflow-hidden">
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white truncate">{localAsset.name}</h3>
                        <span className="px-3 py-0.5 rounded-full text-xs font-bold bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300 flex-shrink-0">
                            {localAsset.type === 'character' ? '角色' : localAsset.type === 'plot' ? '剧情' : '灵光'}
                        </span>
                    </div>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Tags Area */}
                <div className="px-6 py-2 flex flex-wrap gap-2 bg-gray-50/30 dark:bg-black/10">
                    {localAsset.tags.map((tag, i) => (
                        <span key={i} className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${getTagStyle(tag)}`}>{tag}</span>
                    ))}
                </div>

                {/* Content Area: Single Scrollable View */}
                <div className="flex-1 overflow-y-auto p-6 bg-white dark:bg-gray-900">
                    <textarea 
                        value={editedContent} 
                        onChange={e => setEditedContent(e.target.value)} 
                        autoFocus 
                        className="w-full min-h-[300px] h-full bg-transparent outline-none text-base leading-loose font-serif text-gray-700 dark:text-gray-300 resize-none"
                        placeholder="在此输入或修改素材内容..."
                    />
                </div>
               
                {/* Footer: Simplified and ensures buttons stay in view */}
                <div className="flex-shrink-0 p-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 flex justify-end gap-3">
                    <button onClick={onClose} className="px-6 py-2 text-sm text-gray-500 font-bold hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors">取消</button>
                    <button onClick={handleSave} disabled={isSaving} className="px-8 py-2 text-sm bg-sky-600 text-white rounded-xl font-bold flex items-center gap-2 hover:bg-sky-500 shadow-lg shadow-sky-500/20 transition-all active:scale-95">
                        {isSaving ? <ArrowPath className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                        保存修改
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AssetDetailModal;
