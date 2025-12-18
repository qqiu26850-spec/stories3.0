
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

const FAVORITES_STORAGE_KEY = 'qisimiaoxie_prompt_favorites_v2';

const SuccessToast: React.FC<{ message: string; isVisible: boolean }> = ({ message, isVisible }) => {
    if (!isVisible) return null;
    return createPortal(
        <div className="fixed inset-0 z-[200] flex items-center justify-center pointer-events-none">
            <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-md border border-gray-100 dark:border-gray-700 px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-fade-in">
                <div className="w-8 h-8 bg-green-100 dark:bg-green-900/50 rounded-full flex items-center justify-center text-green-600 dark:text-green-400">
                    <Check className="w-5 h-5" />
                </div>
                <span className="text-sm font-bold text-gray-800 dark:text-gray-100">{message}</span>
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
    const [showSuccessToast, setShowSuccessToast] = useState(false);
    
    const [promptToDelete, setPromptToDelete] = useState<Prompt | null>(null);
    const [promptToEdit, setPromptToEdit] = useState<Prompt | null>(null);
    const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);
    
    const [isLoading, setIsLoading] = useState(true);
    const [successMessage, setSuccessMessage] = useState('');

    // 加载持久化收藏数据
    useEffect(() => {
        const stored = localStorage.getItem(FAVORITES_STORAGE_KEY);
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                if (Array.isArray(parsed)) setFavoritedIds(new Set(parsed));
            } catch (e) { console.error("收藏加载失败", e); }
        }
    }, []);

    // 收藏状态变化同步到本地
    useEffect(() => {
        localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(Array.from(favoritedIds)));
    }, [favoritedIds]);

    const loadData = useCallback(async (forceRefresh = false) => {
        setIsLoading(true);
        try {
            const userId = await getCurrentUserId();
            setCurrentUserId(userId);
            
            const profile = await fetchUserProfile();
            if(profile && profile.nickname) setUserNickname(profile.nickname);

            const fetchedData = await fetchPrompts('all', forceRefresh); 
            if (fetchedData) {
                const mappedPrompts: Prompt[] = fetchedData.map((p: any) => {
                    let parsedContent: any = {};
                    try { parsedContent = JSON.parse(p.content); } catch (e) { parsedContent = { template: p.content }; }

                    return {
                        id: p.id,
                        title: p.title,
                        description: p.description || parsedContent.description || '用户自定义提示词',
                        example: parsedContent.example || '',
                        content: parsedContent.template || p.content,
                        category: p.main_category as PromptCategory,
                        subCategories: parsedContent.subCategories || [p.sub_category],
                        fields: parsedContent.fields || [], 
                        template: parsedContent.template || p.content,
                        heat: p.usage_count || 0,
                        creator: p.user_id === userId ? 'user' : 'system',
                        userId: p.user_id,
                        authorName: p.profiles?.username || parsedContent.authorName || '匿名用户'
                    };
                });
                setPrompts(mappedPrompts);
            }
        } catch (error) { console.error("加载数据失败", error); } finally { setIsLoading(false); }
    }, []);

    useEffect(() => { if (isActive) loadData(); }, [isActive, loadData]);

    const toggleFavorite = (id: string) => {
        setFavoritedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    // Fix: Defined handleEditPrompt to resolve the "Cannot find name 'handleEditPrompt'" error
    const handleEditPrompt = (prompt: Prompt) => {
        setPromptToEdit(prompt);
        setCreateModalOpen(true);
    };

    const filteredPrompts = useMemo(() => {
        return prompts.filter(p => {
            if (activeTab === 'favorites') return favoritedIds.has(p.id);
            if (activeTab === 'my-prompts') return p.userId === currentUserId;
            if (activeTab !== 'all' && p.category !== activeTab) return false;
            
            if (activeSubCategory !== 'all' && !p.subCategories.includes(activeSubCategory as PromptSubCategory)) return false;
            
            const term = searchTerm.toLowerCase();
            return p.title.toLowerCase().includes(term) || p.description.toLowerCase().includes(term);
        });
    }, [activeTab, activeSubCategory, searchTerm, prompts, favoritedIds, currentUserId]);

    return (
        <div className="p-4 sm:p-6 lg:p-8 h-full animate-fade-in flex flex-col relative font-sans">
            <CreatePromptModal isOpen={isCreateModalOpen} onClose={() => { setCreateModalOpen(false); setPromptToEdit(null); }} onSave={async (data, id) => {
                const content = JSON.stringify({ ...data, authorName: userNickname });
                if (id) await updatePrompt(id, { title: data.title, content, main_category: data.category });
                else await savePrompt(data.title, content, data.category, data.subCategories[0] as string);
                setCreateModalOpen(false); loadData(true);
            }} promptToEdit={promptToEdit} />
            
            <DeleteConfirmationModal isOpen={isDeleteModalOpen} onClose={() => setDeleteModalOpen(false)} onConfirm={async () => {
                if (promptToDelete) { await deletePrompt(promptToDelete.id); loadData(true); setDeleteModalOpen(false); }
            }} />
            
            <PromptDetailModal isOpen={isDetailModalOpen} onClose={() => setDetailModalOpen(false)} prompt={selectedPrompt} />
            <SuccessToast message={successMessage} isVisible={showSuccessToast} />
            
            <div className="flex flex-col gap-4 mb-6 flex-shrink-0">
                <div className="flex justify-between items-center">
                    <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide flex-1">
                        {CATEGORY_TABS.map(tab => (
                            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`px-4 py-2 rounded-xl font-semibold whitespace-nowrap transition-all text-sm ${activeTab === tab.id ? 'bg-sky-600 text-white shadow-md' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100'}`}>{tab.label}</button>
                        ))}
                    </div>
                    
                    <div className="flex gap-2 flex-shrink-0 ml-4">
                         <button onClick={() => setActiveTab('my-prompts')} className={`flex items-center gap-2 px-3 py-2 rounded-xl font-semibold transition-all text-sm ${activeTab === 'my-prompts' ? 'bg-sky-100 text-sky-600' : 'bg-white dark:bg-gray-800 text-gray-500'}`}><UserCircle className="w-4 h-4" />我的提示词</button>
                         <button onClick={() => setActiveTab('favorites')} className={`flex items-center gap-2 px-3 py-2 rounded-xl font-semibold transition-all text-sm ${activeTab === 'favorites' ? 'bg-red-100 text-red-600' : 'bg-white dark:bg-gray-800 text-gray-500'}`}><Heart className="w-4 h-4" />我的收藏</button>
                        <button onClick={() => { setPromptToEdit(null); setCreateModalOpen(true); }} className="px-4 py-2 rounded-xl font-bold bg-sky-600 text-white hover:bg-sky-500 shadow-lg shadow-sky-500/20 text-sm flex items-center gap-1"><Plus className="w-4 h-4" />创建</button>
                    </div>
                </div>

                <div className="flex flex-col lg:flex-row gap-4 justify-between items-start bg-gray-100 dark:bg-gray-900/50 p-3 rounded-xl">
                    <div className="flex-1 w-full space-y-2">
                        <div className="flex flex-wrap gap-2 items-center">
                            <span className="text-xs font-bold text-gray-400 mr-1 shrink-0">功能:</span>
                            <button onClick={() => setActiveSubCategory('all')} className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${activeSubCategory === 'all' ? 'bg-sky-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-500'}`}>全部</button>
                            {FUNCTIONAL_TAGS.map(cat => (
                                <button key={cat.id} onClick={() => setActiveSubCategory(cat.id as any)} className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${activeSubCategory === cat.id ? 'bg-sky-100 text-sky-700' : 'bg-white dark:bg-gray-800 text-gray-500'}`}>{cat.label}</button>
                            ))}
                        </div>
                        <div className="flex flex-wrap gap-2 items-center border-t border-gray-200 dark:border-gray-700 pt-2">
                            <span className="text-xs font-bold text-gray-400 mr-1 shrink-0">题材:</span>
                            {GENRE_TAGS.map(cat => (
                                <button key={cat.id} onClick={() => setActiveSubCategory(cat.id as any)} className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${activeSubCategory === cat.id ? 'bg-purple-100 text-purple-700' : 'bg-white dark:bg-gray-800 text-gray-500'}`}>{cat.label}</button>
                            ))}
                        </div>
                    </div>
                    <div className="relative w-full lg:w-64 self-center">
                        <span className="absolute inset-y-0 left-0 pl-3 flex items-center"><Search className="w-4 h-4 text-gray-400" /></span>
                        <input type="text" placeholder="搜索..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-9 pr-4 py-2 bg-white dark:bg-gray-800 text-sm rounded-lg border border-gray-200 focus:ring-2 focus:ring-sky-500 outline-none" />
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 -mr-2">
                {isLoading ? (
                    <div className="flex items-center justify-center h-64"><div className="w-10 h-10 border-4 border-t-sky-500 rounded-full animate-spin"></div></div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-10">
                        {filteredPrompts.map(prompt => (
                            <PromptCard key={prompt.id} prompt={prompt} onSelect={setSelectedPrompt} onDelete={setPromptToDelete} onEdit={handleEditPrompt} isFavorited={favoritedIds.has(prompt.id)} onToggleFavorite={toggleFavorite} isOwner={prompt.userId === currentUserId} />
                        ))}
                        {filteredPrompts.length === 0 && (
                            <div className="col-span-full flex flex-col items-center justify-center py-20 text-gray-400">
                                <Box className="w-16 h-16 mb-4 opacity-20" /><p>暂无相关提示词，换个筛选条件试试吧！</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

const CATEGORY_TABS = [
  { id: 'all', label: '全部' },
  { id: 'short-story', label: '短篇小说' },
  { id: 'long-story', label: '长篇小说' },
  { id: 'script', label: '剧本' },
  { id: 'general', label: '全类型' },
];

export default PromptLibrary;
