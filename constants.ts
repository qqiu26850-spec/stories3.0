
import { CreativeModule, Prompt, Asset, Workflow } from './types';

export const CREATIVE_MODULES: CreativeModule[] = [
  {
    id: 'brainstorm',
    title: '创意脑洞',
    description: '生成小说故事雏形和简要故事梗概。',
    content: '生成小说故事雏形和简要故事梗概。',
    category: 'long-story',
    subCategories: ['requirements'],
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
    subCategories: ['requirements'],
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
    subCategories: ['requirements'],
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
    subCategories: ['requirements'],
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
    subCategories: ['requirements'],
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
    subCategories: ['requirements'],
    fields: [],
    template: '',
    heat: 5500,
    creator: 'system',
  },
  {
    id: 'synopsis',
    title: '小说简介',
    description: '生成爆款小说介绍。',
    content: '生成爆款小说介绍。',
    category: 'short-story',
    subCategories: ['requirements'],
    fields: [],
    template: '',
    heat: 4200,
    creator: 'system',
  }
];

export const PROMPTS: Prompt[] = [
  {
    id: 'shiqing-outline',
    title: '世情文大纲生成',
    description: '专注于生成描写社会人情冷暖、世态炎凉的世情小说大纲。',
    content: '请写一个世情小说大纲。',
    category: 'long-story',
    subCategories: ['requirements'],
    fields: [
      { id: 'background', label: '时代背景', type: 'text', placeholder: '例如：明清市井、现代职场、民国豪门' },
      { id: 'main_plot', label: '核心情节', type: 'textarea', placeholder: '描述故事的主要脉络，如家族兴衰、婚姻危机...' },
      { id: 'characters', label: '关键人物', type: 'textarea', placeholder: '主角及主要配角的简要设定...' }
    ],
    template: '你是一位擅长描写人情世故、社会百态的小说家。请根据以下要求，生成一份详细的“世情文”小说大纲。\n\n【时代背景】：${background}\n【核心情节】：${main_plot}\n【关键人物】：${characters}\n\n要求：\n1. 故事风格要写实、细腻，体现“世态炎凉”和“人情冷暖”。\n2. 输出故事简介（500字左右）。\n3. 输出人物关系图谱描述。\n4. 输出前3个关键转折点的情节设计。',
    heat: 888,
    creator: 'system',
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
    title: '小说转剧本改编流',
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
