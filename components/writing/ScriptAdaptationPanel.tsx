
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Asset, Prompt, Workflow } from '../../types';
import { generateText, generateTextStream } from '../../services/geminiService';
import { fetchMaterials, incrementPromptHeat } from '../../services/supabaseService';
import { PROMPTS, WORKFLOWS } from '../../constants';
import { Film, Sparkles, Workflow as WorkflowIcon, ChevronDown, Database, Copy, X } from '../Icon';
import PromptSelectionModal from '../PromptSelectionModal';
import LoadingOverlay from '../LoadingOverlay';

interface ScriptAdaptationPanelProps {
    onInsert: (text: string) => void;
    onStream?: (text: string, isFirst: boolean) => void;
}

type SelectionMode = 'prompt' | 'workflow';
type WorkflowType = Workflow;

const AssetSelectionModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    assets: Asset[];
    selectedAssetIds: Set<string>;
    onToggleAsset: (id: string) => void;
}> = ({ isOpen, onClose, assets, selectedAssetIds, onToggleAsset }) => {
    if (!isOpen) return null;
    return createPortal(
        <div className="fixed inset-0 bg-black/60 dark:bg-black/80 flex items-center justify-center z-[100] p-4 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-2xl p-6 flex flex-col max-h-[85vh] animate-fade-in-up" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">选择素材</h3>
                    <button onClick={onClose}><X className="w-5 h-5 text-gray-500" /></button>
                </div>
                <div className="flex-1 overflow-y-auto space-y-3 p-1">
                    {assets.map(asset => (
                        <div key={asset.id} 
                             onClick={() => onToggleAsset(asset.id)}
                             className={`p-4 rounded-lg border cursor-pointer transition-all ${selectedAssetIds.has(asset.id) ? 'border-sky-500 bg-sky-50 dark:bg-sky-900/20' : 'border-gray-200 dark:border-gray-800 hover:border-sky-300'}`}
                        >
                            <div className="flex justify-between items-center">
                                <h4 className="font-bold text-gray-800 dark:text-gray-200">{asset.name}</h4>
                                {selectedAssetIds.has(asset.id) && <div className="w-3 h-3 bg-sky-500 rounded-full" />}
                            </div>
                            <p className="text-xs text-gray-500 mt-1 line-clamp-2">{asset.content}</p>
                        </div>
                    ))}
                    {assets.length === 0 && <div className="text-center text-gray-500 py-8">暂无素材</div>}
                </div>
                <button onClick={onClose} className="mt-4 w-full py-2 bg-sky-600 text-white rounded-lg font-bold">确定</button>
            </div>
        </div>,
        document.body
    );
};

const WorkflowSelectionModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onSelectWorkflow: (workflow: Workflow) => void;
}> = ({ isOpen, onClose, onSelectWorkflow }) => {
    if (!isOpen) return null;
    return createPortal(
        <div className="fixed inset-0 bg-black/60 dark:bg-black/80 flex items-center justify-center z-[100] p-4 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col animate-fade-in-up" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-800">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">选择工作流</h3>
                    <button onClick={onClose}><X className="w-5 h-5 text-gray-500" /></button>
                </div>
                <div className="flex-1 overflow-y-auto p-6 bg-gray-50 dark:bg-black/20">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {WORKFLOWS.map(w => (
                            <div key={w.id} onClick={() => { onSelectWorkflow(w); onClose(); }} className="cursor-pointer bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-sky-500 transition-all">
                                <h4 className="font-bold text-gray-900 dark:text-white mb-2">{w.title}</h4>
                                <p className="text-sm text-gray-500 dark:text-gray-400">{w.description}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

const ScriptAdaptationPanel: React.FC<ScriptAdaptationPanelProps> = ({ onInsert, onStream }) => {
    const [model, setModel] = useState('gemini-2.5-flash');
    const [temperature, setTemperature] = useState(1);
    const [topP, setTopP] = useState(0.95);
    const [selectionMode, setSelectionMode] = useState<SelectionMode>('prompt');
    const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);
    const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowType | null>(null);
    const [selectedAssetIds, setSelectedAssetIds] = useState<Set<string>>(new Set());
    const [assets, setAssets] = useState<Asset[]>([]);
    
    // Modals
    const [isAssetModalOpen, setAssetModalOpen] = useState(false);
    const [isSelectionModalOpen, setSelectionModalOpen] = useState(false);
    const [isWorkflowModalOpen, setWorkflowModalOpen] = useState(false);

    // Form State (Dynamic based on selection)
    const [formState, setFormState] = useState<Record<string, string>>({});
    
    // Result
    const [isLoading, setIsLoading] = useState(false);
    const [showLoadingOverlay, setShowLoadingOverlay] = useState(false);
    const [overlayStatus, setOverlayStatus] = useState<'loading' | 'success'>('loading');
    const [generatedText, setGeneratedText] = useState('');
    const [error, setError] = useState('');
    
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

    // Initialize form state when selection changes
    useEffect(() => {
        const newForm: Record<string, string> = {};
        if (selectionMode === 'prompt' && selectedPrompt) {
            selectedPrompt.fields.forEach(f => newForm[f.id] = '');
        } else if (selectionMode === 'workflow' && selectedWorkflow) {
            selectedWorkflow.fields?.forEach(f => newForm[f.variable] = '');
        }
        setFormState(newForm);
        setGeneratedText('');
        setError('');
    }, [selectedPrompt, selectedWorkflow, selectionMode]);

    const handleStop = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
        setIsLoading(false);
        setShowLoadingOverlay(false);
    };

    const handleGenerate = async () => {
        setIsLoading(true);
        setOverlayStatus('loading');
        setShowLoadingOverlay(true);
        setGeneratedText('');
        setError('');

        const controller = new AbortController();
        abortControllerRef.current = controller;

        try {
            // 1. Build Asset Context
            const assetContext = Array.from(selectedAssetIds)
                .map(id => assets.find(a => a.id === id))
                .filter(Boolean)
                .map(a => `【参考素材：${a!.name}】\n${a!.content}`)
                .join('\n\n');

            // 2. Build Prompt
            let finalPrompt = '';
            let template = '';
            
            if (selectionMode === 'prompt' && selectedPrompt) {
                incrementPromptHeat(selectedPrompt.id); // Increment usage if prompt selected
                
                template = selectedPrompt.template || selectedPrompt.content;
                for (const field of selectedPrompt.fields) {
                    const val = formState[field.id] || '';
                    template = template.replace(new RegExp(`\\$\\{${field.id}\\}`, 'g'), val);
                }
            } else if (selectionMode === 'workflow' && selectedWorkflow) {
                template = selectedWorkflow.template || '';
                selectedWorkflow.fields?.forEach(field => {
                     const val = formState[field.variable] || '';
                     template = template.replace(new RegExp(`\\$\\{${field.variable}\\}`, 'g'), val);
                });
            } else {
                // No prompt/workflow selected
                throw new Error("请选择一个提示词模板或工作流");
            }

             finalPrompt = `${assetContext ? `关联素材：\n${assetContext}\n\n---\n\n` : ''}${template}`;

            if (onStream) {
                const stream = generateTextStream(finalPrompt, { model, temperature, topP, signal: controller.signal });
                let isFirst = true;
                let fullText = '';
                for await (const chunk of stream) {
                    if (isFirst) {
                        setShowLoadingOverlay(false);
                    }
                    onStream(chunk, isFirst);
                    fullText += chunk;
                    setGeneratedText(fullText);
                    isFirst = false;
                }
                setOverlayStatus('success');
            } else {
                const result = await generateText(finalPrompt, { model, temperature, topP, signal: controller.signal });
                setGeneratedText(result);
                setOverlayStatus('success');
            }

        } catch (err: any) {
            if (err.message !== 'Aborted') {
                setError(err.message || '生成失败');
                setShowLoadingOverlay(false);
            }
        } finally {
            setIsLoading(false);
            abortControllerRef.current = null;
        }
    };

    const handleInputChange = (key: string, val: string) => {
        setFormState(prev => ({ ...prev, [key]: val }));
    };

    // Helper to render fields
    const renderFields = () => {
        let fields: { id: string; label: string; placeholder?: string; type: 'text' | 'textarea' }[] = [];
        
        if (selectionMode === 'prompt' && selectedPrompt) {
            fields = selectedPrompt.fields.map(f => ({ ...f, id: f.id }));
        } else if (selectionMode === 'workflow' && selectedWorkflow && selectedWorkflow.fields) {
            fields = selectedWorkflow.fields.map(f => ({ id: f.variable, label: f.label, type: f.type, placeholder: '' }));
        } else {
             return (
                 <div className="text-center py-8 text-gray-400 text-sm border border-dashed border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900/50">
                     请先选择一个{selectionMode === 'prompt' ? '提示词模板' : '工作流'}
                 </div>
             )
        }

        return (
            <div className="space-y-4">
                {fields.map(field => (
                    <div key={field.id}>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                            {field.label}
                        </label>
                         {field.type === 'textarea' ? (
                            <textarea 
                                value={formState[field.id] || ''}
                                onChange={e => handleInputChange(field.id, e.target.value)}
                                placeholder={field.placeholder}
                                className="w-full p-3 text-sm bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-sky-500 focus:outline-none resize-none shadow-sm h-32"
                            />
                        ) : (
                            <input 
                                type="text"
                                value={formState[field.id] || ''}
                                onChange={e => handleInputChange(field.id, e.target.value)}
                                placeholder={field.placeholder}
                                className="w-full p-3 text-sm bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-sky-500 focus:outline-none shadow-sm"
                            />
                        )}
                    </div>
                ))}
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-black border-l border-gray-200 dark:border-gray-800 w-full">
            <LoadingOverlay 
                isVisible={showLoadingOverlay} 
                onClose={() => setShowLoadingOverlay(false)}
                onStop={handleStop}
                status={overlayStatus}
            />
            {/* Header */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex items-center gap-2 text-gray-900 dark:text-white font-bold">
                <Film className="w-5 h-5 text-sky-500" />
                分集改编
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                 {/* Modals */}
                 <AssetSelectionModal 
                    isOpen={isAssetModalOpen}
                    onClose={() => setAssetModalOpen(false)}
                    assets={assets}
                    selectedAssetIds={selectedAssetIds}
                    onToggleAsset={(id) => setSelectedAssetIds(prev => {
                        const next = new Set(prev);
                        if (next.has(id)) next.delete(id);
                        else next.add(id);
                        return next;
                    })}
                 />
                 <PromptSelectionModal 
                    isOpen={isSelectionModalOpen}
                    onClose={() => setSelectionModalOpen(false)}
                    onSelect={(prompt) => {
                        setSelectedPrompt(prompt);
                        setSelectionModalOpen(false);
                    }}
                 />
                 <WorkflowSelectionModal
                    isOpen={isWorkflowModalOpen}
                    onClose={() => setWorkflowModalOpen(false)}
                    onSelectWorkflow={setSelectedWorkflow}
                 />

                {/* Configuration Card */}
                <div className="bg-white dark:bg-gray-900 p-5 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-5">
                    {/* 1. Model Selection */}
                    <div>
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">模型选择</label>
                        <select 
                            value={model} 
                            onChange={e => setModel(e.target.value)} 
                            className="w-full p-2.5 text-sm rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-sky-500 focus:outline-none transition"
                        >
                            <option value="gemini-2.5-flash">Gemini 2.5 Flash (快速)</option>
                            <option value="gemini-2.5-pro">Gemini 2.5 Pro (深度)</option>
                            <option value="deepseek-chat">DeepSeek V3</option>
                            <option value="deepseek-reasoner">DeepSeek R1 (推理)</option>
                        </select>
                    </div>

                    {/* Parameters Sliders */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 flex justify-between">
                                <span>随机性 (Temperature)</span>
                                <span className="text-gray-700 dark:text-gray-300">{temperature}</span>
                            </label>
                            <input 
                                type="range" min="0" max="2" step="0.1" 
                                value={temperature} 
                                onChange={e => setTemperature(parseFloat(e.target.value))}
                                className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 accent-sky-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 flex justify-between">
                                <span>核采样 (Top P)</span>
                                <span className="text-gray-700 dark:text-gray-300">{topP}</span>
                            </label>
                            <input 
                                type="range" min="0" max="1" step="0.05" 
                                value={topP} 
                                onChange={e => setTopP(parseFloat(e.target.value))}
                                className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 accent-sky-500"
                            />
                        </div>
                    </div>

                    {/* 2. Selection Mode (Prompt vs Workflow) */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                             <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">生成方式</label>
                             <div className="flex bg-gray-100 dark:bg-gray-800 rounded-md p-0.5">
                                 <button 
                                    onClick={() => setSelectionMode('prompt')}
                                    className={`px-2 py-0.5 text-xs rounded transition-colors ${selectionMode === 'prompt' ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}
                                 >
                                     提示词
                                 </button>
                                 <button 
                                    onClick={() => setSelectionMode('workflow')}
                                    className={`px-2 py-0.5 text-xs rounded transition-colors ${selectionMode === 'workflow' ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}
                                 >
                                     工作流
                                 </button>
                             </div>
                        </div>

                        <button 
                            onClick={() => selectionMode === 'prompt' ? setSelectionModalOpen(true) : setWorkflowModalOpen(true)}
                            className={`w-full p-3 rounded-lg border text-left transition-all group relative overflow-hidden flex items-center justify-between ${
                                (selectionMode === 'prompt' ? selectedPrompt : selectedWorkflow)
                                ? 'bg-sky-50 border-sky-300 text-sky-900 dark:bg-sky-900/30 dark:border-sky-700 dark:text-sky-100' 
                                : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500 hover:border-sky-400'
                            }`}
                        >
                            <div className="flex items-center gap-2 truncate">
                                {selectionMode === 'prompt' ? <Sparkles className="w-4 h-4" /> : <WorkflowIcon className="w-4 h-4" />}
                                <span className="truncate font-medium">
                                    {selectionMode === 'prompt' 
                                        ? (selectedPrompt ? selectedPrompt.title : '选择提示词模板')
                                        : (selectedWorkflow ? selectedWorkflow.title : '选择工作流')
                                    }
                                </span>
                            </div>
                            <ChevronDown className="w-4 h-4 opacity-50" />
                        </button>
                    </div>

                     {/* 3. Asset Association */}
                     <div>
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">关联素材 (可选)</label>
                        <button 
                            onClick={() => setAssetModalOpen(true)}
                            className={`w-full p-3 rounded-lg border text-left transition-all flex items-center justify-between ${
                                selectedAssetIds.size > 0 
                                ? 'bg-purple-50 border-purple-300 text-purple-900 dark:bg-purple-900/30 dark:border-purple-700 dark:text-purple-100' 
                                : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500 hover:border-purple-400'
                            }`}
                        >
                            <div className="flex items-center gap-2">
                                <Database className="w-4 h-4" />
                                <span className="font-medium">{selectedAssetIds.size > 0 ? `已关联 ${selectedAssetIds.size} 个素材` : '选择素材...'}</span>
                            </div>
                            {selectedAssetIds.size > 0 && <span className="text-xs bg-purple-200 dark:bg-purple-800 px-1.5 py-0.5 rounded text-purple-800 dark:text-purple-200">{selectedAssetIds.size}</span>}
                        </button>
                     </div>
                </div>

                {/* Dynamic Inputs */}
                <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-200 mb-2">输入参数</label>
                    {renderFields()}
                </div>

                {/* Action */}
                <button 
                    onClick={handleGenerate}
                    disabled={isLoading || (selectionMode === 'prompt' && !selectedPrompt) || (selectionMode === 'workflow' && !selectedWorkflow)}
                    className="w-full py-3 bg-sky-600 text-white font-bold rounded-xl hover:bg-sky-500 disabled:bg-gray-400 transition-all shadow-lg hover:shadow-sky-500/30 flex items-center justify-center gap-2"
                >
                     {isLoading ? (
                        <>
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            改编中...
                        </>
                    ) : (
                        <>
                            <Film className="w-5 h-5" />
                            开始改编
                        </>
                    )}
                </button>

                {/* Error */}
                {error && <div className="text-red-500 text-sm bg-red-50 p-2 rounded">{error}</div>}

                {/* Result */}
                {generatedText && (
                    <div className="bg-white dark:bg-gray-900 p-4 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm">
                        <div className="flex justify-between items-center mb-2">
                            <h4 className="font-bold text-gray-700 dark:text-gray-300">生成结果</h4>
                            <div className="flex gap-2">
                                <button onClick={() => navigator.clipboard.writeText(generatedText)} title="复制"><Copy className="w-4 h-4 text-gray-500 hover:text-sky-500" /></button>
                                <button onClick={() => onInsert(generatedText)} title="插入到编辑器" className="text-sky-600 text-xs font-bold hover:underline">插入正文</button>
                            </div>
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto font-mono">
                            {generatedText}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ScriptAdaptationPanel;
