
import { CreativeModule, Prompt, Asset, Workflow, PromptSubCategory } from './types';

export const FUNCTIONAL_TAGS: { id: PromptSubCategory | 'all'; label: string }[] = [
    { id: 'idea', label: '创意' },
    { id: 'golden_finger', label: '金手指' },
    { id: 'character_design', label: '人物设定' },
    { id: 'worldview', label: '世界观' },
    { id: 'outline', label: '大纲' },
    { id: 'detailed_outline', label: '细纲' },
    { id: 'synopsis', label: '简介' },
    { id: 'short_story_lead', label: '短篇导语' },
    { id: 'requirements', label: '写作要求' },
    { id: 'style', label: '写作风格' },
    { id: 'continue', label: '续写' },
    { id: 'polish', label: '润色' },
    { id: 'expand', label: '扩写' },
    { id: 'imitate', label: '仿写' },
    { id: 'proofread', label: '审稿' },
];

export const GENRE_TAGS: { id: PromptSubCategory | 'all'; label: string }[] = [
    { id: 'general', label: '通用' },
    { id: 'modern-romance', label: '现言' },
    { id: 'ancient-romance', label: '古言' },
    { id: 'period', label: '年代' },
    { id: 'apocalypse', label: '末世' },
    { id: 'urban', label: '都市' },
    { id: 'fantasy', label: '玄幻' },
    { id: 'history', label: '历史' },
    { id: 'social', label: '世情' },
    { id: 'suspense', label: '悬疑' },
    { id: 'sci-fi', label: '科幻' },
    { id: 'comic-drama', label: '漫剧' },
    { id: 'live-action', label: '实拍剧' },
];

export const CREATIVE_MODULES: CreativeModule[] = [
  {
    id: 'brainstorm',
    title: '创意脑洞',
    description: '生成小说故事雏形和简要故事梗概。',
    content: '生成小说故事雏形和简要故事梗概。',
    category: 'long-story',
    subCategories: ['idea'],
    fields: [],
    template: '',
    heat: 5000,
    creator: 'system',
  },
  {
    id: 'golden-finger',
    title: '金手指',
    description: '生成人物的附加功能、系统、特殊设定。',
    content: '生成人物的附加功能、系统、特殊设定。',
    category: 'long-story',
    subCategories: ['golden_finger'],
    fields: [],
    template: '',
    heat: 4500,
    creator: 'system',
  },
  {
    id: 'character-design',
    title: '人物设定',
    description: '生成人物的爆款标签、社会&自然属性、人物关系。',
    content: '生成人物的爆款标签、社会&自然属性、人物关系。',
    category: 'long-story',
    subCategories: ['character_design'],
    fields: [],
    template: '',
    heat: 4800,
    creator: 'system',
  },
  {
    id: 'worldview',
    title: '世界观',
    description: '生成特殊的世界规则、社会背景设定。',
    content: '生成特殊的世界规则、社会背景设定。',
    category: 'long-story',
    subCategories: ['worldview'],
    fields: [],
    template: '',
    heat: 3200,
    creator: 'system',
  },
  {
    id: 'outline',
    title: '大纲',
    description: '生成小说的创作简单纲要。',
    content: '生成小说的创作简单纲要。',
    category: 'long-story',
    subCategories: ['outline'],
    fields: [],
    template: '',
    heat: 6000,
    creator: 'system',
  },
  {
    id: 'detailed-outline',
    title: '细纲',
    description: '生成具有丰富细节和章节纲要。',
    content: '生成具有丰富细节和章节纲要。',
    category: 'long-story',
    subCategories: ['detailed_outline'],
    fields: [],
    template: '',
    heat: 5500,
    creator: 'system',
  },
  {
    id: 'short-story-lead',
    title: '短篇导语',
    description: '生成吸引人的短篇小说开篇导语或钩子。',
    content: '生成吸引人的短篇小说开篇导语。',
    category: 'short-story',
    subCategories: ['short_story_lead'],
    fields: [],
    template: '',
    heat: 4600,
    creator: 'system',
  },
  {
    id: 'imitate-style',
    title: '文风仿写',
    description: '分析并模仿特定作家或作品的文字风格。',
    content: '分析并模仿特定作家或作品的文字风格。',
    category: 'general',
    subCategories: ['imitate'],
    fields: [],
    template: '',
    heat: 4300,
    creator: 'system',
  },
  {
    id: 'synopsis',
    title: '小说简介',
    description: '生成爆款小说介绍。',
    content: '生成爆款小说介绍。',
    category: 'short-story',
    subCategories: ['synopsis'],
    fields: [],
    template: '',
    heat: 4200,
    creator: 'system',
  }
];

