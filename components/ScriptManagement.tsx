
import React, { useState, useMemo, useEffect } from 'react';
import { Script, Scene } from '../types';
import CreateProjectModal from './CreateProjectModal';
import EditProjectModal from './EditProjectModal';
import DeleteConfirmationModal from './DeleteConfirmationModal';
import ProjectCard from './ProjectCard';
import { Film, BookOpen, DocumentPlus, Check, ArrowPath } from './Icon';
import ScriptWritingPage from './writing/ScriptWritingPage';
import { createProject, fetchProjects, deleteProject, updateProject } from '../services/supabaseService';

type ScriptType = 'original' | 'adaptation' | 'original_adaptation';
type ViewState = 'selection' | 'list';

interface ScriptManagementProps {
    isActive?: boolean;
}

const ScriptManagement: React.FC<ScriptManagementProps> = ({ isActive = false }) => {
    const [scripts, setScripts] = useState<Script[]>([]);
    const [view, setView] = useState<ViewState>('selection');
    const [scriptType, setScriptType] = useState<ScriptType | null>(null);
    const [editingScript, setEditingScript] = useState<Script | null>(null);
    
    // Modals
    const [isCreateModalOpen, setCreateModalOpen] = useState(false);
    const [isEditModalOpen, setEditModalOpen] = useState(false);
    const [isDeleteModalOpen, setDeleteModalOpen] = useState(false);
    
    const [itemToDelete, setItemToDelete] = useState<Script | null>(null);
    const [itemToEdit, setItemToEdit] = useState<Script | null>(null);
    
    const [isProcessing, setIsProcessing] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');

    // Pagination
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);

    const fetchAndMapScripts = async (pageNum: number) => {
        const data = await fetchProjects(pageNum);
        if (data) {
            // Filter by specific script types or the generic 'script' for legacy support
            const filtered = data.filter((p: any) => 
                p.type === 'script' || p.type === 'script_original' || p.type === 'script_adaptation' || p.type === 'script_original_adaptation'
            );
            const mappedScripts: Script[] = filtered.map((p: any) => ({
                id: p.id,
                title: p.title,
                coverImage: null, 
                wordCount: p.word_count || 0,
                // Determine type based on DB type or fallback logic
                type: p.type === 'script_adaptation' ? 'adaptation' : (p.type === 'script_original_adaptation' ? 'original_adaptation' : 'original'), 
                creationDate: p.created_at || new Date().toISOString(),
                scenes: [],
                scriptData: p.script_data || undefined 
            }));
            return mappedScripts;
        }
        return [];
    };

    // Fetch projects on mount, when closing editor, or when active
    useEffect(() => {
        if (!isActive) return;
        setPage(1);
        setHasMore(true);
        const loadScripts = async () => {
            try {
                const mappedScripts = await fetchAndMapScripts(1);
                setScripts(mappedScripts);
                if (mappedScripts.length < 20) setHasMore(false);
            } catch (error) {
                console.error("Failed to load scripts", error);
            }
        };
        loadScripts();
    }, [editingScript, isActive]);

    const handleLoadMore = async () => {
        if (!hasMore || isLoadingMore) return;
        setIsLoadingMore(true);
        const nextPage = page + 1;
        try {
            const mappedScripts = await fetchAndMapScripts(nextPage);
            if (mappedScripts.length > 0) {
                setScripts(prev => [...prev, ...mappedScripts]);
                setPage(nextPage);
                if (mappedScripts.length < 20) setHasMore(false);
            } else {
                setHasMore(false);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoadingMore(false);
        }
    };

    const handleSelectType = (type: ScriptType) => {
        setScriptType(type);
        setView('list');
    };

    const handleCreateScript = async (title: string) => {
        if (!scriptType) return;
        setIsProcessing(true);
        
        try {
            // Explicitly set dbType to separate storage
            let dbType = 'script_original';
            let description = 'Original Script';
            if (scriptType === 'adaptation') {
                dbType = 'script_adaptation';
                description = 'Novel Adaptation';
            } else if (scriptType === 'original_adaptation') {
                dbType = 'script_original_adaptation';
                description = 'Original Script Adaptation';
            }
            
            // @ts-ignore - passing specific string type
            const { id: dbId, error } = await createProject(title, description, dbType, null);

            if (error) {
                throw error;
            }

            const newScript: Script = {
                id: dbId || `script-${Date.now()}`,
                title,
                coverImage: null,
                wordCount: 0,
                type: scriptType,
                creationDate: new Date().toISOString(),
                scenes: [],
            };
            setScripts(prev => [newScript, ...prev]);
            setSuccessMessage('剧本创建成功');
            setCreateModalOpen(false);
            setTimeout(() => setSuccessMessage(''), 2500);
        } catch (e) {
            console.error("Error creating script", e);
            alert("创建失败，请重试");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleUpdateScript = async (id: string, newTitle: string) => {
        setIsProcessing(true);
        try {
            await updateProject(id, { 
                title: newTitle
            });

            setScripts(prev => prev.map(s => 
                s.id === id 
                ? { ...s, title: newTitle } 
                : s
            ));

            setSuccessMessage('剧本更新成功');
            setEditModalOpen(false);
            setItemToEdit(null);
            setTimeout(() => setSuccessMessage(''), 2500);
        } catch (e) {
            console.error("Failed to update script", e);
            alert("更新失败，请重试");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleOpenDeleteModal = (id: string) => {
        const script = scripts.find(s => s.id === id);
        if (script) {
            setItemToDelete(script);
            setDeleteModalOpen(true);
        }
    };

    const handleConfirmDelete = async () => {
        if (itemToDelete) {
            await deleteProject(itemToDelete.id);
            setScripts(prev => prev.filter(s => s.id !== itemToDelete.id));
            setSuccessMessage('剧本删除成功');
            setDeleteModalOpen(false);
            setItemToDelete(null);
            setTimeout(() => setSuccessMessage(''), 2500);
        }
    };
    
    const handleOpenEditModal = (script: Script) => {
        setItemToEdit(script);
        setEditModalOpen(true);
    }

    const handleSelectScript = (script: Script) => {
        setEditingScript(script);
    };

    // Filter logic updated to handle local state properly
    const filteredScripts = useMemo(() => {
        if (!scriptType) return scripts;
        return scripts.filter(s => s.type === scriptType); 
    }, [scripts, scriptType]);

    if (editingScript) {
        return <ScriptWritingPage script={editingScript} onBack={() => setEditingScript(null)} />;
    }

    if (view === 'selection') {
        return (
            <div className="p-4 sm:p-6 lg:p-8 h-full flex flex-col justify-center items-center animate-fade-in">
                <div className="max-w-4xl w-full">
                    <div className="text-center mb-12">
                        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">剧本创作中心</h1>
                        <p className="text-xl text-gray-500 dark:text-gray-400">请选择您的创作类型，开启一段光影之旅。</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <button onClick={() => handleSelectType('original')} className="group relative p-10 bg-white dark:bg-gray-900 rounded-2xl border-2 border-gray-100 dark:border-gray-800 hover:border-sky-500 dark:hover:border-sky-500 transition-all duration-300 hover:shadow-xl text-center flex flex-col items-center">
                            <div className="w-24 h-24 bg-sky-50 dark:bg-sky-900/20 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                                <Film className="w-12 h-12 text-sky-500 dark:text-sky-400" />
                            </div>
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">原创剧本</h2>
                            <p className="text-gray-500 dark:text-gray-400">从零开始构建全新的故事世界、人物与对白。</p>
                            <span className="mt-6 text-sky-500 font-semibold opacity-0 group-hover:opacity-100 transition-opacity">点击开始 &rarr;</span>
                        </button>
                        
                        <button onClick={() => handleSelectType('adaptation')} className="group relative p-10 bg-white dark:bg-gray-900 rounded-2xl border-2 border-gray-100 dark:border-gray-800 hover:border-purple-500 dark:hover:border-purple-500 transition-all duration-300 hover:shadow-xl text-center flex flex-col items-center">
                            <div className="w-24 h-24 bg-purple-50 dark:bg-purple-900/20 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                                <BookOpen className="w-12 h-12 text-purple-500 dark:text-purple-400" />
                            </div>
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">小说改编剧本</h2>
                            <p className="text-gray-500 dark:text-gray-400">基于小说或现有素材进行影视化改编。</p>
                             <span className="mt-6 text-purple-500 font-semibold opacity-0 group-hover:opacity-100 transition-opacity">点击开始 &rarr;</span>
                        </button>

                        <button onClick={() => handleSelectType('original_adaptation')} className="group relative p-10 bg-white dark:bg-gray-900 rounded-2xl border-2 border-gray-100 dark:border-gray-800 hover:border-emerald-500 dark:hover:border-emerald-500 transition-all duration-300 hover:shadow-xl text-center flex flex-col items-center">
                            <div className="w-24 h-24 bg-emerald-50 dark:bg-emerald-900/20 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                                <DocumentPlus className="w-12 h-12 text-emerald-500 dark:text-emerald-400" />
                            </div>
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">原创剧本改编</h2>
                            <p className="text-gray-500 dark:text-gray-400">对原始剧本进行结构重组与精细化二次创作。</p>
                             <span className="mt-6 text-emerald-500 font-semibold opacity-0 group-hover:opacity-100 transition-opacity">点击开始 &rarr;</span>
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="p-4 sm:p-6 lg:p-8 h-full flex flex-col">
            <CreateProjectModal
                isOpen={isCreateModalOpen}
                onClose={() => setCreateModalOpen(false)}
                onSave={handleCreateScript}
                projectType="script"
            />
            <EditProjectModal
                isOpen={isEditModalOpen}
                onClose={() => { setEditModalOpen(false); setItemToEdit(null); }}
                onSave={handleUpdateScript}
                project={itemToEdit}
            />
            <DeleteConfirmationModal
                isOpen={isDeleteModalOpen}
                onClose={() => setDeleteModalOpen(false)}
                onConfirm={handleConfirmDelete}
            />
            
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6 animate-fade-in">
                <div className='flex items-center gap-4'>
                        <button onClick={() => { setView('selection'); setScriptType(null); }} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors" title="返回类型选择">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" /></svg>
                    </button>
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                            {scriptType === 'original' ? '原创剧本' : scriptType === 'adaptation' ? '小说改编剧本' : '原创剧本改编'}
                        </h1>
                        <p className="text-gray-500 dark:text-gray-400 mt-1">管理你的剧本创作项目。</p>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    {successMessage && (
                        <div className="px-4 py-2 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 rounded-lg text-sm font-bold animate-pulse shadow-sm flex items-center gap-2">
                            <Check className="w-4 h-4" />
                            {successMessage}
                        </div>
                    )}
                    {(filteredScripts.length > 0 || isActive) && (
                        <button
                            onClick={() => setCreateModalOpen(true)}
                            className="px-4 py-2 bg-sky-600 text-white font-semibold rounded-lg hover:bg-sky-500 transition-colors flex-shrink-0 shadow-sm"
                            disabled={isProcessing}
                        >
                            {isProcessing ? '创建中...' : '+ 新建剧本'}
                        </button>
                    )}
                </div>
            </div>
            
            {/* Content */}
            <div className="flex-1 overflow-y-auto pr-2 -mr-2">
                 {filteredScripts.length > 0 ? (
                    <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 animate-fade-in pb-10">
                            {filteredScripts.map(script => (
                            <ProjectCard 
                                key={script.id} 
                                project={script} 
                                onDelete={handleOpenDeleteModal}
                                onEdit={handleOpenEditModal}
                                onSelect={() => handleSelectScript(script)}
                            />
                            ))}
                        </div>
                        {hasMore && (
                            <div className="py-4 text-center">
                                <button 
                                    onClick={handleLoadMore} 
                                    disabled={isLoadingMore}
                                    className="px-6 py-2 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-full text-sm font-bold hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors flex items-center justify-center gap-2 mx-auto disabled:opacity-50"
                                >
                                    {isLoadingMore ? <ArrowPath className="w-4 h-4 animate-spin" /> : '加载更多'}
                                </button>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="flex-1 flex items-center justify-center animate-fade-in h-full">
                        <div className="text-center max-w-md p-10 bg-white dark:bg-gray-900 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-800 flex flex-col items-center">
                            <div className="w-24 h-24 bg-sky-50 dark:bg-sky-900/20 rounded-full flex items-center justify-center mb-6">
                                {scriptType === 'original' ? (
                                     <Film className="w-12 h-12 text-sky-500 dark:text-sky-400" />
                                ) : (
                                     <DocumentPlus className="w-12 h-12 text-sky-500 dark:text-sky-400" />
                                )}
                            </div>
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                                {scriptType === 'original' ? '创建你的第一个原创剧本' : scriptType === 'adaptation' ? '开始你的第一个小说改编剧本' : '开始你的第一个原创剧本改编'}
                            </h2>
                            <p className="text-gray-500 dark:text-gray-400 mb-8 leading-relaxed">
                                {scriptType === 'original'
                                    ? '每一个伟大的电影都始于一个脚本。创建新项目，开始编写场景、动作和对白。'
                                    : scriptType === 'adaptation' ? '将优秀的文字转化为生动的影像。导入素材，开始你的改编创作。' : '对现有剧本进行精雕细琢。上传原稿，开启重塑之旅。'
                                }
                            </p>
                            <button
                                onClick={() => setCreateModalOpen(true)}
                                className="px-8 py-3 bg-sky-600 text-white text-lg font-bold rounded-full hover:bg-sky-500 transition-all shadow-lg hover:shadow-sky-500/30 transform hover:-translate-y-1"
                                disabled={isProcessing}
                            >
                                {isProcessing ? '处理中...' : '新建剧本'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ScriptManagement;
