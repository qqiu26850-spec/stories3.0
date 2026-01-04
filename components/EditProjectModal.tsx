
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Project } from '../types';
import { X } from './Icon';

interface EditProjectModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (id: string, title: string) => void;
    project: Project | null;
}

const EditProjectModal: React.FC<EditProjectModalProps> = ({ isOpen, onClose, onSave, project }) => {
    const [title, setTitle] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen && project) {
            setTitle(project.title);
            setError('');
        }
    }, [isOpen, project]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim()) {
            setError('标题不能为空。');
            return;
        }
        if (project) {
            onSave(project.id, title);
        }
    };

    if (!isOpen || !project) return null;

    return createPortal(
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-[9999] p-4 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-md p-6 animate-fade-in-up flex flex-col relative" onClick={e => e.stopPropagation()}>
                <button onClick={onClose} className="absolute top-4 right-4 p-2 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                    <X className="w-5 h-5" />
                </button>

                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">重命名作品</h3>
                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                        <label htmlFor="edit-project-title" className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">作品名称</label>
                        <input
                            type="text"
                            id="edit-project-title"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="w-full p-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-200 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition"
                            autoFocus
                        />
                    </div>
                    
                    {error && <p className="text-red-500 dark:text-red-400 text-sm">{error}</p>}
                    
                    <div className="flex justify-end gap-3 pt-2">
                        <button type="button" onClick={onClose} className="px-4 py-2.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-semibold rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                            取消
                        </button>
                        <button type="submit" className="px-6 py-2.5 bg-sky-600 text-white font-semibold rounded-lg hover:bg-sky-500 transition-colors shadow-lg shadow-sky-500/20">
                            确认修改
                        </button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    );
};

export default EditProjectModal;