export const PROMPTS: Prompt[] = [
  {
    id: 'p1',
    title: '短篇故事生成器',
    description: '根据您提供的小说类型和故事梗概，生成一个完整的短篇故事。',
    content: '请写一个类型为“科幻”的短篇故事，故事梗概是：在一个被遗弃的太空站上，一个孤独的维修工发现了一个休眠中的人工智能，它掌握着能颠覆整个银河系秩序的秘密。',
    category: 'short-story',
    subCategories: ['style', 'requirements'],
    fields: [
      { id: 'genre', label: '小说类型', type: 'text', placeholder: '例如：科幻、悬疑、爱情' },
      { id: 'synopsis', label: '故事梗概', type: 'textarea', placeholder: '简单描述故事的核心情节...' }
    ],
    template: '请写一个类型为“${genre}”的短篇故事，故事梗概是：${synopsis}。',
    heat: 1258,
    creator: 'system',
  },
  {
    id: 'p2',
    title: '角色对话续写',
    description: '基于人物性格和前情提要，为您的角色生成生动自然的对话。',
    content: '在一个紧张的对峙场景中，冷静毒舌的侦探和活泼乐观的助手正在审问嫌疑人。根据以下情景，续写他们的对话：侦探刚刚指出了嫌疑人证词中的一个致命漏洞。',
    category: 'long-story',
    subCategories: ['continue'],
    fields: [
      { id: 'characterA', label: '人物A性格', type: 'text', placeholder: '例如：冷静、毒舌' },
      { id: 'characterB', label: '人物B性格', type: 'text', placeholder: '例如：活泼、乐观' },
      { id: 'context', label: '前情提要', type: 'textarea', placeholder: '描述对话发生的背景和上一句对话内容...' }
    ],
    template: '在一个场景中，人物A（性格：${characterA}）和人物B（性格：${characterB}）正在对话。根据以下情景，续写他们的对话：${context}',
    heat: 982,
    creator: 'system',
  },
  {
    id: 'p3',
    title: '场景描写润色',
    description: '将您平实的场景描写变得更具感染力和画面感，可指定多种风格。',
    content: '请将以下这段场景描写进行润色，使其更具“电影感”风格：他走进房间，房间很乱，窗外下着雨。',
    category: 'script',
    subCategories: ['polish'],
    fields: [
      { id: 'text', label: '原文', type: 'textarea', placeholder: '贴入你需要润色的场景描写...' },
      { id: 'style', label: '期望风格', type: 'text', placeholder: '例如：电影感、华丽、简洁' }
    ],
    template: '请将以下这段场景描写进行润色，使其更具“${style}”风格：${text}',
    heat: 756,
    creator: 'system',
  },
  {
    id: 'p4',
    title: '情节审查与建议',
    description: '输入您的情节梗概，AI将帮助您检查逻辑漏洞并提出改进建议。',
    content: '请审查以下情节梗概，检查是否存在逻辑漏洞，并提出改进建议：主角为了复仇，学习了失传的魔法，但最终发现他的仇人其实是他的亲生父亲。',
    category: 'long-story',
    subCategories: ['proofread'],
    fields: [
      { id: 'text', label: '情节梗概', type: 'textarea', placeholder: '输入你需要审查的情节...' }
    ],
    template: '请审查以下情节梗概，检查是否存在逻辑漏洞，并提出改进建议：${text}',
    heat: 543,
    creator: 'system',
  },
  {
    id: 'p5',
    title: '章节大纲生成',
    description: '根据当前故事背景和核心冲突，生成详细的章节大纲。',
    content: '请为下一章写一个详细的大纲。',
    category: 'long-story',
    subCategories: ['outline'],
    fields: [
        { id: 'goal', label: '核心冲突/目标', type: 'textarea', placeholder: '例如：主角潜入敌营，发现惊人秘密...' },
        { id: 'context', label: '背景/前情 (可选)', type: 'textarea', placeholder: '默认为当前正文内容...' }
    ],
    template: '请为下一章写一个详细的大纲。当前故事背景是：${context}。本章的核心冲突或目标是：${goal}。请包含起承转合。',
    heat: 880,
    creator: 'system',
  },
  {
    id: 'p6',
    title: '场景脑暴',
    description: '为一个场景提供多个不同的创意构思。',
    content: '请为一个场景提供3个不同的创意构思。',
    category: 'long-story', 
    subCategories: ['idea'],
    fields: [
        { id: 'location', label: '地点', type: 'text', placeholder: '例如：废弃的地铁站' },
        { id: 'characters', label: '人物', type: 'text', placeholder: '例如：林夜，神秘黑客' },
        { id: 'event', label: '事件', type: 'textarea', placeholder: '例如：两人进行情报交易，突然遭遇袭击' }
    ],
    template: '请为一个场景提供3个不同的创意构思。场景发生的地点是：${location}。涉及的人物有：${characters}。发生的事件是：${event}。',
    heat: 620,
    creator: 'system',
  },
  {
    id: 'p7',
    title: '智能续写',
    description: '根据上文继续撰写正文，保持风格一致。',
    content: '请根据以下上文继续撰写一段小说正文。',
    category: 'long-story',
    subCategories: ['continue'],
    fields: [
        { id: 'instruction', label: '续写指导', type: 'textarea', placeholder: '例如：侧重心理描写，或是发生突转...' },
        { id: 'context', label: '上文 (自动读取)', type: 'textarea', placeholder: '...' }
    ],
    template: '请根据以下上文继续撰写一段小说正文。风格保持一致。\n\n【上文】\n${context}\n\n【续写要求】\n${instruction}\n\n请接着写：',
    heat: 1500,
    creator: 'system',
  },
  {
    id: 'p8',
    title: '扩写细节',
    description: '对文本进行扩写，增加环境、心理或动作描写。',
    content: '请对以下文本进行扩写。',
    category: 'long-story',
    subCategories: ['expand'],
    fields: [
        { id: 'focus', label: '扩写侧重', type: 'text', placeholder: '例如：环境细节、心理活动、动作描写...' },
        { id: 'text', label: '选中文本 (自动读取)', type: 'textarea', placeholder: '请在编辑器中选择文本...' }
    ],
    template: '请对以下文本进行扩写，增加更多的${focus}描写。\n\n【原文】\n${text}\n\n【扩写后】',
    heat: 430,
    creator: 'system',
  },
  {
    id: 'p9',
    title: '文学点评',
    description: '从人物、情节、文笔三个维度点评文本。',
    content: '请从人物塑造、情节节奏、文笔风格三个维度进行点评。',
    category: 'long-story',
    subCategories: ['proofread'],
    fields: [
        { id: 'text', label: '待点评文本 (自动读取)', type: 'textarea', placeholder: '...' }
    ],
    template: '请从人物塑造、情节节奏、文笔风格三个维度，对以下文本进行专业点评，并给出修改建议。\n\n【文本】\n${text}',
    heat: 300,
    creator: 'system',
  },
  {
    id: 'p10',
    title: '小说转剧本',
    description: '将小说文本改编为标准的影视剧本格式。',
    content: '请将以下小说片段改编为标准剧本格式。',
    category: 'script',
    subCategories: ['imitate'],
    fields: [
        { id: 'novel_text', label: '小说原文', type: 'textarea', placeholder: '粘贴需要改编的小说片段...' },
        { id: 'format_req', label: '格式要求', type: 'text', placeholder: '例如：标准电影剧本、电视剧本...' }
    ],
    template: '请将以下小说片段改编为${format_req}。请包含场景标题（INT./EXT.）、场景描述、人物动作和对白。\n\n【小说原文】\n${novel_text}',
    heat: 2100,
    creator: 'system'
  }
];


