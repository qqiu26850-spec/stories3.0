
import React, { useState } from 'react';
import { View } from '../types';
import { Sparkles, BookOpen, Box, Workflow, Database, UserCircle, ChevronRight, Check, Play, Film, DocumentText, ArrowPath, QuestionMarkCircle, ClipboardDocumentCheck } from './Icon';

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
                        <span>{feature}</span>
                    </li>
                ))}
            </ul>
        </div>
    </div>
);

const HelpCenter: React.FC<HelpCenterProps> = ({ onNavigate }) => {
    const [activeTab, setActiveTab] = useState<'guide' | 'tutorials' | 'updates'>('guide');

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
                        
                        <button 
                            onClick={() => setActiveTab('tutorials')}
                            className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'tutorials' ? 'bg-white dark:bg-gray-700 text-sky-600 dark:text-sky-400 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
                        >
                            <span className="flex items-center gap-2"><BookOpen className="w-4 h-4"/> 使用教程</span>
                        </button>

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
                {activeTab === 'guide' && (
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

                        {/* Section: Manuscript Review (New v1.8.0) */}
                        <HelpSection 
                            title="智能审稿比对中心" 
                            target="manuscript-review" 
                            icon={ClipboardDocumentCheck} 
                            onNavigate={onNavigate}
                            color="indigo"
                            steps={[
                                "在左侧栏点击「审稿」，分别录入/上传原稿与仿写稿件（支持 .txt / .docx / .md）",
                                "点击右上角「开始智能审稿」，自动触发错别字、人物同音与查重调色盘全维扫描",
                                "依次排查错别字、人物同音及调色盘标红句，支持自由拖拽审稿面板高度与一键 AI 降重",
                                "修改完成后可「复制终稿」「导出」TXT 或「存素材」；点击垃圾桶图标弹窗确认可一键全清"
                            ]}
                        >
                            <SubModule name="双栏对照与一键复位">
                                左侧原稿（标杆参照）与右侧仿写（待审目标）同屏展示，支持 Word（.docx）等格式直接解析及「填入演示样本」体验；右上角删除按钮支持防误触二次确认弹窗，一键清空所有内容并恢复初始待输入界面，方便连续审稿多本小说。
                            </SubModule>
                            <SubModule name="1. 错别字智能检测">
                                自动扫描仿写稿件中的常见易错成语与规范汉字错别字，标注详细成因说明，支持单条采纳修正或一键修复全部错别字。
                            </SubModule>
                            <SubModule name="2. 人物/称谓同音排查">
                                结合上下文语境与百家姓/称谓规则精准提取角色（自动剥离“给/的”等介词，过滤“给多少、嫌钱少、三年前、不告而别”等普通词，完整识别“宋自深、孟瑶然、宋启、老陈、姜队长”等），严查重名与拼音同音/谐音，支持手动增删名单及一键全局替换。
                            </SubModule>
                            <SubModule name="3. 调色盘查重 & AI 降重">
                                按字数加权评估整体相似度并智能豁免“不救”等日常简短口语，分别说明整体相似与局部实质雷同长句；调色盘分级高亮句子，点击即可对照原句并一键生成 3 组 AI 降重方案；下方审稿面板支持收起态（44px）至紧贴汇总栏之间任意高度自由拖拽与收放记忆。
                            </SubModule>
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
                                target="prompt-library-novel" 
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
                )}

                {activeTab === 'tutorials' && (
                    <div className="flex flex-col gap-4 animate-fade-in">
                        {/* External Feishu Wiki Banner */}
                        <div className="bg-gradient-to-r from-sky-50 to-indigo-50 dark:from-sky-950/40 dark:to-indigo-950/40 rounded-2xl p-5 border border-sky-200 dark:border-sky-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-white dark:bg-gray-900 rounded-xl text-sky-600 dark:text-sky-400 shadow-sm">
                                    <BookOpen className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-black text-gray-900 dark:text-white">
                                        奇思妙写 · 飞书完整版图文视频教程手册
                                    </h3>
                                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                                        涵盖全平台基础操作、长短篇写作流及进阶创作技巧的云端详细文档。
                                    </p>
                                </div>
                            </div>
                            <a
                                href="https://my.feishu.cn/wiki/NQcDwXqTLiRAsRk14TCc5y6fnke?from=from_copylink"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold rounded-xl shadow-sm transition flex items-center gap-1.5 flex-shrink-0"
                            >
                                打开飞书教程文档 <ChevronRight className="w-3.5 h-3.5" />
                            </a>
                        </div>

                        {/* Detailed Tutorial for Manuscript Review */}
                        <section className="bg-white dark:bg-gray-900 rounded-3xl p-6 border border-indigo-200 dark:border-indigo-900/60 shadow-sm space-y-5">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl text-indigo-600 dark:text-indigo-400">
                                        <ClipboardDocumentCheck className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h2 className="text-lg font-black text-gray-900 dark:text-white">
                                                智能审稿比对中心 · 全流程使用教程
                                            </h2>
                                            <span className="px-2 py-0.5 text-[10px] font-bold bg-indigo-600 text-white rounded-full">
                                                v1.8.0 新增
                                            </span>
                                        </div>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                            位于左侧导航栏「创作中心」下方，专为小说仿写校对、避坑洗稿与角色合规排查打造。
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => onNavigate('manuscript-review')}
                                    className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 text-indigo-600 dark:text-indigo-300 text-xs font-bold rounded-lg transition flex items-center gap-1"
                                >
                                    立即体验 <ChevronRight className="w-3.5 h-3.5" />
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="p-4 bg-gray-50 dark:bg-black/20 rounded-2xl border border-gray-100 dark:border-gray-800 space-y-2">
                                    <h4 className="text-xs font-black text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                                        <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px]">1</span>
                                        双栏上传稿件与快速切换下一本
                                    </h4>
                                    <ul className="text-[11px] text-gray-600 dark:text-gray-400 space-y-1.5 leading-relaxed">
                                        <li>• <strong>录入/导入</strong>：左侧栏填写或点击「上传原稿」导入标杆原稿，右侧栏填写或「上传仿写」导入待审稿件（支持 <code className="px-1 bg-gray-200 dark:bg-gray-800 rounded">.txt</code>、<code className="px-1 bg-gray-200 dark:bg-gray-800 rounded">.docx</code>、<code className="px-1 bg-gray-200 dark:bg-gray-800 rounded">.md</code>）。</li>
                                        <li>• <strong>演示体验</strong>：首次使用可点击右上角「填入演示样本」，快速查看三大维度审稿效果。</li>
                                        <li>• <strong>全部清除（防误触）</strong>：审完一本小说需换下一本时，点击「填入演示样本」右侧的垃圾桶图标，在弹出窗口中点击「确认全部清除」即可清空文本、报告与自定义名单，恢复初始待输入状态。</li>
                                    </ul>
                                </div>

                                <div className="p-4 bg-gray-50 dark:bg-black/20 rounded-2xl border border-gray-100 dark:border-gray-800 space-y-2">
                                    <h4 className="text-xs font-black text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                                        <span className="w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center text-[10px]">2</span>
                                        第一维：错别字自动标注与修复
                                    </h4>
                                    <ul className="text-[11px] text-gray-600 dark:text-gray-400 space-y-1.5 leading-relaxed">
                                        <li>• <strong>智能扫描</strong>：点击「开始智能审稿」后，面板首个标签页自动展示仿写稿中的易错词与规范用字问题（如“按步就班→按部就班”）。</li>
                                        <li>• <strong>单处/全局修复</strong>：每条标注均附带用字原理解析，支持单条「一键替换修复」，也可点击标签栏右上角「一键修复所有错别字」批量改写。</li>
                                    </ul>
                                </div>

                                <div className="p-4 bg-gray-50 dark:bg-black/20 rounded-2xl border border-gray-100 dark:border-gray-800 space-y-2">
                                    <h4 className="text-xs font-black text-purple-600 dark:text-purple-400 flex items-center gap-1.5">
                                        <span className="w-5 h-5 rounded-full bg-purple-600 text-white flex items-center justify-center text-[10px]">3</span>
                                        第二维：人物/称谓同音严谨排查
                                    </h4>
                                    <ul className="text-[11px] text-gray-600 dark:text-gray-400 space-y-1.5 leading-relaxed">
                                        <li>• <strong>精准识别语境</strong>：自动剥离“给/的”等前导介词（如将“给姜队长”准确提取为“姜队长”），严防“给多少、嫌钱少、三年前、不告而别”等普通词汇误判，同时完整识别“宋自深、孟瑶然、宋启、老陈”等姓名与称谓。</li>
                                        <li>• <strong>冲突与微调</strong>：支持「补充要重点排查的人物」加入扫描，或点击人物标签上的 <code className="px-1 bg-gray-200 dark:bg-gray-800 rounded">×</code> 排除非角色项。检测到重名或谐音冲突时，可用推荐名或自定义名称一键全局替换。</li>
                                    </ul>
                                </div>

                                <div className="p-4 bg-gray-50 dark:bg-black/20 rounded-2xl border border-gray-100 dark:border-gray-800 space-y-2">
                                    <h4 className="text-xs font-black text-sky-600 dark:text-sky-400 flex items-center gap-1.5">
                                        <span className="w-5 h-5 rounded-full bg-sky-600 text-white flex items-center justify-center text-[10px]">4</span>
                                        第三维：调色盘查重、AI 降重与面板拖拽
                                    </h4>
                                    <ul className="text-[11px] text-gray-600 dark:text-gray-400 space-y-1.5 leading-relaxed">
                                        <li>• <strong>科学预警与短句豁免</strong>：汇总栏区分展示「整体相似度」与「局部实质雷同长句」，对“不救”等简短口语智能豁免，避免日常短句触发严重超标误报。</li>
                                        <li>• <strong>调色盘联动降重</strong>：右侧仿写稿以红/橙/黄/绿四色标记句级重合，点击任意高亮句即可在下方「查重调色盘 &amp; AI 降重」中对照原句并一键生成 3 组全新句式改写（内置超时保底引擎），点击即可采纳替换。</li>
                                        <li>• <strong>窗口自由拖拽</strong>：按住面板上方分隔条上下拖动，可在最小收起态（44px）至紧贴汇总栏底缘（完全覆盖上方稿件）之间的任意高度停留；点击「收起 ▼ / 展开 ▲」自动记忆并恢复上次拖动高度。</li>
                                    </ul>
                                </div>
                            </div>
                        </section>

                        {/* Quick Tutorial Summary for Other Core Modules */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-100 dark:border-gray-800 space-y-2">
                                <h4 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                    <Sparkles className="w-4 h-4 text-sky-500" /> 创意与提示词教程
                                </h4>
                                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                                    在「提示词库」选取结构化卡片后可直接填入参数并关联素材库角色，生成脑洞、金手指与故事大纲，一键沉淀至素材库。
                                </p>
                            </div>
                            <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-100 dark:border-gray-800 space-y-2">
                                <h4 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                    <Film className="w-4 h-4 text-emerald-500" /> 长短篇与剧本教程
                                </h4>
                                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                                    在「创作中心」选定长篇、短篇或分集剧本模块，支持右键呼出 AI 追问/润色/扩写菜单，单集优化可生成多套差异化版本供选择。
                                </p>
                            </div>
                            <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-100 dark:border-gray-800 space-y-2">
                                <h4 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                    <Workflow className="w-4 h-4 text-purple-500" /> 自动化工作流教程
                                </h4>
                                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                                    通过「工作流」将大纲拆分、章节扩写、人设核对等提示词串联成流水线，支持运行结果选中定向追问，成倍提升日更效率。
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'updates' && (
                    <div className="bg-gray-50 dark:bg-gray-900/50 rounded-3xl p-6 border border-gray-200 dark:border-gray-800 animate-fade-in">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2.5 bg-gray-200 dark:bg-gray-800 rounded-xl text-gray-600 dark:text-gray-300">
                                <ArrowPath className="w-6 h-6" />
                            </div>
                            <h2 className="text-xl font-black text-gray-900 dark:text-white tracking-tight">更新日志</h2>
                        </div>
                        
                        <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 border border-gray-100 dark:border-gray-800 shadow-sm">
                            <VersionItem 
                                version="v1.8.0" 
                                date="2026.11.12"
                                isLatest={true}
                                features={[
                                    "新增「智能审稿比对中心」模块：位于左侧创作中心下方，支持原稿（左栏）与仿写稿件（右栏）双栏对照，支持 .txt / .docx（Word）/ .md 文档导入及演示样本一键体验。",
                                    "错别字自动标注与修复：内置常见易错词规则库，自动高亮错别字与解析说明，支持单处采纳及一键修复全部错别字。",
                                    "人物/称谓同音严谨排查：结合上下文语境与百家姓/称谓规则先确认人物再查重名与同音谐音；自动剥离“给/的”等前导词并排除“给多少、嫌钱少、三年前、不告而别”等普通词汇误判，完整提取真实人名与“老[姓]”称呼；支持手动增删名单及一键全局替换。",
                                    "调色盘查重分级 & AI 智能降重：按字数加权计算整体相似度并智能豁免“不救”等日常短句（避免低整体相似却触发严重超标误报），分别展示整体相似度与局部实质雷同长句；点击任意调色盘高亮句即可对照原句并生成 3 组 AI 降重方案（含超时本地保底，响应不卡顿）。",
                                    "审稿面板自由拖拽 & 一键全部清除：移除固定高度档位，下方审稿面板可在收起状态（44px）至紧贴汇总栏底缘之间任意高度自由拖拽与收放记忆；新增带二次确认弹窗的“全部清除”按钮，点击确认即可恢复最初待输入界面，便于连续审稿多本小说。"
                                ]}
                            />
                            <VersionItem 
                                version="v1.7.0" 
                                date="2026.02.26"
                                features={[
                                    "剧本生成重构：全屏沉浸式布局，移除冗余边距，支持直接编辑生成内容与实时保存。",
                                    "智能右键菜单：在剧本正文中右键即可唤起 AI 菜单，支持「智能追问」、「润色」与「扩写」。",
                                    "Word 导出升级：剧本分集支持一键导出为 Word (.doc) 格式，保留阅读版式预览。",
                                    "界面优化：右侧 AI 功能栏改为默认收起，提供更开阔的写作视野。",
                                    "将“存入”按钮优化为更直观的“追问”功能，方便对生成结果进行即时调整。"
                                ]}
                            />
                            <VersionItem 
                                version="v1.6.0" 
                                date="2026.01.10"
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
