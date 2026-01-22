
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Script, Scene, ScriptSettings, Workflow, Asset } from '../../types';
import { Film, ArrowPath, Check, ChevronLeft, ChevronRight, AdjustmentsHorizontal, Sparkles, DocumentText, Database, Play, Pencil, X, Copy, Stop, ChevronDown, ChevronUp, Workflow as WorkflowIcon, InformationCircle, ChatBubbleOvalLeftEllipsis, DocumentPlus, UserCircle, Fire } from '../Icon';
import WritingToolbar from './WritingToolbar';
import { saveChapterToDB, updateProject, fetchChapters, fetchChapterContent, deleteChapterFromDB, updateChapterOrder, fetchMaterials, incrementWorkflowUsage, fetchWorkflows } from '../../services/supabaseService';
import { createPortal } from 'react-dom';
import FollowUpModal from '../FollowUpModal';
import CustomSelect from '../CustomSelect';
import { generateTextStream } from '../../services/geminiService';
import AssetSelectionModal from '../AssetSelectionModal';
import LoadingOverlay from '../LoadingOverlay';

interface ScriptWritingPageProps {
    script: Script;
    onBack: () => void;
}

type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error';

// --- Helper: Reading Mode Renderer ---
const FormattedText: React.FC<{ text: string; className?: string }> = ({ text, className = "" }) => {
    const cleanText = text
        .replace(/#+\s/g, '') 
        .replace(/\*\*|\*/g, '') 
        .replace(/`{1,3}.*?`{1,3}/gs, '') 
        .replace(/<think>[\s\S]*?<\/think>/g, '') 
        .trim();

    return (
        <div className={`whitespace-pre-wrap font-sans leading-relaxed text-sm ${className}`}>
            {cleanText.split('\n').map((line, index) => {
                const trimmed = line.trim();
                if (!trimmed) return <div key={index} className="h-2" />;
                
                const isSceneHeader = /^(EXT\.|INT\.|内景|外景|场景)/i.test(trimmed);
                const isCharacter = /^[A-Z\u4e00-\u9fa5]+(\s*\(.*?\))?：/.test(trimmed);
                
                if (isSceneHeader) {
                    return <div key={index} className="font-black text-gray-900 dark:text-white mt-4 mb-1 text-base border-l-4 border-blue-500 pl-2">{trimmed}</div>;
                }
                if (isCharacter) {
                    return <div key={index} className="font-bold text-gray-800 dark:text-gray-200 mt-1">{trimmed}</div>;
                }
                return <div key={index} className="text-gray-600 dark:text-gray-300 mb-0.5">{trimmed}</div>;
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
    const [activeScene, setActiveScene] = useState<Scene | null>(null);
    
    // Setup State
    const [settings, setSettings] = useState<ScriptSettings>({
        format: 'live_action',
        totalEpisodes: '12',
        durationPerEpisode: '45',
        scenesPerEpisodeLimit: '30',
        outputLanguage: 'zh',
        model: 'deepseek-chat'
    });
    
    // Workflow State
    const [availableWorkflows, setAvailableWorkflows] = useState<Workflow[]>([]);
    const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
    const [workflowFormState, setWorkflowFormState] = useState<Record<string, string>>({});
    const [stepResults, setStepResults] = useState<Record<string, string>>({}); // Store result per step
    const [currentStepIndex, setCurrentStepIndex] = useState<number | null>(null);

    // Asset Selection
    const [selectedAssetIds, setSelectedAssetIds] = useState<Set<string>>(new Set());
    const [assets, setAssets] = useState<Asset[]>([]);
    const [isAssetModalOpen, setAssetModalOpen] = useState(false);
    const [isWorkflowModalOpen, setWorkflowModalOpen] = useState(false); // Changed to Modal state

    // UI State
    const [wordCount, setWordCount] = useState(0);
    const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
    const [isLeftSidebarOpen, setLeftSidebarOpen] = useState(true);
    const [isGenerating, setIsGenerating] = useState(false);
    const [showLoadingOverlay, setShowLoadingOverlay] = useState(false);
    const [isContentLoading, setIsContentLoading] = useState(false);
    const [isEpisodeSelectorOpen, setIsEpisodeSelectorOpen] = useState(false);
    
    const [loadingMessage, setLoadingMessage] = useState('正在处理...');
    const [alignment, setAlignment] = useState<'left' | 'center' | 'right' | 'justify'>('left');

    const editorRef = useRef<HTMLDivElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const updateTimeoutRef = useRef<any>(null);
    const abortControllerRef = useRef<AbortController | null>(null);
    const stepRefs = useRef<Record<number, HTMLDivElement | null>>({});
    const resultRefs = useRef<Record<string, HTMLDivElement | null>>({});

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
               }
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

            // Load Workflows - Fetch ALL categories to ensure list is populated
            const workflows = await fetchWorkflows({ category: 'all' });
            setAvailableWorkflows(workflows);
            // Default to first available workflow if none selected and filtered by script logic ideally
            if (workflows.length > 0 && !selectedWorkflow) {
                // Try to find script workflows first
                const scriptWfs = workflows.filter(w => w.category === 'script');
                if (scriptWfs.length > 0) setSelectedWorkflow(scriptWfs[0]);
                else setSelectedWorkflow(workflows[0]);
            }
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
                
                // When loading a scene, populate step 1 with content if it's empty? 
                // Or just keep workflow state separate. For now, workflow state is transient for generation.
                setIsContentLoading(false);
            }
        };
        loadContent();
    }, [activeScene?.id]);

    // Reset form when workflow changes
    useEffect(() => {
        if (selectedWorkflow) {
            const initial: Record<string, string> = {};
            selectedWorkflow.fields?.forEach(f => {
                // Preserve common fields if switching workflows
                initial[f.variable] = workflowFormState[f.variable] || '';
            });
            setWorkflowFormState(initial);
            setStepResults({}); // Clear previous results
        }
    }, [selectedWorkflow?.id]);

    // Save Data
    const persistScriptData = async (newSettings?: ScriptSettings) => {
        const updatedData = {
            settings: newSettings || settings,
            planning: {
                synopsis: '', 
                characterSettings: '',
                worldview: '',
                outline: '' // Removed specific outline field storage, relying on scene content or workflow step results
            }
        };
        await updateProject(script.id, { 
            // @ts-ignore
            script_data: updatedData 
        });
        setScript(prev => ({ ...prev, scriptData: updatedData }));
    };

    // --- Generation Logic ---
    const handleRunWorkflow = async (mode: 'single' | 'full' = 'single') => {
        if (!selectedWorkflow || !selectedWorkflow.steps) return;
        if (isGenerating) { handleStop(); return; }

        // Ensure active scene for content
        let targetScene = activeScene;
        if (!targetScene) {
            await handleCreateEpisode();
            // Need to wait for state update or use the newly created ref
            // For simplicity, we just created it, next render will pick it up or we proceed with basic assumption
        }

        setIsGenerating(true);
        setStepResults({}); // Clear previous run
        setCurrentStepIndex(0);

        const assetContext = Array.from(selectedAssetIds).map(id => assets.find(a => a.id === id)).filter(Boolean).map(a => `【参考素材：${a!.name}】\n${a!.content}`).join('\n\n');
        const basicInfo = `【剧本基础信息】\n总集数：${settings.totalEpisodes}\n单集时长：${settings.durationPerEpisode}min\n语言：${settings.outputLanguage}\n\n`;
        
        let currentContext: Record<string, string> = { ...workflowFormState };
        const controller = new AbortController();
        abortControllerRef.current = controller;

        try {
            incrementWorkflowUsage(selectedWorkflow.id);

            for (let i = 0; i < selectedWorkflow.steps!.length; i++) {
                if (controller.signal.aborted) break;
                setCurrentStepIndex(i);
                
                const step = selectedWorkflow.steps![i];
                let prompt = step.prompt;

                // Replace variables
                Object.keys(currentContext).forEach(key => {
                    prompt = prompt.replace(new RegExp(`\\$\\{${key}\\}`, 'g'), currentContext[key] || '');
                });

                const finalPrompt = `${basicInfo}${assetContext ? `【关联素材】\n${assetContext}\n\n` : ''}${prompt}`;
                
                let stepOutput = '';
                const stream = generateTextStream(finalPrompt, { 
                    model: settings.model, 
                    temperature: 0.8, 
                    topP: 0.95, 
                    signal: controller.signal 
                });

                for await (const chunk of stream) {
                    stepOutput += chunk;
                    setStepResults(prev => ({ ...prev, [step.outputVariable]: stepOutput }));
                }

                // Auto scroll to next step container
                if (stepRefs.current[i]) {
                    stepRefs.current[i]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }

                // Store result for next steps
                currentContext[step.outputVariable] = stepOutput;
            }

            // Auto-save the final result to the active scene if it's a script generation workflow
            // Assuming the last step is the "content"
            if (activeScene) {
                const finalContent = Object.values(currentContext).join('\n\n');
                // Optional: Save to DB logic here
            }

        } catch (e) {
            console.error(e);
        } finally {
            setIsGenerating(false);
            setCurrentStepIndex(null);
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
        }
    };

    const handleStop = () => {
        if (abortControllerRef.current) abortControllerRef.current.abort();
        setIsGenerating(false);
        setCurrentStepIndex(null);
    };

    const scrollToStep = (index: number) => {
        if (stepRefs.current[index]) {
            stepRefs.current[index]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    const handleTriggerFollowUp = (stepContent: string, variable: string) => {
        const selection = window.getSelection();
        let text = '';
        if (selection && selection.toString().trim()) {
            text = selection.toString().trim();
        }
        
        setActiveFollowUp({
            target: text,
            context: stepContent,
            initialMode: text ? 'selection' : 'full'
        });
    };

    // Helper for episode grouping
    const episodeGroups = useMemo(() => {
        const groups = [];
        for (let i = 0; i < script.scenes.length; i += 5) {
            groups.push(script.scenes.slice(i, i + 5));
        }
        return groups;
    }, [script.scenes]);

    const renderSetupSidebar = () => (
        <div className="flex flex-col h-full bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 font-sans w-96 relative">
            <div className="flex-1 overflow-y-auto custom-scrollbar px-4 py-6 space-y-8">
                {/* 1. Model Configuration */}
                <div className="space-y-3">
                    <h3 className="text-sm font-black text-blue-600 dark:text-blue-400 flex items-center gap-2">
                        <AdjustmentsHorizontal className="w-4 h-4" />
                        1. 模型配置
                    </h3>
                    <div className="pl-1">
                        <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">选择基座模型</label>
                        <CustomSelect 
                            value={settings.model} 
                            onChange={(v) => setSettings(s => ({...s, model: v}))} 
                            options={MODEL_OPTIONS} 
                            className="z-50"
                        />
                    </div>
                </div>

                {/* 2. Basic Info */}
                <div className="space-y-3">
                    <h3 className="text-sm font-black text-blue-600 dark:text-blue-400 flex items-center gap-2">
                        <DocumentText className="w-4 h-4" />
                        2. 剧本基本信息
                    </h3>
                    <div className="grid grid-cols-2 gap-3 pl-1">
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-gray-400">总集数</label>
                            <input type="number" value={settings.totalEpisodes} onChange={e => setSettings(s => ({...s, totalEpisodes: e.target.value}))} className="w-full p-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-gray-400">单集时长(min)</label>
                            <input type="text" value={settings.durationPerEpisode} onChange={e => setSettings(s => ({...s, durationPerEpisode: e.target.value}))} className="w-full p-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-gray-400">场次限制</label>
                            <input type="number" value={settings.scenesPerEpisodeLimit} onChange={e => setSettings(s => ({...s, scenesPerEpisodeLimit: e.target.value}))} className="w-full p-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-gray-400">语言</label>
                            <div className="relative z-40">
                                <CustomSelect value={settings.outputLanguage} onChange={(v) => setSettings(s => ({...s, outputLanguage: v as 'zh' | 'en'}))} options={LANGUAGE_OPTIONS} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* 3. Workflow & Form */}
                <div className="space-y-4">
                    <h3 className="text-sm font-black text-blue-600 dark:text-blue-400 flex items-center gap-2">
                        <WorkflowIcon className="w-4 h-4" />
                        3. 工作流配置
                    </h3>
                    <div className="space-y-4 pl-1">
                        {/* Asset Selection */}
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">关联素材</label>
                            <button onClick={() => setAssetModalOpen(true)} className={`w-full p-3 rounded-xl border border-dashed text-xs transition-all text-left flex justify-between items-center group ${selectedAssetIds.size > 0 ? 'border-blue-300 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400' : 'border-gray-300 dark:border-gray-700 text-gray-500 hover:border-blue-300'}`}>
                                <span className="truncate font-bold">{selectedAssetIds.size > 0 ? `已关联 ${selectedAssetIds.size} 项素材` : '选择角色/剧情/世界观...'}</span>
                                <Database className={`w-4 h-4 group-hover:scale-110 transition-transform ${selectedAssetIds.size > 0 ? 'text-blue-500' : 'text-gray-400'}`} />
                            </button>
                        </div>

                        {/* Workflow Selection (Replaced Dropdown with Modal Trigger) */}
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">选择工作流</label>
                            <button 
                                onClick={() => setWorkflowModalOpen(true)}
                                className={`w-full p-3 rounded-xl border text-xs text-left flex justify-between items-center group shadow-sm transition-all ${selectedWorkflow ? 'bg-blue-50 border-blue-300 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-blue-300'}`}
                            >
                                <span className="truncate font-bold">{selectedWorkflow ? selectedWorkflow.title : '选择生成流程...'}</span>
                                <ChevronDown className={`w-4 h-4 ${selectedWorkflow ? 'text-blue-500' : 'text-gray-400'}`} />
                            </button>
                        </div>
                        
                        {/* Dynamic Workflow Form */}
                        {selectedWorkflow && (
                            <div className="p-4 bg-blue-50/50 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-800 space-y-4 animate-fade-in">
                                <div className="flex justify-between items-center border-b border-blue-100 dark:border-blue-800 pb-2">
                                    <span className="text-xs font-black text-blue-600 dark:text-blue-400 flex items-center gap-1"><AdjustmentsHorizontal className="w-3 h-3"/> 参数填写</span>
                                    <button onClick={() => { setSelectedWorkflow(null); setWorkflowFormState({}); }} className="text-[10px] text-gray-400 hover:text-red-500"><X className="w-3 h-3"/></button>
                                </div>
                                {selectedWorkflow.fields && selectedWorkflow.fields.map((field) => (
                                    <div key={field.id} className="space-y-1.5">
                                        <div className="flex justify-between items-center">
                                            <label className="text-[11px] font-bold text-gray-600 dark:text-gray-300 block">
                                                {field.label}
                                                {field.required !== false && <span className="text-red-500 ml-0.5">*</span>}
                                            </label>
                                            {field.maxLength && (
                                                <span className={`text-[9px] ${(workflowFormState[field.variable]?.length || 0) > field.maxLength ? 'text-red-500' : 'text-gray-400'}`}>
                                                    {workflowFormState[field.variable]?.length || 0}/{field.maxLength}
                                                </span>
                                            )}
                                        </div>
                                        {field.type === 'textarea' ? (
                                            <textarea 
                                                value={workflowFormState[field.variable] || ''}
                                                onChange={(e) => setWorkflowFormState(p => ({...p, [field.variable]: e.target.value}))}
                                                className="w-full p-2.5 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none h-20"
                                                placeholder={field.description || `请输入${field.label}...`}
                                                maxLength={field.maxLength}
                                            />
                                        ) : (
                                            <input 
                                                type="text"
                                                value={workflowFormState[field.variable] || ''}
                                                onChange={(e) => setWorkflowFormState(p => ({...p, [field.variable]: e.target.value}))}
                                                className="w-full p-2.5 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                                placeholder={field.description || `请输入${field.label}...`}
                                                maxLength={field.maxLength}
                                            />
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Bottom Action Area - More Compact */}
            <div className="p-3 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
                {isGenerating ? (
                    <button 
                        onClick={handleStop} 
                        className="w-full py-2 bg-red-500 text-white font-bold rounded-xl shadow-lg hover:bg-red-600 transition-all flex items-center justify-center gap-2 active:scale-95 text-xs"
                    >
                        <Stop className="w-3.5 h-3.5" /> 停止生成
                    </button>
                ) : (
                    <div className="flex gap-2">
                        <button 
                            onClick={() => handleRunWorkflow('single')} 
                            className="flex-1 py-2 bg-blue-50 text-blue-600 border border-blue-200 font-bold rounded-xl hover:bg-blue-100 transition-all flex items-center justify-center gap-1 shadow-sm text-xs"
                        >
                            <Film className="w-3.5 h-3.5" /> 分集创作
                        </button>
                        <button 
                            onClick={() => handleRunWorkflow('full')} 
                            className="flex-1 py-2 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-500 shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-1 text-xs"
                        >
                            <Play className="w-3.5 h-3.5" /> 一键全集
                        </button>
                        <button 
                            onClick={() => handleRunWorkflow('single')} 
                            className="px-3 py-2 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 font-bold rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-all flex items-center justify-center gap-1 text-xs whitespace-nowrap"
                            title="重新生成"
                        >
                            <ArrowPath className="w-3.5 h-3.5" /> 重新生成
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
                    setActiveFollowUp(null);
                }}
            />

            {/* Selection Modals */}
            <AssetSelectionModal isOpen={isAssetModalOpen} onClose={() => setAssetModalOpen(false)} assets={assets} selectedAssetIds={selectedAssetIds} onToggleAsset={(id) => setSelectedAssetIds(prev => { const next = new Set(prev); if(next.has(id)) next.delete(id); else next.add(id); return next; })} />
            
            {/* WORKFLOW SELECTION MODAL */}
            {isWorkflowModalOpen && createPortal(
                <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setWorkflowModalOpen(false)}>
                    <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[80vh] flex flex-col overflow-hidden animate-fade-in-up" onClick={e => e.stopPropagation()}>
                        <div className="p-5 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-gray-900/50">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <WorkflowIcon className="w-5 h-5 text-blue-500" />
                                选择剧本工作流
                            </h3>
                            <button onClick={() => setWorkflowModalOpen(false)} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-full transition-colors text-gray-400">
                                <X className="w-5 h-5"/>
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-5 custom-scrollbar bg-gray-50 dark:bg-black/20">
                            {availableWorkflows.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {availableWorkflows.map(wf => (
                                        <button
                                            key={wf.id}
                                            onClick={() => { setSelectedWorkflow(wf); setWorkflowModalOpen(false); }}
                                            className={`w-full text-left p-4 rounded-xl border transition-all flex flex-col gap-2 group hover:shadow-lg hover:-translate-y-1 ${selectedWorkflow?.id === wf.id ? 'bg-blue-50 border-blue-500 ring-1 ring-blue-500 dark:bg-blue-900/20' : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 hover:border-blue-300 dark:hover:border-blue-700'}`}
                                        >
                                            <div className="flex justify-between items-start w-full mb-1">
                                                <div className="font-bold text-gray-900 dark:text-white text-sm group-hover:text-blue-600 transition-colors line-clamp-1">{wf.title}</div>
                                                {selectedWorkflow?.id === wf.id && <div className="bg-blue-500 text-white rounded-full p-0.5"><Check className="w-3 h-3" /></div>}
                                            </div>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed h-8">{wf.description || '暂无描述'}</p>
                                            <div className="mt-auto pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center gap-3 text-[10px] text-gray-400 w-full">
                                                <span className="flex items-center gap-1"><UserCircle className="w-3 h-3"/> {wf.author || '未知'}</span>
                                                <span className="flex items-center gap-1"><Fire className="w-3 h-3 text-orange-400"/> {wf.usageCount || 0}</span>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-20 text-gray-400 flex flex-col items-center">
                                    <WorkflowIcon className="w-16 h-16 mb-4 opacity-10" />
                                    <p>暂无可用工作流</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Header with Steps */}
            <header className="flex-shrink-0 bg-white dark:bg-black flex border-b border-gray-200 dark:border-gray-800 z-20 shadow-sm h-14 justify-between px-4">
                <div className="flex items-center gap-3">
                    <Film className="w-5 h-5 text-blue-500" />
                    <span className="font-bold text-base text-gray-900 dark:text-white truncate max-w-[150px]">{script.title}</span>
                </div>
                
                <div className="flex-1 flex items-center justify-center overflow-x-auto no-scrollbar mx-4">
                    <div className="flex items-center bg-gray-50 dark:bg-gray-900 p-1 rounded-lg">
                        {selectedWorkflow?.steps ? (
                            selectedWorkflow.steps.map((step, idx) => (
                                <div key={step.id} className="flex items-center">
                                    <button 
                                        onClick={() => scrollToStep(idx)}
                                        className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 ${
                                            currentStepIndex === idx 
                                            ? 'bg-white dark:bg-gray-800 text-blue-600 shadow-sm ring-1 ring-blue-500/20' 
                                            : (stepResults[step.outputVariable] ? 'text-green-600' : 'text-gray-500 hover:text-gray-900')
                                        }`}
                                    >
                                        <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] ${stepResults[step.outputVariable] ? 'bg-green-100 text-green-600' : 'bg-gray-200 text-gray-500'}`}>
                                            {idx + 1}
                                        </span>
                                        {step.name}
                                    </button>
                                    {idx < selectedWorkflow.steps!.length - 1 && <ChevronRight className="w-3 h-3 text-gray-300 mx-1" />}
                                </div>
                            ))
                        ) : (
                            <span className="text-xs text-gray-400 px-4">请先选择工作流</span>
                        )}
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
                     {/* Content Header & Toolbar */}
                     <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 p-2 flex justify-between items-center shrink-0 h-12 relative">
                         <div className="flex items-center gap-4 pl-4 w-1/3">
                             <h2 className="text-base font-bold text-sky-500 dark:text-sky-400 flex items-center gap-2 truncate">
                                 {activeScene?.title || '剧本正文'}
                             </h2>
                             {saveStatus === 'saving' && <span className="text-xs text-blue-500 animate-pulse whitespace-nowrap">保存中...</span>}
                             {saveStatus === 'saved' && <span className="text-xs text-green-500 whitespace-nowrap">已保存</span>}
                         </div>
                         
                         {/* Centered Toolbar */}
                         <div className="absolute left-1/2 -translate-x-1/2">
                             <WritingToolbar onAction={() => {}} alignment={alignment} />
                         </div>

                         <div className="flex items-center gap-2 w-1/3 justify-end">
                             <div className="relative">
                                 <button 
                                    onClick={() => setIsEpisodeSelectorOpen(!isEpisodeSelectorOpen)}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-sky-50 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400 rounded-lg text-xs font-bold hover:bg-sky-100 dark:hover:bg-sky-900/50 transition-colors"
                                 >
                                     {activeScene?.title || "选择集数"}
                                     <ChevronDown className="w-3 h-3" />
                                 </button>
                                 
                                 {isEpisodeSelectorOpen && (
                                     <>
                                         <div className="fixed inset-0 z-40" onClick={() => setIsEpisodeSelectorOpen(false)} />
                                         <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 z-50 p-1 max-h-60 overflow-y-auto custom-scrollbar animate-fade-in">
                                             <div className="px-3 py-2 text-[10px] font-bold text-gray-400 uppercase border-b border-gray-100 dark:border-gray-700 mb-1 flex justify-between items-center">
                                                 <span>剧本集数</span>
                                                 <button onClick={() => { handleCreateEpisode(); setIsEpisodeSelectorOpen(false); }} className="text-blue-500 hover:underline">+ 新建</button>
                                             </div>
                                             
                                             {script.scenes.length > 0 ? (
                                                 episodeGroups.map((group, groupIdx) => (
                                                     <div key={groupIdx} className="mb-1">
                                                         <button className="w-full text-left px-3 py-1.5 text-xs font-bold text-sky-600 bg-sky-50/50 hover:bg-sky-100 dark:text-sky-400 dark:bg-sky-900/20 dark:hover:bg-sky-900/40 rounded-md mb-1 cursor-default">
                                                             第 {groupIdx * 5 + 1} - {Math.min((groupIdx + 1) * 5, script.scenes.length)} 集
                                                         </button>
                                                         <div className="pl-2 space-y-0.5 border-l-2 border-sky-100 dark:border-sky-900 ml-2">
                                                             {group.map((scene) => (
                                                                 <button 
                                                                     key={scene.id}
                                                                     onClick={() => { setActiveScene(scene); setIsEpisodeSelectorOpen(false); }}
                                                                     className={`w-full text-left px-2 py-1.5 rounded-md text-[11px] font-medium transition-colors truncate ${activeScene?.id === scene.id ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                                                                 >
                                                                     {scene.title}
                                                                 </button>
                                                             ))}
                                                         </div>
                                                     </div>
                                                 ))
                                             ) : (
                                                 <div className="p-3 text-center text-xs text-gray-400">暂无集数</div>
                                             )}
                                         </div>
                                     </>
                                 )}
                             </div>
                         </div>
                     </div>
                     
                     <div className="flex-1 overflow-y-auto p-8 lg:px-16 custom-scrollbar relative scroll-smooth" ref={scrollContainerRef}>
                         {/* Default State */}
                         {!selectedWorkflow && (
                             <div className="flex flex-col items-center justify-center h-full text-gray-400">
                                 <WorkflowIcon className="w-16 h-16 mb-4 opacity-20" />
                                 <p>请在左侧选择一个工作流开始创作</p>
                             </div>
                         )}

                         {/* Workflow Steps Output - Continuous Scroll */}
                         {selectedWorkflow && (
                             <div className="space-y-12 pb-32 max-w-4xl mx-auto">
                                 {selectedWorkflow.steps?.map((step, index) => {
                                     const result = stepResults[step.outputVariable];
                                     const isGeneratingThis = currentStepIndex === index && isGenerating;
                                     
                                     return (
                                         <div 
                                            key={step.id} 
                                            ref={(el: HTMLDivElement | null) => { stepRefs.current[index] = el; }}
                                            className={`transition-opacity duration-500 ${!result && !isGeneratingThis ? 'opacity-50' : 'opacity-100'}`}
                                         >
                                             <div className="flex items-center gap-3 mb-4 sticky top-0 bg-gray-50/95 dark:bg-gray-950/95 py-2 z-10 backdrop-blur-sm">
                                                 <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${result ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'}`}>
                                                     {result ? <Check className="w-3 h-3"/> : index + 1}
                                                 </div>
                                                 <h3 className="text-sm font-bold text-gray-800 dark:text-white uppercase tracking-wide">{step.name}</h3>
                                                 {isGeneratingThis && <ArrowPath className="w-4 h-4 text-blue-500 animate-spin" />}
                                             </div>
                                             
                                             <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-3"></div>
                                                {result && (
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <button 
                                                            type="button"
                                                            onClick={() => handleTriggerFollowUp(result, step.outputVariable)} 
                                                            className="flex items-center gap-1 px-3 py-1 text-xs font-bold bg-sky-50 text-sky-600 hover:bg-sky-100 dark:bg-sky-900/20 dark:text-sky-400 dark:hover:bg-sky-900/40 rounded-lg transition-colors border border-sky-100 dark:border-sky-800"
                                                        >
                                                            <ChatBubbleOvalLeftEllipsis className="w-3.5 h-3.5" /> 
                                                            智能追问
                                                        </button>
                                                        <button 
                                                            type="button"
                                                            onClick={() => {
                                                                // Handle save/import logic if needed
                                                            }}
                                                            className="flex items-center gap-1 px-3 py-1 text-xs font-bold text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors border border-transparent hover:border-emerald-100"
                                                        >
                                                            <DocumentPlus className="w-3.5 h-3.5" /> 存入
                                                        </button>
                                                    </div>
                                                )}
                                             </div>

                                             <div 
                                                 className="min-h-[100px] bg-white dark:bg-gray-900 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-800 relative group"
                                             >
                                                 <div 
                                                    ref={(el: HTMLDivElement | null) => { resultRefs.current[step.outputVariable] = el; }}
                                                    onMouseUp={() => handleTriggerFollowUp(result, step.outputVariable)}
                                                 >
                                                     {result ? (
                                                         <FormattedText text={result} />
                                                     ) : isGeneratingThis ? (
                                                         <div className="flex items-center gap-2 text-blue-500 text-sm animate-pulse">
                                                             <Sparkles className="w-4 h-4" /> 正在生成内容...
                                                         </div>
                                                     ) : (
                                                         <div className="text-gray-400 text-sm italic">等待生成...</div>
                                                     )}
                                                 </div>
                                             </div>
                                         </div>
                                     );
                                 })}
                             </div>
                         )}
                         
                         {isGenerating && (
                             <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-6 py-2 rounded-full shadow-lg flex items-center gap-2 animate-pulse z-50">
                                 <ArrowPath className="w-4 h-4 animate-spin" />
                                 正在按步骤生成剧本...
                                 <button onClick={handleStop} className="ml-2 hover:text-red-200"><X className="w-4 h-4"/></button>
                             </div>
                         )}
                     </div>
                </main>
            </div>
        </div>
    );
};

export default ScriptWritingPage;
