
import React from 'react';
import { Sparkles, BookOpen, Box, Workflow, Database, UserCircle, QuestionMarkCircle } from './Icon';

const HelpSection: React.FC<{ title: string; icon: any; children: React.ReactNode }> = ({ title, icon: Icon, children }) => (
    <section className="bg-white dark:bg-gray-900 rounded-2xl p-8 border border-gray-200 dark:border-gray-800 shadow-sm transition-all hover:shadow-md">
        <div className="flex items-center gap-4 mb-6">
            <div className="p-3 bg-sky-100 dark:bg-sky-900/30 rounded-xl text-sky-600 dark:text-sky-400">
                <Icon className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{title}</h2>
        </div>
        <div className="space-y-4 text-gray-600 dark:text-gray-400 leading-relaxed">
            {children}
        </div>
    </section>
);

const HelpCenter: React.FC = () => {
    return (
        <div className="p-8 h-full max-w-5xl mx-auto animate-fade-in overflow-y-auto">
            <header className="mb-12 text-center">
                <h1 className="text-4xl font-black text-gray-900 dark:text-white mb-4">使用帮助中心</h1>
                <p className="text-gray-500 dark:text-gray-400 text-lg">快速掌握“奇思妙写”的各项功能，释放您的创作灵感。</p>
            </header>

            <div className="grid grid-cols-1 gap-8 pb-20">
                <HelpSection title="创意生成" icon={Sparkles}>
                    <p>“创意生成”是您创作的起点。这里集成了多个针对性的小说创作模块：</p>
                    <ul className="list-disc pl-5 space-y-2">
                        <li><strong>创意脑洞：</strong> 输入简单的关键词，AI 会为您生成完整的故事雏形和梗概。</li>
                        <li><strong>金手指：</strong> 专为网文设计，生成独特的人物附加能力或系统设定。</li>
                        <li><strong>世界观：</strong> 构建复杂的社会背景、文明规则或超凡力量体系。</li>
                        <li><strong>参数配置：</strong> 展开参数面板可调整“温度”（随机度）和“核采样”，改变 AI 创作的风格。</li>
                    </ul>
                </HelpSection>

                <HelpSection title="创作中心" icon={BookOpen}>
                    <p>创作中心分为短篇、长篇小说及剧本生成。这是您打磨正文的地方：</p>
                    <ul className="list-disc pl-5 space-y-2">
                        <li><strong>项目管理：</strong> 您可以为每个项目上传封面、设置标题。项目数据实时同步至云端。</li>
                        <li><strong>智能侧边栏：</strong> 写作时，右侧 AI 面板提供“剧情推演”、“智能续写”、“遣词润色”等功能。</li>
                        <li><strong>自动保存：</strong> 编辑器具备毫秒级自动保存功能，确保灵感永不丢失。</li>
                        <li><strong>剧本模式：</strong> 专为影视剧本优化的格式，支持快速生成分集大纲和场景对白。</li>
                    </ul>
                </HelpSection>

                <HelpSection title="提示词库" icon={Box}>
                    <p>提示词库是您与 AI 沟通的高级模板库：</p>
                    <ul className="list-disc pl-5 space-y-2">
                        <li><strong>参数化模板：</strong> 使用 <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded text-sky-600">${"{变量名}"}</code> 语法，可以创建带输入框的提示词，方便重复使用。</li>
                        <li><strong>社区共享：</strong> 您可以查看官方预设和社区用户的公开分享，一键收藏或使用。</li>
                        <li><strong>效果预览：</strong> 好的提示词通常带有范例，帮助您预判生成效果。</li>
                    </ul>
                </HelpSection>

                <HelpSection title="素材管理" icon={Database}>
                    <p>素材库是您的“创作数据库”，支持在任何生成场景中一键引用：</p>
                    <ul className="list-disc pl-5 space-y-2">
                        <li><strong>角色库：</strong> 存储人物的外貌、性格、金手指和复杂的社交关系。</li>
                        <li><strong>剧情库：</strong> 记录关键的情节点、伏笔和场景描写，方便后续续写调用。</li>
                        <li><strong>关联生成：</strong> 在“创意生成”或“写作界面”中点击“关联素材”，AI 将根据库中素材保持人设一致性和逻辑严密性。</li>
                    </ul>
                </HelpSection>

                <HelpSection title="工作流" icon={Workflow}>
                    <p>工作流适合需要多步骤完成的复杂任务：</p>
                    <ul className="list-disc pl-5 space-y-2">
                        <li><strong>标准流程：</strong> 如“三幕式剧本改编”，AI 会引导您分步输入素材，按特定逻辑链条产出结果。</li>
                        <li><strong>自定义工作流：</strong> 高级用户可以定义自己的输入字段和提示词模板，构建专属的生产力引擎。</li>
                    </ul>
                </HelpSection>

                <HelpSection title="常见问题" icon={QuestionMarkCircle}>
                    <div className="space-y-6">
                        <div>
                            <h4 className="font-bold text-gray-900 dark:text-white mb-1">Q: 我的数据安全吗？</h4>
                            <p className="text-sm">A: 所有数据均存储在 Supabase 高强度加密数据库中，只有您本人登录后才能访问。</p>
                        </div>
                        <div>
                            <h4 className="font-bold text-gray-900 dark:text-white mb-1">Q: 为什么 AI 生成中断了？</h4>
                            <p className="text-sm">A: 可能是由于网络波动或生成的文本内容过长。您可以尝试点击“停止”并重新生成，或缩短输入要求。</p>
                        </div>
                        <div>
                            <h4 className="font-bold text-gray-900 dark:text-white mb-1">Q: 如何注销账号？</h4>
                            <p className="text-sm">A: 在“个人中心”右上角点击“注销账号”。请注意，注销将永久删除您的项目和素材，不可恢复。</p>
                        </div>
                    </div>
                </HelpSection>
            </div>
        </div>
    );
};

export default HelpCenter;