export const ASSETS: Asset[] = [
    { 
        id: 'asset-1', 
        name: '主角：林夜', 
        type: 'character', 
        content: '【金手指】: 影之力量\n【性格特点】: 冷静、内敛、重情义\n【人物关系】: 末代传人\n【补充内容】: 表面是图书管理员',
        tags: ['男主', '高冷', '异能者'],
        data: {
            name: '主角：林夜',
            goldenFinger: '影之力量',
            personality: '冷静、内敛、重情义',
            relationships: '末代传人',
            notes: '表面是图书管理员',
            tags: '男主, 高冷, 异能者'
        }
    },
    { 
        id: 'asset-2', 
        name: '世界观：灵能都市', 
        type: 'inspiration', 
        content: '【题材】: 都市异能, 科幻\n【元素】: 未来都市, 灵能者, 组织对抗\n【核心梗】: 科技与超自然并存\n【补充内容】: 背景城市叫“新弧光”，灵能者觉醒了精神力量，形成多个组织争夺控制权。',
        tags: ['赛博朋克', '背景设定', '核心'],
        data: {
             name: '世界观：灵能都市',
             genre: '都市异能, 科幻',
             elements: '未来都市, 灵能者, 组织对抗',
             coreTrope: '科技与超自然并存',
             notes: '背景城市叫“新弧光”，灵能者觉醒了精神力量，形成多个组织争夺控制权。',
             tags: '赛博朋克, 背景设定, 核心'
        }
    },
    { 
        id: 'asset-3', 
        name: '关键情节：遗失的徽记', 
        type: 'plot', 
        content: '【情节点】: 故事的核心线索是一个遗失的家族徽记，据说它隐藏着开启“影界”的秘密。\n【场景】: 主角林夜必须在各大灵能组织的追捕下，找回这个徽记，揭开自己身世的谜团。',
        tags: ['主线', '悬疑', '反转'],
        data: {
            name: '关键情节：遗失的徽记',
            plotPoints: '故事的核心线索是一个遗失的家族徽记，据说它隐藏着开启“影界”的秘密。',
            scene: '主角林夜必须在各大灵能组织的追捕下，找回这个徽记，揭开自己身世的谜团。',
            tags: '主线, 悬疑, 反转'
        }
    }
];

