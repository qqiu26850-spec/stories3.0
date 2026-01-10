
import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { BookOpen, Copy, Film, Check, X, Search, Plus, ArrowPath } from './Icon';
import { createProject, fetchProjects, saveChapterToDB, fetchChapters } from '../services/supabaseService';

interface SaveToCreationModalProps {
    isOpen: boolean;
    onClose: () => void;
    content: string;
    onSuccess: (msg: string) => void;
}

type ProjectType = 'short_story' | 'novel' | 'script';
type SaveMode = 'new' | 'existing';

const SaveToCreationModal: React.FC<SaveToCreationModalProps> = ({ isOpen, onClose, content, onSuccess }) => {
    const [projectType, setProjectType] = useState<ProjectType>('short_story');
    const [mode, setMode] = useState<SaveMode>('new');
    const [newTitle, setNewTitle] = useState('');
    const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
    const [projects, setProjects] = useState<any[]>([]);
    const [isLoadingProjects, setIsLoadingProjects] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        if (isOpen && mode === 'existing') {
            loadProjects();
        }
    }, [isOpen, mode, projectType]);

    const loadProjects = async () => {
        setIsLoadingProjects(true);
        try {
            const allProjects = await fetchProjects();
            const filtered = allProjects.filter((p: any) => p.type === projectType);
            setProjects(filtered);
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoadingProjects(false);
        }
    };

    const filteredProjects = useMemo(() => {
        return projects.filter(p => p.title.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [projects, searchTerm]);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            let projectId = selectedProjectId;

            if (mode === 'new') {
                if (!newTitle.trim()) {
                    alert('请输入作品标题');
                    setIsSaving(false);
                    return;
                }
                const description = `由工作流生成创建于 ${new Date().toLocaleDateString()}`;
                const { id, error } = await createProject(newTitle, description, projectType);
                if (error || !id) throw new Error(error?.message || '创建失败');
                projectId = id;
            }

            if (!projectId) {
                alert('请选择一个作品');
                setIsSaving(false);
                return;
            }

            // Logic to handle saving content based on project type
            if (projectType === 'short_story') {
                // Short Story logic: try to find the main chapter and append
                const chapters = await fetchChapters(projectId);
                
                if (chapters && chapters.length > 0) {
                    const mainChapter = chapters[0];
                    const newContent = (mainChapter.content ? mainChapter.content + '\n\n' : '') + content;
                    
                    // Update existing chapter
                    await saveChapterToDB(projectId, mainChapter.id, mainChapter.title, newContent, mainChapter.order_index);
                } else {
                    // Create new main chapter if none exists
                    // Key Fix: Use 'new-' prefix to trigger INSERT in saveChapterToDB
                    await saveChapterToDB(projectId, `new-wf-gen-${Date.now()}`, '正文', content, 1);
                }
            } else {
                // Novel or Script: Create a new chapter/scene appended to the end
                const chapterTitle = `生成内容-${new Date().toLocaleTimeString()}`;
                // Key Fix: Use 'new-' prefix to trigger INSERT in saveChapterToDB
                const chapterId = `new-wf-gen-${Date.now()}`;
                await saveChapterToDB(projectId, chapterId, chapterTitle, content, 9999);
            }
            
            onSuccess(mode === 'new' ? '已创建新作品并存入' : '已存入选中作品');
            onClose();
        } catch (e: any) {
            alert(`保存失败: ${e.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-fade-in-up font-sans flex flex-col max-h-[85vh]" onClick={e => e.stopPropagation()}>
                
                {/* Header */}
                <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-gray-900">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        存入创作中心
                    </h3>
                    <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-white rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    
                    {/* Step 1: Select Type */}
                    <div className="space-y-3">
                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">选择模块</label>
                        <div className="grid grid-cols-3 gap-4">
                            {[
                                { id: 'short_story', label: '短篇小说', icon: Copy },
                                { id: 'novel', label: '长篇小说', icon: BookOpen },
                                { id: 'script', label: '剧本创作', icon: Film },
                            ].map((type) => {
                                const Icon = type.icon;
                                const isSelected = projectType === type.id;
                                return (
                                    <button
                                        key={type.id}
                                        onClick={() => setProjectType(type.id as ProjectType)}
                                        className={`flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2 transition-all ${
                                            isSelected 
                                            ? 'border-sky-500 bg-sky-50 dark:bg-sky-900/20 text-sky-600 dark:text-sky-400 shadow-sm' 
                                            : 'border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-800 text-gray-500 hover:border-sky-200 dark:hover:border-sky-800'
                                        }`}
                                    >
                                        <Icon className="w-6 h-6" />
                                        <span className="text-sm font-bold">{type.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Step 2: Select Mode */}
                    <div className="space-y-3">
                        <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
                            <button
                                onClick={() => setMode('new')}
                                className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${mode === 'new' ? 'bg-white dark:bg-gray-700 text-sky-600 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                            >
                                新建作品
                            </button>
                            <button
                                onClick={() => setMode('existing')}
                                className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${mode === 'existing' ? 'bg-white dark:bg-gray-700 text-sky-600 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                            >
                                导入已有作品
                            </button>
                        </div>
                    </div>

                    {/* Step 3: Action */}
                    <div className="min-h-[150px]">
                        {mode === 'new' ? (
                            <div className="space-y-3 animate-fade-in">
                                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">作品名称</label>
                                <input 
                                    type="text" 
                                    value={newTitle}
                                    onChange={(e) => setNewTitle(e.target.value)}
                                    placeholder="请输入新作品的标题..." 
                                    className="w-full p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-sky-500 outline-none transition-all text-base"
                                    autoFocus
                                />
                            </div>
                        ) : (
                            <div className="space-y-3 animate-fade-in h-full flex flex-col">
                                <div className="relative">
                                    <input 
                                        type="text" 
                                        placeholder="搜索已有作品..." 
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-1 focus:ring-sky-500 outline-none"
                                    />
                                    <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
                                </div>
                                
                                <div className="flex-1 overflow-y-auto max-h-48 border border-gray-100 dark:border-gray-800 rounded-xl p-2 space-y-1">
                                    {isLoadingProjects ? (
                                        <div className="text-center py-8 text-gray-400 flex items-center justify-center gap-2">
                                            <ArrowPath className="w-4 h-4 animate-spin" /> 加载中...
                                        </div>
                                    ) : filteredProjects.length > 0 ? (
                                        filteredProjects.map(project => (
                                            <button
                                                key={project.id}
                                                onClick={() => setSelectedProjectId(project.id)}
                                                className={`w-full text-left p-3 rounded-lg flex items-center justify-between transition-all ${
                                                    selectedProjectId === project.id 
                                                    ? 'bg-sky-50 dark:bg-sky-900/30 border border-sky-200 dark:border-sky-800' 
                                                    : 'hover:bg-gray-50 dark:hover:bg-gray-800 border border-transparent'
                                                }`}
                                            >
                                                <span className={`text-sm font-medium ${selectedProjectId === project.id ? 'text-sky-700 dark:text-sky-300' : 'text-gray-700 dark:text-gray-300'}`}>
                                                    {project.title}
                                                </span>
                                                {selectedProjectId === project.id && <Check className="w-4 h-4 text-sky-500" />}
                                            </button>
                                        ))
                                    ) : (
                                        <div className="text-center py-8 text-gray-400 text-sm">暂无匹配作品</div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900 flex justify-end gap-3">
                    <button onClick={onClose} className="px-6 py-2.5 text-sm font-bold text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors">取消</button>
                    <button 
                        onClick={handleSave} 
                        disabled={isSaving || (mode === 'existing' && !selectedProjectId)}
                        className="px-8 py-2.5 bg-sky-600 text-white text-sm font-bold rounded-xl hover:bg-sky-500 shadow-lg shadow-sky-500/20 transition-all active:scale-95 disabled:bg-gray-300 disabled:shadow-none flex items-center gap-2"
                    >
                        {isSaving && <ArrowPath className="w-4 h-4 animate-spin" />}
                        确认存入
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default SaveToCreationModal;
