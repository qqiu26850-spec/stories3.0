
import React, { useState, useEffect } from 'react';
import { NovelSettings } from '../../types';
import { createPortal } from 'react-dom';
import { X, Plus, Pencil, Trash, UserCircle, Tag, Globe, BookOpen, ListBullet } from '../Icon';

interface NovelSettingsPanelProps {
    settings: NovelSettings;
    onUpdate: (key: keyof NovelSettings, value: string) => void;
    mode?: 'long' | 'short'; // Added mode prop
}

type SettingMode = 'text' | 'list';

interface SettingConfig {
    id: keyof NovelSettings;
    label: string;
    icon: any;
    placeholder: string;
    description: string;
    mode: SettingMode;
    color: string;
}

const SETTING_TYPES: SettingConfig[] = [
    { 
        id: 'typeElements', 
        label: '题材类型', 
        icon: Tag,
        mode: 'text',
        color: 'text-purple-600',
        placeholder: '例如：科幻 / 赛博朋克 / 反乌托邦', 
        description: '定义作品的流派与核心元素，帮助保持风格统一。'
    },
    { 
        id: 'theme', 
        label: '核心主题', 
        icon: BookOpen,
        mode: 'text',
        color: 'text-rose-600',
        placeholder: '例如：探讨科技与人性的边界，关于救赎与牺牲',
        description: '作品想要传达的思想内核或中心主旨。'
    },
    { 
        id: 'synopsis', 
        label: '故事梗概', 
        icon: ListBullet,
        mode: 'text',
        color: 'text-amber-600',
        placeholder: '起承转合：故事发生在2077年的新东京，主角是一名非法义体医生...',
        description: '简要概括故事的主要情节发展脉络。'
    },
    { 
        id: 'worldview', 
        label: '世界观背景', 
        icon: Globe,
        mode: 'text',
        color: 'text-emerald-600',
        placeholder: '详细描述世界规则、地理环境、社会体系、力量体系...',
        description: '故事发生的舞台背景、法则与社会形态。'
    },
    { 
        id: 'characterSettings', 
        label: '人物设定', 
        icon: UserCircle,
        mode: 'list',
        color: 'text-blue-600',
        placeholder: '',
        description: '主要角色的性格、外貌、背景故事。支持创建多个人物卡片。'
    },
    { 
        id: 'specificTerms', 
        label: '特定词条', 
        icon: Tag,
        mode: 'list',
        color: 'text-cyan-600',
        placeholder: '',
        description: '作品中专有的名词、术语、道具或组织设定。'
    },
];

interface ListItem {
    id: string;
    title: string;
    content: string;
}

