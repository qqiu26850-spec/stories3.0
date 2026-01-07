
import { createClient } from '@supabase/supabase-js';

// Helper to safely access environment variables in various environments (Vite, CRA, Next.js)
const getEnvVar = (key: string, viteKey?: string) => {
    let value = '';
    
    // Try import.meta.env (Vite)
    try {
        // @ts-ignore
        if (typeof import.meta !== 'undefined' && import.meta.env) {
            // @ts-ignore
            value = import.meta.env[viteKey || key] || '';
        }
    } catch (e) {}

    if (value) return value;

    // Try process.env
    try {
        if (typeof process !== 'undefined' && process.env) {
            value = process.env[key] || '';
        }
    } catch (e) {}

    return value;
};

// Initialize Supabase client
// Use a placeholder if variables are missing to prevent immediate crash, though API calls will fail.
const supabaseUrl = getEnvVar('REACT_APP_SUPABASE_URL', 'VITE_SUPABASE_URL') || getEnvVar('NEXT_PUBLIC_SUPABASE_URL') || 'https://placeholder.supabase.co';
const supabaseKey = getEnvVar('REACT_APP_SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY') || getEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY') || 'placeholder';

export const supabase = createClient(supabaseUrl, supabaseKey);

// Cache variables
let promptsCache: any[] | null = null;
let workflowsCache: any[] | null = null;

// --- Auth Services ---

export const getCurrentUserId = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id || null;
};

export const signIn = async (email: string, password: string) => {
  return await supabase.auth.signInWithPassword({ email, password });
};

export const signUp = async (email: string, password: string) => {
  return await supabase.auth.signUp({ email, password });
};

export const signOut = async () => {
  promptsCache = null;
  workflowsCache = null;
  return await supabase.auth.signOut();
};

export const resetPasswordForEmail = async (email: string) => {
  return await supabase.auth.resetPasswordForEmail(email);
};

export const fetchUserProfile = async () => {
  const userId = await getCurrentUserId();
  if (!userId) return null;
  const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
  return data;
};

export async function updateUserProfile(nickname: string, avatarUrl: string | null, newEmail?: string, password?: string) {
    const userId = await getCurrentUserId();
    if (!userId) return { error: '未登录' };
    
    let emailUpdatePending = false;

    try {
        if (newEmail) {
            const { data: { user } } = await supabase.auth.getUser();
            const currentEmail = user?.email;

            if (currentEmail && newEmail !== currentEmail) {
                if (!password) {
                    return { error: '为了您的账户安全，修改邮箱需要输入当前密码验证身份。' };
                }

                const { error: signInError } = await supabase.auth.signInWithPassword({
                    email: currentEmail,
                    password: password
                });

                if (signInError) {
                    return { error: '密码错误，身份验证失败。' };
                }

                const { error: emailError } = await supabase.auth.updateUser({ email: newEmail });
                
                if (emailError) {
                    return { error: `邮箱更新失败: ${emailError.message}` };
                }
                
                emailUpdatePending = true;
            }
        }

        const updates: any = {
            data: { full_name: nickname, avatar_url: avatarUrl }
        };
        
        const { data, error: authError } = await supabase.auth.updateUser(updates);
        if (authError) throw authError;

        const { error } = await supabase.from('profiles').upsert({ 
            id: userId, 
            username: nickname, 
            avatar_url: avatarUrl,
            updated_at: new Date().toISOString()
        });

        if (error) console.warn("Profiles table update failed", error);

        promptsCache = null; 
        
        return { error: null, data, emailUpdatePending };
    } catch (e: any) {
        return { error: e.message || '更新失败' };
    }
}

export const deleteUserData = async () => {
    const userId = await getCurrentUserId();
    if (!userId) return false;
    
    try {
        // Attempt to delete related data first to avoid FK constraints if not set to cascade
        await supabase.from('projects').delete().eq('user_id', userId);
        await supabase.from('materials').delete().eq('user_id', userId);
        await supabase.from('prompts').delete().eq('user_id', userId);
        await supabase.from('workflows').delete().eq('user_id', userId);
        await supabase.from('profiles').delete().eq('id', userId);
        
        // Note: Actual user deletion usually requires service role key or RPC function 'delete_user'
        // Here we just sign out as a simulation of deletion from client perspective if RPC fails or not exists.
        // In a real app, you would call a backend function.
        await supabase.auth.signOut();
        return true;
    } catch (e) {
        console.error(e);
        return false;
    }
};

