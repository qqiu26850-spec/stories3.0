
import React, { useState, useEffect } from 'react';

interface CreateProjectModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (title: string, coverImage: string | null) => void;
    projectType: 'novel' | 'script' | 'short';
}

const CreateProjectModal: React.FC<CreateProjectModalProps> = ({ isOpen, onClose, onSave, projectType }) => {
    const [title, setTitle] = useState('');
    const [coverImage, setCoverImage] = useState<string | null>(null);
    const [error, setError] = useState('');

    const modalTitle = projectType === 'novel' ? '新建小说' : projectType === 'short' ? '新建短篇' : '新建剧本';
    const nameLabel = projectType === 'script' ? '剧本名' : (projectType === 'short' ? '篇名' : '书名');
    const namePlaceholder = projectType === 'script' ? '例如：时间裂痕' : '例如：深空回响';

    useEffect(() => {
        if (isOpen) {
            setTitle('');
            setCoverImage(null);
            setError('');
        }
    }, [isOpen]);

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onloadend = () => {
                setCoverImage(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim()) {
            setError(`${nameLabel}不能为空。`);
            return;
        }
        onSave(title, coverImage);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
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
                        />
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">书籍封面 (可选)</label>
                        <div className="mt-1 flex items-center gap-4">
                            <div className="w-24 h-36 bg-gray-100 dark:bg-gray-800 rounded border border-gray-300 dark:border-gray-700 flex-shrink-0">
                                {coverImage && <img src={coverImage} alt="封面预览" className="w-full h-full object-cover rounded" />}
                            </div>
                            <label htmlFor="cover-upload" className="cursor-pointer bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white font-semibold py-2 px-4 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">
                                <span>上传图片</span>
                                <input id="cover-upload" name="cover-upload" type="file" className="sr-only" accept="image/*" onChange={handleImageChange} />
                            </label>
                        </div>
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

export default CreateProjectModal;
