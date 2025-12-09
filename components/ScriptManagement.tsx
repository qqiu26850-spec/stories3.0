
import React, { useState, useMemo, useEffect } from 'react';
import { Script, Scene } from '../types';
import CreateProjectModal from './CreateProjectModal';
import DeleteConfirmationModal from './DeleteConfirmationModal';
import ProjectCard from './ProjectCard';
import { Film, BookOpen, DocumentPlus } from './Icon';
import ScriptWritingPage from './writing/ScriptWritingPage';
import { createProject, fetchProjects, deleteProject, uploadCoverImage } from '../services/supabaseService';

type ScriptType = 'original' | 'adaptation';
type ViewState = 'selection' | 'list';

const ScriptManagement: React.FC = () => {
    const [scripts, setScripts] = useState<Script[]>([]);
    const [view, setView] = useState<ViewState>('selection');
    const [scriptType, setScriptType] = useState<ScriptType | null>(null);
    const [editingScript, setEditingScript] = useState<Script | null>(null);
    
    const [isCreateModalOpen, setCreateModalOpen] = useState(false);
    const [isDeleteModalOpen, setDeleteModalOpen] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<Script | null>(null);
    const [isCreating, setIsCreating] = useState(false);

    // Fetch projects on mount or when closing editor
    useEffect(() => {
        const loadScripts = async () => {
            try {
                const data = await fetchProjects();
                if (data) {
                    const filtered = data.filter((p: any) => p.type === 'script');
                    
                    const mappedScripts: Script[] = filtered.map((p: any) => ({
                        id: p.id,
                        title: p.title,
                        coverImage: p.cover_image || null,
                        wordCount: p.word_count || 0, // Real-time word count from DB
                        type: p.description?.includes('Adaptation') ? 'adaptation' : 'original', // Simple heuristic or store in DB
                        creationDate: p.created_at || new Date().toISOString(),
                        scenes: []
                    }));
                    setScripts(mappedScripts);
                }
            } catch (error) {
                console.error("Failed to load scripts", error);
            }
        };
        loadScripts();
    }, [editingScript]);

    const handleSelectType = (type: ScriptType) => {
        setScriptType(type);
        setView('list');
    };

    const handleCreateScript = async (title: string, coverFile: File | null) => {
        if (!scriptType) return;
        setIsCreating(true);
        
        try {
            let coverUrl: string | null = null;
            
            // 1. Upload cover if exists
            if (coverFile) {
                coverUrl = await uploadCoverImage(coverFile);
            }

            // 2. Call Supabase
            const description = scriptType === 'adaptation' ? "Adaptation Project" : "Original Script";
            const dbId = await createProject(title, description, 'script', coverUrl);

            const newScript: Script = {
                id: dbId || `script-${Date.now()}`,
                title,
                coverImage: coverUrl,
                wordCount: 0,
                type: scriptType,
                creationDate: new Date().toISOString(),
                scenes: [],
            };
            setScripts(prev => [newScript, ...prev]);
            setCreateModalOpen(false);
        } catch (e) {
            console.error("Error creating script", e);
            alert("创建失败，请重试");
        } finally {
            setIsCreating(false);
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
            setDeleteModalOpen(false);
            setItemToDelete(null);
        }
    };
    
    const handleSelectScript = (script: Script) => {
        setEditingScript(script);
    };

    // Filter logic updated to handle local state properly
    const filteredScripts = useMemo(() => {
        if (!scriptType) return scripts;
        return scripts; 
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
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
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
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">剧本改编</h2>
                            <p className="text-gray-500 dark:text-gray-400">基于小说或现有素材进行影视化改编。</p>
                             <span className="mt-6 text-purple-500 font-semibold opacity-0 group-hover:opacity-100 transition-opacity">点击开始 &rarr;</span>
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
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{scriptType === 'original' ? '原创剧本' : '剧本改编'}</h1>
                        <p className="text-gray-500 dark:text-gray-400 mt-1">管理你的剧本创作项目。</p>
                    </div>
                </div>
                {filteredScripts.length > 0 && (
                    <button
                        onClick={() => setCreateModalOpen(true)}
                        className="px-4 py-2 bg-sky-600 text-white font-semibold rounded-lg hover:bg-sky-500 transition-colors flex-shrink-0 self-start md:self-center shadow-sm"
                        disabled={isCreating}
                    >
                        {isCreating ? '创建中...' : '+ 新建剧本'}
                    </button>
                )}
            </div>
            
            {/* Content */}
            <div className="flex-1 flex flex-col">
                 {filteredScripts.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 animate-fade-in">
                        {filteredScripts.map(script => (
                           <ProjectCard 
                            key={script.id} 
                            project={script} 
                            onDelete={handleOpenDeleteModal}
                            onSelect={() => handleSelectScript(script)}
                           />
                        ))}
                    </div>
                ) : (
                    <div className="flex-1 flex items-center justify-center animate-fade-in">
                        <div className="text-center max-w-md p-10 bg-white dark:bg-gray-900 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-800 flex flex-col items-center">
                            <div className="w-24 h-24 bg-sky-50 dark:bg-sky-900/20 rounded-full flex items-center justify-center mb-6">
                                {scriptType === 'original' ? (
                                     <Film className="w-12 h-12 text-sky-500 dark:text-sky-400" />
                                ) : (
                                     <DocumentPlus className="w-12 h-12 text-sky-500 dark:text-sky-400" />
                                )}
                            </div>
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                                {scriptType === 'original' ? '创建你的第一个原创剧本' : '开始你的第一个剧本改编'}
                            </h2>
                            <p className="text-gray-500 dark:text-gray-400 mb-8 leading-relaxed">
                                {scriptType === 'original'
                                    ? '每一个伟大的电影都始于一个脚本。创建新项目，开始编写场景、动作和对白。'
                                    : '将优秀的文字转化为生动的影像。导入素材，开始你的改编创作。'
                                }
                            </p>
                            <button
                                onClick={() => setCreateModalOpen(true)}
                                className="px-8 py-3 bg-sky-600 text-white text-lg font-bold rounded-full hover:bg-sky-500 transition-all shadow-lg hover:shadow-sky-500/30 transform hover:-translate-y-1"
                                disabled={isCreating}
                            >
                                {isCreating ? '处理中...' : '新建剧本'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ScriptManagement;
