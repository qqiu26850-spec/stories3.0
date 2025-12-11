
import React, { useState, useEffect } from 'react';
import { Novel } from '../types';
import CreateProjectModal from './CreateProjectModal';
import EditProjectModal from './EditProjectModal';
import DeleteConfirmationModal from './DeleteConfirmationModal';
import ProjectCard from './ProjectCard';
import NovelWritingPage from './writing/NovelWritingPage';
import { BookOpen, Sparkles } from './Icon';
import { createProject, fetchProjects, deleteProject, uploadCoverImage, updateProject } from '../services/supabaseService';

interface NovelManagementProps {
    mode?: 'long' | 'short';
}

const NovelManagement: React.FC<NovelManagementProps> = ({ mode = 'long' }) => {
    // Initialized with empty array, data will be fetched
    const [novels, setNovels] = useState<Novel[]>([]);
    
    // Writing State
    const [editingNovel, setEditingNovel] = useState<Novel | null>(null);
    
    // Modal States
    const [isCreateModalOpen, setCreateModalOpen] = useState(false);
    const [isEditModalOpen, setEditModalOpen] = useState(false);
    const [isDeleteModalOpen, setDeleteModalOpen] = useState(false);
    
    const [itemToDelete, setItemToDelete] = useState<Novel | null>(null);
    const [itemToEdit, setItemToEdit] = useState<Novel | null>(null);
    
    const [isProcessing, setIsProcessing] = useState(false); // For create/update loading

    const pageTitle = mode === 'long' ? '小说管理' : '短篇管理';
    const description = mode === 'long' ? '在这里开始、管理和发展你的长篇故事。' : '快速捕捉灵感，创作精彩的短篇故事。';
    const createButtonLabel = mode === 'long' ? '新建长篇小说' : '新建短篇故事';

    // Fetch projects on mount or mode change
    useEffect(() => {
        const loadProjects = async () => {
            try {
                const data = await fetchProjects();
                if (data) {
                    const targetType = mode === 'long' ? 'novel' : 'short_story';
                    // Filter by type
                    const filtered = data.filter((p: any) => p.type === targetType);
                    
                    const mappedNovels: Novel[] = filtered.map((p: any) => ({
                        id: p.id,
                        title: p.title,
                        coverImage: p.cover_image || null, // Map from DB column
                        wordCount: p.word_count || 0, // Use real-time word count from DB
                        creationDate: p.created_at || new Date().toISOString(),
                        settings: { 
                            typeElements: '', 
                            theme: '', 
                            targetAudience: '', 
                            synopsis: p.description || '', 
                            worldview: '', 
                            characterSettings: '' 
                        },
                        chapters: [] // Chapters are not fetched in list view
                    }));
                    setNovels(mappedNovels);
                }
            } catch (error) {
                console.error("Failed to load projects", error);
            }
        };
        loadProjects();
    }, [mode, editingNovel]); // Reload when closing editor to update word count

    const handleCreateNovel = async (title: string, coverFile: File | null) => {
        setIsProcessing(true);
        try {
            let coverUrl: string | null = null;
            
            // 1. Upload cover if exists
            if (coverFile) {
                coverUrl = await uploadCoverImage(coverFile);
            }

            // 2. Call Supabase to create project with coverUrl
            const type = mode === 'long' ? 'novel' : 'short_story';
            const { id: dbId, error } = await createProject(title, "Created via Web App", type, coverUrl);

            if (error) {
                alert(`创建失败: ${error.message || '未知错误'}`);
                return;
            }

            // Only update UI if DB insert was successful
            const newNovel: Novel = {
                id: dbId || `novel-${Date.now()}`,
                title,
                coverImage: coverUrl,
                wordCount: 0,
                creationDate: new Date().toISOString(),
                settings: { typeElements: '', theme: '', targetAudience: '', synopsis: '', worldview: '', characterSettings: '' },
                chapters: [{id: 'ch-new', title: '正文', content: '', wordCount: 0, lastModified: new Date().toISOString()}]
            };
            setNovels(prev => [newNovel, ...prev]);
            setCreateModalOpen(false);
        } catch (e) {
            console.error("Error creating novel", e);
            alert("创建失败，请重试");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleUpdateNovel = async (id: string, newTitle: string, newCoverFile: File | null) => {
        setIsProcessing(true);
        try {
            let coverUrl = itemToEdit?.coverImage || null;

            // 1. If new file uploaded, upload it and get new URL
            if (newCoverFile) {
                const uploadedUrl = await uploadCoverImage(newCoverFile);
                if (uploadedUrl) {
                    coverUrl = uploadedUrl;
                }
            }

            // 2. Update DB
            await updateProject(id, { 
                title: newTitle, 
                cover_image: coverUrl || undefined 
            });

            // 3. Update Local State
            setNovels(prev => prev.map(n => 
                n.id === id 
                ? { ...n, title: newTitle, coverImage: coverUrl } 
                : n
            ));

            setEditModalOpen(false);
            setItemToEdit(null);
        } catch (e) {
            console.error("Failed to update novel", e);
            alert("更新失败，请重试");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleOpenDeleteModal = (id: string) => {
        const novel = novels.find(n => n.id === id);
        if (novel) {
            setItemToDelete(novel);
            setDeleteModalOpen(true);
        }
    };

    const handleConfirmDelete = async () => {
        if (itemToDelete) {
            await deleteProject(itemToDelete.id);
            setNovels(prev => prev.filter(n => n.id !== itemToDelete.id));
            setDeleteModalOpen(false);
            setItemToDelete(null);
        }
    };

    const handleOpenEditModal = (novel: Novel) => {
        setItemToEdit(novel);
        setEditModalOpen(true);
    };

    const handleSelectNovel = (novel: Novel) => {
        setEditingNovel(novel);
    };

    if (editingNovel) {
        return <NovelWritingPage novel={editingNovel} onBack={() => setEditingNovel(null)} pageTitle={pageTitle} mode={mode} />;
    }

    return (
        <div className="p-4 sm:p-6 lg:p-8 h-full flex flex-col">
            <CreateProjectModal
                isOpen={isCreateModalOpen}
                onClose={() => setCreateModalOpen(false)}
                onSave={handleCreateNovel}
                projectType={mode === 'long' ? 'novel' : 'short'}
            />
            <EditProjectModal 
                isOpen={isEditModalOpen}
                onClose={() => { setEditModalOpen(false); setItemToEdit(null); }}
                onSave={handleUpdateNovel}
                project={itemToEdit}
            />
            <DeleteConfirmationModal
                isOpen={isDeleteModalOpen}
                onClose={() => setDeleteModalOpen(false)}
                onConfirm={handleConfirmDelete}
            />
            
            {/* Header Area */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6 animate-fade-in">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{pageTitle}</h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">{description}</p>
                </div>
                {novels.length > 0 && (
                    <button
                        onClick={() => setCreateModalOpen(true)}
                        className="px-4 py-2 bg-sky-600 text-white font-semibold rounded-lg hover:bg-sky-500 transition-colors flex-shrink-0 self-start md:self-center shadow-sm"
                        disabled={isProcessing}
                    >
                        {isProcessing ? '处理中...' : `+ ${createButtonLabel}`}
                    </button>
                )}
            </div>

            {/* Content Area */}
            <div className="flex-1 flex flex-col">
                {novels.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 animate-fade-in pb-10">
                        {novels.map(novel => (
                           <ProjectCard 
                                key={novel.id} 
                                project={novel} 
                                onDelete={handleOpenDeleteModal}
                                onEdit={handleOpenEditModal}
                                onSelect={() => handleSelectNovel(novel)}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="flex-1 flex items-center justify-center animate-fade-in">
                        <div className="text-center max-w-md p-10 bg-white dark:bg-gray-900 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-800 flex flex-col items-center">
                            <div className="w-24 h-24 bg-sky-50 dark:bg-sky-900/20 rounded-full flex items-center justify-center mb-6">
                                {mode === 'long' ? (
                                    <BookOpen className="w-12 h-12 text-sky-500 dark:text-sky-400" />
                                ) : (
                                    <Sparkles className="w-12 h-12 text-sky-500 dark:text-sky-400" />
                                )}
                            </div>
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                                {mode === 'long' ? '开始创作你的第一部长篇小说' : '开启你的短篇创作之旅'}
                            </h2>
                            <p className="text-gray-500 dark:text-gray-400 mb-8 leading-relaxed">
                                {mode === 'long' 
                                    ? '万丈高楼平地起。创建一本新书，完善世界观、人物设定，开始撰写第一章吧！' 
                                    : '一个精彩的创意值得被记录。创建一个新的短篇项目，利用AI辅助你完成构思与写作。'
                                }
                            </p>
                            <button
                                onClick={() => setCreateModalOpen(true)}
                                className="px-8 py-3 bg-sky-600 text-white text-lg font-bold rounded-full hover:bg-sky-500 transition-all shadow-lg hover:shadow-sky-500/30 transform hover:-translate-y-1"
                                disabled={isProcessing}
                            >
                                {isProcessing ? '处理中...' : createButtonLabel}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default NovelManagement;
