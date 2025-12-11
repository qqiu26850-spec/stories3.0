
import { createClient } from '@supabase/supabase-js';
import { NovelSettings } from '../types';

// ================= Configuration =================
const SUPABASE_URL = 'https://vydvxxarfjyjjjhyhfek.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ5ZHZ4eGFyZmp5ampqaHloZmVrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM5NzY4OTksImV4cCI6MjA3OTU1Mjg5OX0.Y9Q4JwTZnBBwDDAhz_TUcxZ-Jv-eN8BXqPauIQaI-Ds';

// Initialize Supabase Client with more robust settings
export const supabase = createClient(SUPABASE_URL.trim(), SUPABASE_ANON_KEY.trim(), {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
    },
    global: {
        headers: { 'x-application-name': 'story-weaver' }
    }
});

// ================= Helper: Retry Logic =================
/**
 * Wraps Supabase operations with retry logic for network failures (Failed to fetch)
 */
async function withRetry<T>(
    operation: () => PromiseLike<{ data: T | null; error: any }>, 
    retries = 3, 
    delay = 1000
): Promise<{ data: T | null; error: any }> {
    let lastError: any;
    
    for (let i = 0; i < retries; i++) {
        try {
            const { data, error } = await operation();
            
            if (error) {
                // Check for potential network-related 5xx errors or specific codes that warrant retry
                return { data, error };
            }
            
            return { data, error: null };
        } catch (err: any) {
            lastError = err;
            const message = err.message || '';
            // Retry on network errors
            if (message.includes('fetch') || message.includes('network') || message.includes('Failed to fetch')) {
                console.warn(`Attempt ${i + 1} failed: ${message}. Retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay * (i + 1))); // Exponential backoff-ish
                continue;
            }
            // If it's a code error (e.g. syntax), throw immediately
            throw err;
        }
    }
    
    // If we exhausted retries for a thrown error (like fetch failure)
    return { data: null, error: lastError || new Error('Request failed after multiple retries') };
}

// =================== Auth Functions ===================

export async function signUp(email, password) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
    },
  });
  return { data, error };
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  return { data, error };
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  return error;
}

export async function resetPasswordForEmail(email: string) {
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: typeof window !== 'undefined' ? `${window.location.origin}` : undefined,
  });
  return { data, error };
}

export async function getCurrentUserId() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id || null;
}

export async function fetchUserProfile() {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        // Check for profile table if exists, otherwise fallback to metadata
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', session?.user?.id).single();
        
        return {
            nickname: profile?.username || session?.user?.user_metadata?.full_name || '奇思妙想家',
            avatarUrl: profile?.avatar_url || session?.user?.user_metadata?.avatar_url || null
        };
    } catch (e) {
        return { nickname: '奇思妙想家', avatarUrl: null };
    }
}

export async function updateUserProfile(nickname: string, avatarUrl: string | null) {
    try {
        const { data, error } = await supabase.auth.updateUser({
            data: { full_name: nickname, avatar_url: avatarUrl }
        });
        
        const userId = await getCurrentUserId();
        if(userId) {
            await supabase.from('profiles').upsert({ 
                id: userId, 
                username: nickname, 
                avatar_url: avatarUrl 
            });
        }

        if (error) throw error;
        return { data, error: null };
    } catch (e: any) {
        console.error("Update Profile Error", e);
        return { data: null, error: e };
    }
}

export async function deleteUserData(): Promise<boolean> {
    try {
        const userId = await getCurrentUserId();
        if (!userId) throw new Error("User not logged in");

        await supabase.from('projects').delete().eq('user_id', userId);
        await supabase.from('materials').delete().eq('user_id', userId);
        await signOut();
        return true;
    } catch (err: any) {
        console.error('Failed to delete user data:', err.message);
        return false;
    }
}

// ================= Storage Functions =================

export async function uploadCoverImage(file: File): Promise<string | null> {
    try {
        const userId = await getCurrentUserId();
        if (!userId) throw new Error("User not logged in");

        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `${userId}/${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from('covers')
            .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data } = supabase.storage.from('covers').getPublicUrl(filePath);
        return data.publicUrl;
    } catch (error: any) {
        console.error('Failed to upload cover:', error.message);
        return null;
    }
}

// ================= Project Functions (Novels/Scripts) =================

function mapProjectTypeToDB(type: 'novel' | 'script' | 'short' | 'short_story'): 'novel' | 'script' | 'short_story' {
    if (type === 'short') return 'short_story';
    return type as 'novel' | 'script' | 'short_story';
}

export async function createProject(title: string, desc: string, type: 'novel' | 'script' | 'short' | 'short_story', coverUrl: string | null = null): Promise<string | null> {
    try {
        const userId = await getCurrentUserId();
        if (!userId) throw new Error("用户未登录，请先登录。");

        const dbType = mapProjectTypeToDB(type);

        const { data, error } = await withRetry(async () => await supabase
            .from('projects')
            .insert([
                {
                    user_id: userId,
                    title: title,
                    description: desc,
                    type: dbType,
                    status: 'draft',
                    cover_image: coverUrl
                }
            ])
            .select());

        if (error) throw error;
        return data ? (data as any[])[0].id : null;
    } catch (err: any) {
        console.error('Failed to create project:', err);
        alert('创建云端项目失败: ' + (err.message === 'Failed to fetch' ? '网络连接错误，请检查网络' : err.message));
        return null;
    }
}

export async function updateProject(projectId: string, updates: { title?: string, description?: string, cover_image?: string }) {
    try {
        const userId = await getCurrentUserId();
        if (!userId) throw new Error("User not logged in");

        const { error } = await withRetry(async () => await supabase
            .from('projects')
            .update(updates)
            .eq('id', projectId)
            .eq('user_id', userId));

        if (error) throw error;
    } catch (err: any) {
        console.error('Failed to update project:', err.message);
    }
}

export async function fetchProjects() {
    try {
        const userId = await getCurrentUserId();
        if (!userId) return [];

        const { data: projects, error } = await withRetry(async () => await supabase
            .from('projects')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false }));
        
        if (error || !projects) return [];

        // Fetch word counts via chapters
        const projectList = projects as any[];
        const projectIds = projectList.map(p => p.id);
        let wordCounts: Record<string, number> = {};
        
        if (projectIds.length > 0) {
             const { data: chapters } = await withRetry(async () => await supabase
                .from('chapters')
                .select('project_id, content')
                .in('project_id', projectIds));
            
            if (chapters) {
                (chapters as any[]).forEach(c => {
                    const count = c.content ? c.content.length : 0;
                    wordCounts[c.project_id] = (wordCounts[c.project_id] || 0) + count;
                });
            }
        }

        return projectList.map(p => ({
            ...p,
            word_count: wordCounts[p.id] || 0,
            description: p.description
        }));
    } catch (e) {
        console.error("Fetch Projects Error", e);
        return [];
    }
}

export async function deleteProject(id: string): Promise<void> {
    try {
        const userId = await getCurrentUserId();
        if (!userId) throw new Error("User not logged in");
        await withRetry(async () => await supabase.from('projects').delete().eq('id', id).eq('user_id', userId));
    } catch (e) {
        console.error("Delete Project Error", e);
    }
}

// ================= Chapter Functions =================

export async function fetchChapters(projectId: string) {
    try {
        const { data, error } = await withRetry(async () => await supabase
            .from('chapters')
            .select('*')
            .eq('project_id', projectId)
            .order('order_index', { ascending: true }));
        
        if (error) throw error;
        return data as any[];
    } catch (err: any) {
        console.error('Failed to fetch chapters:', err.message);
        return [];
    }
}

export async function saveChapterToDB(
    projectId: string, 
    chapterId: string, 
    title: string, 
    content: string, 
    orderIndex: number
): Promise<string | null> {
    try {
        const userId = await getCurrentUserId();
        if (!userId) throw new Error("User not logged in");

        const isLocalId = chapterId.startsWith('ch-') || chapterId.startsWith('scene-') || chapterId.startsWith('new-');

        if (isLocalId) {
            const { data, error } = await withRetry(async () => await supabase
                .from('chapters')
                .insert([{
                    project_id: projectId,
                    title: title,
                    content: content,
                    order_index: orderIndex
                }])
                .select());

            if (error) throw error;
            return data ? (data as any[])[0].id : null;
        } else {
            const { data, error } = await withRetry(async () => await supabase
                .from('chapters')
                .update({
                    title: title,
                    content: content,
                    order_index: orderIndex
                })
                .eq('id', chapterId)
                .select());

            if (error) throw error;
            return data ? (data as any[])[0].id : null;
        }
    } catch (err: any) {
        console.error('Failed to save chapter:', err.message);
        return null;
    }
}

export async function deleteChapterFromDB(chapterId: string): Promise<void> {
    try {
        if (chapterId.startsWith('ch-') || chapterId.startsWith('scene-') || chapterId.startsWith('new-')) return;
        const { error } = await withRetry(async () => await supabase.from('chapters').delete().eq('id', chapterId));
        if (error) throw error;
    } catch (err: any) {
        console.error('Failed to delete chapter:', err.message);
    }
}

// ================= Material Functions =================

export async function saveMaterial(name: string, content: string, type: 'character' | 'plot' | 'idea' | 'inspiration', tags: string[] = []): Promise<void> {
    try {
        const userId = await getCurrentUserId();
        if (!userId) throw new Error("User not logged in");

        const dbType = type === 'inspiration' ? 'idea' : type;

        const { error } = await withRetry(async () => await supabase
            .from('materials')
            .insert([{ user_id: userId, name, content, type: dbType, tags: tags }]));
            
        if (error) throw error;
    } catch (err: any) {
        console.error('Failed to save material:', err.message);
        alert('保存素材失败: ' + (err.message === 'Failed to fetch' ? '网络连接错误' : err.message));
    }
}

export async function fetchMaterials(type?: 'character' | 'plot' | 'idea' | 'inspiration') {
    try {
        const userId = await getCurrentUserId();
        if (!userId) return [];

        const dbType = type === 'inspiration' ? 'idea' : type;

        let query = supabase.from('materials').select('*').eq('user_id', userId).order('created_at', { ascending: false });
        if (dbType) query = query.eq('type', dbType);
        
        const { data, error } = await withRetry(async () => await query);
        return error ? [] : (data as any[]);
    } catch (e) {
        return [];
    }
}

export async function deleteMaterial(id: string): Promise<void> {
    try {
        const userId = await getCurrentUserId();
        if (!userId) throw new Error("User not logged in");
        await withRetry(async () => await supabase.from('materials').delete().eq('id', id).eq('user_id', userId));
    } catch (e) {
        console.error("Delete Material Error", e);
    }
}

// ================= Prompt Functions =================

function mapPromptCategoryToDB(cat: string): 'short' | 'long' | 'script' | 'general' {
    if (cat === 'short-story') return 'short';
    if (cat === 'long-story') return 'long';
    if (cat === 'script') return 'script';
    return 'general';
}

export async function savePrompt(title: string, content: string, mainCat: string, subCat: string): Promise<void> {
    try {
        const userId = await getCurrentUserId();
        if (!userId) throw new Error("User not logged in");

        const dbMainCat = mapPromptCategoryToDB(mainCat);
        
        // Safe Parse Description
        let description = 'No description';
        try {
            const parsed = JSON.parse(content);
            if(parsed.description) description = parsed.description;
        } catch(e) {
            // Content might not be JSON, ignore
        }

        const { error } = await withRetry(async () => await supabase
            .from('prompts')
            .insert([{ 
                user_id: userId, 
                title, 
                content, 
                description,
                main_category: dbMainCat, 
                sub_category: subCat,
                heat: 0
            }]));
            
        if (error) throw error;
        alert('提示词已保存到云端库！');
    } catch (err: any) {
        console.error('Failed to save prompt:', err.message);
        const msg = err.message === 'Failed to fetch' 
            ? '无法连接到服务器，请检查您的网络连接或关闭广告拦截插件。' 
            : err.message;
        alert('保存提示词失败: ' + msg);
    }
}

export async function updatePrompt(id: string, updates: { title?: string, content?: string, main_category?: string, sub_category?: string }): Promise<void> {
    try {
        const userId = await getCurrentUserId();
        if (!userId) throw new Error("User not logged in");

        const dbUpdates: any = { ...updates };
        if (updates.main_category) {
            dbUpdates.main_category = mapPromptCategoryToDB(updates.main_category);
        }
        if (updates.content) {
             try {
                const parsed = JSON.parse(updates.content);
                if (parsed.description) dbUpdates.description = parsed.description;
             } catch(e) {}
        }

        const { error } = await withRetry(async () => await supabase
            .from('prompts')
            .update(dbUpdates)
            .eq('id', id)
            .eq('user_id', userId));

        if (error) throw error;
        alert('提示词已更新！');
    } catch (err: any) {
        console.error('Failed to update prompt:', err.message);
        alert('更新提示词失败: ' + (err.message === 'Failed to fetch' ? '网络连接错误' : err.message));
    }
}

export async function fetchPrompts(mainCategory?: string) {
    try {
        let query = supabase.from('prompts').select('*').order('created_at', { ascending: false });
        
        if (mainCategory && mainCategory !== 'all') {
             const dbCat = mapPromptCategoryToDB(mainCategory);
             query = query.eq('main_category', dbCat);
        }
        
        const { data, error } = await withRetry(async () => await query);
        return error ? [] : (data as any[]);
    } catch (e) {
        return [];
    }
}

export async function deletePrompt(id: string): Promise<void> {
    try {
        const userId = await getCurrentUserId();
        if (!userId) throw new Error("User not logged in");
        await withRetry(async () => await supabase.from('prompts').delete().eq('id', id).eq('user_id', userId));
    } catch (e) {
        console.error("Delete Prompt Error", e);
    }
}

export async function incrementPromptHeat(id: string): Promise<void> {
    try {
        if (!id || id.startsWith('prompt-user-')) return; 
        
        const { data } = await withRetry(async () => await supabase.from('prompts').select('usage_count').eq('id', id).single());
        if (data) {
            const newCount = ((data as any).usage_count || 0) + 1;
            await supabase.from('prompts').update({ usage_count: newCount }).eq('id', id);
        }
    } catch (e) {
        console.error("Failed to increment heat", e);
    }
}

export async function fetchUserLibrary() {
    try {
        const userId = await getCurrentUserId();
        if (!userId) return { prompts: [], materials: [] };

        const { data: prompts } = await withRetry(async () => await supabase
            .from('prompts')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false }));

        const { data: materials } = await withRetry(async () => await supabase
            .from('materials')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false }));

        return {
            prompts: (prompts as any[]) || [],
            materials: (materials as any[]) || []
        };
    } catch (e) {
        console.error("Fetch User Library Error", e);
        return { prompts: [], materials: [] };
    }
}
