
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Asset, Prompt, Workflow } from '../../types';
import { generateText, generateTextStream } from '../../services/geminiService';
import { fetchMaterials, incrementPromptHeat } from '../../services/supabaseService';
import { PROMPTS, WORKFLOWS } from '../../constants';
import { Film, Sparkles, Workflow as WorkflowIcon, ChevronDown, Database, Copy, X, Stop, AdjustmentsHorizontal, Search, InformationCircle } from '../Icon';
import PromptSelectionModal from '../PromptSelectionModal';
import AssetSelectionModal from '../AssetSelectionModal';
import LoadingOverlay from '../LoadingOverlay';

interface ScriptAdaptationPanelProps {
    onInsert: (text: string) => void;
    onStream?: (text: string, isFirst: boolean) => void;
}

type SelectionMode = 'prompt' | 'workflow';
type WorkflowType = Workflow;

const ScriptAdaptationPanel: React.FC<ScriptAdaptationPanelProps> = ({ onInsert, onStream }) => {
    const [model, setModel] = useState('deepseek-chat');
    const [temperature, setTemperature] = useState(1);
    const [topP, setTopP] = useState(0.95);
    const [showConfig, setShowConfig] = useState(false);

    const [selectionMode, setSelectionMode] = useState<SelectionMode>('prompt');
    const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);
    const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowType | null>(null);
    const [selectedAssetIds, setSelectedAssetIds] = useState<Set<string>>(new Set());
    const [assets, setAssets] = useState<Asset[]>([]);
    
    const [isAssetModalOpen, setAssetModalOpen] = useState(false);
    const [isSelectionModalOpen, setSelectionModalOpen] = useState(false);
    const [isWorkflowModalOpen, setWorkflowModalOpen] = useState(false);

    const [formState, setFormState] = useState<Record<string, string>>({});
    const [isLoading, setIsLoading] = useState(false);
    const [showLoadingOverlay, setShowLoadingOverlay] = useState(false);
    const [overlayStatus, setOverlayStatus] = useState<'loading' | 'success'>('loading');
    const [generatedText, setGeneratedText] = useState('');
    const [error, setError] = useState('');
    
    const abortControllerRef = useRef<AbortController | null>(null);

    useEffect(() => {
        const loadAssets = async () => {
            const data = await fetchMaterials();
            setAssets(data.map((item: any) => ({
                id: item.id,
                name: item.name || item.title,
                type: item.type === 'idea' ? 'inspiration' : item.type,
                content: item.content,
                tags: item.tags || [],
                data: { name: item.name }
            })));
        };
        loadAssets();
    }, []);

    useEffect(() => {
        setFormState({});
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
            const assetContext = Array.from(selectedAssetIds)
                .map(id => assets.find(a => a.id === id))
                .filter(Boolean)
                .map(a => `【参考素材：${a!.name}】\n${a!.content}`)
                .join('\n\n');

            let finalPrompt = '';
            let template = '';
            
            if (selectionMode === 'prompt' && selectedPrompt) {
                incrementPromptHeat(selectedPrompt.id);
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
                throw new Error("请选择一个提示词模板或工作流");
            }

            finalPrompt = `${assetContext ? `关联素材：\n${assetContext}\n\n---\n\n` : ''}${template}`;

            if (onStream) {
                const stream = generateTextStream(finalPrompt, { model, temperature, topP, signal: controller.signal });
                let isFirst = true;
                let fullText = '';
                for await (const chunk of stream) {
                    if (isFirst) setShowLoadingOverlay(false);
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

    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-black border-l border-gray-200 dark:border-gray-800 w-full">
            <LoadingOverlay isVisible={showLoadingOverlay} onClose={() => setShowLoadingOverlay(false)} onStop={handleStop} status={overlayStatus} />
            <div className="p-4 border-b border-gray-200 bg-white dark:bg-gray-900 flex items-center gap-2 font-bold"><Film className="w-5 h-5 text-sky-500" />分集改编</div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                <div className="bg-white dark:bg-gray-900 p-5 rounded-xl border shadow-sm space-y-5">
                    <div className="flex flex-col gap-2">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">模型配置</label>
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <select value={model} onChange={e => setModel(e.target.value)} className="w-full py-2 pl-3 pr-8 text-xs font-medium rounded-lg bg-gray-50 dark:bg-gray-800 border focus:ring-1 focus:ring-sky-500 outline-none appearance-none cursor-pointer">
                                    <option value="deepseek-chat">DeepSeek V3</option>
                                    <option value="gemini-3-flash-preview">Gemini 3 Flash</option>
                                </select>
                                <ChevronDown className="w-3 h-3 text-gray-400 absolute right-2.5 top-3 pointer-events-none" />
                            </div>
                            <button onClick={() => setShowConfig(!showConfig)} className="px-3 py-2 text-xs font-bold rounded-lg border transition-all flex items-center gap-1"><AdjustmentsHorizontal className="w-4 h-4" />参数</button>
                        </div>
                    </div>

                    {showConfig && (
                        <div className="bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg border border-gray-100 dark:border-gray-800 grid grid-cols-1 gap-4 animate-fade-in text-[10px]">
                            <div className="space-y-1">
                                <label className="block font-black text-sky-500 flex justify-between uppercase">
                                    <span>温度 (Temperature): {temperature}</span>
                                </label>
                                <input type="range" min="0" max="1.5" step="0.1" value={temperature} onChange={e => setTemperature(parseFloat(e.target.value))} className="w-full h-1 bg-sky-200 rounded-lg appearance-none cursor-pointer accent-sky-500" />
                                <p className="text-gray-400 leading-tight">控制改编忠实度。低值更忠于原文，高值更具改编创意。</p>
                            </div>
                            <div className="space-y-1">
                                <label className="block font-black text-sky-500 flex justify-between uppercase">
                                    <span>核采样 (Top P): {topP}</span>
                                </label>
                                <input type="range" min="0" max="1" step="0.05" value={topP} onChange={e => setTopP(parseFloat(e.target.value))} className="w-full h-1 bg-sky-200 rounded-lg appearance-none cursor-pointer accent-sky-500" />
                                <p className="text-gray-400 leading-tight">控制台词改编的多样性水平。</p>
                            </div>
                        </div>
                    )}
                    {/* ... rest of selection logic ... */}
                    <button onClick={isLoading ? handleStop : handleGenerate} className="w-full py-3.5 font-bold rounded-xl transition-all shadow-lg active:scale-[0.98] flex items-center justify-center gap-2 bg-sky-600 text-white">
                         {isLoading ? <><Stop className="w-5 h-5" />停止</> : <><Film className="w-5 h-5" />开始改编</>}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ScriptAdaptationPanel;
