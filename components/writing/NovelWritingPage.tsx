
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Novel, Chapter, NovelSettings } from '../../types';
import { BookSolid, ChevronDown, BookOpen, Pencil, ChevronDoubleLeft, ChevronDoubleRight, ArrowPath, Check } from '../Icon';
import NovelSettingsPanel from './NovelSettingsPanel';
import ChapterManager from './ChapterManager';
import AIFunctionPanel from './AIFunctionPanel';
import ShortStoryAIPanel from './ShortStoryAIPanel';
import WritingToolbar, { ToolbarAction } from './WritingToolbar';
import { saveChapterToDB, updateProject, fetchChapters, deleteChapterFromDB } from '../../services/supabaseService';

interface NovelWritingPageProps {
    novel: Novel;
    onBack: () => void;
    pageTitle?: string;
    mode?: 'long' | 'short';
}

type SidebarModule = 'settings' | 'chapters';
type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error';

const NovelWritingPage: React.FC<NovelWritingPageProps> = ({ novel: initialNovel, onBack, pageTitle = '小说管理', mode = 'long' }) => {
    const [novel, setNovel] = useState<Novel>(initialNovel);
    const [activeChapter, setActiveChapter] = useState<Chapter | null>(null);
    const [chapterTitle, setChapterTitle] = useState('');
    const [editorContent, setEditorContent] = useState('');
    const [wordCount, setWordCount] = useState(0);
    
    const [showLeftSidebar, setShowLeftSidebar] = useState(true);
    const [showRightSidebar, setShowRightSidebar] = useState(true);
    const [alignment, setAlignment] = useState<'left' | 'center' | 'right'>('left');
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [selectionRange, setSelectionRange] = useState<{start: number, end: number}>({ start: 0, end: 0 });
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [tempTitle, setTempTitle] = useState(novel.title);
    const [openModule, setOpenModule] = useState<SidebarModule>('chapters');
    
    const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');

    // Parse settings from description if needed on init
    useEffect(() => {
        // If settings are empty but description exists (loaded from DB), parse it
        if ((!novel.settings.synopsis && !novel.settings.theme) && (novel as any).description) {
            try {
                const parsedSettings = JSON.parse((novel as any).description);
                if (typeof parsedSettings === 'object') {
                    setNovel(prev => ({ ...prev, settings: { ...prev.settings, ...parsedSettings } }));
                }
            } catch (e) {
                // If not JSON, assume description is just synopsis
                setNovel(prev => ({ ...prev, settings: { ...prev.settings, synopsis: (novel as any).description } }));
            }
        }
    }, []);

    // Load chapters from Supabase on mount
    useEffect(() => {
        const loadChapters = async () => {
            if (!novel.id || novel.id.startsWith('novel-')) return; 

            const dbChapters = await fetchChapters(novel.id);
            if (dbChapters && dbChapters.length > 0) {
                const mappedChapters: Chapter[] = dbChapters.map((c: any) => ({
                    id: c.id,
                    title: c.title,
                    content: c.content || '',
                    wordCount: (c.content || '').length,
                    lastModified: c.created_at || new Date().toISOString()
                }));
                setNovel(prev => ({ ...prev, chapters: mappedChapters }));
                setActiveChapter(mappedChapters[0]);
            } else if (novel.chapters.length > 0) {
                setActiveChapter(novel.chapters[0]);
            }
        };
        loadChapters();
    }, [novel.id]);

    useEffect(() => {
        if (activeChapter) {
            setChapterTitle(activeChapter.title);
            setEditorContent(activeChapter.content);
            const count = activeChapter.content.replace(/\s/g, '').length;
            setWordCount(count);
            setSaveStatus('saved');
        } else {
            setChapterTitle('');
            setEditorContent('');
            setWordCount(0);
        }
    }, [activeChapter]);

    // Auto-Save Logic for Chapter Content (1s Debounce)
    useEffect(() => {
        if (!activeChapter) return;
        
        const isChanged = chapterTitle !== activeChapter.title || editorContent !== activeChapter.content;
        
        if (isChanged) {
            setSaveStatus('saving');
            const timer = setTimeout(async () => {
                await handleSaveToCloud(true);
            }, 1000); 
            
            return () => clearTimeout(timer);
        }
    }, [chapterTitle, editorContent, activeChapter]);

    // Auto-Save Logic for Settings
    const handleSettingsUpdate = (key: keyof NovelSettings, value: string) => {
        setNovel(prev => {
            const newSettings = { ...prev.settings, [key]: value };
            const newState = { ...prev, settings: newSettings };
            
            // Debounced save for settings could be implemented, but direct save is safer for metadata
            // We use a small timeout to avoid excessive API calls on every keystroke
            if (prev.id && !prev.id.startsWith('novel-')) {
                clearTimeout((window as any)._settingsSaveTimer);
                (window as any)._settingsSaveTimer = setTimeout(() => {
                    updateProject(prev.id, { description: JSON.stringify(newSettings) });
                }, 1000);
            }
            
            return newState;
        });
    };

    const updateEditorState = useCallback((content: string) => {
        setEditorContent(content);
        const count = content.replace(/\s/g, '').length;
        setWordCount(count);
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
        setChapterTitle(e.target.value);
    };

    const handleToolbarAction = (action: ToolbarAction) => {
        const textarea = textareaRef.current;
        if (!textarea) return;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const value = textarea.value;
        let newContent = value;
        let newCursorStart = start;
        let newCursorEnd = end;

        if (action === 'copy') { navigator.clipboard.writeText(editorContent); return; }
        if (action === 'align-left') setAlignment('left');
        if (action === 'align-center') setAlignment('center');
        if (action === 'align-right') setAlignment('right');
        if (action === 'bold') {
             newContent = value.substring(0, start) + '**' + value.substring(start, end) + '**' + value.substring(end);
             newCursorStart = start; newCursorEnd = end + 4;
        }
        if (action === 'indent-add') {
             const lastNewline = value.lastIndexOf('\n', start - 1);
             const insertPos = lastNewline === -1 ? 0 : lastNewline + 1;
             newContent = value.substring(0, insertPos) + '　　' + value.substring(insertPos);
             newCursorStart = start + 2; newCursorEnd = end + 2;
        }

        if (newContent !== value) {
            updateEditorState(newContent);
            setTimeout(() => {
                if (textareaRef.current) {
                    textareaRef.current.focus();
                    textareaRef.current.setSelectionRange(newCursorStart, newCursorEnd);
                }
            }, 0);
        }
    };

    const saveNovelTitle = async () => {
        if (tempTitle.trim()) {
            setNovel(prev => ({ ...prev, title: tempTitle }));
            await updateProject(novel.id, { title: tempTitle });
        } else {
            setTempTitle(novel.title);
        }
        setIsEditingTitle(false);
    };

    const handleSaveToCloud = async (silent = false) => {
        if (activeChapter) {
            const orderIndex = novel.chapters.findIndex(c => c.id === activeChapter.id) + 1;
            
            const newId = await saveChapterToDB(
                novel.id, 
                activeChapter.id, 
                chapterTitle, 
                editorContent, 
                orderIndex
            );

            if (newId) {
                const updatedChapter = { 
                    ...activeChapter, 
                    id: newId, 
                    title: chapterTitle, 
                    content: editorContent,
                    wordCount: wordCount,
                    lastModified: new Date().toISOString()
                };
                
                setNovel(prev => ({
                    ...prev,
                    chapters: prev.chapters.map(c => c.id === activeChapter.id ? updatedChapter : c)
                }));
                setActiveChapter(updatedChapter);
                setSaveStatus('saved');
            } else {
                setSaveStatus('error');
            }
        }
    };

    const handleCreateChapter = () => {
        const newChapter: Chapter = {
            id: `ch-${Date.now()}`,
            title: `第 ${novel.chapters.length + 1} 章`,
            content: '',
            wordCount: 0,
            lastModified: new Date().toISOString()
        };
        setNovel(prev => ({ ...prev, chapters: [...prev.chapters, newChapter] }));
        setActiveChapter(newChapter);
    };

    const handleDeleteChapter = async (chapterId: string) => {
        await deleteChapterFromDB(chapterId);
        const newChapters = novel.chapters.filter(c => c.id !== chapterId);
        setNovel(prev => ({ ...prev, chapters: newChapters }));
        
        if (activeChapter?.id === chapterId) {
            setActiveChapter(newChapters.length > 0 ? newChapters[0] : null);
        }
    };

    const handleAIInsert = (text: string) => {
        const start = selectionRange.start;
        const newContent = editorContent.substring(0, start) + text + editorContent.substring(selectionRange.end);
        updateEditorState(newContent);
    };
    const handleAIReplace = (text: string) => {
        const newContent = editorContent.substring(0, selectionRange.start) + text + editorContent.substring(selectionRange.end);
        updateEditorState(newContent);
    };

    const rightSidebarWidthClass = mode === 'short' ? 'w-[30rem]' : 'w-80';
    const selectedText = editorContent.substring(selectionRange.start, selectionRange.end);

    return (
        <div className="flex flex-col h-full bg-gray-100 dark:bg-gray-900/50 text-gray-900 dark:text-gray-100">
            <header className="flex-shrink-0 bg-white dark:bg-black flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800 z-20 relative shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <BookSolid className="w-8 h-8 text-sky-500" />
                        <span className="font-bold text-xl tracking-wider text-gray-900 dark:text-white">{pageTitle}</span>
                    </div>
                </div>
                <div className="absolute left-1/2 -translate-x-1/2 max-w-[40%] flex items-center justify-center gap-2">
                    {isEditingTitle ? (
                        <input 
                            type="text"
                            value={tempTitle}
                            onChange={(e) => setTempTitle(e.target.value)}
                            onBlur={saveNovelTitle}
                            onKeyDown={(e) => e.key === 'Enter' && saveNovelTitle()}
                            autoFocus
                            className="text-center text-base font-bold bg-gray-50 dark:bg-gray-800 border border-sky-500 rounded px-3 py-1 focus:outline-none min-w-[200px] text-gray-900 dark:text-white shadow-inner"
                        />
                    ) : (
                        <div className="flex items-center gap-2 group cursor-pointer py-1.5 px-5 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors border border-transparent hover:border-gray-300 dark:hover:border-gray-600" onClick={() => setIsEditingTitle(true)}>
                            <h1 className="text-base font-bold truncate select-none text-gray-900 dark:text-white max-w-[250px] text-center">{novel.title}</h1>
                            <Pencil className="w-3.5 h-3.5 text-gray-500 transition-all" />
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 mr-2">
                        {saveStatus === 'saving' && <span className="text-xs text-sky-500 font-medium animate-pulse">正在保存...</span>}
                        {saveStatus === 'saved' && <span className="text-green-500 font-medium flex items-center gap-1"><Check className="w-3 h-3" /> 已实时保存</span>}
                        {saveStatus === 'error' && <span className="text-xs text-red-500 font-medium">保存失败</span>}
                        {saveStatus === 'unsaved' && <span className="text-xs text-gray-400">未保存</span>}
                    </div>
                    <button onClick={() => handleSaveToCloud(false)} className="px-4 py-2 text-sm font-bold text-sky-600 bg-sky-100 hover:bg-sky-200 dark:bg-sky-900/30 dark:text-sky-400 dark:hover:bg-sky-900/50 rounded-lg transition-colors flex items-center gap-1">
                        <ArrowPath className="w-4 h-4" /> 手动同步
                    </button>
                    <button onClick={onBack} className="px-4 py-2 text-sm font-bold text-white bg-sky-500 hover:bg-sky-600 rounded-lg transition-colors flex items-center gap-1 shadow-sm">
                        <ChevronDoubleLeft className="w-4 h-4" /> 返回
                    </button>
                </div>
            </header>

            <div className="flex flex-1 overflow-hidden relative">
                <button 
                    onClick={() => setShowLeftSidebar(!showLeftSidebar)}
                    className={`absolute top-1/2 -translate-y-1/2 z-30 w-5 h-12 bg-white dark:bg-black border border-gray-200 dark:border-gray-800 border-l-0 shadow-md text-gray-400 hover:text-sky-500 transition-all flex items-center justify-center rounded-r-lg`}
                    style={{ left: showLeftSidebar ? '20rem' : '0' }}
                >
                    {showLeftSidebar ? <ChevronDoubleLeft className="w-3 h-3" /> : <ChevronDoubleRight className="w-3 h-3" />}
                </button>
                <button 
                    onClick={() => setShowRightSidebar(!showRightSidebar)}
                    className={`absolute top-1/2 -translate-y-1/2 z-30 w-5 h-12 bg-white dark:bg-black border border-gray-200 dark:border-gray-800 border-r-0 shadow-md text-gray-400 hover:text-sky-500 transition-all flex items-center justify-center rounded-l-lg`}
                    style={{ right: showRightSidebar ? (mode === 'short' ? '30rem' : '20rem') : '0' }}
                >
                    {showRightSidebar ? <ChevronDoubleRight className="w-3 h-3" /> : <ChevronDoubleLeft className="w-3 h-3" />}
                </button>

                <aside className={`flex-shrink-0 bg-white dark:bg-black border-r border-gray-200 dark:border-gray-800 flex flex-col overflow-hidden transition-all duration-300 ease-in-out ${showLeftSidebar ? 'w-80 translate-x-0' : 'w-0 -translate-x-full opacity-0'}`}>
                    <div className="flex flex-col h-full w-80">
                        <div className="flex flex-col border-b border-gray-200 dark:border-gray-800">
                            <button onClick={() => setOpenModule(openModule === 'settings' ? 'chapters' : 'settings')} className="flex items-center justify-between p-4 w-full text-left hover:bg-gray-50 dark:hover:bg-gray-900">
                                <div className="flex items-center gap-2 font-bold text-gray-800 dark:text-white">
                                    作品设定
                                </div>
                                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${openModule === 'settings' ? 'rotate-180' : ''}`} />
                            </button>
                            {openModule === 'settings' && (
                                <div className="overflow-y-auto max-h-[60vh]">
                                    <NovelSettingsPanel settings={novel.settings} onUpdate={handleSettingsUpdate} />
                                </div>
                            )}
                        </div>
                        <div className="flex flex-col flex-1 overflow-hidden">
                            <button onClick={() => setOpenModule(openModule === 'chapters' ? 'settings' : 'chapters')} className="flex items-center justify-between p-4 w-full text-left hover:bg-gray-50 dark:hover:bg-gray-900 flex-shrink-0">
                                <div className="flex items-center gap-2 font-bold text-gray-800 dark:text-white">
                                    {mode === 'short' ? '篇章管理' : '章节管理'}
                                </div>
                                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${openModule === 'chapters' ? 'rotate-180' : ''}`} />
                            </button>
                            {openModule === 'chapters' && (
                                <ChapterManager 
                                    chapters={novel.chapters} 
                                    activeChapterId={activeChapter?.id || null}
                                    onSelectChapter={setActiveChapter}
                                    onDeleteChapter={handleDeleteChapter}
                                    onCreateChapter={handleCreateChapter}
                                />
                            )}
                        </div>
                    </div>
                </aside>

                <main className="flex-1 flex flex-col p-4 sm:p-6 overflow-y-auto bg-gray-100 dark:bg-gray-900/50 transition-all duration-300">
                    <div className="relative flex-1 flex flex-col bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 max-w-4xl mx-auto w-full overflow-hidden">
                        {activeChapter ? (
                            <>
                                <div className="pt-6 px-8 flex-shrink-0">
                                     <WritingToolbar onAction={handleToolbarAction} alignment={alignment} />
                                </div>
                                <input
                                    type="text"
                                    value={chapterTitle}
                                    onChange={handleTitleChange}
                                    placeholder={mode === 'short' ? "在此输入标题" : "在此输入章节标题"}
                                    className="w-full px-8 py-2 text-3xl font-bold bg-transparent focus:outline-none border-none text-gray-900 dark:text-white placeholder-gray-300 dark:placeholder-gray-700 flex-shrink-0"
                                />
                                <div className="px-8 pb-4 border-b border-gray-100 dark:border-gray-800 mb-2 flex-shrink-0">
                                    <span className="text-xs text-gray-400 font-mono">
                                        {new Date().toLocaleDateString()} • <span className="text-sky-500 font-semibold">{wordCount}</span> 字
                                    </span>
                                </div>
                                <textarea
                                    ref={textareaRef}
                                    value={editorContent}
                                    onChange={handleContentChange}
                                    onSelect={handleSelect}
                                    onClick={handleSelect}
                                    onKeyUp={handleSelect}
                                    placeholder="开始你的创作..."
                                    className={`flex-1 w-full px-8 py-4 bg-transparent focus:outline-none resize-none text-lg leading-relaxed text-gray-800 dark:text-gray-200 placeholder-gray-300 dark:placeholder-gray-700 text-${alignment}`}
                                />
                                <footer className="flex-shrink-0 p-3 border-t border-gray-200 dark:border-gray-800 text-xs text-gray-400 flex justify-between items-center bg-gray-50 dark:bg-gray-900/50 rounded-b-lg">
                                    <div className="flex gap-4">
                                        <span className="flex items-center gap-2">
                                            {saveStatus === 'saving' && <span className="text-sky-500 animate-pulse">正在保存...</span>}
                                            {saveStatus === 'saved' && <span className="text-green-500 flex items-center gap-1"><Check className="w-3 h-3" /> 已实时保存</span>}
                                            {saveStatus === 'error' && <span className="text-red-500">保存失败</span>}
                                            {saveStatus === 'unsaved' && <span className="text-gray-400">未保存</span>}
                                        </span>
                                    </div>
                                    <div className="flex gap-4"><span>字数: {wordCount}</span></div>
                                </footer>
                            </>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                                <BookOpen className="w-16 h-16 mb-4 opacity-20" />
                                <p>请在左侧选择或新建一个{mode === 'short' ? '篇章' : '章节'}开始写作</p>
                            </div>
                        )}
                    </div>
                </main>
                
                <aside className={`flex-shrink-0 bg-white dark:bg-black border-l border-gray-200 dark:border-gray-800 overflow-hidden transition-all duration-300 ease-in-out ${showRightSidebar ? `${rightSidebarWidthClass} translate-x-0` : 'w-0 translate-x-full opacity-0'}`}>
                    <div className={`flex flex-col h-full ${rightSidebarWidthClass}`}>
                        <div className="flex-1 overflow-y-auto">
                            {mode === 'short' ? (
                                <ShortStoryAIPanel contextText={editorContent} selectedText={selectedText} onInsert={handleAIInsert} onReplace={handleAIReplace} />
                            ) : (
                                <AIFunctionPanel contextText={editorContent} selectedText={selectedText} onInsert={handleAIInsert} onReplace={handleAIReplace} />
                            )}
                        </div>
                    </div>
                </aside>
            </div>
        </div>
    );
};

export default NovelWritingPage;
