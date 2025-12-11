
import React, { useState, useMemo, useEffect } from 'react';
import { Prompt, PromptCategory, PromptSubCategory, UserProfile } from '../types';
import PromptCard from './PromptCard';
import CreatePromptModal from './CreatePromptModal';
import DeleteConfirmationModal from './DeleteConfirmationModal';
import PromptDetailModal from './PromptDetailModal';
import { Plus, Heart, UserCircle } from './Icon';
import { savePrompt, fetchPrompts, deletePrompt, getCurrentUserId, fetchUserProfile, updatePrompt, incrementPromptHeat } from '../services/supabaseService';

interface PromptLibraryProps {
    onNavigateToGeneration?: (prompt: Prompt, values: Record<string, string>) => void;
}

const CATEGORY_TABS: { id: PromptCategory | 'all'; label: string }[] = [
  { id: 'all', label: '全部' },
  { id: 'short-story', label: '短篇小说' },
  { id: 'long-story', label: '长篇小说' },
  { id: 'script', label: '剧本' },
];

const SUB_CATEGORIES: { id: PromptSubCategory | 'all'; label: string }[] = [
    { id: 'idea', label: '创意' },
    { id: 'golden_finger', label: '金手指' },
    { id: 'character_design', label: '人物设定' },
    { id: 'worldview', label: '世界观' },
    { id: 'outline', label: '大纲' },
    { id: 'detailed_outline', label: '细纲' },
    { id: 'synopsis', label: '简介' },
    { id: 'requirements', label: '写作要求' },
    { id: 'style', label: '写作风格' },
    { id: 'continue', label: '续写' },
    { id: 'polish', label: '润色' },
    { id: 'writing', label: '写稿' },
];

