import React, { useState, useEffect } from 'react';
import { Workflow, PromptCategory, PromptSubCategory, WorkflowStep, WorkflowField, Prompt } from '../types';
import { ChevronDoubleLeft, Plus, Trash, Sparkles, InformationCircle, Bolt, Check, Box, DocumentText, ChevronUp, ChevronDown, Tag, X } from './Icon';
import { GENRE_TAGS } from '../constants';
import PromptSelectionModal from './PromptSelectionModal';

interface CreateWorkflowProps {
    onBack: () => void;
    onSave: (data: any) => void;
    workflowToEdit?: Workflow | null;
}

const CreateWorkflow: React.FC<CreateWorkflowProps> = ({ onBack, onSave, workflowToEdit }) => {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [type, setType] = useState<PromptCategory>('short-story');
    const [subCategories, setSubCategories] = useState<PromptSubCategory[]>([]);
    const [fields, setFields] = useState<WorkflowField[]>([]);
    const [steps, setSteps] = useState<WorkflowStep[]>([]);
    
    const [isPromptModalOpen, setPromptModalOpen] = useState(false);
    const [activeStepIndex, setActiveStepIndex] = useState<number | null>(null);

    useEffect(() => {
        if (workflowToEdit) {
            setName(workflowToEdit.title);
            setDescription(workflowToEdit.description);
            setType(workflowToEdit.category);
            setSubCategories(workflowToEdit.subCategories || []);
            setFields(workflowToEdit.fields || []);
            setSteps(workflowToEdit.steps || []);
        } else {
            // Default state
            setName('');
            setDescription('');
            setType('short-story');
            setSubCategories(['general']);
            setFields([{ id: 'field_1', label: '故事梗概', variable: 'synopsis', type: 'textarea', required: true }]);
            setSteps([{ id: 'step_1', name: '生成大纲', prompt: '请根据以下梗概生成大纲：${synopsis}', outputVariable: 'outline', manualConfirmation: false }]);
        }
    }, [workflowToEdit]);

    const handleSave = () => {
        if (!name.trim()) return alert('请输入工作流名称');
        if (steps.length === 0) return alert('请至少定义一个步骤');
        
        onSave({
            name,
            description,
            type,
            subCategories,
            fields,
            steps
        });
    };

    // Fields Management
    const addField = () => {
        const id = `field_${Date.now()}`;
        setFields([...fields, { id, label: '新字段', variable: `var_${fields.length + 1}`, type: 'text', required: true }]);
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

    // Steps Management
    const addStep = () => {
        const id = `step_${Date.now()}`;
        setSteps([...steps, { id, name: `步骤 ${steps.length + 1}`, prompt: '', outputVariable: `result_${steps.length + 1}`, manualConfirmation: false }]);
    };

    const updateStep = (index: number, key: keyof WorkflowStep, value: any) => {
        const newSteps = [...steps];
        // @ts-ignore
        newSteps[index][key] = value;
        setSteps(newSteps);
    };

    const removeStep = (index: number) => {
        setSteps(steps.filter((_, i) => i !== index));
    };

    const handleImportPrompt = (stepIndex: number) => {
        setActiveStepIndex(stepIndex);
        setPromptModalOpen(true);
    };

    const handlePromptSelect = (prompt: Prompt) => {
        if (activeStepIndex === null) return;
        
        const step = steps[activeStepIndex];
        const newSteps = [...steps];
        
        // Use prompt template content
        newSteps[activeStepIndex] = {
            ...step,
            prompt: prompt.template || prompt.content
        };
        setSteps(newSteps);

        // Add missing fields from prompt
        const newFields = [...fields];
        const existingVars = new Set(fields.map(f => f.variable));
        
        prompt.fields.forEach(pf => {
            if (!existingVars.has(pf.id)) {
                newFields.push({
                    id: `field_${Date.now()}_${pf.id}`,
                    label: pf.label,
                    variable: pf.id,
                    type: pf.type,
                    required: pf.required
                });
                existingVars.add(pf.id);
            }
        });
        setFields(newFields);
        setPromptModalOpen(false);
        setActiveStepIndex(null);
    };

    const toggleSubCategory = (tag: PromptSubCategory) => {
        setSubCategories(prev => {
            if (prev.includes(tag)) return prev.filter(t => t !== tag);
            if (prev.length >= 5) return prev;
            return [...prev, tag];
        });
    };

    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-black font-sans relative">
            {isPromptModalOpen && (
                <PromptSelectionModal 
                    isOpen={isPromptModalOpen} 
                    onClose={() => setPromptModalOpen(false)} 
                    onSelect={handlePromptSelect} 
                />
            )}

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors text-gray-500">
                        <ChevronDoubleLeft className="w-5 h-5" />
                    </button>
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white">{workflowToEdit ? '编辑工作流' : '创建工作流'}</h1>
                </div>
                <button onClick={handleSave} className="px-6 py-2 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-500 transition-colors shadow-lg shadow-blue-500/20">
                    保存工作流
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8">
                {/* 1. Basic Info */}
                <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 space-y-6 shadow-sm">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <InformationCircle className="w-5 h-5 text-blue-500" /> 1. 基本信息
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-gray-600 dark:text-gray-300">名称</label>
                            <input value={name} onChange={e => setName(e.target.value)} type="text" className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all" placeholder="给工作流起个名字..." />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-gray-600 dark:text-gray-300">分类</label>
                            <select value={type} onChange={e => setType(e.target.value as PromptCategory)} className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all">
                                <option value="short-story">短篇小说</option>
                                <option value="long-story">长篇小说</option>
                                <option value="script">剧本</option>
                                <option value="general">通用</option>
                            </select>
                        </div>
                        <div className="col-span-full space-y-2">
                            <label className="text-sm font-bold text-gray-600 dark:text-gray-300">描述</label>
                            <textarea value={description} onChange={e => setDescription(e.target.value)} className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all h-20 resize-none" placeholder="简单描述这个工作流的用途..." />
                        </div>
                        <div className="col-span-full space-y-2">
                            <label className="text-sm font-bold text-gray-600 dark:text-gray-300 flex items-center gap-2"><Tag className="w-4 h-4"/> 标签</label>
                            <div className="flex flex-wrap gap-2">
                                {GENRE_TAGS.map(tag => (
                                    <button key={tag.id} onClick={() => toggleSubCategory(tag.id)} className={`px-3 py-1.5 text-xs rounded-lg border transition-all ${subCategories.includes(tag.id) ? 'bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-900/30 dark:text-purple-300' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500'}`}>
                                        {tag.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. Input Fields */}
                <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 space-y-6 shadow-sm">
                    <div className="flex justify-between items-center">
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <DocumentText className="w-5 h-5 text-green-500" /> 2. 输入表单定义
                        </h2>
                        <button onClick={addField} className="px-3 py-1.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-xs font-bold rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors flex items-center gap-1">
                            <Plus className="w-3 h-3" /> 添加字段
                        </button>
                    </div>
                    <div className="space-y-3">
                        {fields.map((field, index) => (
                            <div key={field.id} className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-800 group">
                                <span className="text-xs font-bold text-gray-400 w-6">#{index+1}</span>
                                <div className="flex-1 grid grid-cols-3 gap-4">
                                    <input type="text" value={field.label} onChange={e => updateField(index, 'label', e.target.value)} className="bg-transparent border-b border-gray-300 dark:border-gray-700 focus:border-blue-500 outline-none text-sm px-1 py-1" placeholder="显示名称" />
                                    <input type="text" value={field.variable} onChange={e => updateField(index, 'variable', e.target.value)} className="bg-transparent border-b border-gray-300 dark:border-gray-700 focus:border-blue-500 outline-none text-sm px-1 py-1 font-mono text-purple-500" placeholder="变量名 (如: topic)" />
                                    <select value={field.type} onChange={e => updateField(index, 'type', e.target.value)} className="bg-transparent border-b border-gray-300 dark:border-gray-700 focus:border-blue-500 outline-none text-sm px-1 py-1 cursor-pointer">
                                        <option value="text">单行文本</option>
                                        <option value="textarea">多行文本</option>
                                    </select>
                                </div>
                                <button onClick={() => removeField(index)} className="p-2 text-gray-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100">
                                    <Trash className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                        {fields.length === 0 && <div className="text-center py-4 text-gray-400 text-sm">暂无输入字段，请添加</div>}
                    </div>
                </div>

                {/* 3. Execution Steps */}
                <div className="bg-purple-50/40 dark:bg-purple-900/10 p-8 rounded-3xl border border-purple-100 dark:border-purple-900/30 space-y-6 shadow-sm">
                    <div className="flex justify-between items-center">
                        <h2 className="text-lg font-black text-purple-700 dark:text-purple-300 flex items-center gap-3">
                            <Sparkles className="w-5 h-5" /> 3. 运行步骤配置
                        </h2>
                        <button onClick={addStep} className="px-4 py-2 bg-purple-600 text-white font-bold rounded-xl flex items-center gap-2 hover:bg-purple-500 transition-all text-xs shadow-lg shadow-purple-500/20">
                            <Plus className="w-4 h-4" /> 增加步骤
                        </button>
                    </div>

                    <div className="flex flex-col gap-3">
                        <div className="px-4 py-3 bg-white/60 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800 rounded-xl flex items-start gap-3 shadow-sm">
                            <InformationCircle className="w-5 h-5 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" />
                            <div className="text-sm text-purple-800 dark:text-purple-200 leading-relaxed font-medium">
                                <span className="font-black bg-purple-100 dark:bg-purple-800 text-purple-700 dark:text-purple-300 px-1.5 py-0.5 rounded mr-1">提示</span>
                                在 Prompt 中使用 <code>${`{变量名}`}</code> 引用上方定义的字段。
                            </div>
                        </div>
                        <div className="px-4 py-3 bg-white/60 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800 rounded-xl flex items-start gap-3 shadow-sm">
                            <Bolt className="w-5 h-5 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" />
                            <div className="text-sm text-purple-800 dark:text-purple-200 leading-relaxed font-medium">
                                <span className="font-black bg-purple-100 dark:bg-purple-800 text-purple-700 dark:text-purple-300 px-1.5 py-0.5 rounded mr-1">引用</span>
                                后续步骤可以引用前序步骤的输出，使用 <code>${`{输出变量名}`}</code>。
                            </div>
                        </div>
                    </div>
                    
                    <div className="space-y-6 relative mt-4">
                        {steps.map((step, index) => (
                            <div key={step.id} className="relative pl-12">
                                <div className="absolute left-0 top-0 w-8 h-8 rounded-full bg-purple-600 text-white flex items-center justify-center font-black text-sm shadow-xl z-10">{index + 1}</div>
                                {index < steps.length - 1 && <div className="absolute left-4 top-8 bottom-[-24px] w-0.5 bg-purple-100 dark:bg-purple-800"></div>}
                                
                                <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 space-y-4 shadow-sm relative group">
                                    <div className="flex justify-between items-center border-b border-gray-50 dark:border-gray-700 pb-3">
                                        <input type="text" value={step.name} onChange={e => updateStep(index, 'name', e.target.value)} className="bg-transparent font-black text-gray-900 dark:text-white outline-none border-b border-transparent focus:border-purple-500 transition-all flex-1 text-base" placeholder="步骤名称..." />
                                        <div className="flex gap-2 items-center">
                                            <div className="flex items-center gap-2 mr-2">
                                                <label className="text-[10px] font-bold text-gray-400 uppercase cursor-pointer select-none" htmlFor={`manual-${step.id}`}>
                                                    生成后暂停
                                                </label>
                                                <div 
                                                    className={`w-8 h-4 rounded-full p-0.5 cursor-pointer transition-colors ${step.manualConfirmation ? 'bg-purple-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                                                    onClick={() => updateStep(index, 'manualConfirmation', !step.manualConfirmation)}
                                                    id={`manual-${step.id}`}
                                                >
                                                    <div className={`w-3 h-3 bg-white rounded-full shadow-sm transition-transform ${step.manualConfirmation ? 'translate-x-4' : 'translate-x-0'}`} />
                                                </div>
                                            </div>
                                            <button 
                                                onClick={() => handleImportPrompt(index)} 
                                                className="px-4 py-2 bg-white dark:bg-gray-800 text-purple-600 dark:text-purple-400 rounded-xl text-xs font-bold border border-purple-200 dark:border-purple-700 hover:bg-purple-50 dark:hover:bg-purple-900/30 flex items-center gap-2 shadow-sm transition-all"
                                            >
                                                <Box className="w-4 h-4" /> 
                                                使用提示词模板
                                            </button>
                                            <button onClick={() => removeStep(index)} className="p-2 text-gray-300 hover:text-rose-500"><Trash className="w-4 h-4" /></button>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">运行 Prompt (提示词内容)</label>
                                        <textarea 
                                            value={step.prompt} 
                                            onChange={e => updateStep(index, 'prompt', e.target.value)} 
                                            className="w-full p-4 h-72 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-purple-500 outline-none text-base font-medium resize-y transition-all shadow-inner" 
                                            placeholder="输入 AI 指令，使用 ${变量名} 引用上文或表单变量..." 
                                        />
                                    </div>

                                    <div className="flex items-center gap-4 bg-purple-50/50 dark:bg-purple-900/10 p-3 rounded-2xl border border-purple-100/50">
                                        <DocumentText className="w-4 h-4 text-purple-400" />
                                        <span className="text-xs text-purple-700 dark:text-purple-300 font-bold uppercase">保存结果到变量:</span>
                                        <input type="text" value={step.outputVariable} onChange={e => updateStep(index, 'outputVariable', e.target.value)} className="bg-transparent text-sm font-mono text-purple-600 dark:text-purple-400 outline-none flex-1 font-bold" placeholder="step_result" />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CreateWorkflow;