
import React, { useState, useEffect } from 'react';
import { Plus, Trash, Sparkles, ChevronDown, ChevronUp, InformationCircle, Bolt, DocumentText, X, Check, ChevronLeft, Tag, Box } from './Icon';
import { WorkflowField, WorkflowStep, Workflow, PromptSubCategory, Prompt } from '../types';
import { GENRE_TAGS } from '../constants';
import PromptSelectionModal from './PromptSelectionModal';

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

    // 导入提示词相关状态
    const [isPromptModalOpen, setPromptModalOpen] = useState(false);
    const [activeStepIndex, setActiveStepIndex] = useState<number | null>(null);

    useEffect(() => {
        if (workflowToEdit) {
            setName(workflowToEdit.title);
            setType(workflowToEdit.category);
            setDescription(workflowToEdit.description);
            setSubCategories(workflowToEdit.subCategories || []);
            setFields(workflowToEdit.fields || []);
            setSteps(workflowToEdit.steps || []);
        } else {
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

    const handleImportPrompt = (index: number) => {
        setActiveStepIndex(index);
        setPromptModalOpen(true);
    };

    const onSelectPromptTemplate = (prompt: Prompt) => {
        if (activeStepIndex !== null) {
            const newSteps = [...steps];
            newSteps[activeStepIndex].prompt = prompt.template || prompt.content;
            // 如果导入的提示词有标题且当前步骤名是默认名，则自动填充步骤名
            if (newSteps[activeStepIndex].name.includes('新处理环节')) {
                newSteps[activeStepIndex].name = `第${activeStepIndex + 1}步：${prompt.title}`;
            }
            setSteps(newSteps);
        }
        setPromptModalOpen(false);
    };

    const handleSave = () => {
        if (!name.trim()) { alert('请输入工作流名称'); return; }
        if (fields.length > 0 && fields.some(f => !f.variable || !f.label)) { alert('请完善表单字段定义'); return; }
        if (steps.length === 0) { alert('工作流至少需要一个 AI 运行步骤'); return; }
        
        onSave({ name, type, description, subCategories, fields, steps });
    };

    return (
        <div className="p-4 sm:p-5 lg:p-6 animate-fade-in bg-gray-50 dark:bg-black min-h-full flex flex-col font-sans">
            <PromptSelectionModal 
                isOpen={isPromptModalOpen} 
                onClose={() => setPromptModalOpen(false)} 
                onSelect={onSelectPromptTemplate}
            />

            <div className="max-w-6xl mx-auto w-full flex-1 flex flex-col pb-24">
                {/* 顶部栏 - 移除 mb-6, 缩小字号 */}
                <div className="flex justify-between items-center bg-white dark:bg-gray-900 p-5 rounded-t-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className="p-2.5 bg-sky-100 dark:bg-sky-900/30 rounded-xl text-sky-600 dark:text-sky-400">
                             <Sparkles className="w-6 h-6" />
                        </div>
                        <div>
                            <h1 className="text-xl font-black text-gray-900 dark:text-white tracking-tight">{workflowToEdit ? '修改工作流' : '创建新工作流'}</h1>
                            <p className="text-gray-500 dark:text-gray-400 text-xs mt-0.5">创建工作流所需步骤：基本设定、表单定义及 AI 运行逻辑</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button 
                            onClick={onBack} 
                            className="px-4 py-2 text-xs text-gray-600 dark:text-gray-300 font-bold bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-100 transition-all flex items-center gap-2"
                        >
                            <ChevronLeft className="w-4 h-4" />
                            返回列表
                        </button>
                    </div>
                </div>

                <div className="space-y-0 flex-1">
                    {/* 1. 工作流基本设定 - 缩小主标题 */}
                    <div className="bg-blue-50/40 dark:bg-blue-900/10 p-6 sm:p-8 rounded-b-none border-x border-b-0 border-blue-100 dark:border-blue-900/30 shadow-sm space-y-6">
                        <h2 className="text-lg font-black text-blue-700 dark:text-blue-300 flex items-center gap-3">
                            <InformationCircle className="w-6 h-6" />
                            1. 工作流基本设定
                        </h2>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">工作流名称</label>
                                <input 
                                    type="text" 
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    placeholder="如：三幕式电影剧本生成器"
                                    className="w-full p-3.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-sky-500 outline-none transition text-sm shadow-sm"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">主要创作分类</label>
                                <div className="relative">
                                    <select 
                                        value={type}
                                        onChange={e => setType(e.target.value)}
                                        className="w-full p-3.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-sky-500 outline-none transition text-sm appearance-none cursor-pointer shadow-sm"
                                    >
                                        <option value="short-story">短篇小说</option>
                                        <option value="long-story">长篇小说</option>
                                        <option value="script">影视剧本</option>
                                        <option value="general">通用任务</option>
                                    </select>
                                    <ChevronDown className="w-4 h-4 absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                                </div>
                            </div>

                            <div className="md:col-span-2 space-y-4">
                                <h4 className="text-xs font-black text-blue-600 flex items-center gap-2"><Tag className="w-4 h-4"/> 题材标签 <span className="text-[10px] font-normal text-gray-400">(最多选择5个)</span></h4>
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

                            <div className="md:col-span-2 space-y-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">功能描述</label>
                                <textarea 
                                    value={description}
                                    onChange={e => setDescription(e.target.value)}
                                    placeholder="详细描述这个工作流的逻辑流程和最终产出内容..."
                                    className="w-full p-3.5 h-24 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-sky-500 outline-none transition resize-none text-sm shadow-sm"
                                />
                            </div>
                        </div>
                    </div>

                    {/* 2. 用户输入表单 - 缩小主标题 */}
                    <div className="bg-amber-50/40 dark:bg-amber-900/10 p-6 sm:p-8 border-x border-amber-100 dark:border-amber-900/30 shadow-sm space-y-6">
                        <div className="flex justify-between items-center">
                            <h2 className="text-lg font-black text-amber-700 dark:text-amber-300 flex items-center gap-3">
                                <Bolt className="w-6 h-6" />
                                2. 用户输入表单
                            </h2>
                            <button onClick={addField} className="px-4 py-2 bg-amber-600 text-white font-bold rounded-xl flex items-center gap-2 transition-all hover:bg-amber-500 shadow-lg shadow-amber-500/20 text-xs">
                                <Plus className="w-4 h-4" /> 添加字段
                            </button>
                        </div>
                        <div className="space-y-4">
                            {fields.length === 0 ? (
                                <div className="text-center py-12 bg-white/50 dark:bg-black/20 rounded-2xl border-2 border-dashed border-amber-200 dark:border-amber-900/50 text-gray-400 text-xs italic">
                                    定义运行工作流前需要用户填写的初始参数。
                                </div>
                            ) : (
                                fields.map((field, index) => (
                                    <div key={field.id} className="flex flex-col bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 animate-fade-in group shadow-sm relative">
                                        <div className="absolute left-2 top-1/2 -translate-y-1/2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button disabled={index === 0} onClick={() => moveField(index, 'up')} className="p-1 hover:text-sky-500 disabled:opacity-20"><ChevronUp className="w-3.5 h-3.5"/></button>
                                            <button disabled={index === fields.length - 1} onClick={() => moveField(index, 'down')} className="p-1 hover:text-sky-500 disabled:opacity-20"><ChevronDown className="w-3.5 h-3.5"/></button>
                                        </div>

                                        <div className="pl-6 flex flex-col md:flex-row gap-4 items-end">
                                            <div className="flex-1 w-full space-y-1.5">
                                                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">显示名</label>
                                                <input 
                                                    type="text" 
                                                    value={field.label}
                                                    onChange={e => updateField(index, 'label', e.target.value)}
                                                    className="w-full p-2.5 text-xs bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 transition-all"
                                                    placeholder="如：主角姓名"
                                                />
                                            </div>
                                            <div className="flex-1 w-full space-y-1.5">
                                                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">变量名</label>
                                                <input 
                                                    type="text" 
                                                    value={field.variable}
                                                    onChange={e => updateField(index, 'variable', e.target.value)}
                                                    className="w-full p-2.5 text-xs bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl font-mono outline-none focus:ring-2 focus:ring-amber-500 transition-all"
                                                    placeholder="如：name"
                                                />
                                            </div>
                                            <div className="w-full md:w-28 space-y-1.5">
                                                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">类型</label>
                                                <select 
                                                    value={field.type}
                                                    onChange={e => updateField(index, 'type', e.target.value as any)}
                                                    className="w-full p-2.5 text-xs bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl outline-none"
                                                >
                                                    <option value="text">单行</option>
                                                    <option value="textarea">多行</option>
                                                </select>
                                            </div>
                                            <button onClick={() => removeField(index)} className="p-3 text-gray-300 hover:text-rose-500 transition-all">
                                                <Trash className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* 3. 运行步骤 - 缩小主标题 */}
                    <div className="bg-purple-50/40 dark:bg-purple-900/10 p-6 sm:p-8 rounded-b-2xl border border-purple-100 dark:border-purple-900/30 shadow-sm space-y-6">
                        <div className="flex justify-between items-center">
                            <h2 className="text-lg font-black text-purple-700 dark:text-purple-300 flex items-center gap-3">
                                <Sparkles className="w-6 h-6" />
                                3. 运行步骤
                            </h2>
                            <button onClick={addStep} className="px-4 py-2 bg-purple-600 text-white font-bold rounded-xl flex items-center gap-2 transition-all hover:bg-purple-500 shadow-lg shadow-purple-500/20 text-xs">
                                <Plus className="w-4 h-4" /> 增加节点
                            </button>
                        </div>
                        
                        <div className="space-y-8 relative mt-4">
                            {steps.length > 0 && (
                                <>
                                    {steps.length > 1 && <div className="absolute left-6 top-8 bottom-8 w-0.5 bg-purple-100 dark:bg-purple-800 -z-10" />}
                                    {steps.map((step, index) => (
                                        <div key={step.id} className="relative pl-14 animate-fade-in">
                                            <div className="absolute left-2 top-0 w-8 h-8 rounded-full bg-purple-600 text-white flex items-center justify-center font-black text-sm shadow-xl ring-4 ring-white dark:ring-gray-900">
                                                {index + 1}
                                            </div>

                                            <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 space-y-5 shadow-sm">
                                                <div className="flex justify-between items-start gap-4 pb-3 border-b border-gray-50 dark:border-gray-700">
                                                    <input 
                                                        type="text"
                                                        value={step.name}
                                                        onChange={e => updateStep(index, 'name', e.target.value)}
                                                        className="bg-transparent text-gray-900 dark:text-white font-black text-base outline-none border-b border-transparent focus:border-purple-500 flex-1 transition-all"
                                                        placeholder="节点名称"
                                                    />
                                                    <div className="flex gap-2">
                                                        <button 
                                                            onClick={() => handleImportPrompt(index)}
                                                            className="px-3 py-1.5 bg-sky-50 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400 rounded-lg text-[10px] font-bold flex items-center gap-1.5 border border-sky-100 dark:border-sky-800 hover:bg-sky-100 transition-colors"
                                                        >
                                                            <Box className="w-3.5 h-3.5" /> 导入提示词
                                                        </button>
                                                        <button onClick={() => removeStep(index)} className="text-gray-300 hover:text-rose-500 transition-colors">
                                                            <Trash className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </div>

                                                <div className="space-y-3">
                                                    <div className="flex justify-between items-center px-1">
                                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">运行提示词 (Prompt)</label>
                                                    </div>
                                                    <textarea 
                                                        value={step.prompt}
                                                        onChange={e => updateStep(index, 'prompt', e.target.value)}
                                                        className="w-full p-4 h-36 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl focus:ring-2 focus:ring-purple-500 outline-none text-sm font-sans resize-none transition-all"
                                                        placeholder={`在这里编写 AI 运行逻辑。使用 \${变量名} 引用之前定义的字段内容。`}
                                                    />
                                                </div>

                                                <div className="flex items-center gap-4 bg-purple-50/50 dark:bg-purple-900/10 p-3 rounded-2xl border border-purple-100 dark:border-purple-800/50">
                                                    <DocumentText className="w-4 h-4 text-purple-500" />
                                                    <span className="text-[10px] text-purple-700 dark:text-purple-300 font-black uppercase tracking-wider">保存输出变量为:</span>
                                                    <input 
                                                        type="text"
                                                        value={step.outputVariable}
                                                        onChange={e => updateStep(index, 'outputVariable', e.target.value)}
                                                        className="bg-transparent text-xs font-mono text-purple-600 dark:text-purple-400 outline-none flex-1 font-bold"
                                                        placeholder="step_result"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="fixed bottom-0 left-0 right-0 bg-white/80 dark:bg-black/80 backdrop-blur-md border-t border-gray-100 dark:border-gray-800 p-4 z-40 flex justify-center">
                <div className="max-w-6xl w-full flex justify-end gap-4 px-4 sm:px-10">
                    <button onClick={onBack} className="px-6 py-2.5 text-xs text-gray-600 dark:text-gray-300 font-bold bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 transition-all">取消</button>
                    <button onClick={handleSave} className="px-10 py-2.5 bg-sky-600 text-white font-black rounded-xl hover:bg-sky-500 shadow-xl shadow-sky-500/20 transition-all text-sm flex items-center gap-2">
                        <Check className="w-4 h-4" /> 发布工作流
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CreateWorkflow;
