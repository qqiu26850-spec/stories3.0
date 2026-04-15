
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

// --- Global Cache ---
const promptQueryCache = new Map<string, { data: any[], timestamp: number }>();
const CACHE_DURATION = 60000 * 5; // 5 minutes cache

function invalidatePromptCache() {
    promptQueryCache.clear();
}

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
        // Limit fields for speed
        const { data: prompts } = await withRetry(async () => await supabase.from('prompts').select('id, title, description, content, main_category, sub_category, usage_count, created_at, user_id').eq('user_id', userId).order('created_at', { ascending: false }));
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

// Optimized fetchProjects: Removed chapter content fetching for significant performance boost
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

        // Note: Word count is taken directly from project metadata if available or defaults to 0.
        // We no longer fetch all chapters content to calculate it on the fly to improve performance.
        return data || [];
    } catch (e) {
        return [];
    }
}

export async function deleteProject(id: string) {
    const userId = await getCurrentUserId();
    if (!userId) return;
    await supabase.from('projects').delete().eq('id', id).eq('user_id', userId);
}

// Optimized fetchChapters: Exclude content column for fast list loading
export async function fetchChapters(projectId: string) {
    try {
        const { data, error } = await supabase
            .from('chapters')
            .select('id, title, order_index, updated_at, project_id') // Exclude content
            .eq('project_id', projectId)
            .order('order_index', { ascending: true });
        return error ? [] : data;
    } catch (e) { return []; }
}

// New: Fetch content for a single chapter on demand
export async function fetchChapterContent(chapterId: string) {
    try {
        const { data, error } = await supabase
            .from('chapters')
            .select('content')
            .eq('id', chapterId)
            .single();
        return error ? '' : (data?.content || '');
    } catch (e) { return ''; }
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

// --- Workflow State Persistence ---

export async function saveScriptWorkflowState(projectId: string, workflowId: string | undefined, formState: any, stepResults: any, visibleIndex: number) {
    try {
        const userId = await getCurrentUserId();
        if (!userId) return;
        
        await supabase.from('script_workflow_states').upsert({
            project_id: projectId,
            workflow_id: workflowId,
            form_state: formState,
            step_results: stepResults,
            visible_index: visibleIndex,
            updated_at: new Date().toISOString()
        });
    } catch (e) {
        console.error("Failed to save workflow state", e);
    }
}

export async function fetchScriptWorkflowState(projectId: string) {
    try {
        const { data, error } = await supabase
            .from('script_workflow_states')
            .select('*')
            .eq('project_id', projectId)
            .maybeSingle();
        
        if (error) return null;
        return data;
    } catch (e) {
        return null;
    }
}

export async function deleteScriptWorkflowState(projectId: string) {
    try {
        const userId = await getCurrentUserId();
        if (!userId) return;
        
        await supabase.from('script_workflow_states').delete().eq('project_id', projectId);
    } catch (e) {
        console.error("Failed to delete workflow state", e);
    }
}

// ----------------------------------

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
        
        invalidatePromptCache(); // Invalidate cache on save
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
        
        invalidatePromptCache(); // Invalidate cache on update
        return { success: true };
    } catch (err: any) {
        return { success: false, error: err };
    }
}

