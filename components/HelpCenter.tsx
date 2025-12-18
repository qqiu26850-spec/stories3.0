
import React from 'react';
import { View } from '../types';
import { Sparkles, BookOpen, Box, Workflow, Database, UserCircle, QuestionMarkCircle, ChevronRight, InformationCircle } from './Icon';

interface HelpCenterProps {
    onNavigate: (view: View) => void;
}

const HelpSection: React.FC<{ 
    title: string; 
    target: View;
    icon: any; 
    onNavigate: (view: View) => void;
    children: React.ReactNode 
}> = ({ title, target, icon: Icon, onNavigate, children }) => (
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {children}
        </div>
    </section>
);

const SubModule: React.FC<{ name: string; children: React.ReactNode }> = ({ name, children }) => (
    <div className="bg-gray-50/50 dark:bg-black/20 p-6 rounded-2xl border border-gray-100 dark:border-gray-800/50">
        <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            <div className="w-1.5 h-4 bg-sky-500 rounded-full"></div>
            {name}
        </h4>
        <div className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed space-y-2">
            {children}
        </div>
    </div>
);

const PromptExample: React.FC<{ title: string; template: string; result: string }> = ({ title, template, result }) => (
    <div className="col-span-full mt-6 bg-gray-50 dark:bg-black/30 rounded-2xl p-6 border border-sky-100 dark:border-sky-900/30 overflow-hidden">
        <div className="flex items-center gap-2 text-sky-600 dark:text-sky-400 font-black text-xs uppercase tracking-widest mb-4">
            <InformationCircle className="w-4 h-4" />
            演示示例：{title}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-400 uppercase">创建模板 (变量格式)</label>
                <div className="p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 text-xs font-mono text-gray-600 dark:text-gray-300">
                    {template}
                </div>
            </div>
            <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-400 uppercase">实际运行效果</label>
                <div className="p-3 bg-sky-600 text-white rounded-xl text-xs leading-relaxed italic shadow-lg shadow-sky-500/20">
                    {result}
                </div>
            </div>
        </div>
    </div>
);

const HelpCenter: React.FC<HelpCenterProps> = ({ onNavigate }) => {
    return (
        <div className="p-8 h-full max-w-6xl mx-auto animate-fade-in overflow-y-auto custom-scrollbar font-sans">
            <header className="mb-16 text-center">
                <h1 className="text-5xl font-black text-gray-900 dark:text-white mb-6 tracking-tighter">奇思妙写 · 快速上手</h1>
                <p className="text-gray-500 dark:text-gray-400 text-xl leading-relaxed">
                    在这里，AI 不是替你写，而是陪你写。点击下方板块了解如何玩转。
                </p>
            </header>

            <div className="grid grid-cols-1 gap-12 pb-32">
                <HelpSection title="创意生成" target="creative-generation" icon={Sparkles} onNavigate={onNavigate}>
                    <SubModule name="想不出好点子？">点击“创意脑洞”，输入一两个模糊的关键词（如“失忆、月球”），AI 会为你编织出好几个截然不同的故事开篇，帮你打破起步难。</SubModule>
                    <SubModule name="人设太单薄？">点击“人物设定”，填入主角性格，AI 会生成具体的爆款标签和复杂的人物关系网，让角色瞬间立起来。</SubModule>
                    <SubModule name="怎么让剧情更爽？">试试“金手指”功能，AI 会根据你的题材，设计一套既有新意又不会写崩的特殊能力或系统。 </SubModule>
                    <SubModule name="小技巧：多点耐心">如果生成的内容不合心意，可以试着增加一句“要有意想不到的反转”，AI 的表现会有质的飞跃。</SubModule>
                </HelpSection>

                <HelpSection title="创作中心" target="novel-management" icon={BookOpen} onNavigate={onNavigate}>
                    <SubModule name="智能续写（拒绝卡文）">写到关键处卡住了？在编辑器里敲几个字，点击右侧“续写”，AI 会顺着你的思路往下编。你可以指定它是“侧重心理描写”还是“让反派突然出现”。</SubModule>
                    <SubModule name="选中文本润色">觉得某一段写得太干巴？鼠标选中它，点“润色”，AI 能帮你扩写环境氛围，或者把平铺直叙变得更有文学美感。</SubModule>
                    <SubModule name="逻辑自查">写了上万字怕前后矛盾？使用“智能评审”，让 AI 像编辑一样帮你挑挑刺，看看反派的行为逻辑是不是符合他的人设。</SubModule>
                    <SubModule name="多端同步">你的草稿会实时保存。无论是换台电脑还是刷新页面，你的故事都在云端等着你。</SubModule>
                </HelpSection>

                <HelpSection title="素材管理" target="character-library" icon={Database} onNavigate={onNavigate}>
                    <SubModule name="让AI记住设定">把主角的名字、外貌、隐藏秘密记在“角色库”。AI 写作时会自动参考这些笔记，再也不用担心写着写着主角的眼睛从黑色变成蓝色了。</SubModule>
                    <SubModule name="随时捕捉灵感">半夜想到的好点子，随手记在“灵光库”。这些灵感碎片在以后写大纲、写正文时，都可以一键调取给 AI 当参考。</SubModule>
                </HelpSection>

                <HelpSection title="提示词库" target="prompt-library" icon={Box} onNavigate={onNavigate}>
                    <SubModule name="定制你的写作表单">你可以把常用的写作要求存成“模版”。比如“描写战斗场面”，设置几个变量：主角、对手、招式名。下次只需填这几个空，AI 就懂怎么写了。</SubModule>
                    <SubModule name="社区共享">去提示词库看看大家是怎么写书的，好的模版可以直接收藏到自己的库里，一键复用。</SubModule>
                    <PromptExample 
                        title="自定义战斗场景描述"
                        template="请作为一名格斗专家，描写角色 ${character} 使用 ${move} 击败 ${enemy} 的过程，要求画面感极强。"
                        result="你只需填入：(萧炎、八极崩、纳兰嫣然)，AI 就会输出一段行云流水的打斗细节。"
                    />
                </HelpSection>

                <HelpSection title="工作流" target="workflow" icon={Workflow} onNavigate={onNavigate}>
                    <SubModule name="剧情生产流水线">把复杂的创作拆解成标准化步骤。比如：先根据点子生成大纲，再细化到每一章的剧情，最后生成正文。跟着工作流走，写书就像工厂组装一样高效。</SubModule>
                </HelpSection>
            </div>
        </div>
    );
};

export default HelpCenter;
