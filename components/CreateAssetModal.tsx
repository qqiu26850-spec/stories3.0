
import React, { useState, useEffect } from 'react';
import { Asset, AssetFormData } from '../types';
import { DocumentText, Sparkles, ChevronLeft, X, Plus } from './Icon';
import { getTagStyle } from './AssetManagement';

interface CreateAssetModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: AssetFormData) => void;
    assetType: Asset['type'];
    assetToEdit?: Asset | null;
    existingTags?: string[];
}

type CreationMode = 'choice' | 'template' | 'custom';

const MODAL_CONFIG: Record<Asset['type'], { title: string; fields: { id: keyof AssetFormData; label: string; placeholder: string; type: 'text' | 'textarea' }[] }> = {
    character: {
        title: '角色素材',
        fields: [
            { id: 'name', label: '人物姓名', placeholder: '例如：林夜', type: 'text' },
            { id: 'personality', label: '性格特点', placeholder: '例如：冷静、内敛、重情义', type: 'textarea' },
            { id: 'goldenFinger', label: '金手指', placeholder: '例如：掌握“影”之力', type: 'textarea' },
            { id: 'relationships', label: '人物关系', placeholder: '例如：是某古老家族的末代传人', type: 'textarea' },
            { id: 'notes', label: '补充内容', placeholder: '其他任何需要记录的设定...', type: 'textarea' },
        ]
    },
    plot: {
        title: '剧情素材',
        fields: [
            { id: 'name', label: '剧情标题', placeholder: '例如：遗失的徽记', type: 'text' },
            { id: 'plotPoints', label: '情节点', placeholder: '故事的核心线索、转折点等', type: 'textarea' },
            { id: 'scene', label: '场景描写', placeholder: '故事发生的具体场景描述', type: 'textarea' },
        ]
    },
    inspiration: {
        title: '灵光素材',
        fields: [
            { id: 'name', label: '灵光标题', placeholder: '例如：世界观：灵能都市', type: 'text' },
            { id: 'genre', label: '题材类型', placeholder: '例如：都市异能、科幻', type: 'text' },
            { id: 'coreTrope', label: '核心梗', placeholder: '例如：隐藏在现实下的超凡世界', type: 'text' },
            { id: 'notes', label: '灵感内容', placeholder: '记录一闪而过的奇思妙想...', type: 'textarea' },
        ]
    }
};

