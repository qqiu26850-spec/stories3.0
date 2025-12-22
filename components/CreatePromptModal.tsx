
import React, { useState, useEffect } from 'react';
import { Prompt, PromptCategory, PromptField, PromptSubCategory } from '../types';
import { Trash, Sparkles, Check, Bars2, DocumentText, ChevronDown, ChevronUp, X, InformationCircle, Tag, Bolt } from './Icon';

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
    { id: 'expand', label: '扩写' },
    { id: 'proofread', label: '审稿' },
];

const CreatePromptModal: React.FC<CreatePromptModalProps> = ({ isOpen, onClose, onSave, promptToEdit }) => {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [example, setExample] = useState('');
    const [template, setTemplate] = useState('');
    const [category, setCategory] = useState<PromptCategory>('short-story');
    const [subCategories, setSubCategories] = useState<PromptSubCategory[]>([]);
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
                setSubCategories(promptToEdit.subCategories && promptToEdit.subCategories.length > 0 ? promptToEdit.subCategories : []);
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

    const moveField = (index: number, direction: 'up' | 'down') => {
        if (direction === 'up' && index > 0) {
            const newFields = [...fields];
            const temp = newFields[index];
            newFields[index] = newFields[index - 1];
            newFields[index - 1] = temp;
            setFields(newFields);
        } else if (direction === 'down' && index < fields.length - 1) {
            const newFields = [...fields];
            const temp = newFields[index];
            newFields[index] = newFields[index + 1];
            newFields[index + 1] = temp;
            setFields(newFields);
        }
    };
    
    const removeField = (index: number) => {
        setFields(fields.filter((_, i) => i !== index));
    };

    const toggleSubCategory = (tag: PromptSubCategory) => {
        setSubCategories(prev => {
            if (prev.includes(tag)) {
                return prev.filter(t => t !== tag);
            } else {
                if (prev.length >= 5) return prev;
                return [...prev, tag];
            }
        });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        // 必填项中文校验
        if (!title.trim()) { alert('发布失败：请填写“提示词标题”'); return; }
        if (!description.trim()) { alert('发布失败：请填写“提示词简介”'); return; }
        if (!template.trim()) { alert('发布失败：请填写“AI 提示词模板”内容'); return; }
        if (subCategories.length === 0) { alert('发布失败：请至少选择一个“属性标签”'); return; }
        if (fields.length > 0) {
            const invalidField = fields.find(f => !f.label.trim() || !f.id.trim());
            if (invalidField) { alert('发布失败：请完整填写所有自定义表单的“显示名称”和“变量名”'); return; }
        } else {
            if (template.includes('${') && fields.length === 0) {
                alert('发布失败：您的模板中包含变量，请添加对应的“自定义填写表单”');
                return;
            }
        }

        onSave({
            title, description, example, template, category, subCategories: subCategories, fields, creator: 'user',
        }, promptToEdit?.id);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100] p-4 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden animate-fade-in-up font-sans" onClick={e => e.stopPropagation()}>
                <div className="px-8 py-2.5 bg-gradient-to-r from-sky-50 to-blue-50 dark:from-sky-900/20 dark:to-gray-900 border-b border-sky-100 dark:border-gray-800 flex-shrink-0">
                    <div className="flex justify-between items-center">
                        <h3 className="text-base font-bold text-sky-900 dark:text-sky-100 flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-sky-500" />
                            {promptToEdit ? '编辑提示词' : '创建提示词模板'}
                        </h3>
                        <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-200/50 dark:hover:bg-white/10 rounded-full transition-all"><X className="w-5 h-5"/></button>
                    </div>
                </div>
                
                <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
                    <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6 [scrollbar-gutter:stable]">
                        <div className="p-6 bg-blue-50/40 dark:bg-blue-900/10 rounded-xl space-y-4">
                            <h4 className="text-sm font-bold text-blue-600 flex items-center gap-2"><InformationCircle className="w-4 h-4"/>基本信息 <span className="text-[10px] font-normal text-gray-400">(必填)</span></h4>
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-gray-500">提示词标题</label>
                                    <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="例如：赛博朋克城市描写" className="w-full p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 outline-none transition-all" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-gray-500">主要创作类目</label>
                                    <select value={category} onChange={e => setCategory(e.target.value as PromptCategory)} className="w-full p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm appearance-none outline-none focus:ring-2 focus:ring-sky-500">
                                        {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 bg-purple-50/40 dark:bg-purple-900/10 rounded-xl space-y-4">
                            <h4 className="text-sm font-bold text-purple-600 flex items-center gap-2"><Tag className="w-4 h-4"/>属性标签 <span className="text-[10px] font-normal text-gray-400">(必选)</span></h4>
                            <div className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <span className="text-[10px] text-gray-400 shrink-0">题材:</span>
                                    <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
                                        {GENRE_TAGS.map(tag => (
                                            <button key={tag.id} type="button" onClick={() => toggleSubCategory(tag.id)} className={`px-3 py-1 text-xs rounded-full border whitespace-nowrap transition-all ${subCategories.includes(tag.id) ? 'bg-purple-600 text-white' : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-500 font-normal hover:border-purple-300'}`}>{tag.label}</button>
                                        ))}
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 border-t border-purple-100 dark:border-purple-800 pt-3">
                                    <span className="text-[10px] text-gray-400 shrink-0">功能:</span>
                                    <div className="flex flex-wrap gap-2">
                                        {FUNCTION_TAGS.map(tag => (
                                            <button key={tag.id} type="button" onClick={() => toggleSubCategory(tag.id)} className={`px-3 py-1 text-xs rounded-full border whitespace-nowrap transition-all ${subCategories.includes(tag.id) ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-500 font-normal hover:border-blue-300'}`}>{tag.label}</button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 bg-orange-50/40 dark:bg-orange-900/10 rounded-xl space-y-4">
                            <h4 className="text-sm font-bold text-orange-600 flex items-center gap-2"><Bolt className="w-4 h-4"/>详情与范例</h4>
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-gray-500">简介 <span className="text-red-500">*</span></label>
                                    <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="简单描述这个提示词的用途..." className="w-full h-32 p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm resize-none focus:ring-2 focus:ring-orange-500 outline-none" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-gray-500">预览效果 <span className="text-gray-400 text-[10px]">(选填)</span></label>
                                    <textarea value={example} onChange={e => setExample(e.target.value)} placeholder="展示 AI 生成的结果范例，帮助其他用户参考..." className="w-full h-32 p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm resize-none focus:ring-2 focus:ring-orange-500 outline-none" />
                                </div>
                            </div>
                        </div>

                        <div className="p-6 bg-indigo-50/40 dark:bg-indigo-900/10 rounded-xl space-y-4">
                            <h4 className="text-sm font-bold text-indigo-600 flex items-center gap-2"><DocumentText className="w-4 h-4"/>AI 提示词模板 <span className="text-[10px] font-normal text-gray-400">(必填)</span></h4>
                            <textarea value={template} onChange={e => setTemplate(e.target.value)} placeholder="使用 ${变量名} 引用下方定义的字段，例如：写一个关于 ${name} 的故事..." className="w-full h-40 p-4 bg-white text-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl font-mono text-sm focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm" />
                        </div>

                        <div className="p-6 bg-gray-50 dark:bg-gray-800/40 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 space-y-4">
                            <div className="flex justify-between items-center">
                                <h4 className="text-sm font-bold text-gray-600 dark:text-gray-300 flex items-center gap-2">自定义填写表单 <span className="text-[10px] font-normal text-gray-400">(变量定义)</span></h4>
                                <button type="button" onClick={addField} className="px-4 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-500 transition-all shadow-md">添加字段</button>
                            </div>
                            <div className="space-y-4">
                                {fields.map((field, index) => (
                                    <div key={field.id} className="p-4 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 space-y-3 shadow-sm relative group">
                                        <div className="grid grid-cols-12 gap-4">
                                            <div className="col-span-3">
                                                <label className="text-[10px] text-gray-400 block mb-1">显示名称 (Label)</label>
                                                <input type="text" value={field.label} onChange={e => updateField(index, 'label', e.target.value)} placeholder="如：主角姓名" className="w-full p-2 bg-gray-50 dark:bg-gray-800 border rounded text-xs focus:ring-1 focus:ring-sky-500 outline-none" />
                                            </div>
                                            <div className="col-span-3">
                                                <label className="text-[10px] text-gray-400 block mb-1">变量名 (ID)</label>
                                                <input type="text" value={field.id} onChange={e => updateField(index, 'id', e.target.value)} placeholder="如：name" className="w-full p-2 bg-gray-50 dark:bg-gray-800 border rounded font-mono text-xs focus:ring-1 focus:ring-sky-500 outline-none" />
                                            </div>
                                            <div className="col-span-2">
                                                <label className="text-[10px] text-gray-400 block mb-1">是否必填</label>
                                                <select value={field.required ? 'true' : 'false'} onChange={e => updateField(index, 'required', e.target.value === 'true')} className="w-full p-2 bg-gray-50 dark:bg-gray-800 border rounded text-[10px] outline-none">
                                                    <option value="true">必填</option>
                                                    <option value="false">选填</option>
                                                </select>
                                            </div>
                                            <div className="col-span-2">
                                                <label className="text-[10px] text-gray-400 block mb-1">字数上限</label>
                                                <input type="number" value={field.maxLength || ''} onChange={e => updateField(index, 'maxLength', e.target.value ? parseInt(e.target.value) : undefined)} placeholder="无限制" className="w-full p-2 bg-gray-50 dark:bg-gray-800 border rounded text-xs outline-none" />
                                            </div>
                                            <div className="col-span-1 flex items-end pb-1 gap-1">
                                                <button type="button" onClick={() => moveField(index, 'up')} disabled={index === 0} className={`p-1.5 border rounded text-gray-400 hover:text-sky-500 disabled:opacity-20 transition-colors`} title="上移"><ChevronUp className="w-3.5 h-3.5"/></button>
                                                <button type="button" onClick={() => moveField(index, 'down')} disabled={index === fields.length - 1} className={`p-1.5 border rounded text-gray-400 hover:text-sky-500 disabled:opacity-20 transition-colors`} title="下移"><ChevronDown className="w-3.5 h-3.5"/></button>
                                            </div>
                                            <div className="col-span-1 flex items-end pb-1 justify-end">
                                                <button type="button" onClick={() => removeField(index)} className="p-1.5 text-gray-300 hover:text-red-500 transition-colors" title="删除字段"><Trash className="w-4 h-4"/></button>
                                            </div>
                                        </div>
                                        <div className="pt-2 border-t border-gray-100 dark:border-gray-800 flex gap-4">
                                            <div className="flex-1">
                                                <label className="text-[10px] text-gray-400 block mb-1">表单引导语 (Description)</label>
                                                <input type="text" value={field.description || ''} onChange={e => updateField(index, 'description', e.target.value)} placeholder="提示用户该填什么内容..." className="w-full p-2 bg-gray-50 dark:bg-gray-800 border rounded text-xs outline-none focus:ring-1 focus:ring-sky-500" />
                                            </div>
                                            <div className="w-24">
                                                <label className="text-[10px] text-gray-400 block mb-1">表单样式</label>
                                                <select value={field.type} onChange={e => updateField(index, 'type', e.target.value)} className="w-full p-2 bg-gray-50 dark:bg-gray-800 border rounded text-[10px] outline-none">
                                                    <option value="text">单行输入</option>
                                                    <option value="textarea">多行文本</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {fields.length === 0 && <div className="text-center py-10 text-gray-400 text-xs italic bg-white dark:bg-gray-900/50 rounded-lg border border-dashed">尚未添加自定义字段，点击右上方按钮开始定义表单。</div>}
                            </div>
                        </div>
                    </div>

                    <div className="px-8 py-5 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-3 flex-shrink-0 bg-gray-50/50 dark:bg-gray-900/50">
                        <button type="button" onClick={onClose} className="px-6 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-500 rounded-lg text-sm font-bold hover:bg-gray-50 transition-colors">取消</button>
                        <button type="submit" className="px-10 py-2 bg-sky-600 text-white font-bold rounded-lg text-sm shadow-lg shadow-sky-600/20 hover:bg-sky-500 transition-all active:scale-95">确认并发布</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreatePromptModal;
