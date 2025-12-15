
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Sparkles, X } from './Icon';

const LOADING_TIPS = [
    "💡 提示：好的人物需要有缺陷，完美的英雄往往令人乏味。",
    "💡 提示：'展示，不要告诉' (Show, don't tell) 是写作的金科玉律。",
    "💡 提示：尝试从反派的视角思考，这会让冲突更加真实。",
    "💡 提示：环境描写可以烘托氛围，也是人物心境的投射。",
    "💡 提示：每一个场景都应该推动剧情发展或深化人物关系。",
    "💡 提示：对话应该有潜台词，人们往往不说出他们真正的想法。",
    "💡 提示：在此期间，你可以喝口水，放松一下眼睛。",
    "💡 提示：制造悬念的最好方式是让读者比主角知道得更多，或者更少。",
    "💡 提示：给主角一个难以两全的困境，迫使他们做出选择。"
];

interface LoadingOverlayProps {
    isVisible: boolean;
    onClose: () => void;
}

const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ isVisible, onClose }) => {
    const [seconds, setSeconds] = useState(0);
    const [tipIndex, setTipIndex] = useState(0);
    const [fade, setFade] = useState(true);

    // Timer for seconds
    useEffect(() => {
        let interval: any;
        if (isVisible) {
            setSeconds(0);
            interval = setInterval(() => {
                setSeconds(s => s + 1);
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [isVisible]);

    // Timer for tips rotation
    useEffect(() => {
        if (isVisible) {
            const tipInterval = setInterval(() => {
                setFade(false); // Start fade out
                setTimeout(() => {
                    setTipIndex(prev => (prev + 1) % LOADING_TIPS.length);
                    setFade(true); // Fade in new tip
                }, 300); // Wait for fade out animation
            }, 3000); // Change every 3 seconds
            return () => clearInterval(tipInterval);
        }
    }, [isVisible]);

    if (!isVisible) return null;

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/20 backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 w-80 text-center mx-4 animate-fade-in-up relative">
                <button 
                    onClick={onClose}
                    className="absolute top-2 right-2 p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    title="关闭/取消"
                >
                    <X className="w-5 h-5" />
                </button>

                <div className="relative w-12 h-12 mx-auto mb-4">
                    <div className="absolute inset-0 border-2 border-gray-100 dark:border-gray-800 rounded-full"></div>
                    <div className="absolute inset-0 border-2 border-sky-500 rounded-full border-t-transparent animate-spin"></div>
                    <Sparkles className="absolute inset-0 w-5 h-5 m-auto text-sky-500 animate-pulse" />
                </div>
                
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">AI 正在创作...</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-mono mb-5">已耗时: {seconds} 秒</p>
                
                <div className="bg-sky-50 dark:bg-sky-900/20 p-3 rounded-xl border border-sky-100 dark:border-sky-800/50 min-h-[80px] flex items-center justify-center relative overflow-hidden">
                    <p 
                        className={`text-xs text-sky-700 dark:text-sky-300 font-medium leading-relaxed transition-opacity duration-300 ${fade ? 'opacity-100' : 'opacity-0'}`}
                    >
                        {LOADING_TIPS[tipIndex]}
                    </p>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default LoadingOverlay;
