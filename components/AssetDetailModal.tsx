
import React, { useState, useEffect } from 'react';
import { Asset } from '../types';
import { X, Trash, Pencil, Check, ArrowPath } from './Icon';
import { saveMaterial } from '../services/supabaseService';

interface AssetDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    asset: Asset | null;
    onDelete?: (id: string) => void;
    onEdit?: (asset: Asset) => void;
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

const AssetDetailModal: React.FC<AssetDetailModalProps> = ({ isOpen, onClose, asset: initialAsset, onDelete, onEdit }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editedContent, setEditedContent] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [localAsset, setLocalAsset] = useState<Asset | null>(initialAsset);

    useEffect(() => {
        if (isOpen && initialAsset) {
            setLocalAsset(initialAsset);
            setEditedContent(initialAsset.content);
            setIsEditing(false);
        }
    }, [isOpen, initialAsset]);

    const handleSave = async () => {
        if (!localAsset) return;
        setIsSaving(true);
        try {
            await saveMaterial(localAsset.name, editedContent, localAsset.type === 'inspiration' ? 'idea' : localAsset.type, localAsset.tags);
            setLocalAsset({...localAsset, content: editedContent});
            setIsEditing(false);
        } catch (e) {} finally { setIsSaving(false); }
    };

    if (!isOpen || !localAsset) return null;

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl w-full max-w-2xl p-8 animate-fade-in-up flex flex-col relative max-h-[90vh]" onClick={e => e.stopPropagation()}>
                <button onClick={onClose} className="absolute top-6 right-6 text-gray-400 hover:text-gray-600"><X className="w-6 h-6" /></button>
                <div className="mb-8">
                     <div className="flex items-center gap-3 mb-3">
                        <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{localAsset.name}</h3>
                        <span className="px-3 py-1 rounded-full text-xs font-bold bg-sky-100 text-sky-700">{localAsset.type === 'character' ? '角色' : localAsset.type === 'plot' ? '剧情' : '灵光'}</span>
                     </div>
                     <div className="flex flex-wrap gap-2">{localAsset.tags.map((tag, i) => <span key={i} className={`text-xs px-2 py-1 rounded font-bold border ${getTagStyle(tag)}`}>{tag}</span>)}</div>
                </div>

                <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-800 rounded-2xl p-6 border group relative">
                    {isEditing ? (
                        <div className="h-full flex flex-col">
                            <textarea value={editedContent} onChange={e => setEditedContent(e.target.value)} autoFocus className="flex-1 w-full bg-transparent outline-none text-sm leading-loose resize-none font-serif text-gray-700 dark:text-gray-300" />
                            <div className="flex justify-end gap-2 mt-4">
                                <button onClick={() => { setIsEditing(false); setEditedContent(localAsset.content); }} className="px-4 py-1.5 text-sm text-gray-500 font-bold">取消</button>
                                <button onClick={handleSave} disabled={isSaving} className="px-4 py-1.5 text-sm bg-sky-600 text-white rounded-lg font-bold flex items-center gap-2">
                                    {isSaving ? <ArrowPath className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                    保存修改
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div onClick={() => setIsEditing(true)} className="cursor-text group-hover:bg-gray-100/50 transition-colors p-2 rounded-lg h-full">
                            <pre className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300 font-serif leading-loose">{localAsset.content}</pre>
                            <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 text-xs text-sky-500 font-bold">点击内容直接修改</div>
                        </div>
                    )}
                </div>
               
                <div className="flex justify-between pt-8 mt-auto border-t">
                    <button onClick={() => onEdit?.(localAsset)} className="flex items-center gap-2 px-4 py-2 text-gray-500 font-bold hover:text-sky-600"><Pencil className="w-5 h-5" />复杂修改</button>
                    <button onClick={() => onDelete?.(localAsset.id)} className="flex items-center gap-2 px-4 py-2 text-red-500 font-bold hover:text-red-600"><Trash className="w-5 h-5" />彻底删除</button>
                </div>
            </div>
        </div>
    );
};

export default AssetDetailModal;
