
import { createClient } from '@supabase/supabase-js';

// Mock Supabase Client Structure (to satisfy types if referenced directly, though we use mock functions)
export const supabase = {
    from: (table: string) => ({
        select: (columns: string) => ({
            eq: (col: string, val: any) => ({
                maybeSingle: async () => ({ data: null, error: null }),
                order: () => ({ data: [], error: null })
            }),
            order: () => ({ data: [], error: null }),
            upsert: async (data: any) => ({ data, error: null }),
            delete: () => ({ eq: () => ({ error: null }) })
        }),
        insert: (data: any) => ({ select: () => ({ single: async () => ({ data: { ...data, id: 'mock-id' }, error: null }) }) }),
        upsert: (data: any) => ({ select: () => ({ single: async () => ({ data: { ...data, id: 'mock-id' }, error: null }) }) }),
        update: (data: any) => ({ eq: () => ({ select: () => ({ single: async () => ({ data: { ...data }, error: null }) }) }) }),
        delete: () => ({ eq: () => ({ error: null }) })
    }),
    auth: {
        signUp: async () => ({ data: { user: { id: 'mock-user' } }, error: null }),
        signInWithPassword: async () => ({ data: { user: { id: 'mock-user' } }, error: null }),
        signOut: async () => ({ error: null }),
        resetPasswordForEmail: async () => ({ error: null })
    }
};

// Helper for LocalStorage
const getStore = (key: string) => {
    try {
        if (typeof window === 'undefined') return [];
        return JSON.parse(localStorage.getItem(key) || '[]');
    } catch { return []; }
};
const setStore = (key: string, data: any[]) => {
    if (typeof window !== 'undefined') localStorage.setItem(key, JSON.stringify(data));
};

// Auth
export const getCurrentUserId = async () => 'mock-user-id';
export const signOut = async () => { if (typeof window !== 'undefined') localStorage.removeItem('mock_user'); return { error: null }; };
export const signIn = async (email, password) => { return { data: { user: { id: 'mock-user-id', user_metadata: {} } }, error: null }; };
export const signUp = async (email, password) => { return { data: { user: { id: 'mock-user-id' } }, error: null }; };
export const resetPasswordForEmail = async (email) => { return { error: null }; };
export const fetchUserProfile = async () => ({ id: 'mock-user-id', nickname: '模拟用户', avatarUrl: null, email: 'demo@example.com' });
export const updateUserProfile = async (nickname, avatarUrl) => { return { error: null }; };
export const deleteUserData = async () => true;

// Materials (Assets)
export const saveMaterial = async (name, content, type, tags) => {
    const items = getStore('mock_materials');
    const newItem = { id: `mat-${Date.now()}`, name, content, type, tags, created_at: new Date().toISOString(), user_id: 'mock-user-id', isFavorite: false };
    setStore('mock_materials', [newItem, ...items]);
    return newItem;
};
export const fetchMaterials = async (type?) => {
    const items = getStore('mock_materials');
    return type ? items.filter((i: any) => i.type === type) : items;
};
export const updateMaterial = async (id, updates) => {
    const items = getStore('mock_materials');
    const idx = items.findIndex((i: any) => i.id === id);
    if (idx > -1) {
        items[idx] = { ...items[idx], ...updates };
        setStore('mock_materials', items);
    }
};
export const deleteMaterial = async (id) => {
    const items = getStore('mock_materials');
    setStore('mock_materials', items.filter((i: any) => i.id !== id));
};
export const toggleMaterialFavorite = async (id, isFav) => {
    const items = getStore('mock_materials');
    const idx = items.findIndex((i: any) => i.id === id);
    if (idx > -1) {
        items[idx].isFavorite = isFav;
        setStore('mock_materials', items);
    }
};

