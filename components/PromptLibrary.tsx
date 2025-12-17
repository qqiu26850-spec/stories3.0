
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Prompt, PromptCategory, PromptSubCategory } from '../types';
import PromptCard from './PromptCard';
import CreatePromptModal from './CreatePromptModal';
import DeleteConfirmationModal from './DeleteConfirmationModal';
import PromptDetailModal from './PromptDetailModal';
import { Plus, Heart, UserCircle, Check, X, Sparkles, Box, Search } from './Icon';
import { savePrompt, fetchPrompts, deletePrompt, getCurrentUserId, fetchUserProfile, updatePrompt } from '../services/supabaseService';
import { FUNCTIONAL_TAGS, GENRE_TAGS } from '../constants';

interface PromptLibraryProps {
    onNavigateToGeneration?: (prompt: Prompt, values: Record<string, string>) => void;
    isActive: boolean;
}

const CATEGORY_TABS: { id: PromptCategory | 'all'; label: string }[] = [
  { id: 'all', label: '全部' },
  { id: 'general', label: '通用' },
  { id: 'short-story', label: '短篇小说' },
  { id: 'long-story', label: '长篇小说' },
  { id: 'script', label: '剧本' },
];

const PostCreationModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onCreateAnother: () => void;
    onTestPrompt: () => void;
}> = ({ isOpen, onClose, onCreateAnother, onTestPrompt }) => {
    if (!isOpen) return null;
    return createPortal(
        <div className="fixed inset-0 bg-black/60 dark:bg-black/80 flex items-center justify-center z-[100] p-4 backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-900 w-full max-w-sm rounded-2xl p-6 shadow-2xl animate-fade-in-up border border-gray-100 dark:border-gray-800">
                <div className="text-center mb-6">
                    <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl text-green-500">
                        <Check className="w-8 h-8" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">提示词创建成功！</h3>
                    <p className="text-gray-500 dark:text-gray-400 text-sm">
                        您的提示词已保存到库中，接下来您想做什么？
                    </p>
                </div>
                <div className="flex flex-col gap-3">
                    <button 
                        onClick={onTestPrompt}
                        className="w-full py-3 rounded-xl bg-sky-600 text-white font-bold hover:bg-sky-500 transition-colors shadow-lg shadow-sky-500/20 flex items-center justify-center gap-2"
                    >
                        <Sparkles className="w-5 h-5" />
                        测试提示词
                    </button>
                    <button 
                        onClick={onCreateAnother}
                        className="w-full py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-semibold hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
                    >
                        <Plus className="w-5 h-5" />
                        再创建一个
                    </button>
                    <button 
                        onClick={onClose}
                        className="w-full py-2 text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                    >
                        关闭
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

const PromptLibrary: React.FC<PromptLibraryProps> = ({ onNavigateToGeneration, isActive }) => {
    const [prompts, setPrompts] = useState<Prompt[]>([]);
    const [activeTab, setActiveTab] = useState<PromptCategory | 'all' | 'favorites' | 'my-prompts'>('all');
    const [activeSubCategory, setActiveSubCategory] = useState<PromptSubCategory | 'all'>('all');
    
    const [searchTerm, setSearchTerm] = useState('');
    const [favoritedIds, setFavoritedIds] = useState<Set<string>>(new Set());
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [userNickname, setUserNickname] = useState<string>('社区用户');
    
    const [isCreateModalOpen, setCreateModalOpen] = useState(false);
    const [isDeleteModalOpen, setDeleteModalOpen] = useState(false);
    const [isDetailModalOpen, setDetailModalOpen] = useState(false);
    const [isSuccessModalOpen, setSuccessModalOpen] = useState(false);
    
    const [promptToDelete, setPromptToDelete] = useState<Prompt | null>(null);
    const [promptToEdit, setPromptToEdit] = useState<Prompt | null>(null);
    const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);
    const [lastCreatedPrompt, setLastCreatedPrompt] = useState<Prompt | null>(null);
    
    const [isLoading, setIsLoading] = useState(true);
    const [successMessage, setSuccessMessage] = useState('');

    const loadData = useCallback(async (forceRefresh = false) => {
        setIsLoading(true);
        try {
            const userId = await getCurrentUserId();
            setCurrentUserId(userId);
            
            let currentNickname = '社区用户';
            const profile = await fetchUserProfile();
            if(profile && profile.nickname) {
                setUserNickname(profile.nickname);
                currentNickname = profile.nickname;
            }

            // Utilize cache via service unless forceRefresh is true
            const fetchedData = await fetchPrompts('all', forceRefresh); 
            if (fetchedData) {
                const mappedPrompts: Prompt[] = fetchedData.map((p: any) => {
                    let appCat: PromptCategory = 'short-story';
                    if(p.main_category === 'long') appCat = 'long-story';
                    else if(p.main_category === 'script') appCat = 'script';
                    else if(p.main_category === 'short') appCat = 'short-story';
                    else if(p.main_category === 'general') appCat = 'general';
                    else appCat = p.main_category as PromptCategory;
                    
                    let parsedContent: any = {};
                    try {
                        parsedContent = JSON.parse(p.content);
                    } catch (e) {
                        parsedContent = { template: p.content, description: p.description };
                    }

                    let authorName = p.profiles?.username || parsedContent.authorName || '社区用户';
                    if (p.user_id === userId) {
                        authorName = currentNickname;
                    }

                    const tags = parsedContent.subCategories || (p.sub_category ? [p.sub_category as any] : []);

                    return {
                        id: p.id,
                        title: p.title,
                        description: p.description || parsedContent.description || '用户自定义提示词',
                        content: parsedContent.template || p.content,
                        category: appCat,
                        subCategories: tags,
                        fields: parsedContent.fields || [], 
                        template: parsedContent.template || p.content,
                        heat: p.usage_count || 0,
                        creator: 'user',
                        userId: p.user_id,
                        authorName: authorName
                    };
                });
                setPrompts(mappedPrompts);
            }
        } catch (error) {
            console.error("Failed to load prompts", error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Load User Prompts from Supabase
    useEffect(() => {
        if (isActive) {
            loadData();
        }
    }, [isActive, loadData]);

    const handleSavePrompt = async (data: Omit<Prompt, 'id' | 'heat' | 'content'>, promptId?: string) => {
        const contentObject = {
            template: data.template,
            fields: data.fields,
            description: data.description,
            authorName: userNickname,
            subCategories: data.subCategories 
        };
        const contentString = JSON.stringify(contentObject);
        const subCat = data.subCategories && data.subCategories.length > 0 ? data.subCategories[0] : 'idea';

        if (promptId) {
            const { success, error } = await updatePrompt(promptId, {
                title: data.title,
                content: contentString,
                main_category: data.category,
                sub_category: subCat
            });
            if (!success) { alert(`更新失败: ${error?.message || '未知错误'}`); return; }
            setSuccessMessage('提示词更新成功');
            setTimeout(() => setSuccessMessage(''), 2500);
        } else {
            const { success, error } = await savePrompt(data.title, contentString, data.category, subCat);
            if (!success) { alert(`保存失败: ${error?.message || '未知错误'}`); return; }
            
            // For new prompt, we construct a temp object for the success modal action
            const tempNewPrompt: Prompt = {
                id: 'temp-new', // Will be refreshed on loadData
                title: data.title,
                description: data.description,
                content: data.template,
                template: data.template,
                fields: data.fields,
                category: data.category,
                subCategories: data.subCategories,
                heat: 0,
                creator: 'user',
                authorName: userNickname,
                userId: currentUserId || ''
            };
            setLastCreatedPrompt(tempNewPrompt);
            setSuccessModalOpen(true);
        }
        
        // Refresh list without full page reload
        await loadData(true);
        
        setCreateModalOpen(false);
        setPromptToEdit(null);
    };

    const handleEditPrompt = (prompt: Prompt) => {
        setPromptToEdit(prompt);
        setCreateModalOpen(true);
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
            setSuccessMessage('提示词删除成功');
            setTimeout(() => setSuccessMessage(''), 2500);
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
            
            const subCategoryMatch = activeSubCategory === 'all' || (prompt.subCategories && prompt.subCategories.includes(activeSubCategory as PromptSubCategory));
            if (!subCategoryMatch) return false;

            if (!term) return true;

            const titleMatch = prompt.title.toLowerCase().includes(term);
            const descriptionMatch = prompt.description.toLowerCase().includes(term);

            return titleMatch || descriptionMatch;
        });
    }, [activeTab, activeSubCategory, searchTerm, prompts, favoritedIds, currentUserId]);

    const renderTagButton = (cat: { id: PromptSubCategory | 'all'; label: string }, isGenre: boolean) => (
        <button 
            key={cat.id}
            onClick={() => setActiveSubCategory(cat.id as PromptSubCategory)}
            className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                activeSubCategory === cat.id 
                ? (isGenre ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300 ring-1 ring-purple-500/50' : 'bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300 ring-1 ring-sky-500/50')
                : 'bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}>
            {cat.label}
        </button>
    );

    return (
        <div className="p-4 sm:p-6 lg:p-8 h-full animate-fade-in flex flex-col relative">
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
            />
            <PostCreationModal 
                isOpen={isSuccessModalOpen}
                onClose={() => setSuccessModalOpen(false)}
                onCreateAnother={() => {
                    setSuccessModalOpen(false);
                    setCreateModalOpen(true);
                }}
                onTestPrompt={() => {
                    setSuccessModalOpen(false);
                    if (onNavigateToGeneration && lastCreatedPrompt) {
                        onNavigateToGeneration(lastCreatedPrompt, {});
                    }
                }}
            />
            
            {/* Top Navigation Bar */}
            <div className="flex flex-col gap-4 mb-6 flex-shrink-0">
                <div className="flex justify-between items-center">
                    <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide flex-1 mr-4">
                        {CATEGORY_TABS.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={`px-4 py-2 rounded-xl font-semibold whitespace-nowrap transition-all text-sm ${activeTab === tab.id ? 'bg-sky-600 text-white shadow-md' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                    
                    <div className="flex gap-2 flex-shrink-0">
                         {successMessage && (
                            <div className="px-4 py-2 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 rounded-lg text-sm font-bold animate-pulse shadow-sm flex items-center gap-2 mr-2">
                                <Check className="w-4 h-4" />
                                {successMessage}
                            </div>
                        )}
                         <button
                            onClick={() => setActiveTab('my-prompts')}
                            className={`flex items-center gap-2 px-3 py-2 rounded-xl font-semibold transition-all text-sm ${activeTab === 'my-prompts' ? 'bg-sky-100 text-sky-600 dark:bg-sky-900/50' : 'bg-white dark:bg-gray-800 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                            title="我的提示词"
                        >
                            <UserCircle className="w-4 h-4" />
                            我的提示词
                        </button>
                         <button
                            onClick={() => setActiveTab('favorites')}
                            className={`flex items-center gap-2 px-3 py-2 rounded-xl font-semibold transition-all text-sm ${activeTab === 'favorites' ? 'bg-red-100 text-red-600 dark:bg-red-900/50' : 'bg-white dark:bg-gray-800 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                            title="我的收藏"
                        >
                            <Heart className="w-4 h-4" />
                            我的收藏
                        </button>
                        <button
                            onClick={() => { setPromptToEdit(null); setCreateModalOpen(true); }}
                            className="px-4 py-2 rounded-xl font-bold bg-sky-600 text-white hover:bg-sky-500 transition-all flex items-center gap-1 shadow-lg shadow-sky-500/30 text-sm"
                        >
                            <Plus className="w-4 h-4" />
                            创建
                        </button>
                    </div>
                </div>

                {/* Filters & Search - Updated to 2 Lines */}
                <div className="flex flex-col lg:flex-row gap-4 justify-between items-start bg-gray-100 dark:bg-gray-900/50 p-3 rounded-xl">
                    <div className="flex-1 w-full space-y-2">
                        {/* Row 1: Functional Tags */}
                        <div className="flex flex-wrap gap-2 overflow-x-auto pb-1 scrollbar-hide items-center">
                            <span className="text-xs font-bold text-gray-400 mr-1 shrink-0">功能:</span>
                            <button 
                                onClick={() => setActiveSubCategory('all')}
                                className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${activeSubCategory === 'all' ? 'bg-sky-600 text-white shadow-md' : 'bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}>
                                全部
                            </button>
                            {FUNCTIONAL_TAGS.map(cat => renderTagButton(cat, false))}
                        </div>
                        
                        {/* Row 2: Genre Tags */}
                        <div className="flex flex-wrap gap-2 overflow-x-auto pb-1 scrollbar-hide items-center border-t border-gray-200 dark:border-gray-700 pt-2">
                            <span className="text-xs font-bold text-gray-400 mr-1 shrink-0">题材:</span>
                            {GENRE_TAGS.map(cat => renderTagButton(cat, true))}
                        </div>
                    </div>

                    <div className="relative w-full lg:w-64 flex-shrink-0 self-center">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                            <Search className="w-4 h-4 text-gray-400" />
                        </span>
                        <input
                            type="text"
                            placeholder="搜索..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white rounded-lg border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-sky-500 transition-colors"
                        />
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 -mr-2">
                {isLoading ? (
                    <div className="flex items-center justify-center h-64">
                        <div className="w-10 h-10 border-4 border-gray-200 dark:border-gray-800 border-t-sky-500 rounded-full animate-spin"></div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-10">
                        {filteredPrompts.map(prompt => (
                            <div key={prompt.id} className="h-full">
                                <PromptCard 
                                    prompt={prompt}
                                    onSelect={handleSelectPrompt}
                                    onDelete={handleOpenDeleteModal}
                                    onEdit={handleEditPrompt}
                                    isFavorited={favoritedIds.has(prompt.id)}
                                    onToggleFavorite={toggleFavorite}
                                    isOwner={prompt.userId === currentUserId}
                                />
                            </div>
                        ))}
                        {filteredPrompts.length === 0 && (
                            <div className="col-span-full flex flex-col items-center justify-center py-20 text-gray-400">
                                <Box className="w-16 h-16 mb-4 opacity-20" />
                                <p>暂无相关提示词，快去创建一个吧！</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default PromptLibrary;
