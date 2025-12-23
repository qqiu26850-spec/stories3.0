
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Asset } from '../types';

interface ImportAssetModalProps {
    isOpen: boolean;
    onClose: () => void;
    content: string;
    onSave: (data: { name: string; type: Asset['type']; tags: string[]; content: string }) => void;
}

const stripMarkdown = (text: string) => {
    return text
        .replace(/#+\s/g, '')
        .replace(/\*\*|\*/g, '')
        .replace(/>\s/g, '')
        .replace(/!\[.*?\]\(.*?\)/g, '')
        .replace(/\[(.*?)\]\(.*?\)/g, '$1')
        .replace(/`{1,3}.*?`{1,3}/gs, '')
        .replace(/<think>[\s\S]*?<\/think>/g, '')
        .trim();
};

const ImportAssetModal: React.FC<ImportAssetModalProps> = ({ isOpen, onClose, content, onSave }) => {
    const [name, setName] = useState('');
    const [assetContent, setAssetContent] = useState('');
    const [type, setType] = useState<Asset['type']>('inspiration');
    const [tags, setTags] = useState('');

    useEffect(() => {
        if (isOpen && content) {
            // Automatically strip markdown for the name preview, but keep content raw or stripped based on preference.
            // Here we default to stripped for cleaner asset storage.
            const plainContent = stripMarkdown(content);
            setName(plainContent.slice(0, 15).replace(/\n/g, ' ').trim() + (plainContent.length > 15 ? '...' : ''));
            setAssetContent(plainContent);
        }
    }, [isOpen, content]);

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100] p-4 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl w-full max-w-5xl h-[85vh] flex overflow-hidden animate-fade-in-up font-sans" onClick={e => e.stopPropagation()}>
                <div className="w-1/2 flex flex-col p-8 border-r border-gray-100 dark:border-gray-800">
                    <div className="flex justify-between items-center mb-8">
                        <h3 className="text-2xl font-bold text-gray-900 dark:text-white">导入素材库</h3>
                    </div>
                    <div className="space-y-6 overflow-y-auto flex-1 pr-2">
                        <div>
                            <label className="block text-sm font-bold text-gray-500 mb-2 uppercase">素材名称</label>
                            <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 rounded-xl focus:ring-2 focus:ring-sky-500 outline-none text-gray-900 dark:text-white font-sans" />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-500 mb-3 uppercase">分类</label>
                            <div className="grid grid-cols-3 gap-3 font-sans">
                                {(['character', 'plot', 'inspiration'] as const).map(t => (
                                    <button key={t} onClick={() => setType(t)} className={`py-3 rounded-xl border transition-all font-bold ${type === t ? 'bg-sky-50 border-sky-500 text-sky-600 shadow-lg' : 'bg-gray-50 dark:bg-gray-800 border-gray-200 text-gray-500 hover:bg-gray-100'}`}>
                                        {t === 'character' ? '角色' : t === 'plot' ? '剧情' : '灵感'}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-500 mb-2 uppercase">文本内容 (纯文本)</label>
                            <textarea value={assetContent} onChange={e => setAssetContent(e.target.value)} className="w-full h-48 p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 rounded-xl focus:ring-2 focus:ring-sky-500 outline-none text-sm font-sans resize-none" />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-500 mb-2 uppercase">标签</label>
                            <input type="text" value={tags} onChange={e => setTags(e.target.value)} placeholder="逗号分隔标签..." className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 rounded-xl focus:ring-2 focus:ring-sky-500 outline-none font-sans" />
                        </div>
                    </div>
                    <div className="mt-8 flex gap-4 font-sans">
                        <button onClick={onClose} className="flex-1 py-4 bg-gray-100 text-gray-600 font-bold rounded-2xl hover:bg-gray-200 transition-colors">取消</button>
                        <button onClick={() => { onSave({ name, type, tags: tags.split(/[,，]/).map(t => t.trim()).filter(Boolean), content: assetContent }); onClose(); }} className="flex-1 py-4 bg-sky-600 text-white font-bold rounded-2xl hover:bg-sky-500 shadow-xl shadow-sky-500/30">确认保存</button>
                    </div>
                </div>
                <div className="w-1/2 bg-gray-50 dark:bg-black/40 flex flex-col p-8 font-sans">
                    <h4 className="text-sm font-bold text-gray-500 mb-4 uppercase tracking-widest">保存预览</h4>
                    <div className="flex-1 bg-white dark:bg-gray-900 rounded-2xl p-6 border border-gray-100 dark:border-gray-800 overflow-y-auto shadow-inner">
                        <div className="whitespace-pre-wrap font-sans text-gray-800 dark:text-gray-200 leading-relaxed text-sm">
                            {assetContent}
                        </div>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default ImportAssetModal;
