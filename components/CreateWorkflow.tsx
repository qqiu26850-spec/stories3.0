
import React, { useState, useEffect } from 'react';
import { Plus, Trash, Sparkles, ChevronDown, ChevronUp, InformationCircle, Bolt, DocumentText, X, Check } from './Icon';
import { WorkflowField, WorkflowStep, Workflow } from '../types';

interface CreateWorkflowProps {
    onBack: () => void;
    onSave: (data: any) => void;
    workflowToEdit?: Workflow | null;
}

const CreateWorkflow: React.FC<CreateWorkflowProps> = ({ onBack, onSave, workflowToEdit }) => {
    const [name, setName] = useState('');
    const [type, setType] = useState('short-story');
    const [description, setDescription] = useState('');
    const [fields, setFields] = useState<WorkflowField[]>([]);
    const [steps, setSteps] = useState<WorkflowStep[]>([
        { id: 'step_1', name: '第一步：生成初步想法', prompt: '请根据用户提供的关键词 ${keywords}，生成三个有趣的故事创意。', outputVariable: 'ideas' }
    ]);

    useEffect(() => {
        if (workflowToEdit) {
            setName(workflowToEdit.title);
            setType(workflowToEdit.category);
            setDescription(workflowToEdit.description);
            setFields(workflowToEdit.fields || []);
            setSteps(workflowToEdit.steps || []);
        }
    }, [workflowToEdit]);

    const addField = () => {
        setFields([...fields, { id: `field_${Date.now()}`, label: '', variable: '', type: 'text' }]);
    };

    const updateField = (index: number, key: keyof WorkflowField, value: string) => {
        const newFields = [...fields];
        // @ts-ignore
        newFields[index][key] = value;
        setFields(newFields);
    };

    const removeField = (index: number) => {
        setFields(fields.filter((_, i) => i !== index));
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

    const handleSave = () => {
        if (!name.trim()) { alert('请输入工作流名称'); return; }
        if (fields.length > 0 && fields.some(f => !f.variable || !f.label)) { alert('请完善表单字段定义'); return; }
        if (steps.length === 0) { alert('工作流至少需要一个 AI 处理步骤'); return; }
        
        onSave({ name, type, description, fields, steps });
    };

    return (
        <div className="p-4 sm:p-6 lg:p-8 animate-fade-in bg-gray-50 dark:bg-black min-h-full flex flex-col font-sans">
            <div className="max-w-5xl mx-auto w-full flex-1 flex flex-col">
                <button onClick={onBack} className="mb-6 flex items-center text-gray-500 hover:text-sky-600 transition-colors text-sm font-bold w-fit group">
                    <span className="mr-1 group-hover:-translate-x-1 transition-transform">←</span> 返回列表
                </button>

                <div className="flex justify-between items-end mb-8">
                    <div>
                        <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">{workflowToEdit ? '编辑工作流' : '创建工作流'}</h1>
                        <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">定义您的生产链条，让 AI 按照特定的逻辑步骤为您创作。</p>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={onBack} className="px-6 py-2.5 text-gray-600 dark:text-gray-300 font-bold bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl hover:bg-gray-50 transition-all">取消</button>
                        <button onClick={handleSave} className="px-8 py-2.5 bg-sky-600 text-white font-black rounded-xl hover:bg-sky-500 shadow-lg shadow-sky-500/20 transition-all active:scale-95 flex items-center gap-2">
                             <Check className="w-4 h-4" />
                             保存发布
                        </button>
                    </div>
                </div>

                <div className="space-y-8 flex-1 pb-20">
                    {/* 1. 基本信息 - 蓝色块 */}
                    <div className="bg-blue-50/40 dark:bg-blue-900/10 p-8 rounded-3xl border border-blue-100 dark:border-blue-900/30 shadow-sm space-y-6">
                        <h2 className="text-sm font-bold text-blue-600 flex items-center gap-2">
                            <InformationCircle className="w-5 h-5" />
                            第一步：设置工作流概览
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">工作流名称</label>
                                <input 
                                    type="text" 
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    placeholder="如：三幕式小说生成器"
                                    className="w-full p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-sky-500 outline-none transition text-sm shadow-sm"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">适用创作分类</label>
                                <div className="relative">
                                    <select 
                                        value={type}
                                        onChange={e => setType(e.target.value)}
                                        className="w-full p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-sky-500 outline-none transition text-sm appearance-none cursor-pointer shadow-sm"
                                    >
                                        <option value="short-story">短篇小说</option>
                                        <option value="long-story">长篇小说</option>
                                        <option value="script">影视剧本</option>
                                        <option value="general">通用任务</option>
                                    </select>
                                    <ChevronDown className="w-4 h-4 absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                                </div>
                            </div>
                            <div className="md:col-span-2 space-y-1.5">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">简介与用途说明</label>
                                <textarea 
                                    value={description}
                                    onChange={e => setDescription(e.target.value)}
                                    placeholder="简单描述这个工作流能解决什么问题，产出什么样的内容..."
                                    className="w-full p-4 h-24 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-sky-500 outline-none transition resize-none text-sm shadow-sm"
                                />
                            </div>
                        </div>
                    </div>

                    {/* 2. 用户输入表单定义 - 琥珀色块 */}
                    <div className="bg-amber-50/40 dark:bg-amber-900/10 p-8 rounded-3xl border border-amber-100 dark:border-amber-900/30 shadow-sm space-y-6">
                        <div className="flex justify-between items-center">
                            <h2 className="text-sm font-bold text-amber-600 flex items-center gap-2">
                                <Bolt className="w-5 h-5" />
                                第二步：定义运行参数 (表单字段)
                            </h2>
                            <button onClick={addField} className="px-3 py-1.5 bg-amber-600 text-white text-xs font-black rounded-lg flex items-center gap-1.5 transition-all hover:bg-amber-500 shadow-md shadow-amber-500/20">
                                <Plus className="w-3.5 h-3.5" /> 添加输入项
                            </button>
                        </div>
                        <div className="space-y-3">
                            {fields.length === 0 ? (
                                <div className="text-center py-12 bg-white/50 dark:bg-black/20 rounded-2xl border-2 border-dashed border-amber-200 dark:border-amber-900/50 text-gray-400 text-xs italic">
                                    尚未添加输入字段。点击右上方按钮，定义运行者需要填写的表单内容。
                                </div>
                            ) : (
                                fields.map((field, index) => (
                                    <div key={field.id} className="flex flex-col md:flex-row gap-4 items-end bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 animate-fade-in group shadow-sm">
                                        <div className="flex-1 w-full space-y-1.5">
                                            <label className="text-[10px] font-black text-gray-400 uppercase">表单显示名称</label>
                                            <input 
                                                type="text" 
                                                value={field.label}
                                                onChange={e => updateField(index, 'label', e.target.value)}
                                                className="w-full p-3 text-xs bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-1 focus:ring-amber-500 transition-all"
                                                placeholder="如：故事核心关键词"
                                            />
                                        </div>
                                        <div className="flex-1 w-full space-y-1.5">
                                            <label className="text-[10px] font-black text-gray-400 uppercase">变量名 (Prompt 引用)</label>
                                            <input 
                                                type="text" 
                                                value={field.variable}
                                                onChange={e => updateField(index, 'variable', e.target.value)}
                                                className="w-full p-3 text-xs bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl font-mono outline-none focus:ring-1 focus:ring-amber-500 transition-all"
                                                placeholder="如：keywords"
                                            />
                                        </div>
                                        <div className="w-full md:w-32 space-y-1.5">
                                            <label className="text-[10px] font-black text-gray-400 uppercase">显示类型</label>
                                            <select 
                                                value={field.type}
                                                onChange={e => updateField(index, 'type', e.target.value as any)}
                                                className="w-full p-3 text-xs bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl outline-none cursor-pointer"
                                            >
                                                <option value="text">单行文本</option>
                                                <option value="textarea">多行文本</option>
                                            </select>
                                        </div>
                                        <button onClick={() => removeField(index)} className="p-3 text-gray-300 hover:text-rose-500 transition-all">
                                            <Trash className="w-5 h-5" />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* 3. 工作流步骤设计 - 紫色块 */}
                    <div className="bg-purple-50/40 dark:bg-purple-900/10 p-8 rounded-3xl border border-purple-100 dark:border-purple-900/30 shadow-sm space-y-6">
                        <div className="flex justify-between items-center">
                            <h2 className="text-sm font-bold text-purple-600 flex items-center gap-2">
                                <Sparkles className="w-5 h-5" />
                                第三步：配置 AI 串联步骤 (创作链路)
                            </h2>
                            <button onClick={addStep} className="px-3 py-1.5 bg-purple-600 text-white text-xs font-black rounded-lg flex items-center gap-1.5 transition-all hover:bg-purple-500 shadow-md shadow-purple-500/20">
                                <Plus className="w-3.5 h-3.5" /> 增加处理节点
                            </button>
                        </div>
                        
                        <div className="space-y-10 relative mt-4">
                            {steps.length > 1 && <div className="absolute left-6 top-8 bottom-8 w-0.5 bg-purple-200 dark:bg-purple-800 -z-10" />}
                            {steps.map((step, index) => (
                                <div key={step.id} className="relative pl-12 animate-fade-in">
                                    {/* 节点图标 */}
                                    <div className="absolute left-2 top-0 w-8 h-8 rounded-full bg-purple-600 text-white flex items-center justify-center font-black text-sm shadow-xl shadow-purple-500/30 ring-4 ring-white dark:ring-gray-900">
                                        {index + 1}
                                    </div>

                                    <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 space-y-5 shadow-sm">
                                        <div className="flex justify-between items-start gap-4 pb-4 border-b border-gray-50 dark:border-gray-700">
                                            <input 
                                                type="text"
                                                value={step.name}
                                                onChange={e => updateStep(index, 'name', e.target.value)}
                                                className="bg-transparent text-gray-900 dark:text-white font-bold text-base outline-none border-b-2 border-transparent focus:border-purple-500 flex-1 transition-all"
                                                placeholder="本步骤名称，如：生成大纲"
                                            />
                                            <button onClick={() => removeStep(index)} className="text-gray-300 hover:text-rose-500 transition-colors">
                                                <Trash className="w-4 h-4" />
                                            </button>
                                        </div>

                                        <div className="space-y-2">
                                            <div className="flex justify-between items-center px-1">
                                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">提示词逻辑 (Prompt Template)</label>
                                                <div className="text-[10px] text-purple-400 font-bold bg-purple-50 dark:bg-purple-900/30 px-2 py-0.5 rounded">支持变量引用</div>
                                            </div>
                                            <textarea 
                                                value={step.prompt}
                                                onChange={e => updateStep(index, 'prompt', e.target.value)}
                                                className="w-full p-4 h-36 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl focus:ring-2 focus:ring-purple-500 outline-none text-sm font-sans resize-none transition-all shadow-inner"
                                                placeholder={`例如：请基于之前的设定 \${${fields[0]?.variable || 'keywords'}} 写一段具体的...`}
                                            />
                                        </div>

                                        <div className="flex items-center gap-3 bg-purple-50/50 dark:bg-purple-900/10 p-3 rounded-xl border border-purple-100 dark:border-purple-800/50">
                                            <DocumentText className="w-4 h-4 text-purple-500" />
                                            <span className="text-[11px] text-purple-700 dark:text-purple-300 font-bold uppercase whitespace-nowrap">输出保存为变量:</span>
                                            <input 
                                                type="text"
                                                value={step.outputVariable}
                                                onChange={e => updateStep(index, 'outputVariable', e.target.value)}
                                                className="bg-transparent text-xs font-mono text-purple-600 dark:text-purple-400 outline-none flex-1 font-bold"
                                                placeholder="如：output_outline"
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* 变量引用帮助手册 - 提示词库风格 */}
                    <div className="bg-sky-50/50 dark:bg-sky-900/10 p-6 rounded-2xl border border-sky-100 dark:border-sky-800 space-y-4">
                         <h4 className="text-sm font-bold text-sky-600 flex items-center gap-2">
                             <InformationCircle className="w-4 h-4" />
                             变量引用指南
                         </h4>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                             <div className="bg-white dark:bg-gray-900/40 p-4 rounded-xl shadow-sm border border-sky-100 dark:border-sky-800">
                                 <p className="font-bold mb-2 text-sky-700 dark:text-sky-300 border-b border-sky-50 dark:border-sky-800 pb-2">● 引用用户表单</p>
                                 <p>在 Prompt 中使用 <code className="bg-sky-50 dark:bg-black px-1.5 py-0.5 rounded text-amber-600 font-mono">{"${"}{fields[0]?.variable || 'var_name'}{"}"}</code> 引用用户运行前填写的内容。</p>
                             </div>
                             <div className="bg-white dark:bg-gray-900/40 p-4 rounded-xl shadow-sm border border-sky-100 dark:border-sky-800">
                                 <p className="font-bold mb-2 text-sky-700 dark:text-sky-300 border-b border-sky-50 dark:border-sky-800 pb-2">● 引用 AI 前序结果</p>
                                 <p>在后续步骤中，使用 <code className="bg-sky-50 dark:bg-black px-1.5 py-0.5 rounded text-purple-600 font-mono">{"${"}{steps[0]?.outputVariable || 'step_output'}{"}"}</code> 引用前面步骤 AI 已经生成的内容。</p>
                             </div>
                         </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CreateWorkflow;
