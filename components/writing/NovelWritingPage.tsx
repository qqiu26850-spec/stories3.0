
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Novel, Chapter, NovelSettings } from '../../types';
import { BookSolid, BookOpen, Pencil, ChevronDoubleLeft, ArrowPath, Check, Sparkles, ChevronLeft, ChevronRight, PanelLeft, PanelRight, X } from '../Icon';
import NovelSettingsPanel from './NovelSettingsPanel';
import ChapterManager from './ChapterManager';
import AIFunctionPanel from './AIFunctionPanel';
import ShortStoryAIPanel from './ShortStoryAIPanel';
import WritingToolbar, { ToolbarAction } from './WritingToolbar';
import { saveChapterToDB, updateProject, fetchChapters, deleteChapterFromDB, updateChapterOrder } from '../../services/supabaseService';
import { createPortal } from 'react-dom';

interface NovelWritingPageProps {
    novel: Novel;
    onBack: () => void;
    pageTitle?: string;
    mode?: 'long' | 'short';
}

type SidebarModule = 'settings' | 'chapters';
type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error';

const ContextMenu: React.FC<{
    x: number;
    y: number;
    visible: boolean;
    mode: 'long' | 'short';
    onClose: () => void;
    onAction: (action: 'expand' | 'continue' | 'polish' | 'review') => void;
}> = ({ x, y, visible, mode, onClose, onAction }) => {
    if (!visible) return null;

    const options = mode === 'long' 
        ? [
            { id: 'continue', label: '续写', icon: '📝' },
            { id: 'expand', label: '扩写', icon: '✨' },
            { id: 'polish', label: '润色', icon: '🎨' }
          ]
        : [
            { id: 'polish', label: '润色', icon: '🎨' },
            { id: 'review', label: '评审', icon: '🧐' }
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

const NovelWritingPage: React.FC<NovelWritingPageProps> = ({ novel: initialNovel, onBack, pageTitle = '小说管理', mode = 'long' }) => {
    const [novel, setNovel] = useState<Novel>(initialNovel);
    const [activeChapter, setActiveChapter] = useState<Chapter | null>(null);
    const [chapterTitle, setChapterTitle] = useState('');
    const [wordCount, setWordCount] = useState(0);
    const [showCopyToast, setShowCopyToast] = useState(false);
    
    const [debouncedContextText, setDebouncedContextText] = useState(''); 
    const [currentSelection, setCurrentSelection] = useState('');

    const editorRef = useRef<HTMLDivElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const updateTimeoutRef = useRef<any>(null);

    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [tempTitle, setTempTitle] = useState(novel.title);
    
    const [openModule, setOpenModule] = useState<SidebarModule>(mode === 'short' ? 'settings' : 'chapters');
    
    const [alignment, setAlignment] = useState<'left' | 'center' | 'right' | 'justify'>('left');
    const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
    const [fontSize, setFontSize] = useState(18); 
    
    const [isLeftSidebarOpen, setLeftSidebarOpen] = useState(true);
    const [isRightSidebarOpen, setRightSidebarOpen] = useState(true);

    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; visible: boolean; text: string }>({ x: 0, y: 0, visible: false, text: '' });
    const [aiTrigger, setAiTrigger] = useState<{ type: 'expand' | 'continue' | 'polish' | 'review', text: string } | null>(null);

    useEffect(() => {
        const loadInitialChapters = async () => {
             const data = await fetchChapters(novel.id);
             if (data) {
                const mapped = data.map((c: any) => ({
                    id: c.id,
                    title: c.title,
                    content: c.content,
                    wordCount: c.content?.length || 0,
                    lastModified: c.updated_at
                }));
                setNovel(prev => ({ ...prev, chapters: mapped }));
                
                if (mapped.length > 0) {
                    setActiveChapter(mapped[0]);
                } else if (mode === 'short') {
                    handleCreateChapter(true);
                } else if (!activeChapter && mapped.length > 0) {
                    setActiveChapter(mapped[0]);
                }
             } else if (mode === 'short') {
                 handleCreateChapter(true);
             }
        };
        loadInitialChapters();
    }, [novel.id, mode]);

    // Handle Chapter Switching
    useEffect(() => {
        if (activeChapter) {
            setChapterTitle(activeChapter.title);
            const content = activeChapter.content || '';
            
            if (editorRef.current) {
                const html = content.includes('<p>') ? content : content.split('\n').map(p => `<p>${p || '<br>'}</p>`).join('');
                // Direct DOM manipulation only when switching chapter context
                if (editorRef.current.innerHTML !== html) {
                    editorRef.current.innerHTML = html;
                }
            }
            
            setWordCount(content.replace(/<[^>]*>/g, '').replace(/\s/g, '').length);
            setDebouncedContextText(content);
            setSaveStatus('saved');
            setCurrentSelection('');
        }
    }, [activeChapter?.id]); 

    const handleSaveToCloud = async (currentContent: string) => {
        if (activeChapter) {
            const orderIndex = novel.chapters.findIndex(c => c.id === activeChapter.id) + 1;
            const newId = await saveChapterToDB(novel.id, activeChapter.id, chapterTitle, currentContent, orderIndex);

            if (newId) {
                setNovel(prev => ({
                    ...prev,
                    chapters: prev.chapters.map(c => c.id === activeChapter.id ? { ...c, content: currentContent, id: newId } : c)
                }));
                
                if (activeChapter.id !== newId) {
                    setActiveChapter(prev => prev ? { ...prev, id: newId } : null);
                }
                setSaveStatus('saved');
            } else {
                setSaveStatus('error');
            }
        }
    };

    const handleUpdateSettings = async (key: keyof NovelSettings, value: string) => {
        const newSettings = { ...novel.settings, [key]: value };
        setNovel(prev => ({ ...prev, settings: newSettings }));
        setSaveStatus('saving');
        try {
            await updateProject(novel.id, { description: JSON.stringify(newSettings) });
            setSaveStatus('saved');
        } catch (e) {
            setSaveStatus('error');
        }
    };

    const handleCreateChapter = async (isAutoInit = false) => {
        const newOrder = novel.chapters.length + 1;
        const tempId = `new-${Date.now()}`;
        const newTitle = mode === 'short' ? '正文' : `第${newOrder}章：`;
        const newId = await saveChapterToDB(novel.id, tempId, newTitle, '', newOrder);
        
        if (newId) {
            const newChapter: Chapter = {
                id: newId,
                title: newTitle,
                content: '',
                wordCount: 0,
                lastModified: new Date().toISOString()
            };
            setNovel(prev => ({
                ...prev,
                chapters: [...prev.chapters, newChapter]
            }));
            setActiveChapter(newChapter);
            setSaveStatus('saved');
        }
    };

    const handleDeleteChapter = async (id: string) => {
        try {
            await deleteChapterFromDB(id);
            setNovel(prev => ({
                ...prev,
                chapters: prev.chapters.filter(c => c.id !== id)
            }));
            if (activeChapter?.id === id) {
                setActiveChapter(null);
                setChapterTitle('');
                if (editorRef.current) editorRef.current.innerHTML = '';
            }
            setSaveStatus('saved');
        } catch (e) {
            console.error("删除失败", e);
        }
    };

    const handleReorderChapters = async (newChapters: Chapter[]) => {
        setNovel(prev => ({ ...prev, chapters: newChapters }));
        setSaveStatus('saving');
        try {
            const updates = newChapters.map((c, i) => ({ id: c.id, order_index: i + 1 }));
            await updateChapterOrder(updates);
            setSaveStatus('saved');
        } catch (e) {
            setSaveStatus('error');
        }
    };

    const handleContentInput = useCallback(() => {
        if (!editorRef.current) return;
        setSaveStatus('saving');

        if (updateTimeoutRef.current) {
            clearTimeout(updateTimeoutRef.current);
        }

        updateTimeoutRef.current = setTimeout(() => {
            if (editorRef.current) {
                const text = editorRef.current.innerText || '';
                const html = editorRef.current.innerHTML;
                setWordCount(text.replace(/\s/g, '').length);
                setDebouncedContextText(text);
                handleSaveToCloud(html);
            }
        }, 1000);
    }, [activeChapter, chapterTitle]); 

    const updateSelection = () => {
        const selection = window.getSelection();
        const text = selection?.toString() || '';
        if (text !== currentSelection) {
            setCurrentSelection(text);
        }
    };

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
        updateSelection(); 
    };

    // Optimization: Insert text without immediate heavy save
    const handleInsertText = (text: string) => {
        if (!editorRef.current) return;
        
        // Use requestAnimationFrame to avoid blocking the main thread during heavy insertions
        requestAnimationFrame(() => {
            if (editorRef.current) {
                editorRef.current.focus();
                
                // If text is very large, consider chunking or direct HTML manipulation if execCommand is slow,
                // but execCommand is usually safest for undo history.
                document.execCommand('insertText', false, text);
                
                // Trigger save logic (debounced)
                handleContentInput();
            }
        });
    };

    const handleReplaceText = (text: string) => {
        if (!editorRef.current) return;
        requestAnimationFrame(() => {
            if (editorRef.current) {
                editorRef.current.focus();
                document.execCommand('insertText', false, text);
                handleContentInput();
            }
        });
    };

    const handleAIStream = (chunk: string, isFirst: boolean) => {
        if (!editorRef.current) return;
        if (isFirst) { 
            editorRef.current.focus(); 
        }
        document.execCommand('insertText', false, chunk);
        
        if (scrollContainerRef.current) {
            const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
            if (scrollHeight - scrollTop - clientHeight < 100) {
                scrollContainerRef.current.scrollTop = scrollHeight;
            }
        }
        
        handleContentInput();
    };

    const handleContextMenu = (e: React.MouseEvent) => {
        const selection = window.getSelection();
        const text = selection?.toString().trim();
        setCurrentSelection(text || '');

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

    const handleAIAction = (type: 'expand' | 'continue' | 'polish' | 'review') => {
        setAiTrigger({ type, text: contextMenu.text });
        if (!isRightSidebarOpen) setRightSidebarOpen(true);
    };

    useEffect(() => {
        const closeMenu = () => setContextMenu(prev => ({ ...prev, visible: false }));
        document.addEventListener('click', closeMenu);
        return () => document.removeEventListener('click', closeMenu);
    }, []);

    useEffect(() => {
        if (!activeChapter) return;
        const timer = setTimeout(() => {
             handleSaveToCloud(editorRef.current?.innerHTML || '');
        }, 1000);
        return () => clearTimeout(timer);
    }, [chapterTitle]);

    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 overflow-hidden relative">
            {showCopyToast && (
                <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[100] bg-gray-800/90 text-white px-6 py-2 rounded-full shadow-2xl backdrop-blur-sm animate-fade-in-up flex items-center gap-2 border border-gray-700">
                    <Check className="w-4 h-4 text-green-400" />
                    <span className="text-sm font-bold">已成功复制全文</span>
                </div>
            )}

            <ContextMenu 
                {...contextMenu} 
                mode={mode}
                onClose={() => setContextMenu(prev => ({ ...prev, visible: false }))} 
                onAction={handleAIAction}
            />

            <header className="flex-shrink-0 bg-white dark:bg-black flex border-b border-gray-200 dark:border-gray-800 z-20 shadow-sm h-16">
                <div className="w-64 flex-shrink-0 flex items-center gap-3 px-4 border-r border-gray-200 dark:border-gray-800">
                    <BookSolid className="w-8 h-8 text-sky-500" />
                    <div className="flex-1 overflow-hidden flex items-center">
                        <span className="font-bold text-lg tracking-wider text-gray-900 dark:text-white truncate block">{mode === 'long' ? '长篇小说' : '短篇故事'}</span>
                    </div>
                </div>
                
                <div className="flex-1 flex items-center justify-center p-2">
                    {isEditingTitle ? (
                        <input 
                            value={tempTitle} 
                            onChange={(e) => setTempTitle(e.target.value)} 
                            onBlur={() => { setNovel(p=>({...p, title: tempTitle})); updateProject(novel.id, {title: tempTitle}); setIsEditingTitle(false); }} 
                            autoFocus 
                            maxLength={15}
                            className="text-center text-lg font-bold bg-sky-50 dark:bg-gray-800 border border-sky-300 rounded px-4 py-1.5 focus:outline-none min-w-[200px]" 
                        />
                    ) : (
                        <div className="flex items-center gap-2 group cursor-pointer px-6 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-md transition-all" onClick={() => setIsEditingTitle(true)}>
                            <h1 className="text-lg font-bold text-gray-700 dark:text-gray-200 tracking-wide">{novel.title}</h1>
                            <Pencil className="w-3.5 h-3.5 text-gray-400 opacity-0 group-hover:opacity-100" />
                        </div>
                    )}
                </div>
                
                <div className="w-[29%] flex-shrink-0 flex items-center justify-end px-4 border-l border-gray-200 dark:border-gray-800 gap-3">
                    <div className="flex items-center gap-2 mr-2">
                         {saveStatus === 'saving' && (
                            <div className="flex items-center gap-1.5 text-sky-500 animate-pulse whitespace-nowrap">
                                <ArrowPath className="w-4.5 h-4.5 animate-spin" />
                                <span className="text-sm font-bold">正在同步...</span>
                            </div>
                        )}
                        {saveStatus === 'saved' && (
                            <div className="flex flex-row items-center gap-1.5 text-green-500 whitespace-nowrap">
                                <Check className="w-5 h-5" />
                                <span className="text-sm font-bold">云端已同步</span>
                            </div>
                        )}
                        {saveStatus === 'error' && (
                            <div className="flex flex-row items-center gap-1.5 text-red-500 whitespace-nowrap">
                                <X className="w-5 h-5" />
                                <span className="text-sm font-bold">同步失败</span>
                            </div>
                        )}
                    </div>
                    <button onClick={onBack} className="px-5 py-2 text-sm font-bold text-white bg-sky-500 hover:bg-sky-600 rounded-lg shadow-sm">返回管理</button>
                </div>
            </header>

            <div className="flex-1 flex overflow-hidden relative">
                <button 
                    onClick={() => setLeftSidebarOpen(!isLeftSidebarOpen)}
                    className={`absolute z-30 top-1/2 -translate-y-1/2 w-4 h-12 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-r-md flex items-center justify-center text-gray-400 hover:text-sky-500 transition-all shadow-sm ${isLeftSidebarOpen ? 'left-64' : 'left-0'}`}
                >
                    {isLeftSidebarOpen ? <ChevronLeft className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                </button>

                <aside className={`flex-shrink-0 flex flex-col bg-white dark:bg-black border-r border-gray-200 dark:border-gray-800 transition-all duration-300 overflow-hidden ${isLeftSidebarOpen ? 'w-64' : 'w-0'}`}>
                    {mode === 'long' && (
                        <div className="flex p-2 gap-1 border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
                            <button onClick={() => setOpenModule('chapters')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${openModule === 'chapters' ? 'bg-sky-500 text-white shadow-md' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>章节列表</button>
                            <button onClick={() => setOpenModule('settings')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${openModule === 'settings' ? 'bg-sky-500 text-white shadow-md' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>作品设定</button>
                        </div>
                    )}
                    {mode === 'short' && (
                        <div className="flex p-2 gap-1 border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
                             <div className="flex-1 py-2 text-xs font-bold rounded-lg bg-sky-500 text-white shadow-md text-center">作品设定</div>
                        </div>
                    )}
                    
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        {openModule === 'chapters' && mode === 'long' ? (
                            <ChapterManager 
                                chapters={novel.chapters} 
                                activeChapterId={activeChapter?.id || null} 
                                onSelectChapter={setActiveChapter} 
                                onDeleteChapter={handleDeleteChapter}
                                onCreateChapter={handleCreateChapter}
                                onReorderChapters={handleReorderChapters}
                            />
                        ) : (
                            <NovelSettingsPanel settings={novel.settings} onUpdate={handleUpdateSettings} />
                        )}
                    </div>
                </aside>

                <main className="flex-1 bg-gray-50 dark:bg-gray-950 flex flex-col relative overflow-hidden px-1.5 py-0">
                     <div className="flex-1 flex flex-col bg-white dark:bg-gray-900 shadow-sm border-x border-gray-100 dark:border-gray-800 w-full h-full overflow-hidden relative">
                        {activeChapter ? (
                            <>
                                <div className="pt-1.5 px-8 pb-1 flex-shrink-0 bg-white dark:bg-gray-900 z-10 flex flex-col gap-1">
                                     <WritingToolbar onAction={handleToolbarAction} alignment={alignment} />
                                </div>

                                <div className="flex-1 overflow-y-auto dynamic-scrollbar px-12 pb-12 pt-1" ref={scrollContainerRef}>
                                    {mode === 'long' && (
                                        <>
                                            <input 
                                                value={chapterTitle} 
                                                onChange={(e) => setChapterTitle(e.target.value)} 
                                                placeholder="请输入章节标题..." 
                                                maxLength={30}
                                                className="w-full py-1 text-2xl font-bold bg-transparent focus:outline-none text-gray-900 dark:text-white mb-1.5" 
                                            />
                                            <div className="border-b border-gray-100 dark:border-gray-800 mb-6" />
                                        </>
                                    )}
                                    
                                    <div 
                                        ref={editorRef}
                                        contentEditable 
                                        onInput={handleContentInput}
                                        onKeyUp={updateSelection} 
                                        onMouseUp={updateSelection} 
                                        onPaste={handlePaste}
                                        onContextMenu={handleContextMenu}
                                        suppressContentEditableWarning={true}
                                        className="w-full bg-transparent focus:outline-none leading-relaxed text-gray-800 dark:text-gray-200 font-serif min-h-[75vh] outline-none pb-32"
                                        style={{ textAlign: alignment, fontSize: `${fontSize}px` }}
                                    ></div>
                                </div>

                                <div className="absolute bottom-6 right-8 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm px-4 py-1.5 rounded-full text-xs text-gray-400 font-mono border border-gray-100 dark:border-gray-800 shadow-sm z-20">
                                    <span className="text-sky-500 font-black">{wordCount.toLocaleString()}</span> 字
                                </div>
                            </>
                        ) : (
                            <div className="flex-1 flex items-center justify-center text-gray-400 flex-col"><BookOpen className="w-16 h-16 mb-4 opacity-20" /><p>请在左侧新建或选择一个章节开始创作</p></div>
                        )}
                     </div>
                </main>

                <button 
                    onClick={() => setRightSidebarOpen(!isRightSidebarOpen)}
                    className={`absolute z-30 top-1/2 -translate-y-1/2 w-4 h-12 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-l-md flex items-center justify-center text-gray-400 hover:text-sky-500 transition-all shadow-sm ${isRightSidebarOpen ? 'right-[29%]' : 'right-0'}`}
                >
                    {isRightSidebarOpen ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
                </button>

                <aside className={`flex-shrink-0 bg-white dark:bg-black border-l border-gray-200 dark:border-gray-800 shadow-xl z-10 flex flex-col transition-all duration-300 overflow-hidden ${isRightSidebarOpen ? 'w-[29%]' : 'w-0'}`}>
                    <div className="flex-1 overflow-hidden min-w-[300px]">
                        {mode === 'short' ? (
                            <ShortStoryAIPanel 
                                contextText={debouncedContextText} 
                                selectedText={currentSelection} 
                                onInsert={handleInsertText} 
                                onReplace={handleReplaceText} 
                                onStream={handleAIStream}
                                projectSettings={novel.settings}
                                externalAction={aiTrigger}
                            />
                        ) : (
                            <AIFunctionPanel 
                                contextText={debouncedContextText} 
                                selectedText={currentSelection} 
                                onInsert={handleInsertText} 
                                onReplace={handleReplaceText} 
                                onStream={handleAIStream}
                                projectSettings={novel.settings}
                                externalAction={aiTrigger}
                            />
                        )}
                    </div>
                </aside>
            </div>
        </div>
    );
};

export default NovelWritingPage;
