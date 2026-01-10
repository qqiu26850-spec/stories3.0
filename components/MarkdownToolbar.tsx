
import React, { useState, useRef, useEffect } from 'react';
import { Bold, Italic, ListBullet, TextIncrease, AlignLeft, AlignCenter, AlignRight, ChevronDown, Check } from './Icon';

interface MarkdownToolbarProps {
    textareaId: string;
    onInsert: (value: string) => void;
}

// Helper: Convert number to Chinese numeral (simple implementation for 1-99)
const toChineseNum = (num: number): string => {
    const chars = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
    if (num <= 10) return chars[num];
    if (num < 20) return '十' + chars[num % 10];
    if (num % 10 === 0) return chars[Math.floor(num / 10)] + '十';
    return chars[Math.floor(num / 10)] + '十' + chars[num % 10];
};

// Helper: Convert Chinese numeral to number
const fromChineseNum = (str: string): number => {
    const chars = { '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '十': 10 };
    if (chars[str as keyof typeof chars]) return chars[str as keyof typeof chars];
    if (str.startsWith('十')) return 10 + (chars[str[1] as keyof typeof chars] || 0);
    if (str.endsWith('十')) return (chars[str[0] as keyof typeof chars] || 0) * 10;
    // Simple 2 digit case
    if (str.includes('十')) {
        const parts = str.split('十');
        return (chars[parts[0] as keyof typeof chars] || 1) * 10 + (chars[parts[1] as keyof typeof chars] || 0);
    }
    return 0;
};

// Helper: Circled numbers
const CIRCLED_NUMS = ['⓪', '①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩', '⑪', '⑫', '⑬', '⑭', '⑮', '⑯', '⑰', '⑱', '⑲', '⑳'];

export const handleListKeyDown = (
    e: React.KeyboardEvent<HTMLTextAreaElement>,
    value: string,
    setValue: (val: string) => void
) => {
    if (e.key === 'Enter') {
        const textarea = e.currentTarget;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;

        if (start !== end) return; // Don't handle if text is selected

        // Get current line
        const lastNewLine = value.lastIndexOf('\n', start - 1);
        const currentLineStart = lastNewLine === -1 ? 0 : lastNewLine + 1;
        const currentLine = value.substring(currentLineStart, start);

        // Regex patterns for different list types
        const patterns = [
            { regex: /^(\s*)(\d+)\.\s/, type: 'decimal' }, // 1. 
            { regex: /^(\s*)(\d+)\)\s/, type: 'bracket' }, // 1)
            { regex: /^(\s*)\((\d+)\)\s/, type: 'paren' }, // (1)
            { regex: /^(\s*)([A-Z])\.\s/, type: 'upperAlpha' }, // A.
            { regex: /^(\s*)([a-z])\.\s/, type: 'lowerAlpha' }, // a.
            { regex: /^(\s*)([一二三四五六七八九十]+)、\s/, type: 'chinese' }, // 一、
            { regex: /^(\s*)（([一二三四五六七八九十]+)）\s/, type: 'chineseParen' }, // （一）
            { regex: /^(\s*)([①-⑳])\s/, type: 'circled' }, // ①
            { regex: /^(\s*)-\s/, type: 'dash' }, // - (unordered)
        ];

        for (const pattern of patterns) {
            const match = currentLine.match(pattern.regex);
            if (match) {
                e.preventDefault();
                const indent = match[1];
                let nextMarker = '';

                // If the user presses Enter on an empty list item (just the marker), remove the marker
                const contentAfterMarker = currentLine.replace(pattern.regex, '').trim();
                if (!contentAfterMarker) {
                    // Remove current line's marker
                    const newValue = value.substring(0, currentLineStart) + value.substring(start);
                    setValue(newValue);
                    // We need to set cursor position via timeout because React state update is async
                    setTimeout(() => {
                        textarea.setSelectionRange(currentLineStart, currentLineStart);
                    }, 0);
                    return;
                }

                // Calculate next marker
                switch (pattern.type) {
                    case 'decimal':
                        nextMarker = `${parseInt(match[2]) + 1}. `;
                        break;
                    case 'bracket':
                        nextMarker = `${parseInt(match[2]) + 1}) `;
                        break;
                    case 'paren':
                        nextMarker = `(${parseInt(match[2]) + 1}) `;
                        break;
                    case 'upperAlpha':
                        nextMarker = `${String.fromCharCode(match[2].charCodeAt(0) + 1)}. `;
                        break;
                    case 'lowerAlpha':
                        nextMarker = `${String.fromCharCode(match[2].charCodeAt(0) + 1)}. `;
                        break;
                    case 'chinese':
                        nextMarker = `${toChineseNum(fromChineseNum(match[2]) + 1)}、 `;
                        break;
                    case 'chineseParen':
                        nextMarker = `（${toChineseNum(fromChineseNum(match[2]) + 1)}） `;
                        break;
                    case 'circled':
                        const idx = CIRCLED_NUMS.indexOf(match[2]);
                        if (idx !== -1 && idx < CIRCLED_NUMS.length - 1) {
                            nextMarker = `${CIRCLED_NUMS[idx + 1]} `;
                        } else {
                            nextMarker = match[2] + ' '; // Fallback
                        }
                        break;
                    case 'dash':
                        nextMarker = '- ';
                        break;
                }

                const insertStr = `\n${indent}${nextMarker}`;
                const newValue = value.substring(0, start) + insertStr + value.substring(end);
                setValue(newValue);

                setTimeout(() => {
                    const newPos = start + insertStr.length;
                    textarea.setSelectionRange(newPos, newPos);
                    // Adjust scroll if needed
                    textarea.blur(); 
                    textarea.focus();
                }, 0);
                return;
            }
        }
    }
};