const PromptLibrary: React.FC<PromptLibraryProps> = ({ onNavigateToGeneration }) => {
    // Initial state empty, fetching from DB
    const [prompts, setPrompts] = useState<Prompt[]>([]);
    const [activeTab, setActiveTab] = useState<PromptCategory | 'all' | 'favorites' | 'my-prompts'>('short-story');
    const [activeSubCategory, setActiveSubCategory] = useState<PromptSubCategory | 'all'>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [favoritedIds, setFavoritedIds] = useState<Set<string>>(new Set());
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [userNickname, setUserNickname] = useState<string>('社区用户');
    
    const [isCreateModalOpen, setCreateModalOpen] = useState(false);
    const [isDeleteModalOpen, setDeleteModalOpen] = useState(false);
    const [isDetailModalOpen, setDetailModalOpen] = useState(false);
    
    const [promptToDelete, setPromptToDelete] = useState<Prompt | null>(null);
    const [promptToEdit, setPromptToEdit] = useState<Prompt | null>(null);
    const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);

    // Load User Prompts from Supabase
    useEffect(() => {
        const loadData = async () => {
            try {
                const userId = await getCurrentUserId();
                setCurrentUserId(userId);
                
                const profile = await fetchUserProfile();
                let currentNick = '社区用户';
                if(profile && profile.nickname) {
                    currentNick = profile.nickname;
                    setUserNickname(profile.nickname);
                }

                // Fetch "general" or all based on logic, supabaseService.fetchPrompts logic handles this
                const data = await fetchPrompts(); 
                if (data) {
                    const mappedPrompts: Prompt[] = data.map((p: any) => {
                        // Map DB categories back to app categories
                        let appCat: PromptCategory = 'short-story';
                        if(p.main_category === 'long') appCat = 'long-story';
                        if(p.main_category === 'script') appCat = 'script';
                        
                        // Parse JSON content
                        let parsedContent: any = {};
                        try {
                            parsedContent = JSON.parse(p.content);
                        } catch (e) {
                            // Fallback if content is just a string
                            parsedContent = { template: p.content, description: p.description };
                        }

                        const isMyPrompt = p.user_id === userId;
                        // Display author fallback logic
                        const displayAuthor = isMyPrompt ? currentNick : (parsedContent.authorName || '社区用户');

                        return {
                            id: p.id,
                            title: p.title,
                            description: p.description || parsedContent.description || '用户自定义提示词',
                            content: parsedContent.template || p.content,
                            category: appCat,
                            subCategories: p.sub_category ? [p.sub_category as any] : [],
                            fields: parsedContent.fields || [], 
                            template: parsedContent.template || p.content,
                            heat: p.usage_count || 0, // Map usage_count to heat
                            creator: 'user',
                            userId: p.user_id,
                            authorName: displayAuthor
                        };
                    });
                    setPrompts(mappedPrompts);
                }
            } catch (error) {
                console.error("Failed to load prompts", error);
            }
        };
        loadData();
    }, []);

    const handleSavePrompt = async (data: Omit<Prompt, 'id' | 'heat' | 'content'>, promptId?: string) => {
        // Prepare the serialized content object to store in DB
        const contentObject = {
            template: data.template,
            fields: data.fields,
            description: data.description,
            authorName: userNickname
        };
        const contentString = JSON.stringify(contentObject);
        
        const subCat = data.subCategories && data.subCategories.length > 0 ? data.subCategories[0] : 'idea';

        if (promptId) {
            // Update Existing
            const { success, error } = await updatePrompt(promptId, {
                title: data.title,
                content: contentString,
                main_category: data.category, // Service handles mapping
                sub_category: subCat
            });
            
            if (!success) {
                alert(`更新失败: ${error?.message || '未知错误'}`);
                return;
            }
            
            alert('提示词更新成功！');

            // Update local state
            setPrompts(prev => prev.map(p => {
                if (p.id === promptId) {
                    return {
                        ...p,
                        ...data,
                        content: data.template,
                        userId: currentUserId || undefined,
                        authorName: userNickname
                    }
                }
                return p;
            }));
        } else {
            // Create New
            const { success, error } = await savePrompt(data.title, contentString, data.category, subCat);

            if (!success) {
                alert(`保存失败: ${error?.message || '未知错误'}`);
                return;
            }
            
            alert('提示词创建成功！');

            // Optimistic update
            const newPrompt: Prompt = {
                ...data,
                id: `prompt-new-${Date.now()}`,
                heat: 0,
                content: data.template, 
                creator: 'user',
                userId: currentUserId || undefined,
                authorName: userNickname
            };
            
            setPrompts(prev => [newPrompt, ...prev]);
            
            setFavoritedIds(prev => {
                const next = new Set(prev);
                next.add(newPrompt.id);
                return next;
            });
            setActiveTab(newPrompt.category); 
        }

        setCreateModalOpen(false);
        setPromptToEdit(null);
    };

    const handleEditPrompt = (prompt: Prompt) => {
        setPromptToEdit(prompt);
        setCreateModalOpen(true);
    };

    const handleRunPrompt = async (formValues: Record<string, string>) => {
        if (selectedPrompt) {
             // 1. Increment heat in DB
             await incrementPromptHeat(selectedPrompt.id);

             // 2. Update local heat count
            setPrompts(currentPrompts =>
                currentPrompts.map(p =>
                    p.id === selectedPrompt.id ? { ...p, heat: (p.heat || 0) + 1 } : p
                )
            );
            
            if (onNavigateToGeneration) {
                onNavigateToGeneration(selectedPrompt, formValues);
            }
            setDetailModalOpen(false);
        }
    };
    
    const handleOpenDeleteModal = (prompt: Prompt) => {
        setPromptToDelete(prompt);
        setDeleteModalOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (promptToDelete) {
            await deletePrompt(promptToDelete.id);
            setPrompts(prev => prev.filter(p => p.id !== promptToDelete.id));
            setDeleteModalOpen(false);
            setPromptToDelete(null);
        }
    };

    const handleSelectPrompt = (prompt: Prompt) => {
        setSelectedPrompt(prompt);
        setDetailModalOpen(true);
    };

    const toggleFavorite = (id: string) => {
        setFavoritedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const filteredPrompts = useMemo(() => {
        const term = searchTerm.toLowerCase();
        
        return prompts.filter(prompt => {
            let categoryMatch = false;
            if (activeTab === 'favorites') {
                categoryMatch = favoritedIds.has(prompt.id);
            } else if (activeTab === 'my-prompts') {
                categoryMatch = prompt.creator === 'user' && prompt.userId === currentUserId;
            } else if (activeTab === 'all') {
                categoryMatch = true;
            } else {
                categoryMatch = prompt.category === activeTab;
            }

            if (!categoryMatch) return false;
            
            const subCategoryMatch = activeSubCategory === 'all' || prompt.subCategories.includes(activeSubCategory as PromptSubCategory);
            // Now apply subcategory filter to all tabs including favorites and my-prompts
            if (!subCategoryMatch) return false;

            if (!term) return true;

            const titleMatch = prompt.title.toLowerCase().includes(term);
            const descriptionMatch = prompt.description.toLowerCase().includes(term);

            return titleMatch || descriptionMatch;
        });
    }, [activeTab, activeSubCategory, searchTerm, prompts, favoritedIds, currentUserId]);

    return (
        <div className="p-4 sm:p-6 lg:p-8 h-full animate-fade-in">
            <CreatePromptModal
                isOpen={isCreateModalOpen}
                onClose={() => { setCreateModalOpen(false); setPromptToEdit(null); }}
                onSave={handleSavePrompt}
                promptToEdit={promptToEdit}
            />
             <DeleteConfirmationModal
                isOpen={isDeleteModalOpen}
                onClose={() => setDeleteModalOpen(false)}
                onConfirm={handleConfirmDelete}
            />
            <PromptDetailModal
                isOpen={isDetailModalOpen}
                onClose={() => setDetailModalOpen(false)}
                prompt={selectedPrompt}
                onRun={handleRunPrompt}
            />
            
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">提示词库</h1>
                <p className="text-gray-500 dark:text-gray-400 mt-1">使用和创建专业的提示词，激发AI的无限潜能。</p>
            </div>
            
            {/* Top Navigation Bar */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <div className="flex flex-wrap gap-4">
                    {CATEGORY_TABS.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`px-6 py-2.5 rounded-xl font-semibold transition-all ${activeTab === tab.id ? 'bg-white dark:bg-gray-800 text-sky-600 dark:text-sky-400 shadow-sm ring-1 ring-gray-200 dark:ring-gray-700' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                <div className="flex flex-wrap gap-4">
                     <button
                        onClick={() => setActiveTab('my-prompts')}
                        className={`px-6 py-2.5 rounded-xl font-semibold flex items-center gap-2 transition-all ${activeTab === 'my-prompts' ? 'bg-white dark:bg-gray-800 text-sky-600 dark:text-sky-400 shadow-sm ring-1 ring-gray-200 dark:ring-gray-700' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                    >
                        <UserCircle className="w-5 h-5" />
                        我的提示词
                    </button>
                     <button
                        onClick={() => setActiveTab('favorites')}
                        className={`px-6 py-2.5 rounded-xl font-semibold flex items-center gap-2 transition-all ${activeTab === 'favorites' ? 'bg-white dark:bg-gray-800 text-sky-600 dark:text-sky-400 shadow-sm ring-1 ring-gray-200 dark:ring-gray-700' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                    >
                        <Heart className="w-5 h-5" />
                        我的收藏
                    </button>
                    <button
                        onClick={() => { setPromptToEdit(null); setCreateModalOpen(true); }}
                        className="px-6 py-2.5 rounded-xl font-semibold flex items-center gap-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"
                    >
                        <Plus className="w-5 h-5" />
                        创建提示词
                    </button>
                </div>
            </div>

            {/* Filters & Search */}
            <div className="flex flex-col lg:flex-row gap-4 mb-6 justify-between">
                <div className="flex flex-wrap gap-2">
                    <button 
                        onClick={() => setActiveSubCategory('all')}
                        className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${activeSubCategory === 'all' ? 'bg-sky-500 text-white' : 'bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700'}`}>
                        全部
                    </button>
                    {SUB_CATEGORIES.map(cat => (
                        <button 
                            key={cat.id}
                            onClick={() => setActiveSubCategory(cat.id as PromptSubCategory)}
                            className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${activeSubCategory === cat.id ? 'bg-sky-500 text-white' : 'bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700'}`}>
                            {cat.label}
                        </button>
                    ))}
                </div>

                <div className="relative w-full lg:w-72">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                        <svg className="w-5 h-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                        </svg>
                    </span>
                    <input
                        type="text"
                        placeholder="搜索标题或描述..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-white rounded-lg border border-gray-200 dark:border-gray-800 focus:outline-none focus:ring-2 focus:ring-sky-500 transition-colors"
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredPrompts.map(prompt => (
                    <PromptCard 
                        key={prompt.id} 
                        prompt={prompt}
                        onSelect={handleSelectPrompt}
                        onDelete={handleOpenDeleteModal}
                        onEdit={handleEditPrompt}
                        isFavorited={favoritedIds.has(prompt.id)}
                        onToggleFavorite={toggleFavorite}
                        isOwner={prompt.userId === currentUserId}
                    />
                ))}
                {filteredPrompts.length === 0 && (
                    <div className="col-span-full flex flex-col items-center justify-center py-20 text-gray-400">
                        <p>暂无相关提示词，快去创建一个吧！</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PromptLibrary;
