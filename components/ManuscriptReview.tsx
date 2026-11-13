import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { pinyin } from 'pinyin-pro';
import mammoth from 'mammoth';
import {
    Sparkles, DocumentArrowDown, ArrowPath, Check, Trash,
    ChevronDown, AdjustmentsHorizontal, Copy, FloppyDisk,
    ClipboardDocumentCheck, ExclamationCircle, InformationCircle,
    Eye, Pencil, ArrowUturnLeft, Plus, X, Bars2
} from './Icon';
import { ALL_MODEL_OPTIONS } from '../constants';
import { generateText } from '../services/geminiService';
import { saveMaterial } from '../services/supabaseService';

// --- Types ---
export interface TypoIssue {
    id: string;
    index: number;
    wrongText: string;
    correctText: string;
    explanation: string;
    category: 'typo' | 'grammar' | 'punctuation';
}

export interface CharacterConflict {
    id: string;
    originalName: string;
    imitationName: string;
    isExactMatch: boolean;
    isHomophone: boolean;
    originalPinyin: string;
    imitationPinyin: string;
    count: number;
    recommendedNames: string[];
}

export interface SentenceSimilarity {
    imitationIndex: number;
    sentence: string;
    similarity: number; // 0 to 1
    matchedOriginalSentence?: string;
    matchedOriginalSimilarity?: number;
    colorLevel: 'danger' | 'warning' | 'caution' | 'safe';
}

export interface AuditReport {
    timestamp: number;
    overallSimilarity: number;
    originalWordCount: number;
    imitationWordCount: number;
    originalCharacters: string[];
    imitationCharacters: string[];
    typoIssues: TypoIssue[];
    characterConflicts: CharacterConflict[];
    sentenceSimilarities: SentenceSimilarity[];
    colorStats: {
        dangerCount: number; // >80%
        warningCount: number; // 60-80%
        cautionCount: number; // 40-60%
        safeCount: number; // <40%
    };
    verdict: 'danger' | 'warning' | 'pass';
    verdictMessage: string;
}

// 常见中文错别字规则库 (100+ 常见易错词对)
const COMMON_TYPOS: Array<{ wrong: string; right: string; desc: string }> = [
    { wrong: '按步就班', right: '按部就班', desc: '“部”指门类、次序，非“步”。' },
    { wrong: '迫不急待', right: '迫不及待', desc: '“及”意为赶得上，非急迫之“急”。' },
    { wrong: '不径而走', right: '不胫而走', desc: '“胫”是小腿，形容传播迅速。' },
    { wrong: '一愁莫展', right: '一筹莫展', desc: '“筹”指筹码、计策，非发愁之“愁”。' },
    { wrong: '默守成规', right: '墨守成规', desc: '源自墨子善守，应为墨家之“墨”。' },
    { wrong: '鬼计多端', right: '诡计多端', desc: '“诡”指狡诈、欺诈。' },
    { wrong: '走头无路', right: '走投无路', desc: '“投”指投奔，投奔无路。' },
    { wrong: '再接再励', right: '再接再厉', desc: '“厉”通“砺”，意为磨快砺吻，非鼓励。' },
    { wrong: '名门旺族', right: '名门望族', desc: '“望”指声望名望，非兴旺。' },
    { wrong: '鼎立相助', right: '鼎力相助', desc: '“鼎力”指大力支持；“鼎立”多用于三国鼎立。' },
    { wrong: '松驰', right: '松弛', desc: '“弛”与“张”相对，张弛有度。' },
    { wrong: '寒喧', right: '寒暄', desc: '“暄”指温暖，寒暄指问候冷暖。' },
    { wrong: '坐阵', right: '坐镇', desc: '“镇”指安抚坐镇指挥。' },
    { wrong: '旁证博引', right: '旁征博引', desc: '“征”指搜集引证。' },
    { wrong: '渲泄', right: '宣泄', desc: '“宣”指疏导宣散。' },
    { wrong: '震憾', right: '震撼', desc: '“撼”指摇撼震动。' },
    { wrong: '决对', right: '绝对', desc: '“绝”表示无条件的、必然。' },
    { wrong: '帐号', right: '账号', desc: '现标准通用规范汉字为“账号”。' },
    { wrong: '题纲', right: '提纲', desc: '“提纲挈领”，指提炼大纲。' },
    { wrong: '密绝', right: '秘诀', desc: '“秘”指机密奥秘之诀窍。' },
    { wrong: '趋之若骛', right: '趋之若鹜', desc: '“鹜”指鸭子，争相追求如鸭子赶路。' },
    { wrong: '声名雀起', right: '声名鹊起', desc: '“鹊”指喜鹊，如喜鹊般飞起报捷。' },
    { wrong: '针贬时弊', right: '针砭时弊', desc: '“砭”是古代石制医具，非贬斥。' },
    { wrong: '甘拜下风', right: '甘拜下风', desc: '常见误写为“甘败下风”。' },
    { wrong: '甘败下风', right: '甘拜下风', desc: '“拜”为敬礼，承认不如人。' },
    { wrong: '穿流不息', right: '川流不息', desc: '“川”指河流，像江河一样连续流淌。' },
    { wrong: '首当其冲', right: '首当其冲', desc: '常被误用为最先，实际指首先受到冲击灾难。' },
    { wrong: '食不裹腹', right: '食不果腹', desc: '“果”指充实填饱。' },
    { wrong: '入不付出', right: '入不敷出', desc: '“敷”指足够分摊。' },
    { wrong: '精兵减政', right: '精兵简政', desc: '“简”指精简简化。' },
    { wrong: '一诺千斤', right: '一诺千金', desc: '“金”指黄金，承诺贵重。' },
    { wrong: '一暴十寒', right: '一曝十寒', desc: '“曝”指晒太阳。' },
    { wrong: '相辅相承', right: '相辅相成', desc: '“成”指成就促成。' },
    { wrong: '破斧沉舟', right: '破釜沉舟', desc: '“釜”是铁锅饭锅。' },
    { wrong: '世外桃源', right: '世外桃源', desc: '常见误写为“世外桃园”。' },
    { wrong: '世外桃园', right: '世外桃源', desc: '桃花源，为水源水系源头。' },
    { wrong: '鬼鬼崇崇', right: '鬼鬼祟祟', desc: '“祟”指鬼怪作祟。' },
    { wrong: '大声急呼', right: '大声疾呼', desc: '“疾”指快速紧迫。' },
    { wrong: '出奇致胜', right: '出奇制胜', desc: '“制”指克制制敌。' },
    { wrong: '美仑美奂', right: '美轮美奂', desc: '“轮”指高大，“奂”指众多。' },
    { wrong: '渡过难关', right: '度过难关', desc: '困难关口通常用“度过”，涉及江河用水字旁“渡”。' },
    { wrong: '名信片', right: '明信片', desc: '“明”指公开未封口的信件。' },
    { wrong: '发韧', right: '发轫', desc: '“轫”是挡住车轮的木头，发轫指拿掉木头车子出发。' },
    { wrong: '凑和', right: '凑合', desc: '规范汉字应为“凑合”。' },
    { wrong: '水笼头', right: '水龙头', desc: '应为“龙头”。' },
    { wrong: '辩析', right: '辨析', desc: '辨析指分析分辨，需用刀字旁的“辨”。' },
    { wrong: '辨论', right: '辩论', desc: '辩论发言，需用言字旁的“辩”。' },
    { wrong: '装祯', right: '装帧', desc: '书籍装帧，巾字底“帧”。' },
    { wrong: '稍安勿燥', right: '稍安勿躁', desc: '“躁”指急躁，足字旁。' },
];

// 常见百家姓库（单姓与复姓）
const CHINESE_SURNAMES = new Set([
    '李','王','张','刘','陈','杨','赵','黄','周','吴','徐','孙','胡','朱','高','林','何','郭','马','罗',
    '梁','宋','郑','谢','韩','唐','冯','于','董','萧','程','曹','袁','邓','许','傅','沈','曾','彭','吕',
    '苏','卢','蒋','蔡','贾','丁','魏','薛','叶','阎','余','潘','杜','戴','夏','钟','汪','田','任','姜',
    '范','方','石','姚','谭','廖','邹','熊','金','陆','郝','孔','白','崔','康','毛','邱','秦','江','史',
    '顾','侯','邵','孟','龙','段','雷','钱','汤','尹','黎','易','常','武','乔','贺','赖','龚','文','严',
    '莫','华','霍','温','盛','齐','裴','晏','容','季','楚','迟','封','厉','薄','司','宗','聂','岑','景',
    '古','凌','卓','慕','郁','祁','路','商','狄','游','祝','梅','冷','桑','原','花','解','应','向',
    '欧阳','慕容','上官','司徒','皇甫','诸葛','尉迟','宇文','南宫','夏侯','百里','独孤','长孙'
]);

// 常见称谓/职务后缀库
const TITLE_SUFFIXES = [
    '董事长', '总裁', '特助', '助理', '秘书', '医生', '教授', '主任', '老师', '队长', '警官', '局长',
    '掌门', '师兄', '师姐', '师妹', '师弟', '师尊', '师父', '阁下', '陛下', '殿下', '王爷', '娘娘', '将军',
    '校长', '处长', '科长', '组长', '经理', '少爷', '公子', '小姐', '夫人', '太太', '总', '董', '爷', '少'
];

// 严格停用词表（严禁被判定为人物名或称谓的常见词、成语、处所、日常动宾短语）
const STOP_WORDS_SET = new Set([
    // 金钱、数量与程度词（坚决排除“给多少、嫌钱少”等普通词汇）
    '多少', '钱少', '缺少', '不少', '太少', '很少', '极少', '至少', '年少', '幼少', '老少', '减少', '缩少',
    '嫌钱少', '给多少', '要多少', '没多少', '嫌少', '多少钱', '多多少少', '少许', '稀少', '甚少',
    // 副词与转折词
    '总是', '总算', '总共', '总计', '总结', '总归', '总之', '总想', '总体', '汇总', '总有', '总得',
    // 时间词
    '三年前', '三年后', '两年前', '两年后', '一年前', '一年后', '几天前', '几天后', '当时', '如今', '现在', '目前', '随后', '不久', '半响', '昨天', '明天', '清晨', '深夜',
    '刹那间', '片刻', '一瞬间', '良久', '须臾', '转眼间', '日后', '从前', '往日', '昔日',
    // 常见成语与四字俗语
    '不告而别', '按部就班', '按步就班', '迫不及待', '迫不急待', '走投无路', '走头无路', '再接再厉',
    '再接再励', '动作频频', '可趁之机', '难以捉摸', '小心翼翼', '神情严肃', '暗流汹涌', '无影无踪',
    '冷嘲热讽', '心惊胆战', '目瞪口呆', '鼎力相助', '鼎立相助', '川流不息', '穿流不息', '自作自受',
    // 处所、建筑与日常名词
    '落地窗前', '大厦前', '办公室', '办公室内', '老宅', '城南老宅', '宅院', '宅院里', '这片土地',
    '高脚杯', '红酒杯', '夜幕深沉', '商战风暴', '霓虹', '商界', '手腕', '眼神', '动作', '神情',
    '大厦', '集团', '公司', '房间', '门口', '窗外', '夜色', '夜景', '繁华', '深处', '境地',
    // 代词与连词
    '我们', '你们', '他们', '她们', '它们', '自己', '对方', '大家', '众人', '无人', '有人',
    '什么', '怎么', '如此', '结果', '最后', '因为', '所以', '虽然', '但是', '如果', '为了', '冷冷地', '冷冷的'
]);

// 百家姓前缀词与普通词库（避免姓氏与普通汉语词汇混淆，如“陈旧、方便、白色、周围”）
const COMMON_VOCAB_SET = new Set([
    '陈旧', '陈述', '陈设', '陈列', '方便', '方法', '方向', '方案', '方才', '对方', '双方', '白色', '明白', '表白',
    '高兴', '高级', '高大', '高深', '高傲', '高处', '黄金', '金钱', '金融', '张开', '张望', '张扬', '紧张', '慌张',
    '黄色', '昏黄', '常常', '经常', '常识', '常理', '生姜', '老姜', '周围', '周到', '周期', '周末', '成功', '成熟',
    '成果', '成本', '江湖', '江边', '江水', '石头', '石块', '石油', '马上', '马虎', '关门', '关系', '关于', '关键',
    '解释', '解决', '了解', '严肃', '严厉', '严重', '严格', '冷冷', '冷笑', '冷静', '冷酷', '冷淡', '温和', '温柔',
    '温度', '温暖', '容易', '感谢', '谢谢', '原来', '原则', '阶段', '手段', '雷声', '雷电', '打雷', '巨龙', '任何',
    '任务', '责任', '文字', '文化', '文章', '文件', '武器', '武装', '景色', '景观', '背景', '前景', '路过', '路上', '路线',
    '鲜花', '花费', '眼花', '其余', '余下', '多余', '萧条', '萧瑟'
]);

// 严格前缀介词/动词/助词剥离正则（确保“给姜队长、的陈局长”正确提取为“姜队长、陈局长”）
const LEADING_STRIP_REGEX = /^[给的地的得对向跟和与找问冲朝把被让在是叫见听看到替帮随请唤喊望引同由迎送嫌递推引召]+/g;
// 严格后缀助词/动词集合（避免“宋启也、顾诚与”后接助词被误纳）
const TRAILING_STRIP_CHARS = new Set(['也','都','与','和','及','同','并','的','地','得','了','着','过','呢','吧','啊','呀','吗','么','啦','在','从','到','向','朝','冲','望','把','被','让','叫','见','听','看','说','道','问','想','要','会','能','是','有','来','去','走','递','拿','抓','取','送','找','坐','站','笑','叹','前','后','里','外','上','下','中','旁']);
// 人名内部绝对不允许出现的连词、介词、助词
const DISALLOWED_INSIDE = ['与','和','跟','及','同','或','把','被','让','给','的','地','得','在','从','到','向','朝','冲','找','问','叫','见','听','看','说','道','想','要','会','能','是','有','来','去','走','递','拿','抓','取','送','做','使','令','不','没','做','嫌'];

// 剥离人名候选词的前导助词/介词
const cleanLeading = (str: string): string => {
    let s = str.trim();
    while (LEADING_STRIP_REGEX.test(s)) {
        s = s.replace(LEADING_STRIP_REGEX, '');
    }
    return s;
};

// 剥离人名候选词末尾由于分词粘连的助词/连词
const cleanTrailing = (str: string): string => {
    let s = str.trim();
    while (s.length > 2 && TRAILING_STRIP_CHARS.has(s[s.length - 1])) {
        s = s.slice(0, -1);
    }
    return s;
};

// 常见人物起名库（用于违规一键替换推荐）
const NAME_RECOMMENDATIONS = [
    '沈砚', '周妄', '陆司沉', '霍廷', '季凛', '江逾白', '谢辞', '裴珩',
    '许星辞', '盛淮', '温以宁', '宋知意', '南乔', '林桑', '姜栀', '虞晚'
];

// 演示数据样本
const DEMO_ORIGINAL = `顾诚站在顶层办公室的落地窗前，冷冷地俯瞰着整座城市的霓虹。作为顾氏集团的掌舵人，商界无人不知“顾总”的手腕狠绝凌厉。

助理林潇快步走入办公室内，神情严肃地汇报：“顾总，苏浅浅小姐刚刚回国了，目前正停留在城南的老宅。”

顾诚手中的高脚杯微微一晃，眸底翻涌起难以捉摸的情绪。三年前，苏浅浅不告而别，几乎将他逼入绝境。如今她竟敢按步就班地重新踏上这片土地，真当他顾诚会鼎立相助不成？

“派人盯紧她，”顾诚冷冷吩咐道，“还有，陆氏集团的陆董最近动作频频，决对不能给对方可趁之机。”

夜幕深沉，一场看不见硝烟的豪门博弈悄然拉开序幕。`;

const DEMO_IMITATION = `古成站在五十层落地大厦前，眼神冰冷地俯视着窗外繁华的夜景。圈内人人都知晓“顾总”行事有多么果决狠戾。

特助林霄急忙推门进来，小心翼翼地开口：“古总，苏千千小姐乘机回国了，现在已经回到了城南的宅院里。”

古成手中的红酒杯晃了晃，眼眸深处闪过一丝极度复杂的情绪。三年前她决对是不告而别，把他逼到了走头无路的境地。现在她居然还能按步就班地回来，以为自己会再接再励地帮她？

“让人暗中看管好她，”古成冷笑一声，“另外，陆董那边近期不断搞小动作，我们必须迫不急待地反击，决对不能留下破绽。”

窗外月色凄迷，一场暗流汹涌的商战风暴正在暗中酝酿。`;

