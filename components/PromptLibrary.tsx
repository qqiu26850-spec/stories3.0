
import React, { useState, useMemo, useEffect } from 'react';
import { PROMPTS } from '../constants';
import { Prompt, PromptCategory, PromptSubCategory, UserProfile } from '../types';
import PromptCard from './PromptCard';
import CreatePromptModal from './CreatePromptModal';
import DeleteConfirmationModal from './DeleteConfirmationModal';
import PromptDetailModal from './PromptDetailModal';
import { Plus, Heart } from './Icon';
import { savePrompt, fetchPrompts, deletePrompt, getCurrentUserId, fetchUserProfile } from '../services/supabaseService';

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
    { id: 'style', label: '写作风格' },
    { id: 'requirements', label: '写作要求' },
    { id: 'continue', label: '续写' },
    { id: 'polish', label: '润色' },
    { id: 'proofread', label: '审稿' },
];

const PromptLibrary: React.FC<PromptLibraryProps> = ({ onNavigateToGeneration }) => {
    const [prompts, setPrompts] = useState<Prompt[]>(PROMPTS);
    const [activeTab, setActiveTab] = useState<PromptCategory | 'all' | 'favorites'>('short-story');
    const [activeSubCategory, setActiveSubCategory] = useState<PromptSubCategory | 'all'>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [favoritedIds, setFavoritedIds] = useState<Set<string>>(new Set());
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [userNickname, setUserNickname] = useState<string>('社区用户');
    
    const [isCreateModalOpen, setCreateModalOpen] = useState(false);
    const [isDeleteModalOpen, setDeleteModalOpen] = useState(false);
    const [isDetailModalOpen, setDetailModalOpen] = useState(false);
    
    const [promptToDelete, setPromptToDelete] = useState<Prompt | null>(null);
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

                const data = await fetchPrompts(); 
                if (data) {
                    const mappedPrompts: Prompt[] = data.map((p: any) => {
                        // Map DB categories back to app categories
                        let appCat: PromptCategory = 'short-story';
                        if(p.main_category === 'long') appCat = 'long-story';
                        if(p.main_category === 'script') appCat = 'script';
                        
                        // Try parsing content as JSON (new format) or use raw (legacy)
                        let parsedContent: any = {};
                        try {
                            parsedContent = JSON.parse(p.content);
                        } catch (e) {
                            parsedContent = { template: p.content };
                        }

                        const isMyPrompt = p.user_id === userId;
                        // Use current nickname for owned prompts to ensure consistency with Personal Center
                        // even if the prompt was saved with an older nickname.
                        const displayAuthor = isMyPrompt ? currentNick : (parsedContent.authorName || '社区用户');

                        return {
                            id: p.id,
                            title: p.title,
                            description: parsedContent.description || '用户自定义提示词',
                            content: parsedContent.template || p.content,
                            category: appCat,
                            subCategories: p.sub_category ? [p.sub_category as any] : [],
                            fields: parsedContent.fields || [], 
                            template: parsedContent.template || p.content,
                            heat: 0,
                            creator: 'user',
                            userId: p.user_id, // Store creator ID
                            authorName: displayAuthor
                        };
                    });
                    // Merge fetched prompts with system PROMPTS
                    setPrompts([...mappedPrompts, ...PROMPTS]);
                }
            } catch (error) {
                console.error("Failed to load prompts", error);
            }
        };
        loadData();
    }, []);

    const handleSavePrompt = async (data: Omit<Prompt, 'id' | 'heat' | 'content'>) => {
        // Map app categories to DB categories
        // App: 'short-story', 'long-story', 'script'
        // DB: 'short', 'long', 'script', 'general'
        let dbMainCat = 'general';
        if (data.category === 'short-story') dbMainCat = 'short';
        if (data.category === 'long-story') dbMainCat = 'long';
        if (data.category === 'script') dbMainCat = 'script';

        const subCat = data.subCategories && data.subCategories.length > 0 ? data.subCategories[0] : 'requirements';

        // Serialize the full prompt structure to JSON, including authorName
        const contentToSave = JSON.stringify({
            template: data.template,
            fields: data.fields,
            description: data.description,
            authorName: userNickname
        });

        // Call Supabase
        await savePrompt(data.title, contentToSave, dbMainCat, subCat);

        // Optimistic update
        const newPrompt: Prompt = {
            ...data,
            id: `prompt-user-${Date.now()}`,
            heat: 0,
            content: data.template, 
            creator: 'user',
            userId: currentUserId || undefined,
            authorName: userNickname
        };
        
        setPrompts(prev => [newPrompt, ...prev]);
        
        // Automatically add to favorites
        setFavoritedIds(prev => {
            const next = new Set(prev);
            next.add(newPrompt.id);
            return next;
        });
        setCreateModalOpen(false);
        setActiveTab(newPrompt.category); 
    };

    const handleRunPrompt = (formValues: Record<string, string>) => {
        if (selectedPrompt) {
             // Update local heat count
            setPrompts(currentPrompts =>
                currentPrompts.map(p =>
                    p.id === selectedPrompt.id ? { ...p, heat: p.heat + 1 } : p
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
            } else if (activeTab === 'all') {
                categoryMatch = true;
            } else {
                categoryMatch = prompt.category === activeTab;
            }

            if (!categoryMatch) return false;
            
            const subCategoryMatch = activeSubCategory === 'all' || prompt.subCategories.includes(activeSubCategory as PromptSubCategory);
            // Subcategory filter only applies to standard categories, not favorites (unless we want it to)
            if(activeTab !== 'favorites' && !subCategoryMatch) return false;

            if (!term) return true;

            const titleMatch = prompt.title.toLowerCase().includes(term);
            const descriptionMatch = prompt.description.toLowerCase().includes(term);

            return titleMatch || descriptionMatch;
        });
    }, [activeTab, activeSubCategory, searchTerm, prompts, favoritedIds]);

    return (
        <div className="p-4 sm:p-6 lg:p-8 h-full animate-fade-in">
            <CreatePromptModal
                isOpen={isCreateModalOpen}
                onClose={() => setCreateModalOpen(false)}
                onSave={handleSavePrompt}
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
                        onClick={() => setActiveTab('favorites')}
                        className={`px-6 py-2.5 rounded-xl font-semibold flex items-center gap-2 transition-all ${activeTab === 'favorites' ? 'bg-white dark:bg-gray-800 text-sky-600 dark:text-sky-400 shadow-sm ring-1 ring-gray-200 dark:ring-gray-700' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                    >
                        <Heart className="w-5 h-5" />
                        我的收藏
                    </button>
                    <button
                        onClick={() => setCreateModalOpen(true)}
                        className="px-6 py-2.5 rounded-xl font-semibold flex items-center gap-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"
                    >
                        <Plus className="w-5 h-5" />
                        创建提示词
                    </button>
                </div>
            </div>

            {/* Filters & Search */}
            <div className="flex flex-col lg:flex-row gap-4 mb-6 justify-between">
                {activeTab !== 'favorites' ? (
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
                ) : (
                    <div></div> // Spacer
                )}

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
                        isFavorited={favoritedIds.has(prompt.id)}
                        onToggleFavorite={toggleFavorite}
                        isOwner={prompt.userId === currentUserId}
                    />
                ))}
                {filteredPrompts.length === 0 && (
                    <div className="col-span-full flex flex-col items-center justify-center py-20 text-gray-400">
                        <p>暂无相关提示词</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PromptLibrary;
