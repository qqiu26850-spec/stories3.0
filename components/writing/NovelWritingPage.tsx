import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Novel, Chapter, NovelSettings } from '../../types';
import { BookSolid, BookOpen, Pencil, ChevronDoubleLeft, ArrowPath, Check, Sparkles, ChevronLeft, ChevronRight } from '../Icon';
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

    const handleCreateChapter = async () => {
        const newOrder = novel.chapters.length + 1;
        const tempId = `new-${Date.now()}`;
        const newTitle = `新章节 ${newOrder}`;
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
        if (isFirst) {
            editorRef.current.focus();
        }
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
        <div className="flex flex-col h-full bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 overflow-hidden relative">
            {showCopyToast && (
                <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[100] bg-gray-800/90 text-white px-6 py-2 rounded-full shadow-2xl backdrop-blur-sm animate-fade-in-up flex items-center gap-2 border border-gray-700">
                    <Check className="w-4 h-4 text-green-400" />
                    <span className="text-sm font-bold">已成功复制全文</span>
                </div>
            )}

            <header className="flex-shrink-0 bg-white dark:bg-black flex border-b border-gray-200 dark:border-gray-800 z-20 shadow-sm">
                <div className="w-64 flex-shrink-0 flex items-center gap-3 p-4 border-r border-gray-200 dark:border-gray-800">
                    <BookSolid className="w-8 h-8 text-sky-500" />
                    <div className="flex-1 overflow-hidden">
                        <span className="font-bold text-lg tracking-wider text-gray-900 dark:text-white truncate block">{mode === 'long' ? '长篇小说' : '短篇故事'}</span>
                        <span className="text-xs text-gray-500 truncate block">{pageTitle}</span>
                    </div>
                </div>
                
                <div className="flex-1 flex items-center justify-center p-2">
                    {isEditingTitle ? (
                        <input value={tempTitle} onChange={(e) => setTempTitle(e.target.value)} onBlur={() => { setNovel(p=>({...p, title: tempTitle})); updateProject(novel.id, {title: tempTitle}); setIsEditingTitle(false); }} autoFocus className="text-center text-lg font-bold bg-gray-50 dark:bg-gray-800 border border-sky-500 rounded px-4 py-2 focus:outline-none min-w-[200px]" />
                    ) : (
                        <div className="flex items-center gap-2 group cursor-pointer px-6 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-md transition-all" onClick={() => setIsEditingTitle(true)}>
                            <h1 className="font-bold text-lg text-gray-900 dark:text-white">{novel.title}</h1>
                            <Pencil className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100" />
                        </div>
                    )}
                </div>
                
                <div className="w-[29%] flex-shrink-0 flex items-center justify-end p-4 border-l border-gray-200 dark:border-gray-800 gap-3">
                    <div className="flex items-center gap-2 mr-2">
                        {saveStatus === 'saving' && <span className="text-xs text-sky-500 font-medium animate-pulse">保存中...</span>}
                        {saveStatus === 'saved' && <span className="text-xs text-green-500 font-medium flex items-center gap-1"><Check className="w-3 h-3" /> 已保存</span>}
                    </div>
                    <button onClick={handleSaveToCloud} className="px-3 py-2 text-sm font-bold text-sky-600 bg-sky-100 hover:bg-sky-200 rounded-lg flex items-center gap-1"><ArrowPath className="w-4 h-4" /> 同步</button>
                    <button onClick={onBack} className="px-4 py-2 text-sm font-bold text-white bg-sky-500 hover:bg-sky-600 rounded-lg shadow-sm">返回</button>
                </div>
            </header>

            <div className="flex-1 flex overflow-hidden relative">
                <aside className={`flex-shrink-0 flex flex-col bg-white dark:bg-black border-r border-gray-200 dark:border-gray-800 transition-all duration-300 overflow-hidden ${isLeftSidebarOpen ? 'w-64' : 'w-0'}`}>
                    <div className="flex border-b border-gray-200 dark:border-gray-800">
                        <button className={`flex-1 py-3 text-sm font-medium ${openModule === 'chapters' ? 'text-sky-600 border-b-2 border-sky-600 bg-sky-50' : 'text-gray-500'}`} onClick={() => setOpenModule('chapters')}>目录</button>
                        <button className={`flex-1 py-3 text-sm font-medium ${openModule === 'settings' ? 'text-sky-600 border-b-2 border-sky-600 bg-sky-50' : 'text-gray-500'}`} onClick={() => setOpenModule('settings')}>设定</button>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                        {openModule === 'chapters' ? <ChapterManager chapters={novel.chapters} activeChapterId={activeChapter?.id || null} onSelectChapter={setActiveChapter} onDeleteChapter={deleteChapterFromDB} onCreateChapter={handleCreateChapter} onReorderChapters={handleReorderChapters} /> : <NovelSettingsPanel settings={novel.settings} onUpdate={() => {}} />}
                    </div>
                </aside>

                <main className="flex-1 bg-gray-100 dark:bg-gray-900/50 flex flex-col p-4 relative overflow-hidden">
                     <div className="flex-1 flex flex-col bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 w-full h-full overflow-hidden relative">
                        {activeChapter ? (
                            <>
                                <div className="pt-4 px-8 pb-2 flex-shrink-0 bg-white dark:bg-gray-900 z-10">
                                     <WritingToolbar onAction={handleToolbarAction} alignment={alignment} />
                                </div>
                                <div className="flex-1 overflow-y-auto px-8 pb-12" ref={scrollContainerRef}>
                                    <input value={chapterTitle} onChange={(e) => setChapterTitle(e.target.value)} placeholder="输入章节标题..." className="w-full py-2 text-2xl font-bold bg-transparent focus:outline-none text-gray-900 dark:text-white mb-4" />
                                    <div 
                                        ref={editorRef}
                                        contentEditable 
                                        onInput={handleContentInput}
                                        className="w-full bg-transparent focus:outline-none text-lg leading-relaxed text-gray-800 dark:text-gray-200 font-serif min-h-[60vh] outline-none"
                                        style={{ textAlign: alignment }}
                                    ></div>
                                </div>
                                <div className="absolute bottom-2 right-6 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm px-2 py-1 rounded text-xs text-gray-400 font-mono border border-gray-100 dark:border-gray-800">
                                    <span className="text-sky-500 font-semibold">{wordCount}</span> 字
                                </div>
                            </>
                        ) : (
                            <div className="flex-1 flex items-center justify-center text-gray-400 flex-col"><BookOpen className="w-16 h-16 mb-4 opacity-20" /><p>请新建或选择一章开始创作</p></div>
                        )}
                     </div>
                </main>

                <aside className={`flex-shrink-0 bg-white dark:bg-black border-l border-gray-200 dark:border-gray-800 shadow-xl z-10 flex flex-col transition-all duration-300 overflow-hidden ${isRightSidebarOpen ? 'w-[29%]' : 'w-0'}`}>
                    <div className="flex-1 overflow-hidden min-w-[300px]">
                        {mode === 'long' ? (
                            <AIFunctionPanel contextText={editorRef.current?.innerText || ''} selectedText={window.getSelection()?.toString() || ''} onInsert={handleInsertText} onReplace={handleReplaceText} onStream={handleAIStream} />
                        ) : (
                            <ShortStoryAIPanel contextText={editorRef.current?.innerText || ''} selectedText={window.getSelection()?.toString() || ''} onInsert={handleInsertText} onReplace={handleReplaceText} onStream={handleAIStream} />
                        )}
                    </div>
                </aside>
            </div>
        </div>
    );
};

export default NovelWritingPage;