// --- Prompt Services ---

export const fetchPrompts = async (category = 'all', forceRefresh = false) => {
    if (promptsCache && !forceRefresh && category === 'all') return promptsCache;
    
    let query = supabase.from('prompts').select('*, profiles(username)');
    if (category !== 'all') {
        query = query.eq('main_category', category);
    }
    query = query.order('usage_count', { ascending: false });

    const { data, error } = await query;
    if (error) {
        console.error(error);
        return [];
    }
    
    if (category === 'all') promptsCache = data;
    return data;
};

export const savePrompt = async (title: string, content: string, category: string, subCategory: string) => {
    const userId = await getCurrentUserId();
    if (!userId) return null;
    const { data, error } = await supabase.from('prompts').insert({
        user_id: userId,
        title,
        content,
        main_category: category,
        sub_category: subCategory,
        usage_count: 0
    }).select();
    if (!error) promptsCache = null;
    return data;
};

export const updatePrompt = async (id: string, updates: any) => {
    const { error } = await supabase.from('prompts').update(updates).eq('id', id);
    if (!error) promptsCache = null;
    return error;
};

export const deletePrompt = async (id: string) => {
    const { error } = await supabase.from('prompts').delete().eq('id', id);
    if (!error) promptsCache = null;
    return error;
};

export const incrementPromptHeat = async (id: string) => {
    const { error } = await supabase.rpc('increment_prompt_usage', { prompt_id: id });
    if (error) {
        // Fallback
        const { data } = await supabase.from('prompts').select('usage_count').eq('id', id).single();
        if (data) {
            await supabase.from('prompts').update({ usage_count: (data.usage_count || 0) + 1 }).eq('id', id);
        }
    }
};

// --- Material (Asset) Services ---

export const fetchMaterials = async (type?: string) => {
    const userId = await getCurrentUserId();
    if (!userId) return [];
    
    let query = supabase.from('materials').select('*').eq('user_id', userId);
    if (type) {
        query = query.eq('type', type);
    }
    query = query.order('created_at', { ascending: false });
    
    const { data, error } = await query;
    if (error) return [];
    return data;
};

export const saveMaterial = async (name: string, content: string, type: string, tags: string[]) => {
    const userId = await getCurrentUserId();
    if (!userId) return null;
    const { data, error } = await supabase.from('materials').insert({
        user_id: userId,
        name,
        content,
        type,
        tags
    }).select();
    return data;
};

export const updateMaterial = async (id: string, updates: any) => {
    const { error } = await supabase.from('materials').update(updates).eq('id', id);
    return error;
};

export const deleteMaterial = async (id: string) => {
    const { error } = await supabase.from('materials').delete().eq('id', id);
    return error;
};

export const toggleMaterialFavorite = async (id: string, isFavorite: boolean) => {
    await supabase.from('materials').update({ is_favorite: isFavorite }).eq('id', id);
};

// --- Project (Novel/Script) Services ---

export const fetchProjects = async () => {
    const userId = await getCurrentUserId();
    if (!userId) return [];
    const { data, error } = await supabase.from('projects').select('*').eq('user_id', userId).order('updated_at', { ascending: false });
    if (error) return [];
    return data;
};

export const createProject = async (title: string, description: string, type: string, coverUrl: string | null) => {
    const userId = await getCurrentUserId();
    if (!userId) return { error: { message: 'Not logged in' } };
    
    const { data, error } = await supabase.from('projects').insert({
        user_id: userId,
        title,
        description,
        type,
        cover_url: coverUrl
    }).select().single();
    
    return { id: data?.id, error };
};

export const updateProject = async (id: string, updates: any) => {
    await supabase.from('projects').update(updates).eq('id', id);
};

export const deleteProject = async (id: string) => {
    await supabase.from('projects').delete().eq('id', id);
    // Also delete chapters
    await supabase.from('chapters').delete().eq('project_id', id);
};

