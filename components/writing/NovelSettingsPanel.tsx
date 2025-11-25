import React from 'react';
import { NovelSettings } from '../../types';

interface NovelSettingsPanelProps {
    settings: NovelSettings;
    onUpdate: (key: keyof NovelSettings, value: string) => void;
}

const NovelSettingsPanel: React.FC<NovelSettingsPanelProps> = ({ settings, onUpdate }) => {
    
    const formFields: { id: keyof NovelSettings; label: string; placeholder: string; rows: number }[] = [
        { id: 'typeElements', label: '类型元素', placeholder: '例如：科幻、赛博朋克', rows: 2 },
        { id: 'theme', label: '主题', placeholder: '例如：救赎、成长', rows: 2 },
        { id: 'targetAudience', label: '目标读者', placeholder: '例如：青少年、科幻迷', rows: 1 },
        { id: 'synopsis', label: '作品梗概', placeholder: '简要描述故事的核心情节...', rows: 4 },
        { id: 'worldview', label: '世界观', placeholder: '描述世界规则、背景设定...', rows: 4 },
        { id: 'characterSettings', label: '人物设定', placeholder: '主要角色的姓名、性格、背景...', rows: 4 },
    ];

    return (
        <div className="p-4 space-y-4 animate-fade-in">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                完善作品设定有助于AI更好地理解您的创作意图。
            </p>
            {formFields.map(field => (
                <div key={field.id}>
                    <label htmlFor={`setting-${field.id}`} className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                        {field.label}
                    </label>
                    {field.rows === 1 ? (
                         <input
                            type="text"
                            id={`setting-${field.id}`}
                            value={settings[field.id]}
                            onChange={(e) => onUpdate(field.id, e.target.value)}
                            placeholder={field.placeholder}
                            className="w-full p-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition text-gray-900 dark:text-gray-200"
                        />
                    ) : (
                        <textarea
                            id={`setting-${field.id}`}
                            rows={field.rows}
                            value={settings[field.id]}
                            onChange={(e) => onUpdate(field.id, e.target.value)}
                            placeholder={field.placeholder}
                            className="w-full p-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition resize-none text-gray-900 dark:text-gray-200"
                        />
                    )}
                </div>
            ))}
        </div>
    );
};

export default NovelSettingsPanel;