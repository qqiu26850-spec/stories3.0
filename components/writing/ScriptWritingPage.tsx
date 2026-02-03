
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Script, Scene } from '../../types';
import { ChevronLeft, ChevronRight, Sparkles, Check, ArrowPath, ChatBubbleOvalLeftEllipsis } from '../Icon';
import WritingToolbar, { ToolbarAction } from './WritingToolbar';
import { saveChapterToDB, fetchChapters, fetchChapterContent, deleteChapterFromDB, updateChapterOrder } from '../../services/supabaseService';
import { createPortal } from 'react-dom';
import FollowUpModal from '../FollowUpModal';
import ScriptAIPanel from './ScriptAIPanel';
import ScriptEpisodeManager from './ScriptEpisodeManager';

interface ScriptWritingPageProps {
    script: Script;
    onBack: () => void;
}

const ContextMenu: React.FC<{
    x: number;
    y: number;
    visible: boolean;
    onClose: () => void;
    onAction: (action: 'ask' | 'polish' | 'expand') => void;
}> = ({ x, y, visible, onClose, onAction }) => {
    if (!visible) return null;

    const options = [
        { id: 'ask', label: '智能追问', icon: '💬' },
        { id: 'polish', label: '润色优化', icon: '✨' },
        { id: 'expand', label: '内容扩写', icon: '📝' }
    ];

    return createPortal(
        <div 
            className="fixed z-50 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-100 dark:border-gray-700 py-1 min-w-[120px] animate-fade-in"
            style={{ top: y, left: x }}
            onMouseLeave={onClose}
        >
            {options.map((opt) => (
                <button
                    key={opt.id}
                    onClick={() => { onAction(opt.id as any); onClose(); }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-sky-50 dark:hover:bg-sky-900/30 hover:text-sky-600 transition-colors flex items-center gap-2"
                >
                    <span>{opt.icon}</span> {opt.label}
                </button>
            ))}
        </div>,
        document.body
    );
};

const ScriptWritingPage: React.FC<ScriptWritingPageProps> = ({ script: initialScript, onBack }) => {
    const [script, setScript] = useState<Script>(initialScript);
    const [activeScene, setActiveScene] = useState<Scene | null>(null);
    const [sceneTitle, setSceneTitle] = useState('');
    const [wordCount, setWordCount] = useState(0);
    const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved' | 'error'>('saved');
    
    const [isLeftSidebarOpen, setLeftSidebarOpen] = useState(true);
    const [isRightSidebarOpen, setRightSidebarOpen] = useState(false);
    
    const editorRef = useRef<HTMLDivElement>(null);
    const updateTimeoutRef = useRef<any>(null);
    
    // AI Interaction
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; visible: boolean; text: string }>({ x: 0, y: 0, visible: false, text: '' });
    const [activeFollowUp, setActiveFollowUp] = useState<{ target: string; context: string; initialMode: 'selection' | 'full' } | null>(null);
    const [aiTrigger, setAiTrigger] = useState<{ type: 'polish' | 'expand' | 'ask'; text: string } | null>(null);

    // Initial Load
    useEffect(() => {
        const loadScenes = async () => {
            const data = await fetchChapters(script.id);
            if (data) {
                const mappedScenes: Scene[] = data.map((c: any) => ({
                    id: c.id,
                    title: c.title,
                    content: '',
                    isContentLoaded: false
                }));
                setScript(prev => ({ ...prev, scenes: mappedScenes }));
                if (mappedScenes.length > 0 && !activeScene) {
                    setActiveScene(mappedScenes[0]);
                }
            }
        };
        loadScenes();
    }, [script.id]);

    // Load Content
    useEffect(() => {
        const loadContent = async () => {
            if (activeScene && !activeScene.isContentLoaded) {
                const content = await fetchChapterContent(activeScene.id);
                setScript(prev => ({
                    ...prev,
                    scenes: prev.scenes.map(s => s.id === activeScene.id ? { ...s, content, isContentLoaded: true } : s)
                }));
                setActiveScene(prev => prev ? { ...prev, content, isContentLoaded: true } : null);
            }
        };
        loadContent();
    }, [activeScene?.id]);

    // Update Editor
    useEffect(() => {
        if (activeScene && activeScene.isContentLoaded) {
            setSceneTitle(activeScene.title);
            if (editorRef.current) {
                const html = activeScene.content.includes('<p>') ? activeScene.content : activeScene.content.split('\n').map(p => `<p>${p || '<br>'}</p>`).join('');
                if (editorRef.current.innerHTML !== html) {
                    editorRef.current.innerHTML = html;
                }
            }
            const count = (activeScene.content || '').replace(/<[^>]*>/g, '').replace(/\s/g, '').length;
            setWordCount(count);
        }
    }, [activeScene?.id, activeScene?.isContentLoaded]);

    const handleContentInput = useCallback(() => {
        if (!editorRef.current) return;
        setSaveStatus('saving');
        
        if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current);
        
        updateTimeoutRef.current = setTimeout(async () => {
            if (editorRef.current && activeScene) {
                const content = editorRef.current.innerHTML;
                const text = editorRef.current.innerText;
                setWordCount(text.replace(/\s/g, '').length);
                
                // Save
                const newId = await saveChapterToDB(script.id, activeScene.id, sceneTitle, content, script.scenes.findIndex(s => s.id === activeScene.id) + 1);
                
                if (newId) {
                    setSaveStatus('saved');
                    if (newId !== activeScene.id) {
                        const updatedScene = { ...activeScene, id: newId, title: sceneTitle, content, isContentLoaded: true };
                        setScript(prev => ({
                            ...prev,
                            scenes: prev.scenes.map(s => s.id === activeScene.id ? updatedScene : s)
                        }));
                        setActiveScene(updatedScene);
                    }
                } else {
                    setSaveStatus('error');
                }
            }
        }, 1000);
    }, [activeScene, sceneTitle, script.scenes, script.id]);

    const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSceneTitle(e.target.value);
        // Trigger save for title change
        if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current);
        updateTimeoutRef.current = setTimeout(async () => {
             if (activeScene) {
                 const content = editorRef.current?.innerHTML || '';
                 const newId = await saveChapterToDB(script.id, activeScene.id, e.target.value, content, script.scenes.findIndex(s => s.id === activeScene.id) + 1);
                 if (newId) setSaveStatus('saved');
             }
        }, 1000);
    };

    const handleToolbarAction = (action: ToolbarAction) => {
        if (!editorRef.current) return;
        editorRef.current.focus();
        if (action === 'bold') document.execCommand('bold');
        else if (action === 'italic') document.execCommand('italic');
        else if (action === 'copy') {
            navigator.clipboard.writeText(editorRef.current.innerText);
        }
        // Add other toolbar actions here
        handleContentInput();
    };

    const handleCreateScene = async () => {
        const newOrder = script.scenes.length + 1;
        const newTitle = `第${newOrder}集`;
        const newId = await saveChapterToDB(script.id, `new-${Date.now()}`, newTitle, '', newOrder);
        if (newId) {
            const newScene: Scene = { id: newId, title: newTitle, content: '', isContentLoaded: true };
            setScript(prev => ({ ...prev, scenes: [...prev.scenes, newScene] }));
            setActiveScene(newScene);
        }
    };

    const handleDeleteScene = async (id: string) => {
        await deleteChapterFromDB(id);
        setScript(prev => ({ ...prev, scenes: prev.scenes.filter(s => s.id !== id) }));
        if (activeScene?.id === id) {
            setActiveScene(null);
            if (editorRef.current) editorRef.current.innerHTML = '';
        }
    };

    const handleReorderScenes = async (newScenes: Scene[]) => {
        setScript(prev => ({ ...prev, scenes: newScenes }));
        const updates = newScenes.map((s, i) => ({ id: s.id, order_index: i + 1 }));
        await updateChapterOrder(updates);
    };

    // Context Menu & AI
    const handleContextMenu = (e: React.MouseEvent) => {
        const selection = window.getSelection();
        const text = selection?.toString().trim();
        if (text) {
            e.preventDefault();
            setContextMenu({ x: e.clientX, y: e.clientY, visible: true, text });
        }
    };

    useEffect(() => {
        const closeMenu = () => setContextMenu(prev => ({ ...prev, visible: false }));
        document.addEventListener('click', closeMenu);
        return () => document.removeEventListener('click', closeMenu);
    }, []);

    const handleAIAction = (action: 'ask' | 'polish' | 'expand') => {
        setRightSidebarOpen(true);
        if (action === 'ask') {
            setActiveFollowUp({
                target: contextMenu.text,
                context: editorRef.current?.innerText || '',
                initialMode: 'selection'
            });
        } else {
            setAiTrigger({ type: action, text: contextMenu.text });
        }
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

    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-black text-gray-900 dark:text-gray-100 overflow-hidden relative">
            
            <FollowUpModal 
                isOpen={!!activeFollowUp} 
                onClose={() => setActiveFollowUp(null)} 
                targetText={activeFollowUp?.target || ''}
                context={editorRef.current?.innerText || ''}
                initialMode={activeFollowUp?.initialMode || 'full'}
                onApply={(text, type) => {
                    if (type === 'replace') handleReplaceText(text);
                    else handleInsertText(text);
                    setActiveFollowUp(null);
                }}
            />

            <ContextMenu 
                {...contextMenu} 
                visible={contextMenu.visible}
                onClose={() => setContextMenu(prev => ({ ...prev, visible: false }))} 
                onAction={handleAIAction}
            />

            <header className="flex-shrink-0 bg-white dark:bg-black flex border-b border-gray-200 dark:border-gray-800 z-20 shadow-sm h-16 items-center px-4 justify-between">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"><ChevronLeft className="w-5 h-5"/></button>
                    <div className="flex flex-col">
                        <span className="font-bold text-lg text-gray-900 dark:text-white">{script.title}</span>
                        <span className="text-xs text-gray-500">{activeScene ? activeScene.title : '未选择集数'}</span>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    {saveStatus === 'saving' && <span className="text-xs text-sky-500 animate-pulse flex items-center gap-1"><ArrowPath className="w-3 h-3 animate-spin"/> 保存中...</span>}
                    {saveStatus === 'saved' && <span className="text-xs text-green-500 flex items-center gap-1"><Check className="w-3 h-3"/> 已保存</span>}
                    <button onClick={() => setRightSidebarOpen(!isRightSidebarOpen)} className={`p-2 rounded-lg transition-colors ${isRightSidebarOpen ? 'bg-sky-100 text-sky-600' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
                        <Sparkles className="w-5 h-5" />
                    </button>
                </div>
            </header>

            <div className="flex-1 flex overflow-hidden relative">
                {/* Left Sidebar: Episode List */}
                <aside className={`flex-shrink-0 flex flex-col bg-white dark:bg-black border-r border-gray-200 dark:border-gray-800 transition-all duration-300 overflow-hidden ${isLeftSidebarOpen ? 'w-64' : 'w-0'}`}>
                    <ScriptEpisodeManager 
                        episodes={script.scenes} 
                        activeEpisodeId={activeScene?.id || null} 
                        onSelectEpisode={setActiveScene} 
                        onDeleteEpisode={handleDeleteScene} 
                        onCreateEpisode={handleCreateScene} 
                        onReorderEpisodes={handleReorderScenes}
                    />
                </aside>

                <button 
                    onClick={() => setLeftSidebarOpen(!isLeftSidebarOpen)}
                    className={`absolute z-30 top-1/2 -translate-y-1/2 w-4 h-12 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-r-md flex items-center justify-center text-gray-400 hover:text-sky-500 transition-all shadow-sm ${isLeftSidebarOpen ? 'left-64' : 'left-0'}`}
                >
                    {isLeftSidebarOpen ? <ChevronLeft className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                </button>

                {/* Main Editor */}
                <main className="flex-1 bg-white dark:bg-black flex flex-col relative overflow-hidden">
                    {activeScene ? (
                        <>
                            <div className="p-2 border-b border-gray-100 dark:border-gray-800 flex justify-center">
                                <WritingToolbar onAction={handleToolbarAction} alignment={'left'} />
                            </div>
                            <div className="flex-1 overflow-y-auto p-8 lg:px-24">
                                <input 
                                    value={sceneTitle} 
                                    onChange={handleTitleChange}
                                    className="w-full text-2xl font-bold bg-transparent outline-none mb-6 text-gray-900 dark:text-white"
                                    placeholder="输入本集标题..."
                                />
                                <div 
                                    ref={editorRef}
                                    contentEditable
                                    onInput={handleContentInput}
                                    onContextMenu={handleContextMenu}
                                    className="w-full min-h-[60vh] outline-none text-base leading-relaxed text-gray-800 dark:text-gray-300 font-serif pb-32"
                                />
                            </div>
                            <div className="absolute bottom-4 right-6 text-xs text-gray-400 font-mono">
                                {wordCount} 字
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex items-center justify-center text-gray-400 flex-col">
                            <ChatBubbleOvalLeftEllipsis className="w-16 h-16 mb-4 opacity-20" />
                            <p>请选择或新建一集开始创作</p>
                        </div>
                    )}
                </main>

                {/* Right Sidebar: AI Panel */}
                <aside className={`flex-shrink-0 bg-white dark:bg-black border-l border-gray-200 dark:border-gray-800 shadow-xl z-20 flex flex-col transition-all duration-300 overflow-hidden ${isRightSidebarOpen ? 'w-[320px]' : 'w-0'}`}>
                    <div className="flex-1 overflow-hidden min-w-[320px]">
                        <ScriptAIPanel 
                            onInsert={handleInsertText}
                            onReplace={handleReplaceText}
                            selectedText={contextMenu.text}
                            externalAction={aiTrigger}
                        />
                    </div>
                </aside>
            </div>
        </div>
    );
};

export default ScriptWritingPage;
