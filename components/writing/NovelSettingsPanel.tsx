
import React, { useState } from 'react';
import { NovelSettings } from '../../types';
import { createPortal } from 'react-dom';
import { X, Plus, Pencil, Trash } from '../Icon';

interface NovelSettingsPanelProps {
    settings: NovelSettings;
    onUpdate: (key: keyof NovelSettings, value: string) => void;
}

const SETTING_TYPES: { id: keyof NovelSettings; label: string; placeholder: string }[] = [
    { id: 'typeElements', label: '类型元素', placeholder: '例如：科幻、赛博朋克、反乌托邦' },
    { id: 'theme', label: '核心主题', placeholder: '例如：探讨科技与人性的边界，关于救赎与牺牲' },
    { id: 'targetAudience', label: '目标读者', placeholder: '例如：青少年、科幻迷、悬疑爱好者' },
    { id: 'synopsis', label: '作品梗概', placeholder: '故事发生在2077年的新东京，主角是一名非法义体医生...' },
    { id: 'worldview', label: '世界观设定', placeholder: '详细描述世界规则、地理环境、社会体系、力量体系...' },
    { id: 'characterSettings', label: '人物设定', placeholder: '主角：林恩，性格冷静... \n反派：K，极度疯狂...' },
];

const SettingModal: React.FC<{
    isOpen: boolean;
    title: string;
    value: string;
    placeholder: string;
    onClose: () => void;
    onSave: (val: string) => void;
}> = ({ isOpen, title, value, placeholder, onClose, onSave }) => {
    const [localValue, setLocalValue] = useState(value);

    React.useEffect(() => {
        if (isOpen) setLocalValue(value);
    }, [isOpen, value]);

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-900 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-fade-in-up" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center p-5 border-b border-gray-100 dark:border-gray-800">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">{title}</h3>
                    <button onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="p-5">
                    <textarea 
                        value={localValue}
                        onChange={e => setLocalValue(e.target.value)}
                        placeholder={placeholder}
                        className="w-full h-48 p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-sky-500 outline-none resize-none text-sm leading-relaxed custom-scrollbar"
                        autoFocus
                    />
                </div>
                <div className="flex justify-end gap-3 p-5 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
                    <button onClick={onClose} className="px-5 py-2 text-sm font-bold text-gray-500 hover:text-gray-700 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-lg transition-colors">取消</button>
                    <button onClick={() => { onSave(localValue); onClose(); }} className="px-5 py-2 text-sm font-bold text-white bg-sky-600 hover:bg-sky-500 rounded-lg shadow-lg shadow-sky-500/20 transition-all active:scale-95">确认保存</button>
                </div>
            </div>
        </div>,
        document.body
    );
};

const NovelSettingsPanel: React.FC<NovelSettingsPanelProps> = ({ settings, onUpdate }) => {
    const [editingId, setEditingId] = useState<keyof NovelSettings | null>(null);

    const activeSetting = editingId ? SETTING_TYPES.find(t => t.id === editingId) : null;

    return (
        <div className="p-4 space-y-6 animate-fade-in pb-20">
            <SettingModal 
                isOpen={!!editingId}
                title={activeSetting?.label || ''}
                value={editingId ? settings[editingId] : ''}
                placeholder={activeSetting?.placeholder || ''}
                onClose={() => setEditingId(null)}
                onSave={(val) => editingId && onUpdate(editingId, val)}
            />

            <div className="bg-sky-50/50 dark:bg-sky-900/10 p-3 rounded-xl border border-sky-100 dark:border-sky-900/30">
                <p className="text-xs text-sky-600 dark:text-sky-400 font-medium">
                    ✨ 完善设定可让 AI 更精准地辅助您创作。
                </p>
            </div>

            <div className="space-y-4">
                <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest px-1">已添加的设定</h4>
                <div className="grid grid-cols-1 gap-3">
                    {SETTING_TYPES.map(type => {
                        const hasValue = !!settings[type.id];
                        if (!hasValue) return null;
                        
                        return (
                            <div key={type.id} className="group relative bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm hover:border-sky-300 dark:hover:border-sky-700 transition-colors">
                                <div className="flex justify-between items-start mb-2">
                                    <span className="text-xs font-bold text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-900/20 px-2 py-0.5 rounded-md">{type.label}</span>
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => setEditingId(type.id)} className="p-1.5 text-gray-400 hover:text-sky-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                                        <button onClick={() => onUpdate(type.id, '')} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"><Trash className="w-3.5 h-3.5" /></button>
                                    </div>
                                </div>
                                <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-3 leading-relaxed whitespace-pre-wrap">
                                    {settings[type.id]}
                                </p>
                            </div>
                        );
                    })}
                    
                    {!Object.values(settings).some(v => !!v) && (
                        <div className="text-center py-8 text-gray-400 text-xs italic border-2 border-dashed border-gray-100 dark:border-gray-800 rounded-xl">
                            暂无设定，请从下方选择添加
                        </div>
                    )}
                </div>
            </div>

            <div className="space-y-3">
                <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest px-1">添加新设定</h4>
                <div className="grid grid-cols-2 gap-3">
                    {SETTING_TYPES.map(type => {
                        const hasValue = !!settings[type.id];
                        if (hasValue) return null;

                        return (
                            <button 
                                key={type.id}
                                onClick={() => setEditingId(type.id)}
                                className="flex items-center justify-center gap-2 p-3 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-sky-400 hover:text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-900/10 transition-all group"
                            >
                                <Plus className="w-4 h-4 group-hover:scale-110 transition-transform" />
                                <span className="text-xs font-bold">{type.label}</span>
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default NovelSettingsPanel;