const MarkdownToolbar: React.FC<MarkdownToolbarProps> = ({ textareaId, onInsert }) => {
    const [showListDropdown, setShowListDropdown] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setShowListDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

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
        if (prefix.trim().startsWith('#') || prefix.trim().startsWith('-') || /^\d/.test(prefix) || /^[A-Za-z]/.test(prefix) || /^[\u4e00-\u9fa5]/.test(prefix) || /^[\(（①]/.test(prefix)) {
             // Try to find the start of the line
             const lineStart = text.lastIndexOf('\n', start - 1) + 1;
             newText = text.substring(0, lineStart) + prefix + text.substring(lineStart);
             newCursorPos = start + prefix.length;
        } else {
             newText = text.substring(0, start) + prefix + selection + suffix + text.substring(end);
             newCursorPos = end + prefix.length + suffix.length;
        }

        onInsert(newText);
        
        setTimeout(() => {
            textarea.focus();
            textarea.setSelectionRange(newCursorPos, newCursorPos);
        }, 0);
    };

    const ListOption: React.FC<{ label: string; prefix: string; example: string[] }> = ({ label, prefix, example }) => (
        <button 
            type="button"
            onClick={() => { handleInsert(prefix); setShowListDropdown(false); }}
            className="flex flex-col items-start p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 border border-transparent hover:border-gray-200 dark:hover:border-gray-600 transition-all text-left w-full h-full"
        >
            <div className="text-xs font-bold text-gray-700 dark:text-gray-200 mb-1 w-full border-b border-gray-100 dark:border-gray-700 pb-1">{label}</div>
            <div className="text-[10px] text-gray-400 space-y-0.5 w-full">
                {example.map((ex, i) => <div key={i} className="truncate">{ex}</div>)}
            </div>
        </button>
    );

    return (
        <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-t-lg border-b border-gray-200 dark:border-gray-700 relative z-20">
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
            
            <div className="relative" ref={dropdownRef}>
                <button 
                    type="button" 
                    onClick={() => setShowListDropdown(!showListDropdown)} 
                    className={`p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-gray-600 dark:text-gray-300 flex items-center gap-0.5 ${showListDropdown ? 'bg-gray-200 dark:bg-gray-700' : ''}`}
                    title="列表样式"
                >
                    <ListBullet className="w-3.5 h-3.5" />
                    <ChevronDown className="w-2.5 h-2.5" />
                </button>

                {showListDropdown && (
                    <div className="absolute top-full left-0 mt-1 w-[320px] bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 p-3 grid grid-cols-3 gap-2 z-50">
                        <div className="col-span-3 text-[10px] font-bold text-gray-400 px-1 mb-1">选择列表样式</div>
                        
                        <ListOption label="无样式" prefix="" example={['文本内容', '文本内容']} />
                        <ListOption label="中文数字" prefix="一、 " example={['一、第一点', '二、第二点', '三、第三点']} />
                        <ListOption label="中文括号" prefix="（一） " example={['（一）内容', '（二）内容', '（三）内容']} />
                        <ListOption label="数字列表" prefix="1. " example={['1. 第一项', '2. 第二项', '3. 第三项']} />
                        <ListOption label="括号数字" prefix="(1) " example={['(1) 选项A', '(2) 选项B', '(3) 选项C']} />
                        <ListOption label="圆圈数字" prefix="① " example={['① 第一步', '② 第二步', '③ 第三步']} />
                        <ListOption label="半括号数" prefix="1) " example={['1) 内容', '2) 内容', '3) 内容']} />
                        <ListOption label="大写字母" prefix="A. " example={['A. 选项', 'B. 选项', 'C. 选项']} />
                        <ListOption label="小写字母" prefix="a. " example={['a. 细节', 'b. 细节', 'c. 细节']} />
                    </div>
                )}
            </div>
        </div>
    );
};

export default MarkdownToolbar;
