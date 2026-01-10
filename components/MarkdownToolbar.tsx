
import React from 'react';
import { Bold, Italic, ListBullet, TextIncrease, AlignLeft, AlignCenter, AlignRight } from './Icon';

interface MarkdownToolbarProps {
    textareaId: string;
    onInsert: (value: string) => void;
}

const MarkdownToolbar: React.FC<MarkdownToolbarProps> = ({ textareaId, onInsert }) => {
    
    const handleInsert = (prefix: string, suffix: string = '') => {
        const textarea = document.getElementById(textareaId) as HTMLTextAreaElement;
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const text = textarea.value;
        const selection = text.substring(start, end);
        
        let newText = '';
        let newCursorPos = 0;

        // Handle block level insertions (Headings, List)
        if (prefix.trim().startsWith('#') || prefix.trim().startsWith('-')) {
             // Try to find the start of the line
             const lineStart = text.lastIndexOf('\n', start - 1) + 1;
             newText = text.substring(0, lineStart) + prefix + text.substring(lineStart);
             newCursorPos = start + prefix.length;
        } else {
             newText = text.substring(0, start) + prefix + selection + suffix + text.substring(end);
             newCursorPos = end + prefix.length + suffix.length;
        }

        onInsert(newText);
        
        // Restore focus and cursor (need timeout for React state update)
        setTimeout(() => {
            textarea.focus();
            textarea.setSelectionRange(newCursorPos, newCursorPos);
        }, 0);
    };

    return (
        <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-t-lg border-b border-gray-200 dark:border-gray-700">
            <button type="button" onClick={() => handleInsert('# ')} className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-gray-600 dark:text-gray-300" title="一级标题">
                <span className="font-black text-xs">H1</span>
            </button>
            <button type="button" onClick={() => handleInsert('## ')} className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-gray-600 dark:text-gray-300" title="二级标题">
                <span className="font-bold text-xs">H2</span>
            </button>
            <button type="button" onClick={() => handleInsert('### ')} className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-gray-600 dark:text-gray-300" title="三级标题">
                <span className="font-medium text-xs">H3</span>
            </button>
            <div className="w-px h-4 bg-gray-300 dark:bg-gray-600 mx-1" />
            <button type="button" onClick={() => handleInsert('**', '**')} className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-gray-600 dark:text-gray-300" title="加粗">
                <Bold className="w-3.5 h-3.5" />
            </button>
            <button type="button" onClick={() => handleInsert('*', '*')} className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-gray-600 dark:text-gray-300" title="倾斜">
                <Italic className="w-3.5 h-3.5" />
            </button>
            <div className="w-px h-4 bg-gray-300 dark:bg-gray-600 mx-1" />
            <button type="button" onClick={() => handleInsert('- ')} className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-gray-600 dark:text-gray-300" title="无序列表">
                <ListBullet className="w-3.5 h-3.5" />
            </button>
            <button type="button" onClick={() => handleInsert('1. ')} className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-gray-600 dark:text-gray-300 text-xs font-bold" title="有序列表">
                1.
            </button>
        </div>
    );
};

export default MarkdownToolbar;
