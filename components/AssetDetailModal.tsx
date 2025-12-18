
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
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-6xl h-[90vh] animate-fade-in-up flex flex-col relative overflow-hidden" onClick={e => e.stopPropagation()}>
                {/* 顶部标题栏：保持简洁 */}
                <div className="flex-shrink-0 p-5 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 flex justify-between items-center">
                    <div className="flex items-center gap-3 overflow-hidden">
                        <h3 className="text-2xl font-bold text-gray-900 dark:text-white truncate">{localAsset.name}</h3>
                        <span className="px-3 py-1 rounded-lg text-xs font-bold bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300 flex-shrink-0">
                            {localAsset.type === 'character' ? '角色设定' : localAsset.type === 'plot' ? '剧情线索' : '灵感随笔'}
                        </span>
                    </div>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* 正文编辑区：视野更大 */}
                <div className="flex-1 overflow-y-auto p-8 bg-white dark:bg-gray-900">
                    <textarea 
                        value={editedContent} 
                        onChange={e => setEditedContent(e.target.value)} 
                        autoFocus 
                        className="w-full h-full min-h-[400px] bg-transparent outline-none text-lg leading-relaxed font-serif text-gray-800 dark:text-gray-200 resize-none placeholder:text-gray-300"
                        placeholder="在此展开描写素材的细节内容..."
                    />
                </div>
               
                {/* 底部固定页：标签移至此处，高度更小 */}
                <div className="flex-shrink-0 py-2.5 px-6 border-t border-gray-100 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-900/80 backdrop-blur-md flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap gap-2 max-w-[60%]">
                        {localAsset.tags.map((tag, i) => (
                            <span key={i} className={`text-[10px] px-2 py-0.5 rounded-md font-medium border ${getTagStyle(tag)}`}>{tag}</span>
                        ))}
                    </div>
                    <div className="flex items-center gap-3 ml-auto">
                        <button onClick={onClose} className="px-5 py-1.5 text-sm text-gray-500 font-bold hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">取消</button>
                        <button onClick={handleSave} disabled={isSaving} className="px-6 py-1.5 text-sm bg-sky-600 text-white rounded-lg font-bold flex items-center gap-2 hover:bg-sky-500 shadow-md shadow-sky-500/20 transition-all active:scale-95 disabled:bg-gray-400">
                            {isSaving ? <ArrowPath className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                            更新素材
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AssetDetailModal;