export const WORKFLOWS: Workflow[] = [
  {
    id: 'wf-1',
    title: '悬疑反转生成器',
    description: '专为短篇悬疑小说设计，基于核心梗概自动生成3个令人意想不到的结尾反转方案。',
    usageCount: '12.4k',
    heat: 9580,
    author: '官方',
    category: 'short-story',
    fields: [
        { id: 'f1', label: '故事梗概', variable: 'synopsis', type: 'textarea' },
        { id: 'f2', label: '核心谜题', variable: 'mystery', type: 'text' }
    ],
    template: '请根据以下故事梗概：${synopsis}，以及核心谜题：${mystery}，设计3个出人意料的结局反转。'
  },
  {
    id: 'wf-2',
    title: '情感文风润色流',
    description: '针对言情小说，将平淡的叙述转化为细腻、动人的情感描写，增强代入感。',
    usageCount: '8.9k',
    heat: 7200,
    author: '官方',
    category: 'short-story',
    fields: [
        { id: 'f1', label: '原文片段', variable: 'text', type: 'textarea' },
        { id: 'f2', label: '情感基调', variable: 'tone', type: 'text' }
    ],
    template: '请将以下文字：${text}，按照${tone}的情感基调进行润色，使其更加细腻动人。'
  },
  {
    id: 'wf-3',
    title: '三幕式剧本结构生成',
    description: '输入故事大纲，自动拆解为标准的电影三幕式结构（建置、对抗、结局）。',
    usageCount: '5.2k',
    heat: 4500,
    author: '官方',
    category: 'script',
    fields: [
        { id: 'f1', label: '故事大纲', variable: 'outline', type: 'textarea' },
        { id: 'f2', label: '类型片种', variable: 'genre', type: 'text' }
    ],
    template: '请将这个${genre}类型的故事大纲：${outline}，拆解为标准的三幕式结构。'
  },
  {
    id: 'wf-4',
    title: '小说改编剧本',
    description: '专业的改编工作流，将小说章节自动转换为分镜头剧本，保留核心对白与动作。',
    usageCount: '3.1k',
    heat: 3200,
    author: '官方',
    category: 'script',
    fields: [
        { id: 'f1', label: '小说原文', variable: 'novel_content', type: 'textarea' },
        { id: 'f2', label: '改编侧重', variable: 'focus', type: 'text' }
    ],
    template: '任务：将以下小说内容改编为剧本。\n侧重方向：${focus}。\n要求：保留核心冲突，将心理描写转化为动作或视听语言。\n\n【小说内容】：\n${novel_content}'
  }
];