const CreateAssetModal: React.FC<CreateAssetModalProps> = ({ isOpen, onClose, onSave, assetType, assetToEdit, existingTags = [] }) => {
    const config = MODAL_CONFIG[assetType];
    const [creationMode, setCreationMode] = useState<CreationMode>('choice');
    
    const initialFormState = config.fields.reduce((acc, field) => {
        acc[field.id] = '';
        return acc;
    }, {} as any);

    const [formData, setFormData] = useState<AssetFormData>({ ...initialFormState, tags: '' });
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen) {
            if (assetToEdit) {
                setCreationMode('template'); 
                if (assetToEdit.data) {
                    setFormData({ ...initialFormState, ...assetToEdit.data });
                } else {
                    setFormData({ ...initialFormState, name: assetToEdit.name, notes: assetToEdit.content, tags: assetToEdit.tags.join(', ') });
                }
            } else {
                setCreationMode('choice');
                setFormData({ ...initialFormState, tags: '' });
            }
            setError('');
        }
    }, [isOpen, assetType, assetToEdit]);

    const handleChange = (id: keyof AssetFormData, value: string) => {
        setFormData(prev => ({ ...prev, [id]: value }));
    };

    const handleAddExistingTag = (tag: string) => {
        setFormData(prev => {
            const currentTags = prev.tags ? prev.tags.split(/[,，]/).map(t => t.trim()).filter(Boolean) : [];
            if (!currentTags.includes(tag)) {
                return { ...prev, tags: [...currentTags, tag].join(', ') };
            }
            return prev;
        });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name.trim()) {
            setError('标题不能为空。');
            return;
        }
        onSave(formData);
    };

    if (!isOpen) return null;

    if (creationMode === 'choice') {
        return (
            <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
                <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-fade-in-up" onClick={e => e.stopPropagation()}>
                    <div className="p-8 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-gray-900/50">
                        <div>
                            <h3 className="text-2xl font-bold text-gray-900 dark:text-white">新建{config.title}</h3>
                            <p className="text-sm text-gray-500 mt-1">请选择您喜欢的记录方式</p>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full text-gray-400">
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                    
                    <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                        <button 
                            onClick={() => setCreationMode('template')}
                            className="group p-8 bg-white dark:bg-gray-800 border-2 border-gray-100 dark:border-gray-700 rounded-2xl text-left hover:border-sky-500 transition-all hover:shadow-xl flex flex-col items-center text-center"
                        >
                            <div className="w-16 h-16 bg-sky-50 dark:bg-sky-900/30 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                <Sparkles className="w-8 h-8 text-sky-500" />
                            </div>
                            <h4 className="text-xl font-bold text-gray-900 dark:text-white mb-2">系统模板</h4>
                            <p className="text-sm text-gray-500 leading-relaxed">使用结构化字段，让您的设定更清晰、更完整。</p>
                        </button>

                        <button 
                            onClick={() => setCreationMode('custom')}
                            className="group p-8 bg-white dark:bg-gray-800 border-2 border-gray-100 dark:border-gray-700 rounded-2xl text-left hover:border-emerald-500 transition-all hover:shadow-xl flex flex-col items-center text-center"
                        >
                            <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-900/30 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                <DocumentText className="w-8 h-8 text-emerald-500" />
                            </div>
                            <h4 className="text-xl font-bold text-gray-900 dark:text-white mb-2">自定义输入</h4>
                            <p className="text-sm text-gray-500 leading-relaxed">直接输入标题与正文，自由记录灵感。</p>
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    const isCustom = creationMode === 'custom';
    const fieldsToRender: { id: keyof AssetFormData; label: string; placeholder: string; type: 'text' | 'textarea' }[] = isCustom 
        ? [{ id: 'name' as const, label: '素材标题', placeholder: '请输入一个响亮的标题...', type: 'text' as const },
           { id: 'notes' as const, label: '正文内容', placeholder: '在此记录您的灵感或设定...', type: 'textarea' as const }]
        : config.fields;

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden animate-fade-in-up max-h-[85vh]" onClick={e => e.stopPropagation()}>
                <div className="flex-shrink-0 p-5 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        {!assetToEdit && (
                            <button 
                                onClick={() => setCreationMode('choice')}
                                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full text-gray-500"
                            >
                                <ChevronLeft className="w-5 h-5" />
                            </button>
                        )}
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                            {assetToEdit ? `编辑${config.title}` : `新建${config.title} (${isCustom ? '自定义' : '模板'})`}
                        </h3>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full text-gray-400">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5 [scrollbar-gutter:stable]">
                    {fieldsToRender.map(field => (
                        <div key={field.id} className="space-y-2">
                            <label htmlFor={field.id} className="block text-sm font-bold text-gray-700 dark:text-gray-300 ml-1">
                                {field.label}
                            </label>
                            {field.type === 'textarea' ? (
                                <textarea
                                    id={field.id}
                                    value={formData[field.id] as string || ''}
                                    onChange={(e) => handleChange(field.id as keyof AssetFormData, e.target.value)}
                                    placeholder={field.placeholder}
                                    className={`w-full p-3 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:ring-2 outline-none transition-all resize-none shadow-sm ${isCustom ? 'h-48 focus:ring-emerald-500' : 'h-24 focus:ring-sky-500'}`}
                                />
                            ) : (
                                <input
                                    type="text"
                                    id={field.id}
                                    value={formData[field.id] as string || ''}
                                    onChange={(e) => handleChange(field.id as keyof AssetFormData, e.target.value)}
                                    placeholder={field.placeholder}
                                    className={`w-full p-3 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:ring-2 outline-none transition-all shadow-sm ${isCustom ? 'focus:ring-emerald-500' : 'focus:ring-sky-500'}`}
                                />
                            )}
                        </div>
                    ))}

                    <div className="pt-3 border-t border-gray-100 dark:border-gray-800 space-y-2">
                        <label htmlFor="tags" className="block text-sm font-bold text-gray-700 dark:text-gray-300 ml-1">
                            属性标签
                        </label>
                        <input
                            type="text"
                            id="tags"
                            value={formData.tags || ''}
                            onChange={(e) => handleChange('tags', e.target.value)}
                            placeholder="逗号或空格分隔，例如：主角 重要 伏笔"
                            className="w-full p-3 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-sky-500 outline-none transition-all shadow-sm"
                        />
                        {/* Existing tags selection */}
                        {existingTags.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-2">
                                {existingTags.map(tag => (
                                    <button 
                                        key={tag}
                                        type="button"
                                        onClick={() => handleAddExistingTag(tag)}
                                        className={`px-2 py-1 text-xs rounded-md border transition-all hover:opacity-80 flex items-center gap-1 ${getTagStyle(tag)}`}
                                    >
                                        <Plus className="w-3 h-3" />
                                        {tag}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {error && <p className="text-red-500 font-bold text-sm px-2">⚠️ {error}</p>}
                </form>

                <div className="flex-shrink-0 p-5 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 flex justify-end gap-4">
                    <button type="button" onClick={onClose} className="px-6 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 font-bold rounded-xl hover:bg-gray-50 transition-colors text-sm">取消</button>
                    <button type="submit" onClick={handleSubmit} className={`px-8 py-2 text-white font-bold rounded-xl shadow-xl transition-all active:scale-95 text-sm ${isCustom ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/20' : 'bg-sky-600 hover:bg-sky-500 shadow-sky-500/20'}`}>
                        {assetToEdit ? '保存修改' : '确认创建'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CreateAssetModal;
