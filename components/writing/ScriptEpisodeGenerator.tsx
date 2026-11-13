import React, { useState, useEffect, useRef } from 'react';
import { generateTextStream } from '../../services/geminiService';
import { createProject, saveChapterToDB, updateProject, deleteProject, fetchProjects, matchDocumentsV3, InspirationNovelFragment, searchInspirationFragments, fetchAvailableTags, fetchPrompts } from '../../services/supabaseService';
import { Prompt } from '../../types';
import { PROMPTS } from '../../constants';
import PromptSelectionModal from '../PromptSelectionModal';
import { 
    Sparkles, Film, Database, Copy, Stop, AdjustmentsHorizontal, Check, ArrowPath, 
    Play, Pencil, ClipboardDocumentCheck, DocumentPlus, Trash, Plus, 
    InformationCircle, X, ChevronDown, ChevronLeft, FloppyDisk, DocumentArrowDown
} from '../Icon';
import CustomSelect from '../CustomSelect';

interface ScriptEpisodeGeneratorProps {
    onBack: () => void;
    onSaveSuccess?: () => void;
}

interface EpisodeVersion {
    timestamp: string;
    script: string;
    label: string;
}

interface EpisodeOutline {
    episodeNumber: number;
    title: string;
    outline: string;
    script?: string;
    isGenerating?: boolean;
    isDone?: boolean;
    history?: EpisodeVersion[];
}

const ERA_OPTIONS = ['乡村', '职场', '民国', '校园', '历史古代', '古装'];

const THEME_PLOT_OPTIONS = [
    '打脸虐渣', '逆袭', '马甲', '女性成长', '都市日常', '重生', '穿越', '系统', '亲情', '家庭伦理', 
    '奇幻脑洞', '奇幻爱情', '闪婚', '暗恋成真', '古风言情', '穿书', '战神归来', '破镜重圆', '追妻', 
    '现代言情', '豪门恩怨', '异能', '虐恋', '传承觉醒', '玄幻仙侠', '古风权谋', '年代爱情', 
    '赘婿逆袭', '娱乐圈', '剧情', '无敌神医', '悬疑推理', '喜剧', '现言甜宠'
];

const CHARACTER_TAG_OPTIONS = [
    '大女主', '萌宝', '小人物', '神豪', '强者回归', '真假千金', '欢喜冤家', '强强联合', '天下无敌', 
    '青梅竹马', '王妃', '女帝', '龙王', '皇后', '替身', '大叔', '团宠'
];

const PROMPT_LIBRARY = [
    {
        id: 'system_default',
        name: '系统默认爆款模板',
        desc: '黄金快节奏，强冲突卡点，极速爽快',
        prompt: '你是一位爆款微短剧金牌编剧。请为这套短剧创作极具网感、强情绪冲突、高开低走与强弱反转的分集大纲。要求：首集强剧情抓人开局，有明显的剧情卡点和节奏爽点，每集末尾设置钩子悬念。'
    },
    {
        id: 'revenge_slap',
        name: '逆袭复仇爽剧模板',
        desc: '极致打脸、隐藏身份、扮猪吃虎清算反派',
        prompt: '你是一位爆款微短剧金牌编剧。请以极致的反差感、尊严践踏后的逆袭为核心，编写分集大纲。第一集必须是受虐高潮与惊天身份揭秘的强情绪开局，情节点必须写得非常具体、写清楚每个人的自私嘴脸和主角的隐藏力量，节奏点掐死在主角清算前夜，设置剧情卡点。'
    },
    {
        id: 'sweet_love',
        name: '闪婚甜宠爆款模板',
        desc: '豪门误会、先婚后爱、满分狗粮与甜虐交织',
        prompt: '你是一位金牌甜宠剧编剧。请以“命中注定的缘分”和“隐藏豪门身份”为核心，编写甜中带虐的分集大纲。开局必须是闪婚名场面或误会冲突强力开场，设计甜蜜卡点与吃醋误会的情节，每集末尾留下关于真实身份或危机揭露的强悬念。'
    },
    {
        id: 'high_tension_thriller',
        name: '悬疑反转脑洞模板',
        desc: '层层剥茧、高智商博弈、反常识反转',
        prompt: '你是一位爆款悬疑脑洞短剧编剧。请编写高反转率、烧脑多重谜底的分集大纲。开局必须以荒诞或极度反常的突发危机切入，强行拉满情绪张力。每个情节点必须环环相扣，写清楚具体线索和卡点悬念，最后一秒实现神级大反转。'
    }
];

const toChineseNum = (num: number): string => {
    const cnNums = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
    if (num <= 10) {
        if (num === 10) return '十';
        return cnNums[num];
    }
    if (num < 20) {
        return '十' + cnNums[num % 10];
    }
    if (num < 100) {
        const ten = Math.floor(num / 10);
        const single = num % 10;
        return cnNums[ten] + '十' + (single === 0 ? '' : cnNums[single]);
    }
    return String(num);
};

const MODEL_OPTIONS = [
    { value: "gemini-4-hydrogen", label: "Gemini 4 Hydrogen" },
    { value: "gemini-3.1-flash-lite", label: "Gemini 3.1 Flash Lite" },
    { value: "deepseek-chat", label: "奇思版 (DeepSeek)" },
    { value: "doubao-flash", label: "速写版 (豆包)" }
];

