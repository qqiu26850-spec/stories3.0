
import React, { useState } from 'react';
import { UserProfile, RechargeRecord, FavoriteItem } from '../types';
import EditProfileModal from './EditProfileModal';
import { Pencil, CreditCard, Heart, UserCircle, Sparkles, BookOpen, Film, ChartBar } from './Icon';

const MOCK_USER_PROFILE: UserProfile = {
    id: 'user-123',
    nickname: '奇思妙想家',
    avatarUrl: 'https://source.unsplash.com/random/200x200?avatar,person',
};

const MOCK_RECHARGE_HISTORY: RechargeRecord[] = [
    { id: 'r1', date: '2024-05-20', amount: 50.00, status: 'Success' },
    { id: 'r2', date: '2024-05-18', amount: 100.00, status: 'Success' },
    { id: 'r3', date: '2024-05-15', amount: 20.00, status: 'Failed' },
    { id: 'r4', date: '2024-05-12', amount: 50.00, status: 'Success' },
];

const MOCK_FAVORITES: FavoriteItem[] = [
    { id: 'fav1', type: 'prompt', title: '短篇故事生成器', description: '需要输入: 小说类型、故事梗概' },
    { id: 'fav2', type: 'novel', title: '深空回响', description: '字数: 87,450' },
    { id: 'fav3', type: 'character', title: '主角：林夜', description: '掌握着古老“影”之力量的末代传人...' },
    { id: 'fav4', type: 'script', title: '时间裂痕', description: '字数: 15,200' },
];

const FAVORITE_ICONS: Record<FavoriteItem['type'], React.ElementType> = {
    prompt: Sparkles,
    novel: BookOpen,
    script: Film,
    character: UserCircle,
};

type ActiveTab = 'recharge' | 'favorites' | 'usage';

