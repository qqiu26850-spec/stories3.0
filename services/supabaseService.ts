
import { createClient } from '@supabase/supabase-js';

// Fix: Extremely safe access to import.meta.env
const getEnvVar = (key: string, defaultValue: string) => {
    try {
        // @ts-ignore
        if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
            // @ts-ignore
            return import.meta.env[key];
        }
    } catch (e) {
        // Ignore errors during access
    }
    return defaultValue;
};

const SUPABASE_URL = getEnvVar('VITE_SUPABASE_URL', 'https://kuvfgccoyekvkolkgwby.supabase.co');
const SUPABASE_ANON_KEY = getEnvVar('VITE_SUPABASE_ANON_KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1dmZnY2NveWVrdmtvbGtnd2J5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0NDc5NzIsImV4cCI6MjA4MTAyMzk3Mn0.94-LLSUIN5HSfi4-wq0dhmxAP1T2beyKiR8z7CdWstg');

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
    }
});

// --- Global Cache Variables ---
// Removed cache for prompts to support pagination
let lastFetchTime = 0;
const CACHE_DURATION = 60000 * 5;

export async function getCurrentUserId() {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.user?.id || null;
}

async function withRetry<T>(operation: () => Promise<T>, retries = 3): Promise<T> {
    try {
        return await operation();
    } catch (err: any) {
        if (retries > 0 && (err.message?.includes('fetch') || err.status === 500)) {
            await new Promise(r => setTimeout(r, 1000));
            return withRetry(operation, retries - 1);
        }
        throw err;
    }
}

async function ensureUserProfileExists() {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profile } = await supabase.from('profiles').select('id').eq('id', user.id).maybeSingle();
        
        if (!profile) {
            const metadata = user.user_metadata || {};
            const nickname = metadata.full_name || metadata.name || metadata.nickname || `用户${user.id.substring(0, 6)}`;
            const avatarUrl = metadata.avatar_url || null;

            console.log("Profile missing, auto-creating for:", nickname);

            await supabase.from('profiles').upsert({
                id: user.id,
                username: nickname,
                avatar_url: avatarUrl,
                updated_at: new Date().toISOString()
            });
        }
    } catch (e) {
        console.warn("Ensure profile failed, ignoring:", e);
    }
}

export async function signUp(email: string, password: string) {
    return await supabase.auth.signUp({ 
        email, 
        password,
        options: {
            emailRedirectTo: typeof window !== 'undefined' ? window.location.origin : undefined
        }
    });
}

export async function signIn(email: string, password: string) {
    return await supabase.auth.signInWithPassword({ email, password });
}

export async function signOut() {
    return await supabase.auth.signOut();
}

export async function resetPasswordForEmail(email: string) {
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
  });
  return { data, error };
}

export async function fetchUserProfile() {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return { nickname: '未登录用户', avatarUrl: null, email: '' };
        
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
        
        const nickname = session.user.user_metadata?.full_name || profile?.username || '奇思妙想家';
        const avatarUrl = session.user.user_metadata?.avatar_url || profile?.avatar_url || null;

        return {
            nickname,
            avatarUrl,
            email: session.user.email
        };
    } catch (e) {
        return { nickname: '奇思妙想家', avatarUrl: null, email: '' };
    }
}

export async function updateUserProfile(nickname: string, avatarUrl: string | null, email?: string) {
    const userId = await getCurrentUserId();
    if (!userId) return { error: '未登录' };
    try {
        const updates: any = {
            data: { full_name: nickname, avatar_url: avatarUrl }
        };
        if (email) updates.email = email;

        const { data, error: authError } = await supabase.auth.updateUser(updates);
        if (authError) throw authError;

        const { error } = await supabase.from('profiles').upsert({ 
            id: userId, 
            username: nickname, 
            avatar_url: avatarUrl,
            updated_at: new Date().toISOString()
        });

        if (error) console.warn("Profiles table update failed", error);

        return { error: null, data };
    } catch (e: any) {
        return { error: e };
    }
}

export async function deleteUserData(): Promise<boolean> {
    try {
        const userId = await getCurrentUserId();
        if (!userId) throw new Error("User not logged in");
        await supabase.auth.updateUser({ data: { is_deleted: true } });
        await supabase.from('projects').delete().eq('user_id', userId);
        await supabase.from('materials').delete().eq('user_id', userId);
        await signOut();
        return true;
    } catch (err: any) {
        return false;
    }
}

