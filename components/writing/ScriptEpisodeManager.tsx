
import React, { useState, useMemo } from 'react';
import { Scene } from '../../types';
import { Trash } from '../Icon';
import DeleteConfirmationModal from '../DeleteConfirmationModal';

interface ScriptEpisodeManagerProps {
    episodes: Scene[];
    activeEpisodeId: string | null;
    onSelectEpisode: (episode: Scene) => void;
    onDeleteEpisode: (episodeId: string) => void;
    onCreateEpisode: () => void;
}

type SortOrder = 'asc' | 'desc';

const ScriptEpisodeManager: React.FC<ScriptEpisodeManagerProps> = ({ 
    episodes, 
    activeEpisodeId, 
    onSelectEpisode, 
    onDeleteEpisode,
    onCreateEpisode
}) => {
    const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
    const [episodeToDelete, setEpisodeToDelete] = useState<string | null>(null);

    const sortedEpisodes = useMemo(() => {
        const sorted = [...episodes];
        if (sortOrder === 'desc') {
            sorted.reverse();
        }
        return sorted;
    }, [episodes, sortOrder]);

    return (
        <div className="flex flex-col h-full bg-white dark:bg-black border-r border-gray-200 dark:border-gray-800 w-full">
            <DeleteConfirmationModal 
                isOpen={!!episodeToDelete}
                onClose={() => setEpisodeToDelete(null)}
                onConfirm={() => {
                    if (episodeToDelete) {
                        onDeleteEpisode(episodeToDelete);
                        setEpisodeToDelete(null);
                    }
                }}
            />
            
            <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-gray-900/30">
                <span className="font-bold text-gray-700 dark:text-gray-200">剧本集数</span>
                <div className="flex space-x-1">
                    <button 
                        onClick={() => setSortOrder('asc')}
                        className={`text-xs px-2 py-1 rounded ${sortOrder === 'asc' ? 'bg-sky-100 text-sky-600' : 'text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-800'}`}
                    >
                        正序
                    </button>
                    <button 
                        onClick={() => setSortOrder('desc')}
                        className={`text-xs px-2 py-1 rounded ${sortOrder === 'desc' ? 'bg-sky-100 text-sky-600' : 'text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-800'}`}
                    >
                        倒序
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {sortedEpisodes.map((episode, index) => (
                    <div 
                        key={episode.id}
                        className={`group flex items-center justify-between w-full p-3 rounded-md transition-colors cursor-pointer ${
                            activeEpisodeId === episode.id
                                ? 'bg-sky-500 text-white font-semibold shadow-md'
                                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                        }`}
                        onClick={() => onSelectEpisode(episode)}
                    >
                        <div className="truncate flex-1 mr-2 flex items-center">
                            <span className={`mr-2 opacity-70 text-xs font-mono w-6 ${activeEpisodeId === episode.id ? 'text-sky-100' : 'text-gray-400'}`}>
                                {sortOrder === 'asc' ? index + 1 : episodes.length - index}
                            </span>
                            <span className="truncate">{episode.title || `第 ${index + 1} 集`}</span>
                        </div>
                        
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setEpisodeToDelete(episode.id);
                            }}
                            className={`p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity ${
                                activeEpisodeId === episode.id 
                                    ? 'hover:bg-sky-600 text-sky-100' 
                                    : 'hover:bg-red-100 text-gray-400 hover:text-red-500 dark:hover:bg-red-900/30'
                            }`}
                            title="删除"
                        >
                            <Trash className="w-4 h-4" />
                        </button>
                    </div>
                ))}
                {episodes.length === 0 && (
                    <div className="text-center py-8 text-gray-400 text-sm">
                        暂无集数，请新建
                    </div>
                )}
            </div>

            <div className="p-4 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-black">
                <button 
                    onClick={onCreateEpisode}
                    className="w-full py-2.5 bg-white dark:bg-gray-900 text-sky-600 dark:text-sky-400 font-semibold rounded-lg hover:bg-sky-50 dark:hover:bg-gray-800 border border-dashed border-sky-300 dark:border-gray-700 transition-all shadow-sm hover:shadow text-sm flex items-center justify-center gap-2"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                        <path fillRule="evenodd" d="M12 3.75a.75.75 0 0 1 .75.75v6.75h6.75a.75.75 0 0 1 0 1.5h-6.75v6.75a.75.75 0 0 1-1.5 0v-6.75H4.5a.75.75 0 0 1 0-1.5h6.75V4.5a.75.75 0 0 1 .75-.75Z" clipRule="evenodd" />
                    </svg>
                    新建集数
                </button>
            </div>
        </div>
    );
};

export default ScriptEpisodeManager;
