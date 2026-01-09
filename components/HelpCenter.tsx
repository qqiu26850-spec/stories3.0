
import React, { useState } from 'react';
import { View } from '../types';
import { Sparkles, BookOpen, Box, Workflow, Database, UserCircle, ChevronRight, Check, Play, Film, DocumentText, ArrowPath, QuestionMarkCircle } from './Icon';

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
    <section className={`bg-white dark:bg-gray-900 rounded-3xl p-6 border border-gray-100 dark:border-gray-800 shadow-sm transition-all hover:shadow-xl hover:border-${color}-200 dark:hover:border-${color}-900/50`}>
        <div 
            onClick={() => target && onNavigate && onNavigate(target)}
            className={`flex items-center justify-between ${target ? 'cursor-pointer group' : ''} mb-4`}
        >
            <div className="flex items-center gap-3">
                <div className={`p-2.5 bg-${color}-50 dark:bg-${color}-900/20 rounded-xl text-${color}-600 dark:text-${color}-400 shadow-inner ${target ? 'group-hover:scale-110' : ''} transition-transform`}>
                    <Icon className="w-6 h-6" />
                </div>
                <h2 className={`text-xl font-black text-gray-900 dark:text-white tracking-tight ${target ? `group-hover:text-${color}-600` : ''} transition-colors`}>{title}</h2>
            </div>
            {target && (
                <div className={`flex items-center gap-1 text-${color}-500 font-bold text-xs transition-all opacity-80 group-hover:opacity-100`}>
                    立即前往 <ChevronRight className="w-3.5 h-3.5" />
                </div>
            )}
        </div>

        {steps && (
            <div className={`mb-4 p-4 bg-${color}-50/50 dark:bg-${color}-900/10 rounded-xl border border-${color}-100 dark:border-${color}-800`}>
                <h4 className={`text-xs font-bold text-${color}-600 dark:text-${color}-400 mb-2 flex items-center gap-2 uppercase tracking-widest`}>
                    <Check className="w-3.5 h-3.5" /> 使用步骤
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {steps.map((step, i) => (
                        <div key={i} className="flex gap-2">
                            <span className={`flex-shrink-0 w-4 h-4 bg-white dark:bg-gray-800 border border-${color}-200 dark:border-${color}-700 rounded-full flex items-center justify-center text-[9px] font-bold text-${color}-500 shadow-sm`}>{i+1}</span>
                            <p className="text-[11px] text-gray-600 dark:text-gray-400 leading-relaxed">{step}</p>
                        </div>
                    ))}
                </div>
            </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {children}
        </div>
    </section>
);

const SubModule: React.FC<{ name: string; children: React.ReactNode; icon?: React.ReactNode }> = ({ name, children, icon }) => (
    <div className="bg-gray-50/50 dark:bg-black/20 p-4 rounded-xl border border-gray-100 dark:border-gray-800/50 hover:bg-white dark:hover:bg-gray-800 transition-colors group">
        <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-1.5 flex items-center gap-2">
            {icon || <div className="w-1 h-3 bg-sky-500 rounded-full group-hover:h-4 transition-all"></div>}
            {name}
        </h4>
        <div className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed space-y-1">
            {children}
        </div>
    </div>
);

const VersionItem: React.FC<{ version: string; date: string; features: string[]; isLatest?: boolean }> = ({ version, date, features, isLatest }) => (
    <div className="relative pl-6 pb-6 last:pb-0">
        <div className="absolute left-[9px] top-2 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-800 last:hidden"></div>
        <div className={`absolute left-0 top-1.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shadow-sm z-10 ${isLatest ? 'bg-sky-100 dark:bg-sky-900 border-sky-500' : 'bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700'}`}>
            <div className={`w-1.5 h-1.5 rounded-full ${isLatest ? 'bg-sky-500' : 'bg-gray-400'}`}></div>
        </div>
        <div>
            <div className="flex items-center gap-3 mb-2">
                <span className={`text-base font-black ${isLatest ? 'text-sky-600 dark:text-sky-400' : 'text-gray-900 dark:text-white'}`}>{version}</span>
                <span className="text-[10px] font-medium text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">{date}</span>
                {isLatest && <span className="text-[9px] font-bold text-white bg-sky-500 px-1.5 py-0.5 rounded-full">最新</span>}
            </div>
            <ul className="space-y-1.5">
                {features.map((feature, i) => (
                    <li key={i} className="text-xs text-gray-600 dark:text-gray-400 flex items-start gap-2">
                        <span className="text-sky-500 mt-0.5">•</span>
                        {feature}
                    </li>
                ))}
            </ul>
        </div>
    </div>
);

const HelpCenter: React.FC<HelpCenterProps> = ({ onNavigate }) => {
    const [activeTab, setActiveTab] = useState<'guide' | 'updates'>('guide');

    return (
        <div className="p-2 sm:p-4 h-full max-w-6xl mx-auto animate-fade-in flex flex-col font-sans">
            <div className="mb-4 text-center flex-shrink-0">
                <div className="flex justify-center">
                    <div className="bg-gray-100 dark:bg-gray-800 p-1 rounded-xl inline-flex items-center">
                        <button 
                            onClick={() => setActiveTab('guide')}
                            className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'guide' ? 'bg-white dark:bg-gray-700 text-sky-600 dark:text-sky-400 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
                        >
                            <span className="flex items-center gap-2"><QuestionMarkCircle className="w-4 h-4"/> 功能简介</span>
                        </button>
                        
                        <a 
                            href="https://my.feishu.cn/wiki/NQcDwXqTLiRAsRk14TCc5y6fnke?from=from_copylink"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-6 py-2 rounded-lg text-sm font-bold transition-all text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-700/50"
                        >
                            <span className="flex items-center gap-2"><BookOpen className="w-4 h-4"/> 使用教程</span>
                        </a>

                        <button 
                            onClick={() => setActiveTab('updates')}
                            className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'updates' ? 'bg-white dark:bg-gray-700 text-sky-600 dark:text-sky-400 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
                        >
                            <span className="flex items-center gap-2"><ArrowPath className="w-4 h-4"/> 版本更新</span>
                        </button>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar pb-4">
                {activeTab === 'guide' ? (
                    <div className="flex flex-col gap-4 animate-fade-in">
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

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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
                    </div>
                ) : (
                    <div className="bg-gray-50 dark:bg-gray-900/50 rounded-3xl p-6 border border-gray-200 dark:border-gray-800 animate-fade-in">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2.5 bg-gray-200 dark:bg-gray-800 rounded-xl text-gray-600 dark:text-gray-300">
                                <ArrowPath className="w-6 h-6" />
                            </div>
                            <h2 className="text-xl font-black text-gray-900 dark:text-white tracking-tight">更新日志</h2>
                        </div>
                        
                        <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 border border-gray-100 dark:border-gray-800 shadow-sm">
                            <VersionItem 
                                version="v1.6.0" 
                                date="2026.01.10"
                                isLatest={true}
                                features={[
                                    "新增「工作流选中追问」：在运行结果中选中文字，即可进行上下文感知的定向追问。",
                                    "模型升级：全面接入 Gemini 3.0 Flash 与 DeepSeek-V3，生成更智能、响应更迅速。",
                                    "优化了续写生成的连贯性逻辑，减少上下文断层。"
                                ]}
                            />
                            <VersionItem 
                                version="v1.5.0" 
                                date="2026.01.06"
                                features={[
                                    "短篇模式重构：移除章节列表与标题，打造沉浸式单页创作环境。",
                                    "设定管理升级：作品设定改为卡片式管理 + 弹窗录入，界面更清爽。",
                                    "精准选区交互：AI 面板内容填充逻辑优化，仅在选中时触发，减少误操作。"
                                ]}
                            />
                            <VersionItem 
                                version="v1.4.0" 
                                date="2025.12.20"
                                features={[
                                    "新增「智能续写」功能：在生成内容被截断时，支持一键无缝续写。",
                                    "优化了长文本的渲染性能，大幅减少粘贴大量文字时的卡顿。",
                                    "优化了提示词库的筛选逻辑，支持按功能和题材双重过滤。"
                                ]}
                            />
                            <VersionItem 
                                version="v1.3.0" 
                                date="2025.12.01"
                                features={[
                                    "上线「工作流」引擎：支持多步骤、链式 AI 创作任务。",
                                    "新增「剧本改编」模式：支持小说自动转剧本格式。",
                                    "个人中心升级：支持修改头像与昵称。"
                                ]}
                            />
                        </div>
                    </div>
                )}
            </div>
            
            <footer className="mt-1 py-1 text-center border-t border-gray-100 dark:border-gray-800">
                <p className="text-[10px] text-gray-400">© 2026 奇思妙写 - 让每一份创意都不被辜负</p>
            </footer>
        </div>
    );
};

export default HelpCenter;
