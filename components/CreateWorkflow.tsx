
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
        }
    }, [workflowToEdit]);

    const addField = () => {
        setFields([...fields, { id: `field_${Date.now()}`, label: '', variable: '', type: 'text', required: true, description: '' }]);
    };

    const updateField = (index: number, key: keyof WorkflowField, value: any) => {
        const newFields = [...fields];
        // @ts-ignore
        newFields[index][key] = value;
        setFields(newFields);
    };

    const addStep = () => {
        const stepNum = steps.length + 1;
        setSteps([...steps, { id: `step_${Date.now()}`, name: `第${stepNum}步：新处理环节`, prompt: '', outputVariable: `result_${stepNum}` }]);
    };

    const updateStep = (index: number, key: keyof WorkflowStep, value: string) => {
        const newSteps = [...steps];
        // @ts-ignore
        newSteps[index][key] = value;
        setSteps(newSteps);
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
        }
        setPromptModalOpen(false);
    };

    const handleSave = () => {
        if (!name.trim()) { alert('请输入名称'); return; }
        if (steps.length === 0) { alert('请至少添加一个运行节点'); return; }
        onSave({ name, type, description, subCategories, fields, steps });
    };

    return (
        <div className="p-0 animate-fade-in bg-gray-50 dark:bg-black min-h-full flex flex-col font-sans pb-32">
            <PromptSelectionModal isOpen={isPromptModalOpen} onClose={() => setPromptModalOpen(false)} onSelect={onSelectPromptTemplate} />

            <div className="max-w-6xl mx-auto w-full flex-1">
                {/* 顶部栏 - 与第一模块背景色同步且无间隔 */}
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
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">工作流名称</label>
                                <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="如：三幕式电影剧本生成器" className="w-full p-3.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-sky-500 outline-none transition text-sm" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">主要创作分类</label>
                                <select value={type} onChange={e => setType(e.target.value)} className="w-full p-3.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-sky-500 outline-none text-sm cursor-pointer">
                                    <option value="short-story">短篇小说</option>
                                    <option value="long-story">长篇小说</option>
                                    <option value="script">影视剧本</option>
                                    <option value="general">全类型/通用</option>
                                </select>
                            </div>
                            <div className="md:col-span-2 space-y-4">
                                <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-widest ml-1">题材标签 (最多选5个)</h4>
                                <div className="flex flex-wrap gap-2">
                                    {GENRE_TAGS.filter(t => t.id !== 'all').map(tag => (
                                        <button key={tag.id} type="button" onClick={() => setSubCategories(prev => prev.includes(tag.id as any) ? prev.filter(t => t !== tag.id) : [...prev, tag.id as any])} className={`px-4 py-1.5 text-xs rounded-full border transition-all ${subCategories.includes(tag.id as any) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-gray-800 text-gray-500 border-gray-200 hover:border-blue-400'}`}>{tag.label}</button>
                                    ))}
                                </div>
                            </div>
                            <div className="md:col-span-2 space-y-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">工作流描述</label>
                                <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="详细描述该链路的功能逻辑..." className="w-full p-3.5 h-24 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-sky-500 outline-none transition resize-none text-sm shadow-inner" />
                            </div>
                        </div>
                    </div>

                    {/* 2. 用户输入表单 - 增加间隔 */}
                    <div className="bg-amber-50/40 dark:bg-amber-900/10 p-8 rounded-3xl border border-amber-100 dark:border-amber-900/30 space-y-6 shadow-sm">
                        <div className="flex justify-between items-center">
                            <h2 className="text-lg font-black text-amber-700 dark:text-amber-300 flex items-center gap-3">
                                <Bolt className="w-5 h-5" /> 2. 输入表单定义
                            </h2>
                            <button onClick={addField} className="px-4 py-2 bg-amber-600 text-white font-bold rounded-xl flex items-center gap-2 hover:bg-amber-500 transition-all text-xs shadow-lg shadow-amber-500/20">
                                <Plus className="w-4 h-4" /> 添加字段
                            </button>
                        </div>
                        <div className="space-y-4">
                            {fields.length === 0 ? <div className="text-center py-10 text-gray-400 text-xs italic border-2 border-dashed border-amber-200 dark:border-amber-900/50 rounded-2xl">请添加字段以获取用户输入的初始参数</div> : fields.map((field, index) => (
                                <div key={field.id} className="flex flex-col md:flex-row gap-4 items-end bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 shadow-sm">
                                    <div className="flex-1 space-y-1.5 w-full">
                                        <label className="text-[9px] font-black text-gray-400 uppercase">显示名称</label>
                                        <input type="text" value={field.label} onChange={e => updateField(index, 'label', e.target.value)} className="w-full p-2.5 text-xs bg-gray-50 dark:bg-gray-900 border rounded-xl outline-none focus:ring-1 focus:ring-amber-500" placeholder="如：主角性格" />
                                    </div>
                                    <div className="flex-1 space-y-1.5 w-full">
                                        <label className="text-[9px] font-black text-gray-400 uppercase">变量名 (ID)</label>
                                        <input type="text" value={field.variable} onChange={e => updateField(index, 'variable', e.target.value)} className="w-full p-2.5 text-xs bg-gray-50 dark:bg-gray-900 border rounded-xl outline-none font-mono focus:ring-1 focus:ring-amber-500" placeholder="如：trait" />
                                    </div>
                                    <button onClick={() => setFields(fields.filter((_, i) => i !== index))} className="p-3 text-gray-300 hover:text-rose-500 transition-colors"><Trash className="w-5 h-5" /></button>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* 3. AI 节点配置 - 增加间隔 */}
                    <div className="bg-purple-50/40 dark:bg-purple-900/10 p-8 rounded-3xl border border-purple-100 dark:border-purple-900/30 space-y-6 shadow-sm">
                        <div className="flex justify-between items-center">
                            <h2 className="text-lg font-black text-purple-700 dark:text-purple-300 flex items-center gap-3">
                                <Sparkles className="w-5 h-5" /> 3. 自动化链路节点
                            </h2>
                            <button onClick={addStep} className="px-4 py-2 bg-purple-600 text-white font-bold rounded-xl flex items-center gap-2 hover:bg-purple-500 transition-all text-xs shadow-lg shadow-purple-500/20">
                                <Plus className="w-4 h-4" /> 增加节点
                            </button>
                        </div>
                        
                        <div className="space-y-6 relative mt-4">
                            {steps.map((step, index) => (
                                <div key={step.id} className="relative pl-12">
                                    <div className="absolute left-0 top-0 w-8 h-8 rounded-full bg-purple-600 text-white flex items-center justify-center font-black text-sm shadow-xl z-10">{index + 1}</div>
                                    {index < steps.length - 1 && <div className="absolute left-4 top-8 bottom-[-24px] w-0.5 bg-purple-100 dark:bg-purple-800"></div>}
                                    
                                    <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 space-y-4 shadow-sm">
                                        <div className="flex justify-between items-center border-b border-gray-50 dark:border-gray-700 pb-3">
                                            <input type="text" value={step.name} onChange={e => updateStep(index, 'name', e.target.value)} className="bg-transparent font-black text-gray-900 dark:text-white outline-none border-b border-transparent focus:border-purple-500 transition-all flex-1" placeholder="节点名称..." />
                                            <div className="flex gap-2">
                                                <button onClick={() => handleImportPrompt(index)} className="px-3 py-1.5 bg-sky-50 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400 rounded-lg text-[10px] font-bold border border-sky-100 dark:border-sky-800 hover:bg-sky-100 flex items-center gap-1.5"><Box className="w-3.5 h-3.5" /> 导入模板</button>
                                                <button onClick={() => setSteps(steps.filter((_, i) => i !== index))} className="p-2 text-gray-300 hover:text-rose-500"><Trash className="w-4 h-4" /></button>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">运行 Prompt (提示词内容)</label>
                                            <textarea value={step.prompt} onChange={e => updateStep(index, 'prompt', e.target.value)} className="w-full p-4 h-32 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl focus:ring-2 focus:ring-purple-500 outline-none text-sm resize-none transition-all shadow-inner" placeholder="输入 AI 指令，使用 ${变量名} 引用上文..." />
                                        </div>

                                        <div className="flex items-center gap-4 bg-purple-50/50 dark:bg-purple-900/10 p-3 rounded-2xl border border-purple-100/50">
                                            <DocumentText className="w-4 h-4 text-purple-400" />
                                            <span className="text-[10px] text-purple-700 dark:text-purple-300 font-black uppercase">保存结果到变量:</span>
                                            <input type="text" value={step.outputVariable} onChange={e => updateStep(index, 'outputVariable', e.target.value)} className="bg-transparent text-xs font-mono text-purple-600 dark:text-purple-400 outline-none flex-1 font-bold" placeholder="step_result" />
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {steps.length === 0 && <div className="text-center py-16 text-gray-400 flex flex-col items-center gap-4 bg-white dark:bg-gray-900 rounded-3xl border border-dashed"><Sparkles className="w-12 h-12 opacity-10" /><p className="text-sm font-medium">尚未定义任何处理环节，点击右上方“增加节点”开始构建链路</p></div>}
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
