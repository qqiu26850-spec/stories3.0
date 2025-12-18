
import React from 'react';
import { View } from '../types';
import { Sparkles, BookOpen, Box, Workflow, Database, UserCircle, QuestionMarkCircle, ChevronRight, InformationCircle, Check } from './Icon';

interface HelpCenterProps {
    onNavigate: (view: View) => void;
}

const HelpSection: React.FC<{ 
    title: string; 
    target: View;
    icon: any; 
    onNavigate: (view: View) => void;
    steps?: string[];
    children: React.ReactNode 
}> = ({ title, target, icon: Icon, onNavigate, steps, children }) => (
    <section className="bg-white dark:bg-gray-900 rounded-3xl p-10 border border-gray-100 dark:border-gray-800 shadow-sm transition-all hover:shadow-xl hover:border-sky-200 dark:hover:border-sky-900/50">
        <div 
            onClick={() => onNavigate(target)}
            className="flex items-center justify-between cursor-pointer group mb-8"
        >
            <div className="flex items-center gap-5">
                <div className="p-4 bg-sky-50 dark:bg-sky-900/20 rounded-2xl text-sky-600 dark:text-sky-400 shadow-inner group-hover:scale-110 transition-transform">
                    <Icon className="w-8 h-8" />
                </div>
                <h2 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight group-hover:text-sky-600 transition-colors">{title}</h2>
            </div>
            <div className="flex items-center gap-2 text-sky-500 font-bold text-sm opacity-0 group-hover:opacity-100 transition-all transform translate-x-4 group-hover:translate-x-0">
                立即前往 <ChevronRight className="w-4 h-4" />
            </div>
        </div>

        {steps && (
            <div className="mb-8 p-6 bg-sky-50/50 dark:bg-sky-900/10 rounded-2xl border border-sky-100 dark:border-sky-800">
                <h4 className="text-sm font-bold text-sky-600 dark:text-sky-400 mb-4 flex items-center gap-2 uppercase tracking-widest">
                    <Check className="w-4 h-4" /> 使用步骤
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {steps.map((step, i) => (
                        <div key={i} className="flex gap-3">
                            <span className="flex-shrink-0 w-6 h-6 bg-white dark:bg-gray-800 border border-sky-200 dark:border-sky-700 rounded-full flex items-center justify-center text-xs font-bold text-sky-500 shadow-sm">{i+1}</span>
                            <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">{step}</p>
                        </div>
                    ))}
                </div>
            </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {children}
        </div>
    </section>
);

const SubModule: React.FC<{ name: string; children: React.ReactNode; icon?: React.ReactNode }> = ({ name, children, icon }) => (
    <div className="bg-gray-50/50 dark:bg-black/20 p-6 rounded-2xl border border-gray-100 dark:border-gray-800/50 hover:bg-white dark:hover:bg-gray-800 transition-colors group">
        <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            {icon || <div className="w-1.5 h-4 bg-sky-500 rounded-full group-hover:h-6 transition-all"></div>}
            {name}
        </h4>
        <div className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed space-y-2">
            {children}
        </div>
    </div>
);

const HelpCenter: React.FC<HelpCenterProps> = ({ onNavigate }) => {
    return (
        <div className="p-8 h-full max-w-6xl mx-auto animate-fade-in overflow-y-auto custom-scrollbar font-sans">
            <header className="mb-16 text-center">
                <h1 className="text-5xl font-black text-gray-900 dark:text-white mb-6 tracking-tighter italic">奇思妙写 <span className="text-sky-500 text-3xl not-italic">·</span> 创作宝典</h1>
                <p className="text-gray-500 dark:text-gray-400 text-xl leading-relaxed max-w-2xl mx-auto">
                    我们致力于将 AI 的智慧转化为您的笔尖灵感。无论您是网文大神还是写作萌新，这份指南都将助您快速上手。
                </p>
            </header>

            <div className="grid grid-cols-1 gap-12 pb-32">
                {/* Section: Creative Generation */}
                <HelpSection 
                    title="创意生成" 
                    target="creative-generation" 
                    icon={Sparkles} 
                    onNavigate={onNavigate}
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
                    <SubModule name="世界观">构建故事背景。包括特殊的社会规则、地理环境、战力体系或魔法/科技架构。</SubModule>
                    <SubModule name="大纲">从全局视角生成故事脉络，包含起承转合的关键节点，为您的创作搭建坚实的骨架。</SubModule>
                    <SubModule name="细纲">将大纲拆解到章节级，详细规划每一章的冲突点和剧情推进方向。</SubModule>
                    <SubModule name="小说简介">基于您的故事内核，生成能够吸引读者点击的高商业化、高吸引力作品简介。</SubModule>
                </HelpSection>

                {/* Section: Writing Center */}
                <HelpSection 
                    title="创作中心" 
                    target="novel-management" 
                    icon={BookOpen} 
                    onNavigate={onNavigate}
                    steps={[
                        "进入长篇/短篇管理，新建或打开一个作品",
                        "在编辑器中自由书写，或使用右侧 AI 工具栏",
                        "选中一段文字，点击右侧“润色”进行局部优化",
                        "点击“同步”将所有灵感永久保存到云端"
                    ]}
                >
                    <SubModule name="智能续写">当您停笔时，AI 会分析上文逻辑，自动为您延续剧情。您可以指定续写侧重于“心理、动作”或是“对话”。</SubModule>
                    <SubModule name="选中文本润色">觉得某段文字太苍白？选中它，让 AI 帮您扩写环境细节，或者将文字转化为更具电影感的描写。</SubModule>
                    <SubModule name="智能评审（避坑指南）">AI 模拟资深编辑的视角，对您的章节进行全方位评审，检查是否存在逻辑漏洞或人设崩坏。</SubModule>
                    <SubModule name="分集管理">无论是章节还是剧本集数，都可以通过左侧侧边栏进行快速切换、排序和重命名。</SubModule>
                </HelpSection>

                {/* Section: Asset Management */}
                <HelpSection 
                    title="素材管理" 
                    target="character-library" 
                    icon={Database} 
                    onNavigate={onNavigate}
                    steps={[
                        "点击导航栏进入角色库、剧情库或灵光库",
                        "点击“新建素材”，选择“系统模板”或“自定义输入”",
                        "保存后，在创作中心写作时可一键关联这些素材",
                        "AI 会在生成内容时强制参考这些已设定的事实"
                    ]}
                >
                    <SubModule name="角色库">管理您的所有人物。记录主角、反派及配角的所有关键属性，确保全书人物性格始终如一。</SubModule>
                    <SubModule name="剧情库">记录关键的伏笔、未解决的冲突和高潮点，作为 AI 生成新剧情时的重要参考。</SubModule>
                    <SubModule name="灵光库">生活中的一闪念、看到的一个好词好句，随手记在这里，它们是未来创作的种子。</SubModule>
                </HelpSection>

                {/* Section: Prompt Library */}
                <HelpSection 
                    title="提示词库" 
                    target="prompt-library" 
                    icon={Box} 
                    onNavigate={onNavigate}
                    steps={[
                        "在库中浏览系统推荐或社区共享的优质模板",
                        "点击卡片预览详情，尝试填写表单字段查看效果",
                        "收藏喜欢的模板，它们会出现在您的创作中心工具栏",
                        "点击“创建”，定制您专属的结构化写作表单"
                    ]}
                >
                    <SubModule name="结构化模板">将复杂的提示词转化为简单的表单。例如：“场景描写”模板只需您填入地点、氛围和主要物品。</SubModule>
                    <SubModule name="自定义变量">使用 ${`{变量名}`} 语法创建字段。这让您可以轻松复用任何特定的写作指令。</SubModule>
                </HelpSection>

                {/* Section: Workflow */}
                <HelpSection 
                    title="工作流" 
                    target="workflow" 
                    icon={Workflow} 
                    onNavigate={onNavigate}
                    steps={[
                        "选择一个流程化的创作方案（如：三幕式剧本生成）",
                        "按照指引一步步填入核心元素",
                        "AI 将串联多个逻辑步骤，输出具有深度和连贯性的内容",
                        "自定义工作流，将您的个人成功经验转化为自动化生产线"
                    ]}
                >
                    <SubModule name="标准化生产">工作流将“想点子->写大纲->出正文”这一复杂过程标准化，适合批量产出或逻辑严密的创作任务。</SubModule>
                </HelpSection>
            </div>
            
            <footer className="mt-20 py-12 text-center border-t border-gray-100 dark:border-gray-800">
                <p className="text-sm text-gray-400">© 2025 奇思妙写 - 让每一份创意都不被辜负</p>
            </footer>
        </div>
    );
};

export default HelpCenter;
