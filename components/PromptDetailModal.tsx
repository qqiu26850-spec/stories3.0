
import React, { useState, useEffect } from 'react';
import { Prompt } from '../types';
import { X, Sparkles, Copy } from './Icon';

interface PromptDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    prompt: Prompt | null;
    onRun: (filledValues: Record<string, string>) => void;
}

const PromptDetailModal: React.FC<PromptDetailModalProps> = ({ isOpen, onClose, prompt, onRun }) => {
    const [formState, setFormState] = useState<Record<string, string>>({});
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (prompt) {
            const initialFormState = prompt.fields.reduce((acc, field) => {
                acc[field.id] = '';
                return acc;
            }, {} as Record<string, string>);
            setFormState(initialFormState);
            setCopied(false);
        }
    }, [prompt]);

    if (!isOpen || !prompt) return null;

    const handleFormChange = (id: string, value: string) => {
        setFormState(prev => ({ ...prev, [id]: value }));
    };

    const getFilledTemplate = () => {
        let filledTemplate = prompt.template || prompt.content;
        if (prompt.fields) {
            for (const key in formState) {
                filledTemplate = filledTemplate.replace(new RegExp(`\\$\\{${key}\\}`, 'g'), formState[key]);
            }
        }
        return filledTemplate;
    };

    const handleCopy = () => {
        const text = getFilledTemplate();
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
    };
    
    const handleRun = () => {
        onRun(formState);
    };

    const isTemplateBased = prompt.fields && prompt.fields.length > 0;

    return (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div 
                className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-2xl p-6 animate-fade-in-up flex flex-col relative max-h-[90vh]" 
                onClick={e => e.stopPropagation()}
            >
                <button onClick={onClose} className="absolute top-4 right-4 p-2 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 z-10">
                    <X className="w-6 h-6" />
                </button>
                
                <div className="flex-shrink-0 mb-4 pr-8">
                     <h3 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Sparkles className="w-6 h-6 text-sky-500" />
                        {prompt.title}
                     </h3>
                     <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">{prompt.description}</p>
                </div>

                <div className="flex-grow overflow-y-auto pr-2 -mr-4 space-y-4">
                    {isTemplateBased ? (
                        prompt.fields.map(field => (
                            <div key={field.id}>
                                <label htmlFor={field.id} className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">{field.label}</label>
                                {field.type === 'textarea' ? (
                                    <textarea
                                        id={field.id}
                                        value={formState[field.id] || ''}
                                        onChange={(e) => handleFormChange(field.id, e.target.value)}
                                        placeholder={field.placeholder}
                                        className="w-full h-24 p-2 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md text-gray-900 dark:text-gray-200 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition resize-y"
                                    />
                                ) : (
                                    <input
                                        type="text"
                                        id={field.id}
                                        value={formState[field.id] || ''}
                                        onChange={(e) => handleFormChange(field.id, e.target.value)}
                                        placeholder={field.placeholder}
                                        className="w-full p-2 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md text-gray-900 dark:text-gray-200 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition"
                                    />
                                )}
                            </div>
                        ))
                    ) : (
                         <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-md">
                            <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-2">提示词内容：</h4>
                            <pre className="whitespace-pre-wrap text-sm text-gray-600 dark:text-gray-400 font-sans">{prompt.content}</pre>
                        </div>
                    )}
                </div>
               
                <div className="flex-shrink-0 pt-6 flex gap-3">
                    <button
                        onClick={handleCopy}
                        className="flex-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 font-bold py-3 px-4 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors flex items-center justify-center gap-2"
                    >
                        <Copy className="w-4 h-4" />
                        {copied ? '已复制' : '复制提示词'}
                    </button>
                    <button
                        onClick={handleRun}
                        className="flex-[2] bg-sky-600 text-white font-bold py-3 px-4 rounded-md hover:bg-sky-500 transition-colors flex items-center justify-center gap-2 shadow-lg hover:shadow-sky-500/30"
                    >
                        <Sparkles className="w-5 h-5" />
                        AI 立即生成
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PromptDetailModal;
