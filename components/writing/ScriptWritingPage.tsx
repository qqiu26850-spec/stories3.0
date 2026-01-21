
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Script, Scene, ScriptSettings, ScriptPlanning, Prompt, Asset } from '../../types';
import { Film, ArrowPath, Check, ChevronLeft, ChevronRight, AdjustmentsHorizontal, Sparkles, DocumentText, UserCircle, Globe, ListBullet, Database, Play } from '../Icon';
import ScriptEpisodeManager from './ScriptEpisodeManager';
import WritingToolbar from './WritingToolbar';
import { saveChapterToDB, updateProject, fetchChapters, fetchChapterContent, deleteChapterFromDB, updateChapterOrder, fetchMaterials } from '../../services/supabaseService';
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
type ScriptPhase = 'setup' | 'planning' | 'writing';
type PlanningModule = 'synopsis' | 'character' | 'worldview' | 'outline';

// --- Context Menu ---
const ScriptContextMenu: React.FC<{
    x: number;
    y: number;
    visible: boolean;
    onClose: () => void;
    onAction: (action: 'ask') => void;
}> = ({ x, y, visible, onClose, onAction }) => {
    if (!visible) return null;
    return createPortal(
        <div 
            className="fixed z-50 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-100 dark:border-gray-700 py-1 min-w-[120px] animate-fade-in"
            style={{ top: y, left: x }}
            onMouseLeave={onClose}
        >
            <button
                onClick={() => { onAction('ask'); onClose(); }}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-sky-50 dark:hover:bg-sky-900/30 hover:text-sky-600 transition-colors flex items-center gap-2"
            >
                <span>💬</span> 智能追问
            </button>
        </div>,
        document.body
    );
};

const MODEL_OPTIONS = [
    { value: "deepseek-chat", label: "奇思版 (DeepSeek)" },
    { value: "gemini-3-flash-preview", label: "妙写版 (Gemini 3.0 Flash)" },
    { value: "doubao-flash", label: "速写版 (豆包)" }
];

const LANGUAGE_OPTIONS = [
    { value: "zh", label: "中文" },
    { value: "en", label: "English" }
];

