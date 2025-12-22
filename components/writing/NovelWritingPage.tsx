
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Novel, Chapter, NovelSettings } from '../../types';
import { BookSolid, BookOpen, Pencil, ChevronDoubleLeft, ArrowPath, Check, Sparkles, ChevronLeft, ChevronRight, PanelLeft, PanelRight } from '../Icon';
import NovelSettingsPanel from './NovelSettingsPanel';
import ChapterManager from './ChapterManager';
import AIFunctionPanel from './AIFunctionPanel';
import ShortStoryAIPanel from './ShortStoryAIPanel';
import WritingToolbar, { ToolbarAction } from './WritingToolbar';
import { saveChapterToDB, updateProject, fetchChapters, deleteChapterFromDB, updateChapterOrder } from '../../services/supabaseService';

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
    const [editorHTML, setEditorHTML] = useState('');
    const [wordCount, setWordCount] = useState(0);
    const [showCopyToast, setShowCopyToast] = useState(false);
    
    const editorRef = useRef<HTMLDivElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [tempTitle, setTempTitle] = useState(novel.title);
    const [openModule, setOpenModule] = useState<SidebarModule>('chapters');
    const [alignment, setAlignment] = useState<'left' | 'center' | 'right'>('left');
    const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
    
    const [isLeftSidebarOpen, setLeftSidebarOpen] = useState(true);
    const [isRightSidebarOpen, setRightSidebarOpen] = useState(true);

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
                if (mapped.length > 0 && !activeChapter) {
                    setActiveChapter(mapped[0]);
                }
             }
        };
        loadInitialChapters();
    }, [novel.id]);

    useEffect(() => {
        if (activeChapter) {
            setChapterTitle(activeChapter.title);
            const content = activeChapter.content || '';
            const html = content.split('\n').map(p => `<p>${p}</p>`).join('');
            setEditorHTML(html);
            if (editorRef.current) {
                editorRef.current.innerHTML = html;
            }
            updateWordCount(content);
            setSaveStatus('saved');
        }
    }, [activeChapter]);

    const updateWordCount = (text: string) => {
        const count = text.replace(/\s/g, '').length;
        setWordCount(count);
    };

    const handleSaveToCloud = async () => {
        if (activeChapter && editorRef.current) {
            const content = editorRef.current.innerText;
            const orderIndex = novel.chapters.findIndex(c => c.id === activeChapter.id) + 1;
            const newId = await saveChapterToDB(novel.id, activeChapter.id, chapterTitle, content, orderIndex);

            if (newId) {
                const updatedChapter = { 
                    ...activeChapter, 
                    id: newId, 
                    title: chapterTitle, 
                    content: content,
                    wordCount: content.length,
                    lastModified: new Date().toISOString()
                };
                setNovel(prev => ({
                    ...prev,
                    chapters: prev.chapters.map(c => c.id === activeChapter.id ? updatedChapter : c)
                }));
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
            // 将整个设定对象序列化后存入 description 或者单独的设定字段
            await updateProject(novel.id, { description: JSON.stringify(newSettings) });
            setSaveStatus('saved');
        } catch (e) {
            setSaveStatus('error');
        }
    };

    const handleCreateChapter = async () => {
        const newOrder = novel.chapters.length + 1;
        const tempId = `new-${Date.now()}`;
        const newTitle = `第${newOrder}章：`;
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

    useEffect(() => {
        if (!activeChapter) return;
        const timer = setTimeout(async () => {
            setSaveStatus('saving');
            await handleSaveToCloud();
        }, 2000);
        return () => clearTimeout(timer);
    }, [chapterTitle, editorHTML]);

    const handleContentInput = () => {
        if (editorRef.current) {
            setEditorHTML(editorRef.current.innerHTML);
            updateWordCount(editorRef.current.innerText);
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
        if (isFirst) { editorRef.current.focus(); }
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

    const handleReplaceText = (text: string) => {
        if (!editorRef.current) return;
        editorRef.current.focus();
        document.execCommand('insertHTML', false, text);
        handleContentInput();
    };

    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 overflow-hidden relative">
            {showCopyToast && (
                <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[100] bg-gray-800/90 text-white px-6 py-2 rounded-full shadow-2xl backdrop-blur-sm animate-fade-in-up flex items-center gap-2 border border-gray-700">
                    <Check className="w-4 h-4 text-green-400" />
                    <span className="text-sm font-bold">已成功复制全文</span>
                </div>
            )}

            <header className="flex-shrink-0 bg-white dark:bg-black flex border-b border-gray-200 dark:border-gray-800 z-20 shadow-sm h-16">
                <div className="w-64 flex-shrink-0 flex items-center gap-3 px-4 border-r border-gray-200 dark:border-gray-800">
                    <BookSolid className="w-8 h-8 text-sky-500" />
                    <div className="flex-1 overflow-hidden">
                        <span className="font-bold text-lg tracking-wider text-gray-900 dark:text-white truncate block">{mode === 'long' ? '长篇小说' : '短篇故事'}</span>
                        <span className="text-xs text-gray-500 truncate block">{pageTitle}</span>
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
                    <div className="flex p-2 gap-1 border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
                        <button onClick={() => setOpenModule('chapters')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${openModule === 'chapters' ? 'bg-sky-500 text-white shadow-md' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>章节列表</button>
                        <button onClick={() => setOpenModule('settings')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${openModule === 'settings' ? 'bg-sky-500 text-white shadow-md' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>作品设定</button>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        {openModule === 'chapters' ? (
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
                                    <input 
                                        value={chapterTitle} 
                                        onChange={(e) => setChapterTitle(e.target.value)} 
                                        placeholder="请输入章节标题..." 
                                        maxLength={15}
                                        className="w-full py-1 text-2xl font-bold bg-transparent focus:outline-none text-gray-900 dark:text-white mb-1.5" 
                                    />
                                    <div className="border-b border-gray-100 dark:border-gray-800 mb-6" />
                                    
                                    <div 
                                        ref={editorRef}
                                        contentEditable 
                                        onInput={handleContentInput}
                                        className="w-full bg-transparent focus:outline-none text-lg leading-relaxed text-gray-800 dark:text-gray-200 font-serif min-h-[75vh] outline-none pb-32"
                                        style={{ textAlign: alignment }}
                                    ></div>
                                </div>

                                <div className="absolute bottom-6 right-8 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm px-4 py-1.5 rounded-full text-xs text-gray-400 font-mono border border-gray-100 dark:border-gray-800 shadow-sm z-20">
                                    <span className="text-sky-500 font-black">{wordCount}</span> 字
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
                                contextText={editorRef.current?.innerText || ''} 
                                selectedText={window.getSelection()?.toString() || ''} 
                                onInsert={handleInsertText} 
                                onReplace={handleReplaceText} 
                                onStream={handleAIStream}
                                projectSettings={novel.settings}
                            />
                        ) : (
                            <AIFunctionPanel 
                                contextText={editorRef.current?.innerText || ''} 
                                selectedText={window.getSelection()?.toString() || ''} 
                                onInsert={handleInsertText} 
                                onReplace={handleReplaceText} 
                                onStream={handleAIStream}
                                projectSettings={novel.settings}
                            />
                        )}
                    </div>
                </aside>
            </div>
        </div>
    );
};

export default NovelWritingPage;
