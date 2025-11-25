import React, { useState, useMemo } from 'react';
import { Chapter } from '../../types';
import { Trash } from '../Icon';
import DeleteConfirmationModal from '../DeleteConfirmationModal';

interface ChapterManagerProps {
    chapters: Chapter[];
    activeChapterId: string | null;
    onSelectChapter: (chapter: Chapter) => void;
    onDeleteChapter: (chapterId: string) => void;
    onCreateChapter: () => void;
}

type SortOrder = 'asc' | 'desc';

const ChapterManager: React.FC<ChapterManagerProps> = ({ 
    chapters, 
    activeChapterId, 
    onSelectChapter, 
    onDeleteChapter,
    onCreateChapter
}) => {
    const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
    const [chapterToDelete, setChapterToDelete] = useState<string | null>(null);

    const sortedChapters = useMemo(() => {
        // Create a shallow copy to avoid mutating props
        const sorted = [...chapters];
        if (sortOrder === 'desc') {
            sorted.reverse();
        }
        return sorted;
    }, [chapters, sortOrder]);

    return (
        <div className="flex-1 flex flex-col animate-fade-in">
            <DeleteConfirmationModal 
                isOpen={!!chapterToDelete}
                onClose={() => setChapterToDelete(null)}
                onConfirm={() => {
                    if (chapterToDelete) {
                        onDeleteChapter(chapterToDelete);
                        setChapterToDelete(null);
                    }
                }}
            />
            
            {/* Toolbar */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/30">
                <span className="text-xs text-gray-500 font-medium">共 {chapters.length} 章</span>
                <div className="flex items-center space-x-2">
                    <button 
                        onClick={() => setSortOrder('asc')}
                        className={`text-xs px-2 py-1 rounded transition-colors ${sortOrder === 'asc' ? 'bg-sky-100 text-sky-600 dark:bg-sky-900 dark:text-sky-400' : 'text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-800'}`}
                        title="正序排列"
                    >
                        正序
                    </button>
                    <button 
                        onClick={() => setSortOrder('desc')}
                        className={`text-xs px-2 py-1 rounded transition-colors ${sortOrder === 'desc' ? 'bg-sky-100 text-sky-600 dark:bg-sky-900 dark:text-sky-400' : 'text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-800'}`}
                         title="倒序排列"
                    >
                        倒序
                    </button>
                </div>
            </div>

            {/* List */}
            <div className="p-2 space-y-1 overflow-y-auto flex-1 max-h-[60vh]">
                {sortedChapters.map((chapter, index) => (
                    <div 
                        key={chapter.id}
                        className={`group flex items-center justify-between w-full p-2 rounded-md transition-colors text-sm cursor-pointer ${
                            activeChapterId === chapter.id
                                ? 'bg-sky-500 text-white font-semibold shadow-md'
                                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                        }`}
                        onClick={() => onSelectChapter(chapter)}
                    >
                        <div className="truncate flex-1 mr-2">
                            <span className={`mr-2 opacity-70 text-xs ${activeChapterId === chapter.id ? 'text-sky-100' : 'text-gray-400'}`}>
                                {sortOrder === 'asc' ? index + 1 : chapters.length - index}.
                            </span>
                            {chapter.title || '未命名章节'}
                        </div>
                        
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setChapterToDelete(chapter.id);
                            }}
                            className={`p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity ${
                                activeChapterId === chapter.id 
                                    ? 'hover:bg-sky-600 text-sky-100' 
                                    : 'hover:bg-red-100 text-gray-400 hover:text-red-500 dark:hover:bg-red-900/30'
                            }`}
                            title="删除章节"
                        >
                            <Trash className="w-4 h-4" />
                        </button>
                    </div>
                ))}
                
                {chapters.length === 0 && (
                    <div className="text-center py-8 text-gray-400 text-xs">
                        暂无章节，点击下方按钮新建
                    </div>
                )}
            </div>

            <div className="p-4 border-t border-gray-200 dark:border-gray-800">
                <button 
                    onClick={onCreateChapter}
                    className="w-full py-2 bg-gray-100 dark:bg-gray-800 text-sky-600 dark:text-sky-400 font-semibold rounded-md hover:bg-sky-50 dark:hover:bg-gray-700 hover:text-sky-700 border border-dashed border-sky-200 dark:border-gray-700 transition-colors text-sm flex items-center justify-center gap-2"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                        <path fillRule="evenodd" d="M12 3.75a.75.75 0 0 1 .75.75v6.75h6.75a.75.75 0 0 1 0 1.5h-6.75v6.75a.75.75 0 0 1-1.5 0v-6.75H4.5a.75.75 0 0 1 0-1.5h6.75V4.5a.75.75 0 0 1 .75-.75Z" clipRule="evenodd" />
                    </svg>
                    添加新章节
                </button>
            </div>
        </div>
    );
};

export default ChapterManager;