const ScriptWritingPage: React.FC<ScriptWritingPageProps> = ({ script: initialScript, onBack }) => {
    // Core Data
    const [script, setScript] = useState<Script>(initialScript);
    const [currentPhase, setCurrentPhase] = useState<ScriptPhase>('setup');
    const [activePlanningModule, setActivePlanningModule] = useState<PlanningModule | null>(null);
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
    
    // Planning Data State
    const [planningData, setPlanningData] = useState<ScriptPlanning>({
        synopsis: '',
        characterSettings: '',
        worldview: '',
        outline: ''
    });

    // Asset & Prompt Selection
    const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);
    const [selectedAssetIds, setSelectedAssetIds] = useState<Set<string>>(new Set());
    const [assets, setAssets] = useState<Asset[]>([]);
    const [isAssetModalOpen, setAssetModalOpen] = useState(false);
    const [isPromptModalOpen, setPromptModalOpen] = useState(false);

    // Editor & UI State
    const [wordCount, setWordCount] = useState(0);
    const [alignment, setAlignment] = useState<'left' | 'center' | 'right' | 'justify'>('left');
    const [fontSize, setFontSize] = useState(18);
    const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
    const [isLeftSidebarOpen, setLeftSidebarOpen] = useState(true);
    const [isContentLoading, setIsContentLoading] = useState(false);
    const [showLoadingOverlay, setShowLoadingOverlay] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('');

    const editorRef = useRef<HTMLDivElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const updateTimeoutRef = useRef<any>(null);

    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; visible: boolean; text: string }>({ x: 0, y: 0, visible: false, text: '' });
    const [activeFollowUp, setActiveFollowUp] = useState<{ target: string; context: string; initialMode: 'selection' | 'full' } | null>(null);

    // --- Initialization ---
    useEffect(() => {
        const loadInitialData = async () => {
            // 1. Load Chapters (Episodes)
            const data = await fetchChapters(script.id);
            if (data) {
               const mapped: Scene[] = data.map((c: any) => ({
                   id: c.id,
                   title: c.title,
                   content: '', 
                   isContentLoaded: false
               }));
               setScript(prev => ({ ...prev, scenes: mapped }));
               
               // 2. Load script_data (Settings & Planning)
               let loadedData: any = script.scriptData;
               
               // Fallback: Check if description contains JSON (legacy)
               if (!loadedData && script.type === 'original') {
                   // This part depends on how fetchProjects is implemented.
               }

               if (loadedData && loadedData.settings) {
                   setSettings(loadedData.settings);
                   if (loadedData.planning) setPlanningData(loadedData.planning);
                   
                   // Intelligent Phase Routing
                   if (mapped.length > 0) {
                       setCurrentPhase('writing');
                       setActiveScene(mapped[0]);
                   } else if (loadedData.planning?.synopsis || loadedData.planning?.outline) {
                       setCurrentPhase('planning');
                       setActivePlanningModule('synopsis');
                   } else {
                       setCurrentPhase('setup');
                   }
               }
            }
            
            // 3. Load Assets for selection
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

    // Save Settings & Planning Data to DB
    const persistScriptData = async (newSettings?: ScriptSettings, newPlanning?: ScriptPlanning) => {
        const updatedData = {
            settings: newSettings || settings,
            planning: newPlanning || planningData
        };
        
        // Save to script_data column
        await updateProject(script.id, { 
            // @ts-ignore: Assuming updateProject handles arbitrary fields or we updated its type signature
            script_data: updatedData 
        });
        
        setScript(prev => ({ ...prev, scriptData: updatedData }));
    };

    // --- Planning Generation Logic ---
    const handleStartPlanning = async () => {
        if (!settings.totalEpisodes || !settings.durationPerEpisode) {
            alert("请填写必要的基本信息");
            return;
        }
        
        setLoadingMessage('正在生成剧本策划案...');
        setShowLoadingOverlay(true);
        setCurrentPhase('planning');
        
        // Save settings first
        await persistScriptData(settings);

        try {
            // Context Construction
            const assetContext = Array.from(selectedAssetIds).map(id => assets.find(a => a.id === id)).filter(Boolean).map(a => `【参考素材：${a!.name}】\n${a!.content}`).join('\n\n');
            const promptContext = selectedPrompt ? selectedPrompt.template : '';
            const basicInfo = `剧本类型：${settings.format === 'live_action' ? '真人剧' : '漫剧'}
总集数：${settings.totalEpisodes}集
单集时长：${settings.durationPerEpisode}分钟
每集场景限制：${settings.scenesPerEpisodeLimit}场
语言：${settings.outputLanguage === 'zh' ? '中文' : 'English'}`;

            const baseInstruction = `请作为专业编剧策划，根据以下信息进行剧本策划。\n${basicInfo}\n\n${assetContext ? `关联素材：\n${assetContext}\n\n` : ''}${promptContext ? `用户指令：\n${promptContext}\n\n` : ''}`;

            // Generate modules sequentially
            
            // 1. Synopsis
            const synopsis = await generateOneShot(baseInstruction + "任务：请撰写【剧本梗概】，包含核心冲突、主线脉络和结局走向。");
            setPlanningData(prev => ({...prev, synopsis}));
            
            // 2. Character
            const characters = await generateOneShot(baseInstruction + "任务：请撰写【角色设定】，包含主要人物的小传、性格、外貌及人物关系图。");
            setPlanningData(prev => ({...prev, characterSettings: characters}));
            
            // 3. Worldview
            const worldview = await generateOneShot(baseInstruction + "任务：请撰写【世界观设定】，包含故事背景、社会规则、关键地点或特殊道具。");
            setPlanningData(prev => ({...prev, worldview}));
            
            // 4. Outline
            const outline = await generateOneShot(baseInstruction + "任务：请撰写【剧本大纲】，列出每一集的关键情节点。");
            setPlanningData(prev => ({...prev, outline}));

            // Save all
            await persistScriptData(undefined, { synopsis, characterSettings: characters, worldview, outline });
            
            setActivePlanningModule('synopsis');

        } catch (e) {
            alert("生成策划案失败，请重试");
            console.error(e);
        } finally {
            setShowLoadingOverlay(false);
        }
    };

    const generateOneShot = async (prompt: string) => {
        let text = '';
        const stream = generateTextStream(prompt, { model: settings.model, temperature: 0.8, topP: 0.95 });
        for await (const chunk of stream) {
            text += chunk;
        }
        return text;
    };

    // --- Writing Phase Logic (Episodes) ---
    const handleGenerateEpisodes = async () => {
        setLoadingMessage('正在生成分集剧本...');
        setShowLoadingOverlay(true);
        
        try {
            // Use outline to generate episode 1 as a start
            const prompt = `根据以下大纲，生成第1集的完整剧本。\n\n【剧本大纲】：\n${planningData.outline}\n\n【格式要求】：标准影视剧本格式，包含场景标题、动作、对白。`;
            const content = await generateOneShot(prompt);
            
            // Create Episode 1
            const epTitle = "第1集";
            const newId = await saveChapterToDB(script.id, `new-ep1-${Date.now()}`, epTitle, content, 1);
            
            if (newId) {
                const newScene: Scene = { id: newId, title: epTitle, content, isContentLoaded: true };
                setScript(prev => ({ ...prev, scenes: [...prev.scenes, newScene] }));
                setCurrentPhase('writing');
                setActiveScene(newScene);
            }
        } catch(e) {
            alert("生成分集失败");
        } finally {
            setShowLoadingOverlay(false);
        }
    };

    // --- Render Logic ---

    // Sync editor content when switching modules/scenes
    useEffect(() => {
        if (editorRef.current) {
            if (currentPhase === 'planning' && activePlanningModule) {
                // Planning Phase: Show readonly/editable planning text
                const text = planningData[activePlanningModule === 'character' ? 'characterSettings' : activePlanningModule];
                editorRef.current.innerHTML = text ? text.replace(/\n/g, '<br>') : '<p class="text-gray-400">暂无内容，请点击生成...</p>';
            } else if (currentPhase === 'writing' && activeScene) {
                // Writing Phase: Show episode content
                if (activeScene.isContentLoaded) {
                    const html = activeScene.content.includes('<p>') ? activeScene.content : activeScene.content.split('\n').map(p => `<p>${p || '<br>'}</p>`).join('');
                    editorRef.current.innerHTML = html;
                } else {
                    // Lazy load
                    loadSceneContent(activeScene);
                }
            }
        }
    }, [currentPhase, activePlanningModule, activeScene, planningData]);

    const loadSceneContent = async (scene: Scene) => {
        setIsContentLoading(true);
        const content = await fetchChapterContent(scene.id);
        setScript(prev => ({
            ...prev,
            scenes: prev.scenes.map(s => s.id === scene.id ? { ...s, content, isContentLoaded: true } : s)
        }));
        // Update ref immediately
        if (editorRef.current) {
             const html = content.includes('<p>') ? content : content.split('\n').map(p => `<p>${p || '<br>'}</p>`).join('');
             editorRef.current.innerHTML = html;
        }
        setIsContentLoading(false);
    };

    // Auto-save logic for editor
    const handleContentInput = () => {
        if (!editorRef.current) return;
        const text = editorRef.current.innerText;
        const html = editorRef.current.innerHTML;
        setWordCount(text.replace(/\s/g, '').length);
        setSaveStatus('saving');

        if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current);
        updateTimeoutRef.current = setTimeout(async () => {
            if (currentPhase === 'planning' && activePlanningModule) {
                const key = activePlanningModule === 'character' ? 'characterSettings' : activePlanningModule;
                const newData = { ...planningData, [key]: text };
                setPlanningData(newData);
                await persistScriptData(undefined, newData);
            } else if (currentPhase === 'writing' && activeScene) {
                await saveChapterToDB(script.id, activeScene.id, activeScene.title, html, 99); 
                // Update local state lightly
                setScript(prev => ({
                    ...prev,
                    scenes: prev.scenes.map(s => s.id === activeScene.id ? { ...s, content: html } : s)
                }));
            }
            setSaveStatus('saved');
        }, 1000);
    };

    // Sidebar Renders
    const renderSetupSidebar = () => (
        <div className="flex flex-col h-full p-4 space-y-6 overflow-y-auto custom-scrollbar">
            {/* Toggle */}
            <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
                <button onClick={() => setSettings(s => ({ ...s, format: 'live_action' }))} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${settings.format === 'live_action' ? 'bg-white dark:bg-gray-700 shadow-sm text-sky-600' : 'text-gray-500'}`}>真人剧</button>
                <button onClick={() => setSettings(s => ({ ...s, format: 'animation' }))} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${settings.format === 'animation' ? 'bg-white dark:bg-gray-700 shadow-sm text-purple-600' : 'text-gray-500'}`}>漫剧</button>
            </div>

            {/* Model */}
            <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase">选择模型</label>
                <CustomSelect value={settings.model} onChange={(v) => setSettings(s => ({...s, model: v}))} options={MODEL_OPTIONS} />
            </div>

            {/* Basic Info */}
            <div className="space-y-4 border-t border-gray-200 dark:border-gray-800 pt-4">
                <h3 className="font-bold text-gray-800 dark:text-gray-200 text-sm flex items-center gap-2"><AdjustmentsHorizontal className="w-4 h-4"/> 剧本基础信息</h3>
                <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                        <label className="text-[10px] text-gray-400">总集数</label>
                        <input type="number" value={settings.totalEpisodes} onChange={e => setSettings(s => ({...s, totalEpisodes: e.target.value}))} className="w-full p-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm" />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] text-gray-400">单集时长(分钟)</label>
                        <input type="text" value={settings.durationPerEpisode} onChange={e => setSettings(s => ({...s, durationPerEpisode: e.target.value}))} className="w-full p-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm" />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] text-gray-400">每集场景限制</label>
                        <input type="number" value={settings.scenesPerEpisodeLimit} onChange={e => setSettings(s => ({...s, scenesPerEpisodeLimit: e.target.value}))} className="w-full p-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm" />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] text-gray-400">输出语言</label>
                        <CustomSelect value={settings.outputLanguage} onChange={(v) => setSettings(s => ({...s, outputLanguage: v as 'zh' | 'en'}))} options={LANGUAGE_OPTIONS} />
                    </div>
                </div>
            </div>

            {/* Prompts & Assets */}
            <div className="space-y-4 border-t border-gray-200 dark:border-gray-800 pt-4">
                <h3 className="font-bold text-gray-800 dark:text-gray-200 text-sm flex items-center gap-2"><Sparkles className="w-4 h-4"/> 提示词与素材</h3>
                <button onClick={() => setPromptModalOpen(true)} className="w-full p-3 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 text-sm text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left flex justify-between items-center">
                    <span className="truncate">{selectedPrompt ? selectedPrompt.title : '选择提示词...'}</span>
                    <ChevronRight className="w-4 h-4" />
                </button>
                <button onClick={() => setAssetModalOpen(true)} className="w-full p-3 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 text-sm text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left flex justify-between items-center">
                    <span className="truncate">{selectedAssetIds.size > 0 ? `已关联 ${selectedAssetIds.size} 项素材` : '关联素材...'}</span>
                    <Database className="w-4 h-4" />
                </button>
            </div>

            <button onClick={handleStartPlanning} className="mt-auto w-full py-3 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-xl shadow-lg shadow-sky-500/20 transition-all flex items-center justify-center gap-2">
                <Sparkles className="w-5 h-5" /> 开启剧本策划
            </button>
        </div>
    );

    const renderPlanningSidebar = () => (
        <div className="flex flex-col h-full bg-white dark:bg-black w-full border-r border-gray-200 dark:border-gray-800">
            <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center gap-2 text-gray-500 cursor-pointer hover:text-gray-900" onClick={() => setCurrentPhase('setup')}>
                <ChevronLeft className="w-4 h-4" /> <span className="text-sm font-bold">返回设置</span>
            </div>
            
            <div className="flex-1 p-4 space-y-3">
                {[
                    { id: 'synopsis', label: '剧本梗概', icon: DocumentText },
                    { id: 'character', label: '角色设定', icon: UserCircle },
                    { id: 'worldview', label: '世界观设定', icon: Globe },
                    { id: 'outline', label: '剧本大纲', icon: ListBullet },
                ].map(mod => (
                    <button 
                        key={mod.id}
                        onClick={() => setActivePlanningModule(mod.id as PlanningModule)}
                        className={`w-full p-4 rounded-xl text-left border transition-all flex items-center gap-3 ${activePlanningModule === mod.id ? 'bg-sky-50 border-sky-200 text-sky-700 dark:bg-sky-900/20 dark:text-sky-400 dark:border-sky-800' : 'bg-gray-50 border-transparent text-gray-600 hover:bg-gray-100 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800'}`}
                    >
                        <mod.icon className="w-5 h-5" />
                        <span className="font-bold">{mod.label}</span>
                    </button>
                ))}
            </div>

            <div className="p-4 border-t border-gray-200 dark:border-gray-800 space-y-2">
                <button onClick={handleGenerateEpisodes} className="w-full py-3 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2">
                    <Film className="w-5 h-5" /> 分集生成
                </button>
                <button onClick={handleGenerateEpisodes} className="w-full py-3 bg-white border border-gray-200 dark:bg-gray-900 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-bold rounded-xl hover:bg-gray-50 transition-all flex items-center justify-center gap-2">
                    <Play className="w-5 h-5" /> 一键生成全剧
                </button>
            </div>
        </div>
    );

    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 overflow-hidden relative">
            <LoadingOverlay isVisible={showLoadingOverlay} message={loadingMessage} onClose={() => setShowLoadingOverlay(false)} />
            
            <FollowUpModal 
                isOpen={!!activeFollowUp} 
                onClose={() => setActiveFollowUp(null)} 
                targetText={activeFollowUp?.target || ''}
                context={editorRef.current?.innerText || ''}
                initialMode={'selection'}
                onApply={(text, type) => {
                    if(!editorRef.current) return;
                    editorRef.current.focus();
                    if(type === 'replace') document.execCommand('insertText', false, text);
                    else document.execCommand('insertText', false, text);
                    setActiveFollowUp(null);
                }}
            />

            {/* Selection Modals */}
            <AssetSelectionModal isOpen={isAssetModalOpen} onClose={() => setAssetModalOpen(false)} assets={assets} selectedAssetIds={selectedAssetIds} onToggleAsset={(id) => setSelectedAssetIds(prev => { const next = new Set(prev); if(next.has(id)) next.delete(id); else next.add(id); return next; })} />
            <PromptSelectionModal isOpen={isPromptModalOpen} onClose={() => setPromptModalOpen(false)} onSelect={(p) => { setSelectedPrompt(p); setPromptModalOpen(false); }} />

            <header className="flex-shrink-0 bg-white dark:bg-black flex border-b border-gray-200 dark:border-gray-800 z-20 shadow-sm h-16">
                <div className="w-64 flex-shrink-0 flex items-center gap-2 px-4 border-r border-gray-200 dark:border-gray-800">
                    <Film className="w-8 h-8 text-sky-500" />
                    <span className="font-bold text-xl tracking-wider text-gray-900 dark:text-white truncate">{script.title}</span>
                </div>
                
                <div className="flex-1 flex items-center justify-center p-2">
                    <div className="flex items-center gap-2 px-4 py-1.5 bg-gray-100 dark:bg-gray-900 rounded-lg text-sm text-gray-500 font-bold">
                        <span className={`transition-colors ${currentPhase === 'setup' ? 'text-sky-600' : ''}`}>1. 基础设置</span>
                        <ChevronRight className="w-3 h-3" />
                        <span className={`transition-colors ${currentPhase === 'planning' ? 'text-sky-600' : ''}`}>2. 剧本策划</span>
                        <ChevronRight className="w-3 h-3" />
                        <span className={`transition-colors ${currentPhase === 'writing' ? 'text-sky-600' : ''}`}>3. 分集创作</span>
                    </div>
                </div>
                
                <div className="w-[29%] flex-shrink-0 flex items-center justify-end px-4 border-l border-gray-200 dark:border-gray-800 gap-3">
                    <div className="flex items-center gap-2 mr-2 text-xs font-bold">
                         {saveStatus === 'saving' && <span className="text-sky-500 flex items-center gap-1"><ArrowPath className="w-3 h-3 animate-spin"/> 保存中...</span>}
                         {saveStatus === 'saved' && <span className="text-green-500 flex items-center gap-1"><Check className="w-3 h-3"/> 已保存</span>}
                    </div>
                    <button onClick={onBack} className="px-5 py-2 text-sm font-bold text-white bg-sky-500 hover:bg-sky-600 rounded-lg shadow-sm">返回</button>
                </div>
            </header>

            <div className="flex-1 flex overflow-hidden relative">
                {/* Dynamic Sidebar */}
                <aside className={`flex-shrink-0 bg-white dark:bg-black border-r border-gray-200 dark:border-gray-800 transition-all duration-300 overflow-hidden ${isLeftSidebarOpen ? 'w-80' : 'w-0'}`}>
                    {currentPhase === 'setup' && renderSetupSidebar()}
                    {currentPhase === 'planning' && renderPlanningSidebar()}
                    {currentPhase === 'writing' && (
                        <div className="flex flex-col h-full">
                            <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center gap-2 text-gray-500 cursor-pointer hover:text-gray-900" onClick={() => setCurrentPhase('planning')}>
                                <ChevronLeft className="w-4 h-4" /> <span className="text-sm font-bold">返回策划</span>
                            </div>
                            <ScriptEpisodeManager 
                                episodes={script.scenes} 
                                activeEpisodeId={activeScene?.id || null} 
                                onSelectEpisode={setActiveScene} 
                                onDeleteEpisode={async (id) => { await deleteChapterFromDB(id); setScript(p => ({...p, scenes: p.scenes.filter(s => s.id !== id)})); }}
                                onCreateEpisode={handleGenerateEpisodes} 
                                onReorderEpisodes={async (newScenes) => {
                                    setScript(prev => ({ ...prev, scenes: newScenes }));
                                    const updates = newScenes.map((s, i) => ({ id: s.id, order_index: i + 1 }));
                                    await updateChapterOrder(updates);
                                }}
                            />
                        </div>
                    )}
                </aside>

                {/* Sidebar Toggle */}
                <button 
                    onClick={() => setLeftSidebarOpen(!isLeftSidebarOpen)}
                    className={`absolute z-30 top-1/2 -translate-y-1/2 w-4 h-12 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-r-md flex items-center justify-center text-gray-400 hover:text-sky-500 transition-all shadow-sm ${isLeftSidebarOpen ? 'left-80' : 'left-0'}`}
                >
                    {isLeftSidebarOpen ? <ChevronLeft className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                </button>

                {/* Main Editor */}
                <main className="flex-1 bg-gray-50 dark:bg-gray-950 flex flex-col relative overflow-hidden">
                     <div className="flex-1 flex flex-col bg-white dark:bg-gray-900 shadow-sm border-x border-gray-100 dark:border-gray-800 w-full h-full overflow-hidden relative">
                        {currentPhase === 'setup' ? (
                            <div className="flex flex-col items-center justify-center h-full text-gray-400">
                                <Sparkles className="w-20 h-20 mb-4 opacity-20" />
                                <p className="text-lg">请在左侧完成基本设置，开始您的剧本策划</p>
                            </div>
                        ) : (
                            <>
                                <div className="pt-1.5 px-8 pb-1 flex-shrink-0 bg-white dark:bg-gray-900 z-10 flex flex-col gap-1">
                                     <WritingToolbar onAction={(action) => {
                                         if (!editorRef.current) return;
                                         editorRef.current.focus();
                                         if(action === 'bold') document.execCommand('bold');
                                         if(action === 'italic') document.execCommand('italic');
                                         if(action === 'font-increase') setFontSize(s => Math.min(s + 2, 32));
                                         if(action === 'font-decrease') setFontSize(s => Math.max(s - 2, 12));
                                         handleContentInput();
                                     }} alignment={alignment} />
                                </div>

                                <div className="flex-1 overflow-y-auto dynamic-scrollbar px-12 pb-12 pt-1" ref={scrollContainerRef}>
                                    <div className="border-b border-gray-100 dark:border-gray-800 mb-6 pb-2">
                                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                                            {currentPhase === 'planning' ? 
                                                (activePlanningModule === 'synopsis' ? '剧本梗概' : 
                                                 activePlanningModule === 'character' ? '角色设定' : 
                                                 activePlanningModule === 'worldview' ? '世界观' : '大纲') 
                                                : (activeScene?.title || '分集剧本')}
                                        </h2>
                                    </div>
                                    
                                    {isContentLoading ? (
                                        <div className="w-full h-96 flex items-center justify-center">
                                            <div className="w-8 h-8 border-2 border-sky-200 border-t-sky-500 rounded-full animate-spin"></div>
                                        </div>
                                    ) : (
                                        <div 
                                            ref={editorRef}
                                            contentEditable 
                                            onInput={handleContentInput}
                                            onContextMenu={(e) => {
                                                const sel = window.getSelection()?.toString();
                                                if(sel) {
                                                    e.preventDefault();
                                                    setContextMenu({ x: e.clientX, y: e.clientY, visible: true, text: sel });
                                                }
                                            }}
                                            suppressContentEditableWarning={true}
                                            className="w-full bg-transparent focus:outline-none leading-relaxed text-gray-800 dark:text-gray-200 font-mono min-h-[75vh] outline-none pb-32"
                                            style={{ textAlign: alignment, fontSize: `${fontSize}px` }}
                                        ></div>
                                    )}
                                </div>
                                <div className="absolute bottom-6 right-8 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm px-4 py-1.5 rounded-full text-xs text-gray-400 font-mono border border-gray-100 dark:border-gray-800 shadow-sm z-20">
                                    <span className="text-sky-500 font-black">{wordCount}</span> 字
                                </div>
                            </>
                        )}
                     </div>
                </main>
            </div>
        </div>
    );
};

export default ScriptWritingPage;
