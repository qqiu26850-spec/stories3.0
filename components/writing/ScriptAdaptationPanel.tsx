
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Asset, Prompt, Workflow } from '../../types';
import { generateText, generateTextStream } from '../../services/geminiService';
import { fetchMaterials, incrementPromptHeat } from '../../services/supabaseService';
import { PROMPTS, WORKFLOWS } from '../../constants';
import { Film, Sparkles, Workflow as WorkflowIcon, ChevronDown, Database, Copy, X, Stop, AdjustmentsHorizontal, Search, InformationCircle, Check } from '../Icon';
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
    const themeColor = 'sky';

    return (
        <div className={`rounded-xl border transition-all ${isOpen ? `bg-${themeColor}-50/30 dark:bg-${themeColor}-900/10 border-${themeColor}-100 dark:border-${themeColor}-900` : `bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800`}`}>
            <button onClick={() => setIsOpen(!isOpen)} className="w-full flex items-center justify-between p-3">
                <div className={`flex items-center gap-2 text-xs font-bold uppercase tracking-wider ${isOpen ? `text-${themeColor}-600 dark:text-${themeColor}-400` : 'text-gray-500'}`}>
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

            <div className="flex-1 overflow-y-auto p-2 space-y-3 font-sans dynamic-scrollbar">
                <CollapsibleSection title="模型配置" icon={AdjustmentsHorizontal} color="sky">
                    <div className="flex flex-col gap-2 font-sans">
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <select value={model} onChange={e => setModel(e.target.value)} className="w-full py-1.5 pl-2 pr-6 text-xs font-medium rounded-lg bg-white dark:bg-gray-800 border border-sky-100 dark:border-sky-800 focus:ring-1 focus:ring-sky-500 outline-none appearance-none cursor-pointer">
                                    <option value="deepseek-chat">奇思版 (DeepSeek)</option>
                                    <option value="gemini-2.0-flash">妙写版 (Gemini)</option>
                                    <option value="doubao-flash">速写版 (豆包)</option>
                                </select>
                                <ChevronDown className="w-3 h-3 text-sky-400 absolute right-2 top-2.5 pointer-events-none" />
                            </div>
                            <button onClick={() => setShowConfig(!showConfig)} className="px-2 py-1.5 text-xs font-bold rounded-lg border border-sky-100 transition-all flex items-center gap-1 font-sans bg-white hover:bg-sky-50 text-gray-500 hover:text-sky-600"><AdjustmentsHorizontal className="w-4 h-4" />参数</button>
                        </div>
                    </div>

                    {showConfig && (
                        <div className="mt-2 bg-white/50 dark:bg-black/20 p-2 rounded-lg border border-sky-100 dark:border-sky-800 grid grid-cols-1 gap-2 animate-fade-in text-[10px]">
                            <div className="space-y-1">
                                <label className="block font-bold text-sky-500 flex justify-between uppercase">
                                    <span>温度: {temperature}</span>
                                </label>
                                <input type="range" min="0" max="1.5" step="0.1" value={temperature} onChange={e => setTemperature(parseFloat(e.target.value))} className="w-full h-1 bg-sky-200 rounded-lg appearance-none cursor-pointer accent-sky-500" />
                            </div>
                            <div className="space-y-1">
                                <label className="block font-bold text-sky-500 flex justify-between uppercase">
                                    <span>核采样: {topP}</span>
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

                <CollapsibleSection title="写作要求 & 风格" icon={Sparkles} color="sky">
                    <div className="flex flex-col gap-2 font-sans">
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-sky-600 dark:text-sky-400 uppercase tracking-wider">写作要求</label>
                            <button onClick={() => handleOpenPromptModal('requirements')} className={`w-full p-2 rounded-lg border border-sky-100 dark:border-sky-800 bg-white dark:bg-gray-800 text-left transition-all relative overflow-hidden group hover:border-sky-300`}>
                                <div className="flex items-center justify-between text-[11px] font-semibold truncate text-gray-600 dark:text-gray-300">
                                    <span>{selectedPrompt && selectedPrompt.subCategories.includes('requirements') ? selectedPrompt.title : '选择要求...'}</span>
                                    <ChevronDown className="w-3 h-3 text-sky-400 opacity-50" />
                                </div>
                            </button>
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-bold text-sky-600 dark:text-sky-400 uppercase tracking-wider">写作风格</label>
                            <button onClick={() => handleOpenPromptModal('style')} className={`w-full p-2 rounded-lg border text-left transition-all relative overflow-hidden font-sans ${selectedPrompt && selectedPrompt.subCategories.includes('style') ? 'bg-pink-50 border-pink-300 text-pink-900' : 'bg-white dark:bg-gray-800 border-sky-100 dark:border-sky-800 text-gray-500 hover:border-sky-300'}`}>
                                <div className="flex items-center justify-between text-[11px] font-semibold truncate text-gray-600 dark:text-gray-300">
                                    <span>{selectedPrompt && selectedPrompt.subCategories.includes('style') ? selectedPrompt.title : '选择风格...'}</span>
                                    <ChevronDown className="w-3 h-3 text-sky-400 opacity-50" />
                                </div>
                            </button>
                        </div>
                    </div>
                </CollapsibleSection>

                <CollapsibleSection title="关联素材" icon={Database} color="sky">
                    <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold text-sky-600 dark:text-sky-400 uppercase tracking-wider">素材选择</label>
                        <button onClick={() => setAssetModalOpen(true)} className={`w-full p-2.5 rounded-lg border text-left transition-all font-sans ${selectedAssetIds.size > 0 ? 'bg-sky-100 border-sky-300 text-sky-900' : 'bg-white dark:bg-gray-800 border-sky-100 dark:border-sky-800 text-gray-500 hover:border-sky-300'}`}>
                            <div className="flex items-center justify-between text-[11px] font-semibold truncate">
                                <div className="flex items-center gap-1.5 overflow-hidden">
                                    <Database className={`w-3.5 h-3.5 flex-shrink-0 ${selectedAssetIds.size > 0 ? 'text-sky-600' : 'text-gray-400'}`} />
                                    <span className="truncate">{selectedAssetIds.size > 0 ? selectedAssetNames : '点击关联设定...'}</span>
                                </div>
                                <ChevronDown className="w-3 h-3 text-sky-400 opacity-50 flex-shrink-0" />
                            </div>
                        </button>
                    </div>
                </CollapsibleSection>

                <button onClick={isLoading ? handleStop : handleGenerate} className="w-full py-3 font-bold rounded-xl transition-all shadow-lg active:scale-[0.98] flex items-center justify-center gap-2 bg-sky-600 text-white font-sans mt-2 text-sm">
                     {isLoading ? <><Stop className="w-4 h-4" />停止</> : <><Film className="w-4 h-4" />开始改编</>}
                </button>
            </div>
        </div>
    );
};

export default ScriptAdaptationPanel;
