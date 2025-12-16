
import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Asset, Prompt } from '../../types';
import { generateText, generateTextStream } from '../../services/geminiService';
import { fetchMaterials, incrementPromptHeat } from '../../services/supabaseService';
import { PROMPTS } from '../../constants';
import { Sparkles, ChevronDown, Database, BookOpen, DocumentPlus, Pencil, Copy, Trash, X } from '../Icon';
import PromptSelectionModal from '../PromptSelectionModal';
import LoadingOverlay from '../LoadingOverlay';

type TabType = 'plot' | 'continue' | 'polish' | 'review';

interface AIFunctionPanelProps {
    contextText: string;
    selectedText: string;
    onInsert: (text: string) => void;
    onReplace: (text: string) => void;
    onStream?: (text: string, isFirst: boolean) => void;
}

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

const AIFunctionPanel: React.FC<AIFunctionPanelProps> = ({ contextText = '', selectedText = '', onInsert, onReplace, onStream }) => {
    const [activeTab, setActiveTab] = useState<TabType>('plot');
    
    // Config State
    const [model, setModel] = useState('gemini-2.5-flash');
    const [temperature, setTemperature] = useState(1);
    const [topP, setTopP] = useState(0.95);
    const [selectedAssetIds, setSelectedAssetIds] = useState<Set<string>>(new Set());
    const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);
    const [assets, setAssets] = useState<Asset[]>([]);

    // Modals
    const [isAssetModalOpen, setAssetModalOpen] = useState(false);
    const [isPromptModalOpen, setPromptModalOpen] = useState(false);

    // Form State
    const [formState, setFormState] = useState<Record<string, string>>({});

    // Result State
    const [isLoading, setIsLoading] = useState(false);
    const [showLoadingOverlay, setShowLoadingOverlay] = useState(false);
    const [resultText, setResultText] = useState('');
    const [error, setError] = useState('');
    const [lastGeneratedTab, setLastGeneratedTab] = useState<TabType | null>(null);

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

    // Filter prompts based on active tab (for finding defaults only)
    const defaultTabPrompts = useMemo(() => {
        return PROMPTS.filter(prompt => {
            const subCats = prompt.subCategories || [];
            if (activeTab === 'plot') return subCats.includes('requirements');
            if (activeTab === 'continue') return subCats.includes('continue');
            if (activeTab === 'polish') return subCats.includes('polish');
            if (activeTab === 'review') return subCats.includes('proofread');
            return false;
        });
    }, [activeTab]);

    // Initialize default prompt when tab changes
    useEffect(() => {
        if (defaultTabPrompts.length > 0) {
            setSelectedPrompt(defaultTabPrompts[0]);
        } else {
            setSelectedPrompt(null);
        }
        setResultText(''); 
        setError('');
    }, [activeTab, defaultTabPrompts]);

    // Auto-fill logic
    useEffect(() => {
        if (!selectedPrompt) return;

        const newFormState = { ...formState };
        let hasChange = false;

        selectedPrompt.fields.forEach(field => {
            // Auto-fill context if field id is 'context'
            if (field.id === 'context' && !newFormState['context']) {
                 // Take last 2000 chars for context
                newFormState['context'] = contextText.slice(-2000);
                hasChange = true;
            }
            // Auto-fill text if field id is 'text' (for polish/review/proofread)
            if (field.id === 'text' && !newFormState['text']) {
                // Prefer selected text, fallback to recent context for review if nothing selected
                newFormState['text'] = selectedText || (activeTab === 'review' ? contextText.slice(-2000) : ''); 
                hasChange = true;
            }
        });

        if (hasChange) setFormState(prev => ({ ...prev, ...newFormState }));
    }, [activeTab, selectedPrompt, contextText, selectedText]);

    const handleInputChange = (id: string, val: string) => {
        setFormState(prev => ({ ...prev, [id]: val }));
    };

    const handleGenerate = async () => {
        if (!selectedPrompt) return;

        setIsLoading(true);
        setShowLoadingOverlay(true);
        setResultText('');
        setError('');
        setLastGeneratedTab(activeTab);

        try {
            // Increment heat
            incrementPromptHeat(selectedPrompt.id);

            // 1. Build Asset Context
            const assetContext = Array.from(selectedAssetIds)
                .map(id => assets.find(a => a.id === id))
                .filter(Boolean)
                .map(a => `【参考素材：${a!.name}】\n${a!.content}`)
                .join('\n\n');

            // 2. Build Prompt
            let prompt = selectedPrompt.template;
            for (const field of selectedPrompt.fields) {
                const val = formState[field.id] || '';
                prompt = prompt.replace(new RegExp(`\\$\\{${field.id}\\}`, 'g'), val);
            }

            const finalPrompt = assetContext ? `${assetContext}\n\n---\n\n${prompt}` : prompt;

            // Stream Handling
            if (onStream && (activeTab === 'plot' || activeTab === 'continue')) {
                const stream = generateTextStream(finalPrompt, { model, temperature, topP });
                let isFirst = true;
                let fullText = '';
                
                for await (const chunk of stream) {
                    if (isFirst) {
                        setShowLoadingOverlay(false);
                    }
                    onStream(chunk, isFirst);
                    fullText += chunk;
                    setResultText(fullText); // Update local display
                    isFirst = false;
                }
            } else {
                // Fallback / Non-stream / Polish / Review
                const text = await generateText(finalPrompt, { model, temperature, topP });
                
                if (activeTab === 'plot' || activeTab === 'continue') {
                    onInsert(text); // Insert final result if not streamed
                }
                setResultText(text);
            }

        } catch (err: any) {
            setError(err.message || '生成失败');
        } finally {
            setIsLoading(false);
            setShowLoadingOverlay(false);
        }
    };

    const renderTabButton = (type: TabType, label: string, Icon: React.ElementType) => (
        <button
            onClick={() => setActiveTab(type)}
            className={`flex-1 py-4 flex flex-col items-center justify-center gap-2 transition-colors border-b-2 ${
                activeTab === type 
                    ? 'border-sky-500 text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-900/20' 
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800'
            }`}
        >
            <Icon className="w-6 h-6" />
            <span className="text-base font-bold">{label}</span>
        </button>
    );

    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-black border-l border-gray-200 dark:border-gray-800">
            <LoadingOverlay isVisible={showLoadingOverlay} onClose={() => setShowLoadingOverlay(false)} />
            <AssetSelectionModal 
                isOpen={isAssetModalOpen} 
                onClose={() => setAssetModalOpen(false)}
                assets={assets}
                selectedAssetIds={selectedAssetIds}
                onToggleAsset={(id) => {
                    setSelectedAssetIds(prev => {
                        const next = new Set(prev);
                        if (next.has(id)) next.delete(id);
                        else next.add(id);
                        return next;
                    });
                }}
            />
            <PromptSelectionModal 
                isOpen={isPromptModalOpen} 
                onClose={() => setPromptModalOpen(false)}
                onSelect={(prompt) => {
                    setSelectedPrompt(prompt);
                    setPromptModalOpen(false);
                }}
            />

            <div className="flex border-b border-gray-200 dark:border-gray-800">
                {renderTabButton('plot', '剧情', BookOpen)}
                {renderTabButton('continue', '续写', DocumentPlus)}
                {renderTabButton('polish', '润色', Sparkles)}
                {renderTabButton('review', '评审', Pencil)}
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                
                <div className="bg-white dark:bg-gray-900 p-5 rounded-xl border border-gray-200 dark:border-gray-800 space-y-5 shadow-sm">
                     <div className="flex flex-col gap-2">
                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">模型选择</label>
                        <select 
                            value={model} 
                            onChange={e => setModel(e.target.value)} 
                            className="w-full p-2.5 text-sm font-medium rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 focus:outline-none transition-all cursor-pointer"
                        >
                            <option value="gemini-2.5-flash">Gemini 2.5 Flash (极速)</option>
                            <option value="gemini-2.5-pro">Gemini 2.5 Pro (深度推理)</option>
                            <option value="deepseek-chat">DeepSeek V3</option>
                            <option value="deepseek-reasoner">DeepSeek R1 (推理)</option>
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 flex justify-between items-center">
                                <span>随机度</span>
                                <span className="text-gray-700 dark:text-gray-300 font-mono">{temperature}</span>
                            </label>
                            <input 
                                type="range" min="0" max="2" step="0.1" 
                                value={temperature} 
                                onChange={e => setTemperature(parseFloat(e.target.value))}
                                className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 accent-sky-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 flex justify-between items-center">
                                <span>核采样</span>
                                <span className="text-gray-700 dark:text-gray-300 font-mono">{topP}</span>
                            </label>
                            <input 
                                type="range" min="0" max="1" step="0.05" 
                                value={topP} 
                                onChange={e => setTopP(parseFloat(e.target.value))}
                                className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 accent-sky-500"
                            />
                        </div>
                    </div>

                     <div className="flex flex-col gap-2">
                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">提示词选择</label>
                        <button 
                            onClick={() => setPromptModalOpen(true)}
                            className={`w-full p-3 rounded-lg border text-left transition-all group relative overflow-hidden ${
                                selectedPrompt 
                                ? 'bg-sky-50 border-sky-300 text-sky-900 dark:bg-sky-900/30 dark:border-sky-700 dark:text-sky-100' 
                                : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500 hover:border-sky-400'
                            }`}
                        >
                            <div className="flex items-center justify-between relative z-10">
                                <div className="flex items-center gap-2 overflow-hidden">
                                    <Sparkles className={`w-4 h-4 flex-shrink-0 ${selectedPrompt ? 'text-sky-600 dark:text-sky-400' : 'text-gray-400'}`} />
                                    <span className="font-semibold truncate">{selectedPrompt ? selectedPrompt.title : '点击选择提示词模板...'}</span>
                                </div>
                                <ChevronDown className="w-4 h-4 opacity-50" />
                            </div>
                        </button>
                    </div>

                    <div className="flex flex-col gap-2">
                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">关联素材</label>
                        <button 
                            onClick={() => setAssetModalOpen(true)}
                            className={`w-full p-3 rounded-lg border text-left transition-all ${
                                selectedAssetIds.size > 0 
                                ? 'bg-purple-50 border-purple-300 text-purple-900 dark:bg-purple-900/30 dark:border-purple-700 dark:text-purple-100' 
                                : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500 hover:border-purple-400'
                            }`}
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Database className={`w-4 h-4 flex-shrink-0 ${selectedAssetIds.size > 0 ? 'text-purple-600 dark:text-purple-400' : 'text-gray-400'}`} />
                                    <span className="font-semibold">{selectedAssetIds.size > 0 ? `已关联 ${selectedAssetIds.size} 个素材` : '关联人物/剧情/设定...'}</span>
                                </div>
                                <ChevronDown className="w-4 h-4 opacity-50" />
                            </div>
                        </button>
                    </div>
                </div>

                {selectedPrompt ? (
                    <div className="space-y-4 animate-fade-in">
                        <div className="flex items-center justify-between pb-2 border-b border-gray-200 dark:border-gray-800">
                            <span className="text-sm font-bold text-gray-900 dark:text-white">参数配置</span>
                        </div>
                        {selectedPrompt.fields.map(field => (
                            <div key={field.id}>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 flex justify-between items-center">
                                    {field.label}
                                    {field.id === 'text' && selectedText && <span className="text-xs text-green-600 bg-green-100 dark:bg-green-900/50 px-2 py-0.5 rounded">已读取选中内容</span>}
                                </label>
                                {field.type === 'textarea' ? (
                                    <textarea 
                                        rows={field.id === 'context' || field.id === 'text' ? 5 : 3}
                                        value={formState[field.id] || ''}
                                        onChange={e => handleInputChange(field.id, e.target.value)}
                                        placeholder={field.placeholder}
                                        className="w-full p-3 text-sm bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 focus:outline-none resize-none transition-shadow shadow-sm"
                                    />
                                ) : (
                                    <input 
                                        type="text"
                                        value={formState[field.id] || ''}
                                        onChange={e => handleInputChange(field.id, e.target.value)}
                                        placeholder={field.placeholder}
                                        className="w-full p-3 text-sm bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 focus:outline-none transition-shadow shadow-sm"
                                    />
                                )}
                            </div>
                        ))}
                    </div>
                ) : (
                     <div className="text-sm text-gray-400 italic p-6 text-center border border-dashed border-gray-300 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-900/50">
                        请先在上方选择一个提示词模板
                     </div>
                )}

                <button 
                    onClick={handleGenerate}
                    disabled={isLoading || !selectedPrompt}
                    className="w-full py-3.5 bg-sky-600 text-white font-bold rounded-xl hover:bg-sky-500 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-sky-500/30 active:scale-[0.98]"
                >
                    {isLoading ? (
                        <>
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            AI 正在思考中...
                        </>
                    ) : (
                        <>
                            <Sparkles className="w-5 h-5" />
                            {activeTab === 'review' ? '开始智能评审' : '立即生成内容'}
                        </>
                    )}
                </button>

                {error && (
                    <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-lg border border-red-100 dark:border-red-900/50">
                        {error}
                    </div>
                )}

                {resultText && (
                    <div className="space-y-3 pt-4 border-t border-gray-200 dark:border-gray-800 animate-fade-in-up">
                        <div className="flex justify-between items-center">
                            <h4 className="text-sm font-bold text-gray-800 dark:text-white flex items-center gap-2">
                                生成结果
                                {(lastGeneratedTab === 'plot' || lastGeneratedTab === 'continue') && (
                                    <span className="text-xs font-normal text-green-600 bg-green-100 dark:bg-green-900/30 px-2 py-0.5 rounded-full">已插入正文</span>
                                )}
                            </h4>
                            <div className="flex gap-2">
                                <button 
                                    onClick={() => navigator.clipboard.writeText(resultText)}
                                    className="p-1.5 text-gray-500 hover:text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-900/30 rounded transition-colors"
                                    title="复制"
                                >
                                    <Copy className="w-4 h-4" />
                                </button>
                                <button 
                                    onClick={() => setResultText('')}
                                    className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
                                    title="清除"
                                >
                                    <Trash className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        <div className="p-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 text-sm leading-relaxed text-gray-700 dark:text-gray-300 whitespace-pre-wrap max-h-64 overflow-y-auto shadow-inner">
                            {resultText}
                        </div>
                        
                        {lastGeneratedTab === 'polish' && (
                            <button 
                                onClick={() => onReplace(resultText)}
                                className="w-full py-2.5 bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400 font-bold rounded-lg hover:bg-sky-200 dark:hover:bg-sky-900/50 transition-colors text-sm"
                            >
                                替换选中文本
                            </button>
                        )}
                        
                        {(lastGeneratedTab === 'plot' || lastGeneratedTab === 'continue') && (
                            <p className="text-xs text-gray-400 text-center">
                                内容已直接添加到正文中，您可以直接在左侧编辑器进行修改或撤销。
                            </p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default AIFunctionPanel;
