
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
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

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

    const handleDragStart = (index: number) => setDraggedIndex(index);
    const handleDragOver = (e: React.DragEvent, index: number) => e.preventDefault();
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
        onSave({
            title,
            description,
            example,
            template,
            category,
            subCategories: subCategories,
            fields,
            creator: 'user',
        }, promptToEdit?.id);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/70 dark:bg-black/90 flex items-center justify-center z-[100] p-4 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden animate-fade-in-up border border-white/20 font-sans" onClick={e => e.stopPropagation()}>
                <div className="px-8 py-3 bg-gradient-to-r from-blue-600/10 via-indigo-600/5 to-transparent border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
                    <div className="flex justify-between items-center">
                        <div>
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <div className="p-1.5 bg-blue-600 rounded-lg shadow-md shadow-blue-600/20">
                                    <Sparkles className="w-4 h-4 text-white" />
                                </div>
                                {promptToEdit ? '编辑提示词' : '创建提示词'}
                            </h3>
                        </div>
                        <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"><X className="w-6 h-6"/></button>
                    </div>
                </div>
                
                <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 font-sans">
                    <div className="flex-1 overflow-y-auto px-10 py-6 space-y-8 [scrollbar-gutter:stable]">
                        <div className="space-y-5 p-6 bg-blue-50/40 dark:bg-blue-900/10 rounded-2xl border border-blue-100/50 dark:border-blue-900/30">
                            <h4 className="flex items-center gap-2 text-base font-bold text-blue-600 dark:text-blue-400 tracking-wide">
                                <InformationCircle className="w-5 h-5" /> 基本信息
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-2">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 ml-1">提示词标题</label>
                                    <input 
                                        type="text" 
                                        value={title} 
                                        onChange={(e) => setTitle(e.target.value)} 
                                        placeholder="例如：赛博朋克城市描写" 
                                        className="w-full p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 ml-1">主要创作类目</label>
                                    <div className="relative group">
                                        <select 
                                            value={category} 
                                            onChange={(e) => setCategory(e.target.value as PromptCategory)} 
                                            className="w-full p-4 pr-10 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none appearance-none cursor-pointer transition-all shadow-sm"
                                        >
                                            {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                                        </select>
                                        <ChevronDown className="w-5 h-5 absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 group-hover:text-blue-500 pointer-events-none transition-colors" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-5 p-6 bg-purple-50/40 dark:bg-purple-900/10 rounded-2xl border border-purple-100/50 dark:border-purple-900/30">
                            <h4 className="flex items-center gap-2 text-base font-bold text-purple-600 dark:text-purple-400 tracking-wide">
                                <Tag className="w-5 h-5" /> 属性标签
                            </h4>
                            <div className="space-y-6">
                                <div>
                                    <span className="text-[10px] font-medium text-gray-400 mb-3 block uppercase tracking-widest">题材 / 类型</span>
                                    <div className="flex flex-wrap gap-2 overflow-x-auto">
                                        {GENRE_TAGS.map(tag => (
                                            <button key={tag.id} type="button" onClick={() => toggleSubCategory(tag.id)} className={`px-3 py-1.5 text-xs rounded-full border transition-all whitespace-nowrap ${subCategories.includes(tag.id) ? 'bg-purple-600 border-purple-600 text-white shadow-md' : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-purple-400 hover:text-purple-600'}`}>{tag.label}</button>
                                        ))}
                                    </div>
                                </div>
                                <div className="pt-5 border-t border-purple-200/30 dark:border-purple-800/30">
                                    <span className="text-[10px] font-medium text-gray-400 mb-3 block uppercase tracking-widest">功能 / 用途</span>
                                    <div className="flex flex-wrap gap-2">
                                        {FUNCTION_TAGS.map(tag => (
                                            <button key={tag.id} type="button" onClick={() => toggleSubCategory(tag.id)} className={`px-3 py-1.5 text-xs rounded-full border transition-all whitespace-nowrap ${subCategories.includes(tag.id) ? 'bg-blue-600 border-blue-600 text-white shadow-md' : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-blue-400 hover:text-blue-600'}`}>{tag.label}</button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-5 p-6 bg-orange-50/40 dark:bg-orange-900/10 rounded-2xl border border-orange-100/50 dark:border-orange-900/30">
                            <h4 className="flex items-center gap-2 text-base font-bold text-orange-600 dark:text-orange-400 tracking-wide">
                                <Bolt className="w-5 h-5" /> 详情与范例
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-2">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 ml-1">简介说明</label>
                                    <textarea 
                                        value={description} 
                                        onChange={(e) => setDescription(e.target.value)} 
                                        placeholder="描述这个提示词的用途及适用场景。" 
                                        className="w-full min-h-[160px] p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 outline-none transition-all resize-y shadow-sm"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 ml-1 flex items-center gap-1.5">效果预览 (范例)</label>
                                    <textarea 
                                        value={example} 
                                        onChange={(e) => setExample(e.target.value)} 
                                        placeholder="输入一段 AI 生成的参考效果，帮助其他用户快速理解。" 
                                        className="w-full min-h-[160px] p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 outline-none transition-all resize-y shadow-sm font-serif"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-5 p-6 bg-indigo-50/40 dark:bg-indigo-900/10 rounded-2xl border border-indigo-100/50 dark:border-indigo-900/30">
                            <h4 className="flex items-center gap-2 text-base font-bold text-indigo-600 dark:text-indigo-400 tracking-wide">
                                <DocumentText className="w-5 h-5" /> AI 提示词模板 (核心)
                            </h4>
                            <div className="space-y-2">
                                <textarea 
                                    value={template} 
                                    onChange={(e) => setTemplate(e.target.value)} 
                                    placeholder="输入完整的提示词指令。使用 ${变量名} 引用下方定义的字段。例如：请根据风格 ${style} 描写一段..." 
                                    className="w-full min-h-[200px] p-5 bg-white text-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl focus:ring-4 focus:ring-indigo-500/20 outline-none transition-all resize-y font-mono text-sm shadow-md"
                                />
                            </div>
                        </div>

                        <div className="space-y-6 p-8 bg-gray-50 dark:bg-gray-800/50 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-3xl">
                            <div className="flex justify-between items-center">
                                <div>
                                    <h4 className="text-lg font-bold text-gray-700 dark:text-gray-300">自定义动态表单</h4>
                                    <p className="text-xs text-gray-500 mt-1.5">表单将自动转化为输入框供使用者填写。</p>
                                </div>
                                <button type="button" onClick={addField} className="px-6 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-500 shadow-xl shadow-blue-500/20 transition-all active:scale-95">添加表单</button>
                            </div>
                            
                            {fields.length === 0 ? (
                                <div className="text-center py-10 text-gray-400 text-sm italic">点击上方按钮，添加自定义填写表单</div>
                            ) : (
                                <div className="space-y-5">
                                    {fields.map((field, index) => (
                                        <div key={field.id} className="p-6 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 relative shadow-md hover:shadow-xl transition-all" draggable onDragStart={() => handleDragStart(index)} onDragOver={(e) => handleDragOver(e, index)} onDrop={() => handleDrop(index)}>
                                            <div className="absolute top-1/2 -translate-y-1/2 -left-4 flex items-center p-2 cursor-grab text-gray-300 hover:text-blue-500 transition-colors"><Bars2 className="w-5 h-5" /></div>
                                            
                                            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 mb-4">
                                                <div className="md:col-span-4">
                                                    <label className="text-[10px] font-medium text-gray-400 mb-2 block uppercase tracking-widest">表单昵称</label>
                                                    <input type="text" value={field.label} onChange={(e) => updateField(index, 'label', e.target.value)} placeholder="如：故事风格" className="w-full p-3 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-1 focus:ring-blue-500 outline-none transition-all" />
                                                </div>
                                                <div className="md:col-span-4">
                                                    <label className="text-[10px] font-medium text-gray-400 mb-2 block uppercase tracking-widest">变量名 (需与模板一致)</label>
                                                    <input type="text" value={field.id} onChange={(e) => updateField(index, 'id', e.target.value)} placeholder="如：style" className="w-full p-3 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-1 focus:ring-blue-500 outline-none font-mono transition-all" />
                                                </div>
                                                <div className="md:col-span-3">
                                                    <label className="text-[10px] font-medium text-gray-400 mb-2 block uppercase tracking-widest">属性 / 类型</label>
                                                    <div className="flex gap-2">
                                                        <select value={field.required ? 'true' : 'false'} onChange={(e) => updateField(index, 'required', e.target.value === 'true')} className="w-1/2 p-3 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none transition-all cursor-pointer">
                                                            <option value="true">必填</option>
                                                            <option value="false">非必填</option>
                                                        </select>
                                                        <select value={field.type} onChange={(e) => updateField(index, 'type', e.target.value)} className="w-1/2 p-3 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none transition-all cursor-pointer">
                                                            <option value="text">单行</option>
                                                            <option value="textarea">多行</option>
                                                        </select>
                                                    </div>
                                                </div>
                                                <div className="md:col-span-1 flex justify-center items-center">
                                                    <button type="button" onClick={() => removeField(index)} className="p-3 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"><Trash className="w-5 h-5" /></button>
                                                </div>
                                            </div>

                                            <div className="pt-4 border-t border-gray-100 dark:border-gray-800">
                                                <label className="text-[10px] font-medium text-gray-400 mb-2 block uppercase tracking-widest">表单填写说明 (另起一行显示，引导用户填写内容)</label>
                                                <input type="text" value={field.description || ''} onChange={(e) => updateField(index, 'description', e.target.value)} placeholder="例如：请输入您期望的故事文风，如：冷冽、华丽、或者模仿某作者风格" className="w-full p-3 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-1 focus:ring-blue-500 outline-none transition-all" />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="px-10 py-6 border-t border-gray-100 dark:border-gray-800 flex flex-col md:flex-row justify-between items-center gap-6 flex-shrink-0">
                        <div className="flex-1">
                            {error && <p className="text-red-500 text-sm font-bold animate-pulse flex items-center gap-2"><X className="w-5 h-5"/> {error}</p>}
                        </div>
                        <div className="flex gap-4">
                            <button type="button" onClick={onClose} className="px-8 py-3 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 font-bold text-sm rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">取消</button>
                            <button type="submit" className="px-12 py-3 bg-blue-600 text-white font-bold text-sm rounded-xl hover:bg-blue-500 shadow-xl shadow-blue-500/20 transition-all active:scale-95 tracking-widest">{promptToEdit ? '保存修改' : '立即发布'}</button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreatePromptModal;
