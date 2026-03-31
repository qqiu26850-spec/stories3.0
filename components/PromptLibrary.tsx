
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Prompt, PromptCategory, PromptSubCategory } from '../types';
import PromptCard from './PromptCard';
import CreatePromptModal from './CreatePromptModal';
import DeleteConfirmationModal from './DeleteConfirmationModal';
import PromptDetailModal from './PromptDetailModal';
import { Plus, Heart, UserCircle, Check, Sparkles, Box, Search, ArrowPath } from './Icon';
import { savePrompt, fetchPrompts, deletePrompt, getCurrentUserId, fetchUserProfile, updatePrompt, fetchPromptFavorites, togglePromptFavoriteDB, incrementPromptHeat } from '../services/supabaseService';
import { FUNCTIONAL_TAGS, GENRE_TAGS, MARKETING_TAGS, IMAGE_TAGS } from '../constants';

interface PromptLibraryProps {
    onNavigateToGeneration?: (prompt: Prompt, values: Record<string, string>) => void;
    isActive: boolean;
    mode: 'novel' | 'marketing' | 'image';
}

const SUB_CATEGORY_LABELS: Record<string, string> = {
    'idea': '创意', 'golden_finger': '金手指', 'character_design': '人物设定', 'worldview': '世界观',
    'outline': '大纲', 'detailed_outline': '细纲', 'synopsis': '简介', 'requirements': '写作要求',
    'style': '写作风格', 'continue': '续写', 'polish': '润色', 'expand': '扩写', 'proofread': '审稿', 'imitate': '仿写',
    'short_story_lead': '短篇导语',
    'general': '通用', 'modern-romance': '现言', 'ancient-romance': '古言', 'period': '年代',
    'apocalypse': '末世', 'urban': '都市', 'fantasy': '玄幻', 'history': '历史', 'social': '世情',
    'suspense': '悬疑', 'sci-fi': '科幻', 'comic-drama': '漫剧', 'live-action': '实拍剧',
    // Marketing
    'social_media': '社交媒体', 'ad_copy': '广告文案', 'e_commerce': '电商详情', 'email': '邮件营销', 
    'video_script': '短视频脚本', 'article': '公众号文章', 'slogan': 'Slogan/标语',
    // Image
    'realistic': '写实摄影', 'anime': '动漫二次元', 'illustration': '插画', 'cyberpunk': '赛博朋克', 
    'oil_painting': '油画', 'watercolor': '水彩', '3d_render': '3D渲染', 'pixel_art': '像素风', 
    'chinese_style': '国风', 'logo_design': 'Logo设计', 'poster': '海报设计'
};

const NOVEL_TABS = [
  { id: 'all', label: '全部' },
  { id: 'short-story', label: '短篇小说' },
  { id: 'long-story', label: '长篇小说' },
  { id: 'script', label: '剧本' },
  { id: 'general', label: '全类型' },
];

