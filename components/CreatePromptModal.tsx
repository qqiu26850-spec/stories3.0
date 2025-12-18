
import React, { useState, useEffect } from 'react';
import { Prompt, PromptCategory, PromptField, PromptSubCategory } from '../types';
import { Trash, Sparkles, Check, Bars2 } from './Icon';

type NewPromptData = Omit<Prompt, 'id' | 'heat' | 'content'>;

interface CreatePromptModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: NewPromptData, promptId?: string) => void;
    promptToEdit?: Prompt | null;
}

const CATEGORIES: { id: PromptCategory; label: string }[] = [
    { id: 'short-story', label: '短篇小说' },
    { id: 'long-story', label: '长篇小说' },
    { id: 'script', label: '剧本' },
    { id: 'general', label: '通用' },
];

const GENRE_TAGS: { id: PromptSubCategory; label: string }[] = [
    { id: 'general', label: '通用' },
    { id: 'modern-romance', label: '现言' },
    { id: 'ancient-romance', label: '古言' },
    { id: 'period', label: '年代' },
    { id: 'apocalypse', label: '末世' },
    { id: 'urban', label: '都市' },
    { id: 'fantasy', label: '玄幻' },
    { id: 'history', label: '历史' },
    { id: 'social', label: '世情' },
    { id: 'suspense', label: '悬疑' },
    { id: 'sci-fi', label: '科幻' },
];

const FUNCTION_TAGS: { id: PromptSubCategory; label: string }[] = [
    { id: 'idea', label: '创意' },
    { id: 'golden_finger', label: '金手指' },
    { id: 'character_design', label: '人物设定' },
    { id: 'worldview', label: '世界观' },
    { id: 'outline', label: '大纲' },
    { id: 'detailed_outline', label: '细纲' },
    { id: 'synopsis', label: '简介' },
    { id: 'requirements', label: '写作要求' },
    { id: 'style', label: '写作风格' },
    { id: 'continue', label: '续写' },
    { id: 'polish', label: '润色' },
    { id: 'writing', label: '写稿' },
    { id: 'proofread', label: '校对' },
];

