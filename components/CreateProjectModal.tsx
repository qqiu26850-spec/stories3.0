
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface CreateProjectModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (title: string, coverFile: File | null) => void;
    projectType: 'novel' | 'script' | 'short';
}

const CreateProjectModal: React.FC<CreateProjectModalProps> = ({ isOpen, onClose, onSave, projectType }) => {
    const [title, setTitle] = useState('');
    const [coverPreview, setCoverPreview] = useState<string | null>(null);
    const [coverFile, setCoverFile] = useState<File | null>(null);
    const [error, setError] = useState('');

    const modalTitle = projectType === 'novel' ? '新建小说' : projectType === 'short' ? '新建短篇' : '新建剧本';
    const nameLabel = projectType === 'script' ? '剧本名' : (projectType === 'short' ? '篇名' : '书名');
    const namePlaceholder = projectType === 'script' ? '例如：时间裂痕' : '例如：深空回响';

    useEffect(() => {
        if (isOpen) {
            setTitle('');
            setCoverPreview(null);
            setCoverFile(null);
            setError('');
        }
    }, [isOpen]);

    // Client-side image compression
    const compressImage = (file: File): Promise<File> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target?.result as string;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 800;
                    const MAX_HEIGHT = 800;
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > MAX_WIDTH) {
                            height *= MAX_WIDTH / width;
                            width = MAX_WIDTH;
                        }
                    } else {
                        if (height > MAX_HEIGHT) {
                            width *= MAX_HEIGHT / height;
                            height = MAX_HEIGHT;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx?.drawImage(img, 0, 0, width, height);

                    canvas.toBlob((blob) => {
                        if (blob) {
                            const compressedFile = new File([blob], file.name, {
                                type: 'image/jpeg',
                                lastModified: Date.now(),
                            });
                            resolve(compressedFile);
                        } else {
                            reject(new Error('Canvas is empty'));
                        }
                    }, 'image/jpeg', 0.7); // 70% quality JPEG
                };
                img.onerror = (err) => reject(err);
            };
            reader.onerror = (err) => reject(err);
        });
    };

    const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            try {
                const compressedFile = await compressImage(file);
                setCoverFile(compressedFile);
                
                // Update preview
                const reader = new FileReader();
                reader.onloadend = () => {
                    setCoverPreview(reader.result as string);
                };
                reader.readAsDataURL(compressedFile);
            } catch (err) {
                console.error("Compression failed", err);
                // Fallback to original if compression fails
                setCoverFile(file);
                const reader = new FileReader();
                reader.onloadend = () => {
                    setCoverPreview(reader.result as string);
                };
                reader.readAsDataURL(file);
            }
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim()) {
            setError(`${nameLabel}不能为空。`);
            return;
        }
        onSave(title, coverFile);
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
                        />
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">书籍封面 (可选)</label>
                        <div className="mt-1 flex items-center gap-4">
                            <div className="w-24 h-36 bg-gray-100 dark:bg-gray-800 rounded border border-gray-300 dark:border-gray-700 flex-shrink-0 overflow-hidden">
                                {coverPreview ? <img src={coverPreview} alt="封面预览" className="w-full h-full object-cover" /> : null}
                            </div>
                            <label htmlFor="cover-upload" className="cursor-pointer bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white font-semibold py-2 px-4 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">
                                <span>上传图片</span>
                                <input id="cover-upload" name="cover-upload" type="file" className="sr-only" accept="image/*" onChange={handleImageChange} />
                            </label>
                        </div>
                        <p className="text-xs text-gray-400 mt-2">支持 JPG, PNG 格式，会自动压缩</p>
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
        </div>,
        document.body
    );
};

export default CreateProjectModal;
