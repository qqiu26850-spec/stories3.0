
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
            引导示例：{title}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-400 uppercase">输入模板</label>
                <div className="p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 text-xs font-mono text-gray-600 dark:text-gray-300">
                    {template}
                </div>
            </div>
            <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-400 uppercase">生成效果</label>
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
                    这里为您详细解析每一个创作引擎，点击各标题可直接跳转至对应功能模块。
                </p>
            </header>

            <div className="grid grid-cols-1 gap-12 pb-32">
                <HelpSection title="创意生成" target="creative-generation" icon={Sparkles} onNavigate={onNavigate}>
                    <p className="text-lg font-medium text-gray-700 dark:text-gray-300">
                        创意生成模块旨在解决“起步难”的问题，通过多维度的逻辑推演，为您的故事奠定坚实基础。
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <SubModule name="创意脑洞">
                            输入关键词，AI 生成故事核心矛盾、主要情节及 3 种反转走向。
                        </SubModule>
                        <SubModule name="金手指设定">
                            专为网文优化，生成成长体系平衡且极具卖点的超凡设定。
                        </SubModule>
                        <SubModule name="大纲与细纲">
                            支持从卷纲到章纲的阶梯式生成，自动平衡剧情节奏。
                        </SubModule>
                        <SubModule name="重要细节提示">
                            <strong>细节提示：</strong>在输入时加入“侧重于悬疑感”或“偏向慢节奏描写”等指令，可大幅度提升初稿满意度。
                        </SubModule>
                    </div>
                </HelpSection>

                <HelpSection title="创作中心" target="novel-management" icon={BookOpen} onNavigate={onNavigate}>
                    <p className="text-lg font-medium text-gray-700 dark:text-gray-300">
                        核心写作阵地，集成智能续写与实时润色助手。
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <SubModule name="长篇/短篇模式">
                            长篇支持卷章结构，短篇侧重单章爆发。
                        </SubModule>
                        <SubModule name="智能侧边栏">
                            提供剧情推演、文笔质感提升及逻辑矛盾自查。
                        </SubModule>
                    </div>
                    <PromptExample 
                        title="剧情推演"
                        template="根据上文，主角在绝境下会如何反击？请给出 3 种逻辑自洽的方案。"
                        result="方案一：利用之前埋下的伏笔物件；方案二：通过言语博弈制造对方内讧；方案三：通过局部牺牲换取关键逃生机会。"
                    />
                </HelpSection>

                <HelpSection title="素材管理" target="character-library" icon={Database} onNavigate={onNavigate}>
                    <p className="text-lg font-medium text-gray-700 dark:text-gray-300">
                        您的“创作数据库”，实现人设与伏笔的数字化管理。
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <SubModule name="角色/剧情/灵光">
                            全站联动，AI 在续写时会自动参考库中的设定保持一致性。
                        </SubModule>
                        <SubModule name="重要的细节提示">
                            <strong>录入技巧：</strong>录入角色时，尽量写出角色的“执念”和“弱点”，这会让 AI 生成的对白更具深度。
                        </SubModule>
                    </div>
                </HelpSection>

                <HelpSection title="提示词库" target="prompt-library" icon={Box} onNavigate={onNavigate}>
                    <p className="text-lg font-medium text-gray-700 dark:text-gray-300">
                        参数化模板系统，让您可以自定义专属的生成引擎。
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <SubModule name="模板构建">
                            支持变量嵌入，一键转化为带输入框的便捷表单。
                        </SubModule>
                        <SubModule name="效果范例">
                            支持为模板设置参考输出，帮助用户预判效果。
                        </SubModule>
                    </div>
                    <PromptExample 
                        title="参数化模板示例"
                        template="请根据风格 ${style} 描写一段主角 ${name} 在 ${location} 的心理活动。"
                        result="（表单化显示）输入姓名、地点、风格，AI 即可按固定格式稳定输出。"
                    />
                </HelpSection>

                <HelpSection title="工作流" target="workflow" icon={Workflow} onNavigate={onNavigate}>
                    <p className="text-lg font-medium text-gray-700 dark:text-gray-300">
                        自动化生成引擎，将复杂的创作链路拆解为标准化步骤。
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <SubModule name="标准/自定义流">
                            如“剧本改编流”：分步输入，实现从文字到画面的精准转化。
                        </SubModule>
                    </div>
                </HelpSection>

                <section className="bg-sky-600 rounded-3xl p-12 text-white shadow-2xl shadow-sky-500/20 text-center">
                    <h2 className="text-3xl font-black mb-6">准备好开启创作之旅了吗？</h2>
                    <p className="text-sky-100 text-lg mb-8 max-w-2xl mx-auto">
                        每一个伟大的作品都始于一个小小的灵感。现在就进入创作中心。
                    </p>
                    <div className="flex justify-center gap-4">
                        <button onClick={() => onNavigate('novel-management')} className="px-8 py-3 bg-white text-sky-600 rounded-full font-black shadow-lg hover:bg-gray-50 transition-colors">进入长篇小说</button>
                        <button onClick={() => onNavigate('creative-generation')} className="px-8 py-3 bg-sky-500 text-white border border-sky-400 rounded-full font-black hover:bg-sky-400 transition-colors">开启创意脑洞</button>
                    </div>
                </section>
            </div>
        </div>
    );
};

export default HelpCenter;
