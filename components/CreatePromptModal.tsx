import React, { useState, useEffect } from 'react';
import { Prompt, PromptCategory, PromptField, PromptSubCategory } from '../types';
// Fix: Added missing 'X' icon to the imports from Icon component
import { Trash, Sparkles, Check, Bars2, DocumentText, ChevronDown, X } from './Icon';

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
    { id: 'general', label: '全类型' }, // Updated from 通用 to 全类型
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
        <div className="fixed inset-0 bg-black/70 dark:bg-black/90 flex items-center justify-center z-[100] p-4 backdrop-blur-md" onClick={onClose}>
            <div className="bg-white dark:bg-gray-900 rounded-[2rem] shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden animate-fade-in-up border border-white/20" onClick={e => e.stopPropagation()}>
                {/* Header with Gradient Background */}
                <div className="px-10 py-8 bg-gradient-to-r from-sky-600/10 via-purple-600/5 to-transparent border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
                    <div className="flex justify-between items-center">
                        <div>
                            <h3 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                                <div className="p-2 bg-sky-500 rounded-xl shadow-lg shadow-sky-500/20">
                                    <Sparkles className="w-6 h-6 text-white" />
                                </div>
                                {promptToEdit ? '编辑提示词' : '创建灵感提示词'}
                            </h3>
                            <p className="text-gray-500 dark:text-gray-400 mt-2 text-sm">构建属于你的 AI 创作模板，实现标准化的高质量输出。</p>
                        </div>
                    </div>
                </div>
                
                {/* Form area with custom scroll spacing to prevent border overlap */}
                <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
                    <div className="flex-1 overflow-y-auto px-10 py-8 space-y-10 [scrollbar-gutter:stable]">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-2">
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 ml-1">提示词标题</label>
                                <input 
                                    type="text" 
                                    value={title} 
                                    onChange={(e) => setTitle(e.target.value)} 
                                    placeholder="例如：赛博朋克城市描写" 
                                    className="w-full p-4 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-2xl text-gray-900 dark:text-white focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none transition-all shadow-sm"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 ml-1">主要创作类目</label>
                                <div className="relative group">
                                    <select 
                                        value={category} 
                                        onChange={(e) => setCategory(e.target.value as PromptCategory)} 
                                        className="w-full p-4 pr-10 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-2xl text-gray-900 dark:text-white focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none appearance-none cursor-pointer transition-all shadow-sm"
                                    >
                                        {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                                    </select>
                                    <ChevronDown className="w-4 h-4 absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 group-hover:text-sky-500 pointer-events-none transition-colors" />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 ml-1">属性标签 (最多选5个)</label>
                            <div className="p-6 bg-gray-50/50 dark:bg-gray-800/30 rounded-3xl border border-gray-100 dark:border-gray-800 space-y-4">
                                <div>
                                    <span className="text-[10px] font-black text-gray-400 mb-3 block uppercase tracking-[0.2em]">题材 / 类型</span>
                                    <div className="flex flex-wrap gap-2">
                                        {GENRE_TAGS.map(tag => (
                                            <button key={tag.id} type="button" onClick={() => toggleSubCategory(tag.id)} className={`px-4 py-2 text-xs font-bold rounded-full border transition-all ${subCategories.includes(tag.id) ? 'bg-purple-600 border-purple-600 text-white shadow-md shadow-purple-500/20' : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-purple-400 hover:text-purple-600'}`}>{tag.label}</button>
                                        ))}
                                    </div>
                                </div>
                                <div className="pt-2 border-t border-gray-200/50 dark:border-gray-700/50">
                                    <span className="text-[10px] font-black text-gray-400 mb-3 block uppercase tracking-[0.2em]">功能 / 用途</span>
                                    <div className="flex flex-wrap gap-2">
                                        {FUNCTION_TAGS.map(tag => (
                                            <button key={tag.id} type="button" onClick={() => toggleSubCategory(tag.id)} className={`px-4 py-2 text-xs font-bold rounded-full border transition-all ${subCategories.includes(tag.id) ? 'bg-sky-600 border-sky-600 text-white shadow-md shadow-sky-500/20' : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-sky-400 hover:text-sky-600'}`}>{tag.label}</button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-2">
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 ml-1">简介说明</label>
                                <textarea 
                                    value={description} 
                                    onChange={(e) => setDescription(e.target.value)} 
                                    placeholder="描述这个提示词的用途、核心特色及适用场景。" 
                                    className="w-full h-40 p-4 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-2xl text-gray-900 dark:text-white focus:ring-2 focus:ring-sky-500 outline-none transition-all resize-y text-sm shadow-sm"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 ml-1 flex items-center gap-1.5">
                                    <Sparkles className="w-4 h-4 text-orange-400" />
                                    效果预览 (AI 生成范例)
                                </label>
                                <textarea 
                                    value={example} 
                                    onChange={(e) => setExample(e.target.value)} 
                                    placeholder="输入一段 AI 生成的参考效果，帮助其他用户快速理解该提示词的威力。" 
                                    className="w-full h-40 p-4 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-2xl text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 outline-none transition-all resize-y text-sm font-serif shadow-sm"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 ml-1">AI 提示词模板 (核心)</label>
                            <textarea 
                                value={template} 
                                onChange={(e) => setTemplate(e.target.value)} 
                                placeholder="输入完整的提示词指令。使用 ${变量名} 引用下方定义的字段。例如：请根据风格 ${style} 描写一段..." 
                                className="w-full h-48 p-5 bg-gray-900 text-gray-100 border-none rounded-3xl focus:ring-4 focus:ring-sky-500/20 outline-none transition-all resize-y font-mono text-sm shadow-xl"
                            />
                        </div>

                        <div className="space-y-6 p-8 bg-sky-50/30 dark:bg-sky-900/5 border-2 border-dashed border-sky-200/50 dark:border-sky-800/5 rounded-[2.5rem]">
                            <div className="flex justify-between items-center">
                                <div>
                                    <h4 className="text-lg font-bold text-gray-900 dark:text-white">自定义动态字段</h4>
                                    <p className="text-xs text-gray-500 mt-1">字段将自动转化为输入表单供使用者填写。</p>
                                </div>
                                <button type="button" onClick={addField} className="px-5 py-2.5 bg-sky-600 text-white text-sm font-bold rounded-xl hover:bg-sky-500 shadow-lg shadow-sky-500/20 transition-all active:scale-95">+ 添加新字段</button>
                            </div>
                            
                            {fields.length === 0 ? (
                                <div className="text-center py-10 text-gray-400 text-sm italic">点击上方按钮，开启动态创作体验</div>
                            ) : (
                                <div className="space-y-4">
                                    {fields.map((field, index) => (
                                        <div key={field.id} className="p-6 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 grid grid-cols-1 md:grid-cols-12 gap-5 relative shadow-sm hover:shadow-md transition-shadow" draggable onDragStart={() => handleDragStart(index)} onDragOver={(e) => handleDragOver(e, index)} onDrop={() => handleDrop(index)}>
                                            <div className="absolute top-1/2 -translate-y-1/2 -left-3 flex items-center p-2 cursor-grab text-gray-300 hover:text-sky-500"><Bars2 className="w-4 h-4" /></div>
                                            <div className="md:col-span-5"><label className="text-[10px] font-bold text-gray-400 mb-1 block">字段显示名称</label><input type="text" value={field.label} onChange={(e) => updateField(index, 'label', e.target.value)} placeholder="例如：人物性格" className="w-full p-2.5 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-sky-500 outline-none" /></div>
                                            <div className="md:col-span-4"><label className="text-[10px] font-bold text-gray-400 mb-1 block">引用变量名 (英文)</label><input type="text" value={field.id} onChange={(e) => updateField(index, 'id', e.target.value)} placeholder="例如：character_personality" className="w-full p-2.5 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-sky-500 outline-none font-mono" /></div>
                                            <div className="md:col-span-2"><label className="text-[10px] font-bold text-gray-400 mb-1 block">表单类型</label><select value={field.type} onChange={(e) => updateField(index, 'type', e.target.value)} className="w-full p-2.5 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-sky-500 outline-none appearance-none"><option value="text">单行文本</option><option value="textarea">多行文本</option></select></div>
                                            <div className="md:col-span-1 flex justify-center items-center pt-5"><button type="button" onClick={() => removeField(index)} className="p-3 text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all"><Trash className="w-5 h-5" /></button></div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="px-10 py-6 border-t border-gray-100 dark:border-gray-800 flex flex-col md:flex-row justify-between items-center gap-4 flex-shrink-0">
                        <div className="flex-1">
                            {error && <p className="text-red-500 text-sm font-bold animate-pulse flex items-center gap-1.5"><X className="w-4 h-4"/> {error}</p>}
                        </div>
                        <div className="flex gap-4">
                            <button type="button" onClick={onClose} className="px-8 py-3 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-bold rounded-2xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">取消</button>
                            <button type="submit" className="px-10 py-3 bg-sky-600 text-white font-bold rounded-2xl hover:bg-sky-500 shadow-xl shadow-sky-500/30 transition-all active:scale-95">{promptToEdit ? '保存所有修改' : '立即发布提示词'}</button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreatePromptModal;