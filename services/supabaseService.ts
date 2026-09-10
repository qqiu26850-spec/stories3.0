
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

export async function createProject(title: string, desc: string, type: 'novel' | 'script' | 'short' | 'short_story' | 'script_episode', coverUrl: string | null = null, scriptData: any = null) {
    try {
        const userId = await getCurrentUserId();
        if (!userId) throw new Error("请先登录");
        const dbType = type === 'short' ? 'short_story' : type;
        const insertObj: any = {
            user_id: userId, title, description: desc, type: dbType, cover_image: coverUrl, status: 'draft'
        };
        if (scriptData) {
            insertObj.script_data = scriptData;
        }
        const { data, error } = await withRetry(async () => await supabase.from('projects').insert([insertObj]).select());
        if (error) throw error;
        return { id: data?.[0]?.id, error: null };
    } catch (err: any) {
        return { id: null, error: err };
    }
}

export async function updateProject(projectId: string, updates: { title?: string, description?: string, cover_image?: string, script_data?: any }) {
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
    try {
        const userId = await getCurrentUserId();
        if (!userId) return;
        await supabase.from('chapters').delete().eq('project_id', id);
        await supabase.from('script_workflow_states').delete().eq('project_id', id);
        const { error } = await supabase.from('projects').delete().eq('id', id).eq('user_id', userId);
        if (error) throw error;
    } catch (err) {
        console.error("deleteProject error:", err);
        throw err;
    }
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

export async function saveScriptWorkflowState(
    projectId: string, 
    workflowId: string | undefined, 
    formState: any, 
    stepResults: any, 
    visibleIndex: number,
    promptId?: string,
    promptFormState?: any,
    promptResultText?: string,
    generationMode?: 'workflow' | 'prompt'
) {
    try {
        const userId = await getCurrentUserId();
        if (!userId) return;
        
        await supabase.from('script_workflow_states').upsert({
            project_id: projectId,
            workflow_id: workflowId,
            form_state: {
                ...formState,
                __prompt_form: promptFormState,
                __selected_prompt_id: promptId,
                __generation_mode: generationMode
            },
            step_results: {
                ...stepResults,
                __prompt_result: promptResultText
            },
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

export interface InspirationNovelFragment {
    content: string;
    event_types: string | string[];
    emotion_types: string | string[];
}

export async function matchDocumentsV3(embedding: number[], scene: string, emotion: string): Promise<InspirationNovelFragment[]> {
    try {
        const { data, error } = await supabase.rpc('match_documents_v3', {
            query_embedding: embedding,
            scene: scene,
            emotion: emotion,
            match_limit: 3,
            match_count: 3
        });

        if (error) {
            console.error("Supabase match_documents_v3 RPC error:", error);
            throw error;
        }

        if (!data || !Array.isArray(data)) {
            return [];
        }

        return data.slice(0, 3).map((item: any) => {
            const metadata = item.metadata || {};
            const content = item.content || '';
            const event_types = item.event_types || metadata.event_types || '未知';
            const emotion_types = item.emotion_types || metadata.emotion_types || '未知';

            return {
                content,
                event_types,
                emotion_types
            };
        });
    } catch (e) {
        console.error("matchDocumentsV3 failed:", e);
        throw e;
    }
}

const LOCAL_INSPIRATIONS: InspirationNovelFragment[] = [
    {
        content: "顾家大宴上，真千金顾晚身穿一件洗得发白的旧衣服站在角落。而假千金顾雪儿却穿着高定礼服，挽着顾夫人的手，笑得甜美。\n顾夫人当众宣布：“雪儿才是我唯一的女儿，至于顾晚，不过是个收养的孤儿，不识大体，难登大雅之堂！”\n顾晚眼眶泛红，双手死死攥紧，手心被指甲掐出了血。她默默忍受着众人的指点，心如刀割：“原来十八年的期盼，在你们眼里只是个笑话。”",
        event_types: ["真假千金", "豪门争斗"],
        emotion_types: ["极致虐心", "悲痛欲绝"]
    },
    {
        content: "林氏集团董事会。李总将一叠文件狠狠摔在林默面前，冷嘲热讽：“一个刚毕业的实习生，也敢插手百亿级别的项目？识相的立刻签了这份辞职信，滚出林家！”\n林默不紧不慢地掏出手机，放了一段录音，里面清晰地传出李总收受竞品公司巨额贿赂、企图掏空林氏的阴谋。\n接着，林默站起身，眼神如刀：“李总，恐怕该走的人是你。还有，顺便提醒你一句，我不仅是实习生，更是林氏集团持股51%的最大股东！”李总瞬间脸色惨白，瘫倒在椅子上。",
        event_types: ["主角反击", "打脸爽片", "身份反转"],
        emotion_types: ["逆袭爽快", "扬眉吐气"]
    },
    {
        content: "漫天大雨中，江寒不顾一切地冲上前，死死抱住即将登机的陆暖暖。\n陆暖暖挣扎着眼泪夺眶而出：“你放开我！你不是已经和白月光订婚了吗？还来找我做什么！”\n江寒搂得更紧，声音嘶哑而颤抖：“那张照片是合成的！我跟她没有任何关系，我自始至终爱的人只有你！暖暖，别走，求你……”\n陆暖暖听着他剧烈的心跳声，泪水终于和雨水混在一起。误会在此刻冰消瓦解，江寒深情地吻上了她的唇。",
        event_types: ["误会解除", "旧情复燃", "英雄救美"],
        emotion_types: ["深情告白", "甜宠撒糖"]
    },
    {
        content: "苏晴端着咖啡，还没走到桌前，林薇薇便突然自己往后一倒，热咖啡洒了一身。\n林薇薇立刻哭得梨花带雨，楚楚可怜地望向走过来的顾景深：“景深，都是我不好，我不该和苏晴姐姐争那个代言的，苏晴姐姐肯定不是故意拿咖啡泼我的……”\n苏晴冷笑一声，直接掏出ipad按下播放键。画面中，正清晰地展示着林薇薇自己拽着苏晴的衣袖，主动将咖啡往自己身上倒的监控画面。\n苏晴挑眉看着目瞪口呆的林薇薇：“林妹妹，演技不错，可惜咖啡厅的360度无死角监控比你的眼泪更诚实。”",
        event_types: ["手撕绿茶", "豪门争斗", "主角反击"],
        emotion_types: ["逆袭爽快", "扬眉吐气"]
    },
    {
        content: "幽暗废弃的仓库里，绑匪将沈蔓绑在椅子上，手里拿着明晃晃的匕首。\n“顾少，你太太在我们手里。想要她活命，拿十亿现金来换！”\n电话那头传来顾霆骁冰冷且毫无波动的声音：“随意。”绑匪气急败坏。沈蔓闭上眼，心沉入了谷底。\n突然，仓库大门被猛烈撞开，数十名特种保镖瞬间包围了现场。顾霆骁黑衣皮鞋，踏光而来。\n他夺下绑匪手中的刀，一脚将其踢飞，动作干净利落。随后他温柔地解开沈蔓的绳子，将她紧紧搂进怀里，声音沙哑：“对不起，我来晚了。说‘随意’是为了拖延定位时间，别怕，我一直在。”",
        event_types: ["英雄救美", "暗中布局"],
        emotion_types: ["惊悚悬疑", "霸道高冷"]
    },
    {
        content: "结婚三周年纪念日，温凉等了一整夜，却等来沈赫在医院陪着前女友度过生日的热搜。\n温凉自嘲一笑，摘下了无名指上的婚戒，放在空无一人的餐桌上。\n她拿上早已签好的离婚协议书，只提着一个小行李箱，决然地走出了沈家别墅。\n“沈赫，这三年是我犯贱，以后你的世界，我彻底退出。”\n当沈赫第二天清晨兴冲冲地赶回家，看到空荡荡的屋子和冰冷的离婚协议书时，一种前所未有的心慌与悔恨瞬间将他淹没。",
        event_types: ["离家出走", "极致虐心"],
        emotion_types: ["悲痛欲绝", "因爱生恨"]
    },
    {
        content: "萧晨本想租个豪车去前女友的婚礼上装个逼，结果不小心撞了路边的一辆宾利。\n宾利车主是个高冷的女总裁，萧晨吓得直哆嗦：“姐，我不是故意的，我真赔不起……”\n女总裁打量了他一眼，淡淡道：“今天我缺个男伴去砸场子，只要你假扮我未婚夫，这车就不用你赔了。”\n婚礼现场，前女友和新郎正得意洋洋，萧晨挽着女总裁盛装出席。\n女总裁当众宣布：“感谢两位邀请。顺便介绍一下，这位是我的未婚夫，也是萧氏集团的唯一继承人。”\n前女友和新郎惊得下巴都掉了，萧晨心里直犯嘀咕：“卧槽，我自己怎么不知道我是继承人？！”",
        event_types: ["身份反转", "主角反击"],
        emotion_types: ["搞笑幽默", "逆袭爽快"]
    }
];

export async function searchInspirationFragments(keyword: string, tags: string[]): Promise<InspirationNovelFragment[]> {
    try {
        let query = supabase.from('novel_chunks').select('*');

        // If keyword is specified, narrow down by content search
        if (keyword && keyword.trim()) {
            query = query.ilike('content', `%${keyword.trim()}%`);
        }

        const { data, error } = await query.limit(500);

        if (error) {
            console.error("Supabase query error on novel_chunks:", error);
            return [];
        }

        if (!data || !Array.isArray(data)) {
            return [];
        }

        let results = data;

        // If specific tags are clicked/selected, we filter them.
        // We check if ANY of the tag arrays within metadata.tags contains the selected tag.
        if (tags && tags.length > 0) {
            results = results.filter((item: any) => {
                const metadata = item.metadata || {};
                const tagsObj = metadata.tags || {};
                if (tagsObj && typeof tagsObj === 'object') {
                    return tags.some(tag => {
                        const inScenes = Array.isArray(tagsObj.scene_types) && tagsObj.scene_types.includes(tag);
                        const inEmotions = Array.isArray(tagsObj.emotion_types) && tagsObj.emotion_types.includes(tag);
                        const inEvents = Array.isArray(tagsObj.event_types) && tagsObj.event_types.includes(tag);
                        const inAbilities = Array.isArray(tagsObj.special_abilities) && tagsObj.special_abilities.includes(tag);
                        const inConflicts = Array.isArray(tagsObj.conflict_types) && tagsObj.conflict_types.includes(tag);
                        const inThemes = Array.isArray(tagsObj.core_themes) && tagsObj.core_themes.includes(tag);
                        const inElements = Array.isArray(tagsObj.element_types) && tagsObj.element_types.includes(tag);
                        return inScenes || inEmotions || inEvents || inAbilities || inConflicts || inThemes || inElements;
                    });
                }
                return false;
            });
        }

        // If no results are found after filtering or if the query returned nothing,
        // we can also search without keyword restriction just by tags to give the user something.
        if (results.length === 0 && tags && tags.length > 0) {
            const secondTry = await supabase.from('novel_chunks').select('*').limit(500);
            if (secondTry.data && Array.isArray(secondTry.data)) {
                results = secondTry.data.filter((item: any) => {
                    const metadata = item.metadata || {};
                    const tagsObj = metadata.tags || {};
                    if (tagsObj && typeof tagsObj === 'object') {
                        return tags.some(tag => {
                            const inScenes = Array.isArray(tagsObj.scene_types) && tagsObj.scene_types.includes(tag);
                            const inEmotions = Array.isArray(tagsObj.emotion_types) && tagsObj.emotion_types.includes(tag);
                            const inEvents = Array.isArray(tagsObj.event_types) && tagsObj.event_types.includes(tag);
                            const inAbilities = Array.isArray(tagsObj.special_abilities) && tagsObj.special_abilities.includes(tag);
                            const inConflicts = Array.isArray(tagsObj.conflict_types) && tagsObj.conflict_types.includes(tag);
                            const inThemes = Array.isArray(tagsObj.core_themes) && tagsObj.core_themes.includes(tag);
                            const inElements = Array.isArray(tagsObj.element_types) && tagsObj.element_types.includes(tag);
                            return inScenes || inEmotions || inEvents || inAbilities || inConflicts || inThemes || inElements;
                        });
                    }
                    return false;
                });
            }
        }

        return results.map((item: any) => {
            const metadata = item.metadata || {};
            const content = item.content || '';
            const tagsObj = metadata.tags || {};
            
            // To support existing frontend expectations, we combine tag values into event_types and emotion_types
            const event_types: string[] = [];
            const emotion_types: string[] = [];

            if (tagsObj && typeof tagsObj === 'object') {
                if (Array.isArray(tagsObj.scene_types)) event_types.push(...tagsObj.scene_types);
                if (Array.isArray(tagsObj.emotion_types)) emotion_types.push(...tagsObj.emotion_types);
                if (Array.isArray(tagsObj.event_types)) event_types.push(...tagsObj.event_types);
                if (Array.isArray(tagsObj.special_abilities)) event_types.push(...tagsObj.special_abilities);
                if (Array.isArray(tagsObj.conflict_types)) event_types.push(...tagsObj.conflict_types);
                if (Array.isArray(tagsObj.core_themes)) event_types.push(...tagsObj.core_themes);
                if (Array.isArray(tagsObj.element_types)) event_types.push(...tagsObj.element_types);
            }

            if (event_types.length === 0) event_types.push('通用');
            if (emotion_types.length === 0) emotion_types.push('通用');

            return {
                content,
                event_types: Array.from(new Set(event_types)),
                emotion_types: Array.from(new Set(emotion_types))
            };
        }).slice(0, 15);
    } catch (e) {
        console.error("searchInspirationFragments failed:", e);
        return [];
    }
}

export async function fetchAvailableTags(): Promise<{
    scene_types: string[];
    emotion_types: string[];
    event_types: string[];
    special_abilities: string[];
    conflict_types: string[];
    core_themes: string[];
    element_types: string[];
}> {
    try {
        const { data, error } = await supabase.from('novel_chunks').select('metadata').limit(1000);
        
        const sceneSet = new Set<string>();
        const emotionSet = new Set<string>();
        const eventSet = new Set<string>();
        const abilitySet = new Set<string>();
        const conflictSet = new Set<string>();
        const themeSet = new Set<string>();
        const elementSet = new Set<string>();

        if (!error && data && data.length > 0) {
            data.forEach((item: any) => {
                const metadata = item.metadata || {};
                const tagsObj = metadata.tags || {};
                if (tagsObj && typeof tagsObj === 'object') {
                    if (Array.isArray(tagsObj.scene_types)) tagsObj.scene_types.forEach((t: string) => sceneSet.add(t));
                    if (Array.isArray(tagsObj.emotion_types)) tagsObj.emotion_types.forEach((t: string) => emotionSet.add(t));
                    if (Array.isArray(tagsObj.event_types)) tagsObj.event_types.forEach((t: string) => eventSet.add(t));
                    if (Array.isArray(tagsObj.special_abilities)) tagsObj.special_abilities.forEach((t: string) => abilitySet.add(t));
                    if (Array.isArray(tagsObj.conflict_types)) tagsObj.conflict_types.forEach((t: string) => conflictSet.add(t));
                    if (Array.isArray(tagsObj.core_themes)) tagsObj.core_themes.forEach((t: string) => themeSet.add(t));
                    if (Array.isArray(tagsObj.element_types)) tagsObj.element_types.forEach((t: string) => elementSet.add(t));
                }
            });
        }
        
        // High-quality defaults from user provided JSON
        const defaultScenes = ['争吵', '背叛', '日常生活', '初遇', '密谋', '告白', '重逢', '营救', '照顾', '和解', '追逐', '订婚现场被抛弃', '边界试探', '大打出手', '当众对峙'];
        const defaultEmotions = ['被豢养的窒息感', '察觉真相后的寒心绝望', '隐忍中的决绝反抗', '爱而不得的酸涩', '宿命般的无力感', '酸涩隐忍', '极致拉扯', '温情治愈', '大快人心的复仇爽感', '劫后余生的松弛感', '迟来的悔恨', '甜蜜心动', '撩拨暧昧', '绝望无助'];
        const defaultEvents = ['大少奶奶罚宋莹回厨房烧火', '宋莹偷听老夫人与道士密谋', '洛宁被山贼掳走并被救下', '温旭在订婚现场为小青梅扔下女主', '姐姐安安被误解打碎花瓶', '课堂投屏社死现场', '真假千金看到弹幕得知真相', '主角死后托梦向男友索要男仆', '庆功宴上副将出示信件当众诬陷'];
        const defaultAbilities = ['福星命格（旺侯府运势）', '永生（不老不死）', '弹幕金手指（预知剧情）', '穿越系统（可回现代）', '元宇宙系统（赎罪任务）', '手铐召唤（执法者）', '读心术', '吸血鬼特性', '死后托梦'];
        const defaultConflicts = ['侯府对福星的利用与自我意识觉醒', '长生者与凡人爱人之间的生死相隔', '家庭信任危机', '原生家庭带来的身份认同危机', '师生身份差异带来的隐瞒焦虑', '出轨误会引发的信任危机', '真假千金从敌对到姐妹情深的转变'];
        const defaultThemes = ['摆脱被豢养的命运,追求真实自我', '永生是诅咒，爱是唯一的救赎与羁绊', '爱能改写悲剧，家庭温暖改变命运', '在伤痛中重建自我', '爱是尊重与信任，而非占有与背叛', '真正的家人是给予温暖与守护而不是血缘', '用理性与法律武器打破狗血剧情'];
        const defaultElements = ['锦鲤文', '养女逆袭', '轮回转世', '养崽文', '追妻火葬场', '白月光与朱砂痣', '甜宠', '先婚后爱', '穿越系统', '真假千金', '双向暗恋', '娱乐圈', '爽文'];

        defaultScenes.forEach(t => sceneSet.add(t));
        defaultEmotions.forEach(t => emotionSet.add(t));
        defaultEvents.forEach(t => eventSet.add(t));
        defaultAbilities.forEach(t => abilitySet.add(t));
        defaultConflicts.forEach(t => conflictSet.add(t));
        defaultThemes.forEach(t => themeSet.add(t));
        defaultElements.forEach(t => elementSet.add(t));
        
        return {
            scene_types: Array.from(sceneSet).slice(0, 30),
            emotion_types: Array.from(emotionSet).slice(0, 30),
            event_types: Array.from(eventSet).slice(0, 30),
            special_abilities: Array.from(abilitySet).slice(0, 30),
            conflict_types: Array.from(conflictSet).slice(0, 30),
            core_themes: Array.from(themeSet).slice(0, 30),
            element_types: Array.from(elementSet).slice(0, 30)
        };
    } catch (e) {
        return {
            scene_types: ['争吵', '背叛', '日常生活', '初遇', '密谋', '告白', '重逢', '营救', '照顾', '和解', '追逐', '订婚现场被抛弃', '边界试探', '大打出手', '当众对峙'],
            emotion_types: ['被豢养的窒息感', '察觉真相后的寒心绝望', '隐忍中的决绝反抗', '爱而不得的酸涩', '宿命般的无力感', '酸涩隐忍', '极致拉扯', '温情治愈', '大快人心的复仇爽感', '劫后余生的松弛感', '迟来的悔恨', '甜蜜心动', '撩拨暧昧', '绝望无助'],
            event_types: ['大少奶奶罚宋莹回厨房烧火', '宋莹偷听老夫人与道士密谋', '洛宁被山贼掳走并被救下', '温旭在订婚现场为小青梅扔下女主', '姐姐安安被误解打碎花瓶', '课堂投屏社死现场', '真假千金看到弹幕得知真相', '主角死后托梦向男友索要男仆', '庆功宴上副将出示信件当众诬陷'],
            special_abilities: ['福星命格（旺侯府运势）', '永生（不老不死）', '弹幕金手指（预知剧情）', '穿越系统（可回现代）', '元宇宙系统（赎罪任务）', '手铐召唤（执法者）', '读心术', '吸血鬼特性', '死后托梦'],
            conflict_types: ['侯府对福星的利用与自我意识觉醒', '长生者与凡人爱人之间的生死相隔', '家庭信任危机', '原生家庭带来的身份认同危机', '师生身份差异带来的隐瞒焦虑', '出轨误会引发的信任危机', '真假千金从敌对到姐妹情深的转变'],
            core_themes: ['摆脱被豢养的命运,追求真实自我', '永生是诅咒，爱是唯一的救赎与羁绊', '爱能改写悲剧，家庭温暖改变命运', '在伤痛中重建自我', '爱是尊重与信任，而非占有与背叛', '真正的家人是给予温暖与守护而不是血缘', '用理性与法律武器打破狗血剧情'],
            element_types: ['锦鲤文', '养女逆袭', '轮回转世', '养崽文', '追妻火葬场', '白月光与朱砂痣', '甜宠', '先婚后爱', '穿越系统', '真假千金', '双向暗恋', '娱乐圈', '爽文']
        };
    }
}