// --- Chapter Services ---

export const fetchChapters = async (projectId: string) => {
    const { data, error } = await supabase.from('chapters').select('*').eq('project_id', projectId).order('order_index', { ascending: true });
    if (error) return [];
    return data;
};

export const saveChapterToDB = async (projectId: string, chapterId: string, title: string, content: string, orderIndex: number) => {
    if (chapterId.startsWith('new-')) {
        // Insert
        const { data, error } = await supabase.from('chapters').insert({
            project_id: projectId,
            title,
            content,
            order_index: orderIndex
        }).select().single();
        if (error) return null;
        return data.id;
    } else {
        // Update
        const { error } = await supabase.from('chapters').update({
            title,
            content,
            updated_at: new Date().toISOString()
        }).eq('id', chapterId);
        if (error) return null;
        return chapterId;
    }
};

export const deleteChapterFromDB = async (id: string) => {
    await supabase.from('chapters').delete().eq('id', id);
};

export const updateChapterOrder = async (updates: { id: string, order_index: number }[]) => {
    for (const update of updates) {
        await supabase.from('chapters').update({ order_index: update.order_index }).eq('id', update.id);
    }
};

// --- Workflow Services ---

export const fetchWorkflows = async () => {
    if (workflowsCache) return workflowsCache;
    
    const { data, error } = await supabase.from('workflows').select('*, profiles(username)').order('usage_count', { ascending: false });
    if (error) return [];
    
    workflowsCache = data;
    return data;
};

export const saveWorkflow = async (title: string, description: string, category: string, subCategories: string[], fields: any[], steps: any[]) => {
    const userId = await getCurrentUserId();
    if (!userId) return;
    
    const content = JSON.stringify({ fields, steps });
    const { error } = await supabase.from('workflows').insert({
        user_id: userId,
        title,
        description,
        main_category: category,
        sub_categories: subCategories,
        content,
        usage_count: 0
    });
    if (!error) workflowsCache = null;
};

export const updateWorkflow = async (id: string, data: any) => {
    const content = JSON.stringify({ fields: data.fields, steps: data.steps });
    const { error } = await supabase.from('workflows').update({
        title: data.title,
        description: data.description,
        main_category: data.category,
        sub_categories: data.subCategories,
        content
    }).eq('id', id);
    if (!error) workflowsCache = null;
};

export const deleteWorkflow = async (id: string) => {
    const { error } = await supabase.from('workflows').delete().eq('id', id);
    if (!error) workflowsCache = null;
};

export const incrementWorkflowUsage = async (id: string) => {
    const { error } = await supabase.rpc('increment_workflow_usage', { workflow_id: id });
    if (error) {
         const { data } = await supabase.from('workflows').select('usage_count').eq('id', id).single();
         if (data) {
             await supabase.from('workflows').update({ usage_count: (data.usage_count || 0) + 1 }).eq('id', id);
         }
    }
};

export const fetchWorkflowFavorites = async () => {
    const userId = await getCurrentUserId();
    if (!userId) return [];
    const { data } = await supabase.from('workflow_favorites').select('workflow_id').eq('user_id', userId);
    return data?.map(f => f.workflow_id) || [];
};

export const toggleWorkflowFavoriteDB = async (workflowId: string, isCurrentlyFavorited: boolean) => {
    const userId = await getCurrentUserId();
    if (!userId) return;
    
    if (isCurrentlyFavorited) {
        await supabase.from('workflow_favorites').delete().eq('user_id', userId).eq('workflow_id', workflowId);
    } else {
        await supabase.from('workflow_favorites').insert({ user_id: userId, workflow_id: workflowId });
    }
};

// --- Personal Center ---

export const fetchUserLibrary = async () => {
    const userId = await getCurrentUserId();
    if (!userId) return { prompts: [], materials: [] };
    
    // In a real implementation, you would join tables or fetch by user_id
    const { data: prompts } = await supabase.from('prompts').select('*').eq('user_id', userId); 
    const { data: materials } = await supabase.from('materials').select('*').eq('user_id', userId);
    
    return { prompts: prompts || [], materials: materials || [] };
};