const PromptLibrary: React.FC<PromptLibraryProps> = ({ onNavigateToGeneration, isActive, mode }) => {
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
    
    // Pagination State
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    
    const observerTarget = useRef(null);
    const loadingRef = useRef(false); // Ref to track loading state for safer concurrent checks

    // Initialize Favorites & User ID
    useEffect(() => {
        const init = async () => {
            const uid = await getCurrentUserId();
            setCurrentUserId(uid);
            
            // Load favorites from DB
            const favs = await fetchPromptFavorites();
            setFavoritedIds(new Set(favs));
        };
        init();
    }, []);

    // Data Fetching Logic
    const fetchAndMapPrompts = async (pageNum: number, currentTab: string, search: string) => {
        const options: any = { page: pageNum, limit: 20, search };

        if (currentTab === 'my-prompts') {
            const uid = await getCurrentUserId();
            if (!uid) return [];
            options.userId = uid;
        } else if (currentTab === 'favorites') {
            const ids = Array.from(favoritedIds);
            if (ids.length === 0) return [];
            options.ids = ids;
        } else {
            if (mode === 'novel') {
                if (currentTab !== 'all') options.category = currentTab;
                else options.categories = ['short-story', 'long-story', 'script', 'general'];
            } else if (mode === 'marketing') {
                options.category = 'marketing';
            } else if (mode === 'image') {
                options.category = 'image';
            }
        }

        const fetchedData = await fetchPrompts(options);
        
        if (fetchedData && fetchedData.length > 0) {
            const userId = await getCurrentUserId();
            const mappedPrompts: Prompt[] = fetchedData.map((p: any) => {
                let parsedContent: any = {};
                try { parsedContent = JSON.parse(p.content); } catch (e) { parsedContent = { template: p.content }; }

                let appCat: PromptCategory = 'short-story';
                if(p.main_category === 'long') appCat = 'long-story';
                else if(p.main_category === 'script') appCat = 'script';
                else if(p.main_category === 'short') appCat = 'short-story';
                else if(p.main_category === 'general') appCat = 'general';
                else if(p.main_category === 'marketing') appCat = 'marketing';
                else if(p.main_category === 'image') appCat = 'image';
                else appCat = p.main_category as PromptCategory;

                return {
                    id: p.id,
                    title: p.title,
                    description: p.description || parsedContent.description || '用户自定义提示词',
                    example: parsedContent.example || '',
                    content: parsedContent.template || p.content,
                    category: appCat,
                    subCategories: parsedContent.subCategories || [p.sub_category],
                    fields: parsedContent.fields || [], 
                    template: parsedContent.template || p.content,
                    heat: p.usage_count || 0,
                    creator: p.user_id === userId ? 'user' : 'system',
                    userId: p.user_id,
                    authorName: p.profiles?.username || parsedContent.authorName || '匿名用户',
                    createdAt: p.created_at
                };
            });
            return mappedPrompts;
        }
        return [];
    };

    // Load data when activeTab changes or view becomes active
    const loadData = useCallback(async (reset = true) => {
        if (loadingRef.current) return;
        
        loadingRef.current = true;
        if (reset) {
            setIsLoading(true);
            setPage(1);
            setHasMore(true);
            setPrompts([]);
        } else {
            setIsLoadingMore(true);
        }

        try {
            const targetPage = reset ? 1 : page + 1;
            // Ensure favoritedIds are fresh when loading favorites tab
            if (activeTab === 'favorites') {
                 const favs = await fetchPromptFavorites();
                 setFavoritedIds(new Set(favs));
            }
            const mappedPrompts = await fetchAndMapPrompts(targetPage, activeTab, searchTerm);
            
            if (reset) {
                setPrompts(mappedPrompts);
                setPage(1);
            } else {
                setPrompts(prev => {
                    // Filter duplicates based on ID
                    const existingIds = new Set(prev.map(p => p.id));
                    const newPrompts = mappedPrompts.filter(p => !existingIds.has(p.id));
                    return [...prev, ...newPrompts];
                });
                setPage(targetPage);
            }

            if (mappedPrompts.length < 20) setHasMore(false);
        } catch (error) { 
            console.error("加载数据失败", error); 
        } finally { 
            setIsLoading(false); 
            setIsLoadingMore(false);
            loadingRef.current = false;
        }
    }, [activeTab, page, favoritedIds, searchTerm]);

    // Trigger load on search term change (debounced) or tab change
    useEffect(() => {
        const delayDebounceFn = setTimeout(() => {
            if (isActive) {
                loadData(true);
            }
        }, 500);

        return () => clearTimeout(delayDebounceFn);
    }, [searchTerm, isActive, activeTab]);

    useEffect(() => {
        if (isActive) {
            // Initial load is covered by the debounced effect as searchTerm starts empty.
            // But if we switch back to this tab, we might want to reload.
            // The dependency array includes isActive so it triggers.
        }
    }, [isActive]);

    // Infinite Scroll Observer
    useEffect(() => {
        const observer = new IntersectionObserver(
            entries => {
                if (entries[0].isIntersecting && hasMore && !isLoading && !isLoadingMore) {
                    loadData(false);
                }
            },
            { threshold: 0.1 }
        );

        if (observerTarget.current) {
            observer.observe(observerTarget.current);
        }

        return () => {
            if (observerTarget.current) {
                observer.unobserve(observerTarget.current);
            }
        };
    }, [hasMore, isLoading, isLoadingMore, loadData]);

    const toggleFavorite = async (id: string) => {
        const isFav = favoritedIds.has(id);
        setFavoritedIds(prev => {
            const next = new Set(prev);
            if (isFav) next.delete(id);
            else next.add(id);
            return next;
        });
        // DB Persist
        await togglePromptFavoriteDB(id, isFav);
    };

    const handleSelectPrompt = (prompt: Prompt) => {
        setSelectedPrompt(prompt);
        setDetailModalOpen(true);
        // 修复：选择提示词时即增加热度（使用次数）
        if (prompt.id) {
            incrementPromptHeat(prompt.id);
        }
    };

    const handleEditPrompt = (prompt: Prompt) => {
        setPromptToEdit(prompt);
        setCreateModalOpen(true);
    };

    const handleRunPrompt = (filledValues: Record<string, string>) => {
        if (selectedPrompt && onNavigateToGeneration) {
            onNavigateToGeneration(selectedPrompt, filledValues);
            setDetailModalOpen(false);
        }
    };

    // Client-side filtering for SubCategories only (server handles search text)
    const filteredPrompts = useMemo(() => {
        return prompts.filter(p => {
            if (activeSubCategory !== 'all' && !p.subCategories.includes(activeSubCategory as PromptSubCategory)) return false;
            return true;
        });
    }, [activeSubCategory, prompts]);

    const handleOpenDelete = (prompt: Prompt) => {
        setPromptToDelete(prompt);
        setDeleteModalOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (promptToDelete) {
            try {
                await deletePrompt(promptToDelete.id);
                setSuccessMessage('已删除');
                setShowSuccessToast(true);
                setTimeout(() => setShowSuccessToast(false), 2000); 
                loadData(true);
            } catch (e) {
                console.error("删除失败", e);
            } finally {
                setDeleteModalOpen(false);
                setPromptToDelete(null);
            }
        }
    };

    return (
        <div className="p-4 sm:p-6 lg:p-8 h-full animate-fade-in flex flex-col relative font-sans">
            <CreatePromptModal isOpen={isCreateModalOpen} onClose={() => { setCreateModalOpen(false); setPromptToEdit(null); }} onSave={async (data, id) => {
                const profile = await fetchUserProfile();
                const content = JSON.stringify({ ...data, authorName: profile?.nickname || '社区用户' });
                if (id) await updatePrompt(id, { title: data.title, content, main_category: data.category });
                else await savePrompt(data.title, content, data.category, data.subCategories[0] as string);
                setCreateModalOpen(false); 
                loadData(true);
                setSuccessMessage(id ? '已更新' : '已发布');
                setShowSuccessToast(true);
                setTimeout(() => setShowSuccessToast(false), 2000); 
            }} promptToEdit={promptToEdit} />
            
            <DeleteConfirmationModal isOpen={isDeleteModalOpen} onClose={() => setDeleteModalOpen(false)} onConfirm={handleConfirmDelete} />
            
            <PromptDetailModal 
                isOpen={isDetailModalOpen} 
                onClose={() => setDetailModalOpen(false)} 
                prompt={selectedPrompt} 
                onRun={handleRunPrompt}
            />
            
            <div className="flex flex-col gap-4 mb-6 flex-shrink-0">
                <div className="flex justify-between items-center flex-wrap gap-4">
                    <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide flex-1 min-w-[300px]">
                        {mode === 'novel' && NOVEL_TABS.map(tab => (
                            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`px-4 py-2 rounded-xl font-semibold whitespace-nowrap transition-all text-sm ${activeTab === tab.id ? 'bg-sky-600 text-white shadow-md' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100'}`}>{tab.label}</button>
                        ))}
                        {mode === 'marketing' && (
                             <button onClick={() => setActiveTab('all')} className={`px-4 py-2 rounded-xl font-semibold whitespace-nowrap transition-all text-sm ${activeTab === 'all' ? 'bg-sky-600 text-white shadow-md' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100'}`}>全部营销文案</button>
                        )}
                        {mode === 'image' && (
                             <button onClick={() => setActiveTab('all')} className={`px-4 py-2 rounded-xl font-semibold whitespace-nowrap transition-all text-sm ${activeTab === 'all' ? 'bg-sky-600 text-white shadow-md' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100'}`}>全部图片风格</button>
                        )}
                    </div>
                    
                    <div className="flex items-center gap-3 flex-shrink-0 flex-wrap">
                        {showSuccessToast && (
                            <span className="text-xs font-bold text-emerald-500 animate-fade-in-up flex items-center gap-1.5 whitespace-nowrap">
                                <div className="w-5 h-5 bg-emerald-50 dark:bg-emerald-900/30 rounded-full flex items-center justify-center">
                                    <Check className="w-3 h-3" />
                                </div>
                                {successMessage}
                            </span>
                        )}
                        <div className="flex gap-2 items-center flex-wrap">
                             <div className="relative w-48 sm:w-64">
                                <span className="absolute inset-y-0 left-0 pl-3 flex items-center"><Search className="w-4 h-4 text-gray-400" /></span>
                                <input type="text" placeholder="搜索标题、作者、标签..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-9 pr-4 py-2 bg-white dark:bg-gray-800 text-sm rounded-xl border border-gray-200 focus:ring-2 focus:ring-sky-500 outline-none" />
                             </div>

                             <button onClick={() => setActiveTab('my-prompts')} className={`flex items-center gap-2 px-3 py-2 rounded-xl font-semibold transition-all text-sm ${activeTab === 'my-prompts' ? 'bg-sky-100 text-sky-600' : 'bg-white dark:bg-gray-800 text-gray-500'}`}><UserCircle className="w-4 h-4" />我的提示词</button>
                             
                             <button onClick={() => setActiveTab('favorites')} className={`flex items-center gap-2 px-3 py-2 rounded-xl font-semibold transition-all text-sm ${activeTab === 'favorites' ? 'bg-red-100 text-red-600' : 'bg-white dark:bg-gray-800 text-gray-500'}`}><Heart className="w-4 h-4" />我的收藏</button>
                            <button onClick={() => { setPromptToEdit(null); setCreateModalOpen(true); }} className="px-4 py-2 rounded-xl font-bold bg-sky-600 text-white hover:bg-sky-500 shadow-lg shadow-sky-500/20 text-sm flex items-center gap-1"><Plus className="w-4 h-4" />创建</button>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col gap-4 justify-between items-start bg-gray-100 dark:bg-gray-900/50 p-3 rounded-xl">
                    <div className="w-full space-y-2">
                        {mode === 'novel' && (
                            <>
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
                            </>
                        )}
                        
                        {mode === 'marketing' && (
                            <div className="flex flex-wrap gap-2 items-center">
                                <span className="text-xs font-bold text-gray-400 mr-1 shrink-0">类型:</span>
                                <button onClick={() => setActiveSubCategory('all')} className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${activeSubCategory === 'all' ? 'bg-sky-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-500'}`}>全部</button>
                                {MARKETING_TAGS.map(cat => (
                                    <button key={cat.id} onClick={() => setActiveSubCategory(cat.id as any)} className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${activeSubCategory === cat.id ? 'bg-sky-100 text-sky-700' : 'bg-white dark:bg-gray-800 text-gray-500'}`}>{cat.label}</button>
                                ))}
                            </div>
                        )}
                        
                        {mode === 'image' && (
                            <div className="flex flex-wrap gap-2 items-center">
                                <span className="text-xs font-bold text-gray-400 mr-1 shrink-0">风格:</span>
                                <button onClick={() => setActiveSubCategory('all')} className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${activeSubCategory === 'all' ? 'bg-sky-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-500'}`}>全部</button>
                                {IMAGE_TAGS.map(cat => (
                                    <button key={cat.id} onClick={() => setActiveSubCategory(cat.id as any)} className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${activeSubCategory === cat.id ? 'bg-sky-100 text-sky-700' : 'bg-white dark:bg-gray-800 text-gray-500'}`}>{cat.label}</button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 -mr-2">
                {isLoading ? (
                    <div className="flex items-center justify-center h-64"><div className="w-10 h-10 border-4 border-t-sky-500 rounded-full animate-spin"></div></div>
                ) : (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-6">
                            {filteredPrompts.map(prompt => (
                                <PromptCard key={prompt.id} prompt={prompt} onSelect={handleSelectPrompt} onDelete={handleOpenDelete} onEdit={handleEditPrompt} isFavorited={favoritedIds.has(prompt.id)} onToggleFavorite={toggleFavorite} isOwner={prompt.userId === currentUserId} />
                            ))}
                            {filteredPrompts.length === 0 && (
                                <div className="col-span-full flex flex-col items-center justify-center py-20 text-gray-400">
                                    <Box className="w-16 h-16 mb-4 opacity-20" /><p>暂无相关提示词，换个筛选条件试试吧！</p>
                                </div>
                            )}
                        </div>
                        {hasMore && (
                            <div ref={observerTarget} className="py-4 text-center flex justify-center">
                                <div className="w-6 h-6 border-2 border-sky-500 border-t-transparent rounded-full animate-spin"></div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default PromptLibrary;
