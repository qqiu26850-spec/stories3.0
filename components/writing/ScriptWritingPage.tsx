
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Script, Scene, ScriptSettings, ScriptPlanning, Prompt, Asset } from '../../types';
import { Film, ArrowPath, Check, ChevronLeft, ChevronRight, AdjustmentsHorizontal, Sparkles, DocumentText, UserCircle, Globe, ListBullet, Database, Play, Pencil, Box, X, Copy, Stop, ChevronDown, ChevronUp } from '../Icon';
import WritingToolbar from './WritingToolbar';
import { saveChapterToDB, updateProject, fetchChapters, fetchChapterContent, deleteChapterFromDB, updateChapterOrder, fetchMaterials, incrementPromptHeat } from '../../services/supabaseService';
import { createPortal } from 'react-dom';
import FollowUpModal from '../FollowUpModal';
import CustomSelect from '../CustomSelect';
import { generateTextStream } from '../../services/geminiService';
import PromptSelectionModal from '../PromptSelectionModal';
import AssetSelectionModal from '../AssetSelectionModal';
import LoadingOverlay from '../LoadingOverlay';

interface ScriptWritingPageProps {
    script: Script;
    onBack: () => void;
}

type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error';
// Updated Phases
type ScriptPhase = 'setup' | 'outline' | 'content'; 

// --- Component: Sidebar Section (Moved OUTSIDE to prevent re-render flickering) ---
const SidebarSection: React.FC<{ 
    title: string; 
    number: string; 
    icon: any; 
    children: React.ReactNode;
    defaultOpen?: boolean;
}> = ({ title, number, icon: Icon, children, defaultOpen = true }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    return (
        <div className="border-b border-blue-50 dark:border-gray-800 last:border-0 bg-white dark:bg-gray-900 mb-2 rounded-xl border border-transparent shadow-sm overflow-hidden">
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-blue-50/50 dark:hover:bg-gray-800 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center text-[10px] font-bold border border-blue-200 dark:border-blue-800">
                        {number}
                    </div>
                    <span className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Icon className="w-4 h-4 text-blue-500" />
                        {title}
                    </span>
                </div>
                {isOpen ? <ChevronUp className="w-3 h-3 text-gray-400"/> : <ChevronDown className="w-3 h-3 text-gray-400"/>}
            </button>
            
            {isOpen && (
                <div className="px-4 pb-4 animate-fade-in">
                    {children}
                </div>
            )}
        </div>
    );
};

