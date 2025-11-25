import React, { useState } from 'react';
import { Plus, Trash } from './Icon';

interface WorkflowField {
    id: string;
    label: string;
    variable: string;
    type: 'text' | 'textarea';
}

interface CreateWorkflowProps {
    onBack: () => void;
    onSave: (data: any) => void;
}

const CreateWorkflow: React.FC<CreateWorkflowProps> = ({ onBack, onSave }) => {
    const [name, setName] = useState('');
    const [type, setType] = useState('short-story');
    const [description, setDescription] = useState('');
    const [template, setTemplate] = useState('');
    const [fields, setFields] = useState<WorkflowField[]>([]);

    const addField = () => {
        setFields([...fields, { id: Date.now().toString(), label: '', variable: '', type: 'text' }]);
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

    return (
        <div className="p-4 sm:p-6 lg:p-8 animate-fade-in bg-white dark:bg-black min-h-full flex flex-col">
            <button onClick={onBack} className="mb-6 flex items-center text-gray-500 hover:text-sky-600 transition-colors text-sm w-fit">
                 <span className="mr-1">←</span> 返回工作流库
            </button>

            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">创建新工作流</h1>

            <div className="space-y-8 max-w-5xl flex-1">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">工作流名称</label>
                        <input 
                            type="text" 
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="例如：三幕式大纲生成器"
                            className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none transition text-gray-900 dark:text-white"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">适用类型</label>
                        <select 
                            value={type}
                            onChange={e => setType(e.target.value)}
                            className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none transition text-gray-900 dark:text-white"
                        >
                            <option value="short-story">短篇小说</option>
                            <option value="novel">长篇小说</option>
                            <option value="script">剧本</option>
                        </select>
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">简介</label>
                    <textarea 
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                        placeholder="简要描述这个工作流的功能..."
                        className="w-full p-3 h-24 bg-white dark:bg-gray-900 border border-sky-500/50 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none transition resize-none text-gray-900 dark:text-white border-2 border-sky-400"
                    />
                </div>

                <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">提示词模板</label>
                    <p className="text-xs text-gray-500 mb-2">使用 {'${变量名}'} 来引用下方定义的字段。</p>
                    <textarea 
                        value={template}
                        onChange={e => setTemplate(e.target.value)}
                        placeholder="输入提示词模板..."
                        className="w-full p-3 h-40 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none transition resize-y font-mono text-sm text-gray-900 dark:text-white"
                    />
                </div>

                <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-6 border-dashed">
                    <div className="flex justify-between items-center mb-6">
                         <label className="text-lg font-bold text-gray-700 dark:text-gray-300">输入字段定义</label>
                         <button onClick={addField} className="text-sky-600 hover:text-sky-700 text-sm font-semibold flex items-center gap-1 transition-colors">
                            <Plus className="w-4 h-4" /> 添加字段
                         </button>
                    </div>
                    
                    <div className="space-y-3">
                        {fields.length === 0 ? (
                            <div className="text-center py-12 text-gray-400 text-sm">
                                暂无字段，点击上方添加
                            </div>
                        ) : (
                            fields.map((field, index) => (
                                <div key={field.id} className="flex flex-col md:flex-row gap-4 items-start md:items-end bg-gray-50 dark:bg-gray-800/50 p-4 rounded border border-gray-200 dark:border-gray-800 animate-fade-in">
                                    <div className="flex-1 w-full">
                                        <label className="block text-xs text-gray-500 mb-1">显示名称</label>
                                        <input 
                                            type="text" 
                                            value={field.label}
                                            onChange={e => updateField(index, 'label', e.target.value)}
                                            className="w-full p-2 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded focus:ring-1 focus:ring-sky-500 outline-none text-gray-900 dark:text-white"
                                            placeholder="如：主角姓名"
                                        />
                                    </div>
                                    <div className="flex-1 w-full">
                                        <label className="block text-xs text-gray-500 mb-1">变量名 (English)</label>
                                        <input 
                                            type="text" 
                                            value={field.variable}
                                            onChange={e => updateField(index, 'variable', e.target.value)}
                                            className="w-full p-2 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded focus:ring-1 focus:ring-sky-500 outline-none font-mono text-gray-900 dark:text-white"
                                            placeholder="如：name"
                                        />
                                    </div>
                                     <div className="w-full md:w-32">
                                        <label className="block text-xs text-gray-500 mb-1">类型</label>
                                        <select 
                                            value={field.type}
                                            onChange={e => updateField(index, 'type', e.target.value)}
                                            className="w-full p-2 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded focus:ring-1 focus:ring-sky-500 outline-none text-gray-900 dark:text-white"
                                        >
                                            <option value="text">单行文本</option>
                                            <option value="textarea">多行文本</option>
                                        </select>
                                    </div>
                                    <button onClick={() => removeField(index)} className="p-2 text-gray-400 hover:text-red-500 transition-colors self-end mb-0.5">
                                        <Trash className="w-5 h-5" />
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

             <div className="flex justify-end gap-4 mt-8 pt-6 border-t border-gray-200 dark:border-gray-800">
                <button onClick={onBack} className="px-6 py-2.5 text-gray-600 dark:text-gray-300 font-semibold hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
                    取消
                </button>
                <button onClick={() => onSave({name, type, description, template, fields})} className="px-8 py-2.5 bg-sky-600 text-white font-bold rounded-lg hover:bg-sky-500 shadow-lg shadow-sky-500/30 transition-all">
                    保存工作流
                </button>
             </div>
        </div>
    );
};

export default CreateWorkflow;