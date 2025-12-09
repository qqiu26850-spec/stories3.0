
import React from 'react';
import { createPortal } from 'react-dom';

interface DeleteConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
}

const DeleteConfirmationModal: React.FC<DeleteConfirmationModalProps> = ({ isOpen, onClose, onConfirm }) => {
    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-[9999] p-4 backdrop-blur-sm" onClick={onClose}>
            <div 
                className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-md p-6 animate-fade-in-up" 
                onClick={e => e.stopPropagation()}
            >
                <div className="text-center">
                    <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/50">
                        <svg className="h-6 w-6 text-red-600 dark:text-red-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                        </svg>
                    </div>
                    <h3 className="mt-5 text-lg font-semibold text-gray-900 dark:text-white">
                        确认删除
                    </h3>
                    <div className="mt-2">
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            您确定要执行此删除操作吗？此操作无法撤销。
                        </p>
                    </div>
                </div>
                <div className="mt-6 flex justify-center gap-4">
                    <button 
                        type="button" 
                        className="px-6 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white font-semibold rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                        onClick={onClose}
                    >
                        取消
                    </button>
                    <button 
                        type="button" 
                        className="px-6 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-500 transition-colors"
                        onClick={onConfirm}
                    >
                        确认删除
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default DeleteConfirmationModal;
