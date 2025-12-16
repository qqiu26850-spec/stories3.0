
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Script, Scene } from '../../types';
import { Film, ChevronDoubleLeft, Pencil, ArrowPath, Check, ChevronLeft, ChevronRight } from '../Icon';
import ScriptEpisodeManager from './ScriptEpisodeManager';
import ScriptAIPanel from './ScriptAIPanel';
import ScriptAdaptationPanel from './ScriptAdaptationPanel';
import WritingToolbar, { ToolbarAction } from './WritingToolbar';
import { saveChapterToDB, updateProject, fetchChapters, deleteChapterFromDB } from '../../services/supabaseService';

interface ScriptWritingPageProps {
    script: Script;
    onBack: () => void;
}

type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error';

const ScriptWritingPage: React.FC<ScriptWritingPageProps> = ({ script: initialScript, onBack }) => {
    const [script, setScript] = useState<Script>(initialScript);
    const [activeScene, setActiveScene] = useState<Scene | null>(null);
    const [editorContent, setEditorContent] = useState('');
    const [sceneTitle, setSceneTitle] = useState('');
    const [wordCount, setWordCount] = useState(0);

    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [alignment, setAlignment] = useState<'left' | 'center' | 'right'>('left');
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [tempTitle, setTempTitle] = useState(script.title);
    const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
    
    // Sidebar Visibility
    const [isLeftSidebarOpen, setLeftSidebarOpen] = useState(true);
    const [isRightSidebarOpen, setRightSidebarOpen] = useState(true);
    
    // For AI Streaming
    const insertionRef = useRef<{start: number, end: number} | null>(null);
    const [selectionRange, setSelectionRange] = useState<{start: number, end: number}>({ start: 0, end: 0 });

    // Load scenes
    useEffect(() => {
        const loadScenes = async () => {
            if (!script.id || script.id.startsWith('script-')) return;

            const dbChapters = await fetchChapters(script.id);
            if (dbChapters && dbChapters.length > 0) {
                const mappedScenes: Scene[] = dbChapters.map((c: any) => ({
                    id: c.id,
                    title: c.title,
                    content: c.content || ''
                }));
                setScript(prev => ({ ...prev, scenes: mappedScenes }));
                setActiveScene(mappedScenes[0]);
            } else if (script.scenes.length > 0) {
                setActiveScene(script.scenes[0]);
            }
        };
        loadScenes();
    }, [script.id]);

    useEffect(() => {
        if (activeScene) {
            setSceneTitle(activeScene.title);
            updateEditorState(activeScene.content);
            setSaveStatus('saved');
        } else {
            setSceneTitle('');
            updateEditorState('');
        }
    }, [activeScene]);

    // Auto-Save Logic
    useEffect(() => {
        if (!activeScene) return;
        
        const isChanged = sceneTitle !== activeScene.title || editorContent !== activeScene.content;
        
        if (isChanged) {
            setSaveStatus('saving');
            const timer = setTimeout(async () => {
                await handleSaveToCloud(true);
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [sceneTitle, editorContent, activeScene]);

    const updateEditorState = useCallback((content: string) => {
        setEditorContent(content);
        const count = content.replace(/\s/g, '').length;
        setWordCount(count);
        // Auto-resize
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
        }
    }, []);

    const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        updateEditorState(e.target.value);
        setSelectionRange({ start: e.target.selectionStart, end: e.target.selectionEnd });
    };
    
    const handleSelect = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
        const target = e.target as HTMLTextAreaElement;
        setSelectionRange({ start: target.selectionStart, end: target.selectionEnd });
    }

    const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSceneTitle(e.target.value);
    };

    const handleSaveTitle = async () => {
        if (tempTitle.trim()) {
            setScript(prev => ({ ...prev, title: tempTitle }));
            await updateProject(script.id, { title: tempTitle });
        } else {
            setTempTitle(script.title);
        }
        setIsEditingTitle(false);
    };

    const handleCreateScene = () => {
        const newScene: Scene = {
            id: `scene-${Date.now()}`,
            title: `第 ${script.scenes.length + 1} 集`,
            content: ''
        };
        setScript(prev => ({ ...prev, scenes: [...prev.scenes, newScene] }));
        setActiveScene(newScene);
    };

    const handleDeleteScene = async (id: string) => {
        await deleteChapterFromDB(id);
        const newScenes = script.scenes.filter(s => s.id !== id);
        setScript(prev => ({ ...prev, scenes: newScenes }));
        if (activeScene?.id === id) {
            setActiveScene(newScenes.length > 0 ? newScenes[0] : null);
        }
    };

    const handleInsertText = (text: string) => {
        const start = selectionRange.start;
        const end = selectionRange.end;
        const newContent = editorContent.substring(0, start) + text + editorContent.substring(end);
        updateEditorState(newContent);
    };
    
    // Streaming Handler
    const handleAIStream = (chunk: string, isFirst: boolean) => {
        setEditorContent(prev => {
            let nextContent = prev;
            if (isFirst) {
                const start = selectionRange.start;
                const end = selectionRange.end;
                insertionRef.current = { start: start, end: start + chunk.length };
                nextContent = prev.substring(0, start) + chunk + prev.substring(end);
            } else {
                if (insertionRef.current) {
                    const { end } = insertionRef.current;
                    nextContent = prev.substring(0, end) + chunk + prev.substring(end);
                    insertionRef.current.end += chunk.length;
                }
            }
            
            // Sync word count & resize
            const count = nextContent.replace(/\s/g, '').length;
            setWordCount(count);
            setTimeout(() => {
                if (textareaRef.current) {
                    textareaRef.current.style.height = 'auto';
                    textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
                }
            }, 0);

            return nextContent;
        });
    };

     const handleToolbarAction = (action: ToolbarAction) => {
         const textarea = textareaRef.current;
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const value = textarea.value;
        let newContent = value;

        if (action === 'copy') { navigator.clipboard.writeText(value); return; }
        if (action === 'bold') {
             newContent = value.substring(0, start) + '**' + value.substring(start, end) + '**' + value.substring(end);
        }
        if (newContent !== value) {
            updateEditorState(newContent);
        }
    };

    const handleSaveToCloud = async (silent = false) => {
        if (activeScene) {
            const orderIndex = script.scenes.findIndex(s => s.id === activeScene.id) + 1;
            const newId = await saveChapterToDB(
                script.id,
                activeScene.id,
                sceneTitle,
                editorContent,
                orderIndex
            );

            if (newId) {
                const updatedScene = { 
                    ...activeScene, 
                    id: newId, 
                    title: sceneTitle, 
                    content: editorContent
                };
                setScript(prev => ({
                    ...prev,
                    scenes: prev.scenes.map(s => s.id === activeScene.id ? updatedScene : s)
                }));
                setActiveScene(updatedScene);
                setSaveStatus('saved');
            } else {
                setSaveStatus('error');
            }
        }
    };


    return (
        <div className="flex flex-col h-full bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 overflow-hidden">
            <header className="flex-shrink-0 bg-white dark:bg-black flex border-b border-gray-200 dark:border-gray-800 z-20 shadow-sm">
                <div className="w-52 flex-shrink-0 flex items-center gap-2 p-4 border-r border-gray-200 dark:border-gray-800">
                    <Film className="w-8 h-8 text-sky-500" />
                    <span className="font-bold text-xl tracking-wider text-gray-900 dark:text-white truncate">
                        {script.type === 'original' ? '原创剧本' : '剧本改编'}
                    </span>
                </div>
                
                <div className="flex-1 flex items-center justify-center p-2 relative">
                    {isEditingTitle ? (
                        <input 
                            type="text"
                            value={tempTitle}
                            onChange={(e) => setTempTitle(e.target.value)}
                            onBlur={handleSaveTitle}
                            onKeyDown={(e) => e.key === 'Enter' && handleSaveTitle()}
                            autoFocus
                            className="text-center text-lg font-bold bg-gray-50 dark:bg-gray-800 border border-sky-500 rounded px-4 py-2 focus:outline-none min-w-[200px] text-gray-900 dark:text-white shadow-inner"
                        />
                    ) : (
                        <div 
                            className="flex items-center gap-2 group cursor-pointer px-6 py-2 bg-white dark:bg-gray-900 border-2 border-transparent hover:border-gray-300 dark:hover:border-gray-700 rounded-md transition-all" 
                            onClick={() => setIsEditingTitle(true)}
                        >
                            <h1 className="font-bold text-lg text-gray-900 dark:text-white min-w-[100px] text-center">
                                {script.title}
                            </h1>
                            <Pencil className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                    )}
                </div>
                
                <div className="w-[29%] flex-shrink-0 flex items-center justify-end p-4 border-l border-gray-200 dark:border-gray-800 gap-3">
                    <div className="flex items-center gap-2 mr-2">
                        {saveStatus === 'saving' && <span className="text-xs text-sky-500 font-medium animate-pulse">正在保存...</span>}
                        {saveStatus === 'saved' && <span className="text-xs text-green-500 font-medium flex items-center gap-1"><Check className="w-3 h-3" /> 已实时保存</span>}
                        {saveStatus === 'error' && <span className="text-xs text-red-500 font-medium">保存失败</span>}
                        {saveStatus === 'unsaved' && <span className="text-xs text-gray-400">未保存</span>}
                    </div>
                    <button
                        onClick={() => handleSaveToCloud(false)}
                        className="px-3 py-2 text-sm font-bold text-sky-600 bg-sky-100 hover:bg-sky-200 dark:bg-sky-900/30 dark:text-sky-400 dark:hover:bg-sky-900/50 rounded-lg transition-colors flex items-center gap-1"
                        title="手动同步到云端"
                    >
                        <ArrowPath className="w-4 h-4" />
                        同步
                    </button>
                    <button
                        onClick={onBack}
                        className="px-4 py-2 text-sm font-bold text-white bg-sky-500 hover:bg-sky-600 rounded-lg transition-colors flex items-center gap-1 shadow-sm"
                    >
                        <ChevronDoubleLeft className="w-4 h-4" />
                        返回
                    </button>
                </div>
            </header>

            <div className="flex-1 flex overflow-hidden relative">
                {/* Left Sidebar Toggle - Floating Style */}
                <button
                    onClick={() => setLeftSidebarOpen(!isLeftSidebarOpen)}
                    className="absolute top-1/2 z-30 transform -translate-y-1/2 p-1 bg-white/80 dark:bg-black/50 hover:bg-white dark:hover:bg-black text-gray-400 hover:text-sky-500 rounded-r-lg shadow-sm border border-l-0 border-gray-200 dark:border-gray-800 transition-all backdrop-blur-sm"
                    style={{ left: isLeftSidebarOpen ? '13rem' : '0' }}
                >
                    {isLeftSidebarOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>

                <aside className={`flex-shrink-0 flex flex-col bg-white dark:bg-black border-r border-gray-200 dark:border-gray-800 transition-all duration-300 overflow-hidden ${isLeftSidebarOpen ? 'w-52' : 'w-0 border-r-0'}`}>
                    <div className="min-w-[13rem] h-full flex flex-col">
                        <ScriptEpisodeManager 
                            episodes={script.scenes}
                            activeEpisodeId={activeScene?.id || null}
                            onSelectEpisode={setActiveScene}
                            onDeleteEpisode={handleDeleteScene}
                            onCreateEpisode={handleCreateScene}
                        />
                    </div>
                </aside>

                <main className="flex-1 bg-gray-100 dark:bg-gray-900/50 flex flex-col p-4 relative overflow-hidden transition-all duration-300">
                     <div className="flex-1 flex flex-col bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 w-full h-full overflow-hidden">
                        {activeScene ? (
                            <>
                                {/* Fixed Toolbar */}
                                <div className="pt-4 px-8 pb-2 flex-shrink-0 bg-white dark:bg-gray-900 z-10">
                                     <WritingToolbar onAction={handleToolbarAction} alignment={alignment} />
                                </div>
                                
                                {/* Scrollable Area */}
                                <div className="flex-1 overflow-y-auto px-8 pb-4">
                                    <input
                                        type="text"
                                        value={sceneTitle}
                                        onChange={handleTitleChange}
                                        placeholder="输入集数标题..."
                                        className="w-full py-4 text-2xl font-bold bg-transparent focus:outline-none border-none text-gray-900 dark:text-white placeholder-gray-300 dark:placeholder-gray-700 block"
                                    />
                                    <div className="pb-4 border-b border-gray-100 dark:border-gray-800 mb-6">
                                        <span className="text-xs text-gray-400 font-mono">
                                            <span className="text-sky-500 font-semibold">{wordCount}</span> 字
                                        </span>
                                    </div>
                                    <textarea
                                        ref={textareaRef}
                                        value={editorContent}
                                        onChange={handleContentChange}
                                        onSelect={handleSelect}
                                        onClick={handleSelect}
                                        onKeyUp={handleSelect}
                                        placeholder="开始编写剧本... (建议使用标准剧本格式)"
                                        style={{ minHeight: '60vh', height: 'auto' }}
                                        onInput={(e) => {
                                            e.currentTarget.style.height = 'auto';
                                            e.currentTarget.style.height = e.currentTarget.scrollHeight + 'px';
                                        }}
                                        className="w-full bg-transparent focus:outline-none resize-none text-lg leading-relaxed text-gray-800 dark:text-gray-200 placeholder-gray-300 dark:placeholder-gray-700 font-mono overflow-hidden"
                                    />
                                </div>
                            </>
                        ) : (
                            <div className="flex-1 flex items-center justify-center text-gray-400 flex-col">
                                <Film className="w-16 h-16 mb-4 opacity-20" />
                                <p>请新建或选择一集开始创作</p>
                            </div>
                        )}
                     </div>
                </main>

                {/* Right Sidebar Toggle - Floating Style */}
                <button
                    onClick={() => setRightSidebarOpen(!isRightSidebarOpen)}
                    className="absolute top-1/2 z-30 transform -translate-y-1/2 p-1 bg-white/80 dark:bg-black/50 hover:bg-white dark:hover:bg-black text-gray-400 hover:text-sky-500 rounded-l-lg shadow-sm border border-r-0 border-gray-200 dark:border-gray-800 transition-all backdrop-blur-sm"
                    style={{ right: isRightSidebarOpen ? '29%' : '0' }}
                >
                    {isRightSidebarOpen ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                </button>

                <aside className={`flex-shrink-0 bg-white dark:bg-black border-l border-gray-200 dark:border-gray-800 shadow-xl z-10 flex flex-col transition-all duration-300 overflow-hidden ${isRightSidebarOpen ? 'w-[29%]' : 'w-0 border-l-0'}`}>
                    <div className="flex-1 overflow-hidden min-w-[300px]">
                        {script.type === 'adaptation' ? (
                            <ScriptAdaptationPanel onInsert={handleInsertText} onStream={handleAIStream} />
                        ) : (
                            <ScriptAIPanel onInsert={handleInsertText} onStream={handleAIStream} />
                        )}
                    </div>
                </aside>
            </div>
        </div>
    );
};

export default ScriptWritingPage;