const PersonalCenter: React.FC = () => {
    const [userProfile, setUserProfile] = useState<UserProfile>(MOCK_USER_PROFILE);
    const [isEditModalOpen, setEditModalOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<ActiveTab>('recharge');

    const handleProfileUpdate = (newNickname: string, newAvatarUrl: string | null) => {
        setUserProfile(prev => ({ ...prev, nickname: newNickname, avatarUrl: newAvatarUrl }));
    };

    const renderTabContent = () => {
        if (activeTab === 'recharge') {
            return (
                <div className="bg-white dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-800">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 dark:bg-gray-800 text-xs text-gray-500 dark:text-gray-400 uppercase">
                            <tr>
                                <th className="p-3">日期</th>
                                <th className="p-3">金额 (元)</th>
                                <th className="p-3 text-right">状态</th>
                            </tr>
                        </thead>
                        <tbody>
                            {MOCK_RECHARGE_HISTORY.map(record => (
                                <tr key={record.id} className="border-b border-gray-200 dark:border-gray-800">
                                    <td className="p-3">{record.date}</td>
                                    <td className="p-3 font-mono">{record.amount.toFixed(2)}</td>
                                    <td className="p-3 text-right">
                                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${record.status === 'Success' ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-400' : 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-400'}`}>
                                            {record.status === 'Success' ? '成功' : '失败'}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            );
        }

        if (activeTab === 'favorites') {
            return (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {MOCK_FAVORITES.map(item => {
                        const Icon = FAVORITE_ICONS[item.type];
                        return (
                            <div key={item.id} className="bg-white dark:bg-gray-900 p-4 rounded-lg border border-gray-200 dark:border-gray-800 flex items-start gap-4">
                                <div className="p-2 bg-sky-100 dark:bg-sky-900/50 rounded-full">
                                   <Icon className="w-6 h-6 text-sky-500 dark:text-sky-400" />
                                </div>
                                <div>
                                    <h4 className="font-semibold text-gray-900 dark:text-white">{item.title}</h4>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-1">{item.description}</p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            );
        }

        if (activeTab === 'usage') {
            return (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Usage Stats Cards */}
                    <div className="bg-white dark:bg-gray-900 p-6 rounded-lg border border-gray-200 dark:border-gray-800">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">本月 Token 消耗</h3>
                        <div className="flex items-end gap-2">
                            <span className="text-4xl font-bold text-sky-600 dark:text-sky-400">1,234,560</span>
                            <span className="text-sm text-gray-500 dark:text-gray-400 mb-1">Tokens</span>
                        </div>
                        <div className="mt-4 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                            <div className="bg-sky-600 h-2.5 rounded-full" style={{ width: '45%' }}></div>
                        </div>
                        <p className="text-xs text-gray-400 mt-2">已使用套餐额度的 45%</p>
                    </div>

                    <div className="bg-white dark:bg-gray-900 p-6 rounded-lg border border-gray-200 dark:border-gray-800">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">API 调用次数</h3>
                        <div className="flex items-end gap-2">
                            <span className="text-4xl font-bold text-purple-600 dark:text-purple-400">328</span>
                            <span className="text-sm text-gray-500 dark:text-gray-400 mb-1">次</span>
                        </div>
                         <div className="mt-4 flex gap-2">
                            <span className="text-xs px-2 py-1 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300 rounded">成功率 99.8%</span>
                         </div>
                    </div>

                    {/* Model Usage Distribution */}
                    <div className="bg-white dark:bg-gray-900 p-6 rounded-lg border border-gray-200 dark:border-gray-800 md:col-span-2">
                         <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">模型使用分布</h3>
                         <div className="space-y-4">
                            <div>
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="text-gray-700 dark:text-gray-300">Gemini 2.5 Flash</span>
                                    <span className="text-gray-500 dark:text-gray-400">75%</span>
                                </div>
                                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                    <div className="bg-blue-500 h-2 rounded-full" style={{ width: '75%' }}></div>
                                </div>
                            </div>
                            <div>
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="text-gray-700 dark:text-gray-300">Gemini 2.5 Pro</span>
                                    <span className="text-gray-500 dark:text-gray-400">20%</span>
                                </div>
                                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                    <div className="bg-purple-500 h-2 rounded-full" style={{ width: '20%' }}></div>
                                </div>
                            </div>
                            <div>
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="text-gray-700 dark:text-gray-300">其他 (GPT-4 / DeepSeek)</span>
                                    <span className="text-gray-500 dark:text-gray-400">5%</span>
                                </div>
                                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                    <div className="bg-orange-500 h-2 rounded-full" style={{ width: '5%' }}></div>
                                </div>
                            </div>
                         </div>
                    </div>
                </div>
            );
        }

        return null;
    };

    return (
        <div className="p-4 sm:p-6 lg:p-8 h-full">
            <EditProfileModal
                isOpen={isEditModalOpen}
                onClose={() => setEditModalOpen(false)}
                onSave={handleProfileUpdate}
                currentUser={userProfile}
            />
            <div className="space-y-8 animate-fade-in">
                {/* Profile Header */}
                <div className="bg-white dark:bg-gray-900 rounded-lg p-6 flex flex-col sm:flex-row items-center gap-6 border border-gray-200 dark:border-gray-800">
                    <div className="w-24 h-24 rounded-full overflow-hidden flex-shrink-0 bg-gray-200 dark:bg-gray-800">
                        {userProfile.avatarUrl ? (
                            <img src={userProfile.avatarUrl} alt="User Avatar" className="w-full h-full object-cover" />
                        ) : (
                            <UserCircle className="w-full h-full text-gray-400 dark:text-gray-600" />
                        )}
                    </div>
                    <div className="flex-grow text-center sm:text-left">
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{userProfile.nickname}</h1>
                        <p className="text-gray-500 dark:text-gray-400 mt-1">欢迎回来，开始新一天的创作吧！</p>
                    </div>
                    <button
                        onClick={() => setEditModalOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-sky-600 text-white font-semibold rounded-lg hover:bg-sky-500 transition-colors flex-shrink-0"
                    >
                        <Pencil className="w-5 h-5" />
                        <span>编辑资料</span>
                    </button>
                </div>

                {/* Tab Navigation */}
                <div className="bg-white dark:bg-gray-900 p-2 rounded-lg space-x-2 border border-gray-200 dark:border-gray-800 inline-flex">
                    <button
                        onClick={() => setActiveTab('recharge')}
                        className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-md transition-colors ${activeTab === 'recharge' ? 'bg-sky-600 text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800'}`}
                    >
                        <CreditCard className="w-5 h-5" />
                        <span>充值记录</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('favorites')}
                        className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-md transition-colors ${activeTab === 'favorites' ? 'bg-sky-600 text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800'}`}
                    >
                        <Heart className="w-5 h-5" />
                        <span>我的收藏</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('usage')}
                        className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-md transition-colors ${activeTab === 'usage' ? 'bg-sky-600 text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800'}`}
                    >
                        <ChartBar className="w-5 h-5" />
                        <span>我的使用</span>
                    </button>
                </div>

                {/* Tab Content */}
                <div>
                    {renderTabContent()}
                </div>
            </div>
        </div>
    );
};

export default PersonalCenter;