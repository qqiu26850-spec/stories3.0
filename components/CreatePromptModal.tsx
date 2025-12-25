
import React, { useState, useEffect } from 'react';
import { Prompt, PromptCategory, PromptField, PromptSubCategory } from '../types';
import { Trash, Sparkles, Check, Bars2, DocumentText, ChevronDown, ChevronUp, X, InformationCircle, Tag, Bolt, Plus } from './Icon';

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

const CreatePromptModal: React.FC<CreatePromptModalProps> = ({ isOpen, onClose, onSave, promptToEdit }) => {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [example, setExample] = useState('');
    const [template, setTemplate] = useState('');
    const [category, setCategory] = useState<PromptCategory>('short-story');
    const [subCategories, setSubCategories] = useState<PromptSubCategory[]>([]);
    const [fields, setFields] = useState<PromptField[]>([]);
    const [error, setError] = useState('');
    const [fieldIndexToDelete, setFieldIndexToDelete] = useState<number | null>(null);

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
                setSubCategories(['general']);
                setFields([]);
            }
            setError('');
            setFieldIndexToDelete(null);
        }
    }, [isOpen, promptToEdit]);

    const addField = () => {
        const newId = `field_${Date.now()}`;
        setFields(prev => [...prev, { 
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
        setFields(prev => {
            const next = [...prev];
            const fieldToUpdate = { ...next[index] };
            // @ts-ignore
            fieldToUpdate[key] = value;
            if (key === 'label' && !fieldToUpdate.placeholder) {
                fieldToUpdate.placeholder = `请输入${value}...`;
            }
            next[index] = fieldToUpdate;
            return next;
        });
    };

    const moveField = (index: number, direction: 'up' | 'down') => {
        setFields(prev => {
            const next = [...prev];
            const targetIndex = direction === 'up' ? index - 1 : index + 1;
            if (targetIndex < 0 || targetIndex >= next.length) return prev;
            [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
            return next;
        });
    };
    
    const confirmDeleteField = () => {
        if (fieldIndexToDelete !== null) {
            setFields(prev => prev.filter((_, i) => i !== fieldIndexToDelete));
            setFieldIndexToDelete(null);
        }
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
        
        if (!title.trim()) { setError('请填写标题'); return; }
        if (!description.trim()) { setError('请填写简介'); return; }
        if (!template.trim()) { setError('请填写模板'); return; }
        if (subCategories.length === 0) { setError('请至少选择一个题材'); return; }

        onSave({
            title, description, example, template, category, subCategories: subCategories, fields, creator: 'user',
        }, promptToEdit?.id);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100] p-4 backdrop-blur-sm" onClick={onClose}>
            {fieldIndexToDelete !== null && (
                <div className="fixed inset-0 flex items-center justify-center z-[110] bg-black/40 backdrop-blur-[2px]" onClick={() => setFieldIndexToDelete(null)}>
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-2xl max-w-xs w-full text-center animate-fade-in-up" onClick={e => e.stopPropagation()}>
                        <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600">
                            <Trash className="w-6 h-6" />
                        </div>
                        <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-2">确定删除该字段？</h4>
                        <div className="flex gap-3 mt-6">
                            <button onClick={() => setFieldIndexToDelete(null)} className="flex-1 py-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-bold rounded-lg hover:bg-gray-200 transition-colors">取消</button>
                            <button onClick={confirmDeleteField} className="flex-1 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-500 transition-colors">确认删除</button>
                        </div>
                    </div>
                </div>
            )}

            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden animate-fade-in-up font-sans" onClick={e => e.stopPropagation()}>
                <div className="px-8 py-4 bg-gradient-to-r from-sky-50 to-blue-50 dark:from-sky-900/20 dark:to-gray-900 border-b border-sky-100 dark:border-gray-800 flex-shrink-0">
                    <div className="flex justify-between items-center">
                        <h3 className="text-lg font-bold text-sky-900 dark:text-sky-100 flex items-center gap-2">
                            <Sparkles className="w-5 h-5 text-sky-500" />
                            {promptToEdit ? '编辑提示词' : '创建提示词模板'}
                        </h3>
                        <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-200/50 dark:hover:bg-white/10 rounded-full transition-all"><X className="w-5 h-5"/></button>
                    </div>
                </div>
                
                <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
                    <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6 [scrollbar-gutter:stable]">
                        <div className="p-6 bg-blue-50/40 dark:bg-blue-900/10 rounded-xl space-y-4 border border-blue-100 dark:border-blue-900/30">
                            <h4 className="text-sm font-bold text-blue-600 flex items-center gap-2"><InformationCircle className="w-4 h-4"/>基本信息</h4>
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-gray-500">提示词标题</label>
                                    <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="例如：赛博朋克城市描写" className="w-full p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 outline-none transition-all" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-gray-500">主分类</label>
                                    <select value={category} onChange={e => setCategory(e.target.value as PromptCategory)} className="w-full p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-sky-500">
                                        {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 bg-purple-50/40 dark:bg-purple-900/10 rounded-xl space-y-4 border border-purple-100 dark:border-purple-900/30">
                            <h4 className="text-sm font-bold text-purple-600 flex items-center gap-2"><Tag className="w-4 h-4"/>题材属性</h4>
                            <div className="flex flex-wrap gap-2">
                                {GENRE_TAGS.map(tag => (
                                    <button key={tag.id} type="button" onClick={() => toggleSubCategory(tag.id)} className={`px-4 py-1.5 text-xs rounded-full border transition-all ${subCategories.includes(tag.id) ? 'bg-purple-600 text-white border-purple-600 shadow-md' : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-500 hover:border-purple-300'}`}>{tag.label}</button>
                                ))}
                            </div>
                        </div>

                        <div className="p-6 bg-gray-50/50 dark:bg-gray-800/40 rounded-xl space-y-4 border border-gray-200 dark:border-gray-800">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-1.5">
                                    <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300">功能简介</h4>
                                    <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="简单描述这个提示词的用途..." className="w-full h-32 p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm resize-none focus:ring-2 focus:ring-sky-500 outline-none" />
                                </div>
                                <div className="space-y-1.5">
                                    <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300">效果预览 (选填)</h4>
                                    <textarea value={example} onChange={e => setExample(e.target.value)} placeholder="展示 AI 生成的结果范例..." className="w-full h-32 p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm resize-none focus:ring-2 focus:ring-sky-500 outline-none" />
                                </div>
                            </div>
                        </div>

                        <div className="p-6 bg-indigo-50/40 dark:bg-indigo-900/10 rounded-xl space-y-4 border border-indigo-100 dark:border-indigo-900/30">
                            <h4 className="text-sm font-bold text-indigo-600 flex items-center gap-2"><DocumentText className="w-4 h-4"/>AI 提示词模板</h4>
                            <textarea value={template} onChange={e => setTemplate(e.target.value)} placeholder="使用 ${变量名} 引用下方定义的字段..." className="w-full h-48 p-4 bg-white text-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl font-mono text-sm focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm resize-y" />
                        </div>

                        <div className="p-6 bg-white dark:bg-gray-800/40 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 space-y-4">
                            <div className="flex justify-between items-center">
                                <h4 className="text-sm font-bold text-gray-600 dark:text-gray-300 flex items-center gap-2"><Bolt className="w-4 h-4"/>动态表单字段</h4>
                                <button type="button" onClick={addField} className="px-4 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-500 shadow-md flex items-center gap-1"><Plus className="w-3 h-3"/> 添加字段</button>
                            </div>
                            <div className="space-y-4">
                                {fields.length === 0 ? (
                                    <div className="text-center py-8 text-gray-400 text-xs italic">请点击上方按钮添加字段，用于接收用户输入</div>
                                ) : (
                                    fields.map((field, index) => (
                                        <div key={field.id} className="p-5 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 space-y-4 shadow-sm group relative hover:border-sky-300 transition-colors">
                                            
                                            {/* Controls */}
                                            <div className="absolute right-3 top-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white dark:bg-gray-900 p-1 rounded-lg border border-gray-100 dark:border-gray-700 shadow-sm z-10">
                                                <button type="button" onClick={() => moveField(index, 'up')} disabled={index === 0} className="p-1.5 text-gray-400 hover:text-sky-500 disabled:opacity-30 transition-colors" title="上移"><ChevronUp className="w-4 h-4"/></button>
                                                <button type="button" onClick={() => moveField(index, 'down')} disabled={index === fields.length - 1} className="p-1.5 text-gray-400 hover:text-sky-500 disabled:opacity-30 transition-colors" title="下移"><ChevronDown className="w-4 h-4"/></button>
                                                <div className="w-px h-4 bg-gray-200 dark:bg-gray-700 mx-1 self-center"></div>
                                                <button type="button" onClick={() => setFieldIndexToDelete(index)} className="p-1.5 text-gray-400 hover:text-red-500 transition-colors" title="删除"><Trash className="w-4 h-4"/></button>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pr-10">
                                                <div className="space-y-1.5">
                                                    <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">显示名称 (Label)</label>
                                                    <input type="text" value={field.label} onChange={e => updateField(index, 'label', e.target.value)} className="w-full p-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 outline-none transition-all" placeholder="如：主角姓名" />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">变量名 (ID)</label>
                                                    <input type="text" value={field.id} onChange={e => updateField(index, 'id', e.target.value)} className="w-full p-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-mono text-sky-600 dark:text-sky-400 focus:ring-2 focus:ring-sky-500 outline-none transition-all" placeholder="name" />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">是否必填</label>
                                                    <div className="flex items-center h-[42px] gap-4 px-1">
                                                        <label className="flex items-center gap-2 cursor-pointer group/radio">
                                                            <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${field.required !== false ? 'border-sky-500 bg-sky-500' : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 group-hover/radio:border-sky-400'}`}>
                                                                {field.required !== false && <div className="w-1.5 h-1.5 bg-white rounded-full"></div>}
                                                            </div>
                                                            <input type="radio" checked={field.required !== false} onChange={() => updateField(index, 'required', true)} className="hidden" />
                                                            <span className={`text-sm font-medium ${field.required !== false ? 'text-sky-600 dark:text-sky-400' : 'text-gray-600 dark:text-gray-400'}`}>必填</span>
                                                        </label>
                                                        <label className="flex items-center gap-2 cursor-pointer group/radio">
                                                            <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${field.required === false ? 'border-sky-500 bg-sky-500' : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 group-hover/radio:border-sky-400'}`}>
                                                                {field.required === false && <div className="w-1.5 h-1.5 bg-white rounded-full"></div>}
                                                            </div>
                                                            <input type="radio" checked={field.required === false} onChange={() => updateField(index, 'required', false)} className="hidden" />
                                                            <span className={`text-sm font-medium ${field.required === false ? 'text-sky-600 dark:text-sky-400' : 'text-gray-600 dark:text-gray-400'}`}>选填</span>
                                                        </label>
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">补充说明 (输入提示)</label>
                                                <input type="text" value={field.description || ''} onChange={e => updateField(index, 'description', e.target.value)} className="w-full p-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 outline-none transition-all" placeholder="例如：请填写用户的具体要求，越详细越好..." />
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="px-8 py-5 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-3 flex-shrink-0 bg-gray-50 dark:bg-gray-900/50">
                        {error && <p className="text-red-500 text-sm flex-1 font-bold flex items-center">⚠️ {error}</p>}
                        <button type="button" onClick={onClose} className="px-6 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-500 rounded-lg text-sm font-bold hover:bg-gray-50 transition-colors">取消</button>
                        <button type="submit" className="px-10 py-2 bg-sky-600 text-white font-bold rounded-lg text-sm shadow-lg shadow-sky-500/20 hover:bg-sky-500 transition-all active:scale-95">发布到库</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreatePromptModal;