export async function fetchUserLibrary() {
    try {
        const userId = await getCurrentUserId();
        if (!userId) return { prompts: [], materials: [] };
        const { data: prompts } = await withRetry(async () => await supabase.from('prompts').select('*').eq('user_id', userId).order('created_at', { ascending: false }));
        const { data: materials } = await withRetry(async () => await supabase.from('materials').select('*').eq('user_id', userId).order('created_at', { ascending: false }));
        return { prompts: (prompts as any[]) || [], materials: (materials as any[]) || [] };
    } catch (e) {
        return { prompts: [], materials: [] };
    }
}

export async function createProject(title: string, desc: string, type: 'novel' | 'script' | 'short' | 'short_story', coverUrl: string | null = null) {
    try {
        const userId = await getCurrentUserId();
        if (!userId) throw new Error("请先登录");
        const dbType = type === 'short' ? 'short_story' : type;
        const { data, error } = await withRetry(async () => await supabase.from('projects').insert([{
            user_id: userId, title, description: desc, type: dbType, cover_image: coverUrl, status: 'draft'
        }]).select());
        if (error) throw error;
        return { id: data?.[0]?.id, error: null };
    } catch (err: any) {
        return { id: null, error: err };
    }
}

export async function updateProject(projectId: string, updates: { title?: string, description?: string, cover_image?: string }) {
    try {
        const userId = await getCurrentUserId();
        if (!userId) throw new Error("未登录");
        const { error } = await supabase.from('projects').update(updates).eq('id', projectId).eq('user_id', userId);
        if (error) throw error;
    } catch (err: any) {
        console.error('更新项目失败:', err.message);
    }
}

// Updated fetchProjects with pagination support and HTML-stripped word count
export async function fetchProjects(page = 1, limit = 20) {
    try {
        const userId = await getCurrentUserId();
        if (!userId) return [];
        const start = (page - 1) * limit;
        const end = start + limit - 1;

        const { data, error } = await withRetry(async () => await supabase
            .from('projects')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .range(start, end));

        if (data && data.length > 0) {
            const projectIds = data.map(p => p.id);
            const { data: chapters } = await supabase.from('chapters').select('project_id, content').in('project_id', projectIds);
            const countMap: Record<string, number> = {};
            chapters?.forEach((c: any) => {
                // Strip HTML tags for accurate word count of content
                const text = (c.content || '').replace(/<[^>]*>/g, '').replace(/\s/g, '');
                countMap[c.project_id] = (countMap[c.project_id] || 0) + text.length;
            });
            return data.map(p => ({ ...p, word_count: countMap[p.id] || 0 }));
        }
        return error ? [] : data;
    } catch (e) {
        return [];
    }
}

export async function deleteProject(id: string) {
    const userId = await getCurrentUserId();
    if (!userId) return;
    await supabase.from('projects').delete().eq('id', id).eq('user_id', userId);
}

export async function fetchChapters(projectId: string) {
    try {
        const { data, error } = await supabase.from('chapters').select('*').eq('project_id', projectId).order('order_index', { ascending: true });
        return error ? [] : data;
    } catch (e) { return []; }
}

export async function saveChapterToDB(projectId: string, chapterId: string, title: string, content: string, orderIndex: number) {
    try {
        const userId = await getCurrentUserId();
        if (!userId) throw new Error("未登录");
        const isNew = chapterId.startsWith('ch-') || chapterId.startsWith('scene-') || chapterId.startsWith('new-');
        if (isNew) {
            const { data, error } = await supabase.from('chapters').insert([{ project_id: projectId, title, content, order_index: orderIndex }]).select();
            if (error) throw error;
            return data[0].id;
        } else {
            const { data, error } = await supabase.from('chapters').update({ title, content, order_index: orderIndex }).eq('id', chapterId).select();
            if (error) throw error;
            return data[0].id;
        }
    } catch (e) {
        return null;
    }
}

export async function updateChapterOrder(updates: { id: string, order_index: number }[]) {
    try {
        const userId = await getCurrentUserId();
        if (!userId) throw new Error("未登录");
        const promises = updates.map(update => 
            supabase.from('chapters').update({ order_index: update.order_index }).eq('id', update.id)
        );
        await Promise.all(promises);
    } catch (e) {
        console.error("Failed to update order", e);
        throw e;
    }
}