// --- Helper: Reading Mode Renderer (Non-Markdown) ---
const FormattedText: React.FC<{ text: string; className?: string }> = ({ text, className = "" }) => {
    // Clean raw markdown symbols for reading mode
    const cleanText = text
        .replace(/#+\s/g, '') 
        .replace(/\*\*|\*/g, '') 
        .replace(/`{1,3}.*?`{1,3}/gs, '') 
        .replace(/<think>[\s\S]*?<\/think>/g, '') 
        .trim();

    return (
        <div className={`whitespace-pre-wrap font-sans leading-loose text-lg ${className}`}>
            {cleanText.split('\n').map((line, index) => {
                const trimmed = line.trim();
                if (!trimmed) return <div key={index} className="h-4" />;
                // Detect script format elements loosely
                const isSceneHeader = /^(EXT\.|INT\.|内景|外景|场景)/i.test(trimmed);
                const isCharacter = /^[A-Z\u4e00-\u9fa5]+(\s*\(.*?\))?：/.test(trimmed);
                
                if (isSceneHeader) {
                    return <div key={index} className="font-black text-gray-900 dark:text-white mt-6 mb-2 text-xl border-l-4 border-sky-500 pl-3">{trimmed}</div>;
                }
                if (isCharacter) {
                    return <div key={index} className="font-bold text-gray-800 dark:text-gray-200 mt-2">{trimmed}</div>;
                }
                return <div key={index} className="text-gray-700 dark:text-gray-300 mb-1.5">{trimmed}</div>;
            })}
        </div>
    );
};

const MODEL_OPTIONS = [
    { value: "deepseek-chat", label: "奇思版 (DeepSeek V3)" },
    { value: "gemini-3-flash-preview", label: "妙写版 (Gemini 3 Flash)" },
    { value: "doubao-flash", label: "速写版 (豆包)" }
];

const LANGUAGE_OPTIONS = [
    { value: "zh", label: "中文" },
    { value: "en", label: "English" }
];

const ScriptWritingPage: React.FC<ScriptWritingPageProps> = ({ script: initialScript, onBack }) => {
    // Core Data
    const [script, setScript] = useState<Script>(initialScript);
    const [currentPhase, setCurrentPhase] = useState<ScriptPhase>('setup'); // 'setup' | 'outline' | 'content'
    const [activeScene, setActiveScene] = useState<Scene | null>(null);
    
    // Setup State
    const [settings, setSettings] = useState<ScriptSettings>({
        format: 'live_action', // Default, kept for data structure
        totalEpisodes: '12',
        durationPerEpisode: '45',
        scenesPerEpisodeLimit: '30',
        outputLanguage: 'zh',
        model: 'deepseek-chat'
    });
    
    // Content State
    const [outlineContent, setOutlineContent] = useState('');
    const [promptFormState, setPromptFormState] = useState<Record<string, string>>({});

    // Asset & Prompt Selection
    const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);
    const [selectedAssetIds, setSelectedAssetIds] = useState<Set<string>>(new Set());
    const [assets, setAssets] = useState<Asset[]>([]);
    const [isAssetModalOpen, setAssetModalOpen] = useState(false);
    const [isPromptModalOpen, setPromptModalOpen] = useState(false);

    // UI State
    const [wordCount, setWordCount] = useState(0);
    const [alignment, setAlignment] = useState<'left' | 'center' | 'right' | 'justify'>('left');
    const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
    const [isLeftSidebarOpen, setLeftSidebarOpen] = useState(true);
    const [isGenerating, setIsGenerating] = useState(false);
    const [showLoadingOverlay, setShowLoadingOverlay] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('');
    const [isContentLoading, setIsContentLoading] = useState(false);
    const [isEpisodeSelectorOpen, setIsEpisodeSelectorOpen] = useState(false); // New state for episode dropdown

    const editorRef = useRef<HTMLDivElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const updateTimeoutRef = useRef<any>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    const [activeFollowUp, setActiveFollowUp] = useState<{ target: string; context: string; initialMode: 'selection' | 'full' } | null>(null);

    // --- Initialization ---
    useEffect(() => {
        const loadInitialData = async () => {
            // Load Chapters
            const data = await fetchChapters(script.id);
            if (data) {
               const mapped: Scene[] = data.map((c: any) => ({
                   id: c.id,
                   title: c.title,
                   content: '', 
                   isContentLoaded: false
               }));
               setScript(prev => ({ ...prev, scenes: mapped }));
               
               let loadedData: any = script.scriptData;
               if (loadedData && loadedData.settings) {
                   setSettings(loadedData.settings);
                   if (loadedData.planning?.outline) setOutlineContent(loadedData.planning.outline);
               }
               // 如果已经有大纲，尝试切换到大纲视图，如果有剧本，切换到剧本视图（如果用户未指定）
               // 这里不做强制切换，以免覆盖用户操作，保留在默认 setup 也可以
            }
            // Load Assets
            const userAssets = await fetchMaterials();
            setAssets(userAssets.map((item: any) => ({
                id: item.id,
                name: item.name || item.title,
                type: item.type === 'idea' ? 'inspiration' : item.type,
                content: item.content,
                tags: item.tags || []
            })));
        };
        loadInitialData();
    }, [script.id]);

    useEffect(() => {
        const loadContent = async () => {
            if (activeScene && !activeScene.isContentLoaded) {
                setIsContentLoading(true);
                const content = await fetchChapterContent(activeScene.id);
                
                setScript(prev => ({
                    ...prev,
                    scenes: prev.scenes.map(s => s.id === activeScene.id ? { ...s, content, isContentLoaded: true } : s)
                }));
                
                setActiveScene(prev => prev ? { ...prev, content, isContentLoaded: true } : null);
                setIsContentLoading(false);
            }
        };
        loadContent();
    }, [activeScene?.id]);

    // Initialize prompt form state when prompt selected
    useEffect(() => {
        if (selectedPrompt) {
            // Keep existing values if keys match, otherwise empty
            const initial: Record<string, string> = {};
            selectedPrompt.fields.forEach(f => {
                initial[f.id] = promptFormState[f.id] || '';
            });
            setPromptFormState(initial);
        } else {
            setPromptFormState({});
        }
    }, [selectedPrompt]); // Dependent only on prompt selection

    // Save Data
    const persistScriptData = async (newSettings?: ScriptSettings, newOutline?: string) => {
        const updatedData = {
            settings: newSettings || settings,
            planning: {
                synopsis: '', 
                characterSettings: '',
                worldview: '',
                outline: newOutline !== undefined ? newOutline : outlineContent
            }
        };
        await updateProject(script.id, { 
            // @ts-ignore
            script_data: updatedData 
        });
        setScript(prev => ({ ...prev, scriptData: updatedData }));
    };

    // --- Generation Logic ---
    const constructBasePrompt = () => {
        // 1. Basic Info
        let prompt = `【剧本基础信息】\n总集数：${settings.totalEpisodes}集\n单集时长：${settings.durationPerEpisode}分钟\n每集场景限制：${settings.scenesPerEpisodeLimit}场\n语言：${settings.outputLanguage === 'zh' ? '中文' : 'English'}\n`;
        
        // 2. Assets
        const assetContext = Array.from(selectedAssetIds).map(id => assets.find(a => a.id === id)).filter(Boolean).map(a => `【参考素材：${a!.name}】\n${a!.content}`).join('\n\n');
        if (assetContext) prompt += `\n【关联素材】\n${assetContext}\n`;

        // 3. Prompt Template & Form Data
        if (selectedPrompt) {
            incrementPromptHeat(selectedPrompt.id);
            let template = selectedPrompt.template || selectedPrompt.content;
            selectedPrompt.fields.forEach(field => {
                const val = promptFormState[field.id] || '';
                template = template.replace(new RegExp(`\\$\\{${field.id}\\}`, 'g'), val);
            });
            prompt += `\n【详细创作指令】\n${template}\n`;
        }

        return prompt;
    };

    const handleGenerateOutline = async () => {
        if (isGenerating) {
            handleStop();
            return;
        }

        setIsGenerating(true);
        setOutlineContent('');
        setCurrentPhase('outline');
        
        const baseInfo = constructBasePrompt();
        const finalPrompt = `${baseInfo}\n\n任务：请根据以上信息，生成一份详细的【剧本分集大纲】。包含每一集的核心事件、冲突点和结局悬念。\n请直接输出大纲内容，格式清晰，便于阅读。`;

        const controller = new AbortController();
        abortControllerRef.current = controller;

        try {
            const stream = generateTextStream(finalPrompt, { model: settings.model, temperature: 0.8, topP: 0.95, signal: controller.signal });
            for await (const chunk of stream) {
                setOutlineContent(prev => prev + chunk);
            }
            await persistScriptData(undefined, outlineContent);
        } catch (e) {
            console.error(e);
        } finally {
            setIsGenerating(false);
            await persistScriptData(undefined, outlineContent);
        }
    };

    const handleGenerateEpisodeScript = async (mode: 'single' | 'full' = 'single') => {
        if (isGenerating) {
            handleStop();
            return;
        }

        // Auto create episode if needed
        let targetScene = activeScene;
        if (!targetScene) {
            const newOrder = script.scenes.length + 1;
            const epTitle = `第${newOrder}集`;
            const newId = await saveChapterToDB(script.id, `new-ep-${Date.now()}`, epTitle, '', newOrder);
            if(newId) {
                const newScene: Scene = { id: newId, title: epTitle, content: '', isContentLoaded: true };
                setScript(prev => ({ ...prev, scenes: [...prev.scenes, newScene] }));
                setActiveScene(newScene);
                targetScene = newScene;
            }
        }
        
        setIsGenerating(true);
        setCurrentPhase('content');
        
        const baseInfo = constructBasePrompt();
        const outlineContext = outlineContent ? `\n【剧本大纲参考】\n${outlineContent.slice(0, 3000)}\n` : '';
        const currentEpTitle = targetScene ? targetScene.title : "新剧本";
        
        // Use user selected prompt if available, else default instructions
        const taskInstruction = selectedPrompt 
            ? `\n请根据上述指令生成【${currentEpTitle}】的内容。`
            : `\n任务：请撰写【${currentEpTitle}】的完整剧本正文。\n要求：\n1. 使用标准影视剧本格式。\n2. 场景标题包含：内/外、地点、时间。\n3. 动作描写生动，对白符合人物性格。`;

        const finalPrompt = `${baseInfo}${outlineContext}${taskInstruction}`;

        const controller = new AbortController();
        abortControllerRef.current = controller;

        let generatedContent = '';
        if (targetScene) {
             setScript(prev => ({
                ...prev,
                scenes: prev.scenes.map(s => s.id === targetScene!.id ? { ...s, content: '' } : s)
            }));
        }

        try {
            const stream = generateTextStream(finalPrompt, { model: settings.model, temperature: 0.8, topP: 0.95, signal: controller.signal });
            for await (const chunk of stream) {
                generatedContent += chunk;
                if (targetScene) {
                    setScript(prev => ({
                        ...prev,
                        scenes: prev.scenes.map(s => s.id === targetScene!.id ? { ...s, content: (s.content || '') + chunk, isContentLoaded: true } : s)
                    }));
                }
            }
            if (targetScene) {
                await saveChapterToDB(script.id, targetScene.id, targetScene.title, generatedContent, 99);
                // Also update local active scene content
                setActiveScene(prev => prev ? { ...prev, content: generatedContent } : null);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleCreateEpisode = async () => {
        const newOrder = script.scenes.length + 1;
        const epTitle = `第${newOrder}集`;
        const newId = await saveChapterToDB(script.id, `new-ep-${Date.now()}`, epTitle, '', newOrder);
        
        if (newId) {
            const newScene: Scene = { id: newId, title: epTitle, content: '', isContentLoaded: true };
            setScript(prev => ({ ...prev, scenes: [...prev.scenes, newScene] }));
            setActiveScene(newScene);
            setCurrentPhase('content');
        }
    };

    const handleStop = () => {
        if (abortControllerRef.current) abortControllerRef.current.abort();
        setIsGenerating(false);
    };

    const renderSetupSidebar = () => (
        <div className="flex flex-col h-full bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 font-sans w-96">
            {/* Scrollable Container */}
            <div className="flex-1 overflow-y-auto custom-scrollbar px-3 py-4 space-y-3">
                {/* 1. Model Configuration */}
                <SidebarSection title="模型配置" number="1" icon={AdjustmentsHorizontal}>
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-400 uppercase">选择基座模型</label>
                        <CustomSelect value={settings.model} onChange={(v) => setSettings(s => ({...s, model: v}))} options={MODEL_OPTIONS} />
                    </div>
                </SidebarSection>

                {/* 2. Basic Info */}
                <SidebarSection title="剧本基本信息" number="2" icon={DocumentText}>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-gray-400">总集数</label>
                            <input type="number" value={settings.totalEpisodes} onChange={e => setSettings(s => ({...s, totalEpisodes: e.target.value}))} className="w-full p-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-gray-400">单集时长(min)</label>
                            <input type="text" value={settings.durationPerEpisode} onChange={e => setSettings(s => ({...s, durationPerEpisode: e.target.value}))} className="w-full p-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-gray-400">场次限制</label>
                            <input type="number" value={settings.scenesPerEpisodeLimit} onChange={e => setSettings(s => ({...s, scenesPerEpisodeLimit: e.target.value}))} className="w-full p-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-gray-400">语言</label>
                            <CustomSelect value={settings.outputLanguage} onChange={(v) => setSettings(s => ({...s, outputLanguage: v as 'zh' | 'en'}))} options={LANGUAGE_OPTIONS} />
                        </div>
                    </div>
                </SidebarSection>

                {/* 3. Prompt & Assets */}
                <SidebarSection title={outlineContent ? "分集创作设置" : "提示词与素材"} number="3" icon={Sparkles}>
                    <div className="space-y-4">
                        {/* 3.1 Associate Assets (Moved to top) */}
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">关联素材</label>
                            <button onClick={() => setAssetModalOpen(true)} className="w-full p-3 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 text-xs text-gray-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 hover:border-blue-300 transition-all text-left flex justify-between items-center group">
                                <span className="truncate font-bold">{selectedAssetIds.size > 0 ? `已关联 ${selectedAssetIds.size} 项素材` : '选择角色/剧情/世界观...'}</span>
                                <Database className="w-4 h-4 group-hover:scale-110 transition-transform text-blue-400" />
                            </button>
                        </div>

                        {/* 3.2 Prompt Selection */}
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">提示词模板</label>
                            <button onClick={() => setPromptModalOpen(true)} className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs text-gray-700 dark:text-gray-300 hover:border-blue-300 transition-all text-left flex justify-between items-center group shadow-sm">
                                <span className="truncate font-bold">{selectedPrompt ? selectedPrompt.title : '选择提示词模板...'}</span>
                                {selectedPrompt ? <X className="w-4 h-4 text-gray-400 hover:text-red-500" onClick={(e) => { e.stopPropagation(); setSelectedPrompt(null); setPromptFormState({}); }} /> : <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform text-gray-400" />}
                            </button>
                        </div>
                        
                        {/* 3.3 Dynamic Prompt Form */}
                        {selectedPrompt && (
                            <div className="p-4 bg-blue-50/50 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-800 space-y-4 animate-fade-in">
                                <div className="flex justify-between items-center border-b border-blue-100 dark:border-blue-800 pb-2">
                                    <span className="text-xs font-black text-blue-600 dark:text-blue-400 flex items-center gap-1"><AdjustmentsHorizontal className="w-3 h-3"/> 参数填写</span>
                                </div>
                                {selectedPrompt.fields.map((field) => (
                                    <div key={field.id} className="space-y-1.5">
                                        <label className="text-[11px] font-bold text-gray-600 dark:text-gray-300 block">{field.label}</label>
                                        {field.type === 'textarea' ? (
                                            <textarea 
                                                value={promptFormState[field.id] || ''}
                                                onChange={(e) => setPromptFormState(p => ({...p, [field.id]: e.target.value}))}
                                                className="w-full p-2.5 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none h-20"
                                                placeholder={field.placeholder}
                                            />
                                        ) : (
                                            <input 
                                                type="text"
                                                value={promptFormState[field.id] || ''}
                                                onChange={(e) => setPromptFormState(p => ({...p, [field.id]: e.target.value}))}
                                                className="w-full p-2.5 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                                placeholder={field.placeholder}
                                            />
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </SidebarSection>
            </div>

            {/* Bottom Action Area */}
            <div className="p-4 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
                {isGenerating ? (
                    <button 
                        onClick={handleStop} 
                        className="w-full py-3 bg-red-500 text-white font-bold rounded-xl shadow-lg hover:bg-red-600 transition-all flex items-center justify-center gap-2 active:scale-95"
                    >
                        <Stop className="w-4 h-4" /> 停止生成
                    </button>
                ) : !outlineContent ? (
                    <button 
                        onClick={handleGenerateOutline} 
                        className="w-full py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white font-bold rounded-xl shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2 active:scale-95"
                    >
                        <ListBullet className="w-4 h-4" /> 生成剧本大纲
                    </button>
                ) : (
                    <div className="flex flex-col gap-2 animate-fade-in">
                        <div className="grid grid-cols-2 gap-2">
                            <button 
                                onClick={() => handleGenerateEpisodeScript('single')} 
                                className="w-full py-3 bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 font-bold rounded-xl hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all flex items-center justify-center gap-2 shadow-sm text-sm"
                            >
                                <Film className="w-4 h-4" /> 分集创作
                            </button>
                            <button 
                                onClick={() => handleGenerateEpisodeScript('full')} 
                                className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-500 shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2 text-sm"
                            >
                                <Play className="w-4 h-4" /> 一键全集
                            </button>
                        </div>
                        <button 
                            onClick={handleGenerateOutline} 
                            className="w-full py-2 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 font-bold rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-all flex items-center justify-center gap-2 text-xs"
                        >
                            <ArrowPath className="w-3 h-3" /> 重新生成大纲
                        </button>
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 overflow-hidden relative font-sans">
            <LoadingOverlay isVisible={showLoadingOverlay} message={loadingMessage} onClose={() => setShowLoadingOverlay(false)} />
            
            <FollowUpModal 
                isOpen={!!activeFollowUp} 
                onClose={() => setActiveFollowUp(null)} 
                targetText={activeFollowUp?.target || ''}
                context={editorRef.current?.innerText || ''}
                initialMode={'selection'}
                onApply={(text, type) => {
                    // Simple apply for now
                    setActiveFollowUp(null);
                }}
            />

            {/* Selection Modals */}
            <AssetSelectionModal isOpen={isAssetModalOpen} onClose={() => setAssetModalOpen(false)} assets={assets} selectedAssetIds={selectedAssetIds} onToggleAsset={(id) => setSelectedAssetIds(prev => { const next = new Set(prev); if(next.has(id)) next.delete(id); else next.add(id); return next; })} />
            <PromptSelectionModal isOpen={isPromptModalOpen} onClose={() => setPromptModalOpen(false)} onSelect={(p) => { setSelectedPrompt(p); setPromptModalOpen(false); }} />

            {/* Header with Steps */}
            <header className="flex-shrink-0 bg-white dark:bg-black flex border-b border-gray-200 dark:border-gray-800 z-20 shadow-sm h-16 justify-between px-4">
                <div className="flex items-center gap-4">
                    <Film className="w-6 h-6 text-blue-500" />
                    <span className="font-bold text-lg text-gray-900 dark:text-white truncate max-w-[150px]">{script.title}</span>
                </div>
                
                <div className="flex-1 flex items-center justify-center">
                    <div className="flex items-center bg-gray-100 dark:bg-gray-900 p-1 rounded-lg">
                        <button 
                            onClick={() => setCurrentPhase('setup')}
                            className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${currentPhase === 'setup' ? 'bg-white dark:bg-gray-800 text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
                        >
                            1. 基础设置
                        </button>
                        <ChevronRight className="w-3 h-3 text-gray-400 mx-1" />
                        <button 
                            onClick={() => setCurrentPhase('outline')}
                            className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${currentPhase === 'outline' ? 'bg-white dark:bg-gray-800 text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
                        >
                            2. 大纲生成
                        </button>
                        <ChevronRight className="w-3 h-3 text-gray-400 mx-1" />
                        <button 
                            onClick={() => setCurrentPhase('content')}
                            className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${currentPhase === 'content' ? 'bg-white dark:bg-gray-800 text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
                        >
                            3. 剧本正文
                        </button>
                    </div>
                </div>
                
                <div className="flex items-center gap-3">
                    <button onClick={onBack} className="px-4 py-1.5 text-xs font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg">返回</button>
                </div>
            </header>

            <div className="flex-1 flex overflow-hidden relative">
                {/* Left Sidebar */}
                <aside className={`flex-shrink-0 bg-white dark:bg-black border-r border-gray-200 dark:border-gray-800 transition-all duration-300 overflow-hidden ${isLeftSidebarOpen ? 'w-96' : 'w-0'}`}>
                    {renderSetupSidebar()}
                </aside>

                {/* Sidebar Toggle */}
                <button 
                    onClick={() => setLeftSidebarOpen(!isLeftSidebarOpen)}
                    className={`absolute z-30 top-1/2 -translate-y-1/2 w-4 h-12 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-r-md flex items-center justify-center text-gray-400 hover:text-blue-500 transition-all shadow-sm ${isLeftSidebarOpen ? 'left-96' : 'left-0'}`}
                >
                    {isLeftSidebarOpen ? <ChevronLeft className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                </button>

                {/* Main Content Area */}
                <main className="flex-1 bg-gray-50 dark:bg-gray-950 flex flex-col relative overflow-hidden">
                     {currentPhase === 'setup' && (
                         <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                             <div className="w-24 h-24 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-6">
                                 <AdjustmentsHorizontal className="w-10 h-10 text-gray-300" />
                             </div>
                             <h3 className="text-xl font-bold text-gray-700 dark:text-gray-300 mb-2">配置剧本参数</h3>
                             <p className="text-sm max-w-md text-center leading-relaxed">
                                 请在左侧侧边栏完成模型选择、基础信息填写以及提示词与素材的关联。<br/>完成后点击左下角按钮开始生成。
                             </p>
                         </div>
                     )}

                     {currentPhase === 'outline' && (
                         <div className="flex-1 flex flex-col bg-white dark:bg-gray-900 shadow-sm m-4 rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-800">
                             <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-black/20">
                                 <h2 className="text-lg font-bold text-blue-700 dark:text-blue-400 flex items-center gap-2">
                                     <ListBullet className="w-5 h-5" /> 剧本大纲
                                     {isGenerating && <ArrowPath className="w-4 h-4 animate-spin" />}
                                 </h2>
                                 <div className="flex gap-2">
                                     <button onClick={() => navigator.clipboard.writeText(outlineContent)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-500"><Copy className="w-4 h-4"/></button>
                                 </div>
                             </div>
                             <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                                 {outlineContent ? (
                                     <FormattedText text={outlineContent} />
                                 ) : (
                                     <div className="flex flex-col items-center justify-center h-full text-gray-400">
                                         <p>暂无大纲内容，请点击左下角“生成剧本大纲”</p>
                                     </div>
                                 )}
                             </div>
                         </div>
                     )}

                     {currentPhase === 'content' && (
                         <div className="flex-1 flex flex-col overflow-hidden">
                             {/* Content Header & Toolbar */}
                             <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 p-2 flex justify-between items-center">
                                 <div className="flex items-center gap-4 pl-4">
                                     <h2 className="text-lg font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                                         {activeScene?.title || '剧本正文'}
                                     </h2>
                                     {saveStatus === 'saving' && <span className="text-xs text-blue-500 animate-pulse">保存中...</span>}
                                     {saveStatus === 'saved' && <span className="text-xs text-green-500">已保存</span>}
                                 </div>
                                 
                                 <div className="flex items-center gap-2">
                                     <WritingToolbar onAction={() => {}} alignment={alignment} />
                                     <div className="h-6 w-px bg-gray-200 dark:bg-gray-700 mx-2"></div>
                                     <div className="relative">
                                         <button 
                                            onClick={() => setIsEpisodeSelectorOpen(!isEpisodeSelectorOpen)}
                                            className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 rounded-lg text-xs font-bold hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                                         >
                                             {activeScene?.title || "选择集数"}
                                             <ChevronDown className="w-3 h-3" />
                                         </button>
                                         
                                         {isEpisodeSelectorOpen && (
                                             <>
                                                 <div className="fixed inset-0 z-40" onClick={() => setIsEpisodeSelectorOpen(false)} />
                                                 <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 z-50 p-1 max-h-60 overflow-y-auto custom-scrollbar">
                                                     <div className="px-3 py-2 text-[10px] font-bold text-gray-400 uppercase border-b border-gray-100 dark:border-gray-700 mb-1 flex justify-between items-center">
                                                         <span>剧本集数</span>
                                                         <button onClick={() => { handleCreateEpisode(); setIsEpisodeSelectorOpen(false); }} className="text-blue-500 hover:underline">+ 新建</button>
                                                     </div>
                                                     {script.scenes.length > 0 ? script.scenes.map((scene) => (
                                                         <button 
                                                             key={scene.id}
                                                             onClick={() => { setActiveScene(scene); setIsEpisodeSelectorOpen(false); }}
                                                             className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors ${activeScene?.id === scene.id ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                                                         >
                                                             {scene.title}
                                                         </button>
                                                     )) : (
                                                         <div className="p-3 text-center text-xs text-gray-400">暂无集数</div>
                                                     )}
                                                 </div>
                                             </>
                                         )}
                                     </div>
                                 </div>
                             </div>
                             
                             <div className="flex-1 flex overflow-hidden">
                                 {/* Reading Mode Editor */}
                                 <div className="flex-1 bg-white dark:bg-gray-900 overflow-y-auto p-8 lg:px-16 custom-scrollbar relative">
                                     {activeScene ? (
                                         <>
                                             {isContentLoading ? (
                                                 <div className="flex justify-center py-20"><ArrowPath className="w-8 h-8 animate-spin text-gray-300" /></div>
                                             ) : (
                                                 <div 
                                                     ref={editorRef}
                                                     contentEditable
                                                     suppressContentEditableWarning
                                                     className="outline-none min-h-[80vh] pb-32"
                                                     onInput={() => {
                                                         setWordCount(editorRef.current?.innerText.length || 0);
                                                         setSaveStatus('saving');
                                                         if(updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current);
                                                         updateTimeoutRef.current = setTimeout(async () => {
                                                             if(activeScene && editorRef.current) {
                                                                 await saveChapterToDB(script.id, activeScene.id, activeScene.title, editorRef.current.innerHTML, 99);
                                                                 setSaveStatus('saved');
                                                             }
                                                         }, 1000);
                                                     }}
                                                 >
                                                     <FormattedText text={activeScene.content || (isGenerating ? '' : '暂无内容，请点击左侧按钮生成...')} />
                                                 </div>
                                             )}
                                             
                                             {isGenerating && (
                                                 <div className="absolute bottom-10 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-6 py-2 rounded-full shadow-lg flex items-center gap-2 animate-pulse z-10">
                                                     <ArrowPath className="w-4 h-4 animate-spin" />
                                                     正在生成剧本...
                                                     <button onClick={handleStop} className="ml-2 hover:text-red-200"><X className="w-4 h-4"/></button>
                                                 </div>
                                             )}
                                         </>
                                     ) : (
                                         <div className="flex flex-col items-center justify-center h-full text-gray-400">
                                             <p>请选择或新建一集</p>
                                         </div>
                                     )}
                                 </div>
                             </div>
                         </div>
                     )}
                </main>
            </div>
        </div>
    );
};

export default ScriptWritingPage;