// Prompts
export const savePrompt = async (title, content, mainCategory, subCategory) => {
    const items = getStore('mock_prompts');
    const newItem = { id: `pmt-${Date.now()}`, title, content, main_category: mainCategory, sub_category: subCategory, usage_count: 0, user_id: 'mock-user-id', created_at: new Date().toISOString() };
    setStore('mock_prompts', [newItem, ...items]);
    return newItem;
};
export const fetchPrompts = async (options) => {
    let items = getStore('mock_prompts');
    if (options?.category && options.category !== 'all') items = items.filter((i: any) => i.main_category === options.category);
    if (options?.search) items = items.filter((i: any) => i.title.toLowerCase().includes(options.search.toLowerCase()));
    if (options?.userId) items = items.filter((i: any) => i.user_id === options.userId);
    if (options?.ids) items = items.filter((i: any) => options.ids.includes(i.id));
    return items;
};
export const updatePrompt = async (id, updates) => {
    const items = getStore('mock_prompts');
    const idx = items.findIndex((i: any) => i.id === id);
    if (idx > -1) {
        items[idx] = { ...items[idx], ...updates };
        setStore('mock_prompts', items);
    }
};
export const deletePrompt = async (id) => {
    const items = getStore('mock_prompts');
    setStore('mock_prompts', items.filter((i: any) => i.id !== id));
};
export const incrementPromptHeat = async (id) => {
    const items = getStore('mock_prompts');
    const idx = items.findIndex((i: any) => i.id === id);
    if (idx > -1) {
        items[idx].usage_count = (items[idx].usage_count || 0) + 1;
        setStore('mock_prompts', items);
    }
};
export const fetchPromptFavorites = async () => getStore('mock_prompt_favs');
export const togglePromptFavoriteDB = async (id, isFav) => {
    let favs = getStore('mock_prompt_favs');
    if (isFav) {
        if (!favs.includes(id)) favs.push(id);
    } else {
        favs = favs.filter((f: any) => f !== id);
    }
    setStore('mock_prompt_favs', favs);
};

// Projects (Novels/Scripts)
export const createProject = async (title, description, type, coverUrl?) => {
    const items = getStore('mock_projects');
    const newItem = { id: `proj-${Date.now()}`, title, description, type, cover_url: coverUrl, word_count: 0, created_at: new Date().toISOString(), user_id: 'mock-user-id' };
    setStore('mock_projects', [newItem, ...items]);
    return { id: newItem.id, error: null };
};
export const fetchProjects = async (page?) => getStore('mock_projects');
export const updateProject = async (id, updates) => {
    const items = getStore('mock_projects');
    const idx = items.findIndex((i: any) => i.id === id);
    if (idx > -1) {
        items[idx] = { ...items[idx], ...updates };
        setStore('mock_projects', items);
    }
};
export const deleteProject = async (id) => {
    const items = getStore('mock_projects');
    setStore('mock_projects', items.filter((i: any) => i.id !== id));
};

// Chapters / Scenes
export const saveChapterToDB = async (projectId, chapterId, title, content, orderIndex) => {
    const items = getStore('mock_chapters');
    const existingIdx = items.findIndex((i: any) => i.id === chapterId);
    let newId = chapterId;
    if (chapterId.startsWith('new-')) newId = `chap-${Date.now()}`;
    
    const newItem = { id: newId, project_id: projectId, title, content, order_index: orderIndex, updated_at: new Date().toISOString() };
    
    if (existingIdx > -1) {
        items[existingIdx] = newItem;
    } else {
        items.push(newItem);
    }
    setStore('mock_chapters', items);
    return newId;
};
export const fetchChapters = async (projectId) => {
    const items = getStore('mock_chapters');
    return items.filter((i: any) => i.project_id === projectId).sort((a: any, b: any) => a.order_index - b.order_index);
};
export const fetchChapterContent = async (chapterId) => {
    const items = getStore('mock_chapters');
    return items.find((i: any) => i.id === chapterId)?.content || '';
};
export const deleteChapterFromDB = async (chapterId) => {
    const items = getStore('mock_chapters');
    setStore('mock_chapters', items.filter((i: any) => i.id !== chapterId));
};
export const updateChapterOrder = async (updates) => {
    const items = getStore('mock_chapters');
    updates.forEach((u: any) => {
        const idx = items.findIndex((i: any) => i.id === u.id);
        if (idx > -1) items[idx].order_index = u.order_index;
    });
    setStore('mock_chapters', items);
};

