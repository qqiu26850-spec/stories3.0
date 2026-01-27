
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Novel, Chapter, NovelSettings } from '../../types';
import { BookSolid, BookOpen, Pencil, ChevronDoubleLeft, ArrowPath, Check, Sparkles, ChevronLeft, ChevronRight, X, DocumentText, AdjustmentsHorizontal, FloppyDisk } from '../Icon'; 
import NovelSettingsPanel from './NovelSettingsPanel';
import ChapterManager from './ChapterManager';
import AIFunctionPanel from './AIFunctionPanel';
import ShortStoryAIPanel from './ShortStoryAIPanel';
import WritingToolbar, { ToolbarAction } from './WritingToolbar';
import { saveChapterToDB, updateProject, fetchChapters, fetchChapterContent, deleteChapterFromDB, updateChapterOrder } from '../../services/supabaseService';
import { createPortal } from 'react-dom';
import FollowUpModal from '../FollowUpModal';

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
    onAction: (action: 'ask') => void;
}> = ({ x, y, visible, mode, onClose, onAction }) => {
    if (!visible) return null;

    const options = [
        { id: 'ask', label: '智能追问', icon: '💬' }
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
    
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [debouncedContextText, setDebouncedContextText] = useState(''); 
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [isLoadingChapters, setIsLoadingChapters] = useState(true);
    const [isContentLoading, setIsContentLoading] = useState(false);

    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; visible: boolean; text: string }>({ x: 0, y: 0, visible: false, text: '' });
    const [aiTrigger, setAiTrigger] = useState<{ type: 'polish' | 'review' | 'expand' | 'continue'; text: string } | null>(null);
    
    const [activeFollowUp, setActiveFollowUp] = useState<{ target: string; context: string; initialMode: 'selection' | 'full' } | null>(null);

    useEffect(() => {
        const loadInitialChapters = async () => {
             const data = await fetchChapters(novel.id);
             if (data) {
                const mapped: Chapter[] = data.map((c: any) => ({
                    id: c.id,
                    title: c.title,
                    content: '', 
                    wordCount: 0,
                    lastModified: c.updated_at,
                    isContentLoaded: false
                }));
                setNovel(prev => ({ ...prev, chapters: mapped }));
                
                if (mapped.length > 0 && !activeChapter) {
                    setActiveChapter(mapped[0]);
                } else if (mapped.length === 0 && mode === 'short') {
                    // Auto-create chapter for short story mode if empty
                    const newId = await saveChapterToDB(novel.id, `new-${Date.now()}`, '正文', '', 1);
                    if (newId) {
                        const newChapter: Chapter = {
                            id: newId,
                            title: '正文',
                            content: '',
                            wordCount: 0,
                            lastModified: new Date().toISOString(),
                            isContentLoaded: true
                        };
                        setNovel(prev => ({ ...prev, chapters: [newChapter] }));
                        setActiveChapter(newChapter);
                    }
                }
                setIsLoadingChapters(false);
             }
        };
        loadInitialChapters();
    }, [novel.id, mode]);

    useEffect(() => {
        const loadContent = async () => {
            if (activeChapter && !activeChapter.isContentLoaded) {
                setIsContentLoading(true);
                if (editorRef.current) editorRef.current.innerHTML = '';

                const content = await fetchChapterContent(activeChapter.id);
                
                setNovel(prev => ({
                    ...prev,
                    chapters: prev.chapters.map(c => c.id === activeChapter.id ? { ...c, content, isContentLoaded: true } : c)
                }));
                
                setActiveChapter(prev => prev ? { ...prev, content, isContentLoaded: true } : null);
                setIsContentLoading(false);
            }
        };
        loadContent();
    }, [activeChapter?.id]);

    useEffect(() => {
        if (activeChapter && activeChapter.isContentLoaded) {
            setChapterTitle(activeChapter.title);
            const content = activeChapter.content || '';
            
            if (editorRef.current) {
                const html = content.includes('<p>') ? content : content.split('\n').map(p => `<p>${p || '<br>'}</p>`).join('');
                editorRef.current.innerHTML = html;
            }
            
            const count = content.replace(/<[^>]*>/g, '').replace(/\s/g, '').length;
            setWordCount(count);
            setSaveStatus('saved');
        }
    }, [activeChapter?.id, activeChapter?.isContentLoaded]);

    const handleSaveToCloud = async (currentContent: string) => {
        if (activeChapter) {
            const orderIndex = novel.chapters.findIndex(c => c.id === activeChapter.id) + 1;
            const newId = await saveChapterToDB(novel.id, activeChapter.id, chapterTitle, currentContent, orderIndex);

            if (newId) {
                const updatedChapter = { ...activeChapter, id: newId, title: chapterTitle, content: currentContent, isContentLoaded: true };
                setNovel(prev => ({
                    ...prev,
                    chapters: prev.chapters.map(c => c.id === activeChapter.id ? updatedChapter : c)
                }));
                
                if (activeChapter.id !== newId) {
                    setActiveChapter(prev => prev ? { ...prev, id: newId, isContentLoaded: true } : null);
                }
                setSaveStatus('saved');
            } else {
                setSaveStatus('error');
            }
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
                const html = editorRef.current.innerHTML;
                const text = editorRef.current.innerText || '';
                const count = text.replace(/\s/g, '').length;
                setWordCount(count);
                
                // Debounced context update
                setDebouncedContextText(text);
                
                handleSaveToCloud(html);
            }
        }, 1000);
    }, [activeChapter, chapterTitle]);

    const handleSelectionChange = () => {
        const selection = window.getSelection();
        const text = selection?.toString() || '';
        setCurrentSelection(text);
    };

    const handleCreateChapter = async () => {
        const newOrder = novel.chapters.length + 1;
        const tempId = `new-${Date.now()}`;
        const newTitle = `第${newOrder}章`;
        const newId = await saveChapterToDB(novel.id, tempId, newTitle, '', newOrder);

        if (newId) {
            const newChapter: Chapter = {
                id: newId,
                title: newTitle,
                content: '',
                wordCount: 0,
                lastModified: new Date().toISOString(),
                isContentLoaded: true
            };
            setNovel(prev => ({ ...prev, chapters: [...prev.chapters, newChapter] }));
            setActiveChapter(newChapter);
            setSaveStatus('saved');
        }
    };

    const handleDeleteChapter = async (id: string) => {
        await deleteChapterFromDB(id);
        setNovel(prev => ({ ...prev, chapters: prev.chapters.filter(c => c.id !== id) }));
        if (activeChapter?.id === id) {
            setActiveChapter(null);
            setChapterTitle('');
            if (editorRef.current) editorRef.current.innerHTML = '';
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

    const handleUpdateSettings = async (key: keyof NovelSettings, value: string) => {
        const newSettings = { ...novel.settings, [key]: value };
        setNovel(prev => ({ ...prev, settings: newSettings }));
        // Convert to string for DB
        await updateProject(novel.id, { description: JSON.stringify(newSettings) });
    };

    const handleToolbarAction = (action: ToolbarAction) => {
        if (!editorRef.current) return;
        editorRef.current.focus();

        if (action === 'copy') {
            navigator.clipboard.writeText(editorRef.current.innerText);
            setShowCopyToast(true);
            setTimeout(() => setShowCopyToast(false), 2000);
        } else if (action === 'bold') document.execCommand('bold');
        else if (action === 'italic') document.execCommand('italic');
        else if (action.startsWith('align-')) {
            const align = action.replace('align-', '');
            document.execCommand(align === 'justify' ? 'justifyFull' : `justify${align.charAt(0).toUpperCase() + align.slice(1)}`);
            setAlignment(align as any);
        } else if (action === 'font-increase') setFontSize(prev => Math.min(prev + 2, 32));
        else if (action === 'font-decrease') setFontSize(prev => Math.max(prev - 2, 12));
        else if (action === 'indent-add') {
            document.execCommand('formatBlock', false, 'p');
            document.execCommand('indent');
        } else if (action === 'indent-decrease') document.execCommand('outdent');
        
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
        if (text) {
            e.preventDefault();
            setCurrentSelection(text);
            setContextMenu({ x: e.clientX, y: e.clientY, visible: true, text });
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

    // Debounced title save
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
                    <span className="text-sm font-bold">内容已复制</span>
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

            <ContextMenu 
                {...contextMenu} 
                mode={mode}
                onClose={() => setContextMenu(prev => ({ ...prev, visible: false }))} 
                onAction={() => setActiveFollowUp({
                    target: contextMenu.text,
                    context: editorRef.current?.innerText || '',
                    initialMode: 'selection'
                })}
            />

            <header className="flex-shrink-0 bg-white dark:bg-black flex border-b border-gray-200 dark:border-gray-800 z-20 shadow-sm h-16">
                <div className="w-64 flex-shrink-0 flex items-center gap-2 px-4 border-r border-gray-200 dark:border-gray-800">
                    {mode === 'long' ? <BookSolid className="w-8 h-8 text-sky-500" /> : <Sparkles className="w-8 h-8 text-sky-500" />}
                    <span className="font-bold text-xl tracking-wider text-gray-900 dark:text-white truncate">{pageTitle}</span>
                </div>
                
                <div className="flex-1 flex items-center justify-center p-2">
                    {isEditingTitle ? (
                        <input 
                            value={tempTitle} 
                            onChange={(e) => setTempTitle(e.target.value)} 
                            onBlur={() => { setNovel(p=>({...p, title: tempTitle})); updateProject(novel.id, {title: tempTitle}); setIsEditingTitle(false); }} 
                            autoFocus 
                            maxLength={20}
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
                                <span className="text-sm font-bold">保存中</span>
                            </div>
                        )}
                        {saveStatus === 'saved' && (
                            <div className="flex flex-row items-center gap-1.5 text-green-500 whitespace-nowrap">
                                <Check className="w-5 h-5" />
                                <span className="text-sm font-bold">已保存</span>
                            </div>
                        )}
                        {saveStatus === 'error' && (
                            <div className="flex flex-row items-center gap-1.5 text-red-500 whitespace-nowrap">
                                <X className="w-5 h-5" />
                                <span className="text-sm font-bold">失败</span>
                            </div>
                        )}
                    </div>

                    <button onClick={onBack} className="px-5 py-2 text-sm font-bold text-white bg-sky-500 hover:bg-sky-600 rounded-lg shadow-sm">返回</button>
                </div>
            </header>

            <div className="flex-1 flex overflow-hidden relative">
                {/* Left Sidebar */}
                <button 
                    onClick={() => setLeftSidebarOpen(!isLeftSidebarOpen)}
                    className={`absolute z-30 top-1/2 -translate-y-1/2 w-4 h-12 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-r-md flex items-center justify-center text-gray-400 hover:text-sky-500 transition-all shadow-sm ${isLeftSidebarOpen ? 'left-64' : 'left-0'}`}
                    style={{ marginLeft: isLeftSidebarOpen ? '-1px' : '0' }}
                >
                    {isLeftSidebarOpen ? <ChevronLeft className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                </button>

                <aside className={`flex-shrink-0 flex flex-col bg-white dark:bg-black border-r border-gray-200 dark:border-gray-800 transition-all duration-300 overflow-hidden ${isLeftSidebarOpen ? 'w-64' : 'w-0'}`}>
                    {mode === 'long' ? (
                        <div className="flex border-b border-gray-200 dark:border-gray-800">
                            <button 
                                onClick={() => setOpenModule('chapters')}
                                className={`flex-1 py-3 text-sm font-bold transition-colors border-b-2 ${openModule === 'chapters' ? 'border-sky-500 text-sky-600 bg-sky-50 dark:bg-sky-900/10' : 'border-transparent text-gray-500 hover:text-gray-900'}`}
                            >
                                章节列表
                            </button>
                            <button 
                                onClick={() => setOpenModule('settings')}
                                className={`flex-1 py-3 text-sm font-bold transition-colors border-b-2 ${openModule === 'settings' ? 'border-sky-500 text-sky-600 bg-sky-50 dark:bg-sky-900/10' : 'border-transparent text-gray-500 hover:text-gray-900'}`}
                            >
                                作品设定
                            </button>
                        </div>
                    ) : (
                        <div className="p-3 my-4 mx-4 rounded-xl bg-sky-500 text-white font-bold text-center shadow-lg shadow-sky-500/20">
                            作品设定
                        </div>
                    )}
                    
                    <div className="flex-1 overflow-y-auto">
                        {mode === 'long' && openModule === 'chapters' ? (
                            <ChapterManager 
                                chapters={novel.chapters} 
                                activeChapterId={activeChapter?.id || null} 
                                onSelectChapter={setActiveChapter} 
                                onDeleteChapter={handleDeleteChapter} 
                                onCreateChapter={handleCreateChapter} 
                                onReorderChapters={handleReorderChapters}
                            />
                        ) : (
                            <NovelSettingsPanel settings={novel.settings} onUpdate={handleUpdateSettings} mode={mode} />
                        )}
                    </div>
                </aside>

                {/* Main Editor */}
                <main className="flex-1 bg-gray-50 dark:bg-gray-950 flex flex-col relative overflow-hidden px-1.5 py-0">
                     <div className="flex-1 flex flex-col bg-white dark:bg-gray-900 shadow-sm border-x border-gray-100 dark:border-gray-800 w-full h-full overflow-hidden relative">
                        {activeChapter ? (
                            <>
                                <div className="pt-1.5 px-8 pb-1 flex-shrink-0 bg-white dark:bg-gray-900 z-10 flex flex-col gap-1 border-b border-gray-100 dark:border-gray-800">
                                     <WritingToolbar onAction={handleToolbarAction} alignment={alignment} />
                                </div>

                                <div className="flex-1 overflow-y-auto dynamic-scrollbar px-12 pb-12 pt-1" ref={scrollContainerRef}>
                                    {mode === 'long' && (
                                        <>
                                            <input 
                                                value={chapterTitle} 
                                                onChange={(e) => setChapterTitle(e.target.value)} 
                                                placeholder="输入章节标题..." 
                                                maxLength={30}
                                                className="w-full py-1 text-2xl font-bold bg-transparent focus:outline-none text-gray-900 dark:text-white mb-1.5" 
                                            />
                                            <div className="border-b border-gray-100 dark:border-gray-800 mb-6" />
                                        </>
                                    )}
                                    
                                    {isContentLoading ? (
                                        <div className="w-full h-96 flex items-center justify-center">
                                            <div className="w-8 h-8 border-2 border-sky-200 border-t-sky-500 rounded-full animate-spin"></div>
                                        </div>
                                    ) : (
                                        <div 
                                            ref={editorRef}
                                            contentEditable 
                                            onInput={handleContentInput}
                                            onContextMenu={handleContextMenu}
                                            onMouseUp={handleSelectionChange}
                                            onKeyUp={handleSelectionChange}
                                            suppressContentEditableWarning={true}
                                            spellCheck={false}
                                            autoCorrect="off"
                                            autoCapitalize="off"
                                            className="w-full bg-transparent focus:outline-none leading-relaxed text-gray-800 dark:text-gray-200 font-serif min-h-[75vh] outline-none pb-32"
                                            style={{ textAlign: alignment, fontSize: `${fontSize}px` }}
                                        ></div>
                                    )}
                                </div>

                                <div className="absolute bottom-6 right-8 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm px-4 py-1.5 rounded-full text-xs text-gray-400 font-mono border border-gray-100 dark:border-gray-800 shadow-sm z-20">
                                    <span className="text-sky-500 font-black">{wordCount}</span> 字
                                </div>
                            </>
                        ) : (
                            <div className="flex-1 flex items-center justify-center text-gray-400 flex-col">
                                <BookOpen className="w-16 h-16 mb-4 opacity-20" />
                                <p>请新建或选择一章开始创作</p>
                            </div>
                        )}
                     </div>
                </main>

                {/* Right Sidebar - AI Panel */}
                <button 
                    onClick={() => setRightSidebarOpen(!isRightSidebarOpen)}
                    className={`absolute z-30 top-1/2 -translate-y-1/2 w-4 h-12 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-r-md flex items-center justify-center text-gray-400 hover:text-sky-500 transition-all shadow-sm ${isRightSidebarOpen ? 'right-[29%]' : 'right-0'}`}
                    style={{ marginRight: isRightSidebarOpen ? '-1px' : '0' }}
                >
                    {isRightSidebarOpen ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
                </button>

                <aside className={`flex-shrink-0 bg-white dark:bg-black border-l border-gray-200 dark:border-gray-800 shadow-xl z-10 flex flex-col transition-all duration-300 overflow-hidden ${isRightSidebarOpen ? 'w-[29%]' : 'w-0'}`}>
                    <div className="flex-1 overflow-hidden min-w-[300px]">
                        {mode === 'short' ? (
                            <ShortStoryAIPanel 
                                contextText={editorRef.current?.innerText || ''}
                                selectedText={currentSelection}
                                onInsert={handleInsertText}
                                onReplace={handleReplaceText}
                                projectSettings={novel.settings}
                                externalAction={aiTrigger}
                            />
                        ) : (
                            <AIFunctionPanel 
                                contextText={editorRef.current?.innerText || ''}
                                selectedText={currentSelection}
                                onInsert={handleInsertText}
                                onReplace={handleReplaceText}
                                projectSettings={novel.settings}
                                externalAction={aiTrigger}
                                chapters={novel.chapters}
                            />
                        )}
                    </div>
                </aside>
            </div>
        </div>
    );
};

export default NovelWritingPage;
