
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
        <div className="space-y-6 text-gray-600 dark:text-gray-400 leading-loose">
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
        <div className="text-sm space-y-2 opacity-90">
            {children}
        </div>
    </div>
);

const PromptExample: React.FC<{ title: string; template: string; result: string }> = ({ title, template, result }) => (
    <div className="mt-6 bg-gray-50 dark:bg-black/30 rounded-2xl p-6 border border-sky-100 dark:border-sky-900/30 overflow-hidden">
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
        <div className="p-8 h-full max-w-6xl mx-auto animate-fade-in overflow-y-auto custom-scrollbar">
            <header className="mb-16 text-center">
                <h1 className="text-5xl font-black text-gray-900 dark:text-white mb-6 tracking-tighter">奇思妙写 · 使用指南</h1>
                <p className="text-gray-500 dark:text-gray-400 text-xl leading-relaxed">
                    点击各模块标题可直接跳转至对应功能。
                </p>
            </header>

            <div className="grid grid-cols-1 gap-12 pb-32">
                <HelpSection title="创意生成" target="creative-generation" icon={Sparkles} onNavigate={onNavigate}>
                    <p className="text-lg font-medium text-gray-700 dark:text-gray-300">
                        旨在解决“起步难”，通过多维度逻辑推演为您的故事奠基。
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <SubModule name="创意脑洞">输入关键词生成故事核心矛盾与反转走向。</SubModule>
                        <SubModule name="金手指设定">生成成长体系平衡且具卖点的超凡设定。</SubModule>
                        <SubModule name="重要细节提示"><strong>技巧：</strong>加入“侧重于悬疑感”等指令可大幅提升初稿满意度。</SubModule>
                    </div>
                </HelpSection>

                <HelpSection title="创作中心" target="novel-management" icon={BookOpen} onNavigate={onNavigate}>
                    <p className="text-lg font-medium text-gray-700 dark:text-gray-300">
                        核心写作阵地，集成智能续写与实时润色助手。
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <SubModule name="长篇/短篇模式">长篇支持卷章结构，短篇侧重单章爆发。</SubModule>
                        <SubModule name="智能侧边栏">提供剧情推演、文笔质感提升及逻辑自查。</SubModule>
                    </div>
                </HelpSection>

                <HelpSection title="素材管理" target="character-library" icon={Database} onNavigate={onNavigate}>
                    <p className="text-lg font-medium text-gray-700 dark:text-gray-300">
                        实现人设与伏笔的数字化管理，全站联动引用。
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <SubModule name="全站联动">AI 在续写时会自动参考库中的设定保持一致性。</SubModule>
                        <SubModule name="重要细节提示"><strong>技巧：</strong>录入角色的“执念”和“弱点”，让对白更具深度。</SubModule>
                    </div>
                </HelpSection>

                <HelpSection title="提示词库" target="prompt-library" icon={Box} onNavigate={onNavigate}>
                    <p className="text-lg font-medium text-gray-700 dark:text-gray-300">
                        自定义生成引擎，通过变量嵌入实现参数化创作。
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <SubModule name="模板构建">支持变量嵌入，一键转化为带输入框的便捷表单。</SubModule>
                    </div>
                    <PromptExample 
                        title="真实创作案例：场景描写续写"
                        template="请作为一名资深网文主编，根据以下大纲：${outline}，续写角色 ${character} 在 ${location} 的具体行为，要求风格细腻。 "
                        result="输入：大纲(寻找秘籍)、角色(林动)、地点(藏经阁)。AI 即可按固定格式稳定输出高度一致的描写内容。"
                    />
                </HelpSection>

                <HelpSection title="工作流" target="workflow" icon={Workflow} onNavigate={onNavigate}>
                    <p className="text-lg font-medium text-gray-700 dark:text-gray-300">
                        自动化引擎，将复杂的创作链路拆解为标准化步骤。
                    </p>
                </HelpSection>
            </div>
        </div>
    );
};

export default HelpCenter;