// Optimized fetchPrompts with caching and limited columns
export async function fetchPrompts(options: {
    category?: string;
    categories?: string[];
    userId?: string;
    ids?: string[];
    page?: number;
    limit?: number;
    search?: string;
} = {}) {
    const { category = 'all', categories, userId, ids, page = 1, limit = 20, search } = options;
    const cacheKey = JSON.stringify({ category, categories, userId, ids, page, limit, search });

    // Check Cache
    if (promptQueryCache.has(cacheKey)) {
        const cached = promptQueryCache.get(cacheKey)!;
        if (Date.now() - cached.timestamp < CACHE_DURATION) {
            return cached.data;
        }
    }

    try {
        const start = (page - 1) * limit;
        const end = start + limit - 1;

        let query = supabase.from('prompts')
            .select('id, title, description, content, main_category, sub_category, usage_count, user_id, created_at, profiles(username)')
            .order('usage_count', { ascending: false });

        // Filter by Category
        if (category && category !== 'all' && !ids && !userId) {
            const dbCat = mapPromptCategory(category);
            query = query.eq('main_category', dbCat);
        } else if (categories && categories.length > 0 && !ids && !userId) {
            const dbCats = categories.map(mapPromptCategory);
            query = query.in('main_category', dbCats);
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

        // Fuzzy Search (Title, Description, Content, Category)
        // Note: 'content' usually stores the JSON which includes authorName and tags
        if (search) {
            query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%,content.ilike.%${search}%,sub_category.ilike.%${search}%`);
        }

        // Apply Pagination
        query = query.range(start, end);

        let { data, error } = await query;

        // Fallback if join fails (e.g. profiles permissions issue)
        if (error) {
            console.warn("fetchPrompts join failed, fallback to simple select", error);
            let fallbackQuery = supabase.from('prompts').select('id, title, description, content, main_category, sub_category, usage_count, user_id, created_at').order('usage_count', { ascending: false });
            
            if (category && category !== 'all' && !ids && !userId) {
                const dbCat = mapPromptCategory(category);
                fallbackQuery = fallbackQuery.eq('main_category', dbCat);
            } else if (categories && categories.length > 0 && !ids && !userId) {
                const dbCats = categories.map(mapPromptCategory);
                fallbackQuery = fallbackQuery.in('main_category', dbCats);
            }

            if (userId) fallbackQuery = fallbackQuery.eq('user_id', userId);
            if (ids && ids.length > 0) fallbackQuery = fallbackQuery.in('id', ids);
            else if (ids && ids.length === 0) return [];
            
            if (search) {
                fallbackQuery = fallbackQuery.or(`title.ilike.%${search}%,description.ilike.%${search}%,content.ilike.%${search}%,sub_category.ilike.%${search}%`);
            }

            fallbackQuery = fallbackQuery.range(start, end);
            const res = await fallbackQuery;
            data = res.data as any; // Cast to any to handle missing profiles property type mismatch
            error = res.error;
        }

        if (error) return [];
        
        const result = data || [];
        // Set Cache
        promptQueryCache.set(cacheKey, { data: result, timestamp: Date.now() });
        
        return result;
    } catch (e) {
        return [];
    }
}

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
            dbUpdates.content = JSON.stringify({ fields: updates.fields || [], steps: updates.steps || [] });
        }
        if (Object.keys(dbUpdates).length === 0) return { success: true };
        const { error } = await supabase.from('workflows').update(dbUpdates).eq('id', id).eq('user_id', userId);
        if (error) throw error;
        return { success: true };
    } catch (err: any) { return { success: false, error: err }; }
}

export async function fetchWorkflows(options: { category?: string; userId?: string; ids?: string[]; page?: number; limit?: number; search?: string; } = {}) {
    const { category = 'all', userId, ids, page = 1, limit = 20, search } = options;
    try {
        const start = (page - 1) * limit;
        const end = start + limit - 1;
        let query = supabase.from('workflows').select('*').order('usage_count', { ascending: false });
        if (category && category !== 'all' && !ids && !userId) {
            query = query.eq('main_category', mapPromptCategory(category));
        }
        if (userId) {
            query = query.eq('user_id', userId);
        }
        if (ids && ids.length > 0) {
            query = query.in('id', ids);
        } else if (ids && ids.length === 0) {
            return [];
        }
        
        // Fuzzy Search (Title, Description, Content)
        // Content contains fields/steps definitions which usually contain keywords.
        // We do not deeply search joined profile names here due to PostgREST limitations with simple ORs,
        // but title/desc covers most cases.
        if (search) {
            query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%,content.ilike.%${search}%`);
        }

        query = query.range(start, end);
        const { data: workflows, error: wfError } = await withRetry(async () => await query);
        if (wfError) return [];
        if (!workflows || workflows.length === 0) return [];
        const userIds = Array.from(new Set(workflows.map((w: any) => w.user_id).filter(Boolean)));
        if (userIds.length === 0) return workflows;
        const { data: profiles } = await supabase.from('profiles').select('id, username, avatar_url').in('id', userIds);
        const profileMap: Record<string, any> = {};
        profiles?.forEach((p: any) => { profileMap[p.id] = p; });
        return workflows.map((w: any) => {
            const profile = profileMap[w.user_id];
            return { ...w, profiles: profile };
        });
    } catch (e) { return []; }
}

export async function deleteWorkflow(id: string) {
    const userId = await getCurrentUserId();
    if (!userId) return;
    await supabase.from('workflows').delete().eq('id', id).eq('user_id', userId);
}

export async function incrementWorkflowUsage(id: string) {
    try {
        if (!id) return;
        const { data, error: fetchError } = await supabase.from('workflows').select('usage_count').eq('id', id).single();
        if (fetchError) {
            console.warn("Error fetching workflow usage:", fetchError);
            return;
        }
        if (data) {
            const { error: updateError } = await supabase.from('workflows').update({ usage_count: (data.usage_count || 0) + 1 }).eq('id', id);
            if (updateError) console.warn("Error updating workflow usage:", updateError);
        }
    } catch (e) {
        console.error("Increment workflow usage failed:", e);
    }
}

export async function incrementPromptHeat(id: string) {
    try {
        if (!id) return;
        const { data, error: fetchError } = await supabase.from('prompts').select('usage_count').eq('id', id).single();
        if (fetchError) {
            console.warn("Error fetching prompt usage:", fetchError);
            return;
        }
        if (data) {
            const newCount = (data.usage_count || 0) + 1;
            const { error: updateError } = await supabase.from('prompts').update({ usage_count: newCount }).eq('id', id);
            if (updateError) console.warn("Error updating prompt usage:", updateError);
        }
    } catch (e) {
        console.error("Increment prompt heat failed:", e);
    }
}

export async function deletePrompt(id: string) {
    const userId = await getCurrentUserId();
    if (!userId) return;
    await supabase.from('prompts').delete().eq('id', id).eq('user_id', userId);
    invalidatePromptCache(); // Invalidate cache on delete
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
