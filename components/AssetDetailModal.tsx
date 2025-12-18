import React, { useState, useEffect } from 'react';
import { Asset } from '../types';
import { X, Trash, Pencil, Check, ArrowPath } from './Icon';
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

const AssetDetailModal: React.FC<AssetDetailModalProps> = ({ isOpen, onClose, asset: initialAsset, onDelete }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editedContent, setEditedContent] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [localAsset, setLocalAsset] = useState<Asset | null>(initialAsset);

    useEffect(() => {
        if (isOpen && initialAsset) {
            setLocalAsset(initialAsset);
            setEditedContent(initialAsset.content);
            setIsEditing(true); 
        }
    }, [isOpen, initialAsset]);

    const handleSave = async () => {
        if (!localAsset) return;
        setIsSaving(true);
        try {
            await saveMaterial(localAsset.name, editedContent, localAsset.type === 'inspiration' ? 'idea' : localAsset.type, localAsset.tags);
            setLocalAsset({...localAsset, content: editedContent});
            setIsEditing(false);
            onClose();
        } catch (e) {} finally { setIsSaving(false); }
    };

    if (!isOpen || !localAsset) return null;

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl w-full max-w-4xl p-10 animate-fade-in-up flex flex-col relative h-[85vh] max-h-[90vh]" onClick={e => e.stopPropagation()}>
                <button onClick={onClose} className="absolute top-8 right-8 text-gray-400 hover:text-gray-600 transition-colors"><X className="w-8 h-8" /></button>
                <div className="mb-8">
                     <div className="flex items-center gap-4 mb-4">
                        <h3 className="text-3xl font-bold text-gray-900 dark:text-white">{localAsset.name}</h3>
                        <span className="px-4 py-1 rounded-full text-sm font-bold bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300">
                            {localAsset.type === 'character' ? '角色设定' : localAsset.type === 'plot' ? '剧情线索' : '灵光记录'}
                        </span>
                     </div>
                     <div className="flex flex-wrap gap-2">{localAsset.tags.map((tag, i) => <span key={i} className={`text-xs px-3 py-1 rounded-full font-bold border ${getTagStyle(tag)}`}>{tag}</span>)}</div>
                </div>

                <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-800/30 rounded-2xl p-6 border border-gray-100 dark:border-gray-800 group relative shadow-inner">
                    <textarea 
                        value={editedContent} 
                        onChange={e => setEditedContent(e.target.value)} 
                        autoFocus 
                        className="w-full h-full bg-transparent outline-none text-base leading-loose resize-none font-serif text-gray-700 dark:text-gray-300 custom-scrollbar p-2"
                        placeholder="在此输入或修改素材内容..."
                    />
                </div>
               
                <div className="flex justify-between pt-8 mt-6 border-t border-gray-100 dark:border-gray-800">
                    <button onClick={() => onDelete?.(localAsset.id)} className="flex items-center gap-2 px-6 py-3 text-red-500 font-bold hover:bg-red-50 dark:hover:bg-red-900/20 rounded-2xl transition-all"><Trash className="w-6 h-6" /> 彻底删除</button>
                    <div className="flex gap-4">
                        <button onClick={onClose} className="px-8 py-3 text-base text-gray-500 font-bold hover:bg-gray-100 dark:hover:bg-gray-800 rounded-2xl transition-colors">取消</button>
                        <button onClick={handleSave} disabled={isSaving} className="px-10 py-3 text-base bg-sky-600 text-white rounded-2xl font-bold flex items-center gap-2 hover:bg-sky-500 shadow-xl shadow-sky-500/20 transition-all active:scale-95">
                            {isSaving ? <ArrowPath className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
                            确认并保存修改
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AssetDetailModal;