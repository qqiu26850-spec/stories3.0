
import React from 'react';
import { View } from '../types';
import { Sparkles, BookOpen, Box, Workflow, Database, UserCircle, ChevronRight, Check, Play, Film, DocumentText, ArrowPath } from './Icon';

interface HelpCenterProps {
    onNavigate: (view: View) => void;
}

const HelpSection: React.FC<{ 
    title: string; 
    target?: View;
    icon: any; 
    onNavigate?: (view: View) => void;
    steps?: string[];
    children: React.ReactNode;
    color?: string;
}> = ({ title, target, icon: Icon, onNavigate, steps, children, color = 'sky' }) => (
    <section className={`bg-white dark:bg-gray-900 rounded-3xl p-8 border border-gray-100 dark:border-gray-800 shadow-sm transition-all hover:shadow-xl hover:border-${color}-200 dark:hover:border-${color}-900/50`}>
        <div 
            onClick={() => target && onNavigate && onNavigate(target)}
            className={`flex items-center justify-between ${target ? 'cursor-pointer group' : ''} mb-6`}
        >
            <div className="flex items-center gap-4">
                <div className={`p-3 bg-${color}-50 dark:bg-${color}-900/20 rounded-2xl text-${color}-600 dark:text-${color}-400 shadow-inner ${target ? 'group-hover:scale-110' : ''} transition-transform`}>
                    <Icon className="w-7 h-7" />
                </div>
                <h2 className={`text-2xl font-black text-gray-900 dark:text-white tracking-tight ${target ? `group-hover:text-${color}-600` : ''} transition-colors`}>{title}</h2>
            </div>
            {target && (
                <div className={`flex items-center gap-2 text-${color}-500 font-bold text-sm transition-all opacity-80 group-hover:opacity-100`}>
                    立即前往 <ChevronRight className="w-4 h-4" />
                </div>
            )}
        </div>

        {steps && (
            <div className={`mb-6 p-5 bg-${color}-50/50 dark:bg-${color}-900/10 rounded-2xl border border-${color}-100 dark:border-${color}-800`}>
                <h4 className={`text-xs font-bold text-${color}-600 dark:text-${color}-400 mb-3 flex items-center gap-2 uppercase tracking-widest`}>
                    <Check className="w-3.5 h-3.5" /> 使用步骤
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {steps.map((step, i) => (
                        <div key={i} className="flex gap-3">
                            <span className={`flex-shrink-0 w-5 h-5 bg-white dark:bg-gray-800 border border-${color}-200 dark:border-${color}-700 rounded-full flex items-center justify-center text-[10px] font-bold text-${color}-500 shadow-sm`}>{i+1}</span>
                            <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">{step}</p>
                        </div>
                    ))}
                </div>
            </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {children}
        </div>
    </section>
);

const SubModule: React.FC<{ name: string; children: React.ReactNode; icon?: React.ReactNode }> = ({ name, children, icon }) => (
    <div className="bg-gray-50/50 dark:bg-black/20 p-5 rounded-2xl border border-gray-100 dark:border-gray-800/50 hover:bg-white dark:hover:bg-gray-800 transition-colors group">
        <h4 className="text-base font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
            {icon || <div className="w-1.5 h-3.5 bg-sky-500 rounded-full group-hover:h-5 transition-all"></div>}
            {name}
        </h4>
        <div className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed space-y-2">
            {children}
        </div>
    </div>
);

const VersionItem: React.FC<{ version: string; date: string; features: string[] }> = ({ version, date, features }) => (
    <div className="relative pl-8 pb-8 last:pb-0">
        <div className="absolute left-[11px] top-2 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-800 last:hidden"></div>
        <div className="absolute left-0 top-1.5 w-6 h-6 rounded-full bg-sky-100 dark:bg-sky-900 border-2 border-white dark:border-gray-900 flex items-center justify-center shadow-sm z-10">
            <div className="w-2 h-2 bg-sky-500 rounded-full"></div>
        </div>
        <div>
            <div className="flex items-center gap-3 mb-2">
                <span className="text-lg font-black text-gray-900 dark:text-white">{version}</span>
                <span className="text-xs font-medium text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">{date}</span>
            </div>
            <ul className="space-y-2">
                {features.map((feature, i) => (
                    <li key={i} className="text-sm text-gray-600 dark:text-gray-400 flex items-start gap-2">
                        <span className="text-sky-500 mt-1">•</span>
                        {feature}
                    </li>
                ))}
            </ul>
        </div>
    </div>
);

const HelpCenter: React.FC<HelpCenterProps> = ({ onNavigate }) => {
    return (
        <div className="p-4 sm:p-8 h-full max-w-6xl mx-auto animate-fade-in overflow-y-auto custom-scrollbar font-sans">
            <header className="mb-12 text-center">
                <h1 className="text-4xl font-black text-gray-900 dark:text-white mb-4 tracking-tighter">奇思妙写 <span className="text-sky-500 text-2xl">·</span> 创作宝典</h1>
                <p className="text-gray-500 dark:text-gray-400">从入门到精通，解锁 AI 创作无限可能</p>
            </header>

            <div className="flex flex-col gap-10 pb-20">
                {/* Section: Creative Generation */}
                <HelpSection 
                    title="创意生成" 
                    target="creative-generation" 
                    icon={Sparkles} 
                    onNavigate={onNavigate}
                    color="sky"
                    steps={[
                        "在首页选择任意一个创意模块卡片",
                        "配置左侧 AI 模型参数（如 DeepSeek）",
                        "关联角色库或剧情库中的相关素材",
                        "点击“开始创作”，获取灵感初稿"
                    ]}
                >
                    <SubModule name="创意脑洞">生成小说故事雏形。只需提供一个主题，AI 就会为您构建多个充满反转的故事点子。</SubModule>
                    <SubModule name="金手指">为主角定制特殊能力或系统。AI 会根据世界观设计合理、有趣且具备爽感的金手指设定。</SubModule>
                    <SubModule name="人物设定">输入角色雏形，AI 生成包含性格、外貌、隐藏秘密和具体标签的完整人设方案。</SubModule>
                    <SubModule name="大纲与细纲">从全局视角生成故事脉络，并进一步拆解到章节级，详细规划每一章的冲突点。</SubModule>
                </HelpSection>

                {/* Section: Writing Center */}
                <HelpSection 
                    title="创作中心" 
                    target="novel-management" 
                    icon={BookOpen} 
                    onNavigate={onNavigate}
                    color="emerald"
                    steps={[
                        "进入长篇/短篇管理，新建或打开一个作品",
                        "在编辑器中自由书写，或使用右侧 AI 工具栏",
                        "选中一段文字，点击右侧“润色”进行局部优化",
                        "点击“同步”将所有灵感永久保存到云端"
                    ]}
                >
                    <SubModule name="智能续写">AI 自动读取上文逻辑，为您延续剧情。支持多次续写，突破篇幅限制。</SubModule>
                    <SubModule name="选中文本润色">觉得某段文字太苍白？选中它，让 AI 帮您扩写环境细节，或者将文字转化为更具电影感的描写。</SubModule>
                    <SubModule name="智能评审">AI 模拟资深编辑的视角，对您的章节进行全方位评审，检查是否存在逻辑漏洞或人设崩坏。</SubModule>
                    <SubModule name="分集管理">无论是章节还是剧本集数，都可以通过左侧侧边栏进行快速切换、排序和重命名。</SubModule>
                </HelpSection>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                    {/* Section: Asset Management */}
                    <HelpSection 
                        title="素材管理" 
                        target="character-library" 
                        icon={Database} 
                        onNavigate={onNavigate}
                        color="purple"
                    >
                        <SubModule name="角色库" icon={<UserCircle className="w-4 h-4 text-purple-500" />}>
                            记录主角、反派及配角的关键属性，确保人物性格统一。
                        </SubModule>
                        <SubModule name="剧情库" icon={<BookOpen className="w-4 h-4 text-purple-500" />}>
                            记录关键伏笔、未解决的冲突和高潮点，作为 AI 生成参考。
                        </SubModule>
                    </HelpSection>

                    {/* Section: Prompt Library */}
                    <HelpSection 
                        title="提示词库" 
                        target="prompt-library" 
                        icon={Box} 
                        onNavigate={onNavigate}
                        color="orange"
                    >
                        <SubModule name="结构化模板" icon={<DocumentText className="w-4 h-4 text-orange-500" />}>
                            将复杂的提示词转化为简单的表单，复用高效写作指令。
                        </SubModule>
                        <SubModule name="社区共享" icon={<Sparkles className="w-4 h-4 text-orange-500" />}>
                            浏览并收藏社区优质模板，一键应用到您的创作中。
                        </SubModule>
                    </HelpSection>
                </div>

                {/* Section: Version History */}
                <div className="bg-gray-50 dark:bg-gray-900/50 rounded-3xl p-8 border border-gray-200 dark:border-gray-800">
                    <div className="flex items-center gap-4 mb-8">
                        <div className="p-3 bg-gray-200 dark:bg-gray-800 rounded-2xl text-gray-600 dark:text-gray-300">
                            <ArrowPath className="w-7 h-7" />
                        </div>
                        <h2 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">版本更新日志</h2>
                    </div>
                    
                    <div className="bg-white dark:bg-gray-900 rounded-2xl p-8 border border-gray-100 dark:border-gray-800 shadow-sm">
                        <VersionItem 
                            version="v1.4.0" 
                            date="2025.02.19"
                            features={[
                                "新增「智能续写」功能：在生成内容被截断时，支持一键无缝续写。",
                                "优化了长文本的渲染性能，大幅减少粘贴大量文字时的卡顿。",
                                "优化了提示词库的筛选逻辑，支持按功能和题材双重过滤。",
                                "视觉体验升级：更新了版本弹窗与帮助中心的布局设计。"
                            ]}
                        />
                        <VersionItem 
                            version="v1.3.0" 
                            date="2025.02.01"
                            features={[
                                "上线「工作流」引擎：支持多步骤、链式 AI 创作任务。",
                                "新增「剧本改编」模式：支持小说自动转剧本格式。",
                                "个人中心升级：支持修改头像与昵称。"
                            ]}
                        />
                        <VersionItem 
                            version="v1.2.0" 
                            date="2025.01.15"
                            features={[
                                "新增「素材库」：支持角色、剧情、灵光碎片的管理与关联。",
                                "集成了 DeepSeek-V3 与 Gemini 2.0 模型。",
                                "优化了移动端的适配体验。"
                            ]}
                        />
                    </div>
                </div>
            </div>
            
            <footer className="mt-10 py-8 text-center border-t border-gray-100 dark:border-gray-800">
                <p className="text-xs text-gray-400">© 2025 奇思妙写 - 让每一份创意都不被辜负</p>
            </footer>
        </div>
    );
};

export default HelpCenter;
