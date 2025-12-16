
import React, { useState, useEffect } from 'react';
import { Prompt, PromptCategory, PromptField, PromptSubCategory } from '../types';
import { Trash } from './Icon';

type NewPromptData = Omit<Prompt, 'id' | 'heat' | 'content'>;

interface CreatePromptModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: NewPromptData, promptId?: string) => void;
    promptToEdit?: Prompt | null;
}

const TAG_OPTIONS: { id: PromptSubCategory; label: string }[] = [
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
        }
    }, [isOpen, promptToEdit]);

    const addField = () => {
        const newId = `field_${Date.now()}`;
        setFields([...fields, { id: newId, label: '', type: 'text', placeholder: '' }]);
    };

    const updateField = (index: number, key: keyof PromptField, value: string) => {
        const newFields = [...fields];
        const fieldToUpdate = { ...newFields[index] };
    
        if (key === 'label') {
            fieldToUpdate.label = value;
            fieldToUpdate.placeholder = `请输入${value}...`;
        } else if (key === 'type') {
            fieldToUpdate.type = value as 'text' | 'textarea';
        } else if (key === 'id') {
            fieldToUpdate.id = value.replace(/\s+/g, '');
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
                // Prevent removing the last tag
                if (prev.length <= 1) return prev;
                return prev.filter(t => t !== tag);
            } else {
                // Limit max tags if needed, e.g. max 3
                if (prev.length >= 3) return prev;
                return [...prev, tag];
            }
        });
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
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-2xl p-6 animate-fade-in-up flex flex-col" onClick={e => e.stopPropagation()}>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6 flex-shrink-0">{promptToEdit ? '编辑提示词' : '创建新提示词'}</h3>
                <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto pr-2 -mr-2 max-h-[75vh]">
                    {/* Standard Fields */}
                    <div className="grid grid-cols-1 gap-4">
                        <div>
                            <label htmlFor="prompt-category" className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">主分类</label>
                            <select id="prompt-category" value={category} onChange={(e) => setCategory(e.target.value as PromptCategory)} className="w-full p-2 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md text-gray-900 dark:text-gray-200 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition">
                                <option value="short-story">短篇小说</option>
                                <option value="long-story">长篇小说</option>
                                <option value="script">剧本</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-2">功能标签 (多选)</label>
                            <div className="flex flex-wrap gap-2">
                                {TAG_OPTIONS.map(tag => (
                                    <button
                                        key={tag.id}
                                        type="button"
                                        onClick={() => toggleSubCategory(tag.id)}
                                        className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-all ${
                                            subCategories.includes(tag.id)
                                            ? 'bg-sky-100 border-sky-500 text-sky-700 dark:bg-sky-900/50 dark:border-sky-400 dark:text-sky-300'
                                            : 'bg-gray-50 border-gray-200 text-gray-600 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                                        }`}
                                    >
                                        {tag.label}
                                    </button>
                                ))}
                            </div>
                            <p className="text-xs text-gray-400 mt-1">请选择 1-3 个标签</p>
                        </div>
                    </div>
                    <div>
                        <label htmlFor="prompt-title" className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">提示词标题</label>
                        <input type="text" id="prompt-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例如：赛博朋克城市氛围描写" className="w-full p-2 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md text-gray-900 dark:text-gray-200 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition"/>
                    </div>
                    <div>
                        <label htmlFor="prompt-description" className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">简介</label>
                        <textarea id="prompt-description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="简要描述这个提示词的作用、目的或适用场景。" className="w-full h-20 p-2 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md text-gray-900 dark:text-gray-200 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition resize-y"/>
                    </div>
                     <div>
                        <label htmlFor="prompt-template" className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">提示词模板</label>
                        <textarea id="prompt-template" value={template} onChange={(e) => setTemplate(e.target.value)} placeholder="输入你的提示词模板。使用 ${变量名} 来引用下方自定义的字段。例如：请描写一个${天气}的场景..." className="w-full h-32 p-2 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md text-gray-900 dark:text-gray-200 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition resize-y"/>
                    </div>

                    {/* Dynamic Fields */}
                    <div className="space-y-4 p-4 border border-dashed border-gray-300 dark:border-gray-700 rounded-lg">
                        <h4 className="font-semibold text-gray-800 dark:text-gray-200">自定义表单字段</h4>
                        {fields.map((field, index) => (
                            <div key={index} className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-md border border-gray-200 dark:border-gray-800 grid grid-cols-1 md:grid-cols-2 gap-4 items-end relative">
                                <button type="button" onClick={() => removeField(index)} className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors">
                                    <Trash className="w-4 h-4" />
                                </button>
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">字段标题</label>
                                    <input type="text" value={field.label} onChange={(e) => updateField(index, 'label', e.target.value)} placeholder="例如：写作风格" className="w-full p-2 text-sm bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-md text-gray-900 dark:text-gray-200 focus:ring-2 focus:ring-sky-500"/>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">变量名 (英文字母)</label>
                                    <input type="text" value={field.id} onChange={(e) => updateField(index, 'id', e.target.value)} placeholder="需手动输入，如：writingStyle" className="w-full p-2 text-sm bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-md text-gray-900 dark:text-gray-200 focus:ring-2 focus:ring-sky-500 font-mono"/>
                                </div>
                                <div className="md:col-span-2">
                                     <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">字段类型</label>
                                    <select value={field.type} onChange={(e) => updateField(index, 'type', e.target.value)} className="w-full p-2 text-sm bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-md text-gray-900 dark:text-gray-200 focus:ring-2 focus:ring-sky-500">
                                        <option value="text">单行文本</option>
                                        <option value="textarea">多行文本</option>
                                    </select>
                                </div>
                            </div>
                        ))}
                        <button type="button" onClick={addField} className="w-full py-2 bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-200 font-semibold rounded-md hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors">
                            + 添加字段
                        </button>
                    </div>

                    {error && <p className="text-red-500 dark:text-red-400 text-sm">{error}</p>}
                    
                    <div className="flex justify-end gap-3 pt-4 flex-shrink-0">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-500 dark:bg-gray-700 text-white font-semibold rounded-lg hover:bg-gray-600 dark:hover:bg-gray-600 transition-colors">取消</button>
                        <button type="submit" className="px-4 py-2 bg-sky-600 text-white font-semibold rounded-lg hover:bg-sky-500 transition-colors">{promptToEdit ? '保存修改' : '保存提示词'}</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreatePromptModal;
