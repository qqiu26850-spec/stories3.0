import React, { useState, useEffect, useRef } from 'react';
import { generateTextStream } from '../../services/geminiService';
import { createProject, saveChapterToDB, updateProject, deleteProject, fetchProjects } from '../../services/supabaseService';
import { 
    Sparkles, Film, Database, Copy, Stop, AdjustmentsHorizontal, Check, ArrowPath, 
    Play, Pencil, ClipboardDocumentCheck, DocumentPlus, Trash, Plus, 
    InformationCircle, X, ChevronDown, ChevronLeft, FloppyDisk 
} from '../Icon';
import CustomSelect from '../CustomSelect';

interface ScriptEpisodeGeneratorProps {
    onBack: () => void;
    onSaveSuccess?: () => void;
}

interface EpisodeOutline {
    episodeNumber: number;
    title: string;
    outline: string;
    script?: string;
    isGenerating?: boolean;
    isDone?: boolean;
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
    { value: "deepseek-chat", label: "奇思版 (DeepSeek)" },
    { value: "gemini-3.5-flash", label: "妙写版 (Gemini 3.5 Flash)" },
    { value: "gemini-3.5-pro", label: "深度版 (Gemini 3.5 Pro)" },
    { value: "doubao-flash", label: "速写版 (豆包)" }
];

