
import React, { useState } from 'react';
import { signIn, signUp } from '../services/supabaseService';
import { BookSolid, X, Eye, EyeSlash } from './Icon';

interface AuthModalProps {
    isOpen: boolean;
    onSuccess: () => void;
}

const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onSuccess }) => {
    const [mode, setMode] = useState<'login' | 'register'>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setMessage('');

        try {
            if (mode === 'login') {
                const { error } = await signIn(email, password);
                if (error) throw error;
                setMessage('登录成功！正在跳转...');
                setTimeout(() => {
                    onSuccess();
                }, 1000);
            } else {
                const { error } = await signUp(email, password);
                if (error) throw error;
                setMessage('注册成功！请登录。');
                setMode('login');
            }
        } catch (err: any) {
            setError(err.message || '操作失败，请检查网络或账号密码。');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-gray-900 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-fade-in-up relative">
                
                {/* Header */}
                <div className="p-8 pb-0 flex flex-col items-center">
                    <div className="w-16 h-16 bg-sky-100 dark:bg-sky-900/30 rounded-full flex items-center justify-center mb-4">
                        <BookSolid className="w-8 h-8 text-sky-600 dark:text-sky-400" />
                    </div>
                    <h1 className="text-3xl font-bold text-sky-600 dark:text-sky-400 tracking-wider mb-2">奇思妙写</h1>
                    <p className="text-gray-500 dark:text-gray-400 text-sm">
                        {mode === 'login' ? '登录以同步您的创作数据' : '创建账号，开启您的 AI 创作之旅'}
                    </p>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-8 space-y-5">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1.5">邮箱</label>
                        <input 
                            type="email" 
                            required
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            placeholder="name@example.com"
                            className="w-full p-3 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-sky-500 outline-none transition"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1.5">密码</label>
                        <div className="relative">
                            <input 
                                type={showPassword ? "text" : "password"}
                                required
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                placeholder="••••••••"
                                className="w-full p-3 pr-10 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-sky-500 outline-none transition"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                                title={showPassword ? "隐藏密码" : "显示密码"}
                            >
                                {showPassword ? <EyeSlash className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                        </div>
                    </div>

                    {error && (
                        <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-lg text-center">
                            {error}
                        </div>
                    )}
                    
                    {message && (
                        <div className="p-3 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 text-sm rounded-lg text-center">
                            {message}
                        </div>
                    )}

                    <button 
                        type="submit"
                        disabled={loading}
                        className="w-full py-3.5 bg-sky-600 text-white font-bold rounded-xl hover:bg-sky-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-sky-500/30"
                    >
                        {loading ? '处理中...' : (mode === 'login' ? '登录' : '注册')}
                    </button>
                </form>

                {/* Footer */}
                <div className="p-6 bg-gray-50 dark:bg-gray-800/50 text-center border-t border-gray-100 dark:border-gray-800">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                        {mode === 'login' ? '还没有账号？' : '已有账号？'}
                        <button 
                            onClick={() => {
                                setMode(mode === 'login' ? 'register' : 'login');
                                setError('');
                                setMessage('');
                            }}
                            className="ml-1 font-bold text-sky-600 dark:text-sky-400 hover:underline"
                        >
                            {mode === 'login' ? '立即注册' : '直接登录'}
                        </button>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default AuthModal;
