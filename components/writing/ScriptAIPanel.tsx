
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Asset, Prompt } from '../../types';
import { generateText, generateTextStream } from '../../services/geminiService';
import { fetchMaterials, incrementPromptHeat } from '../../services/supabaseService';
import { PROMPTS } from '../../constants';
import { Sparkles, Film, X, ChevronDown, BookOpen, Copy, Trash, Stop, AdjustmentsHorizontal, Search, Database, InformationCircle, Check } from '../Icon';
import PromptSelectionModal from '../PromptSelectionModal';
import AssetSelectionModal from '../AssetSelectionModal';
import LoadingOverlay from '../LoadingOverlay';

interface ScriptAIPanelProps {
    onInsert: (text: string) => void;
    onStream?: (text: string, isFirst: boolean) => void;
}

type ScriptTab = 'idea' | 'script';

const CollapsibleSection: React.FC<{ title: string; icon: any; color: string; children: React.ReactNode; defaultOpen?: boolean }> = ({ title, icon: Icon, color, children, defaultOpen = true }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    // Force blue theme for all sections as requested
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

const ScriptAIPanel: React.FC<ScriptAIPanelProps> = ({ onInsert, onStream }) => {
    const [activeTab, setActiveTab] = useState<ScriptTab>('idea');
    const [model, setModel] = useState('deepseek-chat');
    const [temperature, setTemperature] = useState(1);
    const [topP, setTopP] = useState(0.95);
    const [maxOutputTokens, setMaxOutputTokens] = useState(8192);
    const [showConfig, setShowConfig] = useState(false);
    
    const [isAssetModalOpen, setAssetModalOpen] = useState(false);
    const [isPromptModalOpen, setPromptModalOpen] = useState(false);
    const [promptFilterType, setPromptFilterType] = useState<'requirements' | 'style'>('requirements');
    const [selectedAssetIds, setSelectedAssetIds] = useState<Set<string>>(new Set());
    const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);
    const [assets, setAssets] = useState<Asset[]>([]);
    
    const [customInput, setCustomInput] = useState('');
    const [formState, setFormState] = useState<Record<string, string>>({});
    const [isLoading, setIsLoading] = useState(false);
    const [showLoadingOverlay, setShowLoadingOverlay] = useState(false);
    const [overlayStatus, setOverlayStatus] = useState<'loading' | 'success'>('loading');
    const [generatedIdeas, setGeneratedIdeas] = useState<string[]>([]);
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

    const selectedAssetNames = useMemo(() => {
        return Array.from(selectedAssetIds)
            .map(id => assets.find(a => a.id === id)?.name)
            .filter(Boolean)
            .join(', ');
    }, [selectedAssetIds, assets]);

    useEffect(() => {
        if (selectedPrompt) {
            const newForm: Record<string, string> = {};
            selectedPrompt.fields.forEach(f => newForm[f.id] = '');
            setFormState(newForm);
        } else {
            setFormState({});
        }
    }, [selectedPrompt]);

    const handleInputChange = (id: string, val: string) => {
        setFormState(prev => ({ ...prev, [id]: val }));
    };

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
        setGeneratedIdeas([]);
        setGeneratedText('');
        setError('');
        const controller = new AbortController();
        abortControllerRef.current = controller;
        try {
            const assetContext = Array.from(selectedAssetIds).map(id => assets.find(a => a.id === id)).filter(Boolean).map(a => `【参考素材：${a!.name}】\n${a!.content}`).join('\n\n');
            let finalPrompt = '';
            let promptContent = '';
            if (selectedPrompt) {
                incrementPromptHeat(selectedPrompt.id);
                promptContent = selectedPrompt.template || selectedPrompt.content;
                for (const field of selectedPrompt.fields) {
                    const val = formState[field.id] || '';
                    promptContent = promptContent.replace(new RegExp(`\\$\\{${field.id}\\}`, 'g'), val);
                }
            } else promptContent = customInput;
            
            if (activeTab === 'idea') finalPrompt = `请根据以下信息，生成3个剧本创意方案。\n\n${promptContent}\n${assetContext ? `关联素材：\n${assetContext}\n` : ''}`;
            else finalPrompt = `请写一段影视剧本正文。包含场景标题、场景描述、动作、对白。\n\n${promptContent}\n${assetContext ? `关联素材：\n${assetContext}\n` : ''}`;
            
            if (activeTab === 'idea') {
                const result = await generateText(finalPrompt, { 
                    model, 
                    temperature, 
                    topP, 
                    maxOutputTokens, 
                    signal: controller.signal 
                });
                setOverlayStatus('success');
                const ideas = result.split(/【方案[一二三]】/).filter(s => s.trim().length > 10);
                setGeneratedIdeas(ideas.length === 0 ? [result] : ideas.map(s => s.trim()));
            } else {
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
            
            <div className="flex border-b border-gray-200 dark:border-gray-800 font-sans">
                <button onClick={() => setActiveTab('idea')} className={`flex-1 py-2 flex items-center justify-center gap-2 border-b-2 transition-all font-sans ${activeTab === 'idea' ? 'border-sky-500 text-sky-600 bg-sky-50 dark:bg-sky-900/20' : 'border-transparent text-gray-500'}`}>创意</button>
                <button onClick={() => setActiveTab('script')} className={`flex-1 py-2 flex items-center justify-center gap-2 border-b-2 transition-all font-sans ${activeTab === 'script' ? 'border-sky-500 text-sky-600 bg-sky-50 dark:bg-sky-900/20' : 'border-transparent text-gray-500'}`}>剧本</button>
            </div>

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
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-sky-600 dark:text-sky-400 uppercase tracking-wider">写作风格</label>
                            <button onClick={() => handleOpenPromptModal('style')} className={`w-full p-2 rounded-lg border border-sky-100 dark:border-sky-800 bg-white dark:bg-gray-800 text-left transition-all relative overflow-hidden group hover:border-sky-300`}>
                                <div className="flex items-center justify-between text-[11px] font-semibold truncate text-gray-600 dark:text-gray-300">
                                    <span>{selectedPrompt && selectedPrompt.subCategories.includes('style') ? selectedPrompt.title : '选择风格...'}</span>
                                    <ChevronDown className="w-3 h-3 text-sky-400 opacity-50" />
                                </div>
                            </button>
                        </div>
                    </div>
                </CollapsibleSection>

                <CollapsibleSection title="关联素材" icon={Database} color="sky">
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-sky-600 dark:text-sky-400 uppercase tracking-wider">素材选择</label>
                        <button onClick={() => setAssetModalOpen(true)} className={`w-full p-2 rounded-lg border text-left transition-all font-sans ${selectedAssetIds.size > 0 ? 'bg-sky-100 border-sky-300 text-sky-900' : 'bg-white dark:bg-gray-800 border-sky-100 dark:border-sky-800 text-gray-500 hover:border-sky-300'}`}>
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
                     {isLoading ? <><Stop className="w-4 h-4" />停止</> : <><Sparkles className="w-4 h-4" />生成内容</>}
                </button>
            </div>
        </div>
    );
};

export default ScriptAIPanel;
