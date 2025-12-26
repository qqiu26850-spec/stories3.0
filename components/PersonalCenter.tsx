
import React, { useState, useEffect } from 'react';
import { UserProfile, Asset, Prompt } from '../types';
import EditProfileModal from './EditProfileModal';
import { Pencil, UserCircle, Sparkles, BookOpen, Box, ArrowPath } from './Icon';
import { fetchUserLibrary, getCurrentUserId, deleteUserData, updateUserProfile } from '../services/supabaseService';

const MOCK_USER_PROFILE: UserProfile = {
    id: 'user-123',
    nickname: '奇思妙想家',
    avatarUrl: 'https://source.unsplash.com/random/200x200?avatar,person',
    email: 'user@example.com' // Mock email
};

// --- Retention Modal ---
const RetentionModal: React.FC<{ isOpen: boolean; onClose: () => void; onConfirm: () => void }> = ({ isOpen, onClose, onConfirm }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/60 dark:bg-black/80 flex items-center justify-center z-[9999] p-4 backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-900 w-full max-w-md rounded-2xl p-6 shadow-2xl animate-fade-in-up">
                <div className="text-center mb-6">
                    <div className="w-16 h-16 bg-sky-100 dark:bg-sky-900/30 rounded-full flex items-center justify-center mx-auto mb-4 text-4xl">
                        🥺
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">真的要离开吗？</h3>
                    <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">
                        退出登录后，您未保存的灵感可能会丢失。<br/>
                        AI 助手会在这里等您回来继续创作。
                    </p>
                </div>
                <div className="flex gap-3">
                    <button 
                        onClick={onConfirm}
                        className="flex-1 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 font-medium transition-colors"
                    >
                        狠心退出
                    </button>
                    <button 
                        onClick={onClose}
                        className="flex-1 py-2.5 rounded-lg bg-sky-600 text-white font-bold hover:bg-sky-500 transition-colors shadow-lg shadow-sky-500/20"
                    >
                        我再想想
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- Destroy Account Modal ---
const DestroyAccountModal: React.FC<{ isOpen: boolean; onClose: () => void; onConfirm: () => void }> = ({ isOpen, onClose, onConfirm }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/60 dark:bg-black/80 flex items-center justify-center z-[9999] p-4 backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-900 w-full max-w-md rounded-2xl p-6 shadow-2xl animate-fade-in-up border border-red-100 dark:border-red-900/30">
                <div className="text-center mb-6">
                    <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl text-red-500">
                        ⚠️
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">确定要注销账号吗？</h3>
                    <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">
                        此操作将<strong className="text-red-500">永久删除</strong>您所有的小说、剧本和素材数据。<br/>
                        您的提示词和工作流将被保留。<br/>
                        此操作不可撤销！
                    </p>
                </div>
                <div className="flex gap-3">
                    <button 
                        onClick={onClose}
                        className="flex-1 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 font-medium transition-colors"
                    >
                        取消
                    </button>
                    <button 
                        onClick={onConfirm}
                        className="flex-1 py-2.5 rounded-lg bg-red-600 text-white font-bold hover:bg-red-500 transition-colors shadow-lg shadow-red-500/20"
                    >
                        确认注销
                    </button>
                </div>
            </div>
        </div>
    );
};

type LibraryTab = 'prompt' | 'character' | 'plot' | 'inspiration';

interface PersonalCenterProps {
    onLogout: () => void;
}