export const ScriptEpisodeGenerator: React.FC<ScriptEpisodeGeneratorProps> = ({ onBack, onSaveSuccess }) => {
    // Stage navigation: 'project_dashboard' | 'mode_select' | 'outline_form_existing' | 'outline_form_new' | 'outline_generating' | 'outline_results' | 'script_generation' | 'completed' | 'skill_master_workspace'
    const [stage, setStage] = useState<'project_dashboard' | 'mode_select' | 'outline_form_existing' | 'outline_form_new' | 'outline_generating' | 'outline_results' | 'script_generation' | 'completed' | 'skill_master_workspace'>('project_dashboard');
    const [outlineMode, setOutlineMode] = useState<'existing' | 'new' | 'skill_master' | null>(null);

    // --- 0xsline/short-drama Professional Screenplay Skill States ---
    const [skillActiveStep, setSkillActiveStep] = useState<number>(1);
    const [skillTopic, setSkillTopic] = useState<string>('真假千金重回豪门');
    const [skillAudience, setSkillAudience] = useState<string>('年轻都市女性');
    const [skillTone, setSkillTone] = useState<string>('极致反差、打脸爽剧');
    const [skillSellingPoints, setSkillSellingPoints] = useState<string>('真千金隐藏顶奢黑卡、神医马甲层层揭开');
    const [skillPlanEpisodes, setSkillPlanEpisodes] = useState<number>(80);
    const [skillMainChar, setSkillMainChar] = useState<string>('乔以安：真千金，神医圣手，隐世至尊');
    const [skillAntagonist, setSkillAntagonist] = useState<string>('周婉清：假千金，白莲花，手段阴险');
    const [skillEpisodeNum, setSkillEpisodeNum] = useState<number>(1);
    const [skillOverseasMode, setSkillOverseasMode] = useState<boolean>(false);
    const [skillReviewNum, setSkillReviewNum] = useState<number>(1);
    const [skillOverseasRegion, setSkillOverseasRegion] = useState<string>('北美市场 (Billionaire/Werewolf)');
    
    // Outputs for each step
    const [skillStartOutput, setSkillStartOutput] = useState<string>('');
    const [skillPlanOutput, setSkillPlanOutput] = useState<string>('');
    const [skillCharOutput, setSkillCharOutput] = useState<string>('');
    const [skillOutlineOutput, setSkillOutlineOutput] = useState<string>('');
    const [skillEpisodesStore, setSkillEpisodesStore] = useState<Record<number, string>>({});
    const [skillReviewsStore, setSkillReviewsStore] = useState<Record<number, string>>({});
    const [skillComplianceStore, setSkillComplianceStore] = useState<Record<number, string>>({});
    const [skillOverseasStore, setSkillOverseasStore] = useState<Record<number, string>>({});
    const [skillExportOutput, setSkillExportOutput] = useState<string>('');
    const [skillIsGenerating, setSkillIsGenerating] = useState<boolean>(false);
    
    // Project Dashboard states
    const [episodeProjects, setEpisodeProjects] = useState<any[]>([]);
    const [loadingProjects, setLoadingProjects] = useState(false);
    
    // Core parameters
    const [episodesCount, setEpisodesCount] = useState<number>(10);
    const [model, setModel] = useState('gemini-4-hydrogen');
    const [temperature, setTemperature] = useState(0.85);
    const [maxTokens, setMaxTokens] = useState(8192);
    
    // Existing Outline parameters
    const [existingOutline, setExistingOutline] = useState('');
    
    // New Outline parameters
    const [theme, setTheme] = useState('打脸虐渣');
    const [selectedEra, setSelectedEra] = useState<string>('古装');
    const [selectedThemePlots, setSelectedThemePlots] = useState<string[]>(['逆袭', '打脸虐渣']);
    const [selectedCharacters, setSelectedCharacters] = useState<string[]>(['强者回归']);
    const [coreTrope, setCoreTrope] = useState<string>(''); // 核心梗 (非必填)
    const [selectedPromptId, setSelectedPromptId] = useState<string>('system_default');
    const [elements, setElements] = useState<string[]>(['扮猪吃虎', '强势打脸']);
    const [styleTags, setStyleTags] = useState<string[]>(['极速爽快', '连续反转']);
    const [customElement, setCustomElement] = useState('');
    const [customStyle, setCustomStyle] = useState('');
    const [coreIdea, setCoreIdea] = useState('');
    
    // Generated Episode Outlines
    const [outlineRawText, setOutlineRawText] = useState('');
    const [parsedEpisodes, setParsedEpisodes] = useState<EpisodeOutline[]>([]);
    
    // Script Generation Mode
    const [scriptGenMode, setScriptGenMode] = useState<'all' | 'single'>('all');
    const [activeGeneratingIndex, setActiveGeneratingIndex] = useState<number | null>(null);
    const [globalIsGenerating, setGlobalIsGenerating] = useState(false);
    
    // Project Info
    const [projectTitle, setProjectTitle] = useState('');
    const [saving, setSaving] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [error, setError] = useState('');

    // Prompt Library Card States
    const [selectedPromptCard, setSelectedPromptCard] = useState<Prompt | null>(null);
    const [promptFormValues, setPromptFormValues] = useState<Record<string, string>>({});
    const [isPromptModalOpen, setIsPromptModalOpen] = useState(false);
    const [promptCardsList, setPromptCardsList] = useState<Prompt[]>([]);
    const [isLoadingPrompts, setIsLoadingPrompts] = useState(false);

    // Project Delete Confirmation State
    const [projectToDelete, setProjectToDelete] = useState<any | null>(null);

    // Script creation states
    const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
    const [showCreateProjectModal, setShowCreateProjectModal] = useState(false);
    const [pendingMode, setPendingMode] = useState<'existing' | 'new' | 'skill_master' | null>(null);
    const [newProjectTitle, setNewProjectTitle] = useState('');
    const [newProjectDesc, setNewProjectDesc] = useState('');
    const [creatingProjectInDB, setCreatingProjectInDB] = useState(false);

    // Single Episode Outline edit states
    const [editEpisodeIndex, setEditEpisodeIndex] = useState<number | null>(null);
    const [editEpisodeTitle, setEditEpisodeTitle] = useState('');
    const [editOutlineText, setEditOutlineText] = useState('');
    const [showEditModal, setShowEditModal] = useState(false);

    // AI Collaborative Outline Chat states
    const [aiChatMessages, setAiChatMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
    const [aiChatInput, setAiChatInput] = useState('');
    const [aiIsGenerating, setAiIsGenerating] = useState(false);
    const [chatScope, setChatScope] = useState<'global' | 'single'>('global');
    const [chatTargetEpisode, setChatTargetEpisode] = useState<number>(1);
    const [singleEpisodeEdits, setSingleEpisodeEdits] = useState<Record<number, string>>({});
    
    // Auto-sync and layout states
    const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
    const [expandedOutlines, setExpandedOutlines] = useState<Record<number, boolean>>({});
    
    // History versioning and emotional amplification states
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [historyEpisodeIndex, setHistoryEpisodeIndex] = useState<number | null>(null);
    const [selectedHistoryVersionIndex, setSelectedHistoryVersionIndex] = useState<number | null>(null);
    const [activeEmotionPickerIndex, setActiveEmotionPickerIndex] = useState<number | null>(null);

    // Tag-based Inspiration Retrieval Modal states
    const [showInspirationModal, setShowInspirationModal] = useState(false);
    const [inspirationEpisodeIndex, setInspirationEpisodeIndex] = useState<number | null>(null);
    const [searchKeyword, setSearchKeyword] = useState('');
    const [availableSceneTags, setAvailableSceneTags] = useState<string[]>([]);
    const [availableEmotionTags, setAvailableEmotionTags] = useState<string[]>([]);
    const [availableEventTags, setAvailableEventTags] = useState<string[]>([]);
    const [availableAbilityTags, setAvailableAbilityTags] = useState<string[]>([]);
    const [availableConflictTags, setAvailableConflictTags] = useState<string[]>([]);
    const [availableThemeTags, setAvailableThemeTags] = useState<string[]>([]);
    const [availableElementTags, setAvailableElementTags] = useState<string[]>([]);
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [expandedCategory, setExpandedCategory] = useState<string | null>('scene');
    const [searchResults, setSearchResults] = useState<InspirationNovelFragment[]>([]);
    const [selectedFragments, setSelectedFragments] = useState<InspirationNovelFragment[]>([]);
    const [isSearchingInspirations, setIsSearchingInspirations] = useState(false);
    const [amplifyType, setAmplifyType] = useState<'emotion' | 'scene' | 'event'>('emotion');
    const [amplifyValue, setAmplifyValue] = useState('极致虐心');
    const [customAmplifyReqs, setCustomAmplifyReqs] = useState('');

    // Sidebar emotional amplification states
    const [sidebarEpisodeIndex, setSidebarEpisodeIndex] = useState<number | null>(null);
    const [sidebarSceneTag, setSidebarSceneTag] = useState<string>('日常生活');
    const [sidebarEmotionTag, setSidebarEmotionTag] = useState<string>('极致虐心');
    const [sidebarSearchQuery, setSidebarSearchQuery] = useState<string>('');
    const [retrievedInspirations, setRetrievedInspirations] = useState<InspirationNovelFragment[]>([]);
    const [isRetrievingInspirations, setIsRetrievingInspirations] = useState<boolean>(false);
    
    const abortControllerRef = useRef<AbortController | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const aiChatScrollRef = useRef<HTMLDivElement>(null);

    const loadEpisodeProjects = async () => {
        setLoadingProjects(true);
        setError('');
        try {
            const data = await fetchProjects();
            const filtered = (data || []).filter((p: any) => p.type === 'script_episode');
            setEpisodeProjects(filtered);
        } catch (err: any) {
            console.error("Failed to load projects:", err);
            setError(err.message || "加载项目失败");
        } finally {
            setLoadingProjects(false);
        }
    };

    useEffect(() => {
        const loadPromptCards = async () => {
            setIsLoadingPrompts(true);
            try {
                const dbPrompts = await fetchPrompts({ limit: 50 });
                if (dbPrompts && dbPrompts.length > 0) {
                    const mapped: Prompt[] = dbPrompts.map((p: any) => {
                        let parsedContent: any = {};
                        try {
                            parsedContent = JSON.parse(p.content);
                        } catch (e) {
                            parsedContent = { template: p.content };
                        }
                        return {
                            id: p.id,
                            title: p.title,
                            description: parsedContent.description || p.description || '提示词库卡片',
                            example: parsedContent.example || '',
                            content: parsedContent.template || p.content,
                            category: (p.main_category as any) || 'script',
                            subCategories: parsedContent.subCategories || (p.sub_category ? [p.sub_category] : []),
                            fields: parsedContent.fields || [],
                            template: parsedContent.template || p.content,
                            heat: p.usage_count || 0,
                            creator: 'system'
                        };
                    });
                    const combined = [...mapped];
                    PROMPTS.forEach(cp => {
                        if (!combined.some(p => p.id === cp.id || p.title === cp.title)) {
                            combined.push(cp);
                        }
                    });
                    setPromptCardsList(combined);
                    if (combined.length > 0) {
                        const scriptCard = combined.find(c => c.category === 'script') || combined[0];
                        setSelectedPromptCard(scriptCard);
                    }
                } else {
                    setPromptCardsList(PROMPTS);
                    if (PROMPTS.length > 0) {
                        setSelectedPromptCard(PROMPTS[0]);
                    }
                }
            } catch (e) {
                console.error("Failed to load prompt cards:", e);
                setPromptCardsList(PROMPTS);
                if (PROMPTS.length > 0) {
                    setSelectedPromptCard(PROMPTS[0]);
                }
            } finally {
                setIsLoadingPrompts(false);
            }
        };
        loadPromptCards();
    }, []);

    const exportAllScriptsToWord = () => {
        let htmlContent = `
        <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
        <head>
            <title>全集剧本 - ${projectTitle || '分集剧本'}</title>
            <style>
                body { font-family: SimSun, Arial, sans-serif; line-height: 1.5; padding: 20px; }
                h1 { text-align: center; font-size: 24pt; margin-bottom: 20px; }
                h2 { font-size: 18pt; margin-top: 30px; margin-bottom: 15px; border-bottom: 1px solid #ccc; padding-bottom: 5px; }
                p { font-size: 11pt; margin-bottom: 8px; }
                .scene-header { font-weight: bold; background-color: #f2f2f2; padding: 5px; margin-top: 15px; margin-bottom: 10px; border-left: 4px solid #800080; }
                .action { color: #333333; font-style: italic; margin-bottom: 8px; }
                .dialogue { margin-left: 20px; margin-bottom: 6px; }
                .dialogue-char { font-weight: bold; }
            </style>
        </head>
        <body>
            <h1>${projectTitle || '全集剧本'}</h1>
            <p style="text-align: center; font-size: 12pt; color: #666;">（共 ${parsedEpisodes.length} 集）</p>
            <hr/>
        `;

        parsedEpisodes.forEach(ep => {
            htmlContent += `<h2>第 ${ep.episodeNumber} 集：${ep.title || '未命名'}</h2>`;
            if (ep.outline) {
                htmlContent += `<p style="font-size: 10pt; color: #777; margin-bottom: 15px;"><strong>分集大纲：</strong>${ep.outline}</p>`;
            }
            
            if (ep.script) {
                const lines = ep.script.split('\n');
                lines.forEach(line => {
                    const trimmed = line.trim();
                    if (trimmed.startsWith('△')) {
                        htmlContent += `<p class="action">${trimmed}</p>`;
                    } else if (trimmed.includes('：') || trimmed.includes(':')) {
                        const splitIdx = trimmed.indexOf('：') !== -1 ? trimmed.indexOf('：') : trimmed.indexOf(':');
                        const char = trimmed.substring(0, splitIdx);
                        const speech = trimmed.substring(splitIdx + 1);
                        htmlContent += `<p class="dialogue"><span class="dialogue-char">${char}：</span>${speech}</p>`;
                    } else if (trimmed) {
                        htmlContent += `<p>${trimmed}</p>`;
                    }
                });
            }
            htmlContent += `<br/><hr/><br/>`;
        });

        htmlContent += `
            </body>
            </html>
        `;

        const blob = new Blob(['\ufeff' + htmlContent], { type: 'application/msword' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${projectTitle || '分集剧本'}_全集剧本.doc`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleEmotionAmplify = async (
        index: number, 
        emotion: string, 
        inspirations: InspirationNovelFragment[] = [], 
        sceneTag: string = '', 
        reqs: string = '',
        ampType: 'emotion' | 'scene' | 'event' = 'emotion'
    ) => {
        const ep = parsedEpisodes[index];
        if (!ep.script) {
            alert('请先生成基础剧本，才能进行重构/重写！');
            return;
        }

        setParsedEpisodes(prev => prev.map((item, id) => {
            if (id === index) {
                const updatedHistory = [...(item.history || [])];
                const lastHist = updatedHistory[updatedHistory.length - 1];
                if (!lastHist || lastHist.script !== item.script) {
                    const timeStr = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                    updatedHistory.push({
                        timestamp: timeStr,
                        script: item.script!,
                        label: `重改前版本 (${timeStr})`
                    });
                }
                return { ...item, isGenerating: true, history: updatedHistory };
            }
            return item;
        }));

        setActiveEmotionPickerIndex(null);

        let inspirationSection = '';
        if (inspirations && inspirations.length > 0) {
            inspirationSection = `\n【参考灵感片段 (最相关的真实小说段落，用于提供叙事手法与情绪参考，用户选择的多段真实片段)】:\n` +
                inspirations.map((item, i) => `
片段 ${i + 1}:
- 原文内容: ${item.content}
- 事件标签: ${Array.isArray(item.event_types) ? item.event_types.join(', ') : item.event_types}
- 情绪标签: ${Array.isArray(item.emotion_types) ? item.emotion_types.join(', ') : item.emotion_types}
`).join('\n') + `
\n【灵感与写作手法参考指令】: 
请在本次剧本改写中，深度参考 and 模仿上述灵感片段中的行文节奏、画面渲染、情感爆破点以及细节事件描写手法，将其精华有机融入到当前的剧本中。`;
        }

        let taskTitle = '【剧本情绪极限制放大/重写任务】';
        let mainGoalHeader = `【核心放大情绪】：【${emotion}】`;
        let coreInstruction = `请在保持原剧本核心情节点、人物关系和基本场景走向不变的前提下，对上述剧本进行深度重写，将【${emotion}】的情绪张力与戏剧冲突放大到极致！`;
        let specificCustomGuidelines = '';

        if (ampType === 'scene') {
            taskTitle = '【剧本场景环境重构/改写任务】';
            mainGoalHeader = `【目标新场景】：【${sceneTag}】`;
            coreInstruction = `请将原剧本中的场景环境全面更换或升级为：【${sceneTag}】。
请重点渲染新环境下的视听细节、环境描写（如雨雪风霜、繁华宴会、深渊悬崖、废弃仓库等），让环境完美契合角色当前的冲突和心理变化，并相应地改写角色的动作反应。`;
        } else if (ampType === 'event') {
            taskTitle = '【剧本核心事件/情节重构任务】';
            mainGoalHeader = `【目标新事件】：【${reqs}】`;
            coreInstruction = `请将原剧本中的核心事件或核心冲突进行重大更换/升级，将其调整为：【${reqs}】。
请在人物基本关系和前情铺垫合理的前提下，引入该核心新事件，重构矛盾爆发的过程，让整场戏的戏剧张力、悬念和冲突性实现颠覆性增强！`;
        }

        if (reqs && ampType !== 'event') {
            specificCustomGuidelines = `\n【用户补充的个性化要求】：${reqs}\n`;
        }

        const prompt = `${taskTitle}
【目标集数】：第${ep.episodeNumber}集 / 共${parsedEpisodes.length}集
【本集标题】：${ep.title}
${mainGoalHeader}
${sceneTag && ampType !== 'scene' ? `【关联场景设定】：${sceneTag}\n` : ''}${specificCustomGuidelines}

【原剧本内容】：
${ep.script}
${inspirationSection}

---

【改写核心指令（极其重要）】：
${coreInstruction}

同时，如果适用了特定情绪，请参考以下特化创作：
- 如果是【极致虐心】：极度强化角色的痛苦、无奈与牺牲，对白要字字滴血，充满情感撕裂感。
- 如果是【逆袭爽快】：将反派嘴脸写得更嚣张、主角的反击更干净利落、气势磅礴，把“打脸逆袭”的情绪爆发点和优越感拉到最满！
- 如果是【搞笑幽默】：加入精妙的网络热梗、令人捧腹的动作细节和戏剧化误会，增加喜剧张力和荒诞喜感。
- 如果是【甜宠撒糖】：细节刻画要充满心动与暧昧，强化男女主角眼神对视、温柔护短的肢体动作和苏感爆棚的对白。
- 如果是【惊悚悬疑】：渲染紧张窒息的氛围，突出脚步声、呼吸声、阴影等视听细节，结尾卡点留下极度烧脑悬念。
- 如果是【霸道高冷】：强化角色的至尊身份、霸气台词与不容置疑的气场，动作神态刻画要充满统治力。

【剧本编写格式规范（严格保持）】：
1. 必须严格遵循三角形符号“△ ”动作描写和“角色名字（神态动作语气）：台词内容”格式。
2. 直接无缝输出修改后的完整剧本，不要带有任何多余的开场白、解释或总结。`;

        const controller = new AbortController();
        abortControllerRef.current = controller;

        try {
            const stream = generateTextStream(prompt, {
                model,
                temperature: 0.85,
                topP: 0.95,
                maxOutputTokens: maxTokens,
                signal: controller.signal
            });

            let fullText = '';
            for await (const chunk of stream) {
                fullText += chunk;
                setParsedEpisodes(prev => prev.map((item, idx) => 
                    idx === index ? { ...item, script: fullText } : item
                ));
            }

            setParsedEpisodes(prev => prev.map((item, idx) => {
                if (idx === index) {
                    const updatedHistory = [...(item.history || [])];
                    const timeStr = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                    let actionLabel = `情绪放大 [${emotion}]`;
                    if (ampType === 'scene') actionLabel = `更换场景 [${sceneTag}]`;
                    else if (ampType === 'event') actionLabel = `重构事件 [${reqs.substring(0, 10)}...]`;

                    updatedHistory.push({
                        timestamp: timeStr,
                        script: fullText,
                        label: `${actionLabel} (${timeStr})`
                    });
                    return { ...item, isGenerating: false, isDone: true, history: updatedHistory };
                }
                return item;
            }));
        } catch (err: any) {
            setParsedEpisodes(prev => prev.map((item, idx) => 
                idx === index ? { ...item, isGenerating: false } : item
            ));
            alert(err.message || '重改剧本失败，请重试');
        } finally {
            abortControllerRef.current = null;
        }
    };

    useEffect(() => {
        loadEpisodeProjects();
        const loadTags = async () => {
            try {
                const res = await fetchAvailableTags();
                if (res) {
                    setAvailableSceneTags(res.scene_types || []);
                    setAvailableEmotionTags(res.emotion_types || []);
                    setAvailableEventTags(res.event_types || []);
                    setAvailableAbilityTags(res.special_abilities || []);
                    setAvailableConflictTags(res.conflict_types || []);
                    setAvailableThemeTags(res.core_themes || []);
                    setAvailableElementTags(res.element_types || []);
                }
            } catch (e) {
                console.error("fetchAvailableTags failed:", e);
            }
        };
        loadTags();
    }, []);

    const handleSearchInspirations = async () => {
        setIsSearchingInspirations(true);
        try {
            const results = await searchInspirationFragments(searchKeyword, selectedTags);
            setSearchResults(results);
            setSelectedFragments([]); // Reset selections on new search
        } catch (e) {
            console.error("searchInspirationFragments failed:", e);
        } finally {
            setIsSearchingInspirations(false);
        }
    };

    // Automatic cloud synchronization debounced effect
    useEffect(() => {
        if (stage !== 'script_generation' && stage !== 'outline_results') return;
        if (!currentProjectId || parsedEpisodes.length === 0) return;

        setSyncStatus('syncing');
        const timer = setTimeout(async () => {
            try {
                const description = outlineMode === 'existing' ? '已有故事分集生成' : `主题:${theme} | 元素:${elements.join(',')}`;
                const scriptData = {
                    settings: {
                        format: 'live_action',
                        totalEpisodes: String(parsedEpisodes.length),
                        outputLanguage: 'zh',
                        model: model
                    },
                    planning: {
                        synopsis: outlineMode === 'existing' ? existingOutline : coreIdea,
                        characterSettings: '',
                        worldview: '',
                        outline: outlineRawText || '暂无大纲内容...'
                    },
                    episodes: parsedEpisodes,
                    outlineMode: outlineMode,
                    aiChatMessages: aiChatMessages
                };
                await updateProject(currentProjectId, {
                    title: projectTitle,
                    description: description,
                    script_data: scriptData
                });
                setSyncStatus('synced');
            } catch (err) {
                console.error("Auto sync failed:", err);
                setSyncStatus('failed');
            }
        }, 1500);

        return () => clearTimeout(timer);
    }, [parsedEpisodes, aiChatMessages, stage, currentProjectId, model, outlineMode, theme, elements, existingOutline, coreIdea, outlineRawText, projectTitle]);

    const handleSelectProject = async (proj: any) => {
        setCurrentProjectId(proj.id);
        setProjectTitle(proj.title);
        
        const scriptData = proj.script_data || {};
        const settings = scriptData.settings || {};
        const planning = scriptData.planning || {};
        
        if (settings.model) setModel(settings.model);
        if (planning.outline) setOutlineRawText(planning.outline);
        
        if (scriptData.outlineMode) {
            setOutlineMode(scriptData.outlineMode);
        }

        // If it's a skill_master project, load its properties!
        if (scriptData.isSkillMaster) {
            setStage('skill_master_workspace');
            if (scriptData.skillActiveStep) setSkillActiveStep(scriptData.skillActiveStep);
            if (scriptData.skillTopic) setSkillTopic(scriptData.skillTopic);
            if (scriptData.skillAudience) setSkillAudience(scriptData.skillAudience);
            if (scriptData.skillTone) setSkillTone(scriptData.skillTone);
            if (scriptData.skillSellingPoints) setSkillSellingPoints(scriptData.skillSellingPoints);
            if (scriptData.skillPlanEpisodes) setSkillPlanEpisodes(scriptData.skillPlanEpisodes);
            if (scriptData.skillMainChar) setSkillMainChar(scriptData.skillMainChar);
            if (scriptData.skillAntagonist) setSkillAntagonist(scriptData.skillAntagonist);
            if (scriptData.skillEpisodeNum) setSkillEpisodeNum(scriptData.skillEpisodeNum);
            if (scriptData.skillOverseasMode) setSkillOverseasMode(scriptData.skillOverseasMode);
            if (scriptData.skillReviewNum) setSkillReviewNum(scriptData.skillReviewNum);
            if (scriptData.skillOverseasRegion) setSkillOverseasRegion(scriptData.skillOverseasRegion);
            
            if (scriptData.skillStartOutput) setSkillStartOutput(scriptData.skillStartOutput);
            if (scriptData.skillPlanOutput) setSkillPlanOutput(scriptData.skillPlanOutput);
            if (scriptData.skillCharOutput) setSkillCharOutput(scriptData.skillCharOutput);
            if (scriptData.skillOutlineOutput) setSkillOutlineOutput(scriptData.skillOutlineOutput);
            if (scriptData.skillEpisodesStore) setSkillEpisodesStore(scriptData.skillEpisodesStore);
            if (scriptData.skillReviewsStore) setSkillReviewsStore(scriptData.skillReviewsStore);
            if (scriptData.skillComplianceStore) setSkillComplianceStore(scriptData.skillComplianceStore);
            if (scriptData.skillOverseasStore) setSkillOverseasStore(scriptData.skillOverseasStore);
            if (scriptData.skillExportOutput) setSkillExportOutput(scriptData.skillExportOutput);
            return;
        }

        // Restore chat messages if they exist, otherwise clear
        if (scriptData.aiChatMessages && Array.isArray(scriptData.aiChatMessages)) {
            setAiChatMessages(scriptData.aiChatMessages);
        } else {
            setAiChatMessages([]);
        }
        
        if (scriptData.episodes && Array.isArray(scriptData.episodes) && scriptData.episodes.length > 0) {
            setParsedEpisodes(scriptData.episodes);
            setEpisodesCount(scriptData.episodes.length);
            
            const hasAnyScripts = scriptData.episodes.some((ep: any) => ep.script && ep.script.trim().length > 0);
            if (hasAnyScripts) {
                setStage('script_generation');
            } else {
                setStage('outline_results');
            }
        } else {
            setParsedEpisodes([]);
            setStage('mode_select');
        }
    };

    const handleDeleteProjectClick = (proj: any, e: React.MouseEvent) => {
        e.stopPropagation();
        setProjectToDelete(proj);
    };

    const handleConfirmDeleteProject = async () => {
        if (!projectToDelete) return;
        try {
            await deleteProject(projectToDelete.id);
            setEpisodeProjects(prev => prev.filter(p => p.id !== projectToDelete.id));
            setProjectToDelete(null);
        } catch (err: any) {
            console.error("Failed to delete project:", err);
            alert("删除项目失败: " + (err.message || '请重试'));
        }
    };

    const handleHeaderBack = () => {
        if (stage === 'project_dashboard') {
            onBack();
        } else if (stage === 'skill_master_workspace') {
            setCurrentProjectId(null);
            setProjectTitle('');
            setStage('project_dashboard');
            loadEpisodeProjects();
        } else if (stage === 'mode_select') {
            setCurrentProjectId(null);
            setProjectTitle('');
            setStage('project_dashboard');
            loadEpisodeProjects();
        } else if (stage === 'outline_form_existing' || stage === 'outline_form_new') {
            setStage('mode_select');
        } else if (stage === 'outline_results') {
            setCurrentProjectId(null);
            setProjectTitle('');
            setStage('project_dashboard');
            loadEpisodeProjects();
        } else if (stage === 'script_generation') {
            setStage('outline_results');
        } else if (stage === 'completed') {
            setCurrentProjectId(null);
            setProjectTitle('');
            setStage('project_dashboard');
            loadEpisodeProjects();
        } else {
            setCurrentProjectId(null);
            setProjectTitle('');
            setStage('project_dashboard');
            loadEpisodeProjects();
        }
    };

    // Stop current stream
    const handleStop = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
        setGlobalIsGenerating(false);
        setActiveGeneratingIndex(null);
    };

    // Helper to open edit modal for single episode outline
    const openEditModal = (idx: number) => {
        setEditEpisodeIndex(idx);
        setEditEpisodeTitle(parsedEpisodes[idx].title);
        setEditOutlineText(parsedEpisodes[idx].outline);
        setShowEditModal(true);
    };

    // Helper to save single episode outline edits
    const saveEditModal = () => {
        if (editEpisodeIndex !== null) {
            setParsedEpisodes(prev => prev.map((item, id) => 
                id === editEpisodeIndex ? { ...item, title: editEpisodeTitle, outline: editOutlineText } : item
            ));
        }
        setShowEditModal(false);
        setEditEpisodeIndex(null);
    };

    // Parse partial JSON string during streaming to display clean preview outlines
    const parsePartialOutlines = (jsonStr: string): { episodeNumber?: number; title?: string; outline?: string; version?: number }[] => {
        const results: { episodeNumber?: number; title?: string; outline?: string; version?: number }[] = [];
        const objectBlocks = jsonStr.split(/\{/);
        
        for (let i = 1; i < objectBlocks.length; i++) {
            const block = objectBlocks[i];
            
            let episodeNumber: number | undefined;
            const numMatch = block.match(/["']episodeNumber["']\s*:\s*(\d+)/i);
            if (numMatch) {
                episodeNumber = parseInt(numMatch[1]);
            }

            let version: number | undefined;
            const verMatch = block.match(/["']version["']\s*:\s*(\d+)/i);
            if (verMatch) {
                version = parseInt(verMatch[1]);
            }
            
            let title: string | undefined;
            const titleMatch = block.match(/["']title["']\s*:\s*["']([^"']*)["']/i);
            if (titleMatch) {
                title = titleMatch[1];
            } else {
                const partialTitleMatch = block.match(/["']title["']\s*:\s*["']([^"']*)$/i);
                if (partialTitleMatch) {
                    title = partialTitleMatch[1];
                }
            }
            
            let outline: string | undefined;
            const outlineMatch = block.match(/["']outline["']\s*:\s*["']([^"']*)["']/i);
            if (outlineMatch) {
                outline = outlineMatch[1];
            } else {
                const partialOutlineMatch = block.match(/["']outline["']\s*:\s*["']([^"']*)$/i);
                if (partialOutlineMatch) {
                    outline = partialOutlineMatch[1];
                }
            }
            
            if (episodeNumber !== undefined || title !== undefined || outline !== undefined || version !== undefined) {
                results.push({ episodeNumber, title, outline, version });
            }
        }
        return results;
    };

    // AI collaborative chat message send
    const handleAIChatSend = async (customPrompt?: string) => {
        const textToSend = customPrompt || aiChatInput;
        if (!textToSend.trim() || aiIsGenerating) return;

        const userMsg = textToSend.trim();
        if (!customPrompt) {
            setAiChatInput('');
        }
        setAiChatMessages(prev => [...prev, { role: 'user', content: userMsg }]);
        setAiIsGenerating(true);

        const currentOutlinesString = parsedEpisodes.map(ep => 
            `第${ep.episodeNumber}集：${ep.title}\n大纲内容：${ep.outline}`
        ).join('\n\n');

        const prompt = chatScope === 'single'
            ? `【角色定位】：你是一位资深的爆款短剧导演与剧本总监，正在与编剧协作优化本剧的单集大纲。
你现在需要对【第 ${chatTargetEpisode} 集】进行针对性优化。

【当前整部短剧的分集大纲状态（共 ${parsedEpisodes.length} 集）】：
${currentOutlinesString}

---

【用户的修改/优化指令】：
“${userMsg}”
优化目标：专门针对【第 ${chatTargetEpisode} 集】。

【单集修改极硬性指令】：
为了给编剧提供更广阔的灵感和选择空间，你**必须一下子给到 3 个不同侧重点/戏剧走向的优化版本**（例如：版本1侧重强情节反转，版本2侧重情绪推高与爽点爆发，版本3侧重悬念拉满与情感羁绊等）。
请注意：每一个版本都必须是第 ${chatTargetEpisode} 集，它们是并列的选择方案，**必须标注 "version" (分别为 1, 2, 3)**。
**【核心要求】这 3 个版本的差异度一定要极大！它们必须代表完全不同的故事走向、戏剧冲突逻辑、节奏或切入视角，绝对不能只是简单的措辞微调或大同小异。**

【单集结构硬性要求（极度重要，每一集的核心指标）】：
- 每一集的大纲事件必须包含3个情节点。情节点的安排必须围绕着核心的主线进行，且3个情节点之间层层递进、情绪不断加深、有反转点。人物的戏剧性行为、动作、对抗性、情绪性清晰。
- 大纲事件减少描述性话语，简明扼要地写清事件发展的过程、具体的细节点、人物的相关反映动作。减少形容词和副词的描述。
- 大纲情节一定要具有逻辑性，情节点之间互相关联、推进，情节具有戏剧化效果，一波三折、跌宕起伏、调用观众的情绪，让观众代入。
- 情节点设计一定要符合短剧的夸张感、情绪性和强情节性。
- 结尾钩子是卡点事件，可以是悬念钩子/反转钩子/情绪钩子/危机钩子/，让观众有继续看下去的欲望，不要有描述性的话语。
- 结尾钩子禁止出现以下情况：无钩子硬结尾 → 观众没有理由继续看；钩子悬念下集秒解 → 观众觉得被骗（虚假悬念）；连续用同一种钩子 → 观众产生免疫；钩子和剧情无关 → 观众觉得是凑数；钩子给出太多信息 → 观众已经猜到答案，不需要看下集。
- 第一集：黄金五秒法则——第一秒：画面冲击或悬念抛出；第3秒：核心冲突或身份反差建立；第5秒：观众必须产生"接下来会怎样"的好奇心；前30秒必须完成：1. 建立核心冲突或悬念；2. 展示主角处境（弱势/困境/反差）；3. 抛出第一个钩子。
- 每一个版本的大纲 "outline" 字段**必须且仅包含：【3个情节点】、【结尾悬念卡点事件】**！
- 样式进行规范标注：
  “【情节点1】... 【情节点2】... 【情节点3】...【卡点钩子1】”

【极度重要：回复精简规范】：
你的回复必须非常简短！无需寒暄或长篇大论。只需用一两句话（不超过30字）点出修改思路，然后直接开始输出 JSON 代码块。

【输出格式与规范】：
1. 首先，用极简的一两句导演分析点出修改思路（控制在30字以内）。
2. 然后，直接输出对应的 JSON 格式代码块，代码块内是一个包含 3 个不同版本的 JSON 数组，格式必须完全符合下面示例（每个方案的 "episodeNumber" 均为 ${chatTargetEpisode}，且包含 "version" 1, 2, 3，禁止含有任何多余的键名）：
\`\`\`json
[
  {
    "episodeNumber": ${chatTargetEpisode},
    "version": 1,
    "title": "第${chatTargetEpisode}集标题 (方案1：侧重...)",
    "outline": "【情节点1】... 【情节点2】... 【情节点3】... 【悬念钩子1】"
  },
  {
    "episodeNumber": ${chatTargetEpisode},
    "version": 2,
    "title": "第${chatTargetEpisode}集标题 (方案2：侧重...)",
    "outline": "【情节点1】... 【情节点2】...【情节点3】... 【悬念钩子1】"
  },
  {
    "episodeNumber": ${chatTargetEpisode},
    "version": 3,
    "title": "第${chatTargetEpisode}集标题 (方案3：侧重...)",
    "outline": "【情节点1】... 【情节点2】... 【情节点3】... 【悬念钩子1】"
  }
]
\`\`\`
3. 结尾不要输出任何多余总结、问候，主要是呈现输出的大纲。`
            : `【角色定位】：你是一位资深的爆款短剧导演与剧本总监，精通市面上爆款男女频短剧的爆点剧情设计，你正在与编剧协作优化本剧的分集大纲。

【当前整部短剧的分集大纲状态（共 ${parsedEpisodes.length} 集）】：
${currentOutlinesString}

---

【用户的修改/优化指令】：
“${userMsg}”
优化范围：全剧整体

---

【分批/分段输出大纲的黄金法则（硬性防截断策略）】：
1. **防止截断，支持多次生成**：
   - 鉴于大模型单次生成的最大 Token 限制，如果要对整部短剧（尤其是集数较多，如15集以上）的所有分集进行极其精彩、不缩水、不简化的高质量细节重构，一口气输出势必会被截断。
   - 因此，你**必须采取「分批/分段优化」机制**：
     - 如果总集数较多，请**每次只输出一个包含约 10-15 集左右 of JSON 数组代码块**（例如：默认先输出第 1 到 12 集，或在用户回复“继续生成第13-24集”时仅输出对应的 13-24 集）。
     - 每一集必须确保戏剧张力拉满，绝对不能为了缩减 Token 而精简、缩水！
     - 在大纲 JSON 代码块后，你**必须用极简的语言指导用户**如何获取后续集数。
2. **当情节不够时的扩充与延展策略（硬性任务）**：
   - 必须深度理解整个故事梗概的世界观、背景和人物设定，合理、合情、逻辑自洽地拓展和延伸全新的情节点、剧情冲突、反差对峙和打脸桥段，杜绝敷衍压缩。
   - 每集结尾必须有事件作为悬念钩子/付费卡点。卡点必须采取三大设计原则——情绪峰值原则：在观众情绪最高涨的时刻设卡，而不是平淡处；悬念未解原则：卡点时必须有一个强烈的"未回答问题"悬在那里；沉没成本原则：观众已经投入了足够的情感，不舍得放弃。
   - 每一集的情节点设计一定是层层递进的、事件的程度是逐渐加深的，情节点构成：事件钩子-人物的戏剧性动作。人物的戏剧性动作也是层层递进，不断加深的。每个情节场次之间要有递进关系，不能平行并列。中段不能出现"信息真空"（无新信息的过渡场景）。
   - 每一集的大纲事件必须包含3个情节点。情节点的安排必须围绕着核心的主线进行，且3个情节点之间层层递进、情绪不断加深、有反转点。人物的戏剧性行为、动作、对抗性、情绪性清晰。
   - 大纲事件减少描述性话语，简明扼要地写清事件发展的过程、具体的细节点、人物的相关反映动作。减少形容词和副词的描述。
   - 大纲情节一定要具有逻辑性，情节点之间互相关联、推进，情节具有戏剧化效果，一波三折、跌宕起伏、调用观众的情绪，让观众代入。
   - 情节点设计一定要符合短剧的夸张感、情绪性和强情节性。
   - 结尾钩子是卡点事件，可以是悬念钩子/反转钩子/情绪钩子/危机钩子/，让观众有继续看下去的欲望，不要有描述性的话语。
   - 结尾钩子禁止出现以下情况：无钩子硬结尾 → 观众没有理由继续看；钩子悬念下集秒解 → 观众觉得被骗（虚假悬念）；连续用同一种钩子 → 观众产生免疫；钩子和剧情无关 → 观众觉得是凑数；钩子给出太多信息 → 观众已经猜到答案，不需要看下集。
   - 第1集：黄金五秒法则——第一秒：画面冲击或悬念抛出；第3秒：核心冲突或身份反差建立；第5秒：观众必须产生"接下来会怎样"的好奇心；前30秒必须完成：1. 建立核心冲突或悬念；2. 展示主角处境（弱势/困境/反差）；3. 抛出第一个钩子。
   - 付费卡点位置规划：
     - 首个卡点：第8-12集。最强悬念，这是付费转化的关键窗口，前面免费内容必须积累足够钩子。
     - 第二卡点：第18-25集。身份揭露/反转，中段高潮，观众已深度投入。
     - 第三卡点：第35-45集。感情线高潮，情感最浓时刻。
     - 终极卡点：倒数3-5集。终极对决前，已投入全部情感，必须看到结局。
   - 卡点设计的禁忌：
     - 无悬念硬切：在平淡场景强行结束，观众没有付费动力。
     - 虚假悬念：上集制造的悬念，下集开头 10 秒就化解了。
     - 关键信息提前泄露：如果观众已经猜到了答案，卡点就失去了意义。
     - 连续多集都在同一悬念上卡：第10集卡在身份揭露、第11集还是卡在身份揭露→观众愤怒。
     - 卡在无关紧要的小事上：观众付费是为了看核心剧情推进，不是看支线小事。
   - 免费集与付费集的节奏配合：
     - 免费集（前 8-12 集）的任务：
       - 建立角色和核心冲突。
       - 累积至少 3 个未解悬念。
       - 让观众对主角产生强烈情感投入。
       - 展示"爽点"的味道（小规模打脸/撒糖）。
       - 在最后一集免费内容的结尾放最强钩子 。  
     - 付费集的节奏：
       - 首个付费集必须立即兑现免费集积累的悬念（让观众觉得钱花得值）。
       - 兑现旧悬念的同时制造新悬念（持续付费动力）。
       - 每 5-8 集有一次中型爽点释放。
       - 每 15-20 集有一次大型爽点释放。
       - 结局前的最后爽点必须是全剧最大的。

3. **单集结构硬性要求（极度重要，每一集的核心指标）**：
   - 无论何时生成或修改任何一集，其 "outline" 字段**必须且仅包含：【3个情节点】、【结尾悬念卡点】**！
   - 你在输出时，**必须明确、清晰地标注并展示这 3 个情节点和 1 个悬念钩子**，使用以下样式进行规范标注：
     “【情节点1】... 【情节点2】... 【情节点3】... 【悬念钩子1】”

【极度重要：回复精简规范】：
你的回复必须非常简短！无需寒暄或长篇大论。只需用一两句话（不超过30字）点出修改思路，然后直接开始输出 JSON 代码块。

【输出格式与规范】：
1. 首先，用极简的一两句导演分析点出修改思路（不超过30字）。
2. 然后，输出对应的 JSON 格式代码块，代码块内是一个包含更新后分集大纲的 JSON 数组，格式必须完全符合下面示例，**禁止含有任何多余的键名**（确保 "outline" 严格标注【情节点】【悬念钩子】）：
\`\`\`json
[
  {
    "episodeNumber": 1,
    "title": "第1集标题",
    "outline": "【情节点1】... 【情节点2】... 【情节点3】... 【悬念钩子1】"
  }
]
\`\`\`
3. 接着在 JSON 代码块后提供下一步操作指引，告诉用户如何分批生成完接下来的剧情。
4. 所有的回复文字请保持通俗、专业而亲切。`;

        const controller = new AbortController();
        abortControllerRef.current = controller;
        let fullReply = '';

        setAiChatMessages(prev => [...prev, { role: 'assistant', content: '' }]);

        try {
            const stream = generateTextStream(prompt, {
                model,
                temperature: 0.8,
                topP: 0.95,
                maxOutputTokens: 8192,
                signal: controller.signal
            });

            for await (const chunk of stream) {
                fullReply += chunk;
                setAiChatMessages(prev => {
                    const next = [...prev];
                    if (next.length > 0) {
                        next[next.length - 1] = { role: 'assistant', content: fullReply };
                    }
                    return next;
                });
                if (aiChatScrollRef.current) {
                    aiChatScrollRef.current.scrollTop = aiChatScrollRef.current.scrollHeight;
                }
            }
        } catch (err: any) {
            if (err.name !== 'AbortError' && err.message !== 'Aborted') {
                setAiChatMessages(prev => [
                    ...prev.slice(0, -1),
                    { role: 'assistant', content: `抱歉，大纲优化过程中出现问题：${err.message || '连接超时'}` }
                ]);
            }
        } finally {
            setAiIsGenerating(false);
            abortControllerRef.current = null;
        }
    };

    // Extract JSON outlines from AI reply
    const extractAndApplyOutlines = (content: string) => {
        try {
            let jsonText = '';
            
            // Try to match the markdown code block first, but don't strictly require the closing backticks if truncated
            const jsonBlockRegex = /```json\s*([\s\S]*?)(?:```|$)/;
            const blockMatch = content.match(jsonBlockRegex);
            if (blockMatch && blockMatch[1]) {
                jsonText = blockMatch[1].trim();
            } else {
                // Look for first '[' and last ']' if no json codeblock
                const startIdx = content.indexOf('[');
                const endIdx = content.lastIndexOf(']');
                if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
                    jsonText = content.substring(startIdx, endIdx + 1);
                } else {
                    // Try to find any partial bracket sequence starting with '['
                    const fallbackStartIdx = content.indexOf('[');
                    if (fallbackStartIdx !== -1) {
                        jsonText = content.substring(fallbackStartIdx);
                    }
                }
            }

            if (!jsonText) {
                alert('未在大神导演的回复中检测到符合规范 of JSON 大纲格式块。');
                return;
            }

            let arr: any[] = [];
            try {
                // Try standard parsing
                arr = JSON.parse(jsonText);
            } catch (jsonErr) {
                // If standard JSON parse fails due to truncation / trailing commas, use the robust regex-based split parser
                console.warn("Standard JSON parsing failed, using robust partial parser fallback:", jsonErr);
                const parsed = parsePartialOutlines(jsonText);
                if (parsed && parsed.length > 0) {
                    arr = parsed;
                }
            }

            if (arr && Array.isArray(arr) && arr.length > 0) {
                setParsedEpisodes(prev => {
                    const next = [...prev];
                    arr.forEach((item: any) => {
                        const epNum = parseInt(item.episodeNumber);
                        if (!isNaN(epNum)) {
                            const matchIdx = next.findIndex(x => x.episodeNumber === epNum);
                            
                            let titleStr = String(item.title || '');
                            let outlineStr = String(item.outline || '');
                            
                            // Unescape basic string markers from manual parsing if necessary
                            titleStr = titleStr.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\t/g, '\t');
                            outlineStr = outlineStr.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\t/g, '\t');

                            if (matchIdx !== -1) {
                                next[matchIdx] = {
                                    ...next[matchIdx],
                                    title: titleStr || next[matchIdx].title,
                                    outline: outlineStr || next[matchIdx].outline
                                };
                            } else {
                                next.push({
                                    episodeNumber: epNum,
                                    title: titleStr || `第${epNum}集`,
                                    outline: outlineStr,
                                    script: ''
                                });
                            }
                        }
                    });
                    return next.sort((a, b) => a.episodeNumber - b.episodeNumber);
                });
                alert('✨ 成功应用 AI 优化后的分集大纲！');
            } else {
                alert('解析格式有误，返回的不是有效大纲列表。');
            }
        } catch (e: any) {
            alert(`大纲解析失败，请确保格式正确。错误: ${e.message}`);
        }
    };

    // Apply a specific version of single episode outline
    const applySingleEpisodeVersion = (episodeNumber: number, title: string, outline: string) => {
        try {
            setParsedEpisodes(prev => {
                const next = [...prev];
                const epNum = parseInt(String(episodeNumber));
                if (!isNaN(epNum)) {
                    const matchIdx = next.findIndex(x => x.episodeNumber === epNum);
                    
                    let titleStr = String(title || '');
                    let outlineStr = String(outline || '');
                    
                    titleStr = titleStr.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\t/g, '\t');
                    outlineStr = outlineStr.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\t/g, '\t');

                    if (matchIdx !== -1) {
                        next[matchIdx] = {
                            ...next[matchIdx],
                            title: titleStr || next[matchIdx].title,
                            outline: outlineStr || next[matchIdx].outline
                        };
                    } else {
                        next.push({
                            episodeNumber: epNum,
                            title: titleStr || `第${epNum}集`,
                            outline: outlineStr,
                            script: ''
                        });
                    }
                }
                return next.sort((a, b) => a.episodeNumber - b.episodeNumber);
            });
            alert(`✨ 成功应用第 ${episodeNumber} 集的所选优化版本！`);
        } catch (err: any) {
            alert(`应用大纲版本失败: ${err.message}`);
        }
    };

    // Helper to parse outlines from raw generated text
    const parseOutlines = (rawText: string, expectedCount: number): EpisodeOutline[] => {
        const list: EpisodeOutline[] = [];
        
        // Pattern supporting both Arabic numbers and Chinese characters for episode numbers
        const pattern = /(?:【?第\s*([0-9一二三四五六七八九十百]+)\s*集[:：\s]*([^】\n]*?)】?\s*\n+)(?:核心事件[:：]\s*([^\n]*)\n+)?(?:本集梗概[:：]\s*([\s\S]*?)(?=(?:【?第\s*[0-9一二三四五六七八九十百]+\s*集|\s*$)))/g;
        
        let match;
        pattern.lastIndex = 0;
        
        while ((match = pattern.exec(rawText)) !== null) {
            const epNumStr = match[1];
            const title = match[2]?.trim() || '';
            const coreEvent = match[3]?.trim() || '';
            const outlineText = match[4]?.trim() || '';
            
            let epNum = parseInt(epNumStr, 10);
            if (isNaN(epNum)) {
                // simple conversion for Chinese numbers if needed
                const cnNums: { [key: string]: number } = {
                    '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '十': 10
                };
                epNum = cnNums[epNumStr] || (list.length + 1);
            }
            
            list.push({
                episodeNumber: epNum,
                title: title || `第${epNum}集`,
                outline: coreEvent ? `核心事件：${coreEvent}\n本集梗概：${outlineText}` : outlineText
            });
        }
        
        // Fallback parser if we got nothing or too few matching the strict regex
        if (list.length < expectedCount / 2) {
            const fallbackList: EpisodeOutline[] = [];
            const parts = rawText.split(/(?=【?第\s*[0-9一二三四五六七八九十百]+\s*集)/);
            parts.forEach((part) => {
                const lines = part.split('\n').map(l => l.trim()).filter(Boolean);
                if (lines.length === 0) return;
                
                const firstLine = lines[0];
                const epNumMatch = firstLine.match(/第\s*([0-9一二三四五六七八九十百]+)\s*集/);
                let epNum = epNumMatch ? parseInt(epNumMatch[1], 10) : NaN;
                if (isNaN(epNum)) {
                    epNum = fallbackList.length + 1;
                }
                
                let title = firstLine.replace(/【?第\s*[0-9一二三四五六七八九十百]+\s*集[:：\s]*/, '').replace(/】$/, '').trim();
                if (!title) title = `第${epNum}集`;
                
                const outlineText = lines.slice(1).join('\n');
                fallbackList.push({
                    episodeNumber: epNum,
                    title,
                    outline: outlineText
                });
            });
            if (fallbackList.length > list.length) {
                return fallbackList.sort((a, b) => a.episodeNumber - b.episodeNumber);
            }
        }
        
        return list.sort((a, b) => a.episodeNumber - b.episodeNumber);
    };

    // AI创意大纲一键批量生成
    const handleGenerateOutline = async () => {
        if (globalIsGenerating) return;
        
        setGlobalIsGenerating(true);
        setError('');
        setOutlineRawText('');
        setParsedEpisodes([]);
        setStage('outline_generating');

        let prompt = '';
        if (outlineMode === 'existing') {
            prompt = `【任务类型】：分集故事梗概拆分与续写（爆款短剧节奏深度优化）
【目标集数】：${episodesCount} 集

【原始故事梗概】：
${existingOutline}

---

【拆分与续写核心指令（极其重要，不折不扣执行）】：
请严格基于上述【原始故事梗概】，将整篇故事按照其蕴含的事件节点、冲突爆点与剧情转折点，艺术化、戏剧化地拆分并扩写为【整整 ${episodesCount} 集】的AI短剧分集梗概。
你必须对原始故事的节奏和情绪点进行爆款短剧化重构，确保每一集都拥有抓人的钩子和饱满的情绪波澜，杜绝平铺直叙。

【爆款短剧黄金节奏与情绪曲线重构指令（核心要求）】：
1. **黄金情绪波动曲线（虐爽结合、抑扬顿挫）**：
   - 绝不能平铺直叙！必须按照“抑扬顿挫”的爆款情绪曲线重新编排，合理分布“憋屈/隐忍(抑)”与“打脸/反击(扬)”。
   - **高频高潮分布**：每 3-5 集必须有一次情绪小爆发（如小误会化解、爽快反击、或强敌新一轮卑鄙挑衅）；每 10-15 集必须有一次核心大高潮（如重要身份首度揭晓、核心反派惨烈吃瘪、男女主宿命感羁绊极速升温）。
2. **情节点的高密度与视觉化反差**：
   - 将原始故事中的干瘪冲突，拆解为“冲突发生 -> 情绪积累(憋屈) -> 危机转折 -> 实力逆袭(打脸) -> 爽感释放、全场震撼”的完整情绪闭环。
   - 所有矛盾冲突必须有具体、外化、可视觉化的情节点与行动（严禁只写“两人产生误会”，必须写清楚误会的具体导火索和具有张力的对峙行动）。
3. **前3集黄金开局（极致拉满吸睛度）**：
   - 前3集必须具有高强度、高密度、信息量炸裂的剧情。
   - 第1集开头必须以最炸裂、最具情绪撕裂感的危机事件开局（如惨遭背叛、当众退婚、隐藏身份险遭拆穿、绝望处绝处逢生等），迅速把观众的情绪卷入，奠定非看不可的爽燃或虐恋基调！

【大纲创作金牌规范要求（极其重要，严格执行）】：
1. **严格确保输出集数完全符合要求**：你必须精准、无一遗漏地生成刚好【${episodesCount}集】大纲（必须从【第1集】连续不间断地输出到【第${episodesCount}集】），绝对不能中途截断、合并集数、敷衍了事或在半路戛然而止！
2. **大纲字数与 Token 预算控制（防止大模型生成截断）**：
   - 如果目标集数较多（例如 ${episodesCount} >= 30 集），为了防止因大模型最大输出字数限制（maxOutputTokens）导致生成在半路中断，你**必须主动且精细地控制每集大纲的字数（每集梗概控制在 60-100 字左右，重点突出本集核心矛盾、打脸逆袭和结局悬念，字字珠玑）**，确保可以一口气完完整整地输出到最后一集【第${episodesCount}集】！
   - 如果目标集数较少（例如 ${episodesCount} < 30 集），每集梗概应当更加充实饱满，在 120-180 字之间。
3. **分集剧情的极致连贯性与层层递进**：整部短剧的分集大纲剧情必须**高度连贯、层层递进、环环相扣**。角色关系的演化、误会的堆叠、高潮打脸的清算、隐藏身份的层层解密，必须顺理成章、逻辑严密，绝不能出现剧情断代或莫名其妙的飞跃。
4. **强节奏点与剧情卡点（Hook）**：在每一集的结尾，必须设置极具悬念的钩子、打脸的前奏或突如其来的反转，让观众产生强烈的“继续观看/自动解锁下一集”的冲动。

---

【输出格式规范】：
请严格按照以下格式完整输出从【第1集】到【第${episodesCount}集】的详细大纲内容：
【第X集：分集标题】
核心事件：本集的核心打脸、冲突、事件或情绪卡点。
本集梗概：具体情节详细推演。

直接无缝输出，不要有任何多余的解释、开场白或引导语。`;
        } else {
            let promptInstruction = selectedPromptCard?.template || selectedPromptCard?.content || selectedPromptCard?.description || '';
            if (selectedPromptCard?.fields && selectedPromptCard.fields.length > 0) {
                selectedPromptCard.fields.forEach(field => {
                    const val = promptFormValues[field.id] || '';
                    promptInstruction = promptInstruction.replace(new RegExp(`\\$\\{${field.id}\\}`, 'g'), val);
                });
            }

            let filledFieldsText = '';
            if (selectedPromptCard?.fields && selectedPromptCard.fields.length > 0) {
                filledFieldsText = selectedPromptCard.fields
                    .map(f => `${f.label}：${promptFormValues[f.id] || '（未填写）'}`)
                    .join('\n');
            } else if (coreIdea) {
                filledFieldsText = `故事核心/雏形：${coreIdea}`;
            }

            const optionalEraText = selectedEra ? `【时代背景】：${selectedEra}` : '';
            const optionalThemeText = selectedThemePlots.length > 0 ? `【主题情节】：${selectedThemePlots.join('、')}` : '';
            const optionalCharText = selectedCharacters.length > 0 ? `【角色设定】：${selectedCharacters.join('、')}` : '';
            const optionalTropeText = coreTrope ? `【核心梗】：${coreTrope}` : '';

            prompt = `【任务类型】：AI创意大纲一键批量生成
【提示词模板/卡片】：${selectedPromptCard?.title || '微短剧分集大纲生成'}
${optionalEraText}
${optionalThemeText}
${optionalCharText}
${optionalTropeText}
【目标集数】：${episodesCount} 集

---

【提示词表单填报内容】：
${filledFieldsText}

---

【提示词指令】：
${promptInstruction}

---

【大纲创作金牌规范要求（极其重要，严格执行）】：
1. **严格确保输出集数完全符合要求**：你必须精准、无一遗漏地生成刚好【${episodesCount}集】大纲（必须从【第1集】连续不间断地输出到【第${episodesCount}集】），绝对不能中途截断、合并集数、敷衍了事或在半路戛然而止！
2. **大纲字数与 Token 预算控制**：
   - 如果目标集数较多（例如 ${episodesCount} >= 30 集），为了防止因大模型最大输出字数限制导致生成在半路中断，你必须主动精细地控制每集大纲字数（每集梗概控制在 60-100 字左右），确保可以一口气完完整整地输出到最后一集【第${episodesCount}集】！
   - 如果目标集数较少（例如 ${episodesCount} < 30 集），每集梗概应当更加充实饱满，不少于 150 字。
3. **分集剧情的极致连贯性与层层递进**：整部短剧的分集大纲剧情必须高度连贯、层层递进、环环相扣。
4. **黄金前3集炸裂事件开局**：第1集必须以一个极其炸裂的事件作为开头，迅速激化不可调和的情绪和利益冲突。
5. **强节奏点与剧情卡点（Hook）**：在每一集的结尾，设置极具悬念的钩子或打脸前奏。

【输出格式规范】：
请严格按照以下格式完整输出从【第1集】到【第${episodesCount}集】的详细大纲内容：
【第X集：分集标题】
核心事件：本集的核心打脸、冲突、事件或情绪卡点。
本集梗概：具体情节详细推演。

直接无缝输出，不要有任何多余的解释、开场白或引导语。`;
        }

        const controller = new AbortController();
        abortControllerRef.current = controller;
        
        try {
            const stream = generateTextStream(prompt, {
                model,
                temperature,
                topP: 0.95,
                maxOutputTokens: maxTokens,
                signal: controller.signal
            });
            
            let finalText = '';
            for await (const chunk of stream) {
                finalText += chunk;
                setOutlineRawText(finalText);
                if (scrollRef.current) {
                    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
                }
            }
            
            // If existing outline mode, auto transition to outline_results
            if (outlineMode === 'existing') {
                const finalEpisodes = parseOutlines(finalText, episodesCount);
                setParsedEpisodes(finalEpisodes);
                setStage('outline_results');
            }
        } catch (err: any) {
            if (err.message !== 'Aborted') {
                setError(err.message || '生成失败，请重试');
                if (outlineMode === 'existing') {
                    setStage('outline_form_existing');
                }
            }
        } finally {
            setGlobalIsGenerating(false);
            abortControllerRef.current = null;
        }
    };

    
    // Sequential Script Generation
    const generateScriptForEpisode = async (index: number, previousScript: string = '') => {
        if (index >= parsedEpisodes.length) return;
        
        const ep = parsedEpisodes[index];
        setActiveGeneratingIndex(index);
        
        // Setup initial blank script for this episode and save current script to history if exists
        setParsedEpisodes(prev => prev.map((item, idx) => {
            if (idx === index) {
                const updatedHistory = [...(item.history || [])];
                if (item.script && item.script.trim()) {
                    const lastHist = updatedHistory[updatedHistory.length - 1];
                    if (!lastHist || lastHist.script !== item.script) {
                        const timeStr = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                        updatedHistory.push({
                            timestamp: timeStr,
                            script: item.script,
                            label: `手动修改/历史版本 (${timeStr})`
                        });
                    }
                }
                return { ...item, script: '', isGenerating: true, history: updatedHistory };
            }
            return item;
        }));

        // Gather surrounding context
        const globalOutline = outlineMode === 'existing' ? existingOutline : coreIdea;
        const previousTail = previousScript ? previousScript.slice(-2000) : '无（本集为第一集）';

        const prompt = `【剧本创作任务】：快节奏微短剧分集剧本生成
【当前创作集数】：第${ep.episodeNumber}集 / 共${parsedEpisodes.length}集
【本集标题】：${ep.title}

【微短剧总故事大纲】：
${globalOutline}

【本集分集剧情大纲（对应1分半左右视频剧本内容）】：
${ep.outline}

【上集剧情承接（已生成的上集结尾）】：
${previousTail}

---

【剧本编写格式与排版规范（极其重要，请严格执行）】：
请将上述【分集剧情大纲】的情节，扩展为高戏剧冲突、爽点鲜明、字数大约500-800字、播放时长约1.5分钟的单集正式剧本。剧本生成的过程中要强化开头和卡点的表现，用具体的、炸裂的、情绪化的画面动作 and 人物话语来强化剧情。
剧本的结构和排版格式必须精确参照以下格式：

1. **集数标题**：
   在剧本最顶部单独成行输出，格式为：
   第${toChineseNum(ep.episodeNumber)}集

2. **场景标题**：
   每个场景的开头，必须有且仅有一行场景标题，格式为：
   “集数-场景序号 场景地点 时间/内外 人物：出场人物1 出场人物2”
   例如：
   ${ep.episodeNumber}-1 走廊拐角（洗手间附近） 夜/内 人物：乔以安 厉维 周婉清
   （如果一集里有多个场景，场景序号需递增，如 ${ep.episodeNumber}-2, ${ep.episodeNumber}-3 等）

3. **动作、神态与环境描写**：
   - 必须在独立行输出。
   - 动作描写一定要外化、夸张化，具有动漫感、分镜感。
   - 减少使用副词、形容词等描述性话语，使用简洁的动作、神态描写。
   - 必须以三角形符号“△ ”（符号后跟一个空格）开头。
   - 例如：
   △ 她想悄悄退回去，但被周婉清一眼瞥见。

4. **台词与对白**：
   - 必须在独立行输出。
   - 人物的台词对话一定要符合人物的性格特点，具有短剧感。
   - 对话必须推动剧情发展，拒绝任何的无用、闲聊式的话语。
   - 必须使用“人物名字（神态动作）：台词内容”格式。
   - 例如：
   周婉清（冷笑，上前一步）：哟，这不是我们的天才女编剧吗？

5. **黄金剧终卡点（Hook）**：
   - 在本集剧本的最末尾，必须设置一个极具悬念、反转或强烈情感撕裂的时刻作为卡点，诱导观众进入下一集。

请严禁输出任何多余的开头语、解释、尾注或标记，直接输出符合上述格式规范的剧本内容。`;

        const controller = new AbortController();
        abortControllerRef.current = controller;

        try {
            const stream = generateTextStream(prompt, {
                model,
                temperature: 0.75,
                topP: 0.95,
                maxOutputTokens: maxTokens,
                signal: controller.signal
            });

            let fullText = '';
            for await (const chunk of stream) {
                fullText += chunk;
                setParsedEpisodes(prev => prev.map((item, idx) => 
                    idx === index ? { ...item, script: fullText } : item
                ));
            }

            setParsedEpisodes(prev => prev.map((item, idx) => {
                if (idx === index) {
                    return { ...item, isGenerating: false, isDone: true };
                }
                return item;
            }));
            
            return fullText;
        } catch (err: any) {
            setParsedEpisodes(prev => prev.map((item, idx) => 
                idx === index ? { ...item, isGenerating: false } : item
            ));
            alert(err.message || '生成剧本失败，请重试');
            throw err;
        } finally {
            abortControllerRef.current = null;
        }
    };

    const handleSingleEpisodeEditChange = (index: number, value: string) => {
        setSingleEpisodeEdits(prev => ({ ...prev, [index]: value }));
    };

    const handleSingleEpisodeOptimize = async (index: number) => {
        const ep = parsedEpisodes[index];
        const instruction = singleEpisodeEdits[index];
        if (!instruction || !instruction.trim()) return;

        setParsedEpisodes(prev => prev.map((item, idx) => {
            if (idx === index) {
                const updatedHistory = [...(item.history || [])];
                if (item.script && item.script.trim()) {
                    const timeStr = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                    updatedHistory.push({
                        timestamp: timeStr,
                        script: item.script,
                        label: `润色前版本 (${timeStr})`
                    });
                }
                return { ...item, isGenerating: true, history: updatedHistory };
            }
            return item;
        }));

        // Clear the input
        setSingleEpisodeEdits(prev => ({ ...prev, [index]: '' }));

        const prompt = `【单集剧本精细优化任务】
【当前集数】：第${ep.episodeNumber}集 / 共${parsedEpisodes.length}集
【本集标题】：${ep.title}

【原剧本内容】：
${ep.script}

【用户的精细修改意见】：
“${instruction}”

---

【剧本编写格式与排版规范（极其重要，请严格执行）】：
请根据用户的【修改意见】，在保持原剧本主体脉络 and 精彩情节的同时，对相应的场景、台词或描述进行精准优化和改写。
确保：
1. 严格遵循原来的三角形符号“△ ”动作描写和“角色名字（神态动作）：台词内容”格式。
2. 不要输出任何开场白、问候语或总结，必须且仅输出修改后的标准剧本本体内容。`;

        const controller = new AbortController();
        abortControllerRef.current = controller;

        try {
            const stream = generateTextStream(prompt, {
                model,
                temperature: 0.75,
                topP: 0.95,
                maxOutputTokens: maxTokens,
                signal: controller.signal
            });

            let fullText = '';
            for await (const chunk of stream) {
                fullText += chunk;
                setParsedEpisodes(prev => prev.map((item, idx) => 
                    idx === index ? { ...item, script: fullText } : item
                ));
            }

            setParsedEpisodes(prev => prev.map((item, idx) => {
                if (idx === index) {
                    const updatedHistory = [...(item.history || [])];
                    const timeStr = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                    updatedHistory.push({
                        timestamp: timeStr,
                        script: fullText,
                        label: `优化生成版本 (${timeStr})`
                    });
                    return { ...item, isGenerating: false, isDone: true, history: updatedHistory };
                }
                return item;
            }));
        } catch (err: any) {
            setParsedEpisodes(prev => prev.map((item, idx) => 
                idx === index ? { ...item, isGenerating: false } : item
            ));
            alert(err.message || '优化剧本失败，请重试');
        } finally {
            abortControllerRef.current = null;
        }
    };

    // Sequential Trigger for ALL
    const handleGenerateAllScripts = async () => {
        if (globalIsGenerating) {
            handleStop();
            return;
        }
        
        setGlobalIsGenerating(true);
        setScriptGenMode('all');
        
        let lastScript = '';
        try {
            for (let i = 0; i < parsedEpisodes.length; i++) {
                // If stopped in between, break
                if (!globalIsGenerating && i > 0 && activeGeneratingIndex === null) {
                    // Check local state loop guard
                }
                lastScript = await generateScriptForEpisode(i, lastScript);
            }
        } catch (err: any) {
            if (err.message !== 'Aborted') {
                setError(err.message || '剧本生成过程中出现异常');
            }
        } finally {
            setGlobalIsGenerating(false);
            setActiveGeneratingIndex(null);
        }
    };

    // Save as Project to Database
    const handleSaveProject = async () => {
        if (!projectTitle.trim()) {
            alert('请输入剧本名称');
            return;
        }
        setSaving(true);
        setError('');
        
        try {
            // 1. Create or Update the project with scriptData archiving
            const description = outlineMode === 'existing' ? '已有故事分集生成' : `主题:${theme} | 元素:${elements.join(',')}`;
            const scriptData = {
                settings: {
                    format: 'live_action',
                    totalEpisodes: String(parsedEpisodes.length),
                    outputLanguage: 'zh',
                    model: model
                },
                planning: {
                    synopsis: outlineMode === 'existing' ? existingOutline : coreIdea,
                    characterSettings: '',
                    worldview: '',
                    outline: outlineRawText || '暂无大纲内容...'
                },
                episodes: parsedEpisodes,
                outlineMode: outlineMode
            };
            
            let projectId = currentProjectId;
            if (projectId) {
                // Update the existing project with the compiled outlines/scripts
                await updateProject(projectId, {
                    title: projectTitle,
                    description: description,
                    script_data: scriptData
                });
            } else {
                // Fallback: create a new one if not exists
                const { id: newId, error: createError } = await createProject(projectTitle, description, 'script_episode', null, scriptData);
                if (createError) throw createError;
                projectId = newId;
            }
            
            if (!projectId) throw new Error('创建或获取剧本项目失败');
            
            // 2. Save outlines and scripts into the chapter table
            for (let i = 0; i < parsedEpisodes.length; i++) {
                const ep = parsedEpisodes[i];
                const content = `【分集故事梗概】：\n${ep.outline}\n\n=====================================\n\n【本集正式剧本】：\n${ep.script || '（未生成该集剧本）'}`;
                await saveChapterToDB(projectId, `new-scene-${Date.now()}-${i}`, ep.title, content, i + 1);
            }
            
            setSuccessMessage('成功保存整本分集剧本至您的剧本项目列表！');
            setTimeout(() => {
                setSuccessMessage('');
                onSaveSuccess?.();
                onBack();
            }, 3000);
        } catch (err: any) {
            setError(err.message || '保存失败，请稍后重试');
        } finally {
            setSaving(false);
        }
    };

    const handleInitiateMode = (mode: 'existing' | 'new' | 'skill_master') => {
        if (currentProjectId) {
            setOutlineMode(mode);
            if (mode === 'existing') {
                setStage('outline_form_existing');
            } else if (mode === 'new') {
                setStage('outline_form_new');
            } else if (mode === 'skill_master') {
                setStage('skill_master_workspace');
            }
            return;
        }

        setPendingMode(mode);
        const timeStr = new Date().toLocaleDateString('zh-CN', {
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        }).replace(/\//g, '-').replace(/ /g, '_').replace(/:/g, '');
        
        if (mode === 'skill_master') {
            setNewProjectTitle(`新爆款出海短剧_${timeStr}`);
            setNewProjectDesc('基于编剧大师工作流的出海与合规微短剧项目');
        } else {
            setNewProjectTitle(`新爆款分集剧本_${timeStr}`);
            setNewProjectDesc('AI智能辅助规划的分集剧本创作项目');
        }
        setShowCreateProjectModal(true);
    };

    const handleStopSkillStep = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
        setSkillIsGenerating(false);
    };

    const handleRunSkillStep = async (stepNum: number) => {
        if (skillIsGenerating) return;
        setSkillIsGenerating(true);
        setError('');

        let prompt = '';
        if (stepNum === 1) {
            prompt = `【编剧大师 - 立项策划 /start】
你是一个专业的爆款短剧策划人，根据以下基本信息，为这部短剧进行全方位的立项策划。

主题（Topic）：${skillTopic}
目标受众（Audience）：${skillAudience}
剧本调性（Tone）：${skillTone}
核心卖点（Selling Points）：${skillSellingPoints}

请根据微短剧市场最火爆的爽点逻辑、节奏和卡点设计，输出一份包含以下板块的专业立项方案：
1. 【故事核心梗概（约300字，极具张力，写明隐藏身份与打脸反转）】
2. 【核心看点与黄金前三集爆点设计】
3. 【受众情感投射与共鸣点深度剖析】
4. 【商业化变现设计与黄金卡点（付费解锁点）预测】`;
        } else if (stepNum === 2) {
            prompt = `【编剧大师 - 创作方案 /plan】
你是一个金牌微短剧制作人。基于前一步的【立项策划方案】（参考以下）：
${skillStartOutput || `主题: ${skillTopic}，卖点: ${skillSellingPoints}`}

以及以下参数：
目标集数（Plan Episodes）：${skillPlanEpisodes} 集

请为这部短剧定制一份专业的【创作方案】，包括：
1. 【整体结构设计】：将 ${skillPlanEpisodes} 集划分为三大幕（如：1-15集起势与压迫，16-45集蓄势与对立，46-80集爆发与爽点清算），明确每一阶段的节奏变化。
2. 【爽点与期待感管理】：如何层层递进、钩子如何堆叠。
3. 【高潮段落预设】：在第15、30、50、70集左右的核心反转和付费高潮点剧情预设。`;
        } else if (stepNum === 3) {
            prompt = `【编剧大师 - 角色卡设定 /char】
你是一个顶尖的短剧人物塑造大师。基于以下基础角色设定：
主要角色（Main Character）：${skillMainChar}
对手/反派（Antagonist）：${skillAntagonist}

请深度扩写并设计一套专业的短剧角色卡：
1. 【主要角色】：
   - 表面身份 vs 隐藏真实马甲/尊贵背景
   - 性格弱点 vs 行动爽感
   - 核心欲望与成长轨迹
2. 【对手/反派】：
   - 伪装白莲花/嚣张程度、如何拉满观众仇恨
   - 核心阴谋、弱点以及最终自取灭亡的爽感看点
3. 【男女主角的羁绊/宿命感纠葛】`;
        } else if (stepNum === 4) {
            prompt = `【编剧大师 - 分集大纲生成 /outline】
基于前期的立项策划、创作方案和角色设定：
【立项策划】：${skillStartOutput}
【创作方案】：${skillPlanOutput}
【角色卡设定】：${skillCharOutput}

请全自动编织出这部短剧的前 10 集分集大纲（每集大约 100-150 字，紧扣核心矛盾、打脸爽感、快节奏并配有强烈的结尾钩子 Hook）：
格式要求：
【第X集：分集标题】
本集梗概：具体情节详细推演。`;
        } else if (stepNum === 5) {
            prompt = `【编剧大师 - 单集剧本生成 /episode】
你是一个殿堂级的爆款短剧编剧。请针对【第 ${skillEpisodeNum} 集】进行极其专业、高潮迭起的单集正式剧本创作。

参考全局策划与大纲：
${skillOutlineOutput || `主题: ${skillTopic}，马甲设定: ${skillSellingPoints}`}

剧本编写格式与排版规范（极其重要，请严格执行）：
1. 必须使用“△ ”（三角形加一个空格）来代表画面、场景、角色的无声眼神、心理动作或动作描写。
2. 必须使用“角色名字（神态动作）：台词内容”作为台词对白格式。
3. 单集时长约1.5分钟，台词必须犀利、情节极其紧凑、绝不拖泥带水，在这一集结尾设置一个极度震撼或引人入胜的戏剧卡点（Hook），逼着观众非看下一集不可。
4. 严禁任何开场白、解释性或总结性语言，只输出剧本正文内容。`;
        } else if (stepNum === 6) {
            prompt = `【编剧大师 - 剧本合规性审查 /compliance】
你是一个资深的微短剧内容总监和审查专家。请对当前【第 ${skillReviewNum} 集】的剧本内容进行全方位的合规性审查、低俗排查以及精彩度把关。

当前第 ${skillReviewNum} 集剧本内容：
${skillEpisodesStore[skillReviewNum] || "请先在第五步中生成该集剧本内容"}

审查准则：
1. 政治、法律、红线合规：是否有不良诱导、极端违规内容。
2. 内容价值观合规：排查极度扭曲价值观（如无底线宣扬金钱至上、家庭伦理彻底崩坏等）。
3. 爆点精彩度把关：打脸爽点是否到位？情感冲突是否充分激化？
4. 改写建议（提供合规重写示范）：提供不降低戏剧张力、同时完美规避审核红线的犀利改写方案。`;
        } else if (stepNum === 7) {
            prompt = `【编剧大师 - 剧本海外化改写与翻译 /overseas】
你是一个拥有全球视野的跨境短剧出海专家。请将当前【第 ${skillReviewNum} 集】的剧本进行精准的海外化翻译、本土化改写与剧设重构，使其完美契合海外受众（特别是欧美市场的 Billionaire, Alpha Wolf, Secret Heiress 题材喜好）。

当前第 ${skillReviewNum} 集剧本内容：
${skillEpisodesStore[skillReviewNum] || "请先在第五步中生成该集剧本内容"}

目标海外市场（Region）：${skillOverseasRegion}

请输出：
1. 【本土化人设与场景重构方案】（如：将豪门总裁改写为 Lycan King/Alpha Wolf 或 Tech Billionaire，将神医马甲重构等）
2. 【黄金对白英文本土化高质改写】（提供地道、富有戏剧张力和情绪饱满的英文台词，附带动作描写，保持剧本格式）`;
        } else if (stepNum === 8) {
            prompt = `【编剧大师 - 剧本导出与整合发布 /export】
请对当前项目（${projectTitle}）在编剧大师工作流中的全部策划及创作产出进行完美的排版与总结：

主题：${skillTopic}
集数：${skillPlanEpisodes} 集
立项策划：${skillStartOutput ? "已就绪" : "未生成"}
创作方案：${skillPlanOutput ? "已就绪" : "未生成"}
角色卡：${skillCharOutput ? "已就绪" : "未生成"}
分集大纲：${skillOutlineOutput ? "已就绪" : "未生成"}
已创作剧本数：${Object.keys(skillEpisodesStore).length} 集

请为用户输出一份极具仪式感、排版精美利落的【完整短剧立项发布白皮书】：
1. 独家剧本认证戳记、项目状态一览
2. 完整立项基本信息及核心人物、冲突卡牌图谱
3. 剧本全流程合规与出海评级报告
4. 面向投资人与制作团队的商业推介陈述（Pitch Deck Proposal）`;
        }

        const controller = new AbortController();
        abortControllerRef.current = controller;

        try {
            const stream = generateTextStream(prompt, {
                model,
                temperature: 0.75,
                topP: 0.95,
                maxOutputTokens: maxTokens,
                signal: controller.signal
            });

            let fullText = '';
            for await (const chunk of stream) {
                fullText += chunk;
                if (stepNum === 1) setSkillStartOutput(fullText);
                else if (stepNum === 2) setSkillPlanOutput(fullText);
                else if (stepNum === 3) setSkillCharOutput(fullText);
                else if (stepNum === 4) setSkillOutlineOutput(fullText);
                else if (stepNum === 5) {
                    setSkillEpisodesStore(prev => ({ ...prev, [skillEpisodeNum]: fullText }));
                }
                else if (stepNum === 6) {
                    setSkillComplianceStore(prev => ({ ...prev, [skillReviewNum]: fullText }));
                }
                else if (stepNum === 7) {
                    setSkillOverseasStore(prev => ({ ...prev, [skillReviewNum]: fullText }));
                }
                else if (stepNum === 8) setSkillExportOutput(fullText);
            }
        } catch (err: any) {
            if (err.name !== 'AbortError' && err.message !== 'Aborted') {
                setError(err.message || '生成失败，请重试');
            }
        } finally {
            setSkillIsGenerating(false);
            abortControllerRef.current = null;
        }
    };

    const handleConfirmCreateProject = async () => {
        if (!newProjectTitle.trim()) {
            alert('请输入剧本名称');
            return;
        }
        setCreatingProjectInDB(true);
        setError('');
        try {
            const initialScriptData = pendingMode === 'skill_master' ? { isSkillMaster: true } : {};
            const { id: projectId, error: createError } = await createProject(
                newProjectTitle,
                newProjectDesc || '分集剧本创作',
                'script_episode',
                null,
                initialScriptData
            );
            if (createError) throw createError;
            if (!projectId) throw new Error('创建剧本项目失败');
            
            setCurrentProjectId(projectId);
            setProjectTitle(newProjectTitle);
            setAiChatMessages([]); // Reset chat context for new project
            setSyncStatus('idle'); // Reset sync status
            
            if (pendingMode === 'existing') {
                setOutlineMode('existing');
                setStage('outline_form_existing');
            } else if (pendingMode === 'new') {
                setOutlineMode('new');
                setStage('outline_form_new');
            } else if (pendingMode === 'skill_master') {
                setOutlineMode('skill_master');
                setStage('skill_master_workspace');
                // Initial defaults for skill_master
                setSkillActiveStep(1);
                setSkillTopic('真假千金重回豪门');
                setSkillAudience('年轻都市女性');
                setSkillTone('极致反差、打脸爽剧');
                setSkillSellingPoints('真千金隐藏顶奢黑卡、神医马甲层层揭开');
                setSkillPlanEpisodes(80);
                setSkillMainChar('乔以安：真千金，神医圣手，隐世至尊');
                setSkillAntagonist('周婉清：假千金，白莲花，手段阴险');
                setSkillEpisodeNum(1);
                setSkillOverseasMode(false);
                setSkillReviewNum(1);
                setSkillOverseasRegion('北美市场 (Billionaire/Werewolf)');
                setSkillStartOutput('');
                setSkillPlanOutput('');
                setSkillCharOutput('');
                setSkillOutlineOutput('');
                setSkillEpisodesStore({});
                setSkillReviewsStore({});
                setSkillComplianceStore({});
                setSkillOverseasStore({});
                setSkillExportOutput('');
            } else {
                setOutlineMode(null);
                setStage('mode_select');
            }
            setShowCreateProjectModal(false);
        } catch (err: any) {
            setError(err.message || '新建剧本项目失败，请重试');
        } finally {
            setCreatingProjectInDB(false);
        }
    };

    // Helper options toggling
    const toggleElement = (el: string) => {
        setElements(prev => prev.includes(el) ? prev.filter(x => x !== el) : [...prev, el]);
    };

    const toggleStyle = (st: string) => {
        setStyleTags(prev => prev.includes(st) ? prev.filter(x => x !== st) : [...prev, st]);
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target?.result;
            if (typeof text === 'string') {
                setExistingOutline(text);
            }
        };
        reader.readAsText(file);
    };

    return (
        <div className="flex-1 flex flex-col h-full bg-gray-50 dark:bg-black/40 overflow-hidden font-sans">
            {/* Header */}
            <div className="flex-shrink-0 flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 z-10" style={{ height: '60px' }}>
                <div className="flex items-center gap-3">
                    <button onClick={handleHeaderBack} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-850 text-gray-500">
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h2 className="text-lg font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
                            <Sparkles className="w-5 h-5 text-sky-500" />
                            {projectTitle !== undefined && currentProjectId ? (
                                <div className="flex items-center gap-1">
                                    <span className="text-gray-400 text-xs font-normal">分集剧本:</span>
                                    <input 
                                        type="text" 
                                        value={projectTitle} 
                                        onChange={e => setProjectTitle(e.target.value)}
                                        className="bg-transparent border-b border-transparent hover:border-gray-300 focus:border-indigo-500 focus:outline-none text-sm font-extrabold text-gray-900 dark:text-white transition-all px-1 py-0.5 w-[240px] sm:w-[320px] truncate"
                                        title="点击可直接修改项目名称"
                                        placeholder="未命名项目"
                                    />
                                </div>
                            ) : (
                                <span className="text-base font-extrabold text-gray-900 dark:text-white">分集剧本生成</span>
                            )}
                        </h2>
                        <p className="text-[10px] text-gray-400 mt-0.5">智能规划分集故事，一键演进完整剧本创作</p>
                    </div>
                </div>
                
                <div className="flex items-center gap-3">
                    {/* Cloud auto-sync status display inside top-right header */}
                    {currentProjectId && (stage === 'script_generation' || stage === 'outline_results') && (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-50 dark:bg-gray-800 text-[11px] font-bold border border-gray-150 dark:border-gray-700 shadow-sm">
                            {syncStatus === 'syncing' ? (
                                <>
                                    <div className="w-3 h-3 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                                    <span className="text-indigo-600 dark:text-indigo-400">云端同步中...</span>
                                </>
                            ) : syncStatus === 'success' ? (
                                <>
                                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                                    <span className="text-emerald-600 dark:text-emerald-400">已自动同步到云端</span>
                                </>
                            ) : syncStatus === 'error' ? (
                                <>
                                    <X className="w-3.5 h-3.5 text-rose-500" />
                                    <span className="text-rose-600 dark:text-rose-400">同步失败</span>
                                </>
                            ) : (
                                <>
                                    <Check className="w-3.5 h-3.5 text-gray-400" />
                                    <span className="text-gray-500 dark:text-gray-400">云端已同步</span>
                                </>
                            )}
                        </div>
                    )}

                    {stage === 'outline_results' && (
                        <button 
                            onClick={() => {
                                setOutlineRawText('');
                                setParsedEpisodes([]);
                                setOutlineMode(null);
                                setStage('mode_select');
                            }}
                            className="px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-50"
                        >
                            重新配置
                        </button>
                    )}
                </div>
            </div>

            {/* Error alerts */}
            {error && (
                <div className="p-4 bg-rose-50 text-rose-600 dark:bg-rose-950/25 dark:text-rose-400 border-b border-rose-100 flex items-center gap-2 text-sm">
                    <InformationCircle className="w-5 h-5" />
                    <span className="font-semibold">{error}</span>
                </div>
            )}

            {/* Stage content */}
            <div className="flex-grow flex overflow-hidden relative">
                {/* 0. Project Dashboard Stage */}
                {stage === 'project_dashboard' && (
                    <div className="flex-1 overflow-y-auto p-6 sm:p-8 max-w-6xl mx-auto space-y-8 animate-fade-in w-full">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-100 dark:border-gray-800 pb-5">
                            <div className="space-y-1">
                                <h3 className="text-2xl font-extrabold text-gray-950 dark:text-white flex items-center gap-2">
                                    <Database className="w-6 h-6 text-sky-500" />
                                    分集剧本项目库
                                </h3>
                                <p className="text-xs text-gray-405 dark:text-gray-500">
                                    独立存储您的所有分集大纲及全套剧本，支持对每一集内容的永久保存和针对性润色
                                </p>
                            </div>
                            <button
                                onClick={() => handleInitiateMode('new')}
                                className="px-5 py-2.5 bg-gradient-to-r from-sky-600 to-indigo-600 hover:opacity-95 text-white font-extrabold rounded-xl text-xs shadow-md transition-all active:scale-95 flex items-center gap-2 shrink-0"
                            >
                                <Plus className="w-4 h-4" /> 新建分集剧本项目
                            </button>
                        </div>

                        {loadingProjects ? (
                            <div className="flex flex-col items-center justify-center py-20 space-y-3">
                                <div className="w-10 h-10 border-4 border-sky-500 border-t-transparent rounded-full animate-spin" />
                                <span className="text-xs text-gray-400 dark:text-gray-500 font-medium">正在读取分集剧本项目库...</span>
                            </div>
                        ) : episodeProjects.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 px-4 text-center bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-sm space-y-5">
                                <div className="w-16 h-16 bg-sky-50 dark:bg-sky-950 rounded-full flex items-center justify-center text-sky-500">
                                    <Film className="w-8 h-8" />
                                </div>
                                <div className="space-y-1.5 max-w-md">
                                    <h4 className="font-bold text-gray-900 dark:text-white text-base">暂无分集剧本项目</h4>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                                        在这里，所有的生成剧本都将保存在独立项目中。点击下方按钮立即创建您的第一个分集剧本项目吧！
                                    </p>
                                </div>
                                <button
                                    onClick={() => handleInitiateMode('new')}
                                    className="px-5 py-2.5 bg-sky-500 hover:bg-sky-550 text-white font-bold rounded-xl text-xs shadow-md transition-all"
                                >
                                    创建第一个剧本
                                </button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {/* Create New Card Button */}
                                <div 
                                    onClick={() => handleInitiateMode('new')}
                                    className="group p-6 bg-white dark:bg-gray-900 border-2 border-dashed border-gray-200 dark:border-gray-800 hover:border-sky-500 dark:hover:border-sky-500 rounded-2xl flex flex-col justify-center items-center text-center cursor-pointer transition-all hover:shadow-md h-[180px]"
                                >
                                    <div className="w-12 h-12 bg-sky-50 dark:bg-sky-950/50 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                                        <Plus className="w-6 h-6 text-sky-500" />
                                    </div>
                                    <span className="font-extrabold text-sm text-gray-900 dark:text-white">创建新剧本</span>
                                    <span className="text-[11px] text-gray-400 mt-1 max-w-[200px]">
                                        自定义大纲及集数，生成各集正文
                                    </span>
                                </div>

                                {/* Project Cards */}
                                {episodeProjects.map((proj) => {
                                    const totalEpisodes = proj.script_data?.episodes?.length || proj.script_data?.settings?.totalEpisodes || 0;
                                    const hasScripts = proj.script_data?.episodes?.some((ep: any) => ep.script && ep.script.trim().length > 0);
                                    
                                    return (
                                        <div 
                                            key={proj.id}
                                            onClick={() => handleSelectProject(proj)}
                                            className="group relative p-6 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl hover:shadow-md transition-all cursor-pointer flex flex-col justify-between h-[180px]"
                                        >
                                            <div className="space-y-1.5">
                                                <div className="flex items-start justify-between gap-2">
                                                    <h4 className="font-extrabold text-sm text-gray-900 dark:text-white group-hover:text-sky-500 dark:group-hover:text-sky-400 transition-colors line-clamp-1">
                                                        {proj.title}
                                                    </h4>
                                                    <button 
                                                        onClick={(e) => handleDeleteProjectClick(proj, e)}
                                                        className="p-1 text-gray-400 hover:text-rose-500 rounded transition-colors"
                                                        title="删除项目"
                                                    >
                                                        <Trash className="w-4 h-4" />
                                                    </button>
                                                </div>
                                                <p className="text-[11px] text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed">
                                                    {proj.description || '无项目描述'}
                                                </p>
                                            </div>

                                            <div className="flex items-center justify-between border-t border-gray-50 dark:border-gray-800 pt-3 mt-3">
                                                <div className="flex items-center gap-2">
                                                    {totalEpisodes > 0 ? (
                                                        <span className="px-2 py-0.5 bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 rounded-md text-[10px] font-black">
                                                            {totalEpisodes} 集大纲
                                                        </span>
                                                    ) : (
                                                        <span className="px-2 py-0.5 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded-md text-[10px] font-black">
                                                            未配置大纲
                                                        </span>
                                                    )}
                                                    {hasScripts && (
                                                        <span className="px-2 py-0.5 bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 rounded-md text-[10px] font-black">
                                                            剧本已生成
                                                        </span>
                                                    )}
                                                </div>
                                                <span className="text-[10px] text-gray-400">
                                                    {new Date(proj.created_at).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* 1. Mode Select Stage */}
                {stage === 'mode_select' && (
                    <div className="flex-1 flex flex-col justify-center items-center p-8 max-w-5xl mx-auto space-y-8 animate-fade-in">
                        <div className="text-center space-y-2">
                            <h3 className="text-2xl font-bold text-gray-800 dark:text-white">您如何开始分集剧本创作？</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400">选择符合您当前素材状态的模式，AI将精准承接上下文为您拆分各集大纲</p>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full">
                            <button 
                                onClick={() => handleInitiateMode('existing')}
                                className="group p-6 bg-white dark:bg-gray-900 rounded-2xl border-2 border-gray-100 dark:border-gray-800 hover:border-sky-500 dark:hover:border-sky-500 transition-all hover:shadow-lg text-center flex flex-col items-center"
                            >
                                <div className="w-14 h-14 bg-sky-50 dark:bg-sky-950 rounded-full flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                                    <ClipboardDocumentCheck className="w-7 h-7 text-sky-500" />
                                </div>
                                <h4 className="text-base font-bold text-gray-900 dark:text-white mb-2">已有故事梗概</h4>
                                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                                    上传或粘贴您自创的小说/梗概，指定您想要的集数，AI将精确将其拆分为高节奏的分集剧情大纲。
                                </p>
                            </button>

                            <button 
                                onClick={() => handleInitiateMode('new')}
                                className="group p-6 bg-white dark:bg-gray-900 rounded-2xl border-2 border-gray-100 dark:border-gray-800 hover:border-purple-500 dark:hover:border-purple-500 transition-all hover:shadow-lg text-center flex flex-col items-center"
                            >
                                <div className="w-14 h-14 bg-purple-50 dark:bg-purple-950 rounded-full flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                                    <Sparkles className="w-7 h-7 text-purple-500" />
                                </div>
                                <h4 className="text-base font-bold text-gray-900 dark:text-white mb-2">生成故事梗概</h4>
                                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                                    没有现成故事？勾选您喜爱的短剧风格、爆点元素、核心创意脑洞，让AI大模型全自动编织出整套微短剧分集大纲。
                                </p>
                            </button>

                            <button 
                                onClick={() => handleInitiateMode('skill_master')}
                                className="group p-6 bg-white dark:bg-gray-900 rounded-2xl border-2 border-gray-100 dark:border-gray-800 hover:border-sky-500 dark:hover:border-sky-500 transition-all hover:shadow-lg text-center flex flex-col items-center"
                            >
                                <div className="w-14 h-14 bg-sky-50 dark:bg-sky-950 rounded-full flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                                    <Film className="w-7 h-7 text-sky-500" />
                                </div>
                                <h4 className="text-base font-bold text-gray-900 dark:text-white mb-2">编剧大师</h4>
                                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                                    爆款微短剧黄金开发规范。包含立项、创作方案、角色卡、分集大纲、单集剧本、合规审查与海外化。
                                </p>
                            </button>
                        </div>
                    </div>
                )}

                {/* 2. Existing Outline Config Screen */}
                {stage === 'outline_form_existing' && (
                    <div className="flex-1 flex overflow-hidden">
                        {/* Configuration parameters Left side */}
                        <div className="w-full lg:w-[420px] flex flex-col bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 overflow-y-auto p-6 space-y-6">
                            <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-1.5 border-b pb-3">
                                <AdjustmentsHorizontal className="w-5 h-5 text-sky-500" />
                                拆分参数设定
                            </h3>

                            {/* Episodes */}
                            <div className="space-y-2">
                                <label className="block text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider">预期生成短剧总集数</label>
                                <div className="flex items-center gap-2">
                                    <input 
                                        type="number" 
                                        value={episodesCount} 
                                        onChange={e => setEpisodesCount(Math.max(1, parseInt(e.target.value) || 10))}
                                        className="flex-1 p-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800 outline-none text-sm font-bold text-gray-900 dark:text-white"
                                    />
                                    <span className="text-sm font-semibold text-gray-500">集</span>
                                </div>
                                <div className="flex gap-1.5 flex-wrap">
                                    {[5, 10, 20, 50, 80].map(n => (
                                        <button 
                                            key={n} 
                                            onClick={() => setEpisodesCount(n)}
                                            className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors ${episodesCount === n ? 'bg-sky-500 text-white' : 'bg-gray-100 dark:bg-gray-850 hover:bg-gray-250 text-gray-600 dark:text-gray-300'}`}
                                        >
                                            {n}集
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Model config */}
                            <div className="space-y-3">
                                <label className="block text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider">创作大模型选择</label>
                                <CustomSelect value={model} onChange={setModel} options={MODEL_OPTIONS} />
                                
                                <div className="space-y-1.5 pt-2">
                                    <div className="flex justify-between text-[11px] font-bold text-gray-400">
                                        <span>随机度 (Temp): {temperature}</span>
                                    </div>
                                    <input 
                                        type="range" min="0" max="1.5" step="0.05" 
                                        value={temperature} onChange={e => setTemperature(parseFloat(e.target.value))}
                                        className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-sky-500"
                                    />
                                </div>
                            </div>

                            <button 
                                onClick={handleGenerateOutline}
                                disabled={!existingOutline.trim()}
                                className="w-full py-3.5 bg-sky-600 hover:bg-sky-505 text-white font-bold rounded-xl shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 disabled:bg-gray-300 disabled:shadow-none"
                            >
                                <Sparkles className="w-5 h-5" /> 智能拆分故事分集大纲
                            </button>
                        </div>

                        {/* Interactive Outline Input Right side */}
                        <div className="flex-grow flex flex-col p-8 overflow-hidden bg-gray-50/50 dark:bg-gray-950/20">
                            <div className="flex-1 bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-2xl p-6 flex flex-col space-y-4 shadow-sm" style={{ height: '600px' }}>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <DocumentPlus className="text-sky-500" style={{ width: '35px', height: '35px' }} />
                                        <h4 className="text-sm font-bold text-gray-800 dark:text-white">请录入您已有的原始梗概或故事设定</h4>
                                    </div>
                                    <label className="cursor-pointer px-3 py-1.5 text-xs font-bold bg-sky-50 hover:bg-sky-100 text-sky-600 rounded-lg border border-sky-100 transition-colors">
                                        上传文本文件
                                        <input type="file" accept=".txt,.md,.doc" onChange={handleFileUpload} className="hidden" />
                                    </label>
                                </div>

                                <textarea 
                                    value={existingOutline} 
                                    onChange={e => setExistingOutline(e.target.value)}
                                    placeholder="请在这里贴入您的完整故事梗概、小说内容简介或者是剧本的前期大纲描述..."
                                    className="flex-grow w-full p-4 bg-gray-50/50 dark:bg-gray-800 border border-gray-150 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-sky-500 outline-none text-sm resize-none"
                                    style={{ height: '500px' }}
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* 3. New Outline Generation Config Screen */}
                {stage === 'outline_form_new' && (
                    <div className="flex-1 flex overflow-hidden">
                        {/* Left Configuration */}
                        <div className="w-full lg:w-[440px] flex flex-col bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 overflow-y-auto p-6 space-y-6">
                            <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-1.5 border-b pb-3">
                                <AdjustmentsHorizontal className="w-5 h-5 text-purple-500" />
                                短剧生成高级设定
                            </h3>

                            {/* Prompt Card Selection */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <label className="block text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider">选择提示词卡片</label>
                                    <button
                                        onClick={() => setIsPromptModalOpen(true)}
                                        className="text-xs text-purple-600 hover:text-purple-700 font-bold flex items-center gap-1"
                                    >
                                        <Sparkles className="w-3.5 h-3.5" /> 提示词库
                                    </button>
                                </div>

                                <div className="space-y-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                                    {promptCardsList.slice(0, 6).map((card) => {
                                        const isSelected = selectedPromptCard?.id === card.id;
                                        return (
                                            <div
                                                key={card.id}
                                                onClick={() => {
                                                    setSelectedPromptCard(card);
                                                    setPromptFormValues({});
                                                }}
                                                className={`p-3 border rounded-xl cursor-pointer transition-all ${isSelected ? 'bg-purple-50/70 border-purple-500 dark:bg-purple-950/30' : 'bg-white dark:bg-gray-900 border-gray-150 dark:border-gray-800 hover:border-purple-300'}`}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs font-bold text-gray-800 dark:text-white line-clamp-1">{card.title}</span>
                                                    {isSelected && <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse shrink-0" />}
                                                </div>
                                                <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1 line-clamp-2 leading-relaxed">{card.description}</p>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Dynamic Form based on Selected Prompt Card */}
                            {selectedPromptCard && (
                                <div className="space-y-3 p-3.5 bg-purple-50/40 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/40 rounded-2xl">
                                    <div className="flex items-center justify-between border-b border-purple-100 dark:border-purple-900/40 pb-2">
                                        <span className="text-xs font-bold text-purple-800 dark:text-purple-300 flex items-center gap-1.5">
                                            <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                                            提示词表单 ({selectedPromptCard.title})
                                        </span>
                                    </div>

                                    {selectedPromptCard.fields && selectedPromptCard.fields.length > 0 ? (
                                        <div className="space-y-2.5">
                                            {selectedPromptCard.fields.map((field) => (
                                                <div key={field.id} className="space-y-1">
                                                    <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300">
                                                        {field.label} {field.required && <span className="text-rose-500">*</span>}
                                                    </label>
                                                    {field.type === 'textarea' ? (
                                                        <textarea
                                                            value={promptFormValues[field.id] || ''}
                                                            onChange={(e) => setPromptFormValues({ ...promptFormValues, [field.id]: e.target.value })}
                                                            placeholder={field.placeholder || `请输入${field.label}...`}
                                                            rows={2}
                                                            className="w-full p-2.5 text-xs border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-xl outline-none focus:ring-1 focus:ring-purple-500 text-gray-900 dark:text-white"
                                                        />
                                                    ) : (
                                                        <input
                                                            type="text"
                                                            value={promptFormValues[field.id] || ''}
                                                            onChange={(e) => setPromptFormValues({ ...promptFormValues, [field.id]: e.target.value })}
                                                            placeholder={field.placeholder || `请输入${field.label}...`}
                                                            className="w-full p-2.5 text-xs border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-xl outline-none focus:ring-1 focus:ring-purple-500 text-gray-900 dark:text-white"
                                                        />
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="space-y-1">
                                            <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300">
                                                剧情核心/故事雏形 (选填)
                                            </label>
                                            <textarea
                                                value={coreIdea}
                                                onChange={(e) => setCoreIdea(e.target.value)}
                                                placeholder="请输入主角身份、核心冲突、打脸反转或故事核心梗..."
                                                rows={3}
                                                className="w-full p-2.5 text-xs border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-xl outline-none focus:ring-1 focus:ring-purple-500 text-gray-900 dark:text-white"
                                            />
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Era option (Optional) */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <label className="block text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider">时代背景 (单选 - 选填)</label>
                                    {selectedEra && (
                                        <button onClick={() => setSelectedEra('')} className="text-[10px] text-gray-400 hover:text-gray-600">清除选择</button>
                                    )}
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    {ERA_OPTIONS.map(opt => (
                                        <button 
                                            key={opt}
                                            onClick={() => setSelectedEra(selectedEra === opt ? '' : opt)}
                                            className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${selectedEra === opt ? 'bg-purple-50 text-purple-600 border-purple-300 dark:bg-purple-950/40 dark:text-purple-400' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-purple-200'}`}
                                        >
                                            {opt}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Theme plot option (Optional) */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <label className="block text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider">主题情节 (标签 - 可多选 - 选填)</label>
                                    {selectedThemePlots.length > 0 && (
                                        <button onClick={() => setSelectedThemePlots([])} className="text-[10px] text-gray-400 hover:text-gray-600">清空</button>
                                    )}
                                </div>
                                <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-2 border border-gray-150 dark:border-gray-800 rounded-xl bg-gray-50/50 dark:bg-gray-950/20 custom-scrollbar">
                                    {THEME_PLOT_OPTIONS.map(opt => {
                                        const isSelected = selectedThemePlots.includes(opt);
                                        return (
                                            <button 
                                                key={opt}
                                                onClick={() => {
                                                    if (isSelected) {
                                                        setSelectedThemePlots(selectedThemePlots.filter(x => x !== opt));
                                                    } else {
                                                        setSelectedThemePlots([...selectedThemePlots, opt]);
                                                    }
                                                }}
                                                className={`px-2.5 py-1 text-[11px] font-medium rounded-lg border transition-all ${isSelected ? 'bg-purple-600 text-white border-transparent' : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-750 hover:border-purple-300'}`}
                                            >
                                                {opt}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Character Settings option (Optional) */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <label className="block text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider">角色设定 (标签 - 可多选 - 选填)</label>
                                    {selectedCharacters.length > 0 && (
                                        <button onClick={() => setSelectedCharacters([])} className="text-[10px] text-gray-400 hover:text-gray-600">清空</button>
                                    )}
                                </div>
                                <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-2 border border-gray-150 dark:border-gray-800 rounded-xl bg-gray-50/50 dark:bg-gray-950/20 custom-scrollbar">
                                    {CHARACTER_TAG_OPTIONS.map(opt => {
                                        const isSelected = selectedCharacters.includes(opt);
                                        return (
                                            <button 
                                                key={opt}
                                                onClick={() => {
                                                    if (isSelected) {
                                                        setSelectedCharacters(selectedCharacters.filter(x => x !== opt));
                                                    } else {
                                                        setSelectedCharacters([...selectedCharacters, opt]);
                                                    }
                                                }}
                                                className={`px-2.5 py-1 text-[11px] font-medium rounded-lg border transition-all ${isSelected ? 'bg-purple-600 text-white border-transparent' : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-750 hover:border-purple-300'}`}
                                            >
                                                {opt}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Core Trope (Optional) */}
                            <div className="space-y-2">
                                <label className="block text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider">核心梗 (选填)</label>
                                <input 
                                    type="text" 
                                    value={coreTrope} 
                                    onChange={e => setCoreTrope(e.target.value)}
                                    placeholder="例如：逆袭打脸、真假千金身份揭秘..."
                                    className="w-full p-2.5 text-xs border border-gray-150 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 rounded-lg outline-none text-gray-900 dark:text-white"
                                />
                            </div>

                            {/* Episodes Count */}
                            <div className="space-y-2">
                                <label className="block text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider">微短剧计划集数</label>
                                <div className="flex items-center gap-2">
                                    <input 
                                        type="number" 
                                        value={episodesCount} 
                                        onChange={e => setEpisodesCount(Math.max(1, parseInt(e.target.value) || 10))}
                                        className="flex-grow p-2.5 text-xs font-bold border border-gray-150 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 rounded-xl outline-none focus:bg-white text-gray-900 dark:text-white"
                                    />
                                    <span className="text-xs text-gray-500 font-bold">集</span>
                                </div>
                            </div>

                            {/* Model selection */}
                            <div className="space-y-2">
                                <label className="block text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider">AI 模型选择</label>
                                <CustomSelect value={model} onChange={setModel} options={MODEL_OPTIONS} />
                            </div>

                            <button 
                                onClick={handleGenerateOutline}
                                disabled={globalIsGenerating}
                                className="w-full py-3.5 bg-purple-600 hover:bg-purple-550 text-white font-bold rounded-xl shadow-lg hover:shadow-purple-500/20 transition-all active:scale-95 disabled:bg-gray-300 disabled:shadow-none flex items-center justify-center gap-2"
                            >
                                {globalIsGenerating ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        <span>AI 正在生成分集大纲...</span>
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="w-5 h-5" /> 智能一键生成微短剧剧本大纲
                                    </>
                                )}
                            </button>
                        </div>

                        {/* Right Output: Overall Episode Outline */}
                        <div className="flex-grow flex flex-col p-6 overflow-hidden bg-gray-50/50 dark:bg-gray-950/20">
                            <div className="flex-1 bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-2xl p-6 flex flex-col space-y-4 shadow-sm animate-fade-in min-h-0">
                                <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800 shrink-0">
                                    <div className="flex items-center gap-2">
                                        <Sparkles className="w-5 h-5 text-purple-500 animate-pulse" />
                                        <h4 className="text-sm font-bold text-gray-800 dark:text-white">输出整体的分集大纲</h4>
                                    </div>
                                    {globalIsGenerating && (
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-purple-600 font-medium animate-pulse flex items-center gap-1.5">
                                                <div className="w-3 h-3 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
                                                正在生成分集大纲...
                                            </span>
                                            <button onClick={handleStop} className="px-2.5 py-1 bg-rose-50 text-rose-600 text-xs font-bold rounded-lg hover:bg-rose-100 transition-colors flex items-center gap-1">
                                                <Stop className="w-3 h-3" /> 停止
                                            </button>
                                        </div>
                                    )}
                                </div>

                                <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 bg-gray-50/50 dark:bg-gray-950/50 rounded-xl border border-gray-150 dark:border-gray-800 text-xs font-mono leading-relaxed text-gray-800 dark:text-gray-200 custom-scrollbar [scrollbar-gutter:stable]">
                                    {outlineRawText ? (
                                        <div className="whitespace-pre-wrap">{outlineRawText}</div>
                                    ) : (
                                        <div className="h-full flex flex-col items-center justify-center text-center p-8 text-gray-400 space-y-3">
                                            <Film className="w-10 h-10 text-gray-300 dark:text-gray-700" />
                                            <p className="text-xs max-w-sm">
                                                在左侧选择提示词卡片并配置填报表单（时代背景、主题情节、角色设定选填），点击「智能一键生成微短剧剧本大纲」，整体分集大纲将在此处实时输出展示。
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {outlineRawText && !globalIsGenerating && (
                                    <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100 dark:border-gray-800 shrink-0">
                                        <button
                                            onClick={handleGenerateOutline}
                                            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5"
                                        >
                                            <ArrowPath className="w-4 h-4" /> 重新生成
                                        </button>
                                        <button
                                            onClick={() => {
                                                const finalEpisodes = parseOutlines(outlineRawText, episodesCount);
                                                setParsedEpisodes(finalEpisodes);
                                                setStage('outline_results');
                                            }}
                                            className="px-5 py-2 bg-purple-600 hover:bg-purple-550 text-white text-xs font-bold rounded-xl shadow-md transition-all active:scale-95 flex items-center gap-1.5"
                                        >
                                            进行下一步 <Play className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* 4. AI Generating Episode Outlines Screen */}
                {stage === 'outline_generating' && (
                    <div className="flex-1 w-full h-full flex flex-col p-8 overflow-hidden bg-white dark:bg-gray-950/20">
                        <div className="flex-1 min-h-0 border border-gray-150 dark:border-gray-800 rounded-2xl p-6 flex flex-col bg-white dark:bg-gray-900 shadow-lg relative">
                            {/* Running Loader */}
                            <div className="flex-shrink-0 flex items-center justify-between pb-4 border-b">
                                <div className="flex items-center gap-3">
                                    <div className="w-3.5 h-3.5 border-2 border-sky-600 border-t-transparent rounded-full animate-spin" />
                                    <span className="text-sm font-black text-sky-600 animate-pulse">AI 导演正在深度撰写各集分集大纲（每集1分半时长设定）...</span>
                                </div>
                                <button onClick={handleStop} className="px-3.5 py-1.5 bg-rose-50 text-rose-600 text-xs font-bold rounded-lg hover:bg-rose-100 transition-colors flex items-center gap-1.5">
                                    <Stop className="w-3.5 h-3.5" /> 停止输出
                                </button>
                            </div>

                            {/* Scrolling output window */}
                            <div ref={scrollRef} className="flex-1 h-0 min-h-0 overflow-y-auto py-6 px-4 custom-scrollbar bg-gray-50 dark:bg-black rounded-xl border border-gray-100 dark:border-gray-900 mt-4 [scrollbar-gutter:stable]">
                                <div className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-gray-800 dark:text-gray-200">
                                    {outlineRawText || '正在唤醒创作大模型，智能计算故事最佳矛盾冲突和起伏节奏...'}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                {stage === 'outline_results' && (
                    <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-gray-50/50 dark:bg-black/5">
                        {/* Left Side: Generated Episode Outlines */}
                        <div className="w-full md:w-1/2 flex flex-col bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 overflow-hidden">
                            <div className="flex-shrink-0 p-4 border-b bg-gray-50/50 dark:bg-gray-950/25 flex items-center justify-between" style={{ height: '55px' }}>
                                <div className="flex items-center gap-2">
                                    <ClipboardDocumentCheck className="text-sky-500" style={{ width: '35px', height: '35px' }} />
                                    <h3 className="font-bold text-sm text-gray-800 dark:text-white">第一步：确认及修改分集梗概</h3>
                                </div>
                                <span className="text-xs bg-sky-50 dark:bg-sky-950 text-sky-600 dark:text-sky-300 px-2.5 py-1 rounded-full font-bold">
                                    共 {parsedEpisodes.length} 集
                                </span>
                            </div>

                            {/* List of generated episodes outlines */}
                            <div className="flex-1 overflow-y-auto p-4 space-y-3.5 [scrollbar-gutter:stable]">
                                <div className="p-3 bg-sky-50/60 dark:bg-sky-950/20 text-sky-700 dark:text-sky-300 text-xs font-medium rounded-xl border border-sky-100 dark:border-sky-900/40 leading-relaxed">
                                    💡 提示：您可以点击任意单集的“编辑”按钮手动调整大纲内容，或在右侧“AI 导演协同优化室”中用白话文命令 AI 自动重构、扩写全剧剧情。
                                </div>

                                {parsedEpisodes.map((ep, idx) => (
                                    <div key={idx} className="p-4 border border-gray-150 dark:border-gray-800 rounded-xl bg-white dark:bg-gray-850 shadow-sm space-y-2.5 hover:border-sky-300 transition-colors">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <span className="w-5.5 h-5.5 rounded-full bg-sky-500 text-white text-xs font-bold flex items-center justify-center">
                                                    {ep.episodeNumber}
                                                </span>
                                                <span className="font-bold text-sm text-gray-800 dark:text-white">
                                                    {ep.title || `第${ep.episodeNumber}集`}
                                                </span>
                                            </div>
                                            <button 
                                                onClick={() => openEditModal(idx)}
                                                className="px-2.5 py-1 text-xs font-bold text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/50 hover:bg-sky-100 dark:hover:bg-sky-900/30 rounded-lg transition-colors flex items-center gap-1"
                                            >
                                                <Pencil className="w-3.5 h-3.5" /> 修改大纲
                                            </button>
                                        </div>

                                        <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-wrap pl-7">
                                            {ep.outline || '暂无大纲内容...'}
                                        </p>
                                    </div>
                                ))}
                            </div>

                            {/* Proceed to Next Step Bar */}
                            <div className="p-4 border-t bg-gray-50 dark:bg-gray-900/50 flex justify-between items-center gap-3">
                                <button 
                                    onClick={() => {
                                        setOutlineRawText('');
                                        setParsedEpisodes([]);
                                        setOutlineMode(null);
                                        setStage('mode_select');
                                    }}
                                    className="px-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-150/50 dark:hover:bg-gray-800"
                                    style={{ borderColor: '#b0c6f4', backgroundColor: '#4aa9ef', color: '#f8f9fb' }}
                                >
                                    返回重设
                                </button>
                                <button 
                                    onClick={() => setStage('script_generation')}
                                    className="flex-1 py-2.5 bg-sky-600 hover:bg-sky-550 text-white font-bold rounded-xl shadow-md flex items-center justify-center gap-2 text-xs transition-transform active:scale-98"
                                >
                                    确认大纲无误，进入下一步：剧本生成 <ArrowPath className="w-4 h-4 animate-pulse" />
                                </button>
                            </div>
                        </div>

                        {/* Right Side: AI Collaborative Chat Panel */}
                        <div className="w-full md:w-1/2 flex flex-col bg-gray-50/50 dark:bg-black/10 overflow-hidden">
                            <div className="flex-shrink-0 p-4 border-b bg-white dark:bg-gray-900 flex flex-col sm:flex-row sm:items-center justify-between gap-2" style={{ height: '55px' }}>
                                <div className="flex items-center gap-2" style={{ height: '50px' }}>
                                    <Sparkles className="text-purple-500" style={{ height: '50px', width: '50px' }} />
                                    <h3 className="font-bold text-sm text-gray-800 dark:text-white" style={{ width: '150px' }}>AI 导演协同优化室</h3>
                                </div>
                                <div className="flex items-center gap-2" style={{ width: '280px' }}>
                                    <div className="w-36" style={{ height: '50px' }}>
                                        <CustomSelect value={model} onChange={setModel} options={MODEL_OPTIONS} style={{ height: '20px' }} />
                                    </div>
                                    <span className="text-[10px] text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950 font-extrabold px-2 py-1 rounded border border-purple-100 dark:border-purple-900/40 animate-pulse" style={{ width: '120px', height: '30px' }}>
                                        全剧大纲联动修改
                                    </span>
                                </div>
                            </div>

                            {/* Chat Messages */}
                            <div ref={aiChatScrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                                {aiChatMessages.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-full text-center p-6 space-y-3">
                                        <div className="w-12 h-12 bg-purple-50 dark:bg-purple-950 rounded-full flex items-center justify-center">
                                            <Sparkles className="w-6 h-6 text-purple-500" />
                                        </div>
                                        <div>
                                            <h4 className="text-xs font-bold text-gray-700 dark:text-gray-300">还没有协同对话</h4>
                                            <p className="text-[11px] text-gray-400 mt-1 max-w-xs leading-relaxed">
                                                在下方输入修改口令（例如“增加反派的打脸戏份”、“让第5集结尾的悬念更揪心”、“整体节奏再加快一些”），AI 导演将全剧重构并一键应用修改。
                                            </p>
                                        </div>

                                        {/* Quick Commands */}
                                        <div className="flex flex-wrap justify-center gap-2 pt-2 max-w-sm">
                                            {[
                                                '让开头第1、2集悬念拉满，增加反转钩子',
                                                '整体节奏加快，加强爽点和打脸力度',
                                                '让大结局第10集有更温情的大团圆收尾'
                                            ].map((cmd, i) => (
                                                <button 
                                                    key={i}
                                                    onClick={() => handleAIChatSend(cmd)}
                                                    className="px-2.5 py-1 text-[10px] font-medium bg-white dark:bg-gray-850 hover:bg-gray-50 text-gray-600 dark:text-gray-300 rounded-lg border border-gray-150 dark:border-gray-800 transition-all text-left max-w-xs truncate"
                                                >
                                                    ✨ {cmd}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    aiChatMessages.map((msg, i) => (
                                        <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                                            <span className="text-[10px] font-semibold text-gray-400 mb-1 pl-1 pr-1">
                                                {msg.role === 'user' ? '我' : 'AI 导演大咖'}
                                            </span>
                                            <div className={`p-3 rounded-2xl max-w-[90%] text-xs leading-relaxed ${
                                                msg.role === 'user' 
                                                    ? 'bg-sky-600 text-white rounded-tr-none' 
                                                    : 'bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-tl-none text-gray-800 dark:text-gray-200 shadow-sm'
                                            }`}>
                                                <div className="whitespace-pre-wrap">
                                                    {msg.role === 'user' ? (
                                                        msg.content
                                                    ) : (
                                                        (() => {
                                                            const jsonRegex = /```json[\s\S]*?```|```json[\s\S]*|\[\s*\{[\s\S]*/;
                                                            const textPart = msg.content.replace(jsonRegex, '').trim();
                                                            return textPart || (aiIsGenerating && i === aiChatMessages.length - 1 ? 'AI 导演正在思考规划...' : '');
                                                        })()
                                                    )}
                                                </div>

                                                {/* Reader-friendly rendering of structured outlines (even while streaming!) */}
                                                {msg.role === 'assistant' && (() => {
                                                    let jsonText = '';
                                                    const jsonRegex = /```json\s*([\s\S]*?)\s*(```|$)/;
                                                    const match = msg.content.match(jsonRegex);
                                                    if (match && match[1]) {
                                                        jsonText = match[1].trim();
                                                    } else {
                                                        const startIdx = msg.content.indexOf('[');
                                                        if (startIdx !== -1) {
                                                            jsonText = msg.content.substring(startIdx).trim();
                                                        }
                                                    }

                                                    if (!jsonText) return null;

                                                    const previewEpisodes = parsePartialOutlines(jsonText);
                                                    if (previewEpisodes.length === 0) return null;

                                                    return (
                                                        <div className="mt-3.5 space-y-2.5 border-t border-purple-100 dark:border-purple-900/40 pt-3.5">
                                                            <div className="text-[11px] font-extrabold text-purple-600 dark:text-purple-400 flex items-center gap-1.5 mb-1">
                                                                <span className="inline-block w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
                                                                本次优化推荐大纲预览（流式生成中）：
                                                            </div>
                                                            <div className="grid grid-cols-1 gap-2.5 max-h-60 overflow-y-auto pr-1">
                                                                {previewEpisodes.map((ep, eIdx) => (
                                                                    <div key={eIdx} className="p-3 bg-purple-50/40 dark:bg-purple-950/20 border border-purple-100/70 dark:border-purple-900/40 rounded-xl space-y-1.5 shadow-sm transition-all hover:bg-purple-50/60">
                                                                        <div className="flex items-center justify-between gap-2">
                                                                            <div className="flex items-center gap-2">
                                                                                <span className="w-5 h-5 rounded-full bg-purple-500 text-white text-[10px] font-black flex items-center justify-center">
                                                                                    {ep.episodeNumber || '?'}
                                                                                </span>
                                                                                <span className="font-extrabold text-[11px] text-purple-900 dark:text-purple-200">
                                                                                    {ep.title || '标题生成中...'}
                                                                                </span>
                                                                                {ep.version && (
                                                                                    <span className="px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 rounded text-[9px] font-bold">
                                                                                        版本 {ep.version}
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                            {ep.version && !aiIsGenerating && ep.title && ep.outline && (
                                                                                <button
                                                                                    onClick={() => applySingleEpisodeVersion(ep.episodeNumber || chatTargetEpisode, ep.title, ep.outline)}
                                                                                    className="px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded text-[10px] flex items-center gap-0.5 transition-all shadow-sm active:scale-95"
                                                                                >
                                                                                    <Check className="w-3 h-3" /> 应用此版本
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                        <p className="text-[10px] text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-wrap pl-7">
                                                                            {ep.outline || '情节概要生成中...'}
                                                                        </p>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    );
                                                })()}
                                                
                                                {/* If assistant message contains json blocks, show quick action button */}
                                                {msg.role === 'assistant' && !aiIsGenerating && (msg.content.includes('```json') || msg.content.includes('[')) && (() => {
                                                    // Parse json block to see if it contains multiple versioned outcomes
                                                    let jsonTextForCheck = '';
                                                    const jsonRegex = /```json\s*([\s\S]*?)\s*(```|$)/;
                                                    const match = msg.content.match(jsonRegex);
                                                    if (match && match[1]) {
                                                        jsonTextForCheck = match[1].trim();
                                                    } else {
                                                        const startIdx = msg.content.indexOf('[');
                                                        if (startIdx !== -1) {
                                                            jsonTextForCheck = msg.content.substring(startIdx).trim();
                                                        }
                                                    }
                                                    const previewEpisodes = parsePartialOutlines(jsonTextForCheck);
                                                    const hasVersions = previewEpisodes.some(ep => ep.version !== undefined);

                                                    if (hasVersions) {
                                                        return (
                                                            <div className="mt-2.5 text-[10px] text-amber-600 dark:text-amber-400 font-bold text-right italic">
                                                                💡 请在上方选择一个满意的版本并点击「应用此版本」进行单集覆盖
                                                            </div>
                                                        );
                                                    }

                                                    return (
                                                        <div className="mt-3.5 pt-2.5 border-t border-gray-100 dark:border-gray-800 flex justify-end">
                                                            <button 
                                                                onClick={() => extractAndApplyOutlines(msg.content)}
                                                                className="px-3 py-1.5 bg-gradient-to-r from-purple-600 to-sky-600 hover:opacity-90 text-white font-bold rounded-lg text-[11px] shadow-sm flex items-center gap-1 transition-all animate-bounce"
                                                            >
                                                                <Check className="w-3.5 h-3.5" /> 一键应用此优化方案到分集大纲
                                                            </button>
                                                        </div>
                                                    );
                                                })()}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>

                            {/* Chat Input */}
                            <div className="p-4 border-t bg-white dark:bg-gray-900 flex flex-col gap-3 shadow-inner">
                                {/* Scope Selector */}
                                <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-800/40 p-2 rounded-xl border border-gray-150 dark:border-gray-800 text-xs">
                                    <div className="flex items-center gap-2">
                                        <span className="font-extrabold text-gray-500">优化范围:</span>
                                        <div className="flex bg-gray-250/60 dark:bg-gray-700/60 p-0.5 rounded-lg">
                                            <button 
                                                onClick={() => setChatScope('global')}
                                                className={`px-3 py-1 rounded-md text-[11px] font-black transition-all ${chatScope === 'global' ? 'bg-white dark:bg-gray-800 text-purple-600 shadow-sm' : 'text-gray-500 hover:text-gray-800 dark:hover:text-white'}`}
                                            >
                                                整体修改
                                            </button>
                                            <button 
                                                onClick={() => setChatScope('single')}
                                                className={`px-3 py-1 rounded-md text-[11px] font-black transition-all ${chatScope === 'single' ? 'bg-white dark:bg-gray-800 text-purple-600 shadow-sm' : 'text-gray-500 hover:text-gray-800 dark:hover:text-white'}`}
                                            >
                                                单集修改
                                            </button>
                                        </div>
                                    </div>

                                    {chatScope === 'single' && (
                                        <div className="flex items-center gap-1.5 animate-fade-in">
                                            <span className="font-bold text-gray-400">选择目标集:</span>
                                            <select 
                                                value={chatTargetEpisode} 
                                                onChange={e => setChatTargetEpisode(parseInt(e.target.value))}
                                                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2.5 py-1 font-bold text-purple-600 dark:text-purple-400 outline-none text-[11px] cursor-pointer"
                                            >
                                                {parsedEpisodes.map(ep => (
                                                    <option key={ep.episodeNumber} value={ep.episodeNumber}>
                                                        第 {ep.episodeNumber} 集
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    )}
                                </div>

                                <div className="flex gap-2">
                                    <input 
                                        type="text" 
                                        value={aiChatInput}
                                        onChange={e => setAiChatInput(e.target.value)}
                                        onKeyDown={e => { if (e.key === 'Enter') handleAIChatSend(); }}
                                        disabled={aiIsGenerating}
                                        placeholder={
                                            aiIsGenerating 
                                                ? '导演深度优化思考中...' 
                                                : chatScope === 'single' 
                                                    ? `输入对第 ${chatTargetEpisode} 集大纲的修改要求（如：让乔以安和周婉清在此处产生正面争执）` 
                                                    : '向 AI 导演提出全剧大纲修改指令（如：整体节奏加快，增加反差打脸）...'
                                        }
                                        className="flex-grow p-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800 outline-none text-xs text-gray-900 dark:text-white focus:bg-white font-medium"
                                    />
                                    <button 
                                        onClick={() => handleAIChatSend()}
                                        disabled={aiIsGenerating || !aiChatInput.trim()}
                                        className="px-4 bg-purple-600 hover:bg-purple-550 disabled:bg-gray-200 disabled:text-gray-400 text-white font-bold rounded-xl flex items-center justify-center text-xs shadow-md transition-all active:scale-95"
                                    >
                                        发送
                                    </button>
                                </div>
                                {aiIsGenerating && (
                                    <div className="flex items-center gap-1.5 text-[10px] text-purple-600 font-bold pl-1 animate-pulse">
                                        <div className="w-2.5 h-2.5 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
                                        <span>大纲重构中，请稍候并保持连接...</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* 6. Dedicated Script Generation Assembly Room */}
                {stage === 'script_generation' && (
                    <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-gray-50/50 dark:bg-black/5">
                        {/* Left Side: Confirmed Episode Outlines (Reference pane) */}
                        <div className="w-full md:w-[320px] flex flex-col bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 overflow-hidden">
                            <div className="flex-shrink-0 p-4 border-b bg-gray-50/50 dark:bg-gray-950/25 flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <ClipboardDocumentCheck className="w-5 h-5 text-sky-500" />
                                    <h3 className="font-bold text-xs text-gray-800 dark:text-white">各集大纲参考设定</h3>
                                </div>
                                
                                <select 
                                    onChange={e => {
                                        const idx = e.target.value;
                                        if (idx !== "") {
                                            const el = document.getElementById(`episode-card-${idx}`);
                                            el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                        }
                                    }}
                                    className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded px-1.5 py-0.5 text-[10px] font-bold text-sky-600 dark:text-sky-400 cursor-pointer outline-none max-w-[110px]"
                                >
                                    <option value="">快速定位</option>
                                    {parsedEpisodes.map((ep, i) => (
                                        <option key={i} value={i}>
                                            第 {ep.episodeNumber} 集
                                        </option>
                                    ))}
                                </select>
                            </div>
                            
                            <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5 [scrollbar-gutter:stable] bg-gray-50/30">
                                {parsedEpisodes.map((ep, idx) => {
                                    const isExpanded = !!expandedOutlines[idx];
                                    return (
                                        <div 
                                            key={idx} 
                                            id={`episode-sidebar-card-${idx}`}
                                            onClick={() => {
                                                const el = document.getElementById(`episode-card-${idx}`);
                                                el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                            }}
                                            className="p-3 border border-gray-150 dark:border-gray-800 rounded-xl bg-white dark:bg-gray-850 space-y-2 shadow-sm hover:border-purple-300 dark:hover:border-purple-800 cursor-pointer transition-all group"
                                        >
                                            <div className="flex items-center justify-between gap-1.5">
                                                <div className="flex items-center gap-1.5 truncate">
                                                    <span className="w-5 h-5 rounded-full bg-sky-100 dark:bg-sky-950 text-sky-600 dark:text-sky-300 text-[10px] font-black flex items-center justify-center flex-shrink-0">
                                                        {ep.episodeNumber}
                                                    </span>
                                                    <span className="font-extrabold text-xs text-gray-700 dark:text-white truncate">
                                                        {ep.title}
                                                    </span>
                                                </div>
                                                {ep.isDone && (
                                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" title="剧本已生成" />
                                                )}
                                            </div>
                                            
                                            <p className={`text-[10px] text-gray-500 dark:text-gray-400 leading-relaxed pl-6 whitespace-pre-wrap ${isExpanded ? '' : 'line-clamp-3'}`}>
                                                {ep.outline}
                                            </p>

                                            <div className="grid grid-cols-3 gap-1 pl-6 pt-1">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setExpandedOutlines(prev => ({ ...prev, [idx]: !prev[idx] }));
                                                    }}
                                                    className="py-1 px-1 bg-gray-50 hover:bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-750 text-[10px] font-black rounded border border-gray-150 dark:border-gray-700 transition-all text-center"
                                                >
                                                    {isExpanded ? '收起' : '预览大纲'}
                                                </button>
                                                
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        openEditModal(idx);
                                                    }}
                                                    className="py-1 px-1 bg-sky-50 hover:bg-sky-100 text-sky-600 dark:bg-sky-950/45 dark:text-sky-300 dark:hover:bg-sky-900/30 text-[10px] font-black rounded border border-sky-100 dark:border-sky-900/30 transition-all text-center"
                                                >
                                                    修改大纲
                                                </button>

                                                <button
                                                    onClick={async (e) => {
                                                        e.stopPropagation();
                                                        setScriptGenMode('single');
                                                        try {
                                                            const prevScript = idx > 0 ? parsedEpisodes[idx - 1].script : '';
                                                            await generateScriptForEpisode(idx, prevScript);
                                                        } catch (err: any) {
                                                            alert(err.message || '生成该集剧本出错');
                                                        }
                                                    }}
                                                    disabled={ep.isGenerating}
                                                    className="py-1 px-1 bg-purple-50 hover:bg-purple-100 text-purple-600 dark:bg-purple-950/45 dark:text-purple-300 dark:hover:bg-purple-900 transition-all text-[10px] font-black rounded border border-purple-100 dark:border-purple-900 text-center flex items-center justify-center gap-0.5 disabled:opacity-50"
                                                >
                                                    {ep.isGenerating ? (
                                                        <div className="w-2.5 h-2.5 border border-purple-500 border-t-transparent rounded-full animate-spin" />
                                                    ) : (
                                                        '生成剧本'
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="p-3 border-t bg-gray-50 dark:bg-gray-900">
                                <button 
                                    onClick={() => setStage('outline_results')}
                                    className="w-full py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-[11px] font-black text-gray-600 dark:text-gray-300 hover:bg-gray-100/50 dark:hover:bg-gray-800 flex items-center justify-center gap-1"
                                >
                                    ← 返回修改分集大纲
                                </button>
                            </div>
                        </div>

                        {/* Right Side: Script Assembly Panel */}
                        <div className="flex-grow flex flex-col bg-white dark:bg-gray-900 overflow-hidden">
                            <div className="flex-shrink-0 p-4 border-b bg-white dark:bg-gray-900 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div className="flex items-center gap-2">
                                    <Sparkles className="w-5 h-5 text-purple-500" />
                                    <h3 className="font-bold text-sm text-gray-800 dark:text-white">各分集精细剧本创作</h3>
                                </div>
                                
                                <div className="flex items-center flex-wrap gap-3">
                                    {/* AI Model selector */}
                                    <div className="w-44">
                                        <CustomSelect value={model} onChange={setModel} options={MODEL_OPTIONS} />
                                    </div>
                                    
                                    {/* Temperature Slider */}
                                    <div className="flex items-center gap-1.5 bg-gray-50 dark:bg-gray-800 px-3 py-1.5 rounded-xl border border-gray-150 dark:border-gray-700 text-[11px] text-gray-500 font-bold">
                                        <span>随机度: {temperature}</span>
                                        <input 
                                            type="range" min="0" max="1.5" step="0.05" 
                                            value={temperature} onChange={e => setTemperature(parseFloat(e.target.value))}
                                            className="w-16 h-1 bg-gray-250 rounded-lg appearance-none cursor-pointer accent-purple-500"
                                        />
                                    </div>

                                    <button 
                                        onClick={exportAllScriptsToWord}
                                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-550 text-white font-bold rounded-xl text-xs shadow-md flex items-center gap-1.5 transition-all active:scale-98"
                                    >
                                        <DocumentArrowDown className="w-4 h-4" /> 一键导出全集剧本 (Word)
                                    </button>

                                    <button 
                                        onClick={handleGenerateAllScripts}
                                        className={`px-4 py-2 rounded-xl text-xs font-bold text-white shadow-md flex items-center gap-1.5 transition-all active:scale-98 ${globalIsGenerating && scriptGenMode === 'all' ? 'bg-rose-500 hover:bg-rose-600' : 'bg-purple-600 hover:bg-purple-550'}`}
                                    >
                                        {globalIsGenerating && scriptGenMode === 'all' ? (
                                            <><Stop className="w-4 h-4" /> 停止一键生成</>
                                        ) : (
                                            <><Sparkles className="w-4 h-4 animate-bounce" /> 智能一键生成全部剧本</>
                                        )}
                                    </button>
                                </div>
                            </div>

                            {/* Main split area: Scripts list (left) + Sidebar (right) */}
                            <div className="flex-1 flex overflow-hidden">
                                {/* Scripts list and generation progress */}
                                <div className="flex-1 overflow-y-auto p-4 space-y-6 [scrollbar-gutter:stable] bg-gray-50/20 dark:bg-black/5 snap-y snap-mandatory">
                                    {parsedEpisodes.map((ep, idx) => (
                                        <div 
                                            key={idx} 
                                            id={`episode-card-${idx}`} 
                                            className={`border rounded-xl bg-white dark:bg-gray-900 p-5 shadow-sm transition-all scroll-mt-4 flex flex-col h-[calc(100vh-180px)] min-h-[500px] snap-start ${ep.isGenerating ? 'ring-2 ring-purple-400 border-transparent' : 'border-gray-200 dark:border-gray-800'}`}
                                        >
                                            <div className="flex-shrink-0 flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800 mb-3">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-300 font-black px-2 py-0.5 rounded">
                                                        第 {ep.episodeNumber} 集
                                                    </span>
                                                    <span className="font-bold text-sm text-gray-800 dark:text-gray-100">
                                                        {ep.title}
                                                    </span>
                                                </div>
                                                
                                                <div className="flex items-center gap-2">
                                                    {ep.isGenerating ? (
                                                        <span className="text-xs text-purple-600 font-bold animate-pulse flex items-center gap-1">
                                                            <div className="w-2.5 h-2.5 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
                                                            正文生成中...
                                                        </span>
                                                    ) : ep.isDone ? (
                                                        <span className="text-xs text-emerald-500 font-bold flex items-center gap-0.5">
                                                            <Check className="w-3.5 h-3.5" /> 剧本完成
                                                        </span>
                                                    ) : (
                                                        <span className="text-xs text-gray-400">待创作</span>
                                                    )}

                                                    <button 
                                                        onClick={async () => {
                                                            if (ep.isGenerating) {
                                                                handleStop();
                                                            } else {
                                                                setScriptGenMode('single');
                                                                try {
                                                                    const prevScript = idx > 0 ? parsedEpisodes[idx - 1].script : '';
                                                                    await generateScriptForEpisode(idx, prevScript);
                                                                } catch (err: any) {
                                                                    alert(err.message || '生成该集剧本出错');
                                                                }
                                                            }
                                                        }}
                                                        className="px-2.5 py-1 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-750 text-gray-700 dark:text-gray-300 text-xs font-bold rounded-lg border border-gray-200 dark:border-gray-700 transition-colors"
                                                    >
                                                        {ep.isGenerating ? '停止' : ep.isDone ? '重新生成本集' : '生成单集剧本'}
                                                    </button>

                                                    {ep.isDone && (
                                                        <button 
                                                            onClick={() => {
                                                                setHistoryEpisodeIndex(idx);
                                                                setSelectedHistoryVersionIndex(ep.history && ep.history.length > 0 ? ep.history.length - 1 : null);
                                                                setShowHistoryModal(true);
                                                            }}
                                                            className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 text-indigo-600 dark:text-indigo-400 text-xs font-bold rounded-lg border border-indigo-100 dark:border-indigo-900 transition-colors"
                                                        >
                                                            查看版本
                                                        </button>
                                                    )}

                                                    {ep.isDone && (
                                                        <div className="flex items-center gap-1.5">
                                                            <button 
                                                                onClick={() => {
                                                                    setInspirationEpisodeIndex(idx);
                                                                    setShowInspirationModal(true);
                                                                    setSearchKeyword('');
                                                                    setSelectedTags([]);
                                                                    setSearchResults([]);
                                                                    setSelectedFragments([]);
                                                                    setAmplifyType('emotion');
                                                                    setAmplifyValue('极致虐心');
                                                                    setCustomAmplifyReqs('');
                                                                }}
                                                                disabled={!ep.script || ep.isGenerating}
                                                                className="px-2.5 py-1 bg-gradient-to-r from-purple-500 via-indigo-500 to-sky-500 hover:from-purple-600 hover:via-indigo-600 hover:to-sky-600 text-white text-xs font-black rounded-lg border border-transparent shadow-sm flex items-center gap-1 disabled:opacity-50 transition-all active:scale-95"
                                                            >
                                                                <Database className="w-3.5 h-3.5" /> 标签灵感强化
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Editable Script block - with flex-grow to stretch full-height */}
                                            <textarea 
                                                value={ep.script || ''}
                                                onChange={e => setParsedEpisodes(prev => prev.map((item, id) => id === idx ? { ...item, script: e.target.value, isDone: e.target.value.trim().length > 0 } : item))}
                                                placeholder={`第${toChineseNum(ep.episodeNumber)}集\n\n${ep.episodeNumber}-1 场景地点 日/内 人物：乔以安 ...\n△ 乔以安推开门，看到了房间里的一幕。\n乔以安（难以置信）：这怎么可能...`}
                                                className="flex-grow w-full p-4 bg-gray-50/50 dark:bg-gray-850 border border-gray-150 dark:border-gray-800 rounded-xl text-xs outline-none focus:bg-white focus:ring-1 focus:ring-purple-400 leading-relaxed font-mono custom-scrollbar resize-none mb-3"
                                            />

                                            {/* Q&A style single-episode optimization bar */}
                                            <div className="flex-shrink-0 flex items-center gap-2 bg-purple-50/30 dark:bg-purple-950/20 p-2 rounded-xl border border-purple-100/40 dark:border-purple-900/30">
                                                <input 
                                                    type="text"
                                                    value={singleEpisodeEdits[idx] || ''}
                                                    onChange={e => handleSingleEpisodeEditChange(idx, e.target.value)}
                                                    onKeyDown={e => { if (e.key === 'Enter') handleSingleEpisodeOptimize(idx); }}
                                                    placeholder={ep.script ? `输入对第 ${ep.episodeNumber} 集剧本的针对性润色意见（如：“强化男主的愤怒质问”、“台词表现更具张力”）` : "请先生成或填写该集基础剧本，才能进行针对性润色意见修改..."}
                                                    className="flex-grow bg-white dark:bg-gray-800 border border-gray-150 dark:border-gray-750 rounded-lg px-3 py-1.5 text-xs text-gray-800 dark:text-white outline-none focus:ring-1 focus:ring-purple-400 placeholder:text-gray-400"
                                                    disabled={ep.isGenerating || !ep.script}
                                                />
                                                <button 
                                                    onClick={() => handleSingleEpisodeOptimize(idx)}
                                                    disabled={ep.isGenerating || !ep.script || !(singleEpisodeEdits[idx] || '').trim()}
                                                    className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-550 disabled:bg-gray-200 disabled:text-gray-400 text-white text-xs font-bold rounded-lg transition-all active:scale-95 flex items-center gap-1 shrink-0"
                                                >
                                                    <Sparkles className="w-3.5 h-3.5" /> 智能润色
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Sidebar on the right */}
                                {showInspirationModal && (
                                    <div className="w-[360px] border-l border-gray-150 dark:border-gray-800 bg-white dark:bg-gray-900 flex flex-col h-full animate-slide-in">
                                        {/* Sidebar Header */}
                                        <div className="flex-shrink-0 p-4 border-b border-gray-150 dark:border-gray-800 bg-gray-50 dark:bg-gray-950/20 flex items-center justify-between">
                                            <div>
                                                <h4 className="font-bold text-gray-900 dark:text-white flex items-center gap-1.5 text-sm">
                                                    <Database className="w-4 h-4 text-purple-600" />
                                                    标签灵感强化 ({inspirationEpisodeIndex !== null ? `第 ${parsedEpisodes[inspirationEpisodeIndex].episodeNumber} 集` : ''})
                                                </h4>
                                                <p className="text-[10px] text-gray-400 mt-0.5">检索精品库剧本段落并将其精髓融入当前脚本</p>
                                            </div>
                                            <button 
                                                onClick={() => setShowInspirationModal(false)}
                                                className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors"
                                            >
                                                <X className="w-5 h-5" />
                                            </button>
                                        </div>

                                        {/* Scrollable contents */}
                                        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                                            {/* 1. Search Bar */}
                                            <div className="space-y-1.5">
                                                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400">1. 输入检索词或直接筛选标签</label>
                                                <div className="flex gap-2">
                                                    <input 
                                                        type="text" 
                                                        value={searchKeyword}
                                                        onChange={e => setSearchKeyword(e.target.value)}
                                                        onKeyDown={e => { if (e.key === 'Enter') handleSearchInspirations(); }}
                                                        placeholder="输入关键词搜索（如：反击、背叛、相遇）..."
                                                        className="flex-grow bg-white dark:bg-gray-800 border border-gray-150 dark:border-gray-750 rounded-lg px-2.5 py-1.5 text-xs text-gray-800 dark:text-white outline-none focus:ring-1 focus:ring-purple-400"
                                                    />
                                                    <button 
                                                        onClick={handleSearchInspirations}
                                                        className="px-3 py-1.5 bg-purple-600 hover:bg-purple-550 text-white text-xs font-bold rounded-lg transition-all active:scale-95 flex items-center gap-1 shrink-0"
                                                    >
                                                        检索
                                                    </button>
                                                </div>
                                            </div>

                                            {/* 2. Tags filter */}
                                            <div>
                                                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-2">2. 筛选 7 大特色标签 (点击类型后再展开对应的标签)</label>
                                                <div className="space-y-3 bg-gray-50/50 dark:bg-gray-950/20 p-3 rounded-xl border border-gray-150 dark:border-gray-800">
                                                    {/* Categories quick selectors */}
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {[
                                                            { id: 'scene', title: '场景', icon: '🎬', tags: availableSceneTags },
                                                            { id: 'emotion', title: '情绪', icon: '🎭', tags: availableEmotionTags },
                                                            { id: 'event', title: '情节', icon: '🔥', tags: availableEventTags },
                                                            { id: 'ability', title: '金手指', icon: '✨', tags: availableAbilityTags },
                                                            { id: 'conflict', title: '冲突', icon: '⚡', tags: availableConflictTags },
                                                            { id: 'theme', title: '主题', icon: '📖', tags: availableThemeTags },
                                                            { id: 'element', title: '元素', icon: '🌟', tags: availableElementTags }
                                                        ].map(cat => {
                                                            const isSelected = expandedCategory === cat.id;
                                                            const selectedCount = cat.tags.filter(t => selectedTags.includes(t)).length;
                                                            return (
                                                                <button
                                                                    key={cat.id}
                                                                    type="button"
                                                                    onClick={() => setExpandedCategory(expandedCategory === cat.id ? null : cat.id)}
                                                                    className={`px-2 py-1 text-[11px] font-bold rounded-lg border transition-all flex items-center gap-1 ${
                                                                        isSelected 
                                                                            ? 'bg-purple-600 text-white border-purple-600 shadow-sm active:scale-95' 
                                                                            : 'bg-white dark:bg-gray-850 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-750 hover:bg-gray-100 dark:hover:bg-gray-800'
                                                                    }`}
                                                                >
                                                                    <span>{cat.icon}</span>
                                                                    <span>{cat.title}</span>
                                                                    {selectedCount > 0 && (
                                                                        <span className="ml-0.5 px-1 py-0.2 bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 rounded-full text-[9px] font-black">
                                                                            {selectedCount}
                                                                        </span>
                                                                    )}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>

                                                    {/* Active tag sublist container */}
                                                    {expandedCategory && (() => {
                                                        const categoriesMap: Record<string, { title: string; icon: string; tags: string[]; btnActive: string }> = {
                                                            scene: { title: '场景类型', icon: '🎬', tags: availableSceneTags, btnActive: 'bg-purple-600 text-white shadow-sm hover:bg-purple-700' },
                                                            emotion: { title: '情绪类型', icon: '🎭', tags: availableEmotionTags, btnActive: 'bg-sky-600 text-white shadow-sm hover:bg-sky-700' },
                                                            event: { title: '事件情节', icon: '🔥', tags: availableEventTags, btnActive: 'bg-amber-600 text-white shadow-sm hover:bg-amber-700' },
                                                            ability: { title: '特殊能力/金手指', icon: '✨', tags: availableAbilityTags, btnActive: 'bg-emerald-600 text-white shadow-sm hover:bg-emerald-700' },
                                                            conflict: { title: '核心冲突', icon: '⚡', tags: availableConflictTags, btnActive: 'bg-rose-600 text-white shadow-sm hover:bg-rose-700' },
                                                            theme: { title: '核心主题', icon: '📖', tags: availableThemeTags, btnActive: 'bg-indigo-600 text-white shadow-sm hover:bg-indigo-700' },
                                                            element: { title: '题材元素', icon: '🌟', tags: availableElementTags, btnActive: 'bg-teal-600 text-white shadow-sm hover:bg-teal-700' }
                                                        };

                                                        const activeCat = categoriesMap[expandedCategory];
                                                        if (!activeCat || !activeCat.tags || activeCat.tags.length === 0) return null;

                                                        return (
                                                            <div className="border border-purple-100 dark:border-purple-900/40 rounded-xl bg-purple-50/10 dark:bg-purple-950/5 p-2.5 animate-fade-in space-y-2">
                                                                <div className="flex items-center justify-between pb-1.5 border-b border-gray-150 dark:border-gray-800">
                                                                    <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 flex items-center gap-1">
                                                                        {activeCat.icon} {activeCat.title}标签集 ({activeCat.tags.length}个)
                                                                    </span>
                                                                    {selectedTags.some(t => activeCat.tags.includes(t)) && (
                                                                        <button 
                                                                            type="button"
                                                                            onClick={() => setSelectedTags(selectedTags.filter(t => !activeCat.tags.includes(t)))}
                                                                            className="text-[9px] text-rose-500 hover:text-rose-600 font-bold"
                                                                        >
                                                                            清空当前分类
                                                                        </button>
                                                                    )}
                                                                </div>
                                                                <div className="flex flex-wrap gap-1.5 max-h-[140px] overflow-y-auto p-0.5 custom-scrollbar">
                                                                    {activeCat.tags.map((tag, tagIdx) => {
                                                                        const isSelected = selectedTags.includes(tag);
                                                                        return (
                                                                            <button
                                                                                key={`${expandedCategory}-${tagIdx}`}
                                                                                type="button"
                                                                                onClick={() => {
                                                                                    if (isSelected) {
                                                                                        setSelectedTags(selectedTags.filter(t => t !== tag));
                                                                                    } else {
                                                                                        setSelectedTags([...selectedTags, tag]);
                                                                                    }
                                                                                }}
                                                                                className={`px-2 py-0.5 rounded-md text-[10px] font-medium transition-all ${
                                                                                    isSelected 
                                                                                        ? activeCat.btnActive 
                                                                                        : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-150 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-750'
                                                                                }`}
                                                                            >
                                                                                {tag}
                                                                            </button>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </div>
                                                        );
                                                    })()}
                                                </div>
                                            </div>

                                            {/* 3. Search results & reference fragments */}
                                            <div className="space-y-1.5">
                                                <div className="flex items-center justify-between">
                                                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400">3. 检索结果与参考片段选择 ({searchResults.length} 个结果)</label>
                                                    {selectedFragments.length > 0 && (
                                                        <span className="text-[10px] text-purple-600 dark:text-purple-400 font-bold">已选 {selectedFragments.length} 个片段</span>
                                                    )}
                                                </div>
                                                <div className="max-h-[220px] overflow-y-auto border border-gray-150 dark:border-gray-800 rounded-xl bg-gray-50/40 dark:bg-black/10 p-2.5 space-y-2 custom-scrollbar">
                                                    {searchResults.map((item, idx) => {
                                                        const isSelected = selectedFragments.some(f => f.content === item.content);
                                                        return (
                                                            <div 
                                                                key={idx}
                                                                onClick={() => {
                                                                    if (isSelected) {
                                                                        setSelectedFragments(selectedFragments.filter(f => f.content !== item.content));
                                                                    } else {
                                                                        setSelectedFragments([...selectedFragments, item]);
                                                                    }
                                                                }}
                                                                className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all flex gap-2 ${isSelected ? 'bg-purple-50/60 dark:bg-purple-950/20 border-purple-300 dark:border-purple-900' : 'bg-white dark:bg-gray-850 border-gray-200 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800'}`}
                                                            >
                                                                <input 
                                                                    type="checkbox" 
                                                                    checked={isSelected}
                                                                    onChange={() => {}} // Handled by parent div Click
                                                                    className="mt-1 h-3.5 w-3.5 rounded text-purple-600 border-gray-350 focus:ring-purple-500 shrink-0"
                                                                />
                                                                <div className="space-y-1 flex-grow">
                                                                    <p className="text-[11px] leading-relaxed text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{item.content}</p>
                                                                    <div className="flex flex-wrap gap-1 pt-1">
                                                                        {item.event_types.map((e, eIdx) => (
                                                                            <span key={eIdx} className="px-1.5 py-0.5 rounded text-[8px] font-medium bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400">#{e}</span>
                                                                        ))}
                                                                        {item.emotion_types.map((em, emIdx) => (
                                                                            <span key={emIdx} className="px-1.5 py-0.5 rounded text-[8px] font-medium bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400">@{em}</span>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                    {searchResults.length === 0 && (
                                                        <div className="text-center py-6 text-xs text-gray-400">
                                                            {searchKeyword || selectedTags.length > 0 ? "未找到匹配片段，请更换检索词" : "在上方输入关键词或选择标签后检索"}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* 4. Playbook Fusion & Settings */}
                                            <div className="space-y-3 pt-2 border-t border-gray-150 dark:border-gray-800">
                                                <div className="p-2.5 bg-purple-50/40 dark:bg-purple-950/10 border border-purple-100/40 dark:border-purple-900/30 rounded-xl">
                                                    <h5 className="text-[11px] font-bold text-purple-800 dark:text-purple-300 flex items-center gap-1">
                                                        <Sparkles className="w-3 h-3" /> 剧本融合模式设置
                                                    </h5>
                                                    <p className="text-[9px] text-gray-500 dark:text-gray-400">
                                                        AI 导演在融合上述所选灵感段落的节奏与情节时，执行哪种主要的剧作改良任务？
                                                    </p>
                                                </div>

                                                {/* Select Amplification Direction */}
                                                <div className="space-y-1">
                                                    <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400">选择强化方向</label>
                                                    <div className="grid grid-cols-3 gap-1">
                                                        {(['emotion', 'scene', 'event'] as const).map(type => (
                                                            <button
                                                                key={type}
                                                                onClick={() => {
                                                                    setAmplifyType(type);
                                                                    setAmplifyValue(type === 'emotion' ? '极致虐心' : type === 'scene' ? '豪门晚宴' : '反派阴谋败露');
                                                                }}
                                                                className={`py-1 px-1 text-center rounded-lg border text-[10px] font-bold transition-all ${amplifyType === type ? 'bg-purple-600 border-transparent text-white shadow-sm' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                                                            >
                                                                {type === 'emotion' ? '🎭 极致情绪' : type === 'scene' ? '🗺️ 场景切换' : '⚡ 引入事件'}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* Value select */}
                                                {amplifyType === 'emotion' && (
                                                    <div className="space-y-1">
                                                        <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400">核心情绪目标</label>
                                                        <select
                                                            value={amplifyValue}
                                                            onChange={e => setAmplifyValue(e.target.value)}
                                                            className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-purple-400"
                                                        >
                                                            {['极致虐心', '逆袭爽快', '搞笑幽默', '甜宠撒糖', '惊悚悬疑', '霸道高冷', '悲痛欲绝', '扬眉吐气', '深情告白'].map(val => (
                                                                <option key={val} value={val}>{val}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                )}

                                                {amplifyType === 'scene' && (
                                                    <div className="space-y-1">
                                                        <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400">切换的目标场景设定</label>
                                                        <input
                                                            type="text"
                                                            value={amplifyValue}
                                                            onChange={e => setAmplifyValue(e.target.value)}
                                                            placeholder="例如：豪门晚宴、废弃工厂..."
                                                            className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-purple-400"
                                                        />
                                                    </div>
                                                )}

                                                {amplifyType === 'event' && (
                                                    <div className="space-y-1">
                                                        <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400">引入的核心事件设定</label>
                                                        <input
                                                            type="text"
                                                            value={amplifyValue}
                                                            onChange={e => setAmplifyValue(e.target.value)}
                                                            placeholder="例如：女主角当众揭穿绿茶..."
                                                            className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-purple-400"
                                                        />
                                                    </div>
                                                )}

                                                {/* Custom rewrite guidelines */}
                                                <div className="space-y-1">
                                                    <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400">个性化增强及修改意见 (选填)</label>
                                                    <textarea
                                                        value={customAmplifyReqs}
                                                        onChange={e => setCustomAmplifyReqs(e.target.value)}
                                                        placeholder="个性化改写细节或指令（台词更犀利等）..."
                                                        rows={2}
                                                        className="w-full p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs outline-none focus:ring-1 focus:ring-purple-400 resize-none leading-normal placeholder:text-gray-400"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Action Footer inside Sidebar */}
                                        <div className="flex-shrink-0 p-4 border-t border-gray-150 dark:border-gray-800 bg-gray-50 dark:bg-gray-950/20 space-y-2">
                                            <div className="text-[10px] text-gray-400 flex items-center justify-between px-1">
                                                <span>已关联灵感片段数：</span>
                                                <span className="font-bold text-purple-600 dark:text-purple-400">{selectedFragments.length} 个</span>
                                            </div>
                                            <button
                                                onClick={async () => {
                                                    if (inspirationEpisodeIndex === null) return;
                                                    setShowInspirationModal(false);
                                                    const targetEmotion = amplifyType === 'emotion' ? amplifyValue : '';
                                                    const targetScene = amplifyType === 'scene' ? amplifyValue : '';
                                                    const finalReqs = amplifyType === 'event' ? amplifyValue : customAmplifyReqs;
                                                    
                                                    await handleEmotionAmplify(
                                                        inspirationEpisodeIndex,
                                                        targetEmotion,
                                                        selectedFragments,
                                                        targetScene,
                                                        finalReqs,
                                                        amplifyType
                                                    );
                                                }}
                                                disabled={selectedFragments.length === 0}
                                                className="w-full py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-550 hover:to-indigo-550 disabled:from-gray-200 disabled:to-gray-200 disabled:text-gray-400 text-white font-bold rounded-xl text-xs shadow-md transition-all active:scale-95 flex items-center justify-center gap-1.5"
                                            >
                                                <Sparkles className="w-4 h-4" /> 
                                                {selectedFragments.length > 0 ? "确认 AI 协同剧本增强" : "请先选择至少 1 个灵感片段"}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* 0xsline/short-drama Skill Master Stage */}
                {stage === 'skill_master_workspace' && (
                    <div className="flex-grow flex overflow-hidden bg-white dark:bg-gray-900 animate-fade-in h-full w-full">
                        {/* Sidebar: 8-Step Navigation with CLI Command metadata */}
                        <div className="w-[280px] border-r border-gray-150 dark:border-gray-800 bg-gray-50 dark:bg-gray-950/25 flex flex-col h-full select-none flex-shrink-0">
                            <div className="p-4 border-b border-gray-150 dark:border-gray-800 bg-white dark:bg-gray-900/60 flex items-center justify-between">
                                <div>
                                    <h4 className="font-extrabold text-xs text-gray-800 dark:text-white flex items-center gap-1.5">
                                        <Film className="w-4 h-4 text-sky-500 animate-pulse" />
                                        <span>编剧大师</span>
                                    </h4>
                                    <p className="text-[10px] text-gray-400 mt-0.5">爆款微短剧专业创作流</p>
                                </div>
                                <span className="text-[9px] bg-sky-50 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400 border border-sky-100 dark:border-sky-900 font-extrabold px-1.5 py-0.5 rounded-md">
                                    编剧工作流
                                </span>
                            </div>

                            {/* Scrollable steps */}
                            <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5 custom-scrollbar">
                                {[
                                    { step: 1, name: '立项策划', cmd: '/start', desc: '设定选题、受众及看点' },
                                    { step: 2, name: '创作方案', cmd: '/plan', desc: '确定总集数及幕节奏' },
                                    { step: 3, name: '角色设定', cmd: '/char', desc: '构建正反派马甲设定' },
                                    { step: 4, name: '分集大纲', cmd: '/outline', desc: '编排高吸引力大纲' },
                                    { step: 5, name: '单集剧本', cmd: '/episode', desc: '创作高潮卡点剧本' },
                                    { step: 6, name: '合规审查', cmd: '/compliance', desc: '防下架合规精彩排查' },
                                    { step: 7, name: '海外改写', cmd: '/overseas', desc: '出海与本土化剧设改写' },
                                    { step: 8, name: '剧本导出', cmd: '/export', desc: '生成短剧立项发布书' }
                                ].map(item => {
                                    const isActive = skillActiveStep === item.step;
                                    return (
                                        <button
                                            key={item.step}
                                            onClick={() => {
                                                if (!skillIsGenerating) {
                                                    setSkillActiveStep(item.step);
                                                }
                                            }}
                                            disabled={skillIsGenerating}
                                            className={`w-full p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all ${isActive ? 'bg-sky-50/70 border-sky-200 dark:bg-sky-950/30 dark:border-sky-900 shadow-sm' : 'bg-transparent border-transparent hover:bg-gray-100 dark:hover:bg-gray-800/40'}`}
                                        >
                                            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black flex-shrink-0 mt-0.5 ${isActive ? 'bg-sky-500 text-white shadow-sm' : 'bg-gray-200 dark:bg-gray-800 text-gray-500'}`}>
                                                {item.step}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between">
                                                    <span className={`text-[12px] font-black ${isActive ? 'text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-300'}`}>
                                                        {item.name}
                                                    </span>
                                                    <span className="text-[9px] font-mono font-extrabold text-gray-400">
                                                        {item.cmd}
                                                    </span>
                                                </div>
                                                <p className="text-[10px] text-gray-400 truncate mt-0.5">{item.desc}</p>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Sidebar Footer */}
                            <div className="p-3 border-t border-gray-150 dark:border-gray-800 bg-white dark:bg-gray-900/60 flex items-center justify-between text-[10px] text-gray-400 font-bold">
                                <span>项目: {projectTitle || '出海短剧项目'}</span>
                            </div>
                        </div>

                        {/* Content Area */}
                        <div className="flex-1 flex flex-col overflow-hidden h-full">
                            {/* Step Header */}
                            <div className="flex-shrink-0 p-4 border-b border-gray-150 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-950/10 flex items-center justify-between">
                                <div>
                                    <span className="text-[10px] font-mono font-bold text-sky-600 dark:text-sky-400 flex items-center gap-1 uppercase">
                                        <span>步骤 0{skillActiveStep}</span>
                                        <span>•</span>
                                        <span>指令: {[
                                            '/start', '/plan', '/char', '/outline', '/episode', '/compliance', '/overseas', '/export'
                                        ][skillActiveStep - 1]}</span>
                                    </span>
                                    <h3 className="text-base font-black text-gray-900 dark:text-white mt-1">
                                        {[
                                            '立项策划 (Topic & Audience Research)',
                                            '短剧创作方案 (Screenplay Concept & Plan)',
                                            '核心角色卡设定 (Character Card Blueprint)',
                                            '全剧分集大纲 (Overall Episode Outlines)',
                                            '单集正式剧本 (Single Screenplay Writing)',
                                            '合规性与精彩度把关 (Compliance & Quality Review)',
                                            '剧本海外改写与翻译 (Overseas Localization & Copywriting)',
                                            '整合发布导出 (Pitch Deck & Compilation Export)'
                                        ][skillActiveStep - 1]}
                                    </h3>
                                </div>

                                <div className="flex items-center gap-2.5">
                                    {skillIsGenerating ? (
                                        <button
                                            onClick={handleStopSkillStep}
                                            className="px-4 py-2 bg-rose-50 border border-rose-200 dark:bg-rose-950/20 dark:border-rose-900 text-rose-600 dark:text-rose-400 hover:bg-rose-100 font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer"
                                        >
                                            <Stop className="w-4 h-4" />
                                            <span>停止生成</span>
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => handleRunSkillStep(skillActiveStep)}
                                            className="px-5 py-2 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white font-extrabold rounded-xl text-xs flex items-center gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer"
                                        >
                                            <Play className="w-4 h-4 fill-current" />
                                            <span>执行本步编剧指令</span>
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Split Configuration & Output Panels */}
                            <div className="flex-1 flex overflow-hidden">
                                {/* Left Side: Parameters Form */}
                                <div className="w-[320px] border-r border-gray-150 dark:border-gray-800 p-4 overflow-y-auto space-y-4 bg-gray-50/20 dark:bg-black/5 custom-scrollbar flex-shrink-0">
                                    <h4 className="text-[11px] font-extrabold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                                        <AdjustmentsHorizontal className="w-3.5 h-3.5" />
                                        <span>参数配置</span>
                                    </h4>

                                    {/* STEP 1: start */}
                                    {skillActiveStep === 1 && (
                                        <div className="space-y-4 animate-fade-in">
                                            <div className="space-y-1">
                                                <label className="text-[11px] font-black text-gray-600 dark:text-gray-400">选题脑洞 (Topic)</label>
                                                <input
                                                    type="text"
                                                    value={skillTopic}
                                                    onChange={e => setSkillTopic(e.target.value)}
                                                    placeholder="例如：真假千金重回豪门..."
                                                    className="w-full p-2.5 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-850 rounded-xl text-xs font-bold text-gray-800 dark:text-gray-200 focus:border-sky-500 focus:ring-1 focus:ring-sky-400/20 outline-none"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[11px] font-black text-gray-600 dark:text-gray-400">目标受众 (Audience)</label>
                                                <input
                                                    type="text"
                                                    value={skillAudience}
                                                    onChange={e => setSkillAudience(e.target.value)}
                                                    placeholder="例如：年轻都市女性、下沉市场用户..."
                                                    className="w-full p-2.5 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-850 rounded-xl text-xs font-bold text-gray-800 dark:text-gray-200 focus:border-sky-500 focus:ring-1 focus:ring-sky-400/20 outline-none"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[11px] font-black text-gray-600 dark:text-gray-400">剧本调性 (Tone)</label>
                                                <input
                                                    type="text"
                                                    value={skillTone}
                                                    onChange={e => setSkillTone(e.target.value)}
                                                    placeholder="例如：极致反差、打脸爽剧..."
                                                    className="w-full p-2.5 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-850 rounded-xl text-xs font-bold text-gray-800 dark:text-gray-200 focus:border-sky-500 focus:ring-1 focus:ring-sky-400/20 outline-none"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[11px] font-black text-gray-600 dark:text-gray-400">核心卖点与钩子 (Selling Points)</label>
                                                <textarea
                                                    value={skillSellingPoints}
                                                    onChange={e => setSkillSellingPoints(e.target.value)}
                                                    placeholder="输入核心爆款要素..."
                                                    rows={4}
                                                    className="w-full p-2.5 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-850 rounded-xl text-xs font-bold text-gray-800 dark:text-gray-200 focus:border-sky-500 focus:ring-1 focus:ring-sky-400/20 outline-none resize-none leading-relaxed"
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {/* STEP 2: plan */}
                                    {skillActiveStep === 2 && (
                                        <div className="space-y-4 animate-fade-in">
                                            <div className="space-y-1.5">
                                                <label className="text-[11px] font-black text-gray-600 dark:text-gray-400">规划目标总集数 (Episodes)</label>
                                                <input
                                                    type="number"
                                                    value={skillPlanEpisodes}
                                                    onChange={e => setSkillPlanEpisodes(parseInt(e.target.value) || 80)}
                                                    min={1}
                                                    max={120}
                                                    className="w-full p-2.5 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-850 rounded-xl text-xs font-bold text-gray-800 dark:text-gray-200 focus:border-sky-500 focus:ring-1 focus:ring-sky-400/20 outline-none"
                                                />
                                                <p className="text-[10px] text-gray-400 leading-normal">
                                                    微短剧常见总集数为 80 集、100 集。
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    {/* STEP 3: char */}
                                    {skillActiveStep === 3 && (
                                        <div className="space-y-4 animate-fade-in">
                                            <div className="space-y-1">
                                                <label className="text-[11px] font-black text-gray-600 dark:text-gray-400">主要角色及设定 (Main Character)</label>
                                                <textarea
                                                    value={skillMainChar}
                                                    onChange={e => setSkillMainChar(e.target.value)}
                                                    placeholder="输入主角名字、真实马甲、表面职业..."
                                                    rows={4}
                                                    className="w-full p-2.5 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-850 rounded-xl text-xs font-bold text-gray-800 dark:text-gray-200 focus:border-sky-500 focus:ring-1 focus:ring-sky-400/20 outline-none resize-none leading-relaxed"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[11px] font-black text-gray-600 dark:text-gray-400">反派/对手及设定 (Antagonist)</label>
                                                <textarea
                                                    value={skillAntagonist}
                                                    onChange={e => setSkillAntagonist(e.target.value)}
                                                    placeholder="输入对手姓名、反向冲突点、虚伪外表..."
                                                    rows={4}
                                                    className="w-full p-2.5 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-850 rounded-xl text-xs font-bold text-gray-800 dark:text-gray-200 focus:border-sky-500 focus:ring-1 focus:ring-sky-400/20 outline-none resize-none leading-relaxed"
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {/* STEP 4: outline */}
                                    {skillActiveStep === 4 && (
                                        <div className="p-3 bg-sky-50/50 dark:bg-sky-950/20 border border-sky-150 dark:border-sky-900 rounded-xl space-y-2 text-xs">
                                            <p className="font-bold text-sky-800 dark:text-sky-400">大纲自动化生成</p>
                                            <p className="text-gray-600 dark:text-gray-300 leading-normal text-[11px]">
                                                本步将全自动融合前三步（立项、方案、角色设定）的所有设定数据，批量生成微短剧分集大纲。
                                            </p>
                                        </div>
                                    )}

                                    {/* STEP 5: write script */}
                                    {skillActiveStep === 5 && (
                                        <div className="space-y-4 animate-fade-in">
                                            <div className="space-y-1.5">
                                                <label className="text-[11px] font-black text-gray-600 dark:text-gray-400">选择要创作的剧本集数</label>
                                                <select
                                                    value={skillEpisodeNum}
                                                    onChange={e => setSkillEpisodeNum(parseInt(e.target.value))}
                                                    className="w-full p-2.5 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-850 rounded-xl text-xs font-bold text-gray-800 dark:text-gray-200 focus:border-sky-500 focus:ring-1 focus:ring-sky-400/20 outline-none cursor-pointer"
                                                >
                                                    {Array.from({ length: 10 }).map((_, idx) => (
                                                        <option key={idx + 1} value={idx + 1}>
                                                            第 {idx + 1} 集剧本
                                                        </option>
                                                    ))}
                                                </select>
                                                <p className="text-[10px] text-gray-400 leading-normal">
                                                    输入集数将拉取对应第 {skillEpisodeNum} 集大纲展开专业剧本编写。
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    {/* STEP 6: compliance */}
                                    {skillActiveStep === 6 && (
                                        <div className="space-y-4 animate-fade-in">
                                            <div className="space-y-1.5">
                                                <label className="text-[11px] font-black text-gray-600 dark:text-gray-400">选择要审查的内容集数</label>
                                                <select
                                                    value={skillReviewNum}
                                                    onChange={e => setSkillReviewNum(parseInt(e.target.value))}
                                                    className="w-full p-2.5 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-850 rounded-xl text-xs font-bold text-gray-800 dark:text-gray-200 focus:border-sky-500 focus:ring-1 focus:ring-sky-400/20 outline-none cursor-pointer"
                                                >
                                                    {Array.from({ length: 10 }).map((_, idx) => (
                                                        <option key={idx + 1} value={idx + 1}>
                                                            第 {idx + 1} 集剧本
                                                        </option>
                                                    ))}
                                                </select>
                                                <p className="text-[10px] text-gray-400 leading-normal">
                                                    对第 {skillReviewNum} 集的剧本进行色情、低俗、擦边、违规红线及合规精彩度审查。
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    {/* STEP 7: overseas */}
                                    {skillActiveStep === 7 && (
                                        <div className="space-y-4 animate-fade-in">
                                            <div className="space-y-1.5">
                                                <label className="text-[11px] font-black text-gray-600 dark:text-gray-400">选择目标集数</label>
                                                <select
                                                    value={skillReviewNum}
                                                    onChange={e => setSkillReviewNum(parseInt(e.target.value))}
                                                    className="w-full p-2.5 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-850 rounded-xl text-xs font-bold text-gray-800 dark:text-gray-200 focus:border-sky-500 focus:ring-1 focus:ring-sky-400/20 outline-none cursor-pointer"
                                                >
                                                    {Array.from({ length: 10 }).map((_, idx) => (
                                                        <option key={idx + 1} value={idx + 1}>
                                                            第 {idx + 1} 集剧本
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-[11px] font-black text-gray-600 dark:text-gray-400">目标出海市场与风格题材</label>
                                                <select
                                                    value={skillOverseasRegion}
                                                    onChange={e => setSkillOverseasRegion(e.target.value)}
                                                    className="w-full p-2.5 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-850 rounded-xl text-xs font-bold text-gray-800 dark:text-gray-200 focus:border-sky-500 focus:ring-1 focus:ring-sky-400/20 outline-none cursor-pointer"
                                                >
                                                    <option value="北美市场 (Billionaire/Werewolf)">北美市场 (Billionaire/Werewolf)</option>
                                                    <option value="东南亚市场 (霸总虐恋/复仇)">东南亚市场 (霸总虐恋/复仇)</option>
                                                    <option value="日韩市场 (校园恋爱/幻想穿越)">日韩市场 (校园恋爱/幻想穿越)</option>
                                                    <option value="拉丁美洲 (Telenovela 家族恩怨)">拉丁美洲 (Telenovela 家族恩怨)</option>
                                                </select>
                                                <p className="text-[10px] text-gray-400 leading-normal">
                                                    根据各地区审美与流行人设重组题材、地道台词化改写。
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    {/* STEP 8: export */}
                                    {skillActiveStep === 8 && (
                                        <div className="p-3 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-150 dark:border-indigo-900 rounded-xl space-y-2 text-xs">
                                            <p className="font-bold text-indigo-800 dark:text-indigo-400">导出商业白皮书</p>
                                            <p className="text-gray-600 dark:text-gray-300 leading-normal text-[11px]">
                                                一键合并前面的策划文档、人物志、合规风险评估，产出格式优雅、可提交至各大平台审核及投行融资的完整白皮书。
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {/* Right Side: Dynamic Workspace Output Preview Panel */}
                                <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-gray-900 border-l border-gray-150 dark:border-gray-800">
                                    <div className="flex items-center justify-between bg-gray-50/75 border-b border-gray-150 dark:bg-gray-850 dark:border-gray-800 px-4 py-2.5 flex-shrink-0">
                                        <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 text-[10px] font-bold">
                                            <span className="w-2.5 h-2.5 rounded-full bg-rose-400/80" />
                                            <span className="w-2.5 h-2.5 rounded-full bg-amber-400/80" />
                                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400/80" />
                                            <span className="ml-1.5 select-none text-gray-300 dark:text-gray-600">•</span>
                                            <span className="font-mono text-gray-500 dark:text-gray-400">
                                                {[
                                                    'start_proposal.md', 'creative_plan.md', 'character_cards.md', 'episode_outlines.md',
                                                    `episode_${skillEpisodeNum}_script.md`, `episode_${skillReviewNum}_compliance.md`,
                                                    `episode_${skillReviewNum}_overseas_en.md`, 'pitch_deck_proposal.md'
                                                ][skillActiveStep - 1]}
                                            </span>
                                        </div>

                                        {/* Action buttons inside output window */}
                                        <button
                                            onClick={() => {
                                                let textToCopy = '';
                                                if (skillActiveStep === 1) textToCopy = skillStartOutput;
                                                else if (skillActiveStep === 2) textToCopy = skillPlanOutput;
                                                else if (skillActiveStep === 3) textToCopy = skillCharOutput;
                                                else if (skillActiveStep === 4) textToCopy = skillOutlineOutput;
                                                else if (skillActiveStep === 5) textToCopy = skillEpisodesStore[skillEpisodeNum] || '';
                                                else if (skillActiveStep === 6) textToCopy = skillComplianceStore[skillReviewNum] || '';
                                                else if (skillActiveStep === 7) textToCopy = skillOverseasStore[skillReviewNum] || '';
                                                else if (skillActiveStep === 8) textToCopy = skillExportOutput;

                                                if (textToCopy) {
                                                    navigator.clipboard.writeText(textToCopy);
                                                    alert('✨ 已复制生成成果到剪切板！');
                                                } else {
                                                    alert('当前板块暂无输出内容');
                                                }
                                            }}
                                            className="px-2.5 py-1 rounded bg-white hover:bg-gray-50 dark:bg-gray-800 dark:hover:bg-gray-750 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 transition-all flex items-center gap-1 text-[10px] active:scale-95 shadow-sm cursor-pointer font-bold"
                                            title="复制当前生成文本"
                                        >
                                            <Copy className="w-3.5 h-3.5" />
                                            <span>复制</span>
                                        </button>
                                    </div>

                                    {/* Output viewer screen */}
                                    <div className="flex-grow overflow-y-auto p-6 custom-scrollbar leading-relaxed whitespace-pre-wrap select-text font-sans bg-white dark:bg-gray-900">
                                        {/* Show actual streaming content or empty state */}
                                        {(() => {
                                            let currentOutput = '';
                                            if (skillActiveStep === 1) currentOutput = skillStartOutput;
                                            else if (skillActiveStep === 2) currentOutput = skillPlanOutput;
                                            else if (skillActiveStep === 3) currentOutput = skillCharOutput;
                                            else if (skillActiveStep === 4) currentOutput = skillOutlineOutput;
                                            else if (skillActiveStep === 5) currentOutput = skillEpisodesStore[skillEpisodeNum] || '';
                                            else if (skillActiveStep === 6) currentOutput = skillComplianceStore[skillReviewNum] || '';
                                            else if (skillActiveStep === 7) currentOutput = skillOverseasStore[skillReviewNum] || '';
                                            else if (skillActiveStep === 8) currentOutput = skillExportOutput;

                                            if (!currentOutput) {
                                                return (
                                                    <div className="h-full flex flex-col items-center justify-center text-gray-400 py-20 select-none">
                                                        <Sparkles className="w-8 h-8 text-sky-500 mb-3 animate-pulse" />
                                                        <p className="text-[11px] font-extrabold text-gray-500 dark:text-gray-400">等待执行指令以生成创作成果</p>
                                                        <p className="text-[10px] text-gray-400 mt-1">请点击右上方“执行本步编剧指令”启动短剧智能协同创作</p>
                                                    </div>
                                                );
                                            }

                                            return <div className="text-gray-850 dark:text-gray-150 font-sans text-xs leading-relaxed select-text bg-transparent">{currentOutput}</div>;
                                        })()}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Single Episode Outline Edit Modal */}
            {showEditModal && editEpisodeIndex !== null && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col animate-scale-up">
                        <div className="flex items-center justify-between p-4 border-b border-gray-150 dark:border-gray-800 bg-gray-50 dark:bg-gray-950/30">
                            <h4 className="font-bold text-gray-900 dark:text-white flex items-center gap-1.5 text-sm">
                                <Pencil className="w-4.5 h-4.5 text-sky-500" />
                                修改单集大纲信息：第 {parsedEpisodes[editEpisodeIndex].episodeNumber} 集
                            </h4>
                            <button 
                                onClick={() => { setShowEditModal(false); setEditEpisodeIndex(null); }}
                                className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-5 space-y-4">
                            <div className="space-y-1.5">
                                <label className="block text-xs font-bold text-gray-500">分集标题</label>
                                <input 
                                    type="text" 
                                    value={editEpisodeTitle}
                                    onChange={e => setEditEpisodeTitle(e.target.value)}
                                    placeholder="输入分集故事标题..."
                                    className="w-full p-2.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800 text-sm font-bold text-gray-900 dark:text-white outline-none focus:bg-white"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="block text-xs font-bold text-gray-500">本集大纲内容（单集契合1.5分钟，约300字）</label>
                                <textarea 
                                    value={editOutlineText}
                                    onChange={e => setEditOutlineText(e.target.value)}
                                    rows={8}
                                    placeholder="详细起承转合、反转、高潮爽点与结尾悬念..."
                                    className="w-full p-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800 text-xs text-gray-800 dark:text-gray-200 outline-none leading-relaxed resize-none focus:bg-white"
                                />
                            </div>
                        </div>

                        <div className="p-4 border-t border-gray-150 dark:border-gray-800 bg-gray-50 dark:bg-gray-950/20 flex justify-end gap-2.5">
                            <button 
                                onClick={() => { setShowEditModal(false); setEditEpisodeIndex(null); }}
                                className="px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100"
                            >
                                取消
                            </button>
                            <button 
                                onClick={saveEditModal}
                                className="px-5 py-2 bg-sky-600 hover:bg-sky-550 text-white font-bold rounded-xl text-xs shadow-md transition-all active:scale-95"
                            >
                                确认保存修改
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Create New Script Project Modal */}
            {showCreateProjectModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col animate-scale-up">
                        <div className="flex items-center justify-between p-4 border-b border-gray-150 dark:border-gray-800 bg-gray-50 dark:bg-gray-950/30">
                            <h4 className="font-extrabold text-gray-900 dark:text-white flex items-center gap-2 text-sm">
                                <DocumentPlus className="w-5 h-5 text-sky-500 animate-pulse" />
                                选项确认：新建分集剧本项目
                            </h4>
                            <button 
                                onClick={() => setShowCreateProjectModal(false)}
                                className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-5 space-y-4">
                            <div className="p-3 bg-sky-50 dark:bg-sky-950/30 border border-sky-150 dark:border-sky-900/40 rounded-xl space-y-1">
                                <p className="text-[11px] text-sky-750 dark:text-sky-300 font-extrabold leading-normal">
                                    提示：进入{pendingMode === 'existing' ? '“已有故事梗概”' : '“生成故事梗概”'}模式前，我们需要在云端为您先开辟并储存一个独立剧本项目。
                                </p>
                            </div>

                            <div className="space-y-1.5">
                                <label className="block text-xs font-bold text-gray-600 dark:text-gray-400">剧本名称（项目标题）</label>
                                <input 
                                    type="text" 
                                    value={newProjectTitle}
                                    onChange={e => setNewProjectTitle(e.target.value)}
                                    placeholder="输入要创建的剧本项目名称..."
                                    className="w-full p-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800 text-sm font-bold text-gray-900 dark:text-white outline-none focus:bg-white"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="block text-xs font-bold text-gray-600 dark:text-gray-400">项目备注/描述（可选）</label>
                                <textarea 
                                    value={newProjectDesc}
                                    onChange={e => setNewProjectDesc(e.target.value)}
                                    rows={3}
                                    placeholder="输入简要的项目描述或脑洞设想..."
                                    className="w-full p-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800 text-xs text-gray-800 dark:text-gray-300 outline-none leading-relaxed resize-none focus:bg-white"
                                />
                            </div>
                        </div>

                        <div className="p-4 border-t border-gray-150 dark:border-gray-800 bg-gray-50 dark:bg-gray-950/20 flex justify-end gap-2.5">
                            <button 
                                onClick={() => setShowCreateProjectModal(false)}
                                className="px-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100"
                                disabled={creatingProjectInDB}
                            >
                                取消
                            </button>
                            <button 
                                onClick={handleConfirmCreateProject}
                                disabled={creatingProjectInDB}
                                className="px-5 py-2.5 bg-sky-600 hover:bg-sky-550 text-white font-bold rounded-xl text-xs shadow-md transition-all active:scale-95 flex items-center gap-1.5 disabled:opacity-70"
                            >
                                {creatingProjectInDB ? '正在为您开辟云端空间...' : <><Check className="w-4 h-4" /> 确认新建并开始</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Version History Modal */}
            {showHistoryModal && historyEpisodeIndex !== null && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl w-full max-w-4xl h-[80vh] shadow-2xl overflow-hidden flex flex-col animate-scale-up">
                        <div className="flex items-center justify-between p-4 border-b border-gray-150 dark:border-gray-800 bg-gray-50 dark:bg-gray-950/30">
                            <div>
                                <h4 className="font-extrabold text-gray-900 dark:text-white flex items-center gap-1.5 text-sm">
                                    <Database className="w-5 h-5 text-indigo-500" />
                                    第 {parsedEpisodes[historyEpisodeIndex].episodeNumber} 集 历史版本记录
                                </h4>
                                <p className="text-[10px] text-gray-400 mt-0.5">查看、对比以及一键恢复该分集在剧本创作 and 润色过程中的所有历史版本</p>
                            </div>
                            <button 
                                onClick={() => { setShowHistoryModal(false); setHistoryEpisodeIndex(null); setSelectedHistoryVersionIndex(null); }}
                                className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="flex-1 flex overflow-hidden">
                            {/* Left Panel: Versions list */}
                            <div className="w-1/3 border-r border-gray-150 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-950/25 overflow-y-auto p-3 space-y-2">
                                <div className="text-[11px] font-bold text-gray-400 px-1 mb-2">版本历史列表 ({parsedEpisodes[historyEpisodeIndex].history?.length || 0})</div>
                                {parsedEpisodes[historyEpisodeIndex].history?.map((version, vIdx) => (
                                    <div
                                        key={vIdx}
                                        onClick={() => setSelectedHistoryVersionIndex(vIdx)}
                                        className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${selectedHistoryVersionIndex === vIdx ? 'bg-indigo-50/70 border-indigo-200 dark:bg-indigo-950/30 dark:border-indigo-900' : 'bg-white border-gray-150 hover:bg-gray-50 dark:bg-gray-850 dark:border-gray-800 dark:hover:bg-gray-800'}`}
                                    >
                                        <div className="font-bold text-xs text-gray-800 dark:text-gray-200 line-clamp-1">{version.label}</div>
                                        <div className="text-[10px] text-gray-400 mt-1 flex items-center justify-between">
                                            <span>版本 #{vIdx + 1}</span>
                                            <span>{version.timestamp}</span>
                                        </div>
                                    </div>
                                ))}
                                {(!parsedEpisodes[historyEpisodeIndex].history || parsedEpisodes[historyEpisodeIndex].history!.length === 0) && (
                                    <div className="text-center py-8 text-xs text-gray-400">暂无版本记录</div>
                                )}
                            </div>

                            {/* Right Panel: Version content preview */}
                            <div className="flex-grow flex flex-col overflow-hidden bg-white dark:bg-gray-900">
                                {selectedHistoryVersionIndex !== null && parsedEpisodes[historyEpisodeIndex].history?.[selectedHistoryVersionIndex] ? (
                                    <>
                                        <div className="flex-shrink-0 bg-gray-50 dark:bg-gray-950/20 px-4 py-2 border-b border-gray-150 dark:border-gray-800 flex items-center justify-between">
                                            <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                                                正在预览：{parsedEpisodes[historyEpisodeIndex].history![selectedHistoryVersionIndex].label}
                                            </span>
                                            <button
                                                onClick={() => {
                                                    const chosenScript = parsedEpisodes[historyEpisodeIndex].history![selectedHistoryVersionIndex].script;
                                                    setParsedEpisodes(prev => prev.map((item, idx) => {
                                                        if (idx === historyEpisodeIndex) {
                                                            return { ...item, script: chosenScript, isDone: true };
                                                        }
                                                        return item;
                                                    }));
                                                    setShowHistoryModal(false);
                                                    setHistoryEpisodeIndex(null);
                                                    setSelectedHistoryVersionIndex(null);
                                                }}
                                                className="px-3 py-1 bg-indigo-600 hover:bg-indigo-550 text-white font-bold rounded-lg text-[10px] shadow-sm flex items-center gap-1 transition-all active:scale-95"
                                            >
                                                <ArrowPath className="w-3 h-3" /> 恢复此版本为当前剧本
                                            </button>
                                        </div>
                                        <div className="flex-grow p-4 overflow-y-auto font-mono text-xs text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed bg-gray-50/30 dark:bg-black/5 custom-scrollbar">
                                            {parsedEpisodes[historyEpisodeIndex].history![selectedHistoryVersionIndex].script}
                                        </div>
                                    </>
                                ) : (
                                    <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                                        <Database className="w-10 h-10 text-gray-300 mb-2" />
                                        <span className="text-xs">请在左侧选择要预览的历史版本</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="p-4 border-t border-gray-150 dark:border-gray-800 bg-gray-50 dark:bg-gray-950/20 flex justify-end">
                            <button 
                                onClick={() => { setShowHistoryModal(false); setHistoryEpisodeIndex(null); setSelectedHistoryVersionIndex(null); }}
                                className="px-4 py-2 bg-white hover:bg-gray-100 border border-gray-200 dark:bg-gray-850 dark:border-gray-700 dark:text-gray-300 rounded-xl text-xs font-bold transition-all"
                            >
                                关闭
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Project Delete Confirmation Modal */}
            {projectToDelete && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in p-4">
                    <div className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-xl">
                        <div className="flex items-center gap-3 text-rose-500">
                            <Trash className="w-6 h-6" />
                            <h4 className="font-extrabold text-base text-gray-900 dark:text-white">确认删除剧本项目？</h4>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                            您确定要删除项目 <span className="font-bold text-gray-800 dark:text-gray-200">《{projectToDelete.title}》</span> 吗？此操作将彻底删除该项目下的所有分集剧本和大纲，且无法恢复。
                        </p>
                        <div className="flex items-center justify-end gap-2 pt-2">
                            <button
                                onClick={() => setProjectToDelete(null)}
                                className="px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-bold transition-all"
                            >
                                取消
                            </button>
                            <button
                                onClick={handleConfirmDeleteProject}
                                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold shadow-md transition-all active:scale-95"
                            >
                                确认删除
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Prompt Selection Modal */}
            {isPromptModalOpen && (
                <PromptSelectionModal
                    isOpen={isPromptModalOpen}
                    onClose={() => setIsPromptModalOpen(false)}
                    onSelect={(prompt) => {
                        setSelectedPromptCard(prompt);
                        setPromptFormValues({});
                        setIsPromptModalOpen(false);
                    }}
                />
            )}
        </div>
    );
};
