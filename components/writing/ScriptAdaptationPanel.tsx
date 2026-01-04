
import React, { useState, useEffect, useMemo, useRef } from 'react';
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

const CollapsibleSection: React.FC<{ title: string; icon: any; color: string; children: React.ReactNode; defaultOpen?: boolean }> = ({ title, icon: Icon, color, children, defaultOpen = true }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    return (
        <div className={`rounded-xl border transition-all ${isOpen ? `bg-${color}-50/30 dark:bg-${color}-900/10 border-${color}-200 dark:border-${color}-800` : `bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800`}`}>
            <button onClick={() => setIsOpen(!isOpen)} className="w-full flex items-center justify-between p-3">
                <div className={`flex items-center gap-2 text-xs font-bold uppercase tracking-wider ${isOpen ? `text-${color}-600 dark:text-${color}-400` : 'text-gray-500'}`}>
                    <Icon className="w-4 h-4" />
                    {title}
                </div>
                <ChevronDown className={`w-3 h-3 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && <div className="px-3 pb-3">{children}</div>}
        </div>
    );
};

const ScriptAdaptationPanel: React.FC<ScriptAdaptationPanelProps> = ({ onInsert, onStream }) => {
    const [model, setModel] = useState('deepseek-chat');
    const [temperature, setTemperature] = useState(1);
    const [topP, setTopP] = useState(0.95);
    const [maxOutputTokens, setMaxOutputTokens] = useState(8192);
    const [showConfig, setShowConfig] = useState(false);

    const [selectionMode, setSelectionMode] = useState<SelectionMode>('prompt');
    const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);
    const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowType | null>(null);
    const [selectedAssetIds, setSelectedAssetIds] = useState<Set<string>>(new Set());
    const [assets, setAssets] = useState<Asset[]>([]);
    
    const [isAssetModalOpen, setAssetModalOpen] = useState(false);
    const [isPromptModalOpen, setPromptModalOpen] = useState(false);
    const [promptFilterType, setPromptFilterType] = useState<'requirements' | 'style'>('requirements');

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

    const selectedAssetNames = useMemo(() => {
        return Array.from(selectedAssetIds)
            .map(id => assets.find(a => a.id === id)?.name)
            .filter(Boolean)
            .join(', ');
    }, [selectedAssetIds, assets]);

    useEffect(() => {
        setFormState({});
        setGeneratedText('');
        setError('');
    }, [selectedPrompt, selectedWorkflow, selectionMode]);

    const handleOpenPromptModal = (filter: 'requirements' | 'style') => {
        setPromptFilterType(filter);
        setPromptModalOpen(true);
    };

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
                const stream = generateTextStream(finalPrompt, { 
                    model, 
                    temperature, 
                    topP, 
                    maxOutputTokens, 
                    signal: controller.signal 
                });
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
                const result = await generateText(finalPrompt, { 
                    model, 
                    temperature, 
                    topP, 
                    maxOutputTokens, 
                    signal: controller.signal 
                });
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
        <div className="flex flex-col h-full bg-gray-50 dark:bg-black border-l border-gray-200 dark:border-gray-800 w-full font-sans">
            <LoadingOverlay isVisible={showLoadingOverlay} onClose={() => setShowLoadingOverlay(false)} onStop={handleStop} status={overlayStatus} />
            <AssetSelectionModal isOpen={isAssetModalOpen} onClose={() => setAssetModalOpen(false)} assets={assets} selectedAssetIds={selectedAssetIds} onToggleAsset={(id) => setSelectedAssetIds(prev => { const next = new Set(prev); if(next.has(id)) next.delete(id); else next.add(id); return next; })} />
            <PromptSelectionModal isOpen={isPromptModalOpen} onClose={() => setPromptModalOpen(false)} onSelect={(prompt) => { setSelectedPrompt(prompt); setPromptModalOpen(false); }} initialSubCategory={promptFilterType} />
            
            <div className="p-4 border-b border-gray-200 bg-white dark:bg-gray-900 flex items-center gap-2 font-bold font-sans"><Film className="w-5 h-5 text-sky-500" />分集改编</div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 font-sans">
                <CollapsibleSection title="模型配置" icon={AdjustmentsHorizontal} color="sky">
                    <div className="flex flex-col gap-2 font-sans">
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <select value={model} onChange={e => setModel(e.target.value)} className="w-full py-2 pl-3 pr-8 text-xs font-medium rounded-lg bg-gray-50 dark:bg-gray-800 border focus:ring-1 focus:ring-sky-500 outline-none appearance-none cursor-pointer font-sans">
                                    <option value="deepseek-chat">奇思版 (DeepSeek)</option>
                                    <option value="gemini-2.0-flash">妙写版 (Gemini)</option>
                                    <option value="doubao-flash">速写版 (豆包)</option>
                                </select>
                                <ChevronDown className="w-3 h-3 text-gray-400 absolute right-2.5 top-3 pointer-events-none" />
                            </div>
                            <button onClick={() => setShowConfig(!showConfig)} className="px-3 py-2 text-xs font-bold rounded-lg border transition-all flex items-center gap-1 font-sans"><AdjustmentsHorizontal className="w-4 h-4" />参数</button>
                        </div>
                    </div>

                    {showConfig && (
                        <div className="mt-3 bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg border border-gray-100 dark:border-gray-800 grid grid-cols-1 gap-4 animate-fade-in text-[10px] font-sans">
                            <div className="space-y-1">
                                <label className="block font-black text-sky-500 flex justify-between uppercase">
                                    <span>温度 (Temperature): {temperature}</span>
                                </label>
                                <input type="range" min="0" max="1.5" step="0.1" value={temperature} onChange={e => setTemperature(parseFloat(e.target.value))} className="w-full h-1 bg-sky-200 rounded-lg appearance-none cursor-pointer accent-sky-500" />
                            </div>
                            <div className="space-y-1">
                                <label className="block font-black text-sky-500 flex justify-between uppercase">
                                    <span>核采样 (Top P): {topP}</span>
                                </label>
                                <input type="range" min="0" max="1" step="0.05" value={topP} onChange={e => setTopP(parseFloat(e.target.value))} className="w-full h-1 bg-sky-200 rounded-lg appearance-none cursor-pointer accent-sky-500" />
                            </div>
                            <div className="space-y-1">
                                <label className="block font-black text-sky-500 flex justify-between uppercase"><span>最大长度 (Max Tokens): {maxOutputTokens}</span></label>
                                <input type="range" min="1024" max="16384" step="1024" value={maxOutputTokens} onChange={e => setMaxOutputTokens(parseInt(e.target.value))} className="w-full h-1 bg-sky-200 rounded-lg appearance-none cursor-pointer accent-sky-500" />
                            </div>
                        </div>
                    )}
                </CollapsibleSection>

                <CollapsibleSection title="写作要求 & 风格" icon={Sparkles} color="purple">
                    <div className="grid grid-cols-2 gap-3 font-sans">
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">写作要求</label>
                            <button onClick={() => handleOpenPromptModal('requirements')} className={`w-full p-2.5 rounded-lg border text-left transition-all relative overflow-hidden font-sans ${selectedPrompt && selectedPrompt.subCategories.includes('requirements') ? 'bg-purple-50 border-purple-300 text-purple-900' : 'bg-gray-50 dark:bg-gray-800 border-gray-200 text-gray-500 hover:border-purple-400'}`}>
                                <div className="flex items-center justify-between text-[11px] font-semibold truncate">
                                    <span>{selectedPrompt && selectedPrompt.subCategories.includes('requirements') ? selectedPrompt.title : '选择要求...'}</span>
                                    <ChevronDown className="w-3 h-3 opacity-50" />
                                </div>
                            </button>
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">写作风格</label>
                            <button onClick={() => handleOpenPromptModal('style')} className={`w-full p-2.5 rounded-lg border text-left transition-all relative overflow-hidden font-sans ${selectedPrompt && selectedPrompt.subCategories.includes('style') ? 'bg-pink-50 border-pink-300 text-pink-900' : 'bg-gray-50 dark:bg-gray-800 border-gray-200 text-gray-500 hover:border-pink-400'}`}>
                                <div className="flex items-center justify-between text-[11px] font-semibold truncate">
                                    <span>{selectedPrompt && selectedPrompt.subCategories.includes('style') ? selectedPrompt.title : '选择风格...'}</span>
                                    <ChevronDown className="w-3 h-3 opacity-50" />
                                </div>
                            </button>
                        </div>
                    </div>
                </CollapsibleSection>

                <CollapsibleSection title="关联素材" icon={Database} color="amber">
                    <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">素材选择</label>
                        <button onClick={() => setAssetModalOpen(true)} className={`w-full p-2.5 rounded-lg border text-left transition-all font-sans ${selectedAssetIds.size > 0 ? 'bg-amber-50 border-amber-300 text-amber-900' : 'bg-gray-50 dark:bg-gray-800 border-gray-200 text-gray-500 hover:border-amber-400'}`}>
                            <div className="flex items-center justify-between text-[11px] font-semibold truncate">
                                <div className="flex items-center gap-1.5 overflow-hidden">
                                    <Database className={`w-3.5 h-3.5 flex-shrink-0 ${selectedAssetIds.size > 0 ? 'text-amber-600' : 'text-gray-400'}`} />
                                    <span className="truncate">{selectedAssetIds.size > 0 ? selectedAssetNames : '点击关联设定...'}</span>
                                </div>
                                <ChevronDown className="w-3 h-3 opacity-50 flex-shrink-0" />
                            </div>
                        </button>
                    </div>
                </CollapsibleSection>

                <button onClick={isLoading ? handleStop : handleGenerate} className="w-full py-3.5 font-bold rounded-xl transition-all shadow-lg active:scale-[0.98] flex items-center justify-center gap-2 bg-sky-600 text-white font-sans">
                     {isLoading ? <><Stop className="w-5 h-5" />停止</> : <><Film className="w-5 h-5" />开始改编</>}
                </button>
            </div>
        </div>
    );
};

export default ScriptAdaptationPanel;
