
import React from 'react';
import { Copy, AlignLeft, AlignCenter, AlignRight, IndentIncrease, Bold, ArrowUturnLeft, ArrowUturnRight } from '../Icon';

export type ToolbarAction = 'copy' | 'bold' | 'align-left' | 'align-center' | 'align-right' | 'indent-add' | 'undo' | 'redo';

interface WritingToolbarProps {
    onAction: (action: ToolbarAction) => void;
    alignment: 'left' | 'center' | 'right';
}

const WritingToolbar: React.FC<WritingToolbarProps> = ({ onAction, alignment }) => {
    const buttons = [
        { id: 'undo', icon: ArrowUturnLeft, label: '撤销' },
        { id: 'redo', icon: ArrowUturnRight, label: '恢复' },
        { id: 'separator' }, // Separator
        { id: 'copy', icon: Copy, label: '复制全文' },
        { id: 'bold', icon: Bold, label: '加粗' },
        { id: 'indent-add', icon: IndentIncrease, label: '首行缩进' },
        { id: 'align-left', icon: AlignLeft, label: '左对齐' },
        { id: 'align-center', icon: AlignCenter, label: '居中对齐' },
        { id: 'align-right', icon: AlignRight, label: '右对齐' },
    ];

    return (
        <div className="flex items-center gap-2 mb-4 pb-2 border-b border-gray-100 dark:border-gray-800 w-full">
            {buttons.map((btn, index) => {
                if (btn.id === 'separator') {
                    return <div key={index} className="w-px h-5 bg-gray-200 dark:bg-gray-700 mx-1"></div>;
                }

                // Check if this button is an alignment button and if it matches the current alignment
                const isActive = btn.id?.startsWith('align-') && btn.id === `align-${alignment}`;
                
                return (
                    <button
                        key={btn.id}
                        onClick={() => onAction(btn.id as ToolbarAction)}
                        title={btn.label}
                        className={`p-2 rounded transition-colors ${
                            isActive 
                                ? 'bg-sky-100 text-sky-600 dark:bg-sky-900/50 dark:text-sky-400' 
                                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'
                        }`}
                    >
                        {btn.icon && <btn.icon className="w-4 h-4" />}
                    </button>
                );
            })}
        </div>
    );
};

export default WritingToolbar;
