
import React, { useState, useEffect } from 'react';
import { Asset, AssetFormData } from '../types';

interface CreateAssetModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: AssetFormData) => void;
    assetType: Asset['type'];
    assetToEdit?: Asset | null;
}

const MODAL_CONFIG: Record<Asset['type'], { title: string; fields: { id: keyof AssetFormData; label: string; placeholder: string; type: 'text' | 'textarea' }[] }> = {
    character: {
        title: '创建新角色',
        fields: [
            { id: 'name', label: '人物姓名', placeholder: '例如：林夜', type: 'text' },
            { id: 'goldenFinger', label: '金手指', placeholder: '例如：掌握“影”之力', type: 'textarea' },
            { id: 'personality', label: '性格特点', placeholder: '例如：冷静、内敛、重情义', type: 'textarea' },
            { id: 'relationships', label: '人物关系', placeholder: '例如：是某古老家族的末代传人', type: 'textarea' },
            { id: 'notes', label: '补充内容', placeholder: '其他任何需要记录的设定...', type: 'textarea' },
        ]
    },
    plot: {
        title: '创建新剧情',
        fields: [
            { id: 'name', label: '剧情标题', placeholder: '例如：遗失的徽记', type: 'text' },
            { id: 'plotPoints', label: '情节点', placeholder: '故事的核心线索、转折点等', type: 'textarea' },
            { id: 'scene', label: '场景', placeholder: '故事发生的具体场景描述', type: 'textarea' },
        ]
    },
    inspiration: {
        title: '记录新灵光',
        fields: [
            { id: 'name', label: '灵光标题', placeholder: '例如：世界观：灵能都市', type: 'text' },
            { id: 'genre', label: '题材', placeholder: '例如：都市异能、科幻', type: 'text' },
            { id: 'elements', label: '元素', placeholder: '例如：未来都市、超能力', type: 'text' },
            { id: 'coreTrope', label: '核心梗', placeholder: '例如：隐藏在现实下的超凡世界', type: 'text' },
            { id: 'goldenFinger', label: '金手指', placeholder: '例如：主角获得的特殊能力或系统', type: 'textarea' },
            { id: 'notes', label: '补充内容', placeholder: '其他任何需要记录的设定...', type: 'textarea' },
        ]
    }
};

const CreateAssetModal: React.FC<CreateAssetModalProps> = ({ isOpen, onClose, onSave, assetType, assetToEdit }) => {
    const config = MODAL_CONFIG[assetType];
    const initialFormState = config.fields.reduce((acc, field) => {
        acc[field.id] = '';
        return acc;
    }, {} as any);

    const [formData, setFormData] = useState<AssetFormData>({ ...initialFormState, tags: '' });
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen) {
            if (assetToEdit && assetToEdit.data) {
                setFormData({ ...initialFormState, ...assetToEdit.data });
            } else if (assetToEdit) {
                // Fallback if structured data is missing but we are editing
                 setFormData({ 
                    ...initialFormState, 
                    name: assetToEdit.name, 
                    tags: assetToEdit.tags.join(', '),
                    // Put content in notes if specific fields are missing
                    notes: assetToEdit.content 
                });
            } else {
                setFormData({ ...initialFormState, tags: '' });
            }
            setError('');
        }
    }, [isOpen, assetType, assetToEdit]);

    const handleChange = (id: keyof AssetFormData, value: string) => {
        setFormData(prev => ({ ...prev, [id]: value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name.trim()) {
            setError('标题/姓名不能为空。');
            return;
        }
        onSave(formData);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-lg p-6 animate-fade-in-up flex flex-col" onClick={e => e.stopPropagation()}>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6 flex-shrink-0">
                    {assetToEdit ? `编辑${config.title.substring(2)}` : config.title}
                </h3>
                <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto pr-2 -mr-2 max-h-[70vh]">
                    {config.fields.map(field => (
                        <div key={field.id}>
                            <label htmlFor={field.id} className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">{field.label}</label>
                            {field.type === 'textarea' ? (
                                <textarea
                                    id={field.id}
                                    value={formData[field.id] as string || ''}
                                    onChange={(e) => handleChange(field.id, e.target.value)}
                                    placeholder={field.placeholder}
                                    className="w-full h-24 p-2 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md text-gray-900 dark:text-gray-200 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition resize-y"
                                />
                            ) : (
                                <input
                                    type="text"
                                    id={field.id}
                                    value={formData[field.id] as string || ''}
                                    onChange={(e) => handleChange(field.id, e.target.value)}
                                    placeholder={field.placeholder}
                                    className="w-full p-2 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md text-gray-900 dark:text-gray-200 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition"
                                />
                            )}
                        </div>
                    ))}

                    {/* Common Tags Field */}
                     <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
                        <label htmlFor="tags" className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">
                            标签 (可选)
                        </label>
                        <input
                            type="text"
                            id="tags"
                            value={formData.tags || ''}
                            onChange={(e) => handleChange('tags', e.target.value)}
                            placeholder="用逗号分隔，例如：重要, 主线, 伏笔"
                            className="w-full p-2 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md text-gray-900 dark:text-gray-200 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition"
                        />
                    </div>

                     {error && <p className="text-red-500 dark:text-red-400 text-sm">{error}</p>}
                    <div className="flex justify-end gap-3 pt-4 flex-shrink-0">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-500 dark:bg-gray-700 text-white font-semibold rounded-lg hover:bg-gray-600 dark:hover:bg-gray-600 transition-colors">
                            取消
                        </button>
                        <button type="submit" className="px-4 py-2 bg-sky-600 text-white font-semibold rounded-lg hover:bg-sky-500 transition-colors">
                            {assetToEdit ? '保存修改' : '创建'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreateAssetModal;
