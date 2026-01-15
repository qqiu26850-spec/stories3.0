
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Script, Scene } from '../../types';
import { Film, ChevronDoubleLeft, Pencil, ArrowPath, Check, ChevronLeft, ChevronRight, PanelLeft, PanelRight, X } from '../Icon';
import ScriptEpisodeManager from './ScriptEpisodeManager';
import ScriptAIPanel from './ScriptAIPanel';
import ScriptAdaptationPanel from './ScriptAdaptationPanel';
import WritingToolbar, { ToolbarAction } from './WritingToolbar';
import { saveChapterToDB, updateProject, fetchChapters, deleteChapterFromDB, updateChapterOrder } from '../../services/supabaseService';
import { createPortal } from 'react-dom';
import FollowUpModal from '../FollowUpModal';

interface ScriptWritingPageProps {
    script: Script;
    onBack: () => void;
}

type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error';

// Custom Context Menu for Script Page
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

const ScriptWritingPage: React.FC<ScriptWritingPageProps> = ({ script: initialScript, onBack }) => {
    const [script, setScript] = useState<Script>(initialScript);
    const [activeScene, setActiveScene] = useState<Scene | null>(null);
    const [sceneTitle, setSceneTitle] = useState('');
    // Remove synchronous editorHTML state to prevent lag
    const [wordCount, setWordCount] = useState(0);
    const [showCopyToast, setShowCopyToast] = useState(false);

    const editorRef = useRef<HTMLDivElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const updateTimeoutRef = useRef<any>(null); // Debounce ref

    const [alignment, setAlignment] = useState<'left' | 'center' | 'right' | 'justify'>('left');
    const [fontSize, setFontSize] = useState(18); // Default font size 18
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [tempTitle, setTempTitle] = useState(script.title);
    const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
    
    const [isLeftSidebarOpen, setLeftSidebarOpen] = useState(true);
    const [isRightSidebarOpen, setRightSidebarOpen] = useState(true);

    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; visible: boolean; text: string }>({ x: 0, y: 0, visible: false, text: '' });
    const [activeFollowUp, setActiveFollowUp] = useState<{ target: string; context: string; initialMode: 'selection' | 'full' } | null>(null);

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
                if (mapped.length > 0 && !activeScene) {
                    setActiveScene(mapped[0]);
                }
             }
        };
        loadInitialScenes();
    }, [script.id]);

    // Optimize Scene Switching - Direct DOM update
    useEffect(() => {
        if (activeScene) {
            setSceneTitle(activeScene.title);
            const content = activeScene.content || '';
            
            if (editorRef.current) {
                const html = content.includes('<p>') ? content : content.split('\n').map(p => `<p>${p || '<br>'}</p>`).join('');
                editorRef.current.innerHTML = html;
            }
            
            const count = content.replace(/<[^>]*>/g, '').replace(/\s/g, '').length;
            setWordCount(count);
            setSaveStatus('saved');
        }
    }, [activeScene?.id]);

    const handleSaveToCloud = async (currentContent: string) => {
        if (activeScene) {
            const orderIndex = script.scenes.findIndex(s => s.id === activeScene.id) + 1;
            const newId = await saveChapterToDB(script.id, activeScene.id, sceneTitle, currentContent, orderIndex);

            if (newId) {
                // Update local state without re-rendering editor
                const updatedScene = { ...activeScene, id: newId, title: sceneTitle, content: currentContent };
                setScript(prev => ({
                    ...prev,
                    scenes: prev.scenes.map(s => s.id === activeScene.id ? updatedScene : s)
                }));
                
                // Silent update of ID if new
                if (activeScene.id !== newId) {
                    setActiveScene(prev => prev ? { ...prev, id: newId } : null);
                }
                
                setSaveStatus('saved');
            } else {
                setSaveStatus('error');
            }
        }
    };

    const handleCreateEpisode = async () => {
        const newOrder = script.scenes.length + 1;
        const tempId = `new-${Date.now()}`;
        const newTitle = `第${newOrder}集：`;
        const newId = await saveChapterToDB(script.id, tempId, newTitle, '', newOrder);

        if (newId) {
            const newScene: Scene = {
                id: newId,
                title: newTitle,
                content: ''
            };
            setScript(prev => ({
                ...prev,
                scenes: [...prev.scenes, newScene]
            }));
            setActiveScene(newScene);
            setSaveStatus('saved');
        }
    };

    const handleDeleteEpisode = async (id: string) => {
        try {
            await deleteChapterFromDB(id);
            setScript(prev => ({
                ...prev,
                scenes: prev.scenes.filter(s => s.id !== id)
            }));
            if (activeScene?.id === id) {
                setActiveScene(null);
                setSceneTitle('');
                if (editorRef.current) editorRef.current.innerHTML = '';
            }
            setSaveStatus('saved');
        } catch (e) {
            console.error("删除集数失败", e);
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

    // Performance Optimized Input Handler with Debounce
    const handleContentInput = useCallback(() => {
        if (!editorRef.current) return;
        
        // Prevent redundant state updates
        setSaveStatus(prev => prev === 'saving' ? prev : 'saving');

        if (updateTimeoutRef.current) {
            clearTimeout(updateTimeoutRef.current);
        }

        updateTimeoutRef.current = setTimeout(() => {
            if (editorRef.current) {
                const text = editorRef.current.innerText || '';
                const html = editorRef.current.innerHTML;
                
                // Update Word Count
                const count = text.replace(/\s/g, '').length;
                setWordCount(count);
                
                // Trigger Save
                handleSaveToCloud(html);
            }
        }, 1000);
    }, [activeScene, sceneTitle]);

    // Force Plain Text Paste
    const handlePaste = (e: React.ClipboardEvent) => {
        e.preventDefault();
        const text = e.clipboardData.getData('text/plain');
        document.execCommand('insertText', false, text);
    };

    const handleToolbarAction = (action: ToolbarAction) => {
        if (!editorRef.current) return;
        editorRef.current.focus();

        if (action === 'undo') {
            document.execCommand('undo', false);
        } else if (action === 'redo') {
            document.execCommand('redo', false);
        } else if (action === 'copy') {
            navigator.clipboard.writeText(editorRef.current.innerText);
            setShowCopyToast(true);
            setTimeout(() => setShowCopyToast(false), 2000);
            return;
        } else if (action === 'bold') {
            document.execCommand('bold', false);
        } else if (action === 'italic') {
            document.execCommand('italic', false);
        } else if (action === 'indent-add') {
            document.execCommand('formatBlock', false, 'p');
            document.execCommand('indent', false);
        } else if (action === 'indent-decrease') {
            document.execCommand('outdent', false);
        } else if (action.startsWith('align-')) {
            const align = action.replace('align-', '');
            const command = align === 'justify' ? 'justifyFull' : `justify${align.charAt(0).toUpperCase() + align.slice(1)}`;
            document.execCommand(command, false);
            setAlignment(align as any);
        } else if (action === 'font-increase') {
            setFontSize(prev => Math.min(prev + 2, 32));
        } else if (action === 'font-decrease') {
            setFontSize(prev => Math.max(prev - 2, 12));
        }

        handleContentInput();
    };

    const handleAIStream = (chunk: string, isFirst: boolean) => {
        if (!editorRef.current) return;
        if (isFirst) editorRef.current.focus();
        document.execCommand('insertText', false, chunk);
        
        if (scrollContainerRef.current) {
            const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
            if (scrollHeight - scrollTop - clientHeight < 100) {
                scrollContainerRef.current.scrollTop = scrollHeight;
            }
        }
        
        handleContentInput();
    };

    const handleInsertText = (text: string) => {
        if (!editorRef.current) return;
        editorRef.current.focus();
        document.execCommand('insertText', false, text);
        handleContentInput();
    };

    const handleReplaceText = (text: string) => {
        if (!editorRef.current) return;
        editorRef.current.focus();
        document.execCommand('insertText', false, text);
        handleContentInput();
    };

    const handleContextMenu = (e: React.MouseEvent) => {
        const selection = window.getSelection();
        const text = selection?.toString().trim();

        if (text && text.length > 0) {
            e.preventDefault();
            setContextMenu({
                x: e.clientX,
                y: e.clientY,
                visible: true,
                text: text
            });
        }
    };

    const handleApplyFollowUp = (text: string, type: 'insert' | 'replace') => {
        if (type === 'replace') handleReplaceText(text);
        else handleInsertText(text);
        setActiveFollowUp(null);
    };

    useEffect(() => {
        const closeMenu = () => setContextMenu(prev => ({ ...prev, visible: false }));
        document.addEventListener('click', closeMenu);
        return () => document.removeEventListener('click', closeMenu);
    }, []);

    // Save title when changed
    useEffect(() => {
        if (!activeScene) return;
        const timer = setTimeout(() => {
             handleSaveToCloud(editorRef.current?.innerHTML || '');
        }, 1000);
        return () => clearTimeout(timer);
    }, [sceneTitle]);

    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 overflow-hidden relative">
            {showCopyToast && (
                <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[100] bg-gray-800/90 text-white px-6 py-2 rounded-full shadow-2xl backdrop-blur-sm animate-fade-in-up flex items-center gap-2 border border-gray-700">
                    <Check className="w-4 h-4 text-green-400" />
                    <span className="text-sm font-bold">剧本复制成功</span>
                </div>
            )}

            <FollowUpModal 
                isOpen={!!activeFollowUp} 
                onClose={() => setActiveFollowUp(null)} 
                targetText={activeFollowUp?.target || ''}
                context={editorRef.current?.innerText || ''}
                initialMode={'selection'}
                onApply={handleApplyFollowUp}
            />

            <ScriptContextMenu 
                {...contextMenu} 
                onClose={() => setContextMenu(prev => ({ ...prev, visible: false }))} 
                onAction={() => setActiveFollowUp({
                    target: contextMenu.text,
                    context: editorRef.current?.innerText || '',
                    initialMode: 'selection'
                })}
            />

            <header className="flex-shrink-0 bg-white dark:bg-black flex border-b border-gray-200 dark:border-gray-800 z-20 shadow-sm h-16">
                <div className="w-64 flex-shrink-0 flex items-center gap-2 px-4 border-r border-gray-200 dark:border-gray-800">
                    <Film className="w-8 h-8 text-sky-500" />
                    <span className="font-bold text-xl tracking-wider text-gray-900 dark:text-white truncate">{script.type === 'original' ? '原创剧本' : '剧本改编'}</span>
                </div>
                
                <div className="flex-1 flex items-center justify-center p-2">
                    {isEditingTitle ? (
                        <input 
                            value={tempTitle} 
                            onChange={(e) => setTempTitle(e.target.value)} 
                            onBlur={() => { setScript(p=>({...p, title: tempTitle})); updateProject(script.id, {title: tempTitle}); setIsEditingTitle(false); }} 
                            autoFocus 
                            maxLength={15}
                            className="text-center text-lg font-bold bg-sky-50 dark:bg-gray-800 border border-sky-300 rounded px-4 py-1.5 focus:outline-none min-w-[200px]" 
                        />
                    ) : (
                        <div className="flex items-center gap-2 group cursor-pointer px-6 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-md transition-all" onClick={() => setIsEditingTitle(true)}>
                            <h1 className="text-lg font-bold text-gray-700 dark:text-gray-200 tracking-wide">{script.title}</h1>
                            <Pencil className="w-3.5 h-3.5 text-gray-400 opacity-0 group-hover:opacity-100" />
                        </div>
                    )}
                </div>
                
                <div className="w-[29%] flex-shrink-0 flex items-center justify-end px-4 border-l border-gray-200 dark:border-gray-800 gap-3">
                    <div className="flex items-center gap-2 mr-2">
                         {saveStatus === 'saving' && (
                            <div className="flex items-center gap-1.5 text-sky-500 animate-pulse whitespace-nowrap">
                                <ArrowPath className="w-4.5 h-4.5 animate-spin" />
                                <span className="text-sm font-bold">正在保存...</span>
                            </div>
                        )}
                        {saveStatus === 'saved' && (
                            <div className="flex flex-row items-center gap-1.5 text-green-500 whitespace-nowrap">
                                <Check className="w-5 h-5" />
                                <span className="text-sm font-bold">已实时保存</span>
                            </div>
                        )}
                        {saveStatus === 'error' && (
                            <div className="flex flex-row items-center gap-1.5 text-red-500 whitespace-nowrap">
                                <X className="w-5 h-5" />
                                <span className="text-sm font-bold">保存失败</span>
                            </div>
                        )}
                    </div>

                    <button 
                        onClick={() => handleSaveToCloud(editorRef.current?.innerHTML || '')} 
                        className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sky-600 dark:text-sky-400 font-bold rounded-lg hover:bg-sky-50 dark:hover:bg-sky-900/20 transition-all shadow-sm"
                        title="同步数据"
                    >
                        <ArrowPath className="w-4 h-4" />
                        <span>同步</span>
                    </button>

                    <button onClick={onBack} className="px-5 py-2 text-sm font-bold text-white bg-sky-500 hover:bg-sky-600 rounded-lg shadow-sm">返回</button>
                </div>
            </header>

            <div className="flex-1 flex overflow-hidden relative">
                <button 
                    onClick={() => setLeftSidebarOpen(!isLeftSidebarOpen)}
                    className={`absolute z-30 top-1/2 -translate-y-1/2 w-4 h-12 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-r-md flex items-center justify-center text-gray-400 hover:text-sky-500 transition-all shadow-sm ${isLeftSidebarOpen ? 'left-64' : 'left-0'}`}
                    style={{ marginLeft: isLeftSidebarOpen ? '-1px' : '0' }}
                >
                    {isLeftSidebarOpen ? <ChevronLeft className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                </button>

                <aside className={`flex-shrink-0 flex flex-col bg-white dark:bg-black border-r border-gray-200 dark:border-gray-800 transition-all duration-300 overflow-hidden ${isLeftSidebarOpen ? 'w-64' : 'w-0'}`}>
                    <ScriptEpisodeManager episodes={script.scenes} activeEpisodeId={activeScene?.id || null} onSelectEpisode={setActiveScene} onDeleteEpisode={handleDeleteEpisode} onCreateEpisode={handleCreateEpisode} onReorderEpisodes={handleReorderScenes} />
                </aside>

                <main className="flex-1 bg-gray-50 dark:bg-gray-950 flex flex-col relative overflow-hidden px-1.5 py-0">
                     <div className="flex-1 flex flex-col bg-white dark:bg-gray-900 shadow-sm border-x border-gray-100 dark:border-gray-800 w-full h-full overflow-hidden relative">
                        {activeScene ? (
                            <>
                                <div className="pt-1.5 px-8 pb-1 flex-shrink-0 bg-white dark:bg-gray-900 z-10 flex flex-col gap-1">
                                     <WritingToolbar onAction={handleToolbarAction} alignment={alignment} />
                                </div>

                                <div className="flex-1 overflow-y-auto dynamic-scrollbar px-12 pb-12 pt-1" ref={scrollContainerRef}>
                                    <input 
                                        value={sceneTitle} 
                                        onChange={(e) => setSceneTitle(e.target.value)} 
                                        placeholder="输入集数标题..." 
                                        maxLength={15}
                                        className="w-full py-1 text-2xl font-bold bg-transparent focus:outline-none text-gray-900 dark:text-white mb-1.5" 
                                    />
                                    <div className="border-b border-gray-100 dark:border-gray-800 mb-6" />
                                    
                                    <div 
                                        ref={editorRef}
                                        contentEditable 
                                        onInput={handleContentInput}
                                        onPaste={handlePaste}
                                        onContextMenu={handleContextMenu}
                                        suppressContentEditableWarning={true}
                                        spellCheck={false}
                                        autoCorrect="off"
                                        autoCapitalize="off"
                                        className="w-full bg-transparent focus:outline-none leading-relaxed text-gray-800 dark:text-gray-200 font-mono min-h-[75vh] outline-none pb-32"
                                        style={{ textAlign: alignment, fontSize: `${fontSize}px` }}
                                    ></div>
                                </div>

                                <div className="absolute bottom-6 right-8 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm px-4 py-1.5 rounded-full text-xs text-gray-400 font-mono border border-gray-100 dark:border-gray-800 shadow-sm z-20">
                                    <span className="text-sky-500 font-black">{wordCount}</span> 字
                                </div>
                            </>
                        ) : (
                            <div className="flex-1 flex items-center justify-center text-gray-400 flex-col"><Film className="w-16 h-16 mb-4 opacity-20" /><p>请新建或选择一集开始创作</p></div>
                        )}
                     </div>
                </main>

                <button 
                    onClick={() => setRightSidebarOpen(!isRightSidebarOpen)}
                    className={`absolute z-30 top-1/2 -translate-y-1/2 w-4 h-12 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-r-md flex items-center justify-center text-gray-400 hover:text-sky-500 transition-all shadow-sm ${isRightSidebarOpen ? 'right-[29%]' : 'right-0'}`}
                    style={{ marginRight: isRightSidebarOpen ? '-1px' : '0' }}
                >
                    {isRightSidebarOpen ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
                </button>

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
