
import React, { useState, useEffect } from 'react';
import { Prompt, PromptCategory, PromptField, PromptSubCategory } from '../types';
import { Trash, Sparkles, Check, Bars2, DocumentText, ChevronDown, X, InformationCircle, Tag, Bolt } from './Icon';

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
    { id: 'general', label: '全类型' },
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
    const [example, setExample] = useState('');
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
                setExample(promptToEdit.example || '');
                setTemplate(promptToEdit.template || promptToEdit.content);
                setCategory(promptToEdit.category);
                setSubCategories(promptToEdit.subCategories && promptToEdit.subCategories.length > 0 ? promptToEdit.subCategories : ['idea']);
                setFields(promptToEdit.fields || []);
            } else {
                setTitle('');
                setDescription('');
                setExample('');
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
        setFields([...fields, { 
            id: newId, 
            label: '', 
            type: 'text', 
            placeholder: '',
            required: true,
            description: '',
            maxLength: undefined
        }]);
    };

    const updateField = (index: number, key: keyof PromptField, value: any) => {
        const newFields = [...fields];
        const fieldToUpdate = { ...newFields[index] };
        // @ts-ignore
        fieldToUpdate[key] = value;
        if (key === 'label') {
            fieldToUpdate.placeholder = `请输入${value}...`;
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

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim()) { setError('标题不能为空。'); return; }
        if (!description.trim()) { setError('简介不能为空。'); return; }
        if (!template.trim()) { setError('提示词模板不能为空。'); return; }
        onSave({
            title, description, example, template, category, subCategories: subCategories, fields, creator: 'user',
        }, promptToEdit?.id);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100] p-4 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden animate-fade-in-up font-sans" onClick={e => e.stopPropagation()}>
                <div className="px-8 py-4 bg-gradient-to-r from-sky-600 to-blue-600 border-b border-sky-700/30 flex-shrink-0">
                    <div className="flex justify-between items-center">
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                            <Sparkles className="w-5 h-5 text-sky-200" />
                            {promptToEdit ? '编辑提示词' : '创建提示词模板'}
                        </h3>
                        <button onClick={onClose} className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors"><X className="w-6 h-6"/></button>
                    </div>
                </div>
                
                <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
                    <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6 [scrollbar-gutter:stable]">
                        {/* 模块1：基本信息 */}
                        <div className="p-6 bg-blue-50/40 dark:bg-blue-900/10 rounded-xl space-y-4">
                            <h4 className="text-sm font-bold text-blue-600 flex items-center gap-2"><InformationCircle className="w-4 h-4"/>基本信息</h4>
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-gray-500">提示词标题</label>
                                    <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="例如：赛博朋克城市描写" className="w-full p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-gray-500">主要创作类目</label>
                                    <select value={category} onChange={e => setCategory(e.target.value as PromptCategory)} className="w-full p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm appearance-none">
                                        {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* 模块2：标签 */}
                        <div className="p-6 bg-purple-50/40 dark:bg-purple-900/10 rounded-xl space-y-4">
                            <h4 className="text-sm font-bold text-purple-600 flex items-center gap-2"><Tag className="w-4 h-4"/>属性标签</h4>
                            <div className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <span className="text-[10px] text-gray-400 shrink-0">题材:</span>
                                    <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
                                        {GENRE_TAGS.map(tag => (
                                            <button key={tag.id} type="button" onClick={() => toggleSubCategory(tag.id)} className={`px-3 py-1 text-xs rounded-full border whitespace-nowrap transition-all ${subCategories.includes(tag.id) ? 'bg-purple-600 text-white' : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-500 font-normal'}`}>{tag.label}</button>
                                        ))}
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 border-t border-purple-100 dark:border-purple-800 pt-3">
                                    <span className="text-[10px] text-gray-400 shrink-0">功能:</span>
                                    <div className="flex flex-wrap gap-2">
                                        {FUNCTION_TAGS.map(tag => (
                                            <button key={tag.id} type="button" onClick={() => toggleSubCategory(tag.id)} className={`px-3 py-1 text-xs rounded-full border whitespace-nowrap transition-all ${subCategories.includes(tag.id) ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-500 font-normal'}`}>{tag.label}</button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 模块3：范例 */}
                        <div className="p-6 bg-orange-50/40 dark:bg-orange-900/10 rounded-xl space-y-4">
                            <h4 className="text-sm font-bold text-orange-600 flex items-center gap-2"><Bolt className="w-4 h-4"/>详情与范例</h4>
                            <div className="grid grid-cols-2 gap-6">
                                <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="提示词简介..." className="w-full h-32 p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm resize-none" />
                                <textarea value={example} onChange={e => setExample(e.target.value)} placeholder="效果预览范例..." className="w-full h-32 p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm resize-none" />
                            </div>
                        </div>

                        {/* 模块4：核心模板 */}
                        <div className="p-6 bg-indigo-50/40 dark:bg-indigo-900/10 rounded-xl space-y-4">
                            <h4 className="text-sm font-bold text-indigo-600 flex items-center gap-2"><DocumentText className="w-4 h-4"/>AI 提示词模板 (核心)</h4>
                            <textarea value={template} onChange={e => setTemplate(e.target.value)} placeholder="使用 ${变量名} 引用表单字段..." className="w-full h-40 p-4 bg-white text-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl font-mono text-sm focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm" />
                        </div>

                        {/* 模块5：表单定义 */}
                        <div className="p-6 bg-gray-50 dark:bg-gray-800/40 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 space-y-4">
                            <div className="flex justify-between items-center">
                                <h4 className="text-sm font-bold text-gray-600 dark:text-gray-300">自定义填写表单</h4>
                                <button type="button" onClick={addField} className="px-4 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-500">添加表单</button>
                            </div>
                            <div className="space-y-4">
                                {fields.map((field, index) => (
                                    <div key={field.id} className="p-4 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 space-y-3 shadow-sm relative">
                                        <div className="grid grid-cols-12 gap-4">
                                            <div className="col-span-3">
                                                <label className="text-[10px] text-gray-400 block mb-1">表单昵称</label>
                                                <input type="text" value={field.label} onChange={e => updateField(index, 'label', e.target.value)} className="w-full p-2 bg-gray-50 dark:bg-gray-800 border rounded text-xs" />
                                            </div>
                                            <div className="col-span-3">
                                                <label className="text-[10px] text-gray-400 block mb-1">变量名</label>
                                                <input type="text" value={field.id} onChange={e => updateField(index, 'id', e.target.value)} className="w-full p-2 bg-gray-50 dark:bg-gray-800 border rounded font-mono text-xs" />
                                            </div>
                                            <div className="col-span-2">
                                                <label className="text-[10px] text-gray-400 block mb-1">属性</label>
                                                <select value={field.required ? 'true' : 'false'} onChange={e => updateField(index, 'required', e.target.value === 'true')} className="w-full p-2 bg-gray-50 dark:bg-gray-800 border rounded text-[10px]">
                                                    <option value="true">必填</option>
                                                    <option value="false">非必填</option>
                                                </select>
                                            </div>
                                            <div className="col-span-2">
                                                <label className="text-[10px] text-gray-400 block mb-1">字数上限</label>
                                                <input type="number" value={field.maxLength || ''} onChange={e => updateField(index, 'maxLength', e.target.value ? parseInt(e.target.value) : undefined)} placeholder="选填" className="w-full p-2 bg-gray-50 dark:bg-gray-800 border rounded text-xs" />
                                            </div>
                                            <div className="col-span-1 flex items-end pb-1">
                                                <select value={field.type} onChange={e => updateField(index, 'type', e.target.value)} className="w-full p-2 bg-gray-50 dark:bg-gray-800 border rounded text-[10px]">
                                                    <option value="text">单行</option>
                                                    <option value="textarea">多行</option>
                                                </select>
                                            </div>
                                            <div className="col-span-1 flex items-end pb-1 justify-center">
                                                <button type="button" onClick={() => removeField(index)} className="text-gray-300 hover:text-red-500"><Trash className="w-4 h-4"/></button>
                                            </div>
                                        </div>
                                        <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
                                            <label className="text-[10px] text-gray-400 block mb-1">表单填写说明 (另起一行显示)</label>
                                            <input type="text" value={field.description || ''} onChange={e => updateField(index, 'description', e.target.value)} placeholder="引导用户填写..." className="w-full p-2 bg-gray-50 dark:bg-gray-800 border rounded text-xs" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="px-8 py-5 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-3 flex-shrink-0">
                        <button type="button" onClick={onClose} className="px-6 py-2 bg-gray-100 dark:bg-gray-800 text-gray-500 rounded-lg text-sm">取消</button>
                        <button type="submit" className="px-8 py-2 bg-blue-600 text-white font-bold rounded-lg text-sm shadow-lg shadow-blue-600/20">确认发布</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreatePromptModal;