// Workflows
export const saveWorkflow = async (name, description, type, subCategories, fields, steps) => {
    const items = getStore('mock_workflows');
    const newItem = { id: `wf-${Date.now()}`, title: name, description, main_category: type, sub_categories: subCategories, content: JSON.stringify({ fields, steps }), usage_count: 0, user_id: 'mock-user-id', created_at: new Date().toISOString() };
    setStore('mock_workflows', [newItem, ...items]);
    return newItem;
};
export const fetchWorkflows = async (options) => {
    let items = getStore('mock_workflows');
    if (options?.category && options.category !== 'all') items = items.filter((i: any) => i.main_category === options.category);
    if (options?.search) items = items.filter((i: any) => i.title.toLowerCase().includes(options.search.toLowerCase()));
    if (options?.ids) items = items.filter((i: any) => options.ids.includes(i.id));
    if (options?.userId) items = items.filter((i: any) => i.user_id === options.userId);
    return items;
};
export const updateWorkflow = async (id, updates) => {
    const items = getStore('mock_workflows');
    const idx = items.findIndex((i: any) => i.id === id);
    if (idx > -1) {
        let content = items[idx].content;
        if(updates.fields || updates.steps) {
             content = JSON.stringify({ fields: updates.fields || [], steps: updates.steps || [] });
        }
        items[idx] = { 
            ...items[idx], 
            title: updates.title || items[idx].title, 
            description: updates.description || items[idx].description, 
            main_category: updates.category || items[idx].main_category, 
            sub_categories: updates.subCategories || items[idx].sub_categories, 
            content 
        };
        setStore('mock_workflows', items);
    }
};
export const deleteWorkflow = async (id) => {
    const items = getStore('mock_workflows');
    setStore('mock_workflows', items.filter((i: any) => i.id !== id));
};
export const incrementWorkflowUsage = async (id) => {
    const items = getStore('mock_workflows');
    const idx = items.findIndex((i: any) => i.id === id);
    if (idx > -1) {
        items[idx].usage_count = (items[idx].usage_count || 0) + 1;
        setStore('mock_workflows', items);
    }
};
export const fetchWorkflowFavorites = async () => getStore('mock_workflow_favs');
export const toggleWorkflowFavoriteDB = async (id, isFav) => {
    let favs = getStore('mock_workflow_favs');
    if (isFav) {
        if (!favs.includes(id)) favs.push(id);
    } else {
        favs = favs.filter((f: any) => f !== id);
    }
    setStore('mock_workflow_favs', favs);
};

// Script Workflow State
export const saveScriptWorkflowState = async (projectId, workflowId, formState, stepResults, visibleIndex) => {
    const states = getStore('mock_script_states');
    const idx = states.findIndex((s: any) => s.project_id === projectId);
    const newState = { project_id: projectId, workflow_id: workflowId, form_state: formState, step_results: stepResults, visible_index: visibleIndex, updated_at: new Date().toISOString() };
    
    if (idx > -1) states[idx] = newState;
    else states.push(newState);
    setStore('mock_script_states', states);
};
export const fetchScriptWorkflowState = async (projectId) => {
    const states = getStore('mock_script_states');
    return states.find((s: any) => s.project_id === projectId) || null;
};
export const deleteScriptWorkflowState = async (projectId) => {
    const states = getStore('mock_script_states');
    setStore('mock_script_states', states.filter((s: any) => s.project_id !== projectId));
};

export const fetchUserLibrary = async () => {
    return {
        prompts: getStore('mock_prompts'),
        materials: getStore('mock_materials')
    };
};
