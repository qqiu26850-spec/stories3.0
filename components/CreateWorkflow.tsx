
import React, { useState, useEffect } from 'react';
import { Plus, Trash, Sparkles, ChevronDown, ChevronUp, InformationCircle, Bolt, DocumentText, X, Check, ChevronLeft, Tag } from './Icon';
import { WorkflowField, WorkflowStep, Workflow, PromptSubCategory } from '../types';
import { FUNCTIONAL_TAGS, GENRE_TAGS } from '../constants';

interface CreateWorkflowProps {
    onBack: () => void;
    onSave: (data: any) => void;
    workflowToEdit?: Workflow | null;
}

const CreateWorkflow: React.FC<CreateWorkflowProps> = ({ onBack, onSave, workflowToEdit }) => {
    const [name, setName] = useState('');
    const [type, setType] = useState('short-story');
    const [description, setDescription] = useState('');
    const [subCategories, setSubCategories] = useState<PromptSubCategory[]>([]);
    const [fields, setFields] = useState<WorkflowField[]>([]);
    const [steps, setSteps] = useState<WorkflowStep[]>([]);

    useEffect(() => {
        if (workflowToEdit) {
            setName(workflowToEdit.title);
            setType(workflowToEdit.category);
            setDescription(workflowToEdit.description);
            setSubCategories(workflowToEdit.subCategories || []);
            setFields(workflowToEdit.fields || []);
            setSteps(workflowToEdit.steps || []);
        } else {
            // Initial state for new workflow: empty steps
            setSteps([]);
        }
    }, [workflowToEdit]);

    const addField = () => {
        setFields([...fields, { 
            id: `field_${Date.now()}`, 
            label: '', 
            variable: '', 
            type: 'text',
            required: true,
            description: ''
        }]);
    };

    const updateField = (index: number, key: keyof WorkflowField, value: any) => {
        const newFields = [...fields];
        // @ts-ignore
        newFields[index][key] = value;
        setFields(newFields);
    };

    const removeField = (index: number) => {
        setFields(fields.filter((_, i) => i !== index));
    };

    const moveField = (index: number, direction: 'up' | 'down') => {
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= fields.length) return;
        const newFields = [...fields];
        [newFields[index], newFields[targetIndex]] = [newFields[targetIndex], newFields[index]];
        setFields(newFields);
    };

    const addStep = () => {
        const stepNum = steps.length + 1;
        setSteps([...steps, { 
            id: `step_${Date.now()}`, 
            name: `第${stepNum}步：新处理环节`, 
            prompt: '', 
            outputVariable: `result_${stepNum}` 
        }]);
    };

    const updateStep = (index: number, key: keyof WorkflowStep, value: string) => {
        const newSteps = [...steps];
        // @ts-ignore
        newSteps[index][key] = value;
        setSteps(newSteps);
    };

    const removeStep = (index: number) => {
        setSteps(steps.filter((_, i) => i !== index));
    };

    const toggleSubCategory = (tag: PromptSubCategory) => {
        setSubCategories(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
    };

    const handleSave = () => {
        if (!name.trim()) { alert('请输入工作流名称'); return; }
        if (fields.length > 0 && fields.some(f => !f.variable || !f.label)) { alert('请完善表单字段定义'); return; }
        if (steps.length === 0) { alert('工作流至少需要一个 AI 运行步骤'); return; }
        
        onSave({ name, type, description, subCategories, fields, steps });
    };

    return (
        <div className="p-4 sm:p-5 lg:p-6 animate-fade-in bg-gray-50 dark:bg-black min-h-full flex flex-col font-sans">
            <div className="max-w-6xl mx-auto w-full flex-1 flex flex-col pb-24">
                <div className="flex justify-between items-center mb-6 bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-sky-100 dark:bg-sky-900/30 rounded-xl text-sky-600 dark:text-sky-400">
                             <Sparkles className="w-8 h-8" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">{workflowToEdit ? '修改工作流' : '创建新工作流'}</h1>
                            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">定制多级 AI 运行链路，打造自动化内容工厂</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button 
                            onClick={onBack} 
                            className="px-5 py-2.5 text-gray-600 dark:text-gray-300 font-bold bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-100 transition-all flex items-center gap-2"
                        >
                            <ChevronLeft className="w-5 h-5" />
                            返回列表
                        </button>
                    </div>
                </div>

                <div className="space-y-6 flex-1">
                    {/* 1. 工作流基本设定 */}
                    <div className="bg-blue-50/40 dark:bg-blue-900/10 p-6 sm:p-8 rounded-3xl border border-blue-100 dark:border-blue-900/30 shadow-sm space-y-6 sm:space-y-8">
                        <h2 className="text-2xl font-black text-blue-700 dark:text-blue-300 flex items-center gap-3">
                            <InformationCircle className="w-7 h-7" />
                            1. 工作流基本设定
                        </h2>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
                            <div className="space-y-2">
                                <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">工作流名称</label>
                                <input 
                                    type="text" 
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    placeholder="如：三幕式电影剧本生成器"
                                    className="w-full p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-sky-500 outline-none transition text-base shadow-sm"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">主要创作分类</label>
                                <div className="relative">
                                    <select 
                                        value={type}
                                        onChange={e => setType(e.target.value)}
                                        className="w-full p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-sky-500 outline-none transition text-base appearance-none cursor-pointer shadow-sm"
                                    >
                                        <option value="short-story">短篇小说</option>
                                        <option value="long-story">长篇小说</option>
                                        <option value="script">影视剧本</option>
                                        <option value="general">通用任务</option>
                                    </select>
                                    <ChevronDown className="w-5 h-5 absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                                </div>
                            </div>

                            {/* 子分类/标签选择 - 移动至功能描述上方 */}
                            <div className="md:col-span-2 space-y-4 pt-2">
                                <h4 className="text-sm font-black text-blue-600 flex items-center gap-2"><Tag className="w-5 h-5"/> 分类标签 <span className="text-[10px] font-normal text-gray-400">(最多选择5个)</span></h4>
                                <div className="space-y-4">
                                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                                        <span className="text-xs font-bold text-gray-400 shrink-0">题材属性:</span>
                                        <div className="flex flex-wrap gap-2">
                                            {GENRE_TAGS.filter(t => t.id !== 'all').map(tag => (
                                                <button 
                                                    key={tag.id} 
                                                    type="button" 
                                                    onClick={() => toggleSubCategory(tag.id as PromptSubCategory)} 
                                                    className={`px-4 py-1.5 text-xs rounded-full border transition-all ${subCategories.includes(tag.id as PromptSubCategory) ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-white dark:bg-gray-800 text-gray-500 border-gray-200 hover:border-blue-400'}`}
                                                >
                                                    {tag.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                                        <span className="text-xs font-bold text-gray-400 shrink-0">功能属性:</span>
                                        <div className="flex flex-wrap gap-2">
                                            {FUNCTIONAL_TAGS.filter(t => t.id !== 'all').map(tag => (
                                                <button 
                                                    key={tag.id} 
                                                    type="button" 
                                                    onClick={() => toggleSubCategory(tag.id as PromptSubCategory)} 
                                                    className={`px-4 py-1.5 text-xs rounded-full border transition-all ${subCategories.includes(tag.id as PromptSubCategory) ? 'bg-purple-600 text-white border-purple-600 shadow-md' : 'bg-white dark:bg-gray-800 text-gray-500 border-gray-200 hover:border-purple-400'}`}
                                                >
                                                    {tag.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="md:col-span-2 space-y-2">
                                <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">功能描述</label>
                                <textarea 
                                    value={description}
                                    onChange={e => setDescription(e.target.value)}
                                    placeholder="详细描述这个工作流的逻辑流程和最终产出内容..."
                                    className="w-full p-4 h-28 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-sky-500 outline-none transition resize-none text-base shadow-sm"
                                />
                            </div>
                        </div>
                    </div>

                    {/* 2. 用户输入表单 */}
                    <div className="bg-amber-50/40 dark:bg-amber-900/10 p-6 sm:p-8 rounded-3xl border border-amber-100 dark:border-amber-900/30 shadow-sm space-y-6 sm:space-y-8">
                        <div className="flex justify-between items-center">
                            <h2 className="text-2xl font-black text-amber-700 dark:text-amber-300 flex items-center gap-3">
                                <Bolt className="w-7 h-7" />
                                2. 用户输入表单
                            </h2>
                            <button onClick={addField} className="px-5 py-2.5 bg-amber-600 text-white font-bold rounded-xl flex items-center gap-2 transition-all hover:bg-amber-500 shadow-lg shadow-amber-500/20">
                                <Plus className="w-5 h-5" /> 添加输入字段
                            </button>
                        </div>
                        <div className="space-y-4">
                            {fields.length === 0 ? (
                                <div className="text-center py-16 bg-white/50 dark:bg-black/20 rounded-2xl border-2 border-dashed border-amber-200 dark:border-amber-900/50 text-gray-400 text-sm italic">
                                    点击上方按钮，定义运行工作流前需要用户填写的表单参数。
                                </div>
                            ) : (
                                fields.map((field, index) => (
                                    <div key={field.id} className="flex flex-col bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 animate-fade-in group shadow-sm relative">
                                        {/* Field Reordering Controls */}
                                        <div className="absolute left-2 top-1/2 -translate-y-1/2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button disabled={index === 0} onClick={() => moveField(index, 'up')} className="p-1 hover:text-sky-500 disabled:opacity-20"><ChevronUp className="w-4 h-4"/></button>
                                            <button disabled={index === fields.length - 1} onClick={() => moveField(index, 'down')} className="p-1 hover:text-sky-500 disabled:opacity-20"><ChevronDown className="w-4 h-4"/></button>
                                        </div>

                                        <div className="pl-6 flex flex-col md:flex-row gap-6 items-end">
                                            <div className="flex-1 w-full space-y-2">
                                                <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest">表单项显示名</label>
                                                <input 
                                                    type="text" 
                                                    value={field.label}
                                                    onChange={e => updateField(index, 'label', e.target.value)}
                                                    className="w-full p-3.5 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 transition-all shadow-inner"
                                                    placeholder="如：故事核心关键词"
                                                />
                                            </div>
                                            <div className="flex-1 w-full space-y-2">
                                                <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest">变量名 (供 AI 引用)</label>
                                                <input 
                                                    type="text" 
                                                    value={field.variable}
                                                    onChange={e => updateField(index, 'variable', e.target.value)}
                                                    className="w-full p-3.5 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl font-mono outline-none focus:ring-2 focus:ring-amber-500 transition-all shadow-inner"
                                                    placeholder="如：keywords"
                                                />
                                            </div>
                                            <div className="w-full md:w-32 space-y-2">
                                                <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest">展示类型</label>
                                                <select 
                                                    value={field.type}
                                                    onChange={e => updateField(index, 'type', e.target.value as any)}
                                                    className="w-full p-3.5 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl outline-none cursor-pointer"
                                                >
                                                    <option value="text">单行</option>
                                                    <option value="textarea">多行</option>
                                                </select>
                                            </div>
                                            <div className="w-full md:w-24 space-y-2">
                                                <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest">是否必填</label>
                                                <div className="flex items-center h-[52px]">
                                                    <button 
                                                        onClick={() => updateField(index, 'required', !field.required)}
                                                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-colors ${field.required ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-gray-50 text-gray-400 border-gray-200'}`}
                                                    >
                                                        {field.required ? '必填' : '选填'}
                                                    </button>
                                                </div>
                                            </div>
                                            <button onClick={() => removeField(index)} className="p-4 text-gray-300 hover:text-rose-500 transition-all mb-0.5">
                                                <Trash className="w-6 h-6" />
                                            </button>
                                        </div>

                                        <div className="pl-6 mt-4 w-full space-y-2">
                                            <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest">补充说明 (选填)</label>
                                            <input 
                                                type="text" 
                                                value={field.description || ''}
                                                onChange={e => updateField(index, 'description', e.target.value)}
                                                className="w-full p-3 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-1 focus:ring-amber-500 transition-all shadow-inner"
                                                placeholder="输入该表单项的填写提示或要求..."
                                            />
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* 3. 运行步骤 */}
                    <div className="bg-purple-50/40 dark:bg-purple-900/10 p-6 sm:p-8 rounded-3xl border border-purple-100 dark:border-purple-900/30 shadow-sm space-y-6 sm:space-y-8">
                        <div className="flex justify-between items-center">
                            <h2 className="text-2xl font-black text-purple-700 dark:text-purple-300 flex items-center gap-3">
                                <Sparkles className="w-7 h-7" />
                                3. 运行步骤
                            </h2>
                            <button onClick={addStep} className="px-5 py-2.5 bg-purple-600 text-white font-bold rounded-xl flex items-center gap-2 transition-all hover:bg-purple-500 shadow-lg shadow-purple-500/20">
                                <Plus className="w-5 h-5" /> 增加处理节点
                            </button>
                        </div>
                        
                        <div className="space-y-12 relative mt-4">
                            {steps.length > 0 && (
                                <>
                                    {steps.length > 1 && <div className="absolute left-6 top-8 bottom-8 w-1 bg-purple-100 dark:bg-purple-800 -z-10" />}
                                    {steps.map((step, index) => (
                                        <div key={step.id} className="relative pl-14 animate-fade-in">
                                            <div className="absolute left-2 top-0 w-9 h-9 rounded-full bg-purple-600 text-white flex items-center justify-center font-black text-base shadow-xl ring-4 ring-white dark:ring-gray-900">
                                                {index + 1}
                                            </div>

                                            <div className="bg-white dark:bg-gray-800 p-6 sm:p-8 rounded-3xl border border-gray-100 dark:border-gray-700 space-y-6 shadow-sm">
                                                <div className="flex justify-between items-start gap-4 pb-4 border-b border-gray-50 dark:border-gray-700">
                                                    <input 
                                                        type="text"
                                                        value={step.name}
                                                        onChange={e => updateStep(index, 'name', e.target.value)}
                                                        className="bg-transparent text-gray-900 dark:text-white font-black text-xl outline-none border-b-2 border-transparent focus:border-purple-500 flex-1 transition-all"
                                                        placeholder="本步骤名称，如：剧情逻辑拆解"
                                                    />
                                                    <button onClick={() => removeStep(index)} className="text-gray-300 hover:text-rose-500 transition-colors">
                                                        <Trash className="w-5 h-5" />
                                                    </button>
                                                </div>

                                                <div className="space-y-3">
                                                    <div className="flex justify-between items-center px-1">
                                                        <label className="text-xs font-black text-gray-400 uppercase tracking-widest">运行提示词 (Prompt)</label>
                                                        <div className="text-[11px] text-purple-500 font-black bg-purple-50 dark:bg-purple-900/30 px-3 py-1 rounded-full border border-purple-100 dark:border-purple-800">支持引用变量</div>
                                                    </div>
                                                    <textarea 
                                                        value={step.prompt}
                                                        onChange={e => updateStep(index, 'prompt', e.target.value)}
                                                        className="w-full p-5 h-48 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-3xl focus:ring-2 focus:ring-purple-500 outline-none text-base font-sans resize-none transition-all shadow-inner"
                                                        placeholder={`例如：请基于之前设定的人物 \${${fields[0]?.variable || 'keywords'}} 编写...`}
                                                    />
                                                </div>

                                                <div className="flex items-center gap-4 bg-purple-50/50 dark:bg-purple-900/10 p-4 rounded-2xl border border-purple-100 dark:border-purple-800/50">
                                                    <DocumentText className="w-5 h-5 text-purple-500" />
                                                    <span className="text-xs text-purple-700 dark:text-purple-300 font-black uppercase whitespace-nowrap tracking-wider">保存输出变量为:</span>
                                                    <input 
                                                        type="text"
                                                        value={step.outputVariable}
                                                        onChange={e => updateStep(index, 'outputVariable', e.target.value)}
                                                        className="bg-transparent text-sm font-mono text-purple-600 dark:text-purple-400 outline-none flex-1 font-bold"
                                                        placeholder="如：step_result"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </>
                            )}
                            {steps.length === 0 && (
                                <div className="text-center py-20 text-gray-400 text-sm italic bg-white dark:bg-black/20 rounded-3xl border-2 border-dashed border-purple-100 dark:border-purple-900/50">
                                    <Sparkles className="w-10 h-10 mx-auto mb-4 opacity-20" />
                                    暂无运行步骤，点击右上角按钮添加 AI 处理节点
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 变量引用指南 */}
                    <div className="bg-sky-50/50 dark:bg-sky-900/10 p-6 sm:p-8 rounded-3xl border border-sky-100 border-sky-800 space-y-6">
                         <h4 className="text-lg font-black text-sky-700 dark:text-sky-300 flex items-center gap-3 uppercase tracking-wider">
                             <InformationCircle className="w-6 h-6" />
                             变量引用指南
                         </h4>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-10 text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                             <div className="bg-white dark:bg-gray-900/50 p-6 rounded-2xl shadow-sm border border-sky-100 dark:border-sky-800">
                                 <p className="font-black mb-3 text-sky-800 dark:text-sky-200 border-b border-sky-50 dark:border-sky-800 pb-3 text-base">● 引用用户初始表单</p>
                                 <p>在 Prompt 中使用 <code className="bg-sky-50 dark:bg-black px-2 py-1 rounded text-amber-600 font-mono font-bold">{"${"}{fields[0]?.variable || 'var_name'}{"}"}</code> 即可引用用户填写的参数。</p>
                             </div>
                             <div className="bg-white dark:bg-gray-900/50 p-6 rounded-2xl shadow-sm border border-sky-100 dark:border-sky-800">
                                 <p className="font-black mb-3 text-sky-800 dark:text-sky-200 border-b border-sky-50 dark:border-sky-800 pb-3 text-base">● 引用前序运行产出</p>
                                 <p>在后续步骤中，使用 <code className="bg-sky-50 dark:bg-black px-2 py-1 rounded text-purple-600 font-mono font-bold">{"${"}{steps[0]?.outputVariable || 'step_out'}{"}"}</code> 引用之前步骤生成的结果。</p>
                             </div>
                         </div>
                    </div>
                </div>
            </div>

            {/* 发布按钮容器 - 放置到底部 */}
            <div className="fixed bottom-0 left-0 right-0 bg-white/80 dark:bg-black/80 backdrop-blur-md border-t border-gray-100 dark:border-gray-800 p-4 z-40 flex justify-center">
                <div className="max-w-6xl w-full flex justify-end gap-4 px-4 sm:px-10">
                    <button 
                        onClick={onBack} 
                        className="px-8 py-3 text-gray-600 dark:text-gray-300 font-bold bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 transition-all"
                    >
                        取消修改
                    </button>
                    <button 
                        onClick={handleSave} 
                        className="px-12 py-3 bg-sky-600 text-white font-black rounded-xl hover:bg-sky-500 shadow-xl shadow-sky-500/20 transition-all active:scale-95 flex items-center gap-2"
                    >
                        <Check className="w-5 h-5" />
                        保存并发布工作流
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CreateWorkflow;
