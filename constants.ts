
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

// Empty Prompts Array as requested
export const PROMPTS: Prompt[] = [];

// Empty Assets Array (Optional, kept as sample data for now if needed, but request didn't explicitly ask to remove sample assets, only prompts and workflows. Leaving as is based on instruction to focus on Prompts/Workflows or clearing if implied.)
// Keeping Assets strictly as examples for "Import" feature if user has none, 
// but Prompts and Workflows are cleared.
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
    }
];

// Empty Workflows Array as requested
export const WORKFLOWS: Workflow[] = [];
