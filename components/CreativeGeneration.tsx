
import React, { useState, useEffect, useRef } from 'react';
import { CREATIVE_MODULES } from '../constants';
import CreativeCard from './CreativeCard';
import { CreativeModule, Asset, Prompt } from '../types';
import { generateTextStream } from '../services/geminiService';
import { ChevronDoubleLeft, Sparkles, Copy, Database, AdjustmentsHorizontal, Search, DocumentText, X, BookOpen, ChevronDown, Check } from './Icon';
import PromptSelectionModal from './PromptSelectionModal';
import AssetSelectionModal from './AssetSelectionModal'; 
import { saveMaterial, incrementPromptHeat, fetchMaterials } from '../services/supabaseService';
import LoadingOverlay from './LoadingOverlay';
import { createPortal } from 'react-dom';

interface CreativeGenerationProps {
  initialData?: {
    prompt?: Prompt;
    values?: Record<string, string>;
  };
  onClearInitialData?: () => void;
}

type PromptFormState = Record<string, string>;

// ... (ImportAssetModal and FormattedText components remain unchanged) ...
const ImportAssetModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    content: string;
    onSave: (data: { name: string; type: Asset['type']; tags: string[]; content: string }) => void;
}> = ({ isOpen, onClose, content, onSave }) => {
    const [name, setName] = useState('');
    const [assetContent, setAssetContent] = useState('');
    const [type, setType] = useState<Asset['type']>('inspiration');
    const [tags, setTags] = useState('');

    useEffect(() => {
        if (isOpen && content) {
            setName(content.slice(0, 15).replace(/\n/g, ' ').trim() + (content.length > 15 ? '...' : ''));
            setAssetContent(content);
        }
    }, [isOpen, content]);

    const handleSave = () => {
        const tagList = tags.split(/[,，]/).map(t => t.trim()).filter(Boolean);
        onSave({ name, type, tags: tagList, content: assetContent });
        onClose();
    };

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 bg-black/60 dark:bg-black/80 flex items-center justify-center z-[100] p-4 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg p-8 animate-fade-in-up flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-6 flex-shrink-0">
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white">导入素材库</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                        <X className="w-6 h-6" />
                    </button>
                </div>
                
                <div className="space-y-5 overflow-y-auto pr-2">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">素材名称</label>
                        <input 
                            type="text" 
                            value={name}
                            onChange={e => setName(e.target.value)}
                            className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none text-gray-900 dark:text-white"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">分类</label>
                        <div className="grid grid-cols-3 gap-3">
                            {(['character', 'plot', 'inspiration'] as const).map(t => (
                                <button
                                    key={t}
                                    onClick={() => setType(t)}
                                    className={`py-3 px-2 text-sm rounded-lg border transition-all font-medium ${
                                        type === t 
                                        ? 'bg-sky-50 dark:bg-sky-900/30 border-sky-500 text-sky-700 dark:text-sky-400 shadow-sm' 
                                        : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                                    }`}
                                >
                                    {t === 'character' ? '角色' : t === 'plot' ? '剧情' : '灵感'}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">内容预览</label>
                        <textarea
                            value={assetContent}
                            onChange={e => setAssetContent(e.target.value)}
                            className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none text-gray-900 dark:text-white h-32 resize-none"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">标签</label>
                        <input 
                            type="text" 
                            value={tags}
                            onChange={e => setTags(e.target.value)}
                            placeholder="例如：科幻, 反转 (逗号分隔)"
                            className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none text-gray-900 dark:text-white"
                        />
                    </div>
                </div>

                <div className="mt-8 flex gap-3 flex-shrink-0">
                    <button onClick={onClose} className="flex-1 py-3 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-bold rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                        取消
                    </button>
                    <button onClick={handleSave} className="flex-1 py-3 bg-sky-600 text-white font-bold rounded-lg hover:bg-sky-500 shadow-lg hover:shadow-sky-500/30 transition-all">
                        保存素材
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

const FormattedText: React.FC<{ text: string }> = ({ text }) => {
    return (
        <div className="whitespace-pre-wrap font-sans text-gray-800 dark:text-gray-200 leading-relaxed text-sm md:text-base">
            {text.split('\n').map((line, index) => {
                const isMarkdownHeader = line.trim().startsWith('#');
                const isLikelyTitle = line.trim().length > 0 && line.trim().length < 40 && !line.includes('。') && !line.includes('，');
                
                if (isMarkdownHeader) {
                    const content = line.replace(/^#+\s*/, '');
                    return <h3 key={index} className="text-xl font-extrabold text-gray-900 dark:text-white mt-5 mb-2.5">{content}</h3>;
                }
                
                if (isLikelyTitle) {
                     return <div key={index} className="text-lg font-bold text-gray-900 dark:text-white mt-4 mb-2">{line}</div>;
                }

                const parts = line.split(/(\*\*.*?\*\*)/g);
                return (
                    <div key={index} className="min-h-[1.5em]">
                        {parts.map((part, i) => {
                            if (part.startsWith('**') && part.endsWith('**')) {
                                return <span key={i} className="font-bold text-gray-900 dark:text-white">{part.slice(2, -2)}</span>;
                            }
                            return <span key={i}>{part}</span>;
                        })}
                    </div>
                );
            })}
        </div>
    );
};

const CreativeGeneration: React.FC<CreativeGenerationProps> = ({ initialData, onClearInitialData }) => {
    const [selectedModule, setSelectedModule] = useState<CreativeModule | null>(null);
    const [model, setModel] = useState('deepseek-chat');
    
    const [temperature, setTemperature] = useState(1);
    const [topP, setTopP] = useState(0.95);
    const [showConfig, setShowConfig] = useState(false);

    const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);
    const [formState, setFormState] = useState<PromptFormState>({});
    const [freeInput, setFreeInput] = useState('');
    const [generatedText, setGeneratedText] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [showLoadingOverlay, setShowLoadingOverlay] = useState(false);
    const [importModalOpen, setImportModalOpen] = useState(false);
    const [promptModalOpen, setPromptModalOpen] = useState(false);
    const [assetModalOpen, setAssetModalOpen] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [assets, setAssets] = useState<Asset[]>([]);
    const [selectedAssetIds, setSelectedAssetIds] = useState<Set<string>>(new Set());
    const abortControllerRef = useRef<AbortController | null>(null);

    useEffect(() => {
        const loadAssets = async () => {
            const data = await fetchMaterials();
            const mappedAssets: Asset[] = data.map((item: any) => ({
                id: item.id,
                name: item.name || item.title,
                type: item.type === 'idea' ? 'inspiration' : item.type,
                content: item.content,
                tags: item.tags || [],
                data: { name: item.name }
            }));
            setAssets(mappedAssets);
        };
        loadAssets();
    }, []);

    useEffect(() => {
        if (initialData?.prompt) {
            if (!selectedModule) {
                setSelectedModule(CREATIVE_MODULES[0]); 
            }
            setSelectedPrompt(initialData.prompt);
            if (initialData.values) {
                setFormState(initialData.values);
            }
            if (onClearInitialData) {
                onClearInitialData();
            }
        }
    }, [initialData, selectedModule, onClearInitialData]);

    useEffect(() => {
        if (selectedModule && !initialData?.prompt) {
            setFreeInput('');
            setSelectedPrompt(null);
            setFormState({});
            setGeneratedText('');
            setSuccessMessage('');
            setSelectedAssetIds(new Set());
        }
    }, [selectedModule]);

    useEffect(() => {
        if (selectedPrompt) {
            setFormState(prev => {
                const next = { ...prev };
                selectedPrompt.fields.forEach(field => {
                    if (next[field.id] === undefined) {
                        next[field.id] = '';
                    }
                });
                return next;
            });
        } else {
            setFormState({});
        }
    }, [selectedPrompt]);

    const handleStop = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
        setIsGenerating(false);
        setShowLoadingOverlay(false);
    };

    const handleGenerate = async () => {
        if (isGenerating) {
            handleStop();
            return;
        }

        setIsGenerating(true);
        setShowLoadingOverlay(true);
        setGeneratedText('');
        
        let basePrompt = '';
        if (selectedPrompt) {
            incrementPromptHeat(selectedPrompt.id);
            let template = selectedPrompt.template || selectedPrompt.content; 
            for (const field of selectedPrompt.fields) {
                const val = formState[field.id] || '';
                template = template.replace(new RegExp(`\\$\\{${field.id}\\}`, 'g'), val);
            }
            basePrompt = template;
        } else {
            basePrompt = freeInput;
        }

        const assetContext = Array.from(selectedAssetIds)
            .map(id => assets.find(a => a.id === id))
            .filter(Boolean)
            .map(a => `【关联素材：${a!.name}】\n${a!.content}`)
            .join('\n\n');
        
        let finalPrompt = assetContext ? `${assetContext}\n\n---\n\n${basePrompt}` : basePrompt;

        if (selectedModule) {
            finalPrompt = `[当前创作任务：${selectedModule.title} - ${selectedModule.description}]\n\n${finalPrompt}`;
        }
        
        if (!finalPrompt.trim()) {
            setIsGenerating(false);
            setShowLoadingOverlay(false);
            return;
        }

        const controller = new AbortController();
        abortControllerRef.current = controller;

        try {
            const stream = generateTextStream(
                finalPrompt, 
                { model, temperature, topP, signal: controller.signal }
            );

            let firstChunk = true;
            for await (const chunk of stream) {
                if (firstChunk) {
                    setShowLoadingOverlay(false); 
                    firstChunk = false;
                }
                setGeneratedText(prev => prev + chunk);
            }
            // Success Notification
            setSuccessMessage('内容生成完毕');
            setTimeout(() => setSuccessMessage(''), 2500);

        } catch (e: any) {
            if (e.message !== 'Aborted') {
                setGeneratedText(prev => prev + "\n\n[生成中断或出错，请重试]");
            }
        } finally {
            setIsGenerating(false);
            setShowLoadingOverlay(false);
            abortControllerRef.current = null;
        }
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(generatedText);
        setSuccessMessage('内容已复制！');
        setTimeout(() => setSuccessMessage(''), 2000);
    };

    const handleImportAsset = (data: { name: string; type: Asset['type']; tags: string[]; content: string }) => {
        let dbType: 'character' | 'plot' | 'idea' = 'idea';
        if (data.type === 'character') dbType = 'character';
        if (data.type === 'plot') dbType = 'plot';

        saveMaterial(data.name, data.content, dbType, data.tags);

        setSuccessMessage('已成功导入素材库');
        setTimeout(() => setSuccessMessage(''), 2000);
    };

    if (!selectedModule) {
        return (
            <div className="p-4 sm:p-6 lg:p-8 h-full animate-fade-in">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">创意生成</h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">选择一个创作模块，开始你的灵感之旅。</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {CREATIVE_MODULES.map((module) => (
                        <CreativeCard 
                            key={module.id} 
                            module={module} 
                            onSelect={() => setSelectedModule(module)}
                        />
                    ))}
                </div>
            </div>
        );
    }

    const moduleInitialTag = selectedModule?.subCategories?.[0];

    return (
        <div className="h-full flex flex-col bg-gray-50 dark:bg-black animate-fade-in overflow-hidden relative">
            <LoadingOverlay isVisible={showLoadingOverlay} onClose={handleStop} />
            <ImportAssetModal 
                isOpen={importModalOpen} 
                onClose={() => setImportModalOpen(false)} 
                content={generatedText}
                onSave={handleImportAsset}
            />
            <PromptSelectionModal
                isOpen={promptModalOpen}
                onClose={() => setPromptModalOpen(false)}
                onSelect={setSelectedPrompt}
                initialSubCategory={moduleInitialTag} 
            />
            <AssetSelectionModal 
                isOpen={assetModalOpen} 
                onClose={() => setAssetModalOpen(false)}
                assets={assets}
                selectedAssetIds={selectedAssetIds}
                onToggleAsset={(id) => setSelectedAssetIds(prev => {
                    const next = new Set(prev);
                    if(next.has(id)) next.delete(id); else next.add(id);
                    return next;
                })}
            />

            <div className="flex-shrink-0 flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm z-20">
                <div className="flex items-center gap-3">
                    <button 
                        onClick={() => setSelectedModule(null)}
                        className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition-colors"
                    >
                        <ChevronDoubleLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            {selectedModule.title}
                            <span className="text-xs font-normal text-gray-500 border border-gray-200 dark:border-gray-700 px-2 py-0.5 rounded-full bg-gray-50 dark:bg-gray-800">创作模式</span>
                        </h2>
                    </div>
                </div>
                {successMessage && (
                    <div className="px-4 py-2 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 rounded-lg text-sm font-bold animate-pulse shadow-sm flex items-center gap-2">
                        <Check className="w-4 h-4" />
                        {successMessage}
                    </div>
                )}
            </div>

            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
                <div className="w-full lg:w-[450px] xl:w-[500px] flex flex-col border-b lg:border-b-0 lg:border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden z-10 shadow-lg lg:shadow-none">
                    <div className="flex-1 overflow-y-auto p-5 space-y-8">
                        {/* Model & Config Section */}
                        <div className="space-y-3">
                            <div className="flex items-center gap-2 text-gray-800 dark:text-gray-200 font-bold text-sm uppercase tracking-wide">
                                <div className="p-1.5 bg-blue-100 dark:bg-blue-900/30 rounded text-blue-600 dark:text-blue-400">
                                    <AdjustmentsHorizontal className="w-4 h-4" />
                                </div>
                                模型配置
                            </div>
                            
                            <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-100 dark:border-gray-800">
                                <div className="flex gap-2 mb-1">
                                    <div className="relative flex-1">
                                        <select 
                                            value={model}
                                            onChange={(e) => setModel(e.target.value)}
                                            className="w-full py-2 pl-3 pr-8 text-xs font-medium bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-200 focus:ring-1 focus:ring-sky-500 outline-none appearance-none cursor-pointer"
                                        >
                                            <option value="deepseek-chat">深思通用 (DeepSeek V3)</option>
                                            <option value="deepseek-reasoner">深思推理 (DeepSeek R1)</option>
                                            <option value="gemini-2.5-flash">谷歌极速 (Gemini Flash)</option>
                                            <option value="gemini-2.5-pro">谷歌深度 (Gemini Pro)</option>
                                        </select>
                                        <ChevronDown className="w-3 h-3 text-gray-400 absolute right-2.5 top-3 pointer-events-none" />
                                    </div>
                                    <button 
                                        onClick={() => setShowConfig(!showConfig)}
                                        className={`px-3 py-2 text-xs font-bold rounded-lg border transition-all flex items-center gap-1 ${showConfig ? 'bg-sky-100 text-sky-600 border-sky-200 dark:bg-sky-900/30 dark:border-sky-800' : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                                    >
                                        <AdjustmentsHorizontal className="w-4 h-4" />
                                        参数调整
                                    </button>
                                </div>

                                {showConfig && (
                                    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 grid grid-cols-2 gap-4 animate-fade-in">
                                        <div className="col-span-2 text-[10px] text-gray-400 bg-sky-50 dark:bg-sky-900/10 p-2 rounded mb-1">
                                            💡 小说创作建议：温度 0.7-0.9 (更有创意)，核采样 0.9 (标准)
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1.5 flex justify-between">
                                                <span>温度 (Temp)</span>
                                                <span className="text-sky-600">{temperature}</span>
                                            </label>
                                            <input 
                                                type="range" min="0" max="1.5" step="0.1" 
                                                value={temperature}
                                                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                                                className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 accent-sky-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1.5 flex justify-between">
                                                <span>核采样 (Top P)</span>
                                                <span className="text-sky-600">{topP}</span>
                                            </label>
                                            <input 
                                                type="range" min="0" max="1" step="0.05" 
                                                value={topP}
                                                onChange={(e) => setTopP(parseFloat(e.target.value))}
                                                className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 accent-sky-500"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center gap-2 text-gray-800 dark:text-gray-200 font-bold text-sm uppercase tracking-wide">
                                <div className="p-1.5 bg-purple-100 dark:bg-purple-900/30 rounded text-purple-600 dark:text-purple-400">
                                    <Sparkles className="w-4 h-4" />
                                </div>
                                提示词与素材
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <button 
                                    onClick={() => setPromptModalOpen(true)}
                                    className={`p-3 rounded-lg border text-left transition-all flex flex-row justify-center items-center gap-2 group ${
                                        selectedPrompt 
                                        ? 'bg-sky-50 border-sky-300 text-sky-900 dark:bg-sky-900/30 dark:border-sky-700 dark:text-sky-100' 
                                        : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-500 hover:border-sky-400 hover:text-sky-500'
                                    }`}
                                >
                                    <Search className="w-5 h-5 flex-shrink-0" />
                                    <span className="font-bold text-xs">{selectedPrompt ? '更换模板' : '选择提示词模板'}</span>
                                </button>

                                <button 
                                        onClick={() => setAssetModalOpen(true)}
                                        className={`p-3 rounded-lg border text-left transition-all flex flex-row justify-center items-center gap-2 group ${
                                            selectedAssetIds.size > 0
                                            ? 'bg-purple-50 border-purple-300 text-purple-900 dark:bg-purple-900/30 dark:border-purple-700 dark:text-purple-100' 
                                            : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-500 hover:border-purple-400 hover:text-purple-500'
                                        }`}
                                >
                                    <Database className="w-5 h-5 flex-shrink-0" />
                                    <span className="font-bold text-xs">{selectedAssetIds.size > 0 ? `已选 ${selectedAssetIds.size}` : '关联素材'}</span>
                                </button>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <div className="flex items-center gap-2 text-gray-800 dark:text-gray-200 font-bold text-sm uppercase tracking-wide">
                                <div className="p-1.5 bg-green-100 dark:bg-green-900/30 rounded text-green-600 dark:text-green-400">
                                    <Sparkles className="w-4 h-4" />
                                </div>
                                创作内容
                            </div>

                            {selectedPrompt ? (
                                <div className="space-y-4 animate-fade-in">
                                    {selectedPrompt.fields.map(field => (
                                        <div key={field.id}>
                                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                                                {1}. {field.label}
                                                {field.required && <span className="text-red-500 ml-1">*</span>}
                                            </label>
                                            {field.type === 'textarea' ? (
                                                <textarea
                                                    value={formState[field.id] || ''}
                                                    onChange={e => setFormState(prev => ({ ...prev, [field.id]: e.target.value }))}
                                                    placeholder={field.placeholder}
                                                    className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none transition text-sm min-h-[100px]"
                                                />
                                            ) : (
                                                <input
                                                    type="text"
                                                    value={formState[field.id] || ''}
                                                    onChange={e => setFormState(prev => ({ ...prev, [field.id]: e.target.value }))}
                                                    placeholder={field.placeholder}
                                                    className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none transition text-sm"
                                                />
                                            )}
                                            {field.description && <p className="text-xs text-blue-600 dark:text-blue-400 mt-1 font-medium">{field.description}</p>}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <textarea 
                                    value={freeInput}
                                    onChange={e => setFreeInput(e.target.value)}
                                    placeholder="请输入您的创作需求..."
                                    className="w-full h-40 p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none transition text-sm resize-none"
                                />
                            )}
                        </div>
                    </div>

                    <div className="p-5 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
                        <button
                            onClick={handleGenerate}
                            disabled={isGenerating}
                            className={`w-full py-3.5 rounded-xl font-bold text-white shadow-lg shadow-sky-500/30 flex items-center justify-center gap-2 transition-all ${isGenerating ? 'bg-gray-400 cursor-not-allowed' : 'bg-sky-600 hover:bg-sky-500 active:scale-[0.98]'}`}
                        >
                            {isGenerating ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    正在生成...
                                </>
                            ) : (
                                <>
                                    <Sparkles className="w-5 h-5" />
                                    开始生成
                                </>
                            )}
                        </button>
                    </div>
                </div>

                <div className="flex-1 bg-gray-100 dark:bg-black/50 overflow-y-auto p-4 lg:p-8 flex flex-col items-center">
                    <div className="w-full max-w-3xl bg-white dark:bg-gray-900 min-h-[calc(100vh-8rem)] rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 p-8 relative flex flex-col">
                        {!generatedText ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 opacity-50">
                                <Sparkles className="w-20 h-20 mb-6" />
                                <p className="text-lg font-medium">配置左侧参数，开始创作</p>
                            </div>
                        ) : (
                            <>
                                <div className="flex justify-end gap-3 mb-6 sticky top-0 bg-white dark:bg-gray-900 pb-4 border-b border-gray-100 dark:border-gray-800 z-10">
                                    <button onClick={handleCopy} className="text-gray-500 hover:text-sky-600 flex items-center gap-1.5 text-sm font-bold px-3 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                                        <Copy className="w-4 h-4" /> 复制
                                    </button>
                                    <button onClick={() => setImportModalOpen(true)} className="text-gray-500 hover:text-purple-600 flex items-center gap-1.5 text-sm font-bold px-3 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                                        <Database className="w-4 h-4" /> 存入素材
                                    </button>
                                </div>
                                <FormattedText text={generatedText} />
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CreativeGeneration;