export async function deleteChapterFromDB(chapterId: string) {
    if (chapterId.startsWith('ch-') || chapterId.startsWith('scene-')) return;
    await supabase.from('chapters').delete().eq('id', chapterId);
}

export async function saveMaterial(name: string, content: string, type: 'character' | 'plot' | 'idea' | 'inspiration', tags: string[] = []) {
    try {
        const userId = await getCurrentUserId();
        if (!userId) throw new Error("未登录");
        const dbType = type === 'inspiration' ? 'idea' : type;
        const { error } = await supabase.from('materials').insert([{ user_id: userId, name, content, type: dbType, tags: tags }]);
        if (error) throw error;
        return { success: true };
    } catch (err: any) {
        return { success: false, error: err };
    }
}

export async function updateMaterial(id: string, updates: { name?: string, content?: string, tags?: string[] }) {
    try {
        const userId = await getCurrentUserId();
        if (!userId) throw new Error("未登录");
        const { error } = await supabase.from('materials').update(updates).eq('id', id).eq('user_id', userId);
        if (error) throw error;
        return { success: true };
    } catch (err: any) {
        return { success: false, error: err };
    }
}

export async function toggleMaterialFavorite(id: string, isFavorite: boolean) {
    try {
        const userId = await getCurrentUserId();
        if (!userId) return;
        await supabase.from('materials').update({ is_favorite: isFavorite }).eq('id', id).eq('user_id', userId);
    } catch (e) {
        console.error("Toggle material favorite failed", e);
    }
}

export async function fetchMaterials(type?: string) {
    try {
        const userId = await getCurrentUserId();
        if (!userId) return [];
        let query = supabase.from('materials').select('*').eq('user_id', userId).order('created_at', { ascending: false });
        if (type) {
            const dbType = type === 'inspiration' ? 'idea' : type;
            query = query.eq('type', dbType);
        }
        const { data, error } = await query;
        return error ? [] : data.map((item: any) => ({ ...item, isFavorite: item.is_favorite }));
    } catch (e) { return []; }
}

export async function deleteMaterial(id: string) {
    const userId = await getCurrentUserId();
    if (!userId) return;
    await supabase.from('materials').delete().eq('id', id).eq('user_id', userId);
}

function mapPromptCategory(cat: string) {
    if (cat === 'short-story') return 'short';
    if (cat === 'long-story') return 'long';
    if (cat === 'script') return 'script';
    return cat;
}

export async function savePrompt(title: string, content: string, mainCat: string, subCat: string) {
    try {
        const userId = await getCurrentUserId();
        if (!userId) throw new Error("未登录");
        
        await ensureUserProfileExists();

        const dbMainCat = mapPromptCategory(mainCat);
        let description = '';
        try {
            const parsed = JSON.parse(content);
            if (parsed.description) description = parsed.description;
            else description = content.substring(0, 50) + '...';
        } catch (e) {
            description = content.substring(0, 50) + '...';
        }
        const { error } = await supabase.from('prompts').insert([{ user_id: userId, title, content, description, main_category: dbMainCat, sub_category: subCat, usage_count: 0 }]);
        if (error) throw error;
        return { success: true };
    } catch (err: any) {
        return { success: false, error: err };
    }
}

export async function updatePrompt(id: string, updates: { title?: string, content?: string, main_category?: string, sub_category?: string }) {
    try {
        const userId = await getCurrentUserId();
        if (!userId) throw new Error("未登录");
        const dbUpdates: any = { ...updates };
        if (updates.main_category) dbUpdates.main_category = mapPromptCategory(updates.main_category);
        if (updates.content) {
             try {
                const parsed = JSON.parse(updates.content);
                if (parsed.description) dbUpdates.description = parsed.description;
             } catch(e) {}
        }
        const { error } = await supabase.from('prompts').update(dbUpdates).eq('id', id).eq('user_id', userId);
        if (error) throw error;
        return { success: true };
    } catch (err: any) {
        return { success: false, error: err };
    }
}

