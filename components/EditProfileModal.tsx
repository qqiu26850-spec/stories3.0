
import React, { useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { UserCircle, InformationCircle } from './Icon';

interface EditProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (nickname: string, avatarUrl: string | null, newEmail?: string, password?: string) => void;
    currentUser: UserProfile;
}

const EditProfileModal: React.FC<EditProfileModalProps> = ({ isOpen, onClose, onSave, currentUser }) => {
    const [nickname, setNickname] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
    const [error, setError] = useState('');
    
    // Check if email has been changed by user
    const isEmailChanged = currentUser.email && email !== currentUser.email;

    useEffect(() => {
        if (isOpen) {
            setNickname(currentUser.nickname);
            setEmail(currentUser.email || '');
            setAvatarPreview(currentUser.avatarUrl);
            setPassword('');
            setError('');
        }
    }, [isOpen, currentUser]);

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onloadend = () => {
                setAvatarPreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!nickname.trim()) {
            setError('昵称不能为空。');
            return;
        }
        
        if (isEmailChanged) {
            if (!password) {
                setError('修改邮箱需要输入当前密码进行验证。');
                return;
            }
            if (!/^[^\s@]+@[^\s@]+$/.test(email)) {
                setError('请输入有效的邮箱格式。');
                return;
            }
        }

        onSave(nickname, avatarPreview, email, password);
        // Do not close immediately, let the parent handle success/loading based on async result if needed, 
        // but for now we follow existing pattern and close, parent shows toast.
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-md p-6 animate-fade-in-up" onClick={e => e.stopPropagation()}>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">编辑个人资料</h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-2">头像</label>
                        <div className="flex items-center gap-4">
                            <div className="w-20 h-20 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-800 flex-shrink-0">
                                {avatarPreview ? (
                                    <img src={avatarPreview} alt="Avatar preview" className="w-full h-full object-cover" />
                                ) : (
                                    <UserCircle className="w-full h-full text-gray-400 dark:text-gray-600" />
                                )}
                            </div>
                            <label htmlFor="avatar-upload" className="cursor-pointer bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white font-semibold py-2 px-4 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">
                                <span>更换头像</span>
                                <input id="avatar-upload" type="file" className="sr-only" accept="image/*" onChange={handleImageChange} />
                            </label>
                        </div>
                    </div>
                    
                    <div>
                        <label htmlFor="nickname" className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">昵称</label>
                        <input
                            type="text"
                            id="nickname"
                            value={nickname}
                            onChange={(e) => setNickname(e.target.value)}
                            className="w-full p-2 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md text-gray-900 dark:text-gray-200 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition"
                        />
                    </div>
                    
                    <div className="border-t border-gray-100 dark:border-gray-800 pt-2 mt-2">
                        <label htmlFor="email" className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">
                            邮箱账号 
                            {isEmailChanged && <span className="text-xs text-orange-500 ml-2">(检测到修改)</span>}
                        </label>
                        <input
                            type="email"
                            id="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="输入新邮箱地址"
                            className={`w-full p-2 bg-gray-100 dark:bg-gray-800 border rounded-md text-gray-900 dark:text-gray-200 focus:ring-2 focus:ring-sky-500 transition ${isEmailChanged ? 'border-orange-300 focus:border-orange-500' : 'border-gray-300 dark:border-gray-700'}`}
                        />
                        {isEmailChanged && (
                            <div className="mt-3 animate-fade-in space-y-3">
                                <div className="flex items-start gap-2 bg-orange-50 dark:bg-orange-900/20 p-2 rounded-lg text-xs text-orange-600 dark:text-orange-400">
                                    <InformationCircle className="w-4 h-4 shrink-0 mt-0.5" />
                                    <p>修改邮箱后，系统将向<strong>新邮箱</strong>发送确认邮件。您需要点击邮件中的链接完成更改。</p>
                                </div>
                                <div>
                                    <label htmlFor="current-password" className="block text-sm font-bold text-gray-700 dark:text-gray-200 mb-1">
                                        验证当前密码 <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="password"
                                        id="current-password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="输入当前登录密码以验证身份"
                                        className="w-full p-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 outline-none"
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {error && <p className="text-red-500 dark:text-red-400 text-sm">{error}</p>}
                    
                    <div className="flex justify-end gap-3 pt-4">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-500 dark:bg-gray-700 text-white font-semibold rounded-lg hover:bg-gray-600 dark:hover:bg-gray-600 transition-colors">
                            取消
                        </button>
                        <button type="submit" className="px-4 py-2 bg-sky-600 text-white font-semibold rounded-lg hover:bg-sky-500 transition-colors">
                            保存
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default EditProfileModal;
