
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Novel, Chapter, NovelSettings } from '../../types';
import { BookSolid, BookOpen, Pencil, ChevronDoubleLeft, ArrowPath, Check, Sparkles, ChevronLeft, ChevronRight } from '../Icon';
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
    
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [selectionRange, setSelectionRange] = useState<{start: number, end: number}>({ start: 0, end: 0 });
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [tempTitle, setTempTitle] = useState(novel.title);
    const [openModule, setOpenModule] = useState<SidebarModule>('chapters');
    const [alignment, setAlignment] = useState<'left' | 'center' | 'right'>('left');
    
    const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
    
    // Sidebar Visibility
    const [isLeftSidebarOpen, setLeftSidebarOpen] = useState(true);
    const [isRightSidebarOpen, setRightSidebarOpen] = useState(true);
    
    // For AI Streaming
    const insertionRef = useRef<{start: number, end: number} | null>(null);

    // Parse settings from description if needed on init
    useEffect(() => {
        if ((!novel.settings.synopsis && !novel.settings.theme) && (novel as any).description) {
            try {
                const parsedSettings = JSON.parse((novel as any).description);
                if (typeof parsedSettings === 'object') {
                    setNovel(prev => ({ ...prev, settings: { ...prev.settings, ...parsedSettings } }));
                }
            } catch (e) {
                setNovel(prev => ({ ...prev, settings: { ...prev.settings, synopsis: (novel as any).description } }));
            }
        }
    }, []);

    // Load chapters
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

    const updateEditorState = useCallback((content: string) => {
        setEditorContent(content);
        const count = content.replace(/\s/g, '').length;
        setWordCount(count);
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
        }
    }, []);

    useEffect(() => {
        if (activeChapter) {
            setChapterTitle(activeChapter.title);
            updateEditorState(activeChapter.content);
            setSaveStatus('saved');
        } else {
            setChapterTitle('');
            updateEditorState('');
        }
    }, [activeChapter, updateEditorState]);

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
                    wordCount: editorContent.length,
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

    // Auto-Save Chapter
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

    const handleSettingsUpdate = (key: keyof NovelSettings, value: string) => {
        setNovel(prev => {
            const newSettings = { ...prev.settings, [key]: value };
            const newState = { ...prev, settings: newSettings };
            if (prev.id && !prev.id.startsWith('novel-')) {
                clearTimeout((window as any)._settingsSaveTimer);
                (window as any)._settingsSaveTimer = setTimeout(() => {
                    updateProject(prev.id, { description: JSON.stringify(newSettings) });
                }, 1000);
            }
            return newState;
        });
    };

    const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        updateEditorState(e.target.value);
        setSelectionRange({ start: e.target.selectionStart, end: e.target.selectionEnd });
    };
    
    const handleSelect = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
        const target = e.target as HTMLTextAreaElement;
        setSelectionRange({ start: target.selectionStart, end: target.selectionEnd });
    }

    const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        if (val.length <= 15) {
            setChapterTitle(val);
        }
    };

    const handleSaveTitle = async () => {
        if (tempTitle.trim()) {
            setNovel(prev => ({ ...prev, title: tempTitle }));
            await updateProject(novel.id, { title: tempTitle });
        } else {
            setTempTitle(novel.title);
        }
        setIsEditingTitle(false);
    };

    const handleCreateChapter = () => {
        const newChapter: Chapter = {
            id: `ch-${Date.now()}`,
            title: `第 ${novel.chapters.length + 1} 章：`,
            content: '',
            wordCount: 0,
            lastModified: new Date().toISOString()
        };
        setNovel(prev => ({ ...prev, chapters: [...prev.chapters, newChapter] }));
        setActiveChapter(newChapter);
    };

    const handleDeleteChapter = async (id: string) => {
        await deleteChapterFromDB(id);
        const newChapters = novel.chapters.filter(c => c.id !== id);
        setNovel(prev => ({ ...prev, chapters: newChapters }));
        if (activeChapter?.id === id) {
            setActiveChapter(newChapters.length > 0 ? newChapters[0] : null);
        }
    };

    const handleInsertText = (text: string) => {
        const start = selectionRange.start;
        const end = selectionRange.end;
        const newContent = editorContent.substring(0, start) + text + editorContent.substring(end);
        updateEditorState(newContent);
    };

    const handleReplaceText = (text: string) => {
        const start = selectionRange.start;
        const end = selectionRange.end;
        if (start === end) return; // No selection
        const newContent = editorContent.substring(0, start) + text + editorContent.substring(end);
        updateEditorState(newContent);
    };
    
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
            // Update word count
            const count = nextContent.replace(/\s/g, '').length;
            setWordCount(count);
            // Auto-resize
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
        if (action === 'indent-add') {
             // Simple indent logic for start of paragraphs
             newContent = value.substring(0, start) + '    ' + value.substring(start, end) + value.substring(end);
        }
        
        if (action.startsWith('align-')) {
            setAlignment(action.replace('align-', '') as any);
        }

        if (newContent !== value) {
            updateEditorState(newContent);
        }
    };

    return (
        <div className="flex flex-col h-full bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 overflow-hidden">
            <header className="flex-shrink-0 bg-white dark:bg-black flex border-b border-gray-200 dark:border-gray-800 z-20 shadow-sm">
                <div className="w-64 flex-shrink-0 flex items-center gap-3 p-4 border-r border-gray-200 dark:border-gray-800">
                    <BookSolid className="w-8 h-8 text-sky-500" />
                    <div className="flex-1 overflow-hidden">
                        <span className="font-bold text-lg tracking-wider text-gray-900 dark:text-white truncate block">
                            {mode === 'long' ? '长篇小说' : '短篇故事'}
                        </span>
                        <span className="text-xs text-gray-500 truncate block">{pageTitle}</span>
                    </div>
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
                                {novel.title}
                            </h1>
                            <Pencil className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                    )}
                </div>
                
                <div className="w-[29%] flex-shrink-0 flex items-center justify-end p-4 border-l border-gray-200 dark:border-gray-800 gap-3">
                    <div className="flex items-center gap-2 mr-2">
                        {saveStatus === 'saving' && <span className="text-xs text-sky-500 font-medium animate-pulse">保存中...</span>}
                        {saveStatus === 'saved' && <span className="text-xs text-green-500 font-medium flex items-center gap-1"><Check className="w-3 h-3" /> 已保存</span>}
                        {saveStatus === 'error' && <span className="text-xs text-red-500 font-medium">保存失败</span>}
                        {saveStatus === 'unsaved' && <span className="text-xs text-gray-400">未保存</span>}
                    </div>
                    <button
                        onClick={() => handleSaveToCloud(false)}
                        className="px-3 py-2 text-sm font-bold text-sky-600 bg-sky-100 hover:bg-sky-200 dark:bg-sky-900/30 dark:text-sky-400 dark:hover:bg-sky-900/50 rounded-lg transition-colors flex items-center gap-1"
                        title="手动同步"
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
                    style={{ left: isLeftSidebarOpen ? '16rem' : '0' }}
                >
                    {isLeftSidebarOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>

                {/* Left Sidebar */}
                <aside 
                    className={`flex-shrink-0 flex flex-col bg-white dark:bg-black border-r border-gray-200 dark:border-gray-800 transition-all duration-300 overflow-hidden ${isLeftSidebarOpen ? 'w-64' : 'w-0 border-r-0'}`}
                >
                    <div className="flex border-b border-gray-200 dark:border-gray-800 min-w-[16rem]">
                        <button 
                            className={`flex-1 py-3 text-sm font-medium transition-colors ${openModule === 'chapters' ? 'text-sky-600 border-b-2 border-sky-600 bg-sky-50 dark:bg-sky-900/10' : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white'}`}
                            onClick={() => setOpenModule('chapters')}
                        >
                            目录
                        </button>
                        <button 
                            className={`flex-1 py-3 text-sm font-medium transition-colors ${openModule === 'settings' ? 'text-sky-600 border-b-2 border-sky-600 bg-sky-50 dark:bg-sky-900/10' : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white'}`}
                            onClick={() => setOpenModule('settings')}
                        >
                            设定
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto min-w-[16rem]">
                        {openModule === 'chapters' ? (
                            <ChapterManager 
                                chapters={novel.chapters}
                                activeChapterId={activeChapter?.id || null}
                                onSelectChapter={setActiveChapter}
                                onDeleteChapter={handleDeleteChapter}
                                onCreateChapter={handleCreateChapter}
                            />
                        ) : (
                            <NovelSettingsPanel settings={novel.settings} onUpdate={handleSettingsUpdate} />
                        )}
                    </div>
                </aside>

                {/* Main Editor */}
                <main className="flex-1 bg-gray-100 dark:bg-gray-900/50 flex flex-col p-4 relative overflow-hidden transition-all duration-300">
                     <div className="flex-1 flex flex-col bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 w-full h-full overflow-hidden relative">
                        {activeChapter ? (
                            <>
                                {/* Fixed Toolbar */}
                                <div className="pt-4 px-8 pb-2 flex-shrink-0 bg-white dark:bg-gray-900 z-10">
                                     <WritingToolbar onAction={handleToolbarAction} alignment={alignment} />
                                </div>
                                
                                {/* Scrollable Area */}
                                <div className="flex-1 overflow-y-auto px-8 pb-12">
                                    <input
                                        type="text"
                                        value={chapterTitle}
                                        onChange={handleTitleChange}
                                        placeholder="输入章节标题..."
                                        className="w-full py-2 text-2xl font-bold bg-transparent focus:outline-none border-none text-gray-900 dark:text-white placeholder-gray-300 dark:placeholder-gray-700 block leading-tight"
                                    />
                                    <div className="h-4"></div>
                                    <textarea
                                        ref={textareaRef}
                                        value={editorContent}
                                        onChange={handleContentChange}
                                        onSelect={handleSelect}
                                        onClick={handleSelect}
                                        onKeyUp={handleSelect}
                                        placeholder="开始写作..."
                                        style={{ minHeight: '60vh', height: 'auto', textAlign: alignment }}
                                        onInput={(e) => {
                                            e.currentTarget.style.height = 'auto';
                                            e.currentTarget.style.height = e.currentTarget.scrollHeight + 'px';
                                        }}
                                        className="w-full bg-transparent focus:outline-none resize-none text-lg leading-relaxed text-gray-800 dark:text-gray-200 placeholder-gray-300 dark:placeholder-gray-700 font-serif overflow-hidden"
                                    />
                                </div>
                                
                                {/* Word Count - Bottom Right */}
                                <div className="absolute bottom-2 right-6 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm px-2 py-1 rounded text-xs text-gray-400 font-mono pointer-events-none border border-gray-100 dark:border-gray-800">
                                    <span className="text-sky-500 font-semibold">{wordCount}</span> 字
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

                {/* Right Sidebar Toggle - Floating Style */}
                <button
                    onClick={() => setRightSidebarOpen(!isRightSidebarOpen)}
                    className="absolute top-1/2 right-0 z-30 transform -translate-y-1/2 p-1 bg-white/80 dark:bg-black/50 hover:bg-white dark:hover:bg-black text-gray-400 hover:text-sky-500 rounded-l-lg shadow-sm border border-r-0 border-gray-200 dark:border-gray-800 transition-all backdrop-blur-sm"
                    style={{ right: isRightSidebarOpen ? '29%' : '0' }}
                >
                    {isRightSidebarOpen ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                </button>

                {/* Right AI Panel */}
                <aside 
                    className={`flex-shrink-0 bg-white dark:bg-black border-l border-gray-200 dark:border-gray-800 shadow-xl z-10 flex flex-col transition-all duration-300 overflow-hidden ${isRightSidebarOpen ? 'w-[29%]' : 'w-0 border-l-0'}`}
                >
                    <div className="flex-1 overflow-hidden min-w-[300px]">
                        {mode === 'long' ? (
                            <AIFunctionPanel 
                                contextText={editorContent}
                                selectedText={editorContent.substring(selectionRange.start, selectionRange.end)}
                                onInsert={handleInsertText}
                                onReplace={handleReplaceText}
                                onStream={handleAIStream}
                            />
                        ) : (
                            <ShortStoryAIPanel 
                                contextText={editorContent}
                                selectedText={editorContent.substring(selectionRange.start, selectionRange.end)}
                                onInsert={handleInsertText}
                                onReplace={handleReplaceText}
                                onStream={handleAIStream}
                            />
                        )}
                    </div>
                </aside>
            </div>
        </div>
    );
};

export default NovelWritingPage;