const CreatePromptModal: React.FC<CreatePromptModalProps> = ({ isOpen, onClose, onSave, promptToEdit }) => {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [template, setTemplate] = useState('');
    const [category, setCategory] = useState<PromptCategory>('short-story');
    const [subCategories, setSubCategories] = useState<PromptSubCategory[]>(['idea']);
    const [fields, setFields] = useState<PromptField[]>([]);
    const [error, setError] = useState('');
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

    useEffect(() => {
        if (isOpen) {
            if (promptToEdit) {
                setTitle(promptToEdit.title);
                setDescription(promptToEdit.description);
                setTemplate(promptToEdit.template || promptToEdit.content);
                setCategory(promptToEdit.category);
                setSubCategories(promptToEdit.subCategories && promptToEdit.subCategories.length > 0 ? promptToEdit.subCategories : ['idea']);
                setFields(promptToEdit.fields || []);
            } else {
                setTitle('');
                setDescription('');
                setTemplate('');
                setCategory('short-story');
                setSubCategories(['idea']);
                setFields([]);
            }
            setError('');
            setDraggedIndex(null);
        }
    }, [isOpen, promptToEdit]);

    const addField = () => {
        const newId = `field_${Date.now()}`;
        setFields([...fields, { 
            id: newId, 
            label: '', 
            type: 'text', 
            placeholder: '',
            required: true,
            description: ''
        }]);
    };

    const updateField = (index: number, key: keyof PromptField, value: any) => {
        const newFields = [...fields];
        const fieldToUpdate = { ...newFields[index] };
    
        if (key === 'label') {
            fieldToUpdate.label = value;
            fieldToUpdate.placeholder = `请输入${value}...`;
        } else if (key === 'type') {
            fieldToUpdate.type = value as 'text' | 'textarea';
        } else if (key === 'id') {
            fieldToUpdate.id = value.replace(/\s+/g, '');
        } else if (key === 'required') {
            fieldToUpdate.required = value;
        } else if (key === 'description') {
            fieldToUpdate.description = value;
        }
    
        newFields[index] = fieldToUpdate;
        setFields(newFields);
    };
    
    const removeField = (index: number) => {
        setFields(fields.filter((_, i) => i !== index));
    };

    const toggleSubCategory = (tag: PromptSubCategory) => {
        setSubCategories(prev => {
            if (prev.includes(tag)) {
                if (prev.length <= 1) return prev;
                return prev.filter(t => t !== tag);
            } else {
                if (prev.length >= 5) return prev;
                return [...prev, tag];
            }
        });
    };

    const handleDragStart = (index: number) => {
        setDraggedIndex(index);
    };

    const handleDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault();
    };

    const handleDrop = (targetIndex: number) => {
        if (draggedIndex === null || draggedIndex === targetIndex) return;
        
        const newFields = [...fields];
        const draggedItem = newFields[draggedIndex];
        newFields.splice(draggedIndex, 1);
        newFields.splice(targetIndex, 0, draggedItem);
        setFields(newFields);
        setDraggedIndex(null);
    };
    
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim()) { setError('标题不能为空。'); return; }
        if (!description.trim()) { setError('简介不能为空。'); return; }
        if (!template.trim()) { setError('提示词模板不能为空。'); return; }
        if (fields.some(f => !f.label.trim() || !f.id.trim())) {
            setError('所有自定义字段都必须有标题和变量名。');
            return;
        }
        if (subCategories.length === 0) {
            setError('请至少选择一个标签。');
            return;
        }
        
        onSave({
            title,
            description,
            template,
            category,
            subCategories: subCategories,
            fields,
            creator: 'user',
        }, promptToEdit?.id);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 dark:bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm" onClick={onClose}>
            {/* Modal width increased to max-w-5xl */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-5xl p-8 animate-fade-in-up flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Sparkles className="w-6 h-6 text-sky-500" />
                        {promptToEdit ? '编辑提示词' : '创建新提示词'}
                    </h3>
                </div>
                
                <form onSubmit={handleSubmit} className="space-y-6 overflow-y-auto pr-2 -mr-2 flex-1">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">提示词标题</label>
                            <input 
                                type="text" 
                                value={title} 
                                onChange={(e) => setTitle(e.target.value)} 
                                placeholder="例如：赛博朋克城市氛围描写" 
                                className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-sky-500 outline-none transition"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">主分类</label>
                            <div className="relative">
                                <select 
                                    value={category} 
                                    onChange={(e) => setCategory(e.target.value as PromptCategory)} 
                                    className="w-full py-3 pl-3 pr-8 text-sm font-medium bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-sky-500 outline-none transition appearance-none cursor-pointer"
                                >
                                    {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                                </select>
                                <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none text-gray-500">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">标签选择 (多选)</label>
                        <div className="space-y-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-100 dark:border-gray-800">
                            <div>
                                <span className="text-xs font-bold text-gray-400 mb-2 block uppercase">题材标签</span>
                                <div className="flex flex-wrap gap-2">
                                    {GENRE_TAGS.map(tag => (
                                        <button
                                            key={tag.id}
                                            type="button"
                                            onClick={() => toggleSubCategory(tag.id)}
                                            className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-all ${
                                                subCategories.includes(tag.id)
                                                ? 'bg-purple-100 border-purple-500 text-purple-700 dark:bg-purple-900/50 dark:border-purple-400 dark:text-purple-300 shadow-sm'
                                                : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                                            }`}
                                        >
                                            {tag.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            
                            <div>
                                <span className="text-xs font-bold text-gray-400 mb-2 block uppercase">功能标签</span>
                                <div className="flex flex-wrap gap-2">
                                    {FUNCTION_TAGS.map(tag => (
                                        <button
                                            key={tag.id}
                                            type="button"
                                            onClick={() => toggleSubCategory(tag.id)}
                                            className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-all ${
                                                subCategories.includes(tag.id)
                                                ? 'bg-sky-100 border-sky-500 text-sky-700 dark:bg-sky-900/50 dark:border-sky-400 dark:text-sky-300 shadow-sm'
                                                : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                                            }`}
                                        >
                                            {tag.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <p className="text-xs text-gray-400 mt-1.5 ml-1">可组合选择题材与功能</p>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">简介</label>
                        <textarea 
                            value={description} 
                            onChange={(e) => setDescription(e.target.value)} 
                            placeholder="简要描述这个提示词的作用、目的或适用场景。" 
                            className="w-full h-24 p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-sky-500 outline-none transition resize-y text-xs"
                        />
                    </div>

                     <div>
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">提示词模板</label>
                        <textarea 
                            value={template} 
                            onChange={(e) => setTemplate(e.target.value)} 
                            placeholder="输入你的提示词模板。使用 ${变量名} 来引用下方自定义的字段。例如：请描写一个${天气}的场景..." 
                            className="w-full h-32 p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-sky-500 outline-none transition resize-y font-mono text-sm"
                        />
                    </div>

                    <div className="space-y-4 p-5 bg-sky-50/50 dark:bg-sky-900/10 border border-sky-100 dark:border-sky-900/30 rounded-xl">
                        <div className="flex justify-between items-center">
                            <h4 className="font-bold text-gray-800 dark:text-gray-200">自定义表单字段</h4>
                            <button type="button" onClick={addField} className="text-xs px-3 py-1.5 bg-sky-100 text-sky-700 dark:bg-sky-800 dark:text-sky-300 rounded-md font-bold hover:bg-sky-200 dark:hover:bg-sky-700 transition-colors">
                                + 添加字段
                            </button>
                        </div>
                        
                        {fields.length === 0 && (
                            <div className="text-center py-4 text-gray-400 text-sm">
                                暂无字段，点击上方添加以创建动态模板
                            </div>
                        )}

                        {fields.map((field, index) => (
                            <div 
                                key={field.id} 
                                className={`p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 grid grid-cols-1 md:grid-cols-12 gap-3 relative shadow-sm transition-all duration-200 ${draggedIndex === index ? 'opacity-50 scale-[0.98] border-sky-300 ring-2 ring-sky-100' : ''}`}
                                draggable
                                onDragStart={() => handleDragStart(index)}
                                onDragOver={(e) => handleDragOver(e, index)}
                                onDrop={() => handleDrop(index)}
                            >
                                <div className="absolute top-2 left-2 flex items-center gap-1 cursor-grab active:cursor-grabbing text-gray-400 hover:text-sky-500" title="拖拽排序">
                                    <Bars2 className="w-3 h-3" />
                                    <span className="text-[10px] font-bold select-none">{index + 1}.</span>
                                </div>
                                
                                <div className="md:col-span-5 pl-4">
                                    <label className="block text-xs font-medium text-gray-500 mb-1">字段标题</label>
                                    <input 
                                        type="text" 
                                        value={field.label} 
                                        onChange={(e) => updateField(index, 'label', e.target.value)} 
                                        placeholder="如：写作风格" 
                                        className="w-full p-2 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded focus:ring-1 focus:ring-sky-500 outline-none"
                                        onMouseDown={(e) => e.stopPropagation()} 
                                    />
                                </div>
                                <div className="md:col-span-4">
                                    <label className="block text-xs font-medium text-gray-500 mb-1">变量名 (English)</label>
                                    <input 
                                        type="text" 
                                        value={field.id} 
                                        onChange={(e) => updateField(index, 'id', e.target.value)} 
                                        placeholder="如：style" 
                                        className="w-full p-2 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded focus:ring-1 focus:ring-sky-500 outline-none font-mono"
                                        onMouseDown={(e) => e.stopPropagation()}
                                    />
                                </div>
                                <div className="md:col-span-3">
                                     <label className="block text-xs font-medium text-gray-500 mb-1">类型</label>
                                    <select 
                                        value={field.type} 
                                        onChange={(e) => updateField(index, 'type', e.target.value)} 
                                        className="w-full p-2 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded focus:ring-1 focus:ring-sky-500 outline-none"
                                        onMouseDown={(e) => e.stopPropagation()}
                                    >
                                        <option value="text">单行</option>
                                        <option value="textarea">多行</option>
                                    </select>
                                </div>

                                <div className="md:col-span-8 pl-4">
                                    <label className="block text-xs font-medium text-blue-500 mb-1">填写说明 (选填)</label>
                                    <input 
                                        type="text" 
                                        value={field.description || ''} 
                                        onChange={(e) => updateField(index, 'description', e.target.value)} 
                                        placeholder="如：请描述您希望的文章基调" 
                                        className="w-full p-2 text-[10px] bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded focus:ring-1 focus:ring-sky-500 outline-none text-gray-600 dark:text-gray-400"
                                        onMouseDown={(e) => e.stopPropagation()}
                                    />
                                </div>
                                <div className="md:col-span-3 flex items-end pb-2">
                                    <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-600 dark:text-gray-300" onMouseDown={(e) => e.stopPropagation()}>
                                        <input 
                                            type="checkbox" 
                                            checked={field.required !== false} 
                                            onChange={(e) => updateField(index, 'required', e.target.checked)}
                                            className="w-4 h-4 text-sky-600 rounded border-gray-300 focus:ring-sky-500"
                                        />
                                        必填项
                                    </label>
                                </div>
                                <div className="md:col-span-1 flex justify-center items-end pb-1">
                                    <button 
                                        type="button" 
                                        onClick={() => removeField(index)} 
                                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors" 
                                        title="删除字段"
                                        onMouseDown={(e) => e.stopPropagation()}
                                    >
                                        <Trash className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    {error && <p className="text-red-500 dark:text-red-400 text-sm font-medium text-center">{error}</p>}
                    
                    <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
                        <button type="button" onClick={onClose} className="px-5 py-2.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-bold rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">取消</button>
                        <button type="submit" className="px-6 py-2.5 bg-sky-600 text-white font-bold rounded-lg hover:bg-sky-500 shadow-lg shadow-sky-500/30 transition-all">{promptToEdit ? '保存修改' : '立即创建'}</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreatePromptModal;
