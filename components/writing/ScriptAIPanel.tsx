
import React, { useState, useEffect, useRef } from 'react';
import { Asset, Prompt } from '../../types';
import { generateText, generateTextStream } from '../../services/geminiService';
import { fetchMaterials, incrementPromptHeat } from '../../services/supabaseService';
import { PROMPTS } from '../../constants';
import { Sparkles, Film, X, ChevronDown, BookOpen, Copy, Trash, Stop, AdjustmentsHorizontal, Search, Database, InformationCircle } from '../Icon';
import PromptSelectionModal from '../PromptSelectionModal';
import AssetSelectionModal from '../AssetSelectionModal';
import LoadingOverlay from '../LoadingOverlay';

interface ScriptAIPanelProps {
    onInsert: (text: string) => void;
    onStream?: (text: string, isFirst: boolean) => void;
}

type ScriptTab = 'idea' | 'script';

const ScriptAIPanel: React.FC<ScriptAIPanelProps> = ({ onInsert, onStream }) => {
    const [activeTab, setActiveTab] = useState<ScriptTab>('idea');
    const [model, setModel] = useState('deepseek-chat');
    const [temperature, setTemperature] = useState(1);
    const [topP, setTopP] = useState(0.95);
    const [showConfig, setShowConfig] = useState(false);
    const [isAssetModalOpen, setAssetModalOpen] = useState(false);
    const [isPromptModalOpen, setPromptModalOpen] = useState(false);
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
                const result = await generateText(finalPrompt, { model, temperature, topP, signal: controller.signal });
                setOverlayStatus('success');
                const ideas = result.split(/【方案[一二三]】/).filter(s => s.trim().length > 10);
                setGeneratedIdeas(ideas.length === 0 ? [result] : ideas.map(s => s.trim()));
            } else {
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
            <div className="flex border-b border-gray-200 dark:border-gray-800 font-sans">
                <button onClick={() => setActiveTab('idea')} className={`flex-1 py-2 flex items-center justify-center gap-2 border-b-2 transition-all font-sans ${activeTab === 'idea' ? 'border-sky-500 text-sky-600 bg-sky-50 dark:bg-sky-900/20' : 'border-transparent text-gray-500'}`}>创意</button>
                <button onClick={() => setActiveTab('script')} className={`flex-1 py-2 flex items-center justify-center gap-2 border-b-2 transition-all font-sans ${activeTab === 'script' ? 'border-sky-500 text-sky-600 bg-sky-50 dark:bg-sky-900/20' : 'border-transparent text-gray-500'}`}>剧本</button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6 font-sans">
                <div className="bg-white dark:bg-gray-900 p-5 rounded-xl border border-gray-200 dark:border-gray-800 space-y-5 shadow-sm font-sans">
                    <div className="flex flex-col gap-2 font-sans">
                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">模型配置</label>
                        <div className="flex gap-2 font-sans">
                            <div className="relative flex-1 font-sans">
                                <select value={model} onChange={e => setModel(e.target.value)} className="w-full py-2 pl-3 pr-8 text-xs font-medium rounded-lg bg-gray-50 dark:bg-gray-800 border focus:ring-1 focus:ring-sky-500 outline-none appearance-none cursor-pointer font-sans">
                                    <option value="deepseek-chat">DeepSeek V3</option>
                                    <option value="gemini-3-flash-preview">Gemini 3 Flash</option>
                                </select>
                                <ChevronDown className="w-3 h-3 text-gray-400 absolute right-2.5 top-3 pointer-events-none" />
                            </div>
                            <button onClick={() => setShowConfig(!showConfig)} className="px-3 py-2 text-xs font-bold rounded-lg border transition-all flex items-center gap-1 font-sans"><AdjustmentsHorizontal className="w-4 h-4" />参数</button>
                        </div>
                    </div>
                    {showConfig && (
                        <div className="bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg border border-gray-100 dark:border-gray-800 grid grid-cols-1 gap-4 animate-fade-in text-[10px] font-sans">
                            <div className="space-y-1">
                                <label className="block font-black text-sky-500 flex justify-between uppercase"><span>随机度 (Temperature): {temperature}</span></label>
                                <input type="range" min="0" max="1.5" step="0.1" value={temperature} onChange={e => setTemperature(parseFloat(e.target.value))} className="w-full h-1 bg-sky-200 rounded-lg appearance-none cursor-pointer accent-sky-500" />
                            </div>
                            <div className="space-y-1">
                                <label className="block font-black text-sky-500 flex justify-between uppercase"><span>核采样 (Top P): {topP}</span></label>
                                <input type="range" min="0" max="1" step="0.05" value={topP} onChange={e => setTopP(parseFloat(e.target.value))} className="w-full h-1 bg-sky-200 rounded-lg appearance-none cursor-pointer accent-sky-500" />
                            </div>
                        </div>
                    )}
                </div>

                {selectedPrompt && (
                    <div className="space-y-4 font-sans">
                        <div className="flex items-center justify-between pb-2 border-b border-gray-200 dark:border-gray-800">
                            <span className="text-sm font-bold text-gray-900 dark:text-white">参数配置</span>
                        </div>
                        {selectedPrompt.fields.map((field, index) => (
                            <div key={field.id} className="font-sans">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 font-sans">
                                    {index + 1}. {field.label}
                                    {field.required !== false ? (
                                        <span className="ml-1 text-red-500 font-bold">* (必填)</span>
                                    ) : (
                                        <span className="ml-1 text-gray-400 font-normal"> (非必填)</span>
                                    )}
                                </label>
                                {field.type === 'textarea' ? (
                                    <textarea value={formState[field.id] || ''} onChange={e => handleInputChange(field.id, e.target.value)} placeholder={field.placeholder} className="w-full p-3 text-sm bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none resize-none shadow-sm h-24 font-sans" />
                                ) : (
                                    <input type="text" value={formState[field.id] || ''} onChange={e => handleInputChange(field.id, e.target.value)} placeholder={field.placeholder} className="w-full p-3 text-sm bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none shadow-sm font-sans" />
                                )}
                            </div>
                        ))}
                    </div>
                )}

                <button onClick={isLoading ? handleStop : handleGenerate} className="w-full py-3.5 font-bold rounded-xl transition-all shadow-lg active:scale-[0.98] flex items-center justify-center gap-2 bg-sky-600 text-white font-sans">
                     {isLoading ? <><Stop className="w-5 h-5" />停止</> : <><Sparkles className="w-5 h-5" />生成内容</>}
                </button>
            </div>
        </div>
    );
};

export default ScriptAIPanel;