export const ScriptEpisodeGenerator: React.FC<ScriptEpisodeGeneratorProps> = ({ onBack, onSaveSuccess }) => {
    // Stage navigation: 'project_dashboard' | 'mode_select' | 'outline_form_existing' | 'outline_form_new' | 'outline_generating' | 'outline_results' | 'script_generation' | 'completed'
    const [stage, setStage] = useState<'project_dashboard' | 'mode_select' | 'outline_form_existing' | 'outline_form_new' | 'outline_generating' | 'outline_results' | 'script_generation' | 'completed'>('project_dashboard');
    const [outlineMode, setOutlineMode] = useState<'existing' | 'new' | null>(null);
    
    // Project Dashboard states
    const [episodeProjects, setEpisodeProjects] = useState<any[]>([]);
    const [loadingProjects, setLoadingProjects] = useState(false);
    
    // Core parameters
    const [episodesCount, setEpisodesCount] = useState<number>(10);
    const [model, setModel] = useState('gemini-3.5-flash');
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

    // Script creation states
    const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
    const [showCreateProjectModal, setShowCreateProjectModal] = useState(false);
    const [pendingMode, setPendingMode] = useState<'existing' | 'new' | null>(null);
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
    
    const abortControllerRef = useRef<AbortController | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const aiChatScrollRef = useRef<HTMLDivElement>(null);

    const loadEpisodeProjects = async () => {
        setLoadingProjects(true);
        setError('');
        try {
            const allProjects = await fetchProjects(1, 100);
            const filtered = allProjects.filter((p: any) => p.type === 'script_episode');
            setEpisodeProjects(filtered);
        } catch (err: any) {
            console.error("Failed to load episode projects:", err);
            setError('加载剧本项目库失败，请重试');
        } finally {
            setLoadingProjects(false);
        }
    };

    useEffect(() => {
        loadEpisodeProjects();
    }, []);

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
                    title: projectTitle || '未命名剧本',
                    description: description,
                    script_data: scriptData
                });

                // Save chapters quietly as well
                for (let i = 0; i < parsedEpisodes.length; i++) {
                    const ep = parsedEpisodes[i];
                    const content = `【分集故事梗概】：\n${ep.outline}\n\n=====================================\n\n【本集正式剧本】：\n${ep.script || '（未生成该集剧本）'}`;
                    await saveChapterToDB(currentProjectId, `new-scene-${currentProjectId}-${i}`, ep.title, content, i + 1);
                }

                setSyncStatus('success');
            } catch (err) {
                console.error('Auto save to cloud failed:', err);
                setSyncStatus('error');
            }
        }, 1500); // 1.5 seconds debounce for faster feedback

        return () => clearTimeout(timer);
    }, [parsedEpisodes, projectTitle, aiChatMessages, stage]);

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

    const handleDeleteProject = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm('确定要删除这个剧本项目吗？此操作无法撤销。')) return;
        try {
            await deleteProject(id);
            setEpisodeProjects(prev => prev.filter(p => p.id !== id));
        } catch (err: any) {
            console.error("Failed to delete project:", err);
            alert("删除项目失败，请重试");
        }
    };

    const handleHeaderBack = () => {
        if (stage === 'project_dashboard') {
            onBack();
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
    const parsePartialOutlines = (jsonStr: string): { episodeNumber?: number; title?: string; outline?: string }[] => {
        const results: { episodeNumber?: number; title?: string; outline?: string }[] = [];
        const objectBlocks = jsonStr.split(/\{/);
        
        for (let i = 1; i < objectBlocks.length; i++) {
            const block = objectBlocks[i];
            
            let episodeNumber: number | undefined;
            const numMatch = block.match(/["']episodeNumber["']\s*:\s*(\d+)/i);
            if (numMatch) {
                episodeNumber = parseInt(numMatch[1]);
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
            
            if (episodeNumber !== undefined || title !== undefined || outline !== undefined) {
                results.push({ episodeNumber, title, outline });
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

        const currentOutlinesStr = parsedEpisodes.map(ep => 
            `【第${ep.episodeNumber}集：${ep.title}】\n${ep.outline}`
        ).join('\n\n');

        let prompt = '';
        if (chatScope === 'single') {
            prompt = `你是一个顶级爆款短剧导演和编剧。用户想通过对话，协同优化这套分集剧情大纲中的【第 ${chatTargetEpisode} 集】。

【当前优化范围】：【单集针对性修改】 - 仅修改【第 ${chatTargetEpisode} 集】。

【用户的具体修改指令】：
“${userMsg}”

【当前第 ${chatTargetEpisode} 集的大纲内容】：
${parsedEpisodes.find(ep => ep.episodeNumber === chatTargetEpisode)?.outline || ''}

【全剧上下文参考】：
${currentOutlinesStr}

---

【输出规范与要求】：
1. 首先，请以专业编剧的视角，用亲切易懂的语言向用户分析和解释你对【第 ${chatTargetEpisode} 集】做出的具体内容优化思路，以及这一集在全剧大纲承上启下中的关键作用。
2. 接着，你必须输出一个包含修改后大纲的 JSON 数组。
3. 请只在 JSON 数组中输出【第 ${chatTargetEpisode} 集】（以及若有连锁关联的个别受影响集数）的更新大纲。绝对不要在 JSON 中输出未修改的其他集数大纲，避免冗余和打扰。
4. 请将该JSON数组严格用代码块标记 \`\`\`json ... \`\`\` 包裹起来。
5. JSON格式必须严格为以下格式，不要有任何多余的键名：
\`\`\`json
[
  {
    "episodeNumber": ${chatTargetEpisode},
    "title": "第${chatTargetEpisode}集标题",
    "outline": "本集优化后的具体大纲内容..."
  }
]
\`\`\`
注意：大纲内容应当保持在大约300字到450字左右的精炼梗概。`;
        } else {
            prompt = `你是一个顶级爆款短剧导演和编剧。用户想通过对话，协同优化这套【${parsedEpisodes.length}集】的全剧分集剧情大纲。

【当前优化范围】：【全剧整体修改】

【用户的具体修改指令】：
“${userMsg}”

【当前所有集数的大纲内容如下】：
${currentOutlinesStr}

---

【输出规范与要求】：
1. 首先，请以专业编剧的视角，用亲切易懂的语言向用户详细分析本次整体优化调整了哪些冲突，强化了哪些钩子，如何让剧情更加抓人。
2. 接着，你必须输出一份完整更新后的【各集大纲JSON数组】，以便系统能够自动解析并让用户一键应用修改。
3. 请将该JSON数组严格用代码块标记 \`\`\`json ... \`\`\` 包裹起来。
4. JSON数组的格式必须严格为以下格式，不要有任何多余的键名：
\`\`\`json
[
  {
    "episodeNumber": 1,
    "title": "第1集标题",
    "outline": "本集具体大纲内容..."
  },
  ...
]
\`\`\`
注意：大纲内容应当保持在每集分集梗概的情节长度设计，完美契合单集大概1分半（90秒）左右的微短剧视频剧情量（对应每集大约300字到450字的精炼梗概）。请完整输出所有集数，不要简写。`;
        }

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
            const jsonRegex = /```json\s*([\s\S]*?)\s*```/;
            const match = content.match(jsonRegex);
            let jsonText = '';

            if (match && match[1]) {
                jsonText = match[1].trim();
            } else {
                const startIdx = content.indexOf('[');
                const endIdx = content.lastIndexOf(']');
                if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
                    jsonText = content.substring(startIdx, endIdx + 1);
                }
            }

            if (!jsonText) {
                alert('未在大师回复中检测到结构化大纲标记，请确保AI输出了标准JSON格式代码块！');
                return;
            }

            const arr = JSON.parse(jsonText);
            if (Array.isArray(arr)) {
                setParsedEpisodes(prev => {
                    const next = [...prev];
                    arr.forEach((item: any) => {
                        const epNum = parseInt(item.episodeNumber);
                        if (!isNaN(epNum)) {
                            const matchIdx = next.findIndex(x => x.episodeNumber === epNum);
                            if (matchIdx !== -1) {
                                next[matchIdx] = {
                                    ...next[matchIdx],
                                    title: String(item.title || next[matchIdx].title),
                                    outline: String(item.outline || next[matchIdx].outline)
                                };
                            } else {
                                next.push({
                                    episodeNumber: epNum,
                                    title: String(item.title || `第${epNum}集`),
                                    outline: String(item.outline || ''),
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

    // Helper to parse outlines from raw generated text
    const parseOutlines = (rawText: string, expectedCount: number): EpisodeOutline[] => {
        const list: EpisodeOutline[] = [];
        
        // Pattern supporting both Arabic numbers and Chinese characters for episode numbers
        const pattern = /(?:【?第\s*([0-9一二三四五六七八九十百]+)\s*集】?[:：\-\s]*([^\n]*))/g;
        const matches = Array.from(rawText.matchAll(pattern)) as any[];
        
        if (matches.length > 0) {
            for (let i = 0; i < matches.length; i++) {
                const match = matches[i];
                const rawNum = match[1];
                let title = match[2].trim() || `第${rawNum}集`;
                if (title.startsWith('：') || title.startsWith(':')) {
                    title = title.substring(1).trim();
                }
                
                const startIndex = match.index! + match[0].length;
                const endIndex = i + 1 < matches.length ? matches[i + 1].index : rawText.length;
                let content = rawText.substring(startIndex, endIndex).trim();
                
                // Clean up typical headers and labels that models love to prepend
                content = content.replace(/^[:：\s\[\]梗概剧情本集内容内容等及核心事件对立冲突爆点分集标题次]+/, '').trim();
                
                // Try to parse the episode number, if it's a Chinese number, fall back to index + 1
                let epNum = parseInt(rawNum);
                if (isNaN(epNum)) {
                    epNum = i + 1;
                }
                
                list.push({
                    episodeNumber: epNum,
                    title: title || `第${epNum}集`,
                    outline: content,
                });
            }
        }
        
        // Fallback: If no matches or parsing was empty, split by paragraphs
        if (list.length === 0) {
            const paragraphs = rawText.split(/\n+/).filter(p => p.trim().length > 10);
            const count = Math.min(paragraphs.length, expectedCount);
            for (let i = 0; i < count; i++) {
                list.push({
                    episodeNumber: i + 1,
                    title: `第${i + 1}集`,
                    outline: paragraphs[i],
                });
            }
            // Fill up remainder
            for (let i = list.length; i < expectedCount; i++) {
                list.push({
                    episodeNumber: i + 1,
                    title: `第${i + 1}集`,
                    outline: '待输入或生成剧情大纲...',
                });
            }
        }
        
        return list;
    };

    // Parse Outlines on state changes
    useEffect(() => {
        if ((stage === 'outline_generating' || stage === 'outline_results') && outlineRawText) {
            const newList = parseOutlines(outlineRawText, episodesCount);
            setParsedEpisodes(prev => {
                // If we already have episodes, merge them to keep existing scripts intact!
                if (prev && prev.length > 0) {
                    return newList.map(newEp => {
                        const prevEp = prev.find(p => p.episodeNumber === newEp.episodeNumber);
                        if (prevEp) {
                            return {
                                ...newEp,
                                script: prevEp.script || newEp.script,
                                isDone: prevEp.isDone || newEp.isDone,
                                isGenerating: prevEp.isGenerating || newEp.isGenerating
                            };
                        }
                        return newEp;
                    });
                }
                return newList;
            });
        }
    }, [outlineRawText, episodesCount, stage]);

    // Handle File upload
    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = (ev) => {
                setExistingOutline(ev.target?.result as string || '');
            };
            reader.readAsText(file);
        }
    };

    // Generate Outlines
    const handleGenerateOutline = async () => {
        setError('');
        setOutlineRawText('');
        setStage('outline_generating');
        setGlobalIsGenerating(true);
        
        let prompt = '';
        if (outlineMode === 'existing') {
            prompt = `【任务类型】：分集故事梗概拆分
【目标集数】：${episodesCount} 集

【原始故事梗概】：
${existingOutline}

---

【拆分与续写指令】：
请严格基于上述【原始故事梗概】，将整篇故事按照**其中蕴含的具体故事梗概的事件节点、冲突爆点与剧情转折点**，艺术化、戏剧化地拆分并扩写为共【${episodesCount}集】的AI短剧的分集梗概。
请注意：用户提供的故事梗概可能是一整段连续的文字，完全没有具体的分集或数字编号。你必须：
1. **深度挖掘与拆解事件点**：找出故事中所有的关键情节里程碑（如：开端受辱、获得奇遇、隐藏身份、恶势力挑衅、误会爆发、正面冲突、高潮打脸、真相大白等具体事件点）。
2. **以事件点为边界进行拆分**：将这 ${episodesCount} 集中的每一集都紧密围绕一个具体的、有强戏剧冲突的【故事事件点】来构建，千万不要死板、生硬地按字数或段落进行平均机械切片。
3. **合理延展与扩写**：如果原始梗概在某些阶段描述简略或字数太少，你需要根据前后文的情理，发挥爆款AI短剧“快节奏、强冲突、高反转”的特点，对这些事件节点进行合理的细节扩写和尾部钩子设计，确保最终凑足完整的 ${episodesCount} 集分集，且每一集都信息量饱满。
4. 每一集格式必须严格统一：
【第X集：分集标题】
核心事件：本集的核心故事事件点/矛盾爽点。
本集梗概：本集具体的起承转合推演，不少于150字，且在集尾留下强烈的悬念或吸睛钩子。
5. 请确保输出完整的【第1集】到【第${episodesCount}集】，保证各集之间递进自然、逻辑严密，无任何断代或情节飞跃。
6. 直接输出内容，不要有任何多余的开场白或解释。`;
        } else {
            const selectedTemplate = PROMPT_LIBRARY.find(p => p.id === selectedPromptId) || PROMPT_LIBRARY[0];
            prompt = `【任务类型】：爆款微短剧分集大纲智能生成
【目标集数】：${episodesCount} 集
【时代背景】：${selectedEra || '未指定'}
【短剧主题】：${selectedThemePlots.join('， ') || theme}
【角色设定】：${selectedCharacters.join('， ') || '未指定'}
${coreTrope ? `【核心梗】：${coreTrope}\n` : ''}
【核心剧情脑洞/简单故事雏形】：
${coreIdea}

---

【编剧指令（由选择提示词库加载）】：
${selectedTemplate.prompt}

---

【大纲创作金牌规范要求（极其重要，严格执行）】：
1. 必须保持【强情绪、强剧情开局】：第1集必须有极其强烈的戏剧冲突、情绪对立或尊严危机，一上来就有极大的矛盾爆发，瞬间抓住读者眼球。
2. 必须有【明显的节奏点、剧情卡点（Hook）】：在每一集的结尾，必须设置极具悬念的钩子、打脸的前奏或突如其来的反转，让观众产生强烈的“继续观看/自动解锁下一集”的冲动。
3. 必须融入【爆火的元素设定】：将扮演反差、真假少爷千金、扮猪吃虎、隐藏身份、高燃打脸逆袭等钩子完美融合到情节中。
4. 【写清楚具体的情节点和行动】：绝不能使用笼统、空洞的词汇描述剧情（如：严禁只写“两人产生误会”，而要写清楚“反派王强故意在女主面前拉住男主的手，并掏出一张伪造的孕检单，指责男主始乱终弃，女主愤而掌掴男主，男主因声带受伤无法辩解”等具体、细腻的情节画面和爽点！）。

---

【输出格式规范】：
请严格按照以下格式完整输出从【第1集】到【第${episodesCount}集】的详细大纲内容：
【第X集：分集标题】
核心事件：本集的核心打脸、冲突、事件或情绪卡点。
本集梗概：具体情节详细推演，不少于150字，必须写清楚具体的情节点 and 人物白热化的具体互动，每集末尾制造巨大的危机或强悬念。

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
            
            // Failsafe: Parse and apply the final episodes directly
            const finalEpisodes = parseOutlines(finalText, episodesCount);
            setParsedEpisodes(finalEpisodes);
            
            setStage('outline_results');
        } catch (err: any) {
            if (err.message !== 'Aborted') {
                setError(err.message || '生成失败，请重试');
                setStage(outlineMode === 'existing' ? 'outline_form_existing' : 'outline_form_new');
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
        
        // Setup initial blank script for this episode
        setParsedEpisodes(prev => prev.map((item, idx) => 
            idx === index ? { ...item, script: '', isGenerating: true } : item
        ));

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
请将上述【分集剧情大纲】的情节，扩展为高戏剧冲突、爽点鲜明、字数大约500-800字、播放时长约1.5分钟的单集正式剧本。剧本生成的过程中要强化开头和卡点的表现，用具体的、炸裂的、情绪化的画面动作和人物话语来强化剧情。
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
   - 必须以三角形符号“△ ”（符号后跟一个空格）开头。
   - 例如：
   △ 她想悄悄退回去，但脚下高跟鞋踩在地板上发出了一声轻响。角落里的两个人迅速分开，女生慌张地推开厉维，两人齐齐转向看向她。
   △ 乔以安这才看清那个女生的脸——是周婉清。
   △ 三人在走廊拐角处面面相觑。空气凝固了整整三秒。

4. **角色对白/台词**：
   - 格式为：角色名字（神态或动作语气描述）：台词内容
   - 格式为：角色名字（神态或动作语气描述）：台词内容
   - 例如：
   乔以安（声音有些僵硬）：我一定是喝多了！？
   厉维（嘴角扬起一抹冷笑，眼神充满不屑）：呵，你觉得呢？

5. **特别禁用限制**：
   - 严禁输出任何“好的”、“没问题”、“下面是为您创作的第X集剧本”等与剧情无关的解释、开场白、问候语或总结。
   - 必须只输出标准的剧本对白本体。
   - 每行内容（场景标题、动作描写、角色台词）都必须按照上述格式独立成行，排版清晰美观。`;

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

            let fullText = '';
            for await (const chunk of stream) {
                fullText += chunk;
                setParsedEpisodes(prev => prev.map((item, idx) => 
                    idx === index ? { ...item, script: fullText } : item
                ));
            }
            
            setParsedEpisodes(prev => prev.map((item, idx) => 
                idx === index ? { ...item, isGenerating: false, isDone: true } : item
            ));
            
            return fullText;
        } catch (err: any) {
            setParsedEpisodes(prev => prev.map((item, idx) => 
                idx === index ? { ...item, isGenerating: false } : item
            ));
            throw err;
        } finally {
            setActiveGeneratingIndex(null);
        }
    };

    const handleSingleEpisodeEditChange = (idx: number, value: string) => {
        setSingleEpisodeEdits(prev => ({ ...prev, [idx]: value }));
    };

    const handleSingleEpisodeOptimize = async (index: number) => {
        const instruction = singleEpisodeEdits[index];
        if (!instruction || !instruction.trim()) return;

        const ep = parsedEpisodes[index];
        setParsedEpisodes(prev => prev.map((item, id) => 
            id === index ? { ...item, isGenerating: true } : item
        ));

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

            setParsedEpisodes(prev => prev.map((item, idx) => 
                idx === index ? { ...item, isGenerating: false, isDone: true } : item
            ));
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

    const handleInitiateMode = (mode: 'existing' | 'new') => {
        if (currentProjectId) {
            setOutlineMode(mode);
            if (mode === 'existing') {
                setStage('outline_form_existing');
            } else {
                setStage('outline_form_new');
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
        
        setNewProjectTitle(`新爆款分集剧本_${timeStr}`);
        setNewProjectDesc('AI智能辅助规划的分集剧本创作项目');
        setShowCreateProjectModal(true);
    };

    const handleConfirmCreateProject = async () => {
        if (!newProjectTitle.trim()) {
            alert('请输入剧本名称');
            return;
        }
        setCreatingProjectInDB(true);
        setError('');
        try {
            const { id: projectId, error: createError } = await createProject(
                newProjectTitle,
                newProjectDesc || '分集剧本创作',
                'script_episode'
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
                                                        onClick={(e) => handleDeleteProject(proj.id, e)}
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
                    <div className="flex-1 flex flex-col justify-center items-center p-8 max-w-4xl mx-auto space-y-8 animate-fade-in">
                        <div className="text-center space-y-2">
                            <h3 className="text-2xl font-bold text-gray-800 dark:text-white">您如何开始分集剧本创作？</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400">选择符合您当前素材状态的模式，AI将精准承接上下文为您拆分各集大纲</p>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full">
                            <button 
                                onClick={() => handleInitiateMode('existing')}
                                className="group p-8 bg-white dark:bg-gray-900 rounded-2xl border-2 border-gray-100 dark:border-gray-800 hover:border-sky-500 dark:hover:border-sky-500 transition-all hover:shadow-lg text-center flex flex-col items-center"
                            >
                                <div className="w-16 h-16 bg-sky-50 dark:bg-sky-950 rounded-full flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                                    <ClipboardDocumentCheck className="w-8 h-8 text-sky-500" />
                                </div>
                                <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-2">已有故事梗概</h4>
                                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                                    上传或粘贴您自创的小说/梗概，指定您想要的集数，AI将精确将其拆分为高节奏的分集剧情大纲。
                                </p>
                            </button>

                            <button 
                                onClick={() => handleInitiateMode('new')}
                                className="group p-8 bg-white dark:bg-gray-900 rounded-2xl border-2 border-gray-100 dark:border-gray-800 hover:border-purple-500 dark:hover:border-purple-500 transition-all hover:shadow-lg text-center flex flex-col items-center"
                            >
                                <div className="w-16 h-16 bg-purple-50 dark:bg-purple-950 rounded-full flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                                    <Sparkles className="w-8 h-8 text-purple-500" />
                                </div>
                                <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-2">生成故事梗概</h4>
                                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                                    没有现成故事？勾选您喜爱的短剧风格、爆点元素、核心创意脑洞，让AI大模型全自动编织出整套微短剧分集大纲。
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
                        <div className="w-full lg:w-[420px] flex flex-col bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 overflow-y-auto p-6 space-y-6">
                            <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-1.5 border-b pb-3">
                                <AdjustmentsHorizontal className="w-5 h-5 text-purple-500" />
                                短剧生成高级设定
                            </h3>

                            {/* Prompt Library */}
                            <div className="space-y-2">
                                <label className="block text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider">选择剧本模版 / 提示词库</label>
                                <div className="grid grid-cols-1 gap-2">
                                    {PROMPT_LIBRARY.map((item) => (
                                        <div 
                                            key={item.id}
                                            onClick={() => setSelectedPromptId(item.id)}
                                            className={`p-3 border rounded-xl cursor-pointer transition-all ${selectedPromptId === item.id ? 'bg-purple-50/60 border-purple-400 dark:bg-purple-950/20' : 'bg-white dark:bg-gray-900 border-gray-150 dark:border-gray-800 hover:border-gray-300'}`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-bold text-gray-800 dark:text-white">{item.name}</span>
                                                {selectedPromptId === item.id && <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />}
                                            </div>
                                            <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1 line-clamp-1 leading-normal">{item.desc}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Era option */}
                            <div className="space-y-2">
                                <label className="block text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider">时代背景 (单选)</label>
                                <div className="flex flex-wrap gap-1.5">
                                    {ERA_OPTIONS.map(opt => (
                                        <button 
                                            key={opt}
                                            onClick={() => setSelectedEra(opt)}
                                            className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${selectedEra === opt ? 'bg-purple-50 text-purple-600 border-purple-300 dark:bg-purple-950/40 dark:text-purple-400' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700'}`}
                                        >
                                            {opt}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Theme plot option */}
                            <div className="space-y-2">
                                <label className="block text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider">主题情节 (图二标签 - 可多选)</label>
                                <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto p-2 border border-gray-150 dark:border-gray-800 rounded-xl bg-gray-50/50 dark:bg-gray-950/20 custom-scrollbar">
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

                            {/* Character Settings option */}
                            <div className="space-y-2">
                                <label className="block text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider">角色设定 (图一标签 - 可多选)</label>
                                <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto p-2 border border-gray-150 dark:border-gray-800 rounded-xl bg-gray-50/50 dark:bg-gray-950/20 custom-scrollbar">
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
                                <label className="block text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider">核心梗 (非必填)</label>
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
                                className="w-full py-3.5 bg-purple-600 hover:bg-purple-550 text-white font-bold rounded-xl shadow-lg hover:shadow-purple-500/20 transition-all active:scale-95 disabled:bg-gray-300 disabled:shadow-none"
                            >
                                <Sparkles className="w-5 h-5 inline mr-1" /> 智能一键生成微短剧剧本大纲
                            </button>
                        </div>

                        {/* Right Creative Hook Input */}
                        <div className="flex-grow flex flex-col p-8 overflow-hidden bg-gray-50/50 dark:bg-gray-950/20">
                            <div className="flex-1 bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-2xl p-6 flex flex-col space-y-4 shadow-sm animate-fade-in" style={{ height: '600px' }}>
                                <div className="flex items-center justify-between pb-2 border-b">
                                    <div className="flex items-center gap-2">
                                        <Sparkles className="text-purple-500 animate-pulse" style={{ width: '35px', height: '35px' }} />
                                        <h4 className="text-sm font-bold text-gray-800 dark:text-white">请在此处输入核心梗或简单故事雏形：</h4>
                                    </div>
                                    <span className="text-[11px] text-gray-400">支持 1.5分钟/每集 情节智能生成</span>
                                </div>

                                <textarea 
                                    value={coreIdea} 
                                    onChange={e => setCoreIdea(e.target.value)}
                                    placeholder="例如：穷学生顾云在兼职外卖被富二代欺负时，突然接到一通神秘电话，原来自己竟然是华夏顶级财阀的第一顺位继承人，坐拥千亿资产！从此，顾云被迫踏上扮猪吃虎、隐藏身份清算仇敌的道路..."
                                    className="flex-grow w-full p-4 bg-gray-50/50 dark:bg-gray-800 border border-gray-150 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-xs resize-none text-gray-800 dark:text-gray-150 leading-relaxed font-medium"
                                    style={{ height: '500px' }}
                                />
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
                            <div className="flex-shrink-0 p-4 border-b bg-gray-50/50 dark:bg-gray-950/25 flex items-center justify-between" style={{ height: '66px' }}>
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
                            <div className="flex-shrink-0 p-4 border-b bg-white dark:bg-gray-900 flex flex-col sm:flex-row sm:items-center justify-between gap-2" style={{ height: '66px' }}>
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
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="w-5 h-5 rounded-full bg-purple-500 text-white text-[10px] font-black flex items-center justify-center">
                                                                                {ep.episodeNumber || '?'}
                                                                            </span>
                                                                            <span className="font-extrabold text-[11px] text-purple-900 dark:text-purple-200">
                                                                                {ep.title || '标题生成中...'}
                                                                            </span>
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
                                                {msg.role === 'assistant' && !aiIsGenerating && (msg.content.includes('```json') || msg.content.includes('[')) && (
                                                    <div className="mt-3.5 pt-2.5 border-t border-gray-100 dark:border-gray-800 flex justify-end">
                                                        <button 
                                                            onClick={() => extractAndApplyOutlines(msg.content)}
                                                            className="px-3 py-1.5 bg-gradient-to-r from-purple-600 to-sky-600 hover:opacity-90 text-white font-bold rounded-lg text-[11px] shadow-sm flex items-center gap-1 transition-all animate-bounce"
                                                        >
                                                            <Check className="w-3.5 h-3.5" /> 一键应用此优化方案到分集大纲
                                                        </button>
                                                    </div>
                                                )}
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
        </div>
    );
};
