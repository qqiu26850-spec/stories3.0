
import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Prompt, PromptCategory, PromptSubCategory } from '../types';
import { Sparkles, Search, X } from './Icon';
import SelectablePromptCard from './SelectablePromptCard';
import { fetchPrompts } from '../services/supabaseService';
import { FUNCTIONAL_TAGS, GENRE_TAGS } from '../constants';

interface PromptSelectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (prompt: Prompt) => void;
    initialSubCategory?: PromptSubCategory;
}

const CATEGORY_TABS: { id: PromptCategory | 'all'; label: string }[] = [
  { id: 'all', label: '全部' },
  { id: 'short-story', label: '短篇小说' },
  { id: 'long-story', label: '长篇小说' },
  { id: 'script', label: '剧本' },
  { id: 'general', label: '全类型' }, // Updated from 通用 to 全类型
];

const PromptSelectionModal: React.FC<PromptSelectionModalProps> = ({ isOpen, onClose, onSelect, initialSubCategory }) => {
    const [activeTab, setActiveTab] = useState<PromptCategory | 'all'>('all');
    const [activeSubCategory, setActiveSubCategory] = useState<PromptSubCategory | 'all'>('all');
    const [searchTerm, setSearchTerm] = useState('');
    // Initial state is empty to match PromptLibrary behavior
    const [allPrompts, setAllPrompts] = useState<Prompt[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Reset filter when opened with a specific subcategory
    useEffect(() => {
        if (isOpen) {
            if (initialSubCategory) {
                setActiveSubCategory(initialSubCategory);
            } else {
                setActiveSubCategory('all');
            }
            setSearchTerm('');
        }
    }, [isOpen, initialSubCategory]);

    useEffect(() => {
        if (!isOpen) return;
        
        const loadPrompts = async () => {
            setIsLoading(true);
            const dbPrompts = await fetchPrompts('all'); // Fetch all to utilize cache
            
            if (dbPrompts) {
                const mapped: Prompt[] = dbPrompts.map((p: any) => {
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
                        parsedContent = { template: p.content };
                    }

                    const tags = parsedContent.subCategories || (p.sub_category ? [p.sub_category as any] : []);

                    return {
                        id: p.id,
                        title: p.title,
                        description: parsedContent.description || '用户自定义提示词',
                        example: parsedContent.example || '', // Load example
                        content: parsedContent.template || p.content,
                        category: appCat,
                        subCategories: tags,
                        fields: parsedContent.fields || [],
                        template: parsedContent.template || p.content,
                        heat: p.usage_count || 0,
                        creator: 'user',
                        authorName: p.profiles?.username || parsedContent.authorName || '用户'
                    };
                });
                // Only use DB prompts to ensure consistency with Prompt Library
                setAllPrompts(mapped);
            } else {
                setAllPrompts([]);
            }
            setIsLoading(false);
        };
        loadPrompts();
    }, [isOpen]);

    const filteredPrompts = useMemo(() => {
        return allPrompts.filter(prompt => {
            const categoryMatch = activeTab === 'all' || prompt.category === activeTab;
            
            const subCategoryMatch = activeSubCategory === 'all' || 
                (prompt.subCategories && prompt.subCategories.includes(activeSubCategory as PromptSubCategory));

            const searchMatch = !searchTerm || 
                prompt.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                prompt.description.includes(searchTerm);
            
            return categoryMatch && subCategoryMatch && searchMatch;
        });
    }, [activeTab, activeSubCategory, searchTerm, allPrompts]);

    if (!isOpen) return null;

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

    return createPortal(
        <div className="fixed inset-0 bg-black/60 dark:bg-black/80 flex items-center justify-center z-[100] p-4 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-6xl h-[85vh] flex flex-col relative animate-fade-in-up overflow-hidden" onClick={e => e.stopPropagation()}>
                
                {/* Header Area */}
                <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex flex-col gap-4 bg-gray-50/50 dark:bg-gray-900/50">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-6">
                            <h3 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <Sparkles className="w-7 h-7 text-sky-500" />
                                选择提示词模板
                            </h3>
                            {/* Category Tabs */}
                            <div className="flex bg-gray-200 dark:bg-gray-800 rounded-lg p-1">
                                {CATEGORY_TABS.map(tab => (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id as any)}
                                        className={`px-4 py-1.5 text-sm font-bold rounded-md transition-all ${
                                            activeTab === tab.id 
                                            ? 'bg-white dark:bg-gray-700 text-sky-600 dark:text-sky-400 shadow-sm' 
                                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                                        }`}
                                    >
                                        {tab.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                        
                        {/* Search & Close */}
                        <div className="flex items-center gap-4">
                            <div className="relative w-64">
                                <input 
                                    type="text" 
                                    placeholder="搜索模板..." 
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-sky-500 focus:outline-none transition-shadow text-sm"
                                />
                                <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
                            </div>
                            <button onClick={onClose} className="p-2 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors">
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                    </div>

                    {/* Tag Rows */}
                    <div className="flex flex-col gap-2">
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
                </div>

                <div className="flex-1 overflow-y-auto p-6 bg-gray-50 dark:bg-black/20">
                     {isLoading ? (
                         <div className="flex items-center justify-center h-full">
                             <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-sky-500"></div>
                         </div>
                     ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                            {filteredPrompts.length > 0 ? filteredPrompts.map(prompt => (
                                <div key={prompt.id} className="h-full transform hover:scale-[1.02] transition-transform">
                                    <SelectablePromptCard
                                        prompt={prompt}
                                        onSelect={() => {
                                            onSelect(prompt);
                                            onClose();
                                        }}
                                    />
                                </div>
                            )) : (
                                <div className="col-span-full flex flex-col items-center justify-center py-32 text-gray-400">
                                    <Sparkles className="w-20 h-20 mb-6 opacity-20" />
                                    <p className="text-xl font-medium">未找到匹配的模板</p>
                                    <button onClick={() => { setActiveTab('all'); setActiveSubCategory('all'); }} className="mt-4 text-sky-500 hover:underline">
                                        清除筛选
                                    </button>
                                </div>
                            )}
                        </div>
                     )}
                </div>
            </div>
        </div>,
        document.body
    );
};

export default PromptSelectionModal;
