
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
  'personal-center';

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
  fields: PromptField[]; // Kept for backwards compatibility with Creative Generation
  template: string; // Kept for backwards compatibility with Creative Generation
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
}

export type PromptCategory = 'general' | 'short-story' | 'long-story' | 'script';

export type PromptSubCategory = 
  // Functional
  'style' | 'requirements' | 'continue' | 'polish' | 'proofread' | 
  'idea' | 'golden_finger' | 'character_design' | 'worldview' | 'outline' | 'detailed_outline' | 'synopsis' | 'writing' |
  // Genres
  'general' | 'modern-romance' | 'ancient-romance' | 'period' | 'apocalypse' | 
  'urban' | 'fantasy' | 'history' | 'social' | 'suspense' | 'sci-fi';


export interface Prompt {
  id: string;
  title: string;
  description: string;
  content: string;
  category: PromptCategory;
  subCategories: PromptSubCategory[];
  fields: PromptField[]; // Kept for backwards compatibility with Creative Generation
  template: string; // Kept for backwards compatibility with Creative Generation
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
}

export interface Workflow {
  id: string;
  title: string;
  description: string;
  usageCount: string;
  heat: number;
  author: string;
  category: 'short-story' | 'script' | 'my' | 'create';
  fields?: WorkflowField[];
  template?: string;
}

export type AssetFormData = {
  // Common field
  name: string;
  // Character fields
  personality?: string;
  relationships?: string;
  // Plot fields
  plotPoints?: string;
  scene?: string;
  // Inspiration fields
  genre?: string;
  elements?: string;
  coreTrope?: string;
  // Shared fields
  goldenFinger?: string; // For Character & Inspiration
  notes?: string; // For Character '补充内容' & Inspiration '补充内容'
  // New field for input
  tags?: string;
};

export interface Asset {
  id: string;
  name: string;
  type: 'character' | 'inspiration' | 'plot';
  content: string;
  tags: string[];
  data?: AssetFormData; // Store structured data for editing
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
  email?: string; // Added email field
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