// Updated fetchPrompts with flexible options
export async function fetchPrompts(options: {
    category?: string;
    userId?: string;
    ids?: string[];
    page?: number;
    limit?: number;
} = {}) {
    const { category = 'all', userId, ids, page = 1, limit = 20 } = options;

    try {
        const start = (page - 1) * limit;
        const end = start + limit - 1;

        let query = supabase.from('prompts').select('*, profiles(username)').order('usage_count', { ascending: false });

        // Filter by Category
        if (category && category !== 'all' && !ids && !userId) {
            const dbCat = mapPromptCategory(category);
            query = query.eq('main_category', dbCat);
        }

        // Filter by User
        if (userId) {
            query = query.eq('user_id', userId);
        }

        // Filter by IDs (Favorites)
        if (ids && ids.length > 0) {
            query = query.in('id', ids);
        } else if (ids && ids.length === 0) {
            // If ids filter is requested but list is empty (e.g. no favorites), return empty
            return [];
        }

        // Apply Pagination
        query = query.range(start, end);

        let { data, error } = await query;

        // Fallback if join fails (e.g. profiles permissions issue)
        if (error) {
            console.warn("fetchPrompts join failed, fallback to simple select", error);
            let fallbackQuery = supabase.from('prompts').select('*').order('usage_count', { ascending: false });
            
            if (category && category !== 'all' && !ids && !userId) {
                const dbCat = mapPromptCategory(category);
                fallbackQuery = fallbackQuery.eq('main_category', dbCat);
            }
            if (userId) fallbackQuery = fallbackQuery.eq('user_id', userId);
            if (ids && ids.length > 0) fallbackQuery = fallbackQuery.in('id', ids);
            else if (ids && ids.length === 0) return [];

            fallbackQuery = fallbackQuery.range(start, end);
            const res = await fallbackQuery;
            data = res.data;
            error = res.error;
        }

        if (error) return [];
        return data || [];
    } catch (e) {
        return [];
    }
}

// --- Prompt Favorites (DB Based) ---
export async function fetchPromptFavorites(): Promise<string[]> {
    const userId = await getCurrentUserId();
    if (!userId) return [];
    try {
        const { data } = await supabase.from('prompt_favorites').select('prompt_id').eq('user_id', userId);
        return data?.map((d: any) => d.prompt_id) || [];
    } catch (e) { return []; }
}

export async function togglePromptFavoriteDB(promptId: string, isFavorite: boolean) {
    const userId = await getCurrentUserId();
    if (!userId) return;
    try {
        if (isFavorite) {
            await supabase.from('prompt_favorites').delete().eq('user_id', userId).eq('prompt_id', promptId);
        } else {
            await supabase.from('prompt_favorites').insert({ user_id: userId, prompt_id: promptId });
        }
    } catch (e) { console.error("Toggle prompt favorite failed", e); }
}

export async function incrementPromptHeat(id: string) {
    try {
        if (!id || id.startsWith('prompt-')) return;
        const { data } = await supabase.from('prompts').select('usage_count').eq('id', id).single();
        if (data) {
            const newCount = (data.usage_count || 0) + 1;
            await supabase.from('prompts').update({ usage_count: newCount }).eq('id', id);
        }
    } catch (e) {}
}

export async function deletePrompt(id: string) {
    const userId = await getCurrentUserId();
    if (!userId) return;
    await supabase.from('prompts').delete().eq('id', id).eq('user_id', userId);
}

export async function saveWorkflow(title: string, description: string, category: string, subCategories: string[], fields: any[], steps: any[]) {
    try {
        const userId = await getCurrentUserId();
        if (!userId) throw new Error("未登录");
        
        await ensureUserProfileExists();

        const content = JSON.stringify({ fields, steps });
        const { error } = await supabase.from('workflows').insert([{ 
            user_id: userId, title, description, content, main_category: mapPromptCategory(category), sub_categories: subCategories, usage_count: 0 
        }]);
        if (error) throw error;
        return { success: true };
    } catch (err: any) { return { success: false, error: err }; }
}

