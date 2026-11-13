
import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check } from './Icon';

interface Option {
    value: string;
    label: string;
}

interface CustomSelectProps {
    value: string;
    onChange: (value: string) => void;
    options: Option[];
    className?: string;
    placeholder?: string;
    style?: React.CSSProperties;
}

const CustomSelect: React.FC<CustomSelectProps> = ({ value, onChange, options, className = "", placeholder = "请选择", style }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });
    const containerRef = useRef<HTMLDivElement>(null);

    const selectedOption = options.find(o => o.value === value);

    const updateCoords = () => {
        if (containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            setCoords({
                top: rect.bottom + window.scrollY,
                left: rect.left + window.scrollX,
                width: rect.width
            });
        }
    };

    useEffect(() => {
        if (isOpen) {
            updateCoords();
            window.addEventListener('resize', updateCoords);
            window.addEventListener('scroll', updateCoords, true);
        }
        return () => {
            window.removeEventListener('resize', updateCoords);
            window.removeEventListener('scroll', updateCoords, true);
        };
    }, [isOpen]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                // Also check if click is inside the portal content
                const portal = document.getElementById('custom-select-portal');
                if (portal && !portal.contains(event.target as Node)) {
                    setIsOpen(false);
                }
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (val: string) => {
        onChange(val);
        setIsOpen(false);
    };

    return (
        <div className={`relative ${className}`} style={style} ref={containerRef}>
            <button
                type="button"
                onClick={() => { setIsOpen(!isOpen); }}
                className={`w-full flex items-center justify-between px-3 py-2 bg-white dark:bg-gray-800 border border-sky-500 rounded-lg shadow-sm transition-all text-xs font-bold text-gray-700 dark:text-gray-200 hover:shadow-md outline-none ${isOpen ? 'ring-2 ring-sky-200 dark:ring-sky-900' : ''}`}
            >
                <span className="truncate">{selectedOption ? selectedOption.label : (value || placeholder)}</span>
                <ChevronDown className={`w-3.5 h-3.5 text-sky-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && createPortal(
                <div 
                    id="custom-select-portal"
                    className="absolute z-[9999] bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-lg shadow-xl max-h-60 overflow-y-auto custom-scrollbar animate-fade-in"
                    style={{
                        top: coords.top + 4,
                        left: coords.left,
                        width: coords.width,
                    }}
                >
                    <div className="p-1 space-y-0.5">
                        {options.map((option) => (
                            <button
                                key={option.value}
                                type="button"
                                onClick={() => handleSelect(option.value)}
                                className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-xs text-left transition-colors ${
                                    value === option.value
                                    ? 'bg-sky-50 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400 font-bold'
                                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                                }`}
                            >
                                <span className="truncate">{option.label}</span>
                                {value === option.value && <Check className="w-3.5 h-3.5 flex-shrink-0" />}
                            </button>
                        ))}
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default CustomSelect;