const TextModal: React.FC<{
    isOpen: boolean;
    title: string;
    value: string;
    placeholder: string;
    description: string;
    onClose: () => void;
    onSave: (val: string) => void;
}> = ({ isOpen, title, value, placeholder, description, onClose, onSave }) => {
    const [localValue, setLocalValue] = useState(value);

    useEffect(() => {
        if (isOpen) setLocalValue(value);
    }, [isOpen, value]);

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-900 w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden animate-fade-in-up" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center p-5 border-b border-gray-100 dark:border-gray-800">
                    <div>
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white">{title}</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{description}</p>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="p-6">
                    <textarea 
                        value={localValue}
                        onChange={e => setLocalValue(e.target.value)}
                        placeholder={placeholder}
                        className="w-full h-96 p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-sky-500 outline-none resize-none text-base leading-relaxed custom-scrollbar"
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

const ListModal: React.FC<{
    isOpen: boolean;
    title: string;
    itemsJson: string;
    description: string;
    onClose: () => void;
    onSave: (val: string) => void;
}> = ({ isOpen, title, itemsJson, description, onClose, onSave }) => {
    const [items, setItems] = useState<ListItem[]>([]);
    const [editingItem, setEditingItem] = useState<ListItem | null>(null); // For sub-modal
    
    // Parse JSON or legacy string on open
    useEffect(() => {
        if (isOpen) {
            try {
                const parsed = JSON.parse(itemsJson);
                if (Array.isArray(parsed)) {
                    setItems(parsed);
                } else {
                    // Legacy string support
                    setItems(itemsJson ? [{ id: 'legacy', title: '默认', content: itemsJson }] : []);
                }
            } catch (e) {
                // Not JSON, treat as legacy string
                setItems(itemsJson ? [{ id: 'legacy', title: '默认', content: itemsJson }] : []);
            }
        }
    }, [isOpen, itemsJson]);

    const handleSaveItem = (item: ListItem) => {
        setItems(prev => {
            const exists = prev.find(p => p.id === item.id);
            if (exists) {
                return prev.map(p => p.id === item.id ? item : p);
            }
            return [...prev, item];
        });
        setEditingItem(null);
    };

    const handleDeleteItem = (id: string) => {
        setItems(prev => prev.filter(p => p.id !== id));
    };

    const handleSaveAll = () => {
        onSave(JSON.stringify(items));
        onClose();
    };

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
            {/* Sub-modal for editing individual items - Moved to top level via Portal */}
            {editingItem && createPortal(
                <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setEditingItem(null)}>
                    <div className="bg-white dark:bg-gray-900 w-full max-w-lg rounded-xl shadow-2xl p-6 space-y-5 animate-fade-in-up border border-gray-200 dark:border-gray-700" onClick={e => e.stopPropagation()}>
                        <h4 className="text-xl font-bold text-gray-900 dark:text-white">{editingItem.id.startsWith('new') ? '新建条目' : '编辑条目'}</h4>
                        <input 
                            className="w-full p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg outline-none focus:ring-2 focus:ring-sky-500 font-bold text-lg"
                            placeholder="名称 / 标题"
                            value={editingItem.title}
                            onChange={e => setEditingItem({...editingItem, title: e.target.value})}
                            autoFocus
                        />
                        <textarea 
                            className="w-full h-64 p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg outline-none focus:ring-2 focus:ring-sky-500 resize-none text-base leading-relaxed"
                            placeholder="详细设定内容..."
                            value={editingItem.content}
                            onChange={e => setEditingItem({...editingItem, content: e.target.value})}
                        />
                        <div className="flex justify-end gap-3 pt-2">
                            <button onClick={() => setEditingItem(null)} className="px-5 py-2 text-sm text-gray-500 font-bold hover:bg-gray-100 rounded-lg">取消</button>
                            <button onClick={() => handleSaveItem(editingItem)} className="px-6 py-2 text-sm bg-sky-600 text-white font-bold rounded-lg hover:bg-sky-500 shadow-lg shadow-sky-500/20">保存</button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            <div className="bg-white dark:bg-gray-900 w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden animate-fade-in-up flex flex-col max-h-[85vh]" onClick={e => e.stopPropagation()}>
                <div className="flex-shrink-0 flex justify-between items-center p-5 border-b border-gray-100 dark:border-gray-800">
                    <div>
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white">{title}</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{description}</p>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-gray-50 dark:bg-black/20">
                    <div className="space-y-4">
                        {items.map(item => (
                            <div key={item.id} className="group flex items-center justify-between bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm hover:border-sky-300 dark:hover:border-sky-600 transition-all cursor-pointer" onClick={() => setEditingItem(item)}>
                                <div className="flex-1 min-w-0 pr-6">
                                    <h5 className="font-bold text-base text-gray-800 dark:text-gray-100 truncate mb-1">{item.title}</h5>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed">{item.content}</p>
                                </div>
                                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={(e) => { e.stopPropagation(); setEditingItem(item); }} className="p-2 text-gray-400 hover:text-sky-500 hover:bg-sky-50 rounded-lg"><Pencil className="w-4 h-4" /></button>
                                    <button onClick={(e) => { e.stopPropagation(); handleDeleteItem(item.id); }} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg"><Trash className="w-4 h-4" /></button>
                                </div>
                            </div>
                        ))}
                        
                        <button 
                            onClick={() => setEditingItem({ id: `new-${Date.now()}`, title: '', content: '' })}
                            className="w-full py-5 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl text-gray-400 hover:text-sky-500 hover:border-sky-300 hover:bg-sky-50 dark:hover:bg-sky-900/10 transition-all flex flex-col items-center justify-center gap-1"
                        >
                            <Plus className="w-6 h-6" />
                            <span className="text-xs font-bold">添加新条目</span>
                        </button>
                    </div>
                </div>

                <div className="flex-shrink-0 flex justify-end gap-3 p-5 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
                    <button onClick={onClose} className="px-5 py-2 text-sm font-bold text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">取消</button>
                    <button onClick={handleSaveAll} className="px-5 py-2 text-sm font-bold text-white bg-sky-600 hover:bg-sky-500 rounded-lg shadow-lg shadow-sky-500/20 transition-all active:scale-95">确认保存</button>
                </div>
            </div>
        </div>,
        document.body
    );
};

// Helper function to clean JSON for display
const formatPreviewText = (text: string): string => {
    if (!text) return "暂未设定";
    
    // Check if it's a JSON array of items (List mode)
    if (text.startsWith('[') && text.endsWith(']')) {
        try {
            const list = JSON.parse(text);
            if (Array.isArray(list)) {
                return `${list.length} 个条目: ` + list.map((i: any) => i.title).join(', ');
            }
        } catch { }
    }

    // Check if it looks like a JSON object (Legacy settings sometimes stored as JSON)
    if (text.trim().startsWith('{') && text.trim().endsWith('}')) {
        try {
            const obj = JSON.parse(text);
            // Collect values only, ignoring keys like "typeElements" etc.
            const values = Object.values(obj).filter(v => v && typeof v === 'string' && v.trim() !== '');
            if (values.length > 0) {
                return values.join(', ');
            }
        } catch (e) {
            // If parse fails, fall through to raw text
        }
    }
    
    return text;
};

const NovelSettingsPanel: React.FC<NovelSettingsPanelProps> = ({ settings, onUpdate, mode }) => {
    const [activeSetting, setActiveSetting] = useState<SettingConfig | null>(null);
    const isShortMode = mode === 'short';

    return (
        <div className={`space-y-3 animate-fade-in ${isShortMode ? 'p-2 pb-20' : 'p-4 pb-20'}`}>
            {/* Modal Dispatcher */}
            {activeSetting?.mode === 'text' && (
                <TextModal 
                    isOpen={!!activeSetting}
                    title={activeSetting.label}
                    value={settings[activeSetting.id] || ''}
                    placeholder={activeSetting.placeholder}
                    description={activeSetting.description}
                    onClose={() => setActiveSetting(null)}
                    onSave={(val) => onUpdate(activeSetting.id, val)}
                />
            )}
            
            {activeSetting?.mode === 'list' && (
                <ListModal 
                    isOpen={!!activeSetting}
                    title={activeSetting.label}
                    itemsJson={settings[activeSetting.id] || '[]'}
                    description={activeSetting.description}
                    onClose={() => setActiveSetting(null)}
                    onSave={(val) => onUpdate(activeSetting.id, val)}
                />
            )}

            <div className={`grid ${isShortMode ? 'gap-2' : 'gap-3'} grid-cols-1`}>
                {SETTING_TYPES.map(config => {
                    const rawValue = settings[config.id];
                    const hasValue = !!rawValue && rawValue !== '[]' && rawValue !== '{}';
                    const Icon = config.icon;
                    const previewText = formatPreviewText(rawValue || '');

                    return (
                        <button 
                            key={config.id}
                            onClick={() => setActiveSetting(config)}
                            className={`group relative w-full rounded-xl border transition-all duration-300 flex flex-col 
                                ${isShortMode 
                                    ? 'bg-sky-50 dark:bg-sky-900/10 border-sky-100 dark:border-sky-800 hover:border-sky-300 hover:shadow-sm p-2 items-center text-center justify-center min-h-[60px]' 
                                    : `text-left p-2.5 gap-1.5 ${hasValue ? 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-sm hover:border-sky-400 hover:shadow-md' : 'bg-gray-50 dark:bg-gray-900/30 border-dashed border-gray-300 dark:border-gray-700 hover:bg-white dark:hover:bg-gray-800 hover:border-sky-400'}`
                                }
                            `}
                        >
                            {isShortMode ? (
                                // Short Mode Compact Design
                                <>
                                    <div className="flex items-center gap-1.5">
                                        <Icon className={`w-3.5 h-3.5 ${hasValue ? 'text-sky-600 dark:text-sky-400' : 'text-gray-400'}`} />
                                        <span className={`text-xs font-bold ${hasValue ? 'text-sky-800 dark:text-sky-200' : 'text-gray-500'}`}>{config.label}</span>
                                    </div>
                                    {hasValue && (
                                        <div className="text-[9px] text-gray-500 dark:text-gray-400 truncate max-w-full px-2 opacity-80">
                                            {previewText}
                                        </div>
                                    )}
                                </>
                            ) : (
                                // Long Mode Standard Design
                                <>
                                    <div className="flex items-center justify-between w-full">
                                        <div className="flex items-center gap-2">
                                            <div className={`p-1 rounded-lg ${hasValue ? 'bg-gray-100 dark:bg-gray-700' : 'bg-transparent'}`}>
                                                <Icon className={`w-3.5 h-3.5 ${config.color} ${!hasValue && 'opacity-50'}`} />
                                            </div>
                                            <span className={`text-xs font-bold ${hasValue ? 'text-gray-900 dark:text-white' : 'text-gray-500'}`}>{config.label}</span>
                                        </div>
                                        {hasValue ? <Pencil className="w-3 h-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" /> : <Plus className="w-4 h-4 text-gray-400" />}
                                    </div>
                                    
                                    {hasValue && (
                                        <p className="text-[10px] text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed pl-1">
                                            {previewText}
                                        </p>
                                    )}
                                </>
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default NovelSettingsPanel;
