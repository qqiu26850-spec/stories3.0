
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface CreateProjectModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (title: string) => void;
    projectType: 'novel' | 'script' | 'short';
}

const CreateProjectModal: React.FC<CreateProjectModalProps> = ({ isOpen, onClose, onSave, projectType }) => {
    const [title, setTitle] = useState('');
    const [error, setError] = useState('');

    const modalTitle = projectType === 'novel' ? '新建小说' : projectType === 'short' ? '新建短篇' : '新建剧本';
    const nameLabel = projectType === 'script' ? '剧本名' : (projectType === 'short' ? '篇名' : '书名');
    const namePlaceholder = projectType === 'script' ? '例如：时间裂痕' : '例如：深空回响';

    useEffect(() => {
        if (isOpen) {
            setTitle('');
            setError('');
        }
    }, [isOpen]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim()) {
            setError(`${nameLabel}不能为空。`);
            return;
        }
        onSave(title);
    };

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-[9999] p-4 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-md p-6 animate-fade-in-up" onClick={e => e.stopPropagation()}>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">{modalTitle}</h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="project-title" className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">{nameLabel}</label>
                        <input
                            type="text"
                            id="project-title"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder={namePlaceholder}
                            className="w-full p-2 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md text-gray-900 dark:text-gray-200 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition"
                            autoFocus
                        />
                    </div>
                    {error && <p className="text-red-500 dark:text-red-400 text-sm">{error}</p>}
                    <div className="flex justify-end gap-3 pt-4">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-500 dark:bg-gray-700 text-white font-semibold rounded-lg hover:bg-gray-600 dark:hover:bg-gray-600 transition-colors">
                            取消
                        </button>
                        <button type="submit" className="px-4 py-2 bg-sky-600 text-white font-semibold rounded-lg hover:bg-sky-500 transition-colors">
                            创建
                        </button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    );
};

export default CreateProjectModal;
