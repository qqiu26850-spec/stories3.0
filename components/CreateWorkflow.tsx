
import React, { useState, useEffect, useRef } from 'react';
import { Plus, Trash, Sparkles, ChevronDown, ChevronUp, InformationCircle, Bolt, DocumentText, X, Check, ChevronLeft, Tag, Box, Stop, ArrowPath } from './Icon';
import { WorkflowField, WorkflowStep, Workflow, PromptSubCategory, Prompt } from '../types';
import { GENRE_TAGS } from '../constants';
import PromptSelectionModal from './PromptSelectionModal';
import { generateTextStream } from '../services/geminiService';
import MarkdownToolbar, { handleListKeyDown } from './MarkdownToolbar';

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

    const [isPromptModalOpen, setPromptModalOpen] = useState(false);
    const [activeStepIndex, setActiveStepIndex] = useState<number | null>(null);

    // Polish Feature State
    const [polishingStepIndex, setPolishingStepIndex] = useState<number | null>(null);
    const [polishRequirement, setPolishRequirement] = useState('');
    const [isPolishing, setIsPolishing] = useState(false);
    const abortControllerRef = useRef<AbortController | null>(null);

    useEffect(() => {
        if (workflowToEdit) {
            setName(workflowToEdit.title);
            setType(workflowToEdit.category);
            setDescription(workflowToEdit.description);
            setSubCategories(workflowToEdit.subCategories || []);
            setFields(workflowToEdit.fields || []);
            setSteps(workflowToEdit.steps || []);
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
        const newFields = [...fields];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= newFields.length) return;
        const [temp] = newFields.splice(index, 1);
        newFields.splice(targetIndex, 0, temp);
        setFields(newFields);
    };

    const addStep = () => {
        const stepNum = steps.length + 1;
        setSteps([...steps, { 
            id: `step_${Date.now()}`, 
            name: `第${stepNum}步：新处理环节`, 
            prompt: '', 
            outputVariable: `result_${stepNum}`,
            manualConfirmation: false 
        }]);
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

    const handleImportPrompt = (index: number) => {
        setActiveStepIndex(index);
        setPromptModalOpen(true);
    };

    const onSelectPromptTemplate = (prompt: Prompt) => {
        if (activeStepIndex !== null) {
            const newSteps = [...steps];
            newSteps[activeStepIndex].prompt = prompt.template || prompt.content;
            if (newSteps[activeStepIndex].name.includes('新处理环节')) {
                newSteps[activeStepIndex].name = `第${activeStepIndex + 1}步：${prompt.title}`;
            }
            setSteps(newSteps);

            // Import fields from prompt to workflow input form - ONLY for Step 1
            if (activeStepIndex === 0 && prompt.fields && prompt.fields.length > 0) {
                const existingVars = new Set(fields.map(f => f.variable));
                const newFields: WorkflowField[] = [];
                
                prompt.fields.forEach(pf => {
                    // Avoid duplicate variables to prevent conflicts
                    if (!existingVars.has(pf.id)) {
                        newFields.push({
                            id: `field_${Date.now()}_${Math.random().toString(36).substr(2,5)}`,
                            label: pf.label,
                            variable: pf.id,
                            type: pf.type,
                            required: pf.required,
                            description: pf.description,
                            maxLength: pf.maxLength
                        });
                        existingVars.add(pf.id);
                    }
                });

                if (newFields.length > 0) {
                    setFields(prev => [...prev, ...newFields]);
                }
            }
        }
        setPromptModalOpen(false);
    };

    const handlePolishStep = async (index: number) => {
        const currentPrompt = steps[index].prompt;
        if (!currentPrompt.trim()) {
            alert('请先填写提示词内容');
            return;
        }

        setIsPolishing(true);
        const controller = new AbortController();
        abortControllerRef.current = controller;

        const polishPrompt = `你是一个专业的 Prompt Engineer。请根据以下要求润色用户的提示词模板。
        
        【原始提示词】：
        ${currentPrompt}

        【润色要求】：
        ${polishRequirement || '请优化语言表达，使其更加精准、逻辑更清晰，适合大语言模型理解。'}

        请直接输出润色后的内容（Markdown格式），不需要包含开场白或结束语。`;

        try {
            const stream = generateTextStream(polishPrompt, {
                model: 'deepseek-chat',
                temperature: 0.7,
                topP: 0.9,
                signal: controller.signal
            });

            let newContent = '';
            for await (const chunk of stream) {
                newContent += chunk;
                // Live update the prompt content
                updateStep(index, 'prompt', newContent);
            }
        } catch (e: any) {
            if (e.message !== 'Aborted') {
                console.error("Polish failed", e);
            }
        } finally {
            setIsPolishing(false);
            setPolishingStepIndex(null);
            setPolishRequirement('');
            abortControllerRef.current = null;
        }
    };

    const stopPolishing = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
        setIsPolishing(false);
        setPolishingStepIndex(null);
    };

    const handleSave = () => {
        if (!name.trim()) { alert('请输入名称'); return; }
        if (steps.length === 0) { alert('请至少添加一个运行步骤'); return; }
        onSave({ name, type, description, subCategories, fields, steps });
    };

    return (
        <div className="p-0 animate-fade-in bg-gray-50 dark:bg-black min-h-full flex flex-col font-sans pb-32">
            <PromptSelectionModal isOpen={isPromptModalOpen} onClose={() => setPromptModalOpen(false)} onSelect={onSelectPromptTemplate} />

            <div className="max-w-6xl mx-auto w-full flex-1">
                {/* 顶部栏 */}
                <div className="flex justify-between items-center bg-blue-50/80 dark:bg-blue-900/10 p-6 rounded-t-3xl border-x border-t border-blue-100 dark:border-blue-900/30">
                    <div className="flex items-center gap-4">
                        <div className="p-2.5 bg-blue-100 dark:bg-blue-900/40 rounded-xl text-blue-600 dark:text-blue-300 shadow-inner">
                             <Sparkles className="w-6 h-6" />
                        </div>
                        <div>
                            <h1 className="text-xl font-black text-gray-900 dark:text-white tracking-tight">{workflowToEdit ? '修改工作流' : '创建新工作流'}</h1>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">创建工作流所需步骤：设定基础、定义表单与链式逻辑</p>
                        </div>
                    </div>
                    <button onClick={onBack} className="px-4 py-2 text-xs text-gray-600 dark:text-gray-300 font-bold bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-100 flex items-center gap-2 shadow-sm">
                        <ChevronLeft className="w-4 h-4" /> 返回
                    </button>
                </div>

                <div className="flex flex-col gap-8">
                    {/* 1. 工作流基本设定 */}
                    <div className="bg-blue-50/40 dark:bg-blue-900/10 p-8 rounded-b-3xl border-x border-b border-blue-100 dark:border-blue-900/30 space-y-6 shadow-sm">
                        <h2 className="text-lg font-black text-blue-700 dark:text-blue-300 flex items-center gap-3">
                            <InformationCircle className="w-5 h-5" /> 1. 基本设定
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest ml-1">工作流名称</label>
                                <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="如：三幕式电影剧本生成器" className="w-full p-3.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-sky-500 outline-none transition text-sm font-medium" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest ml-1">主要创作分类</label>
                                <select value={type} onChange={e => setType(e.target.value)} className="w-full p-3.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-sky-500 outline-none text-sm font-medium cursor-pointer">
                                    <option value="short-story">短篇小说</option>
                                    <option value="long-story">长篇小说</option>
                                    <option value="script">影视剧本</option>
                                    <option value="general">全类型/通用</option>
                                </select>
                            </div>
                            <div className="md:col-span-2 space-y-4">
                                <h4 className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest ml-1">题材标签 (最多选5个)</h4>
                                <div className="flex flex-wrap gap-2">
                                    {GENRE_TAGS.filter(t => t.id !== 'all').map(tag => (
                                        <button key={tag.id} type="button" onClick={() => setSubCategories(prev => prev.includes(tag.id as any) ? prev.filter(t => t !== tag.id) : [...prev, tag.id as any])} className={`px-4 py-1.5 text-xs font-medium rounded-full border transition-all ${subCategories.includes(tag.id as any) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-gray-800 text-gray-500 border-gray-200 hover:border-blue-400'}`}>{tag.label}</button>
                                    ))}
                                </div>
                            </div>
                            <div className="md:col-span-2 space-y-2">
                                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest ml-1">工作流描述</label>
                                <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="详细描述该链路的功能逻辑..." className="w-full p-3.5 h-24 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-sky-500 outline-none transition resize-none text-sm font-medium shadow-inner" />
                            </div>
                        </div>
                    </div>

                    {/* 2. 运行步骤 */}
                    <div className="bg-purple-50/40 dark:bg-purple-900/10 p-8 rounded-3xl border border-purple-100 dark:border-purple-900/30 space-y-6 shadow-sm">
                        <div className="flex justify-between items-center">
                            <h2 className="text-lg font-black text-purple-700 dark:text-purple-300 flex items-center gap-3">
                                <Sparkles className="w-5 h-5" /> 2. 运行步骤配置
                            </h2>
                            <button onClick={addStep} className="px-4 py-2 bg-purple-600 text-white font-bold rounded-xl flex items-center gap-2 hover:bg-purple-500 transition-all text-xs shadow-lg shadow-purple-500/20">
                                <Plus className="w-4 h-4" /> 增加步骤
                            </button>
                        </div>

                        <div className="px-5 py-4 bg-white/60 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800 rounded-xl space-y-3 shadow-sm">
                            <div className="flex items-start gap-3">
                                <InformationCircle className="w-5 h-5 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" />
                                <div className="text-sm text-purple-800 dark:text-purple-200 leading-relaxed font-medium">
                                    <span className="font-black bg-purple-100 dark:bg-purple-800 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded-md mr-1 text-xs align-text-top">提示 1</span>
                                    在<strong>第1步</strong>中使用“提示词模板”时，系统会自动将模板中的参数同步到下方的【输入表单定义】中，方便用户填写。后续步骤引用模板则不会修改表单。
                                </div>
                            </div>
                            <div className="flex items-start gap-3 border-t border-purple-200/50 dark:border-purple-800/50 pt-3">
                                <InformationCircle className="w-5 h-5 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" />
                                <div className="text-sm text-purple-800 dark:text-purple-200 leading-relaxed font-medium">
                                    <span className="font-black bg-purple-100 dark:bg-purple-800 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded-md mr-1 text-xs align-text-top">提示 2</span>
                                    上一个步骤生成的<strong>结果</strong>（即下方定义的“输出变量名”），可以在下一个步骤的 Prompt 中通过 <code>{'${变量名}'}</code> 引用，实现内容的链式生成。
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
                                            <input type="text" value={step.name} onChange={e => updateStep(index, 'name', e.target.value)} className="bg-transparent font-black text-gray-900 dark:text-white outline-none border-b border-transparent focus:border-purple-500 transition-all flex-1 text-base mr-4" placeholder="请输入步骤名称..." />
                                            <div className="flex gap-2 items-center flex-wrap">
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
                                                    className="px-3 py-1.5 bg-white dark:bg-gray-800 text-purple-600 dark:text-purple-400 rounded-lg text-xs font-bold border border-purple-200 dark:border-purple-700 hover:bg-purple-50 dark:hover:bg-purple-900/30 flex items-center gap-1 shadow-sm transition-all whitespace-nowrap"
                                                >
                                                    <Box className="w-3.5 h-3.5" /> 
                                                    使用提示词模板
                                                </button>
                                                <button 
                                                    onClick={() => setPolishingStepIndex(polishingStepIndex === index ? null : index)}
                                                    className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all flex items-center gap-1 whitespace-nowrap ${polishingStepIndex === index ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-purple-600 border-purple-200 hover:bg-purple-50'}`}
                                                >
                                                    <Sparkles className="w-3.5 h-3.5" />
                                                    {polishingStepIndex === index ? '关闭润色' : '润色提示词'}
                                                </button>
                                                <button onClick={() => setSteps(steps.filter((_, i) => i !== index))} className="p-2 text-gray-300 hover:text-rose-500 ml-1"><Trash className="w-4 h-4" /></button>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            {polishingStepIndex === index && (
                                                <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-100 dark:border-purple-800 mb-2 animate-fade-in flex gap-2">
                                                    <input 
                                                        type="text"
                                                        value={polishRequirement}
                                                        onChange={e => setPolishRequirement(e.target.value)}
                                                        placeholder="请输入润色要求，例如：使其逻辑更严密..."
                                                        className="flex-1 px-3 py-1.5 text-xs border border-purple-200 rounded-lg outline-none focus:ring-1 focus:ring-purple-500"
                                                    />
                                                    {isPolishing ? (
                                                        <button onClick={stopPolishing} className="px-3 py-1.5 bg-red-500 text-white text-xs rounded-lg hover:bg-red-600 flex items-center gap-1"><Stop className="w-3 h-3"/>停止</button>
                                                    ) : (
                                                        <button onClick={() => handlePolishStep(index)} className="px-3 py-1.5 bg-purple-600 text-white text-xs rounded-lg hover:bg-purple-500 flex items-center gap-1"><ArrowPath className="w-3 h-3"/>开始润色</button>
                                                    )}
                                                </div>
                                            )}

                                            <div className="relative rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                                                <div className="absolute top-2 right-2 z-10 opacity-30 text-[10px] pointer-events-none font-bold text-gray-400 uppercase">PROMPT</div>
                                                <MarkdownToolbar textareaId={`step-prompt-${index}`} onInsert={(val) => updateStep(index, 'prompt', val)} />
                                                <textarea 
                                                    id={`step-prompt-${index}`}
                                                    value={step.prompt} 
                                                    onChange={e => updateStep(index, 'prompt', e.target.value)} 
                                                    onKeyDown={(e) => handleListKeyDown(e, step.prompt, (val) => updateStep(index, 'prompt', val))}
                                                    className="w-full p-4 h-72 bg-gray-50 dark:bg-gray-900 text-sm font-medium resize-y focus:outline-none shadow-inner" 
                                                    placeholder="请输入 AI 指令，使用 ${变量名} 引用上文或表单变量..." 
                                                />
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-4 bg-purple-50/50 dark:bg-purple-900/10 p-3 rounded-2xl border border-purple-100/50">
                                            <DocumentText className="w-4 h-4 text-purple-400" />
                                            <span className="text-xs text-purple-700 dark:text-purple-300 font-bold uppercase">保存结果到变量:</span>
                                            <input type="text" value={step.outputVariable} onChange={e => updateStep(index, 'outputVariable', e.target.value)} className="bg-transparent text-sm font-mono text-purple-600 dark:text-purple-400 outline-none flex-1 font-bold" placeholder="请输入变量名..." />
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {steps.length === 0 && <div className="text-center py-16 text-gray-400 flex flex-col items-center gap-4 bg-white dark:bg-gray-900 rounded-3xl border border-dashed"><Sparkles className="w-12 h-12 opacity-10" /><p className="text-sm font-medium">尚未定义任何运行步骤，点击右上方“增加步骤”开始构建链路</p></div>}
                            
                            {/* Continue Adding Button */}
                            {steps.length > 0 && (
                                <div className="pl-12 mt-4">
                                    <button 
                                        onClick={addStep} 
                                        className="w-full py-4 border-2 border-dashed border-purple-200 dark:border-purple-800 rounded-2xl text-purple-500 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 hover:border-purple-300 transition-all font-bold flex items-center justify-center gap-2 group"
                                    >
                                        <Plus className="w-5 h-5 transition-transform group-hover:scale-110" />
                                        继续添加步骤
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 3. 输入表单定义 - Refined UI for Single/Multi line & Word Limit */}
                    <div className="bg-blue-50/40 dark:bg-blue-900/10 p-8 rounded-3xl border border-blue-100 dark:border-blue-900/30 space-y-6 shadow-sm">
                        <div className="flex justify-between items-center">
                            <h2 className="text-lg font-black text-blue-700 dark:text-blue-300 flex items-center gap-3">
                                <Bolt className="w-5 h-5" /> 3. 输入表单定义
                            </h2>
                            <button onClick={addField} className="px-4 py-2 bg-blue-600 text-white font-bold rounded-xl flex items-center gap-2 hover:bg-blue-500 transition-all text-xs shadow-lg shadow-blue-500/20">
                                <Plus className="w-4 h-4" /> 添加字段
                            </button>
                        </div>
                        <div className="space-y-4">
                            {fields.length === 0 ? (
                                <div className="text-center py-10 text-gray-400 text-sm italic border-2 border-dashed border-blue-200 dark:border-blue-900/50 rounded-2xl">请添加字段以获取用户输入的初始参数</div>
                            ) : (
                                fields.map((field, index) => (
                                    <div key={field.id} className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4 relative group hover:border-blue-300 transition-colors">
                                        {/* Controls */}
                                        <div className="absolute right-4 top-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => moveField(index, 'up')} disabled={index === 0} className="p-1.5 bg-gray-50 dark:bg-gray-700 rounded-lg text-gray-400 hover:text-sky-500 disabled:opacity-30"><ChevronUp className="w-4 h-4" /></button>
                                            <button onClick={() => moveField(index, 'down')} disabled={index === fields.length - 1} className="p-1.5 bg-gray-50 dark:bg-gray-700 rounded-lg text-gray-400 hover:text-sky-500 disabled:opacity-30"><ChevronDown className="w-4 h-4" /></button>
                                            <button onClick={() => removeField(index)} className="p-1.5 bg-red-50 dark:bg-red-900/20 rounded-lg text-red-400 hover:text-red-600"><Trash className="w-4 h-4" /></button>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pr-20">
                                            {/* Basic Info */}
                                            <div className="space-y-4">
                                                <div className="space-y-1.5">
                                                    <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase">显示名称</label>
                                                    <input type="text" value={field.label} onChange={e => updateField(index, 'label', e.target.value)} className="w-full p-2.5 text-sm font-medium bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-1 focus:ring-blue-500" placeholder="例如：主角性格" />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase">变量名 (ID)</label>
                                                    <input type="text" value={field.variable} onChange={e => updateField(index, 'variable', e.target.value)} className="w-full p-2.5 text-sm font-medium bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl outline-none font-mono focus:ring-1 focus:ring-blue-500" placeholder="例如：trait" />
                                                </div>
                                            </div>

                                            {/* Configuration Options */}
                                            <div className="space-y-4 bg-gray-50/50 dark:bg-gray-900/30 p-3 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div className="space-y-1.5">
                                                        <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase">输入类型</label>
                                                        <select 
                                                            value={field.type} 
                                                            onChange={e => updateField(index, 'type', e.target.value)} 
                                                            className="w-full p-2 text-xs font-bold bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                                                        >
                                                            <option value="text">单行文本</option>
                                                            <option value="textarea">多行文本</option>
                                                        </select>
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase">字数上限 (选填)</label>
                                                        <input 
                                                            type="number" 
                                                            value={field.maxLength || ''} 
                                                            onChange={e => updateField(index, 'maxLength', e.target.value ? parseInt(e.target.value) : undefined)} 
                                                            placeholder="无限制" 
                                                            className="w-full p-2 text-xs font-bold bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg outline-none focus:ring-1 focus:ring-blue-500" 
                                                        />
                                                    </div>
                                                </div>
                                                
                                                <div className="flex items-center gap-4 pt-1">
                                                    <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase">是否必填:</label>
                                                    <div className="flex items-center gap-4">
                                                        <label className="flex items-center gap-1.5 cursor-pointer">
                                                            <input 
                                                                type="radio" 
                                                                checked={field.required !== false} 
                                                                onChange={() => updateField(index, 'required', true)} 
                                                                className="accent-blue-500" 
                                                            />
                                                            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">是</span>
                                                        </label>
                                                        <label className="flex items-center gap-1.5 cursor-pointer">
                                                            <input 
                                                                type="radio" 
                                                                checked={field.required === false} 
                                                                onChange={() => updateField(index, 'required', false)} 
                                                                className="accent-blue-500" 
                                                            />
                                                            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">否</span>
                                                        </label>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div className="space-y-1.5 w-full">
                                            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">补充说明</label>
                                            <input 
                                                type="text" 
                                                value={field.description || ''} 
                                                onChange={e => updateField(index, 'description', e.target.value)} 
                                                className="w-full p-2.5 text-sm font-medium bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-1 focus:ring-blue-500" 
                                                placeholder="例如：请输入用户的具体要求，越详细越好..." 
                                            />
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="fixed bottom-0 left-0 right-0 bg-white/80 dark:bg-black/80 backdrop-blur-md border-t border-gray-100 dark:border-gray-800 p-4 z-40">
                <div className="max-w-6xl mx-auto flex justify-end gap-4 px-6">
                    <button onClick={onBack} className="px-6 py-2.5 text-xs text-gray-600 dark:text-gray-300 font-bold bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50">取消</button>
                    <button onClick={handleSave} className="px-10 py-2.5 bg-sky-600 text-white font-black rounded-xl hover:bg-sky-500 shadow-xl shadow-sky-500/20 text-sm flex items-center gap-2 active:scale-95 transition-all">
                        <Check className="w-4 h-4" /> 保存并发布
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CreateWorkflow;