export async function updateWorkflow(id: string, updates: { title?: string, description?: string, category?: string, subCategories?: string[], fields?: any[], steps?: any[] }) {
    try {
        const userId = await getCurrentUserId();
        if (!userId) throw new Error("未登录");
        
        const dbUpdates: any = {};
        if (updates.title) dbUpdates.title = updates.title;
        if (updates.description) dbUpdates.description = updates.description;
        if (updates.category) dbUpdates.main_category = mapPromptCategory(updates.category);
        if (updates.subCategories) dbUpdates.sub_categories = updates.subCategories;
        
        if (updates.fields || updates.steps) {
            dbUpdates.content = JSON.stringify({ 
                fields: updates.fields || [], 
                steps: updates.steps || [] 
            });
        }
        
        if (Object.keys(dbUpdates).length === 0) return { success: true };

        const { error } = await supabase.from('workflows').update(dbUpdates).eq('id', id).eq('user_id', userId);
        if (error) throw error;
        return { success: true };
    } catch (err: any) { return { success: false, error: err }; }
}

// Updated fetchWorkflows with flexible options and pagination
export async function fetchWorkflows(options: {
    category?: string;
    userId?: string;
    ids?: string[];
    page?: number;
    limit?: number;
} = {}) {
    const { category = 'all', userId, ids, page = 1, limit = 20 } = options;

    try {
        const start = (page - 1) * limit;
        const end = start + limit - 1;

        let query = supabase.from('workflows').select('*').order('usage_count', { ascending: false });

        // Filter by Category
        if (category && category !== 'all' && !ids && !userId) {
            query = query.eq('main_category', mapPromptCategory(category));
        }

        // Filter by User
        if (userId) {
            query = query.eq('user_id', userId);
        }

        // Filter by IDs (Favorites)
        if (ids && ids.length > 0) {
            query = query.in('id', ids);
        } else if (ids && ids.length === 0) {
            return [];
        }

        query = query.range(start, end);

        const { data: workflows, error: wfError } = await withRetry(async () => await query);
        
        if (wfError) {
            console.error("Fetch workflows failed", wfError);
            return [];
        }
        
        if (!workflows || workflows.length === 0) return [];

        const userIds = Array.from(new Set(workflows.map((w: any) => w.user_id).filter(Boolean)));

        if (userIds.length === 0) return workflows;

        const { data: profiles, error: profError } = await supabase
            .from('profiles')
            .select('id, username, avatar_url')
            .in('id', userIds);

        if (profError) {
            console.warn("Fetch profiles for workflows failed", profError);
        }

        const profileMap: Record<string, any> = {};
        profiles?.forEach((p: any) => {
            profileMap[p.id] = p;
        });

        return workflows.map((w: any) => {
            const profile = profileMap[w.user_id];
            return {
                ...w,
                profiles: profile
            };
        });

    } catch (e) {
        console.error("fetchWorkflows exception", e);
        return [];
    }
}

export async function deleteWorkflow(id: string) {
    const userId = await getCurrentUserId();
    if (!userId) return;
    await supabase.from('workflows').delete().eq('id', id).eq('user_id', userId);
}

export async function incrementWorkflowUsage(id: string) {
    try {
        const { data } = await supabase.from('workflows').select('usage_count').eq('id', id).single();
        if (data) {
            await supabase.from('workflows').update({ usage_count: (data.usage_count || 0) + 1 }).eq('id', id);
        }
    } catch (e) {}
}

export async function fetchWorkflowFavorites(): Promise<string[]> {
    const userId = await getCurrentUserId();
    if (!userId) return [];
    try {
        const { data } = await supabase.from('workflow_favorites').select('workflow_id').eq('user_id', userId);
        return data?.map((d: any) => d.workflow_id) || [];
    } catch (e) { return []; }
}

export async function toggleWorkflowFavoriteDB(workflowId: string, isFavorite: boolean) {
    const userId = await getCurrentUserId();
    if (!userId) return;
    try {
        if (isFavorite) {
            await supabase.from('workflow_favorites').delete().eq('user_id', userId).eq('workflow_id', workflowId);
        } else {
            await supabase.from('workflow_favorites').insert({ user_id: userId, workflow_id: workflowId });
        }
    } catch (e) { console.error("Toggle favorite failed", e); }
}

export async function uploadCoverImage(file: File) {
    try {
        const userId = await getCurrentUserId();
        if (!userId) throw new Error("未登录");
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `${userId}/${fileName}`;
        const { error } = await supabase.storage.from('covers').upload(filePath, file);
        if (error) throw error;
        const { data } = supabase.storage.from('covers').getPublicUrl(filePath);
        return data.publicUrl;
    } catch (e) { return null; }
}
