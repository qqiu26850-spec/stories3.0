
import React from 'react';
import { Sparkles, BookOpen, Box, Workflow, Database, UserCircle, QuestionMarkCircle } from './Icon';

const HelpSection: React.FC<{ title: string; icon: any; children: React.ReactNode }> = ({ title, icon: Icon, children }) => (
    <section className="bg-white dark:bg-gray-900 rounded-3xl p-10 border border-gray-100 dark:border-gray-800 shadow-sm transition-all hover:shadow-xl hover:border-sky-200 dark:hover:border-sky-900/50">
        <div className="flex items-center gap-5 mb-8">
            <div className="p-4 bg-sky-50 dark:bg-sky-900/20 rounded-2xl text-sky-600 dark:text-sky-400 shadow-inner">
                <Icon className="w-8 h-8" />
            </div>
            <h2 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">{title}</h2>
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

const HelpCenter: React.FC = () => {
    return (
        <div className="p-8 h-full max-w-6xl mx-auto animate-fade-in overflow-y-auto custom-scrollbar">
            <header className="mb-16 text-center">
                <div className="inline-block px-4 py-1.5 bg-sky-100 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400 rounded-full text-sm font-bold mb-6">
                    Documentation Center
                </div>
                <h1 className="text-5xl font-black text-gray-900 dark:text-white mb-6 tracking-tighter">奇思妙写 · 使用指南</h1>
                <p className="text-gray-500 dark:text-gray-400 text-xl max-w-3xl mx-auto leading-relaxed">
                    在这里，我们将为您详细解析“奇思妙写”的每一个创作引擎，助您从灵感火花走向宏大篇章。
                </p>
            </header>

            <div className="grid grid-cols-1 gap-12 pb-32">
                <HelpSection title="创意生成" icon={Sparkles}>
                    <p className="text-lg font-medium text-gray-700 dark:text-gray-300">
                        创意生成模块旨在解决“起步难”的问题，通过多维度的逻辑推演，为您的故事奠定坚实基础。
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <SubModule name="创意脑洞">
                            输入核心关键词或一句简单的设定，AI 将为您生成 3-5 个截然不同的故事情节核、起因、主要矛盾及可能的结局走向，助您筛选最具商业潜力的点子。
                        </SubModule>
                        <SubModule name="金手指设定">
                            专为网文创作优化，生成的“金手指”不仅包含独特的能力描述，还涵盖了能力的成长体系、平衡限制以及与主线剧情的深度互动逻辑。
                        </SubModule>
                        <SubModule name="人物深度设定">
                            从外貌特征、性格缺陷、核心驱动力到复杂的人际网。AI 会生成 3 层深度的背景故事，并赋予角色独特的口头禅或行为怪癖。
                        </SubModule>
                        <SubModule name="世界观架构">
                            涵盖力量等级体系（如修仙等级、异能分类）、地理环境影响、社会阶层矛盾及 3 条支撑世界运行的底层逻辑规则。
                        </SubModule>
                        <SubModule name="大纲与细纲">
                            支持从万字卷纲到千字章纲的阶梯式生成。AI 会自动插入剧情高潮点（爽点/虐点）并平衡节奏，确保情节不拖沓。
                        </SubModule>
                        <SubModule name="爆款小说简介">
                            基于流行网文趋势，生成具有极强悬念感和代入感的简介。提供“黄金三章”吸睛套路，提升作品在平台的点击率。
                        </SubModule>
                    </div>
                </HelpSection>

                <HelpSection title="创作中心" icon={BookOpen}>
                    <p className="text-lg font-medium text-gray-700 dark:text-gray-300">
                        这是您的核心创作阵地，集成了深度语义理解的 AI 写作助手。
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <SubModule name="短篇小说模式">
                            优化了单章叙事逻辑。AI 侧重于环境烘托与情感爆发力。右侧面板提供“灵感续写”，可根据上文自动推演 3 种反转结局方案。
                        </SubModule>
                        <SubModule name="长篇小说管理">
                            支持多卷、多章节结构。AI 助手会实时读取您的“素材管理”内容，在写作时自动保持人设的一致性，防止长线创作中的逻辑疏漏。
                        </SubModule>
                        <SubModule name="剧本生成与改编">
                            提供标准影视剧本格式（INT/EXT 场景标注）。支持将小说原文一键改编为剧本，自动提取台词并转化为视听语言描述。
                        </SubModule>
                        <SubModule name="智能侧边栏功能">
                            包含：<strong>剧情推演</strong>（预测后续走向）、<strong>遣词润色</strong>（提升文笔质感）、<strong>遣词扩写</strong>（丰富细节描写）、<strong>逻辑自查</strong>（发现前后矛盾）。
                        </SubModule>
                    </div>
                </HelpSection>

                <HelpSection title="素材管理" icon={Database}>
                    <p className="text-lg font-medium text-gray-700 dark:text-gray-300">
                        您的“创作数据库”，实现全站数据联动，让 AI 真正“读懂”您的设定。
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <SubModule name="动态角色库">
                            数字化角色卡。存储不仅是文字，您可以标注角色“状态”。在创作中心直接调用，AI 将基于角色当前的性格和背景生成台词。
                        </SubModule>
                        <SubModule name="剧情线索库">
                            记录伏笔与重要道具。支持“伏笔追踪”，当您在后续章节中提及相关道具时，AI 会自动关联其初始设定，确保细节不出错。
                        </SubModule>
                        <SubModule name="灵光速记库">
                            碎片化灵感收集。支持通过标签（如 #悬疑 #反转）快速检索。当灵感积累到一定程度时，可一键转化为大纲模块的基础素材。
                        </SubModule>
                    </div>
                </HelpSection>

                <HelpSection title="提示词库" icon={Box}>
                    <p className="text-lg font-medium text-gray-700 dark:text-gray-300">
                        参数化提示词系统，让您可以构建专属的生成模板。
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <SubModule name="参数化模板构建">
                            支持 <code>${"{变量名}"}</code> 语法。创建提示词时定义输入字段，使用时自动生成表单，极大地降低了与 AI 沟通的成本。
                        </SubModule>
                        <SubModule name="效果预览（范例）">
                            每个提示词可附带一个理想的生成效果范例，帮助其他用户（或您自己）在运行前预判生成质量。
                        </SubModule>
                        <SubModule name="社区共享中心">
                            您可以收藏社区高热度的优质模板，或将自己的创作心法分享给其他作者，赚取提示词“热度值”。
                        </SubModule>
                    </div>
                </HelpSection>

                <HelpSection title="工作流" icon={Workflow}>
                    <p className="text-lg font-medium text-gray-700 dark:text-gray-300">
                        多步自动化引擎，将复杂的创作任务拆解为标准化的生产流。
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <SubModule name="标准工作流">
                            如“三幕式剧本生成流”：第一步设定人物，第二步输入矛盾，第三步自动拆解为三个大的叙事阶段，实现工业化产出。
                        </SubModule>
                        <SubModule name="自定义流程构建">
                            高级作者可根据自己的写作习惯，串联多个提示词节点，构建出独一无二的“全自动创作引擎”。
                        </SubModule>
                    </div>
                </HelpSection>

                <section className="bg-sky-600 rounded-3xl p-12 text-white shadow-2xl shadow-sky-500/20 text-center">
                    <h2 className="text-3xl font-black mb-6">准备好开始创作了吗？</h2>
                    <p className="text-sky-100 text-lg mb-8 max-w-2xl mx-auto">
                        每一个伟大的作品都始于一个小小的点击。现在就去“创意生成”开启您的第一章吧。
                    </p>
                    <div className="flex justify-center gap-4">
                        <div className="px-8 py-3 bg-white text-sky-600 rounded-full font-black shadow-lg">进入创作中心</div>
                        <div className="px-8 py-3 bg-sky-500 text-white border border-sky-400 rounded-full font-black">查看更多教程</div>
                    </div>
                </section>
            </div>
        </div>
    );
};

export default HelpCenter;
