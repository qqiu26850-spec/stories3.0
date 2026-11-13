
import React, { useState } from 'react';
import { signIn, signUp, resetPasswordForEmail, signOut } from '../services/supabaseService';
import { BookSolid, X, Eye, EyeSlash } from './Icon';

interface AuthModalProps {
    isOpen: boolean;
    onSuccess: () => void;
    onGuestMode?: () => void;
}

// 错误信息翻译映射与友好提示
const ERROR_MAP: Record<string, string> = {
    'invalid login credentials': '邮箱或密码不正确，请重新输入',
    'invalid_credentials': '邮箱或密码不正确，请重新输入',
    'email not confirmed': '邮箱尚未验证，请检查您的收件箱确认邮件',
    'email_not_confirmed': '邮箱尚未验证，请检查您的收件箱确认邮件',
    'user not found': '该账号不存在，请先点击下方“立即注册”',
    'user_not_found': '该账号不存在，请先点击下方“立即注册”',
    'signup disabled': '当前已关闭注册功能',
    'password is too short': '密码长度不足，请输入至少 6 位密码',
    'weak_password': '密码强度不足，请输入更复杂的密码',
    'user already registered': '该邮箱已被注册，请直接输入密码登录',
    'user_already_exists': '该邮箱已被注册，请直接输入密码登录',
    'email link expired': '重置密码链接已失效，请重新发送',
    'requested entity was not found.': 'API 配置错误，请检查您的配置',
    'network request failed': '网络连接失败，请检查网络设置或开启代理',
    'failed to fetch': '网络连接超时：无法直连账号数据库服务器（国内网络直连 Supabase 常受限，请开启科学上网或选择下方访客模式）',
    'fetch failed': '网络连接超时：无法直连账号数据库服务器，请开启网络代理或选择下方访客模式',
    'authretryablefetcherror': '连接数据库服务器超时，请检查网络环境或开启代理',
    'load failed': '网络请求加载失败，请检查网络连接',
    'rate_limit': '操作过于频繁，请稍后再试',
    'over_email_send_rate_limit': '邮件发送过于频繁，请稍后再试'
};

