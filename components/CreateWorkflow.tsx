
import React, { useState } from 'react';
import { Plus, Trash, Sparkles, ChevronDown, ChevronUp, InformationCircle, Bolt, DocumentText } from './Icon';
import { WorkflowField, WorkflowStep } from '../types';

interface CreateWorkflowProps {
    onBack: () => void;
    onSave: (data: any) => void;
}

const CreateWorkflow: React.FC<CreateWorkflowProps> = ({ onBack, onSave }) => {
    const [name, setName] = useState('');
    const [type, setType] = useState('short-story');
    const [description, setDescription] = useState('');
    const [fields, setFields] = useState<WorkflowField[]>([]);
    const [steps, setSteps] = useState<WorkflowStep[]>([
        { id: 'step_1', name: '第一步：生成初步想法', prompt: '请根据用户提供的关键词 ${keywords}，生成三个有趣的故事创意。', outputVariable: 'ideas' }
    ]);

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
            name: `第${stepNum}步：新环节`, 
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
        if (!name.trim()) {
            alert('请输入工作流名称');
            return;
        }
        onSave({
            name,
            type,
            description,
            fields,
            steps
        });
    };

    return (
        <div className="p-4 sm:p-6 lg:p-8 animate-fade-in bg-gray-50 dark:bg-black min-h-full flex flex-col font-sans">
            <div className="max-w-5xl mx-auto w-full flex-1 flex flex-col">
                <button onClick={onBack} className="mb-6 flex items-center text-gray-500 hover:text-sky-600 transition-colors text-sm font-bold w-fit">
                    <span className="mr-1">←</span> 返回列表
                </button>

                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">创建工作流</h1>
                    <div className="flex gap-3">
                        <button onClick={onBack} className="px-6 py-2.5 text-gray-600 dark:text-gray-300 font-bold bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl hover:bg-gray-50 transition-all">取消</button>
                        <button onClick={handleSave} className="px-8 py-2.5 bg-sky-600 text-white font-black rounded-xl hover:bg-sky-500 shadow-lg shadow-sky-500/20 transition-all active:scale-95">保存工作流</button>
                    </div>
                </div>

                <div className="space-y-8 flex-1 pb-20">
                    {/* 1. 基本信息 */}
                    <div className="bg-white dark:bg-gray-900 p-8 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm space-y-6">
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <InformationCircle className="w-5 h-5 text-sky-500" />
                            基本信息
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">名称</label>
                                <input 
                                    type="text" 
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    placeholder="如：三幕式小说生成器"
                                    className="w-full p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-sky-500 outline-none transition text-sm"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">分类</label>
                                <select 
                                    value={type}
                                    onChange={e => setType(e.target.value)}
                                    className="w-full p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-sky-500 outline-none transition text-sm appearance-none cursor-pointer"
                                >
                                    <option value="short-story">短篇小说</option>
                                    <option value="script">影视剧本</option>
                                    <option value="novel">长篇小说</option>
                                </select>
                            </div>
                            <div className="md:col-span-2 space-y-2">
                                <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">简介</label>
                                <textarea 
                                    value={description}
                                    onChange={e => setDescription(e.target.value)}
                                    placeholder="简单描述这个工作流的逻辑和产出目标..."
                                    className="w-full p-4 h-24 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-sky-500 outline-none transition resize-none text-sm"
                                />
                            </div>
                        </div>
                    </div>

                    {/* 2. 用户输入表单定义 */}
                    <div className="bg-white dark:bg-gray-900 p-8 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm space-y-6">
                        <div className="flex justify-between items-center">
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <Bolt className="w-5 h-5 text-amber-500" />
                                用户输入定义
                            </h2>
                            <button onClick={addField} className="text-sky-600 hover:text-sky-700 text-xs font-black flex items-center gap-1.5 transition-all">
                                <Plus className="w-4 h-4" /> 添加字段
                            </button>
                        </div>
                        <div className="space-y-4">
                            {fields.length === 0 ? (
                                <div className="text-center py-10 bg-gray-50 dark:bg-black/20 rounded-2xl border border-dashed border-gray-200 dark:border-gray-800 text-gray-400 text-xs italic">
                                    尚未添加输入字段，点击右上方按钮开始。这些字段将由运行者填写。
                                </div>
                            ) : (
                                fields.map((field, index) => (
                                    <div key={field.id} className="flex flex-col md:flex-row gap-4 items-end bg-gray-50/50 dark:bg-gray-800/40 p-5 rounded-2xl border border-gray-100 dark:border-gray-800 animate-fade-in group">
                                        <div className="flex-1 w-full space-y-1.5">
                                            <label className="text-[10px] font-black text-gray-400 uppercase">显示名称</label>
                                            <input 
                                                type="text" 
                                                value={field.label}
                                                onChange={e => updateField(index, 'label', e.target.value)}
                                                className="w-full p-3 text-xs bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-1 focus:ring-sky-500"
                                                placeholder="如：主角姓名"
                                            />
                                        </div>
                                        <div className="flex-1 w-full space-y-1.5">
                                            <label className="text-[10px] font-black text-gray-400 uppercase">变量名 (供模板引用)</label>
                                            <input 
                                                type="text" 
                                                value={field.variable}
                                                onChange={e => updateField(index, 'variable', e.target.value)}
                                                className="w-full p-3 text-xs bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl font-mono outline-none focus:ring-1 focus:ring-sky-500"
                                                placeholder="如：char_name"
                                            />
                                        </div>
                                        <div className="w-full md:w-32 space-y-1.5">
                                            <label className="text-[10px] font-black text-gray-400 uppercase">类型</label>
                                            <select 
                                                value={field.type}
                                                onChange={e => updateField(index, 'type', e.target.value as any)}
                                                className="w-full p-3 text-xs bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl outline-none"
                                            >
                                                <option value="text">单行文本</option>
                                                <option value="textarea">多行长文</option>
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

                    {/* 3. 工作流步骤设计 */}
                    <div className="bg-white dark:bg-gray-900 p-8 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm space-y-6">
                        <div className="flex justify-between items-center">
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <Sparkles className="w-5 h-5 text-purple-500" />
                                工作流步骤 (AI 链路)
                            </h2>
                            <button onClick={addStep} className="text-purple-600 hover:text-purple-700 text-xs font-black flex items-center gap-1.5 transition-all">
                                <Plus className="w-4 h-4" /> 添加处理环节
                            </button>
                        </div>
                        
                        <div className="space-y-8 relative">
                            {steps.length > 1 && <div className="absolute left-6 top-8 bottom-8 w-0.5 bg-gray-100 dark:bg-gray-800 -z-10" />}
                            {steps.map((step, index) => (
                                <div key={step.id} className="relative pl-12 animate-fade-in">
                                    {/* 节点图标 */}
                                    <div className="absolute left-2 top-0 w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-300 flex items-center justify-center font-bold text-sm shadow-sm ring-4 ring-white dark:ring-gray-900">
                                        {index + 1}
                                    </div>

                                    <div className="bg-gray-50 dark:bg-gray-800/40 p-6 rounded-2xl border border-gray-200 dark:border-gray-700 space-y-4">
                                        <div className="flex justify-between items-start gap-4">
                                            <input 
                                                type="text"
                                                value={step.name}
                                                onChange={e => updateStep(index, 'name', e.target.value)}
                                                className="bg-transparent text-gray-900 dark:text-white font-bold outline-none focus:ring-b-2 border-purple-300 flex-1"
                                                placeholder="环节名称..."
                                            />
                                            <button onClick={() => removeStep(index)} className="text-gray-300 hover:text-rose-500 transition-colors">
                                                <Trash className="w-4 h-4" />
                                            </button>
                                        </div>

                                        <div className="space-y-2">
                                            <div className="flex justify-between items-center px-1">
                                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">提示词模板 (Prompt)</label>
                                                <div className="text-[10px] text-gray-400">支持引用表单变量及前续步骤结果</div>
                                            </div>
                                            <textarea 
                                                value={step.prompt}
                                                onChange={e => updateStep(index, 'prompt', e.target.value)}
                                                className="w-full p-4 h-32 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-sm font-sans resize-none"
                                                placeholder={`例如：请基于 \${${fields[0]?.variable || '变量名'}} 写一段...`}
                                            />
                                        </div>

                                        <div className="flex items-center gap-3 bg-white/50 dark:bg-black/20 p-3 rounded-xl border border-gray-100 dark:border-gray-800">
                                            <DocumentText className="w-4 h-4 text-purple-400" />
                                            <span className="text-xs text-gray-500 font-bold">输出保存为变量:</span>
                                            <input 
                                                type="text"
                                                value={step.outputVariable}
                                                onChange={e => updateStep(index, 'outputVariable', e.target.value)}
                                                className="bg-transparent text-xs font-mono text-purple-600 dark:text-purple-400 outline-none flex-1"
                                                placeholder="如：idea_output"
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* 变量引用帮助手册 */}
                    <div className="bg-sky-50/50 dark:bg-sky-900/10 p-6 rounded-2xl border border-sky-100 dark:border-sky-800 space-y-3">
                         <h4 className="text-sm font-bold text-sky-600 flex items-center gap-2">
                             <InformationCircle className="w-4 h-4" />
                             变量引用指南
                         </h4>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                             <div>
                                 <p className="font-bold mb-1 text-sky-700 dark:text-sky-300">● 引用表单变量</p>
                                 <p>在提示词中使用 <code className="bg-white dark:bg-black px-1.5 py-0.5 rounded text-rose-500 font-mono">{"${"}{fields[0]?.variable || '变量名'}{"}"}</code> 引用用户填写的表单内容。</p>
                             </div>
                             <div>
                                 <p className="font-bold mb-1 text-sky-700 dark:text-sky-300">● 引用前序结果</p>
                                 <p>在后面的步骤中，可以使用 <code className="bg-white dark:bg-black px-1.5 py-0.5 rounded text-purple-500 font-mono">{"${"}{steps[0]?.outputVariable || '前序变量'}{"}"}</code> 引用前面步骤 AI 的输出。</p>
                             </div>
                         </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CreateWorkflow;
