
import React from 'react';
import { Copy, AlignLeft, AlignCenter, AlignRight, AlignJustify, IndentIncrease, IndentDecrease, Bold, Italic, ArrowUturnLeft, ArrowUturnRight, TextIncrease, TextDecrease } from '../Icon';

export type ToolbarAction = 'copy' | 'bold' | 'italic' | 'align-left' | 'align-center' | 'align-right' | 'align-justify' | 'indent-add' | 'indent-decrease' | 'undo' | 'redo' | 'font-increase' | 'font-decrease';

interface WritingToolbarProps {
    onAction: (action: ToolbarAction) => void;
    alignment: 'left' | 'center' | 'right' | 'justify';
}

const WritingToolbar: React.FC<WritingToolbarProps> = ({ onAction, alignment }) => {
    // Left side group
    const formattingButtons = [
        { id: 'bold', icon: Bold, label: '加粗' },
        { id: 'italic', icon: Italic, label: '倾斜' },
        { id: 'separator' },
        { id: 'font-increase', icon: TextIncrease, label: '增大字号' },
        { id: 'font-decrease', icon: TextDecrease, label: '缩小字号' },
        { id: 'separator' },
        { id: 'indent-add', icon: IndentIncrease, label: '增加缩进' },
        { id: 'indent-decrease', icon: IndentDecrease, label: '减少缩进' },
        { id: 'separator' },
        { id: 'align-left', icon: AlignLeft, label: '左对齐' },
        { id: 'align-center', icon: AlignCenter, label: '居中对齐' },
        { id: 'align-right', icon: AlignRight, label: '右对齐' },
        { id: 'align-justify', icon: AlignJustify, label: '两端对齐' },
        { id: 'separator' },
        { id: 'copy', icon: Copy, label: '复制全文' },
        { id: 'separator' },
        { id: 'undo', icon: ArrowUturnLeft, label: '撤销' },
        { id: 'redo', icon: ArrowUturnRight, label: '恢复' },
    ];

    const renderButton = (btn: any, index: number) => {
        if (btn.id === 'separator') {
            return <div key={`sep-${index}`} className="w-px h-4 bg-gray-200 dark:bg-gray-700 mx-1 self-center"></div>;
        }

        const isActive = btn.id?.startsWith('align-') && btn.id === `align-${alignment}`;
        
        return (
            <button
                key={btn.id}
                onClick={() => onAction(btn.id as ToolbarAction)}
                title={btn.label}
                className={`p-1.5 rounded transition-colors ${
                    isActive 
                        ? 'bg-sky-100 text-sky-600 dark:bg-sky-900/50 dark:text-sky-400' 
                        : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'
                }`}
            >
                {btn.icon && <btn.icon className="w-4 h-4" />}
            </button>
        );
    };

    return (
        <div className="flex items-center justify-between mb-2 pb-2 border-b border-gray-100 dark:border-gray-800 w-full px-1">
            <div className="flex items-center gap-1">
                {formattingButtons.map((btn, index) => renderButton(btn, index))}
            </div>
        </div>
    );
};

export default WritingToolbar;
