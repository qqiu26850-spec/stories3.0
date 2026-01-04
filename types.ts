
export type View = 
  'creative-generation' | 
  'novel-management' | 
  'script-management' | 
  'hit-copywriting' | 
  'prompt-library' | 
  'workflow' |
  'character-library' |
  'plot-library' |
  'inspiration-library' |
  'personal-center' |
  'help';

export interface ModulePromptTemplate {
  id: string;
  name: string;
  description: string;
  promptPrefix: string;
  placeholder:string;
}

export interface CreativeModule {
  id: string;
  title: string;
  description: string;
  content: string;
  category: PromptCategory;
  subCategories: PromptSubCategory[];
  fields: PromptField[];
  template: string;
  heat: number;
  creator: 'system' | 'user';
}

export interface PromptField {
  id: string;
  label: string;
  type: 'text' | 'textarea';
  placeholder: string;
  required?: boolean;
  description?: string;
  maxLength?: number;
}

export type PromptCategory = 'general' | 'short-story' | 'long-story' | 'script';

export type PromptSubCategory = 
  'style' | 'requirements' | 'continue' | 'polish' | 'expand' | 'proofread' | 'imitate' |
  'idea' | 'golden_finger' | 'character_design' | 'worldview' | 'outline' | 'detailed_outline' | 'synopsis' | 'writing' |
  'general' | 'modern-romance' | 'ancient-romance' | 'period' | 'apocalypse' | 
  'urban' | 'fantasy' | 'history' | 'social' | 'suspense' | 'sci-fi';


export interface Prompt {
  id: string;
  title: string;
  description: string;
  example?: string;
  content: string;
  category: PromptCategory;
  subCategories: PromptSubCategory[];
  fields: PromptField[];
  template: string;
  heat: number;
  creator: 'system' | 'user';
  userId?: string;
  authorName?: string;
}

export interface WorkflowField {
    id: string;
    label: string;
    variable: string;
    type: 'text' | 'textarea';
    required?: boolean;
    description?: string;
}

export interface WorkflowStep {
  id: string;
  name: string;
  prompt: string;
  outputVariable: string;
  manualConfirmation?: boolean;
}

export interface Workflow {
  id: string;
  title: string;
  description: string;
  usageCount: string | number;
  heat: number;
  author: string;
  userId?: string;
  category: PromptCategory;
  subCategories?: PromptSubCategory[];
  fields?: WorkflowField[];
  steps?: WorkflowStep[];
  template?: string; // 旧版兼容
}

export type AssetFormData = {
  name: string;
  personality?: string;
  relationships?: string;
  plotPoints?: string;
  scene?: string;
  genre?: string;
  elements?: string;
  coreTrope?: string;
  goldenFinger?: string;
  notes?: string;
  tags?: string;
};

export interface Asset {
  id: string;
  name: string;
  type: 'character' | 'inspiration' | 'plot';
  content: string;
  tags: string[];
  data?: AssetFormData;
}

export interface Chapter {
  id: string;
  title: string;
  content: string;
  wordCount: number;
  lastModified: string;
}

export interface NovelSettings {
  typeElements: string;
  theme: string;
  targetAudience: string;
  synopsis: string;
  worldview: string;
  characterSettings: string;
}

export interface Novel {
  id: string;
  title: string;
  coverImage: string | null;
  wordCount: number;
  creationDate: string;
  settings: NovelSettings;
  chapters: Chapter[];
}

export interface Scene {
    id: string;
    title: string;
    content: string;
}

export interface Script {
  id: string;
  title: string;
  coverImage: string | null;
  wordCount: number;
  type: 'original' | 'adaptation';
  creationDate: string;
  scenes: Scene[];
}

export type Project = Novel | Script;

export interface UserProfile {
  id: string;
  nickname: string;
  email?: string;
  avatarUrl: string | null;
}

export interface RechargeRecord {
  id: string;
  date: string;
  amount: number;
  status: 'Success' | 'Failed';
}

export interface FavoriteItem {
  id: string;
  title: string;
  type: 'prompt' | 'novel' | 'script' | 'character';
  description: string;
}
