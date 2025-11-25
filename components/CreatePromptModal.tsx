
import React, { useState, useEffect } from 'react';
import { Prompt, PromptCategory, PromptField, PromptSubCategory } from '../types';
import { Trash } from './Icon';

type NewPromptData = Omit<Prompt, 'id' | 'heat' | 'content'>;

interface CreatePromptModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: NewPromptData) => void;
}

const CreatePromptModal: React.FC<CreatePromptModalProps> = ({ isOpen, onClose, onSave }) => {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [template, setTemplate] = useState('');
    const [category, setCategory] = useState<PromptCategory>('short-story');
    const [subCategory, setSubCategory] = useState<PromptSubCategory>('requirements');
    const [fields, setFields] = useState<PromptField[]>([]);
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen) {
            setTitle('');
            setDescription('');
            setTemplate('');
            setCategory('short-story');
            setSubCategory('requirements');
            setFields([]);
            setError('');
        }
    }, [isOpen]);

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
            // Remove auto-generation of id/variable name
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
    
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim()) { setError('标题不能为空。'); return; }
        if (!description.trim()) { setError('简介不能为空。'); return; }
        if (!template.trim()) { setError('提示词模板不能为空。'); return; }
        if (fields.some(f => !f.label.trim() || !f.id.trim())) {
            setError('所有自定义字段都必须有标题和变量名。');
            return;
        }
        onSave({
            title,
            description,
            template,
            category,
            subCategories: [subCategory],
            fields,
            creator: 'user',
        });
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-2xl p-6 animate-fade-in-up flex flex-col" onClick={e => e.stopPropagation()}>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6 flex-shrink-0">创建新提示词</h3>
                <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto pr-2 -mr-2 max-h-[75vh]">
                    {/* Standard Fields */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="prompt-category" className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">分类</label>
                            <select id="prompt-category" value={category} onChange={(e) => setCategory(e.target.value as PromptCategory)} className="w-full p-2 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md text-gray-900 dark:text-gray-200 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition">
                                <option value="short-story">短篇小说</option>
                                <option value="long-story">长篇小说</option>
                                <option value="script">剧本</option>
                            </select>
                        </div>
                        <div>
                            <label htmlFor="prompt-subcategory" className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">子分类</label>
                            <select id="prompt-subcategory" value={subCategory} onChange={(e) => setSubCategory(e.target.value as PromptSubCategory)} className="w-full p-2 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md text-gray-900 dark:text-gray-200 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition">
                                <option value="requirements">写作要求/构思</option>
                                <option value="style">写作风格</option>
                                <option value="continue">续写</option>
                                <option value="polish">润色</option>
                                <option value="proofread">审稿/评审</option>
                            </select>
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
                        <button type="submit" className="px-4 py-2 bg-sky-600 text-white font-semibold rounded-lg hover:bg-sky-500 transition-colors">保存提示词</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreatePromptModal;