const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onSuccess, onGuestMode }) => {
    const [mode, setMode] = useState<'login' | 'register' | 'forgot-password'>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');

    if (!isOpen) return null;

    // 校验邮箱格式 - Relaxed validation
    const validateEmail = (emailStr: string) => {
        return /^[^\s@]+@[^\s@]+$/.test(emailStr);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        // 前端初步校验
        if (!validateEmail(email)) {
            setError('请输入正确的邮箱格式');
            return;
        }

        if (mode !== 'forgot-password' && password.length < 6) {
            setError('密码至少需要 6 位字符');
            return;
        }

        setLoading(true);
        setError('');
        setMessage('');

        try {
            if (mode === 'login') {
                const { data, error: signInError } = await signIn(email, password);
                if (signInError) throw signInError;

                if (data.user?.user_metadata?.is_deleted) {
                    await signOut();
                    throw new Error("该账号已注销，无法登录。");
                }

                setMessage('登录成功！正在跳转...');
                setTimeout(() => {
                    onSuccess();
                }, 1000);
            } else if (mode === 'register') {
                const { error: signUpError } = await signUp(email, password);
                if (signUpError) throw signUpError;
                setMessage('注册成功！请直接登录。'); 
                setTimeout(() => {
                    setMode('login');
                }, 2000);
            } else if (mode === 'forgot-password') {
                const { error: resetError } = await resetPasswordForEmail(email);
                if (resetError) throw resetError;
                setMessage('重置密码链接已发送至您的邮箱，请查收。');
                setTimeout(() => {
                    setMode('login');
                }, 3000);
            }
        } catch (err: any) {
            console.error("Auth error caught in modal:", err);
            const rawMessage = String(err?.message || err?.error_description || err?.code || err || '').trim();
            const lowerRaw = rawMessage.toLowerCase();
            
            // 匹配友好的中文错误
            let matchedMessage = '';
            for (const [key, text] of Object.entries(ERROR_MAP)) {
                if (lowerRaw.includes(key)) {
                    matchedMessage = text;
                    break;
                }
            }

            if (matchedMessage) {
                setError(matchedMessage);
            } else if (rawMessage && rawMessage !== '{}') {
                setError(`登录受阻 (${rawMessage})，请检查网络或账号信息`);
            } else {
                setError('网络连接异常：无法直连账号数据库服务器，请检查网络或选择下方访客模式');
            }
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
                        {mode === 'login' ? '登录以同步您的创作数据' : (mode === 'register' ? '创建账号，开启您的 AI 创作之旅' : '找回密码')}
                    </p>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-8 space-y-5">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1.5">邮箱</label>
                        <input 
                            type="text" 
                            required
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            placeholder="例如：QQ邮箱、网易邮箱、谷歌邮箱等"
                            className={`w-full p-3 rounded-lg bg-gray-50 dark:bg-gray-800 border ${error.includes('邮箱') ? 'border-red-400' : 'border-gray-200'} dark:border-gray-700 focus:ring-2 focus:ring-sky-500 outline-none transition`}
                        />
                    </div>
                    
                    {mode !== 'forgot-password' && (
                        <div>
                            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1.5">密码</label>
                            <div className="relative">
                                <input 
                                    type={showPassword ? "text" : "password"}
                                    required
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className={`w-full p-3 pr-10 rounded-lg bg-gray-50 dark:bg-gray-800 border ${error.includes('密码') ? 'border-red-400' : 'border-gray-200'} dark:border-gray-700 focus:ring-2 focus:ring-sky-500 outline-none transition`}
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
                    )}

                    {mode === 'login' && (
                        <div className="flex justify-end">
                            <button 
                                type="button" 
                                onClick={() => { setMode('forgot-password'); setError(''); setMessage(''); }}
                                className="text-sm text-sky-600 dark:text-sky-400 hover:underline"
                            >
                                忘记密码？
                            </button>
                        </div>
                    )}

                    {error && (
                        <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-lg text-center border border-red-100 dark:border-red-900/50 animate-pulse">
                            {error}
                        </div>
                    )}
                    
                    {message && (
                        <div className="p-3 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 text-sm rounded-lg text-center border border-green-100 dark:border-green-900/50">
                            {message}
                        </div>
                    )}

                    <button 
                        type="submit"
                        disabled={loading}
                        className="w-full py-3.5 bg-sky-600 text-white font-bold rounded-xl hover:bg-sky-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-sky-500/30 active:scale-95"
                    >
                        {loading ? (
                            <div className="flex items-center justify-center gap-2">
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                请稍候...
                            </div>
                        ) : (
                            mode === 'login' ? '登 录' : (mode === 'register' ? '立 即 注 册' : '发 送 重 置 链 接')
                        )}
                    </button>
                </form>

                {/* Footer */}
                <div className="p-6 bg-gray-50 dark:bg-gray-800/50 text-center border-t border-gray-100 dark:border-gray-800 space-y-3">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                        {mode === 'login' ? '还没有账号？' : '已有账号？'}
                        <button 
                            type="button"
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

                    {onGuestMode && (
                        <div className="pt-2 border-t border-gray-200/60 dark:border-gray-700/60 flex flex-col items-center gap-1.5">
                            <button
                                type="button"
                                onClick={onGuestMode}
                                className="text-xs text-sky-600 dark:text-sky-400 font-medium hover:underline flex items-center gap-1"
                            >
                                <span>暂不登录，直接以访客模式体验（本地创作）</span>
                                <span>&rarr;</span>
                            </button>
                            <span className="text-[10px] text-gray-400 dark:text-gray-500">
                                💡 提示：国内网络若遇连接数据库超时，可开启科学上网/网络代理，或直接使用访客模式
                            </span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AuthModal;