const PersonalCenter: React.FC<PersonalCenterProps> = ({ onLogout }) => {
    const [userProfile, setUserProfile] = useState<UserProfile>(MOCK_USER_PROFILE);
    const [isEditModalOpen, setEditModalOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<LibraryTab>('prompt');
    const [isRetentionModalOpen, setRetentionModalOpen] = useState(false);
    const [isDestroyModalOpen, setDestroyModalOpen] = useState(false);
    
    // Data State
    const [myPrompts, setMyPrompts] = useState<any[]>([]);
    const [myMaterials, setMyMaterials] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const init = async () => {
            const userId = await getCurrentUserId();
            const profile = await fetchUserLibrary();
            // Fetch basic profile info from Auth metadata
            import('../services/supabaseService').then(async (module) => {
                const metaProfile = await module.fetchUserProfile();
                if(metaProfile && userId) {
                    setUserProfile({
                        id: userId,
                        nickname: metaProfile.nickname || '奇思妙想家',
                        avatarUrl: metaProfile.avatarUrl,
                        email: metaProfile.email
                    });
                }
            });
            
            setMyPrompts(profile.prompts);
            setMyMaterials(profile.materials);
            setIsLoading(false);
        };
        init();
    }, []);

    const handleProfileUpdate = async (newNickname: string, newAvatarUrl: string | null) => {
        // Save to Supabase Auth Metadata. We no longer allow email updates here.
        await updateUserProfile(newNickname, newAvatarUrl);
        // Update local state
        setUserProfile(prev => ({ ...prev, nickname: newNickname, avatarUrl: newAvatarUrl }));
    };

    const handleDestroyAccount = async () => {
        const success = await deleteUserData();
        if (success) {
            // Reload page to clear state and show login modal
            window.location.reload();
        }
    };

    const renderLibraryContent = () => {
        if (isLoading) {
            return <div className="p-8 text-center text-gray-400"><ArrowPath className="w-6 h-6 mx-auto animate-spin mb-2"/>加载中...</div>;
        }

        let items: any[] = [];
        let emptyMessage = "";

        switch(activeTab) {
            case 'prompt':
                items = myPrompts;
                emptyMessage = "您还没有创建过任何提示词。";
                break;
            case 'character':
                items = myMaterials.filter(m => m.type === 'character');
                emptyMessage = "您还没有创建过角色素材。";
                break;
            case 'plot':
                items = myMaterials.filter(m => m.type === 'plot');
                emptyMessage = "您还没有创建过剧情素材。";
                break;
            case 'inspiration':
                items = myMaterials.filter(m => m.type === 'idea');
                emptyMessage = "您还没有记录过灵感素材。";
                break;
        }

        if (items.length === 0) {
            return (
                <div className="p-12 text-center border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-xl bg-gray-50 dark:bg-gray-900/50 text-gray-400 dark:text-gray-500">
                    <Box className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>{emptyMessage}</p>
                </div>
            );
        }

        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {items.map((item) => (
                    <div key={item.id} className="bg-white dark:bg-gray-900 p-5 rounded-xl border border-gray-200 dark:border-gray-800 hover:border-sky-400 transition-colors group relative">
                        <div className="flex justify-between items-start mb-2">
                            <h4 className="font-bold text-gray-900 dark:text-white truncate pr-2 flex-1">{item.title || item.name}</h4>
                            <span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-500 px-2 py-1 rounded">
                                {new Date(item.created_at).toLocaleDateString()}
                            </span>
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-3 h-16 mb-2 leading-relaxed">
                            {activeTab === 'prompt' ? (JSON.parse(item.content).description || '无描述') : item.content}
                        </p>
                        <div className="pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center gap-2">
                            {item.tags && item.tags.map((tag: string, i: number) => (
                                <span key={i} className="text-xs px-2 py-0.5 rounded bg-sky-50 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400">#{tag}</span>
                            ))}
                            {(!item.tags || item.tags.length === 0) && <span className="text-xs text-gray-300 italic">未分类</span>}
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    return (
        <div className="p-4 sm:p-6 lg:p-8 h-full">
            <EditProfileModal
                isOpen={isEditModalOpen}
                onClose={() => setEditModalOpen(false)}
                onSave={handleProfileUpdate}
                currentUser={userProfile}
            />
            <RetentionModal 
                isOpen={isRetentionModalOpen} 
                onClose={() => setRetentionModalOpen(false)} 
                onConfirm={onLogout} 
            />
            <DestroyAccountModal 
                isOpen={isDestroyModalOpen} 
                onClose={() => setDestroyModalOpen(false)} 
                onConfirm={handleDestroyAccount} 
            />

            <div className="space-y-8 animate-fade-in max-w-6xl mx-auto">
                {/* Profile Header */}
                <div className="bg-white dark:bg-gray-900 rounded-2xl p-8 flex flex-col md:flex-row items-center gap-8 border border-gray-200 dark:border-gray-800 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 flex gap-2">
                         <button
                            onClick={() => setRetentionModalOpen(true)}
                            className="px-4 py-2 text-sm font-bold text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 rounded-lg transition-colors"
                        >
                            退出登录
                        </button>
                        <button
                            onClick={() => setDestroyModalOpen(true)}
                            className="px-4 py-2 text-sm font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        >
                            注销账号
                        </button>
                    </div>

                    <div className="w-28 h-28 rounded-full overflow-hidden flex-shrink-0 border-4 border-white dark:border-gray-800 shadow-lg relative">
                        {userProfile.avatarUrl ? (
                            <img src={userProfile.avatarUrl} alt="User Avatar" className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full bg-sky-100 dark:bg-sky-900 flex items-center justify-center">
                                <UserCircle className="w-16 h-16 text-sky-500 dark:text-sky-300" />
                            </div>
                        )}
                        <button 
                            onClick={() => setEditModalOpen(true)}
                            className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs py-1 text-center opacity-0 hover:opacity-100 transition-opacity"
                        >
                            更换
                        </button>
                    </div>
                    
                    <div className="flex-grow text-center md:text-left">
                        <div className="mb-2">
                            <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center justify-center md:justify-start gap-3">
                                {userProfile.nickname}
                                <button onClick={() => setEditModalOpen(true)} className="text-gray-400 hover:text-sky-500 transition-colors">
                                    <Pencil className="w-5 h-5" />
                                </button>
                            </h1>
                            {userProfile.email && (
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 font-mono">
                                    {userProfile.email}
                                </p>
                            )}
                        </div>
                        <div className="flex flex-wrap justify-center md:justify-start gap-4 text-sm text-gray-500 dark:text-gray-400 mt-4">
                            <div className="flex items-center gap-1">
                                <Box className="w-4 h-4" />
                                <span>提示词: {myPrompts.length}</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <BookOpen className="w-4 h-4" />
                                <span>素材: {myMaterials.length}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Library Section */}
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <Sparkles className="w-6 h-6 text-purple-500" />
                            我的收藏
                        </h2>
                    </div>

                    {/* Categorized Tabs */}
                    <div className="flex p-1 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 w-full md:w-fit overflow-x-auto">
                        {[
                            { id: 'prompt', label: '提示词', icon: Box },
                            { id: 'character', label: '角色', icon: UserCircle },
                            { id: 'plot', label: '剧情', icon: BookOpen },
                            { id: 'inspiration', label: '灵光', icon: Sparkles },
                        ].map((tab) => {
                            const Icon = tab.icon;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id as LibraryTab)}
                                    className={`flex items-center gap-2 px-6 py-2.5 text-sm font-bold rounded-lg transition-all whitespace-nowrap ${
                                        activeTab === tab.id 
                                        ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300 shadow-sm' 
                                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                                    }`}
                                >
                                    <Icon className="w-4 h-4" />
                                    {tab.label}
                                </button>
                            )
                        })}
                    </div>

                    {/* Content Area */}
                    <div className="min-h-[300px]">
                        {renderLibraryContent()}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PersonalCenter;
