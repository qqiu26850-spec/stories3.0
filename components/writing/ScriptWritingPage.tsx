
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Script, Scene } from '../../types';
import { Film, ChevronDoubleLeft, Pencil, ArrowPath, Check, ChevronLeft, ChevronRight } from '../Icon';
import ScriptEpisodeManager from './ScriptEpisodeManager';
import ScriptAIPanel from './ScriptAIPanel';
import ScriptAdaptationPanel from './ScriptAdaptationPanel';
import WritingToolbar, { ToolbarAction } from './WritingToolbar';
import { saveChapterToDB, updateProject, fetchChapters, deleteChapterFromDB, updateChapterOrder } from '../../services/supabaseService';

interface ScriptWritingPageProps {
    script: Script;
    onBack: () => void;
}

type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error';

const ScriptWritingPage: React.FC<ScriptWritingPageProps> = ({ script: initialScript, onBack }) => {
    const [script, setScript] = useState<Script>(initialScript);
    const [activeScene, setActiveScene] = useState<Scene | null>(null);
    const [editorHTML, setEditorHTML] = useState('');
    const [sceneTitle, setSceneTitle] = useState('');
    const [wordCount, setWordCount] = useState(0);
    const [showCopyToast, setShowCopyToast] = useState(false);

    const editorRef = useRef<HTMLDivElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [alignment, setAlignment] = useState<'left' | 'center' | 'right'>('left');
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [tempTitle, setTempTitle] = useState(script.title);
    const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
    
    const [isLeftSidebarOpen, setLeftSidebarOpen] = useState(true);
    const [isRightSidebarOpen, setRightSidebarOpen] = useState(true);

    useEffect(() => {
        const loadInitialScenes = async () => {
             const data = await fetchChapters(script.id);
             if (data) {
                const mapped = data.map((c: any) => ({
                    id: c.id,
                    title: c.title,
                    content: c.content
                }));
                setScript(prev => ({ ...prev, scenes: mapped }));
             }
        };
        loadInitialScenes();
    }, [script.id]);

    useEffect(() => {
        if (activeScene) {
            setSceneTitle(activeScene.title);
            const content = activeScene.content || '';
            const html = content.split('\n').map(p => `<p>${p}</p>`).join('');
            setEditorHTML(html);
            if (editorRef.current) {
                editorRef.current.innerHTML = html;
            }
            const count = content.replace(/\s/g, '').length;
            setWordCount(count);
            setSaveStatus('saved');
        }
    }, [activeScene]);

    const handleSaveToCloud = async () => {
        if (activeScene && editorRef.current) {
            const content = editorRef.current.innerText;
            const orderIndex = script.scenes.findIndex(s => s.id === activeScene.id) + 1;
            const newId = await saveChapterToDB(script.id, activeScene.id, sceneTitle, content, orderIndex);

            if (newId) {
                const updatedScene = { ...activeScene, id: newId, title: sceneTitle, content: content };
                setScript(prev => ({
                    ...prev,
                    scenes: prev.scenes.map(s => s.id === activeScene.id ? updatedScene : s)
                }));
                setSaveStatus('saved');
            } else {
                setSaveStatus('error');
            }
        }
    };

    const handleReorderScenes = async (newScenes: Scene[]) => {
        setScript(prev => ({ ...prev, scenes: newScenes }));
        setSaveStatus('saving');
        try {
            const updates = newScenes.map((s, i) => ({ id: s.id, order_index: i + 1 }));
            await updateChapterOrder(updates);
            setSaveStatus('saved');
        } catch (e) {
            setSaveStatus('error');
        }
    };

    useEffect(() => {
        if (!activeScene) return;
        const timer = setTimeout(async () => {
            setSaveStatus('saving');
            await handleSaveToCloud();
        }, 2000);
        return () => clearTimeout(timer);
    }, [sceneTitle, editorHTML]);

    const handleContentInput = () => {
        if (editorRef.current) {
            setEditorHTML(editorRef.current.innerHTML);
            const count = editorRef.current.innerText.replace(/\s/g, '').length;
            setWordCount(count);
        }
    };

    const handleToolbarAction = (action: ToolbarAction) => {
        if (!editorRef.current) return;

        if (action === 'copy') {
            navigator.clipboard.writeText(editorRef.current.innerText);
            setShowCopyToast(true);
            setTimeout(() => setShowCopyToast(false), 2000);
            return;
        }

        if (action === 'bold') {
            document.execCommand('bold', false);
        }

        if (action === 'indent-add') {
            document.execCommand('formatBlock', false, 'p');
            const selection = window.getSelection();
            if (selection && selection.rangeCount > 0) {
                const paragraphs = editorRef.current.querySelectorAll('p');
                paragraphs.forEach(p => {
                    if (selection.containsNode(p, true)) {
                        p.style.textIndent = p.style.textIndent === '2em' ? '0' : '2em';
                    }
                });
            }
        }
        
        if (action.startsWith('align-')) {
            const align = action.replace('align-', '');
            document.execCommand(`justify${align.charAt(0).toUpperCase() + align.slice(1)}`, false);
            setAlignment(align as any);
        }

        handleContentInput();
    };

    const handleAIStream = (chunk: string, isFirst: boolean) => {
        if (!editorRef.current) return;
        if (isFirst) editorRef.current.focus();
        document.execCommand('insertText', false, chunk);
        handleContentInput();
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
        }
    };

    const handleInsertText = (text: string) => {
        if (!editorRef.current) return;
        editorRef.current.focus();
        document.execCommand('insertText', false, text);
        handleContentInput();
    };

    return (
        <div className="flex flex-col h-full bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 overflow-hidden relative">
            {showCopyToast && (
                <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[100] bg-gray-800/90 text-white px-6 py-2 rounded-full shadow-2xl backdrop-blur-sm animate-fade-in-up flex items-center gap-2 border border-gray-700">
                    <Check className="w-4 h-4 text-green-400" />
                    <span className="text-sm font-bold">剧本复制成功</span>
                </div>
            )}

            <header className="flex-shrink-0 bg-white dark:bg-black flex border-b border-gray-200 dark:border-gray-800 z-20 shadow-sm">
                <div className="w-52 flex-shrink-0 flex items-center gap-2 p-4 border-r border-gray-200 dark:border-gray-800">
                    <Film className="w-8 h-8 text-sky-500" />
                    <span className="font-bold text-xl tracking-wider text-gray-900 dark:text-white truncate">{script.type === 'original' ? '原创剧本' : '剧本改编'}</span>
                </div>
                
                <div className="flex-1 flex items-center justify-center p-2">
                    {isEditingTitle ? (
                        <input value={tempTitle} onChange={(e) => setTempTitle(e.target.value)} onBlur={() => { setScript(p=>({...p, title: tempTitle})); updateProject(script.id, {title: tempTitle}); setIsEditingTitle(false); }} autoFocus className="text-center text-lg font-bold bg-gray-50 dark:bg-gray-800 border border-sky-500 rounded px-4 py-2 focus:outline-none min-w-[200px]" />
                    ) : (
                        <div className="flex items-center gap-2 group cursor-pointer px-6 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-md transition-all" onClick={() => setIsEditingTitle(true)}>
                            <h1 className="font-bold text-lg text-gray-900 dark:text-white">{script.title}</h1>
                            <Pencil className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100" />
                        </div>
                    )}
                </div>
                
                <div className="w-[29%] flex-shrink-0 flex items-center justify-end p-4 border-l border-gray-200 dark:border-gray-800 gap-3">
                    <div className="flex items-center gap-2 mr-2">
                        {saveStatus === 'saving' && <span className="text-xs text-sky-500 font-medium animate-pulse">正在保存...</span>}
                        {saveStatus === 'saved' && <span className="text-xs text-green-500 font-medium flex items-center gap-1"><Check className="w-3 h-3" /> 已实时保存</span>}
                    </div>
                    <button onClick={handleSaveToCloud} className="px-3 py-2 text-sm font-bold text-sky-600 bg-sky-100 hover:bg-sky-200 rounded-lg flex items-center gap-1"><ArrowPath className="w-4 h-4" /> 同步</button>
                    <button onClick={onBack} className="px-4 py-2 text-sm font-bold text-white bg-sky-500 hover:bg-sky-600 rounded-lg shadow-sm">返回</button>
                </div>
            </header>

            <div className="flex-1 flex overflow-hidden relative">
                <aside className={`flex-shrink-0 flex flex-col bg-white dark:bg-black border-r border-gray-200 dark:border-gray-800 transition-all duration-300 overflow-hidden ${isLeftSidebarOpen ? 'w-52' : 'w-0'}`}>
                    <ScriptEpisodeManager episodes={script.scenes} activeEpisodeId={activeScene?.id || null} onSelectEpisode={setActiveScene} onDeleteEpisode={deleteChapterFromDB} onCreateEpisode={() => {}} onReorderEpisodes={handleReorderScenes} />
                </aside>

                <main className="flex-1 bg-gray-100 dark:bg-gray-900/50 flex flex-col p-4 relative overflow-hidden">
                     <div className="flex-1 flex flex-col bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 w-full h-full overflow-hidden relative">
                        {activeScene ? (
                            <>
                                <div className="pt-4 px-8 pb-2 flex-shrink-0 bg-white dark:bg-gray-900 z-10">
                                     <WritingToolbar onAction={handleToolbarAction} alignment={alignment} />
                                </div>
                                <div className="flex-1 overflow-y-auto px-8 pb-12" ref={scrollContainerRef}>
                                    <input value={sceneTitle} onChange={(e) => setSceneTitle(e.target.value)} placeholder="输入集数标题..." className="w-full py-2 text-2xl font-bold bg-transparent focus:outline-none text-gray-900 dark:text-white mb-4" />
                                    <div 
                                        ref={editorRef}
                                        contentEditable 
                                        onInput={handleContentInput}
                                        className="w-full bg-transparent focus:outline-none text-lg leading-relaxed text-gray-800 dark:text-gray-200 font-mono min-h-[60vh] outline-none"
                                        style={{ textAlign: alignment }}
                                    ></div>
                                </div>
                                <div className="absolute bottom-2 right-6 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm px-2 py-1 rounded text-xs text-gray-400 font-mono border border-gray-100 dark:border-gray-800">
                                    <span className="text-sky-500 font-semibold">{wordCount}</span> 字
                                </div>
                            </>
                        ) : (
                            <div className="flex-1 flex items-center justify-center text-gray-400 flex-col"><Film className="w-16 h-16 mb-4 opacity-20" /><p>请新建或选择一集开始创作</p></div>
                        )}
                     </div>
                </main>

                <aside className={`flex-shrink-0 bg-white dark:bg-black border-l border-gray-200 dark:border-gray-800 shadow-xl z-10 flex flex-col transition-all duration-300 overflow-hidden ${isRightSidebarOpen ? 'w-[29%]' : 'w-0'}`}>
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