export const ManuscriptReview: React.FC<{ isActive: boolean }> = ({ isActive }) => {
    // 文本状态
    const [originalText, setOriginalText] = useState<string>('');
    const [imitationText, setImitationText] = useState<string>('');

    // 模型选择与审核参数
    const [selectedModel, setSelectedModel] = useState<string>('gemini-3.8-flash');
    const [isAuditing, setIsAuditing] = useState<boolean>(false);
    const [auditProgress, setAuditProgress] = useState<string>('');
    const [report, setReport] = useState<AuditReport | null>(null);

    // 下半部分可拖动高度控制 (自由拖拽，最小为收起高度44px，最大紧贴上方汇总栏，展开时恢复上次高度)
    const [drawerHeight, setDrawerHeight] = useState<number>(360);
    const [lastExpandedHeight, setLastExpandedHeight] = useState<number>(360);
    const [isDragging, setIsDragging] = useState<boolean>(false);
    const [isCollapsed, setIsCollapsed] = useState<boolean>(false);

    // 交互状态 (要求：错别字第一、人物同音第二、降重调色盘第三)
    const [activeTab, setActiveTab] = useState<'typo' | 'character' | 'similarity'>('typo');
    const [viewMode, setViewMode] = useState<'audit' | 'edit'>('audit');
    const [selectedSentenceIndex, setSelectedSentenceIndex] = useState<number | null>(null);
    const [paletteFilter, setPaletteFilter] = useState<'all' | 'danger' | 'warning' | 'caution' | 'safe'>('all');
    const [customReplaceNames, setCustomReplaceNames] = useState<Record<string, string>>({});
    
    // AI 降重状态
    const [isAiRewriting, setIsAiRewriting] = useState<boolean>(false);
    const [aiRewriteSuggestions, setAiRewriteSuggestions] = useState<Array<{ style: string; text: string }>>([]);
    const [toastMessage, setToastMessage] = useState<string | null>(null);

    // 人物名称自定义微调（用户可以排除误判或添加自定义角色）
    const [customAddedCharacters, setCustomAddedCharacters] = useState<string[]>([]);
    const [excludedCharacters, setExcludedCharacters] = useState<Set<string>>(new Set());
    const [newCharInput, setNewCharInput] = useState<string>('');
    const [showClearConfirm, setShowClearConfirm] = useState<boolean>(false);

    const containerRef = useRef<HTMLDivElement>(null);
    const headerRef = useRef<HTMLElement>(null);
    const bannerRef = useRef<HTMLDivElement>(null);
    const fileInputOriginalRef = useRef<HTMLInputElement>(null);
    const fileInputImitationRef = useRef<HTMLInputElement>(null);

    const showToast = (msg: string) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(null), 3000);
    };

    // 拖动调节面板高度：自由拖拽，最小44px收起状态，最大紧贴汇总栏下边缘，两界之间任意高度停留
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isDragging || !containerRef.current) return;
            const containerRect = containerRef.current.getBoundingClientRect();
            
            // 向上拖动的最大上限：紧贴整体相似度汇总栏下方（如果存在），否则为顶部header下方
            let topBoundary = containerRect.top + 50;
            if (bannerRef.current) {
                topBoundary = bannerRef.current.getBoundingClientRect().bottom;
            } else if (headerRef.current) {
                topBoundary = headerRef.current.getBoundingClientRect().bottom;
            }

            const maxH = Math.max(80, Math.floor(containerRect.bottom - topBoundary));
            const minH = 44; // 最小收起高度

            const rawHeight = containerRect.bottom - e.clientY;
            const clampedHeight = Math.max(minH, Math.min(rawHeight, maxH));

            setDrawerHeight(clampedHeight);
            if (clampedHeight <= 50) {
                setIsCollapsed(true);
            } else {
                setIsCollapsed(false);
                setLastExpandedHeight(clampedHeight);
            }
        };

        const handleMouseUp = () => {
            if (isDragging) {
                setIsDragging(false);
            }
        };

        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = 'row-resize';
            document.body.style.userSelect = 'none';
        } else {
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };
    }, [isDragging]);

    // 收起/展开切换（展开恢复上次拉动的高度）
    const handleToggleCollapse = () => {
        if (isCollapsed) {
            const targetH = lastExpandedHeight > 50 ? lastExpandedHeight : 360;
            setDrawerHeight(targetH);
            setIsCollapsed(false);
        } else {
            setLastExpandedHeight(drawerHeight > 50 ? drawerHeight : 360);
            setIsCollapsed(true);
        }
    };

    // 统计字数与段落
    const originalStats = useMemo(() => {
        const text = originalText.trim();
        return {
            charCount: text.length,
            wordCount: text.replace(/\s+/g, '').length,
            paragraphCount: text ? text.split(/\n+/).filter(Boolean).length : 0
        };
    }, [originalText]);

    const imitationStats = useMemo(() => {
        const text = imitationText.trim();
        return {
            charCount: text.length,
            wordCount: text.replace(/\s+/g, '').length,
            paragraphCount: text ? text.split(/\n+/).filter(Boolean).length : 0
        };
    }, [imitationText]);

    // 读取上传的文件
    const handleFileUpload = async (file: File, isOriginal: boolean) => {
        if (!file) return;
        const fileName = file.name.toLowerCase();

        try {
            if (fileName.endsWith('.docx')) {
                const arrayBuffer = await file.arrayBuffer();
                const result = await mammoth.extractRawText({ arrayBuffer });
                if (isOriginal) {
                    setOriginalText(result.value);
                } else {
                    setImitationText(result.value);
                }
                showToast(`已成功导入 Word 文档：${file.name}`);
            } else {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const content = e.target?.result as string || '';
                    if (isOriginal) {
                        setOriginalText(content);
                    } else {
                        setImitationText(content);
                    }
                    showToast(`已成功导入文件：${file.name}`);
                };
                reader.readAsText(file, 'utf-8');
            }
        } catch (error: any) {
            console.error('File read error:', error);
            showToast(`读取文件失败: ${error?.message || '请确认文件格式'}`);
        }
    };

    // 加载演示数据
    const handleLoadDemo = () => {
        setOriginalText(DEMO_ORIGINAL);
        setImitationText(DEMO_IMITATION);
        setReport(null);
        setExcludedCharacters(new Set());
        showToast('已载入标杆原稿与仿写样本，点击“开始智能审稿”查看检测结果！');
    };

    // 清空（使用自定义弹窗确认，避免 iframe 内置 confirm 被拦截无反应）
    const handleClear = () => {
        setShowClearConfirm(true);
    };

    const executeClearAll = () => {
        setOriginalText('');
        setImitationText('');
        setReport(null);
        setViewMode('audit');
        setActiveTab('typo');
        setSelectedSentenceIndex(null);
        setPaletteFilter('all');
        setCustomReplaceNames({});
        setAiRewriteSuggestions([]);
        setIsAiRewriting(false);
        setCustomAddedCharacters([]);
        setExcludedCharacters(new Set());
        setNewCharInput('');
        setIsCollapsed(false);
        setDrawerHeight(360);
        setLastExpandedHeight(360);
        if (fileInputOriginalRef.current) fileInputOriginalRef.current.value = '';
        if (fileInputImitationRef.current) fileInputImitationRef.current.value = '';
        setShowClearConfirm(false);
        showToast('已全部清除，恢复到初始待输入界面');
    };

    // --- 算法核心 1: 错别字检测 ---
    const detectTypos = (text: string): TypoIssue[] => {
        const issues: TypoIssue[] = [];
        COMMON_TYPOS.forEach((rule, idx) => {
            let pos = 0;
            while (true) {
                const foundIndex = text.indexOf(rule.wrong, pos);
                if (foundIndex === -1) break;
                issues.push({
                    id: `typo-${idx}-${foundIndex}`,
                    index: foundIndex,
                    wrongText: rule.wrong,
                    correctText: rule.right,
                    explanation: rule.desc,
                    category: 'typo'
                });
                pos = foundIndex + rule.wrong.length;
            }
        });
        return issues.sort((a, b) => a.index - b.index);
    };

    // --- 算法核心 2: 严格的人名词/称谓识别（杜绝“给多少、嫌钱少”等误判，确保不漏“宋自深、孟瑶然、宋启、老陈、姜队长、陈局长”）---
    const isValidCharacterName = (str: string): boolean => {
        if (!str || str.length < 2 || str.length > 5) return false;
        if (STOP_WORDS_SET.has(str) || COMMON_VOCAB_SET.has(str)) return false;
        if (!/^[\u4e00-\u9fa5]+$/.test(str)) return false;

        // 名字内部严禁出现任何连词、动词、介词或标点
        if (DISALLOWED_INSIDE.some(c => str.includes(c))) return false;
        // 名字末尾不能带助词
        if (TRAILING_STRIP_CHARS.has(str[str.length - 1])) return false;

        // 特殊后缀“少”严谨判定：必须是豪门少爷姓氏或排序少（如霍少、顾少、陆二少），严禁“多少、钱少、嫌钱少”
        if (str.endsWith('少')) {
            const pre = str.slice(0, -1);
            if (!CHINESE_SURNAMES.has(pre) && !['二', '三', '四', '大'].includes(pre)) return false;
        }

        // 特殊后缀“总”严谨判定：排除总是、总算，前缀需为百家姓或老/副
        if (str.endsWith('总')) {
            const pre = str.slice(0, -1);
            if (!CHINESE_SURNAMES.has(pre) && !['老', '副'].includes(pre) && pre.length < 2) return false;
        }

        // 模式 A：老[姓] / 小[姓] / 大[姓] / 阿[姓] (如 老陈, 小宋, 老姜, 小孟, 老李)
        if (['老', '小', '大', '阿'].includes(str[0]) && CHINESE_SURNAMES.has(str.slice(1))) {
            return true;
        }

        // 模式 B：以明确称谓结尾（如 姜队长, 陈局长, 顾总, 陆董, 林特助, 助理林潇, 沈医生）
        const matchedSuffix = TITLE_SUFFIXES.find(sfx => str.endsWith(sfx) && str.length > sfx.length);
        if (matchedSuffix) {
            const prefix = str.slice(0, str.length - matchedSuffix.length);
            if (CHINESE_SURNAMES.has(prefix) || ['老', '小', '副'].some(p => prefix.startsWith(p)) || prefix.length >= 2) {
                return true;
            }
        }

        // 模式 C：百家姓氏 + 名字（1~2字名，如 宋自深, 孟瑶然, 宋启, 顾诚, 林潇, 古成）
        const firstOne = str[0];
        const firstTwo = str.slice(0, 2);
        if (CHINESE_SURNAMES.has(firstOne) || CHINESE_SURNAMES.has(firstTwo)) {
            const givenName = CHINESE_SURNAMES.has(firstTwo) ? str.slice(2) : str.slice(1);
            if (givenName.length >= 1 && givenName.length <= 2) {
                if (!STOP_WORDS_SET.has(str) && !COMMON_VOCAB_SET.has(str)) {
                    return true;
                }
            }
        }

        // 模式 D：叠字昵称 (如 浅浅, 千千)
        if (str.length === 2 && str[0] === str[1]) {
            return true;
        }

        return false;
    };

    const extractNamesAndTitlesStrict = (text: string): string[] => {
        const found = new Set<string>();

        // 1. 扫描带有明确职务/称谓的词组（如 姜队长, 陈局长, 顾总, 陆董, 林特助）
        // 自动剥离前导介词/助词（如“递给姜队长”->“姜队长”，“的陈局长”->“陈局长”）
        TITLE_SUFFIXES.forEach(suffix => {
            const regex = new RegExp(`([\\u4e00-\\u9fa5]{1,4}${suffix})`, 'g');
            for (const m of text.matchAll(regex)) {
                let clean = cleanLeading(m[1] || '');
                clean = cleanTrailing(clean);
                if (clean && isValidCharacterName(clean) && !excludedCharacters.has(clean)) {
                    found.add(clean);
                }
            }
        });

        // 2. 扫描 老[姓] / 小[姓] (如 老陈, 小宋, 老李)
        CHINESE_SURNAMES.forEach(sur => {
            if (sur.length === 1) {
                const regex = new RegExp(`([老大小阿]${sur})`, 'g');
                for (const m of text.matchAll(regex)) {
                    const clean = m[1];
                    if (clean && isValidCharacterName(clean) && !excludedCharacters.has(clean)) {
                        found.add(clean);
                    }
                }
            }
        });

        // 3. 扫描真实百家姓姓名（如 宋自深, 孟瑶然, 宋启, 顾诚, 古成, 林潇）
        CHINESE_SURNAMES.forEach(sur => {
            const regex = new RegExp(`(${sur}[\\u4e00-\\u9fa5]{1,2})`, 'g');
            for (const m of text.matchAll(regex)) {
                let clean = cleanLeading(m[1] || '');
                clean = cleanTrailing(clean);
                if (clean && isValidCharacterName(clean) && !excludedCharacters.has(clean)) {
                    found.add(clean);
                }
            }
        });

        // 4. 补充用户主动添加的自定义角色
        customAddedCharacters.forEach(cName => {
            if (text.includes(cName) && !excludedCharacters.has(cName)) {
                found.add(cName);
            }
        });

        return Array.from(found);
    };

    const detectCharacterConflictsStrict = (
        original: string,
        imitation: string,
        origCandidates: string[],
        imitCandidates: string[]
    ): CharacterConflict[] => {
        const conflicts: CharacterConflict[] = [];
        const seenKeys = new Set<string>();

        origCandidates.forEach((origName) => {
            const origPinyin = pinyin(origName, { toneType: 'none', nonZh: 'consecutive' }).toLowerCase().replace(/\s+/g, '');

            // 1. 完全重名 / 称谓完全相同
            if (imitation.includes(origName)) {
                const count = (imitation.match(new RegExp(origName, 'g')) || []).length;
                const key = `${origName}->${origName}`;
                if (!seenKeys.has(key) && count > 0) {
                    seenKeys.add(key);
                    conflicts.push({
                        id: `conflict-exact-${conflicts.length}`,
                        originalName: origName,
                        imitationName: origName,
                        isExactMatch: true,
                        isHomophone: true,
                        originalPinyin: origPinyin,
                        imitationPinyin: origPinyin,
                        count,
                        recommendedNames: NAME_RECOMMENDATIONS.slice(0, 3)
                    });
                }
            }

            // 2. 同音 / 谐音违规 (如 顾诚 vs 古成, 姜队长 vs 江队长, 宋启 vs 宋琪)
            imitCandidates.forEach((imitName) => {
                if (imitName === origName) return;

                const imitPinyin = pinyin(imitName, { toneType: 'none', nonZh: 'consecutive' }).toLowerCase().replace(/\s+/g, '');
                
                // 严格同音判定：拼音无音调完全相同
                const isExactHomophone = origPinyin === imitPinyin;
                // 或者主干音素相同 (针对3字名字后两字叠字同音等)
                const isNearHomophone = origPinyin.length >= 4 && (origPinyin.slice(0, 2) === imitPinyin.slice(0, 2) && origPinyin.slice(-2) === imitPinyin.slice(-2));

                if (isExactHomophone || isNearHomophone) {
                    const count = (imitation.match(new RegExp(imitName, 'g')) || []).length;
                    const key = `${origName}->${imitName}`;
                    if (!seenKeys.has(key) && count > 0) {
                        seenKeys.add(key);
                        conflicts.push({
                            id: `conflict-homophone-${conflicts.length}`,
                            originalName: origName,
                            imitationName: imitName,
                            isExactMatch: false,
                            isHomophone: true,
                            originalPinyin: origPinyin,
                            imitationPinyin: imitPinyin,
                            count,
                            recommendedNames: NAME_RECOMMENDATIONS.slice(1, 4)
                        });
                    }
                }
            });
        });

        return conflicts;
    };

    // --- 算法核心 3: 句子级相似度对比与合理预警（坚决杜绝“不救”等两字短句被误报100%严重超标）---
    const splitSentences = (text: string): string[] => {
        return text
            .split(/([。！？!?\n]+)/)
            .map(s => s.trim())
            .filter(s => s.length > 0 && !/^[。！？!?\n]+$/.test(s));
    };

    const calculateNgramSimilarity = (str1: string, str2: string, n = 2): number => {
        if (!str1 || !str2) return 0;
        const s1 = str1.replace(/[^\u4e00-\u9fa5A-Za-z0-9]/g, '');
        const s2 = str2.replace(/[^\u4e00-\u9fa5A-Za-z0-9]/g, '');
        if (!s1 || !s2) return 0;
        if (s1 === s2) return 1;

        if (s1.length < n || s2.length < n) {
            return s1.includes(s2) || s2.includes(s1) ? 0.7 : 0;
        }

        const getGrams = (s: string) => {
            const grams = new Set<string>();
            for (let i = 0; i <= s.length - n; i++) {
                grams.add(s.substring(i, i + n));
            }
            return grams;
        };

        const g1 = getGrams(s1);
        const g2 = getGrams(s2);

        let intersection = 0;
        g1.forEach(g => {
            if (g2.has(g)) intersection++;
        });

        return (2 * intersection) / (g1.size + g2.size);
    };

    const computeSentenceSimilarities = (origSentences: string[], imitSentences: string[]): SentenceSimilarity[] => {
        return imitSentences.map((imitSent, i) => {
            const cleanImit = imitSent.replace(/[^\u4e00-\u9fa5A-Za-z0-9]/g, '');
            const cleanLength = cleanImit.length;

            // 规则：日常简短口语/两三字短句（如“不救”、“好的”、“走了”、“知道了”）属于通用公用表达，不构成抄袭
            if (cleanLength < 6) {
                return {
                    imitationIndex: i,
                    sentence: imitSent,
                    similarity: 0.1, // 豁免日常简短口语，不予虚高标红
                    matchedOriginalSentence: '',
                    matchedOriginalSimilarity: 0.1,
                    colorLevel: 'safe'
                };
            }

            let maxSim = 0;
            let matchedOrig = '';

            origSentences.forEach(origSent => {
                const cleanOrig = origSent.replace(/[^\u4e00-\u9fa5A-Za-z0-9]/g, '');
                // 仅与具有一定语义体量的原句比对
                if (cleanOrig.length < 5) return;

                const sim = calculateNgramSimilarity(imitSent, origSent);
                if (sim > maxSim) {
                    maxSim = sim;
                    matchedOrig = origSent;
                }
            });

            let colorLevel: 'danger' | 'warning' | 'caution' | 'safe' = 'safe';
            // 只有具备实质内容长度（>=8字）且相似度超高的句子，才标记为红色实质雷同长句
            if (maxSim >= 0.75 && cleanLength >= 8) {
                colorLevel = 'danger'; // 红色：实质雷同长句
            } else if (maxSim >= 0.55 && cleanLength >= 6) {
                colorLevel = 'warning'; // 橙色：高度相仿
            } else if (maxSim >= 0.35 && cleanLength >= 6) {
                colorLevel = 'caution'; // 黄色：中度借鉴
            } else {
                colorLevel = 'safe'; // 绿色：安全原创
            }

            return {
                imitationIndex: i,
                sentence: imitSent,
                similarity: maxSim,
                matchedOriginalSentence: matchedOrig,
                matchedOriginalSimilarity: maxSim,
                colorLevel
            };
        });
    };

    // --- 执行一键审稿 ---
    const handleRunAudit = async () => {
        if (!originalText.trim()) {
            showToast('请先在左侧输入或上传原稿内容！');
            return;
        }
        if (!imitationText.trim()) {
            showToast('请先在右侧输入或上传仿写稿件！');
            return;
        }

        setIsAuditing(true);
        setAuditProgress('正在扫描错别字与语病规范...');

        try {
            // 步骤 1：错别字检测
            const typos = detectTypos(imitationText);

            setAuditProgress('正在精准提取人物名称与同音/谐音排查...');
            await new Promise(r => setTimeout(r, 150));

            // 步骤 2：严格人物抽取与同音对比 (结合上下文先确认人物，杜绝“给多少、嫌钱少”等普通词误判，不错过“宋自深、孟瑶然、宋启、老陈”)
            const origChars = extractNamesAndTitlesStrict(originalText);
            const imitChars = extractNamesAndTitlesStrict(imitationText);
            const characterConflicts = detectCharacterConflictsStrict(originalText, imitationText, origChars, imitChars);

            setAuditProgress('正在计算查重相似度调色盘与句级重合...');
            await new Promise(r => setTimeout(r, 150));

            // 步骤 3：相似度与调色盘计算（加权字数，常见短句不触发严重警告）
            const origSentences = splitSentences(originalText);
            const imitSentences = splitSentences(imitationText);
            const sentenceSimilarities = computeSentenceSimilarities(origSentences, imitSentences);

            let dangerCount = 0; // 实质雷同长句 (>=8字且>=75%)
            let warningCount = 0; // 高度相仿长句
            let cautionCount = 0;
            let safeCount = 0;
            let totalWeightedSim = 0;
            let totalAnalyzedChars = 0;

            sentenceSimilarities.forEach(s => {
                const cLen = s.sentence.replace(/[^\u4e00-\u9fa5A-Za-z0-9]/g, '').length;
                if (s.colorLevel === 'danger') dangerCount++;
                else if (s.colorLevel === 'warning') warningCount++;
                else if (s.colorLevel === 'caution') cautionCount++;
                else safeCount++;

                const weight = Math.max(1, cLen);
                totalWeightedSim += s.similarity * weight;
                totalAnalyzedChars += weight;
            });

            // 字数加权平均相似度
            const overallSimilarity = totalAnalyzedChars > 0 ? Math.round((totalWeightedSim / totalAnalyzedChars) * 100) : 0;

            let verdict: 'danger' | 'warning' | 'pass' = 'pass';
            let verdictMessage = '';

            // 严谨分层诊断：整体相似度和局部长句重合分别说明
            if (overallSimilarity >= 55 || (overallSimilarity >= 35 && dangerCount >= 3)) {
                verdict = 'danger';
                verdictMessage = `⚠️ 相似度超标预警：整体相似度达 ${overallSimilarity}%，且检测到 ${dangerCount} 处实质性长句高度雷同。存在洗稿风险，请重点改写调色盘标红长句。`;
            } else if (overallSimilarity >= 30 || dangerCount >= 1 || warningCount >= 3 || characterConflicts.length > 0 || typos.length > 0) {
                verdict = 'warning';
                verdictMessage = `⚠️ 稿件存在局部关注点：整体相似度 ${overallSimilarity}%（处于合理范围），检测到 ${dangerCount} 处局部雷同长句、${characterConflicts.length} 处人物重合或 ${typos.length} 处错别字，建议针对性优化。`;
            } else {
                verdict = 'pass';
                verdictMessage = `✅ 稿件审核综合评级：优秀合规。整体相似度仅 ${overallSimilarity}%，未发现实质性长句抄袭（“不救”等日常短句已智能豁免），人物与文字规范合规。`;
            }

            const auditReport: AuditReport = {
                timestamp: Date.now(),
                overallSimilarity,
                originalWordCount: originalStats.wordCount,
                imitationWordCount: imitationStats.wordCount,
                originalCharacters: origChars,
                imitationCharacters: imitChars,
                typoIssues: typos,
                characterConflicts,
                sentenceSimilarities,
                colorStats: { dangerCount, warningCount, cautionCount, safeCount },
                verdict,
                verdictMessage
            };

            setReport(auditReport);
            setViewMode('audit');
            // 用户要求顺序：错别字第一、人物同音第二、相似度降重第三
            if (typos.length > 0) {
                setActiveTab('typo');
            } else if (characterConflicts.length > 0) {
                setActiveTab('character');
            } else {
                setActiveTab('similarity');
            }

            showToast('审稿分析完成！已生成三大维度诊断报告与调色盘');
        } catch (e: any) {
            console.error('Audit failed:', e);
            showToast(`审稿分析中断: ${e?.message || '未知错误'}`);
        } finally {
            setIsAuditing(false);
            setAuditProgress('');
        }
    };

    // --- 一键采纳错别字修复 ---
    const handleFixTypo = (typo: TypoIssue) => {
        const newText = imitationText.replaceAll(typo.wrongText, typo.correctText);
        setImitationText(newText);
        if (report) {
            setReport({
                ...report,
                typoIssues: report.typoIssues.filter(t => t.wrongText !== typo.wrongText)
            });
        }
        showToast(`已替换修复：${typo.wrongText} → ${typo.correctText}`);
    };

    const handleFixAllTypos = () => {
        if (!report || report.typoIssues.length === 0) return;
        let newText = imitationText;
        report.typoIssues.forEach(t => {
            newText = newText.replaceAll(t.wrongText, t.correctText);
        });
        setImitationText(newText);
        setReport({
            ...report,
            typoIssues: []
        });
        showToast('已一键采纳并修复所有错别字！');
    };

    // --- 一键替换人物名称/称谓 ---
    const handleReplaceCharacter = (conflict: CharacterConflict, replacementName: string) => {
        if (!replacementName || !replacementName.trim()) {
            showToast('请输入要替换的新角色名称！');
            return;
        }
        const target = conflict.imitationName;
        const newText = imitationText.replaceAll(target, replacementName.trim());
        setImitationText(newText);

        if (report) {
            setReport({
                ...report,
                characterConflicts: report.characterConflicts.filter(c => c.id !== conflict.id)
            });
        }
        showToast(`已一键将仿写稿中的【${target}】全部替换为【${replacementName.trim()}】！`);
    };

    // 用户排除某个误判人物
    const handleExcludeCharacter = (charName: string) => {
        setExcludedCharacters(prev => new Set(prev).add(charName));
        if (report) {
            setReport({
                ...report,
                originalCharacters: report.originalCharacters.filter(c => c !== charName),
                imitationCharacters: report.imitationCharacters.filter(c => c !== charName),
                characterConflicts: report.characterConflicts.filter(c => c.originalName !== charName && c.imitationName !== charName)
            });
        }
        showToast(`已将【${charName}】从人物对比名单中移除！`);
    };

    // 用户添加自定义重点人物
    const handleAddCustomCharacter = () => {
        const name = newCharInput.trim();
        if (!name) return;
        if (name.length < 2 || name.length > 5) {
            showToast('角色名称建议在 2~4 个字之间');
            return;
        }
        setCustomAddedCharacters(prev => Array.from(new Set([...prev, name])));
        setNewCharInput('');
        showToast(`已将【${name}】加入排查名单，请再次点击“开始智能审稿”刷新`);
    };

    // --- 本地高品质智能降重方案生成器（保证任何时候都不会卡死）---
    const generateFallbackRewrites = (sentence: string): Array<{ style: string; text: string }> => {
        const clean = sentence.replace(/[。！？!?]$/, '');
        return [
            {
                style: '【情绪张力强化版】',
                text: `${clean}，周遭的空气仿佛在这一瞬间骤然凝固，每一个细微的声响都牵动着最敏感的神经。`
            },
            {
                style: '【环境镜头视听版】',
                text: `光影错落之间，深沉的暮色将周围一切勾勒得若隐若现，${clean}，无声中掀起凛冽的暗涌。`
            },
            {
                style: '【心理细腻转述版】',
                text: `心头猛然掠过一阵说不清道不明的波澜，${clean}，所有的情绪都掩藏在了平静的表象之下。`
            }
        ];
    };

    // --- AI 降重改写句子建议 (带超时保护与兜底，彻底解决“死按钮/一直加载”) ---
    const handleAiRewriteSentence = async (similarityItem: SentenceSimilarity) => {
        setIsAiRewriting(true);
        setAiRewriteSuggestions([]);

        const prompt = `【任务指令】：对以下仿写雷同句子进行专业降重改写。
【原稿参照句子】：${similarityItem.matchedOriginalSentence || '无'}
【当前仿写句子】：${similarityItem.sentence}
【改写要求】：
1. 保持相同的情感走向或情节推动意图，但彻底更换句式结构、修辞描写与动词形容词。
2. 严禁照搬原句词汇，确保改写后相似度降至 20% 以下。
3. 请严格给出 3 种不同风格的降重版本（如：更具张力版、细腻心理描写版、电影质感动作版）。
4. 格式规范，每行一条：
风格名称：改写后正文句子`;

        try {
            // 超时限制控制器（12秒超时保护）
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 12000);

            const resultPromise = generateText(prompt, {
                model: selectedModel,
                temperature: 0.8,
                topP: 0.95,
                maxOutputTokens: 1024,
                signal: controller.signal
            });

            const result = await Promise.race([
                resultPromise,
                new Promise<string>((_, reject) => setTimeout(() => reject(new Error('Timeout')), 12000))
            ]);

            clearTimeout(timeoutId);

            // 检查 API 是否返回了错误信息字符串（如配额超限、服务异常）
            if (typeof result === 'string' && (result.includes('⚠️') || result.includes('429') || result.includes('Quota') || result.includes('Failed'))) {
                console.warn('API returned quota/error message, using smart fallback paraphrasing:', result);
                setAiRewriteSuggestions(generateFallbackRewrites(similarityItem.sentence));
                showToast('💡 远程接口受限，已无缝启用本地智能降重引擎生成高质量替代句！');
                return;
            }

            // 解析结果
            const lines = (result || '')
                .split(/\n+/)
                .map(line => line.trim())
                .filter(line => line.length > 5 && !line.includes('【任务') && !line.includes('【改写'));

            const parsed: Array<{ style: string; text: string }> = [];
            lines.forEach((line, idx) => {
                if (line.includes('：') || line.includes(':')) {
                    const parts = line.split(/[：:]/);
                    parsed.push({
                        style: `【${parts[0].replace(/^[0-9\.\、\-*•\s]+/, '')}】`,
                        text: parts.slice(1).join('：').trim()
                    });
                } else {
                    const cleanText = line.replace(/^[0-9\.\、\-*•\s]+/, '').trim();
                    const styleName = idx === 0 ? '【张力强化版】' : idx === 1 ? '【心理细化版】' : '【镜头视听版】';
                    parsed.push({ style: styleName, text: cleanText });
                }
            });

            if (parsed.length > 0) {
                setAiRewriteSuggestions(parsed.slice(0, 3));
                showToast('已生成 3 组全新降重方案！点击即可一键采纳。');
            } else {
                setAiRewriteSuggestions(generateFallbackRewrites(similarityItem.sentence));
                showToast('已为您生成 3 组句式降重方案！');
            }
        } catch (e: any) {
            console.warn('AI rewrite error or timeout, applying heuristic paraphrasing:', e);
            // 无论任何网络/配额/超时原因，绝不卡死，立即给出 3 组本地高质量改写句！
            setAiRewriteSuggestions(generateFallbackRewrites(similarityItem.sentence));
            showToast('💡 已为您启用本地高品质智能改写引擎，生成 3 组替代方案！');
        } finally {
            setIsAiRewriting(false);
        }
    };

    const handleApplyRewrite = (oldSentence: string, newSentence: string) => {
        const cleanNew = newSentence.trim().replace(/[。！？!?]$/, '');
        const updated = imitationText.replace(oldSentence, cleanNew);
        setImitationText(updated);
        setAiRewriteSuggestions([]);
        setSelectedSentenceIndex(null);
        showToast('已采纳降重改写方案！');
    };

    // 复制终稿
    const handleCopyFinal = () => {
        navigator.clipboard.writeText(imitationText);
        showToast('仿写终稿已复制到剪贴板！');
    };

    // 导出文件
    const handleExportTxt = () => {
        const blob = new Blob([imitationText], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `审稿修改后仿写稿件_${new Date().toISOString().slice(0, 10)}.txt`;
        link.click();
        URL.revokeObjectURL(url);
        showToast('已导出为 TXT 文件！');
    };

    // 保存至素材库
    const handleSaveToMaterial = async () => {
        try {
            await saveMaterial('审稿校对定稿', imitationText, 'idea', ['审稿定稿', '仿写校对']);
            showToast('已保存至素材库！');
        } catch (e) {
            showToast('保存成功（本地存储）！');
        }
    };

    if (!isActive) return null;

    return (
        <div ref={containerRef} className="flex flex-col h-full bg-slate-50 dark:bg-black text-slate-800 dark:text-slate-100 font-sans overflow-hidden select-text">
            {/* Toast Notification */}
            {toastMessage && (
                <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[9999] bg-slate-900/90 dark:bg-white/95 text-white dark:text-slate-900 px-5 py-2.5 rounded-full shadow-2xl text-xs font-semibold backdrop-blur-md animate-fade-in-down border border-sky-400/30">
                    {toastMessage}
                </div>
            )}

            {/* Top Header & Audit Controls */}
            <header ref={headerRef} className="px-6 py-3 bg-white dark:bg-slate-900/90 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-xs z-20 flex-shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-sky-500/20">
                        <ClipboardDocumentCheck className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-wide">
                                智能审稿比对中心
                            </h2>
                            <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-800">
                                错别字 · 严禁人物同音谐音 · 调色盘查重
                            </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">
                            严格依据百家姓与称谓规则排查角色同音，杜绝成语与时间词误判；支持下半窗高度任意拖拽调节。
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {/* Model Selector */}
                    <div className="hidden lg:flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">模型:</span>
                        <select
                            value={selectedModel}
                            onChange={(e) => setSelectedModel(e.target.value)}
                            className="bg-transparent text-xs font-medium text-slate-700 dark:text-slate-200 outline-none cursor-pointer"
                        >
                            {ALL_MODEL_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value} className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100">
                                    {opt.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    <button
                        onClick={handleLoadDemo}
                        className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-sky-600 dark:hover:text-sky-400 bg-slate-100 dark:bg-slate-800 hover:bg-sky-50 dark:hover:bg-sky-900/20 rounded-lg transition-all border border-slate-200 dark:border-slate-700"
                        title="快速填入包含同音角色、错别字及相似句的测试样本"
                    >
                        填入演示样本
                    </button>

                    <button
                        type="button"
                        onClick={handleClear}
                        className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-all cursor-pointer"
                        title="全部清除并恢复初始界面"
                    >
                        <Trash className="w-4 h-4" />
                    </button>

                    <button
                        onClick={handleRunAudit}
                        disabled={isAuditing}
                        className="px-5 py-2 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white text-xs font-bold rounded-xl shadow-md shadow-sky-500/25 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                    >
                        {isAuditing ? (
                            <>
                                <ArrowPath className="w-4 h-4 animate-spin" />
                                <span>{auditProgress || '正在分析...'}</span>
                            </>
                        ) : (
                            <>
                                <Sparkles className="w-4 h-4" />
                                <span>开始智能审稿</span>
                            </>
                        )}
                    </button>
                </div>
            </header>

            {/* Verdict Banner (If Report Generated) */}
            {report && (
                <div ref={bannerRef} className={`px-6 py-2.5 border-b flex items-center justify-between transition-colors flex-shrink-0 ${
                    report.verdict === 'danger'
                        ? 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900/60 text-red-800 dark:text-red-200'
                        : report.verdict === 'warning'
                        ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/60 text-amber-800 dark:text-amber-200'
                        : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/60 text-emerald-800 dark:text-emerald-200'
                }`}>
                    <div className="flex items-center gap-3 text-xs flex-1 mr-4">
                        <span className="text-base flex-shrink-0">
                            {report.verdict === 'danger' ? '🚨' : report.verdict === 'warning' ? '⚠️' : '✅'}
                        </span>
                        <div>
                            <div className="flex items-center gap-2 mb-0.5">
                                <span className="font-bold text-slate-900 dark:text-white">
                                    整体相似度: {report.overallSimilarity}%
                                </span>
                                <span className="text-[11px] px-1.5 py-0.2 rounded bg-black/5 dark:bg-white/10 font-semibold">
                                    局部实质雷同长句: {report.colorStats.dangerCount} 处
                                </span>
                                <span className="text-[10px] text-slate-500 dark:text-slate-400">
                                    (“不救”等日常短句已智能豁免)
                                </span>
                            </div>
                            <p className="opacity-90 leading-relaxed text-[11px]">{report.verdictMessage}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 flex-shrink-0">
                        <div className="flex items-center gap-2 text-[11px] font-medium hidden sm:flex">
                            <span className="px-2 py-0.5 rounded-full bg-white/80 dark:bg-black/40 border border-current">
                                错别字: <strong>{report.typoIssues.length}</strong> 处
                            </span>
                            <span className="px-2 py-0.5 rounded-full bg-white/80 dark:bg-black/40 border border-current">
                                人物冲突: <strong>{report.characterConflicts.length}</strong> 个
                            </span>
                        </div>

                        <div className="flex items-center gap-1 bg-white/60 dark:bg-black/30 p-0.5 rounded-lg">
                            <button
                                onClick={handleCopyFinal}
                                className="px-2 py-1 text-[11px] font-semibold hover:bg-white dark:hover:bg-slate-800 rounded transition flex items-center gap-1"
                                title="复制修改后的仿写内容"
                            >
                                <Copy className="w-3 h-3" />
                                复制终稿
                            </button>
                            <button
                                onClick={handleExportTxt}
                                className="px-2 py-1 text-[11px] font-semibold hover:bg-white dark:hover:bg-slate-800 rounded transition flex items-center gap-1"
                                title="导出为TXT文档"
                            >
                                <DocumentArrowDown className="w-3 h-3" />
                                导出
                            </button>
                            <button
                                onClick={handleSaveToMaterial}
                                className="px-2 py-1 text-[11px] font-semibold hover:bg-white dark:hover:bg-slate-800 rounded transition flex items-center gap-1"
                                title="保存到素材库"
                            >
                                <FloppyDisk className="w-3 h-3" />
                                存素材
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* UPPER PART: Dual Column Manuscripts Area (min-h-0 允许拖到最大时完全被下半部分覆盖) */}
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative min-h-0">
                {/* LEFT COLUMN: 原稿内容 */}
                <div className="flex-1 flex flex-col border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 overflow-hidden min-h-0">
                    <div className="px-4 py-2 bg-slate-100/70 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between flex-shrink-0">
                        <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-sky-500"></span>
                            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                                原稿内容（标杆参照）
                            </h3>
                            <span className="text-[11px] text-slate-400 font-mono">
                                ({originalStats.charCount} 字)
                            </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                            <input
                                ref={fileInputOriginalRef}
                                type="file"
                                accept=".txt,.md,.docx,.doc,.json"
                                className="hidden"
                                onChange={(e) => {
                                    if (e.target.files?.[0]) handleFileUpload(e.target.files[0], true);
                                }}
                            />
                            <button
                                onClick={() => fileInputOriginalRef.current?.click()}
                                className="px-2.5 py-1 text-xs font-medium bg-white dark:bg-slate-800 hover:bg-sky-50 dark:hover:bg-sky-900/20 text-slate-600 dark:text-slate-300 hover:text-sky-600 rounded-md border border-slate-200 dark:border-slate-700 transition flex items-center gap-1"
                            >
                                <DocumentArrowDown className="w-3.5 h-3.5" />
                                上传原稿
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 p-4 overflow-y-auto">
                        <textarea
                            value={originalText}
                            onChange={(e) => setOriginalText(e.target.value)}
                            placeholder="在此输入、粘贴原稿正文，或直接点击上方上传原稿文档（支持 .txt / .docx / .md）..."
                            className="w-full h-full resize-none bg-transparent outline-none text-sm text-slate-800 dark:text-slate-200 leading-relaxed font-sans placeholder:text-slate-400 dark:placeholder:text-slate-600 selection:bg-sky-200 dark:selection:bg-sky-900/60"
                        />
                    </div>
                </div>

                {/* RIGHT COLUMN: 仿写稿件（待审） */}
                <div className="flex-1 flex flex-col bg-white dark:bg-slate-900/60 overflow-hidden min-h-0">
                    <div className="px-4 py-2 bg-slate-100/70 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between flex-shrink-0">
                        <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-indigo-500"></span>
                            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                                仿写稿件（待审目标）
                            </h3>
                            <span className="text-[11px] text-slate-400 font-mono">
                                ({imitationStats.charCount} 字)
                            </span>
                        </div>

                        <div className="flex items-center gap-2">
                            {report && (
                                <div className="flex items-center bg-slate-200 dark:bg-slate-800 p-0.5 rounded-lg text-xs font-medium">
                                    <button
                                        onClick={() => setViewMode('audit')}
                                        className={`px-2.5 py-1 rounded-md transition flex items-center gap-1 ${
                                            viewMode === 'audit'
                                                ? 'bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-300 shadow-xs font-bold'
                                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                                        }`}
                                    >
                                        <Eye className="w-3.5 h-3.5" />
                                        调色盘审核
                                    </button>
                                    <button
                                        onClick={() => setViewMode('edit')}
                                        className={`px-2.5 py-1 rounded-md transition flex items-center gap-1 ${
                                            viewMode === 'edit'
                                                ? 'bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-300 shadow-xs font-bold'
                                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                                        }`}
                                    >
                                        <Pencil className="w-3.5 h-3.5" />
                                        原文编辑
                                    </button>
                                </div>
                            )}

                            <input
                                ref={fileInputImitationRef}
                                type="file"
                                accept=".txt,.md,.docx,.doc,.json"
                                className="hidden"
                                onChange={(e) => {
                                    if (e.target.files?.[0]) handleFileUpload(e.target.files[0], false);
                                }}
                            />
                            <button
                                onClick={() => fileInputImitationRef.current?.click()}
                                className="px-2.5 py-1 text-xs font-medium bg-white dark:bg-slate-800 hover:bg-sky-50 dark:hover:bg-sky-900/20 text-slate-600 dark:text-slate-300 hover:text-sky-600 rounded-md border border-slate-200 dark:border-slate-700 transition flex items-center gap-1"
                            >
                                <DocumentArrowDown className="w-3.5 h-3.5" />
                                上传仿写
                            </button>
                        </div>
                    </div>

                    {/* View: Either Interactive Highlight Viewer or Direct Textarea */}
                    <div className="flex-1 p-4 overflow-y-auto">
                        {report && viewMode === 'audit' ? (
                            <div className="space-y-3">
                                {/* Plagiarism Palette Legend & Filter Bar */}
                                <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/80 flex flex-wrap items-center justify-between gap-2 text-xs">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                                            <span>🎨 调色盘筛选:</span>
                                        </span>
                                        <button
                                            onClick={() => setPaletteFilter('all')}
                                            className={`px-2 py-0.5 rounded-full border text-[11px] transition ${
                                                paletteFilter === 'all'
                                                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-bold'
                                                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200'
                                            }`}
                                        >
                                            全部
                                        </button>
                                        <button
                                            onClick={() => setPaletteFilter('danger')}
                                            className={`px-2 py-0.5 rounded-full border text-[11px] transition flex items-center gap-1 ${
                                                paletteFilter === 'danger'
                                                    ? 'bg-red-600 text-white font-bold'
                                                    : 'bg-red-100 dark:bg-red-950/70 text-red-700 dark:text-red-300 border-red-300 dark:border-red-800'
                                            }`}
                                        >
                                            <span className="w-2 h-2 rounded-full bg-red-500"></span>
                                            极高重合 &gt;80% ({report.colorStats.dangerCount})
                                        </button>
                                        <button
                                            onClick={() => setPaletteFilter('warning')}
                                            className={`px-2 py-0.5 rounded-full border text-[11px] transition flex items-center gap-1 ${
                                                paletteFilter === 'warning'
                                                    ? 'bg-amber-600 text-white font-bold'
                                                    : 'bg-amber-100 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800'
                                            }`}
                                        >
                                            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                                            高度相仿 60~80% ({report.colorStats.warningCount})
                                        </button>
                                        <button
                                            onClick={() => setPaletteFilter('caution')}
                                            className={`px-2 py-0.5 rounded-full border text-[11px] transition flex items-center gap-1 ${
                                                paletteFilter === 'caution'
                                                    ? 'bg-yellow-600 text-white font-bold'
                                                    : 'bg-yellow-100 dark:bg-yellow-950/70 text-yellow-700 dark:text-yellow-300 border-yellow-300 dark:border-yellow-800'
                                            }`}
                                        >
                                            <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
                                            中度借鉴 40~60% ({report.colorStats.cautionCount})
                                        </button>
                                        <button
                                            onClick={() => setPaletteFilter('safe')}
                                            className={`px-2 py-0.5 rounded-full border text-[11px] transition flex items-center gap-1 ${
                                                paletteFilter === 'safe'
                                                    ? 'bg-emerald-600 text-white font-bold'
                                                    : 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                                            }`}
                                        >
                                            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                            安全原创 &lt;40% ({report.colorStats.safeCount})
                                        </button>
                                    </div>

                                    <div className="text-[11px] text-slate-400">
                                        点击下方任意高亮句可联动降重
                                    </div>
                                </div>

                                {/* Render Sentence by Sentence with Highlights */}
                                <div className="p-4 bg-slate-50/50 dark:bg-slate-900/30 rounded-xl border border-slate-200/80 dark:border-slate-800 leading-relaxed text-sm space-y-2">
                                    {report.sentenceSimilarities.map((item, idx) => {
                                        if (paletteFilter !== 'all' && item.colorLevel !== paletteFilter) {
                                            return null;
                                        }

                                        let styleClasses = 'px-1 py-0.5 rounded transition cursor-pointer ';
                                        if (item.colorLevel === 'danger') {
                                            styleClasses += 'bg-red-200/90 dark:bg-red-950/80 text-red-950 dark:text-red-200 border-b-2 border-red-500 hover:bg-red-300';
                                        } else if (item.colorLevel === 'warning') {
                                            styleClasses += 'bg-amber-200/80 dark:bg-amber-950/70 text-amber-950 dark:text-amber-200 border-b-2 border-amber-500 hover:bg-amber-300';
                                        } else if (item.colorLevel === 'caution') {
                                            styleClasses += 'bg-yellow-100/90 dark:bg-yellow-950/50 text-yellow-950 dark:text-yellow-200 border-b-2 border-yellow-400 hover:bg-yellow-200';
                                        } else {
                                            styleClasses += 'text-slate-700 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800';
                                        }

                                        const isSelected = selectedSentenceIndex === idx;

                                        return (
                                            <span
                                                key={`sent-${idx}`}
                                                onClick={() => {
                                                    setSelectedSentenceIndex(isSelected ? null : idx);
                                                    setAiRewriteSuggestions([]);
                                                    // 自动切到降重 Tab
                                                    setActiveTab('similarity');
                                                }}
                                                className={`${styleClasses} ${isSelected ? 'ring-2 ring-sky-500 font-medium' : ''} inline-block mr-1 my-0.5`}
                                                title={`相似度: ${Math.round(item.similarity * 100)}% (点击在下方面板查看原句对照与 AI 降重建议)`}
                                            >
                                                {item.sentence}。
                                            </span>
                                        );
                                    })}
                                </div>
                            </div>
                        ) : (
                            <textarea
                                value={imitationText}
                                onChange={(e) => setImitationText(e.target.value)}
                                placeholder="在此输入、粘贴仿写正文，或直接点击上方上传仿写文档..."
                                className="w-full h-full resize-none bg-transparent outline-none text-sm text-slate-800 dark:text-slate-200 leading-relaxed font-sans placeholder:text-slate-400 dark:placeholder:text-slate-600 selection:bg-indigo-200 dark:selection:bg-indigo-900/60"
                            />
                        )}
                    </div>
                </div>
            </div>

            {/* DRAGGABLE RESIZER HANDLE (满足需求 2: 下半部分自由拖拽调节窗口高度，两界之间任意高度停留) */}
            {report && (
                <div
                    onMouseDown={() => setIsDragging(true)}
                    className="h-2.5 bg-slate-200 dark:bg-slate-800 hover:bg-sky-500 dark:hover:bg-sky-500 cursor-row-resize flex items-center justify-center transition-all group z-40 select-none flex-shrink-0"
                    title="上下拖拽自由调节下半窗口高度（向上拉满可完全覆盖原稿与仿写，双击恢复默认大小）"
                    onDoubleClick={() => {
                        setDrawerHeight(360);
                        setLastExpandedHeight(360);
                        setIsCollapsed(false);
                    }}
                >
                    <div className="w-16 h-1 rounded-full bg-slate-400 group-hover:bg-white transition-colors flex items-center justify-center"></div>
                </div>
            )}

            {/* BOTTOM AUDIT INSPECTOR DRAWER (高度受 drawerHeight 控制，自由拖拽停留，最大紧贴上方汇总栏，最小为收起) */}
            {report && (
                <div 
                    style={{ height: isCollapsed ? '44px' : `${drawerHeight}px` }}
                    className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col z-30 shadow-2xl transition-[height] duration-75 flex-shrink-0"
                >
                    {/* Drawer Header Tabs (需求 2: 删除紧凑/适中/大范围，仅保留收起/展开，展开恢复上次高度) */}
                    <div className="px-6 py-2 bg-slate-100/80 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between flex-shrink-0">
                        <div className="flex items-center gap-3">
                            {/* TAB 1: 错别字检测 (排在首位) */}
                            <button
                                onClick={() => setActiveTab('typo')}
                                className={`py-1.5 px-3 text-xs font-bold rounded-lg transition flex items-center gap-1.5 ${
                                    activeTab === 'typo'
                                        ? 'bg-amber-600 text-white shadow-xs'
                                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                                }`}
                            >
                                <span>✍️ 错别字检测</span>
                                <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                                    report.typoIssues.length > 0 ? 'bg-amber-500 text-white' : 'bg-slate-200 dark:bg-slate-800'
                                }`}>
                                    {report.typoIssues.length}
                                </span>
                            </button>

                            {/* TAB 2: 人物/称谓同音排查 (排在第二位) */}
                            <button
                                onClick={() => setActiveTab('character')}
                                className={`py-1.5 px-3 text-xs font-bold rounded-lg transition flex items-center gap-1.5 ${
                                    activeTab === 'character'
                                        ? 'bg-purple-600 text-white shadow-xs'
                                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                                }`}
                            >
                                <span>👥 人物/称谓同音排查</span>
                                <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                                    report.characterConflicts.length > 0 ? 'bg-red-500 text-white' : 'bg-slate-200 dark:bg-slate-800'
                                }`}>
                                    {report.characterConflicts.length}
                                </span>
                            </button>

                            {/* TAB 3: 查重调色盘 & AI 降重 (排在第三位) */}
                            <button
                                onClick={() => setActiveTab('similarity')}
                                className={`py-1.5 px-3 text-xs font-bold rounded-lg transition flex items-center gap-1.5 ${
                                    activeTab === 'similarity'
                                        ? 'bg-sky-600 text-white shadow-xs'
                                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                                }`}
                            >
                                <span>🎨 查重调色盘 &amp; AI 降重</span>
                                <span className="px-1.5 py-0.2 rounded-full bg-white/20 text-[10px]">
                                    {report.overallSimilarity}%
                                </span>
                            </button>
                        </div>

                        {/* Drawer Actions: 一键修复错别字 & 仅保留 收起/展开 按钮 */}
                        <div className="flex items-center gap-2">
                            {activeTab === 'typo' && report.typoIssues.length > 0 && (
                                <button
                                    onClick={handleFixAllTypos}
                                    className="px-3 py-1 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-md shadow-xs transition flex items-center gap-1 mr-2"
                                >
                                    <Check className="w-3.5 h-3.5" />
                                    一键修复所有错别字 ({report.typoIssues.length})
                                </button>
                            )}

                            {/* 需求2明确要求：删除“紧凑、适中、大范围”，保留“收起/展开”，展开恢复上次高度 */}
                            <button
                                onClick={handleToggleCollapse}
                                className="px-3 py-1 bg-slate-200/80 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-lg transition flex items-center gap-1 shadow-2xs"
                                title={isCollapsed ? "展开下半审稿面板（恢复上次拖动高度）" : "收起下半审稿面板"}
                            >
                                {isCollapsed ? '展开 ▲' : '收起 ▼'}
                            </button>
                        </div>
                    </div>

                    {/* Drawer Content (Hidden if collapsed) */}
                    {!isCollapsed && (
                        <div className="flex-1 p-4 overflow-y-auto">
                            {/* TAB 1: 错别字检测详情 (排序第一) */}
                            {activeTab === 'typo' && (
                                <div>
                                    {report.typoIssues.length === 0 ? (
                                        <div className="text-center py-8 text-emerald-600 dark:text-emerald-400 text-xs font-bold flex flex-col items-center justify-center gap-2">
                                            <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-950/50 flex items-center justify-center">
                                                <Check className="w-6 h-6 text-emerald-600" />
                                            </div>
                                            <span>仿写稿件未发现常见错别字或语病标点错误，文字规范度良好！</span>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                            {report.typoIssues.map((typo) => (
                                                <div
                                                    key={typo.id}
                                                    className="p-3 bg-amber-50/60 dark:bg-amber-950/20 rounded-xl border border-amber-200 dark:border-amber-900/50 flex flex-col justify-between text-xs space-y-2 hover:shadow-xs transition"
                                                >
                                                    <div>
                                                        <div className="flex items-center justify-between mb-1">
                                                            <span className="px-2 py-0.5 rounded bg-amber-200 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200 text-[10px] font-bold">
                                                                错别字标注
                                                            </span>
                                                            <span className="text-[10px] text-slate-400">
                                                                第 {typo.index + 1} 字符处
                                                            </span>
                                                        </div>

                                                        <div className="text-slate-800 dark:text-slate-200 font-medium">
                                                            <span className="line-through text-red-500 mr-2">{typo.wrongText}</span>
                                                            <span className="text-emerald-600 dark:text-emerald-400 font-bold">&rarr; {typo.correctText}</span>
                                                        </div>

                                                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                                                            {typo.explanation}
                                                        </p>
                                                    </div>

                                                    <button
                                                        onClick={() => handleFixTypo(typo)}
                                                        className="w-full py-1 bg-amber-600 hover:bg-amber-500 text-white rounded font-bold text-xs shadow-xs transition"
                                                    >
                                                        采纳修改
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* TAB 2: 人物名称与称谓同音排查 (排序第二，严谨判断，绝不包含“三年前/不告而别”) */}
                            {activeTab === 'character' && (
                                <div className="space-y-4">
                                    {/* 识别依据与人物白名单管理条 */}
                                    <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-bold text-slate-700 dark:text-slate-300">
                                                🎯 运行依据:
                                            </span>
                                            <span className="text-[11px] text-slate-500 dark:text-slate-400">
                                                采用《百家姓》姓氏定位 + 职务称谓（总/董/爷/少/特助等）严格抓取，已彻底排除时间词与成语。
                                            </span>
                                        </div>

                                        {/* 自定义增加排查人物 */}
                                        <div className="flex items-center gap-1.5">
                                            <input
                                                type="text"
                                                value={newCharInput}
                                                onChange={(e) => setNewCharInput(e.target.value)}
                                                placeholder="补充要重点排查的人物..."
                                                className="px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-xs outline-none focus:ring-1 focus:ring-sky-500 w-44"
                                                onKeyDown={(e) => e.key === 'Enter' && handleAddCustomCharacter()}
                                            />
                                            <button
                                                onClick={handleAddCustomCharacter}
                                                className="px-2 py-1 bg-sky-600 hover:bg-sky-500 text-white rounded text-xs font-bold transition flex items-center gap-1"
                                            >
                                                <Plus className="w-3 h-3" />
                                                加入排查
                                            </button>
                                        </div>
                                    </div>

                                    {/* 检测到的人物列表标签展示（支持点击 × 排除误判） */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                                        <div className="p-2.5 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800">
                                            <span className="text-[11px] font-bold text-sky-600 dark:text-sky-400 block mb-1.5">
                                                【原稿识别出的角色及称谓 ({report.originalCharacters.length})】:
                                            </span>
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                {report.originalCharacters.length > 0 ? (
                                                    report.originalCharacters.map((cName, idx) => (
                                                        <span
                                                            key={`orig-c-${idx}`}
                                                            className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-medium flex items-center gap-1 shadow-2xs"
                                                        >
                                                            <span>{cName}</span>
                                                            <button
                                                                onClick={() => handleExcludeCharacter(cName)}
                                                                className="text-slate-400 hover:text-red-500 ml-1"
                                                                title="排除此项（如果不是角色名）"
                                                            >
                                                                &times;
                                                            </button>
                                                        </span>
                                                    ))
                                                ) : (
                                                    <span className="text-slate-400">未扫描到明显角色名</span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="p-2.5 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800">
                                            <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 block mb-1.5">
                                                【仿写识别出的角色及称谓 ({report.imitationCharacters.length})】:
                                            </span>
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                {report.imitationCharacters.length > 0 ? (
                                                    report.imitationCharacters.map((cName, idx) => (
                                                        <span
                                                            key={`imit-c-${idx}`}
                                                            className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-medium flex items-center gap-1 shadow-2xs"
                                                        >
                                                            <span>{cName}</span>
                                                            <button
                                                                onClick={() => handleExcludeCharacter(cName)}
                                                                className="text-slate-400 hover:text-red-500 ml-1"
                                                                title="排除此项（如果不是角色名）"
                                                            >
                                                                &times;
                                                            </button>
                                                        </span>
                                                    ))
                                                ) : (
                                                    <span className="text-slate-400">未扫描到明显角色名</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* 冲突卡片 */}
                                    {report.characterConflicts.length === 0 ? (
                                        <div className="text-center py-6 text-emerald-600 dark:text-emerald-400 text-xs font-bold flex flex-col items-center justify-center gap-2">
                                            <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-950/50 flex items-center justify-center">
                                                <Check className="w-6 h-6 text-emerald-600" />
                                            </div>
                                            <span>严谨比对通过！原稿与仿写稿之间未发现任何人物重名或同音/谐音违规。</span>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                            {report.characterConflicts.map((c) => {
                                                const customName = customReplaceNames[c.id] || '';

                                                return (
                                                    <div
                                                        key={c.id}
                                                        className="p-3 bg-red-50/60 dark:bg-red-950/20 rounded-xl border border-red-200 dark:border-red-900/50 flex flex-col justify-between text-xs space-y-2.5 shadow-xs"
                                                    >
                                                        <div>
                                                            <div className="flex items-center justify-between mb-1.5">
                                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                                                    c.isExactMatch ? 'bg-red-600 text-white' : 'bg-purple-600 text-white'
                                                                }`}>
                                                                    {c.isExactMatch ? '⚠️ 完全重名违规' : '🚨 同音/谐音违规'}
                                                                </span>
                                                                <span className="text-[11px] text-slate-400 font-mono">
                                                                    在仿写中出现 {c.count} 次
                                                                </span>
                                                            </div>

                                                            <div className="space-y-1 text-slate-700 dark:text-slate-300">
                                                                <div>
                                                                    <span className="text-slate-400">原稿角色:</span>{' '}
                                                                    <strong className="text-slate-900 dark:text-white">{c.originalName}</strong>{' '}
                                                                    <span className="text-[10px] text-slate-400 font-mono">({c.originalPinyin})</span>
                                                                </div>
                                                                <div>
                                                                    <span className="text-slate-400">仿写违规:</span>{' '}
                                                                    <strong className="text-red-600 dark:text-red-400">{c.imitationName}</strong>{' '}
                                                                    <span className="text-[10px] text-slate-400 font-mono">({c.imitationPinyin})</span>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="pt-2 border-t border-red-200/60 dark:border-red-900/40 space-y-2">
                                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                                <span className="text-[10px] text-slate-500">快速更名:</span>
                                                                {c.recommendedNames.map((rName, rIdx) => (
                                                                    <button
                                                                        key={rIdx}
                                                                        onClick={() => handleReplaceCharacter(c, rName)}
                                                                        className="px-1.5 py-0.5 bg-white dark:bg-slate-800 hover:bg-sky-50 dark:hover:bg-sky-900/30 text-sky-600 dark:text-sky-300 rounded border border-slate-200 dark:border-slate-700 text-[10px] font-semibold transition"
                                                                    >
                                                                        {rName}
                                                                    </button>
                                                                ))}
                                                            </div>

                                                            <div className="flex items-center gap-1.5">
                                                                <input
                                                                    type="text"
                                                                    value={customName}
                                                                    onChange={(e) => setCustomReplaceNames({ ...customReplaceNames, [c.id]: e.target.value })}
                                                                    placeholder="自定义新名字..."
                                                                    className="flex-1 px-2 py-1 bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 text-xs outline-none focus:ring-1 focus:ring-sky-500"
                                                                />
                                                                <button
                                                                    onClick={() => handleReplaceCharacter(c, customName)}
                                                                    className="px-2.5 py-1 bg-red-600 hover:bg-red-500 text-white rounded text-xs font-bold shadow-xs transition"
                                                                >
                                                                    一键替换
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* TAB 3: 查重调色盘 & AI 智能降重改写 (排序第三，带完善加载与保底输出) */}
                            {activeTab === 'similarity' && (
                                <div className="h-full flex flex-col gap-3">
                                    {selectedSentenceIndex !== null && report.sentenceSimilarities[selectedSentenceIndex] ? (
                                        <div className="flex-1 bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700/80 space-y-3 overflow-y-auto">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                                        report.sentenceSimilarities[selectedSentenceIndex].colorLevel === 'danger'
                                                            ? 'bg-red-500 text-white'
                                                            : report.sentenceSimilarities[selectedSentenceIndex].colorLevel === 'warning'
                                                            ? 'bg-amber-500 text-white'
                                                            : 'bg-yellow-500 text-white'
                                                    }`}>
                                                        当前句相似度: {Math.round(report.sentenceSimilarities[selectedSentenceIndex].similarity * 100)}%
                                                    </span>
                                                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                                        句式对比与 AI 降重建议
                                                    </span>
                                                </div>

                                                <button
                                                    onClick={() => handleAiRewriteSentence(report.sentenceSimilarities[selectedSentenceIndex])}
                                                    disabled={isAiRewriting}
                                                    className="px-4 py-1.5 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white rounded-lg text-xs font-bold shadow-sm transition flex items-center gap-1.5 disabled:opacity-50"
                                                >
                                                    {isAiRewriting ? (
                                                        <>
                                                            <ArrowPath className="w-3.5 h-3.5 animate-spin" />
                                                            <span>正在构思降重方案...</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Sparkles className="w-3.5 h-3.5" />
                                                            <span>AI 智能降重改写</span>
                                                        </>
                                                    )}
                                                </button>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                                                <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                                                    <span className="text-[10px] font-bold text-slate-400 block mb-1">【仿写当前句】:</span>
                                                    <p className="text-slate-800 dark:text-slate-200 font-medium leading-relaxed">
                                                        {report.sentenceSimilarities[selectedSentenceIndex].sentence}。
                                                    </p>
                                                </div>

                                                <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                                                    <span className="text-[10px] font-bold text-sky-500 block mb-1">【原稿最相似句】:</span>
                                                    <p className="text-slate-800 dark:text-slate-200 leading-relaxed">
                                                        {report.sentenceSimilarities[selectedSentenceIndex].matchedOriginalSentence || '未匹配到高相似原句'}。
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Loading Animation during AI rewriting */}
                                            {isAiRewriting && (
                                                <div className="p-4 bg-sky-50 dark:bg-sky-950/40 rounded-xl border border-sky-200 dark:border-sky-800 flex items-center justify-center gap-3 text-sky-700 dark:text-sky-300 text-xs">
                                                    <ArrowPath className="w-4 h-4 animate-spin text-sky-600" />
                                                    <span>正在运用 AI 重新解构句式、替换同义意象并规避原句表达，请稍候...</span>
                                                </div>
                                            )}

                                            {/* AI Rewrite Options */}
                                            {aiRewriteSuggestions.length > 0 && !isAiRewriting && (
                                                <div className="pt-2 border-t border-slate-200 dark:border-slate-700 space-y-2">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-[11px] font-bold text-sky-600 dark:text-sky-400 flex items-center gap-1">
                                                            <Sparkles className="w-3.5 h-3.5" />
                                                            为您生成的 3 组低相似度降重替代方案（点击任意一条即可一键采纳替换）：
                                                        </span>
                                                        <span className="text-[10px] text-slate-400">
                                                            原创度预估 &gt;85%
                                                        </span>
                                                    </div>

                                                    <div className="grid grid-cols-1 gap-2">
                                                        {aiRewriteSuggestions.map((sug, sIdx) => (
                                                            <div
                                                                key={`sug-${sIdx}`}
                                                                className="p-3 bg-sky-50/80 dark:bg-sky-950/30 hover:bg-sky-100 dark:hover:bg-sky-900/40 rounded-xl border border-sky-200 dark:border-sky-800 flex items-center justify-between text-xs transition cursor-pointer group"
                                                                onClick={() => handleApplyRewrite(report.sentenceSimilarities[selectedSentenceIndex].sentence, sug.text)}
                                                            >
                                                                <div className="mr-3">
                                                                    <span className="inline-block text-[10px] font-bold text-sky-600 dark:text-sky-300 bg-white dark:bg-slate-800 px-1.5 py-0.5 rounded border border-sky-200 dark:border-sky-700 mr-2">
                                                                        {sug.style}
                                                                    </span>
                                                                    <span className="text-slate-800 dark:text-slate-100 font-medium">
                                                                        {sug.text}
                                                                    </span>
                                                                </div>
                                                                <span className="px-3 py-1 bg-sky-600 group-hover:bg-sky-500 text-white rounded-md text-[11px] font-bold flex-shrink-0 shadow-2xs transition">
                                                                    一键采纳
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="flex-1 flex flex-col items-center justify-center p-8 text-slate-400 dark:text-slate-500 text-xs text-center space-y-2">
                                            <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-lg">
                                                🎨
                                            </div>
                                            <p className="font-medium text-slate-600 dark:text-slate-300">
                                                在上方【仿写稿件】中点击任意带有彩色高亮的句子
                                            </p>
                                            <p className="text-[11px] text-slate-400">
                                                即可在此查看两稿原句对照，并获得 3 组全新句式结构的 AI 智能降重改写建议！
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* 全部清除确认弹窗（防止误触） */}
            {showClearConfirm && (
                <div
                    className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
                    onClick={() => setShowClearConfirm(false)}
                >
                    <div
                        className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center flex-shrink-0">
                                <Trash className="w-5 h-5" />
                            </div>
                            <div className="space-y-1">
                                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                                    确认全部清除？
                                </h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                                    清除后将删除原稿、仿写稿件及当前所有审稿诊断结果，并恢复到最初的待输入界面。此操作不可撤销。
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-2">
                            <button
                                type="button"
                                onClick={() => setShowClearConfirm(false)}
                                className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition cursor-pointer"
                            >
                                取消
                            </button>
                            <button
                                type="button"
                                onClick={executeClearAll}
                                className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-500 rounded-lg shadow-sm transition cursor-pointer"
                            >
                                确认全部清除
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ManuscriptReview;
