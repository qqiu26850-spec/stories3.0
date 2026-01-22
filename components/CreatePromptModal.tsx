
import React, { useState, useEffect, useRef } from 'react';
import { Prompt, PromptCategory, PromptField, PromptSubCategory } from '../types';
import { Trash, Sparkles, Check, ChevronDown, ChevronUp, X, InformationCircle, Tag, Bolt, Plus, BookOpen, DocumentText, ArrowPath, Stop } from './Icon';
import { FUNCTIONAL_TAGS, GENRE_TAGS } from '../constants';
import { generateTextStream } from '../services/geminiService';
import MarkdownToolbar, { handleListKeyDown } from './MarkdownToolbar';

type NewPromptData = Omit<Prompt, 'id' | 'heat' | 'content'>;

// Extended type for internal state use only, adding a stable key for React rendering
type EditablePromptField = PromptField & { _key: string };

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

const generateKey = () => `k_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

const CreatePromptModal: React.FC<CreatePromptModalProps> = ({ isOpen, onClose, onSave, promptToEdit }) => {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [example, setExample] = useState('');
    const [template, setTemplate] = useState('');
    const [category, setCategory] = useState<PromptCategory>('short-story');
    const [subCategories, setSubCategories] = useState<PromptSubCategory[]>([]);
    const [fields, setFields] = useState<EditablePromptField[]>([]);
    const [error, setError] = useState('');
    const [fieldIndexToDelete, setFieldIndexToDelete] = useState<number | null>(null);

    // Polish Feature States
    const [showPolishUI, setShowPolishUI] = useState(false);
    const [polishRequirements, setPolishRequirements] = useState('');
    const [polishedResult, setPolishedResult] = useState('');
    const [isPolishing, setIsPolishing] = useState(false);
    const abortControllerRef = useRef<AbortController | null>(null);

    useEffect(() => {
        if (isOpen) {
            if (promptToEdit) {
                setTitle(promptToEdit.title);
                setDescription(promptToEdit.description);
                setExample(promptToEdit.example || '');
                setTemplate(promptToEdit.template || promptToEdit.content);
                setCategory(promptToEdit.category);
                setSubCategories(promptToEdit.subCategories && promptToEdit.subCategories.length > 0 ? promptToEdit.subCategories : []);
                setFields((promptToEdit.fields || []).map(f => ({ ...f, _key: generateKey() })));
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
            
            // Reset Polish State
            setShowPolishUI(false);
            setPolishRequirements('');
            setPolishedResult('');
            setIsPolishing(false);
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
            maxLength: undefined,
            _key: generateKey()
        }]);
    };

    const updateField = (index: number, key: keyof PromptField, value: any) => {
        setFields(prev => {
            const next = [...prev];
            const fieldToUpdate = { ...next[index] };
            if (key === 'id') {
                const sanitized = String(value).replace(/[^a-zA-Z0-9_]/g, '');
                // @ts-ignore
                fieldToUpdate[key] = sanitized;
            } else {
                // @ts-ignore
                fieldToUpdate[key] = value;
            }
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

    const handlePolishPrompt = async () => {
        if (!template.trim()) {
            setError('请先填写基础提示词模板，AI 才能进行润色。');
            return;
        }
        
        setIsPolishing(true);
        setPolishedResult('');
        const controller = new AbortController();
        abortControllerRef.current = controller;

        const promptText = `你是一个专业的 Prompt Engineer。请根据以下要求润色用户的提示词模板。
        
        【原始提示词】：
        ${template}

        【润色要求】：
        ${polishRequirements || '请优化语言表达，使其更加精准、逻辑更清晰，适合大语言模型理解。'}

        请直接输出润色后的内容（Markdown格式），不需要包含开场白或结束语。`;

        try {
            const stream = generateTextStream(promptText, {
                model: 'deepseek-chat', 
                temperature: 0.7,
                topP: 0.9,
                signal: controller.signal
            });

            for await (const chunk of stream) {
                setPolishedResult(prev => prev + chunk);
            }
        } catch (e: any) {
            if (e.message !== 'Aborted') {
                setPolishedResult(`润色失败: ${e.message}`);
            }
        } finally {
            setIsPolishing(false);
            abortControllerRef.current = null;
        }
    };

    const stopPolishing = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
        setIsPolishing(false);
    };

    const applyPolished = () => {
        setTemplate(polishedResult);
        setShowPolishUI(false);
        setPolishedResult('');
        setPolishRequirements('');
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!title.trim()) { setError('请填写标题'); return; }
        if (!description.trim()) { setError('请填写简介'); return; }
        if (!template.trim()) { setError('请填写模板'); return; }
        
        // Tag Validation
        const functionalTags = FUNCTIONAL_TAGS.map(t => t.id);
        const genreTags = GENRE_TAGS.map(t => t.id);
        
        const hasFunctional = subCategories.some(t => functionalTags.includes(t as any));
        const hasGenre = subCategories.some(t => genreTags.includes(t as any));

        if (!hasFunctional || !hasGenre) {
            setError('请至少选择一种“功能类型”和一种“题材属性”标签');
            return;
        }

        const cleanFields = fields.map(({ _key, ...rest }) => rest);

        onSave({
            title, description, example, template, category, subCategories: subCategories, fields: cleanFields, creator: 'user',
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
                        {/* 基本信息 */}
                        <div className="p-6 bg-blue-50/40 dark:bg-blue-900/10 rounded-xl space-y-4 border border-blue-100 dark:border-blue-900/30">
                            <h4 className="text-sm font-bold text-blue-600 flex items-center gap-2"><InformationCircle className="w-4 h-4"/>基本信息</h4>
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-gray-600 dark:text-gray-300">提示词标题</label>
                                    <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="例如：赛博朋克城市描写" className="w-full p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-base font-medium focus:ring-2 focus:ring-sky-500 outline-none transition-all shadow-sm" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-gray-600 dark:text-gray-300">主分类</label>
                                    <select value={category} onChange={e => setCategory(e.target.value as PromptCategory)} className="w-full p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-base font-medium outline-none focus:ring-2 focus:ring-sky-500 shadow-sm cursor-pointer">
                                        {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* 标签选择区域 - Combined */}
                        <div className="p-6 bg-purple-50/40 dark:bg-purple-900/10 rounded-xl space-y-5 border border-purple-100 dark:border-purple-900/30">
                            <div className="flex justify-between items-center">
                                <h4 className="text-sm font-bold text-purple-600 flex items-center gap-2"><Tag className="w-4 h-4"/> 标签配置</h4>
                                <span className={`text-xs font-medium ${subCategories.length >= 5 ? 'text-red-500' : 'text-gray-400'}`}>
                                    已选 {subCategories.length}/5 (需各选至少一个)
                                </span>
                            </div>
                            
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider ml-1">功能类型 (至少选1个)</span>
                                    <div className="flex flex-wrap gap-2">
                                        {FUNCTIONAL_TAGS.filter(t => t.id !== 'all').map(tag => (
                                            <button key={tag.id} type="button" onClick={() => toggleSubCategory(tag.id as PromptSubCategory)} className={`px-4 py-1.5 text-xs rounded-full border transition-all ${subCategories.includes(tag.id as any) ? 'bg-purple-600 text-white border-purple-600 shadow-md' : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-500 hover:border-purple-300'}`}>{tag.label}</button>
                                        ))}
                                    </div>
                                </div>
                                <div className="w-full h-px bg-purple-100 dark:bg-purple-900/30"></div>
                                <div className="space-y-2">
                                    <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider ml-1">题材属性 (至少选1个)</span>
                                    <div className="flex flex-wrap gap-2">
                                        {GENRE_TAGS.filter(t => t.id !== 'all').map(tag => (
                                            <button key={tag.id} type="button" onClick={() => toggleSubCategory(tag.id as PromptSubCategory)} className={`px-4 py-1.5 text-xs rounded-full border transition-all ${subCategories.includes(tag.id as any) ? 'bg-purple-600 text-white border-purple-600 shadow-md' : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-500 hover:border-purple-300'}`}>{tag.label}</button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 简介与预览 */}
                        <div className="p-6 bg-orange-50/40 dark:bg-orange-900/10 rounded-xl space-y-4 border border-orange-100 dark:border-orange-900/30">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <h4 className="text-sm font-bold text-orange-600 dark:text-orange-400 flex items-center gap-2"><BookOpen className="w-4 h-4"/>功能简介</h4>
                                    <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="简单描述这个提示词的用途..." className="w-full h-32 p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm resize-y focus:ring-2 focus:ring-orange-500 outline-none" />
                                </div>
                                <div className="space-y-2">
                                    <h4 className="text-sm font-bold text-orange-600 dark:text-orange-400 flex items-center gap-2"><Sparkles className="w-4 h-4"/>效果预览 (选填)</h4>
                                    <textarea value={example} onChange={e => setExample(e.target.value)} placeholder="展示 AI 生成的结果范例..." className="w-full h-32 p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm resize-y focus:ring-2 focus:ring-orange-500 outline-none" />
                                </div>
                            </div>
                        </div>

                        {/* 提示词模板 + 润色功能 */}
                        <div className="p-6 bg-indigo-50/40 dark:bg-indigo-900/10 rounded-xl space-y-4 border border-indigo-100 dark:border-indigo-900/30">
                            <div className="flex justify-between items-center">
                                <h4 className="text-sm font-bold text-indigo-600 flex items-center gap-2"><DocumentText className="w-4 h-4"/>AI 提示词模板</h4>
                                <button 
                                    type="button" 
                                    onClick={() => setShowPolishUI(!showPolishUI)} 
                                    className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all flex items-center gap-1 ${showPolishUI ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-indigo-600 border-indigo-200 hover:bg-indigo-50'}`}
                                >
                                    <Sparkles className="w-3.5 h-3.5" />
                                    {showPolishUI ? '收起润色' : '润色提示词'}
                                </button>
                            </div>

                            {/* Polish UI Overlay */}
                            {showPolishUI && (
                                <div className="p-4 bg-indigo-100/50 dark:bg-indigo-900/30 rounded-xl border border-indigo-200 dark:border-indigo-800 space-y-3 animate-fade-in">
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-indigo-700 dark:text-indigo-300">润色要求 (可选)</label>
                                        <div className="flex gap-2">
                                            <input 
                                                type="text" 
                                                value={polishRequirements}
                                                onChange={e => setPolishRequirements(e.target.value)}
                                                placeholder="例如：请让语气更专业，结构更清晰，增加对细节的描述要求..." 
                                                className="flex-1 p-2 bg-white dark:bg-gray-800 border border-indigo-200 dark:border-indigo-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                            />
                                            {isPolishing ? (
                                                <button type="button" onClick={stopPolishing} className="px-4 py-2 bg-red-500 text-white text-xs font-bold rounded-lg hover:bg-red-600 transition-colors flex items-center gap-1">
                                                    <Stop className="w-3.5 h-3.5" /> 停止
                                                </button>
                                            ) : (
                                                <button type="button" onClick={handlePolishPrompt} className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-500 transition-colors flex items-center gap-1 shadow-sm">
                                                    <Sparkles className="w-3.5 h-3.5" /> 开始润色
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    
                                    {polishedResult && (
                                        <div className="mt-3 space-y-2">
                                            <div className="text-xs font-bold text-indigo-700 dark:text-indigo-300">润色结果预览：</div>
                                            <div className="p-3 bg-white dark:bg-gray-900 rounded-lg border border-indigo-200 dark:border-indigo-800 text-sm max-h-48 overflow-y-auto whitespace-pre-wrap font-mono">
                                                {polishedResult}
                                            </div>
                                            {!isPolishing && (
                                                <div className="flex gap-2 justify-end">
                                                    <button type="button" onClick={handlePolishPrompt} className="px-3 py-1.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs font-bold rounded-lg hover:bg-gray-300 transition-colors flex items-center gap-1">
                                                        <ArrowPath className="w-3.5 h-3.5" /> 重新润色
                                                    </button>
                                                    <button type="button" onClick={applyPolished} className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-500 transition-colors flex items-center gap-1 shadow-sm">
                                                        <Check className="w-3.5 h-3.5" /> 替换原有提示词
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="relative rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                                <MarkdownToolbar textareaId="prompt-template-editor" onInsert={(val) => setTemplate(val)} />
                                <textarea 
                                    id="prompt-template-editor"
                                    value={template} 
                                    onChange={e => setTemplate(e.target.value)} 
                                    onKeyDown={(e) => handleListKeyDown(e, template, setTemplate)}
                                    placeholder="使用 ${变量名} 引用下方定义的字段..." 
                                    className="w-full h-48 p-4 bg-white text-gray-900 dark:text-white dark:bg-gray-800 font-mono text-sm focus:outline-none resize-y" 
                                />
                            </div>
                        </div>

                        {/* 动态表单 */}
                        <div className="p-6 bg-rose-50/40 dark:bg-rose-900/10 rounded-xl border border-rose-100 dark:border-rose-900/30 space-y-4">
                            <div className="flex justify-between items-center">
                                <h4 className="text-sm font-bold text-rose-600 dark:text-rose-400 flex items-center gap-2"><Bolt className="w-4 h-4"/>动态表单字段配置</h4>
                                <button type="button" onClick={addField} className="px-4 py-1.5 bg-rose-600 text-white text-xs font-bold rounded-lg hover:bg-rose-500 shadow-md flex items-center gap-1 shadow-rose-500/20"><Plus className="w-3 h-3"/> 添加字段</button>
                            </div>
                            <div className="space-y-4">
                                {fields.length === 0 ? (
                                    <div className="text-center py-8 text-gray-400 text-xs italic bg-white/50 dark:bg-gray-900/50 rounded-lg border border-dashed border-rose-200 dark:border-rose-800/50">请点击上方按钮添加字段，用于接收用户输入</div>
                                ) : (
                                    fields.map((field, index) => (
                                        <div key={field._key} className="p-5 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 space-y-4 shadow-sm group relative hover:border-rose-300 transition-colors">
                                            
                                            {/* Controls */}
                                            <div className="absolute right-3 top-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white dark:bg-gray-900 p-1 rounded-lg border border-gray-100 dark:border-gray-700 shadow-sm z-10">
                                                <button type="button" onClick={() => moveField(index, 'up')} disabled={index === 0} className="p-1.5 text-gray-400 hover:text-sky-500 disabled:opacity-30 transition-colors" title="上移"><ChevronUp className="w-4 h-4"/></button>
                                                <button type="button" onClick={() => moveField(index, 'down')} disabled={index === fields.length - 1} className="p-1.5 text-gray-400 hover:text-sky-500 disabled:opacity-30 transition-colors" title="下移"><ChevronDown className="w-4 h-4"/></button>
                                                <div className="w-px h-4 bg-gray-200 dark:bg-gray-700 mx-1 self-center"></div>
                                                <button type="button" onClick={() => setFieldIndexToDelete(index)} className="p-1.5 text-gray-400 hover:text-red-500 transition-colors" title="删除"><Trash className="w-4 h-4"/></button>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 pr-10">
                                                <div className="md:col-span-4 space-y-1.5">
                                                    <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">显示名称</label>
                                                    <input type="text" value={field.label} onChange={e => updateField(index, 'label', e.target.value)} className="w-full p-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-rose-500 outline-none transition-all" placeholder="请输入如：主角姓名" />
                                                </div>
                                                <div className="md:col-span-4 space-y-1.5">
                                                    <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">变量名 (ID)</label>
                                                    <input type="text" value={field.id} onChange={e => updateField(index, 'id', e.target.value)} className="w-full p-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-mono text-rose-600 dark:text-rose-400 focus:ring-2 focus:ring-rose-500 outline-none transition-all" placeholder="请输入变量名" />
                                                </div>
                                                <div className="md:col-span-4 space-y-1.5">
                                                    <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">是否必填</label>
                                                    <div className="flex items-center h-[42px] gap-4 px-1">
                                                        <label className="flex items-center gap-2 cursor-pointer group/radio">
                                                            <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${field.required !== false ? 'border-rose-500 bg-rose-500' : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 group-hover/radio:border-rose-400'}`}>
                                                                {field.required !== false && <div className="w-1.5 h-1.5 bg-white rounded-full"></div>}
                                                            </div>
                                                            <input type="radio" checked={field.required !== false} onChange={() => updateField(index, 'required', true)} className="hidden" />
                                                            <span className={`text-sm font-medium ${field.required !== false ? 'text-rose-600 dark:text-rose-400' : 'text-gray-600 dark:text-gray-400'}`}>必填</span>
                                                        </label>
                                                        <label className="flex items-center gap-2 cursor-pointer group/radio">
                                                            <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${field.required === false ? 'border-rose-500 bg-rose-500' : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 group-hover/radio:border-rose-400'}`}>
                                                                {field.required === false && <div className="w-1.5 h-1.5 bg-white rounded-full"></div>}
                                                            </div>
                                                            <input type="radio" checked={field.required === false} onChange={() => updateField(index, 'required', false)} className="hidden" />
                                                            <span className={`text-sm font-medium ${field.required === false ? 'text-rose-600 dark:text-rose-400' : 'text-gray-600 dark:text-gray-400'}`}>选填</span>
                                                        </label>
                                                    </div>
                                                </div>
                                                
                                                <div className="md:col-span-3 space-y-1.5">
                                                    <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">输入类型</label>
                                                    <select value={field.type} onChange={e => updateField(index, 'type', e.target.value)} className="w-full p-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-rose-500">
                                                        <option value="text">单行文本</option>
                                                        <option value="textarea">多行文本</option>
                                                        <option value="file">文件上传 (Word/Txt)</option>
                                                    </select>
                                                </div>
                                                <div className="md:col-span-3 space-y-1.5">
                                                    <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">字数上限 (选填)</label>
                                                    <input type="number" value={field.maxLength || ''} onChange={e => updateField(index, 'maxLength', e.target.value ? parseInt(e.target.value) : undefined)} className="w-full p-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-rose-500" placeholder="请输入数字，默认无限制" />
                                                </div>
                                                <div className="md:col-span-6 space-y-1.5">
                                                    <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">补充说明</label>
                                                    <input type="text" value={field.description || ''} onChange={e => updateField(index, 'description', e.target.value)} className="w-full p-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-rose-500 outline-none transition-all" placeholder="例如：请输入用户的具体要求，越详细越好..." />
                                                </div>
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
