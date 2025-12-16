
// ... existing imports
import { createClient } from '@supabase/supabase-js';

// ================= 配置区域 =================
// 优先使用 Vercel/Vite 环境变量，如果没有则使用硬编码的 Key (方便本地调试)
// 在 Vercel 部署时，请在 Settings -> Environment Variables 中设置 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY

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

// 初始化客户端
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
    }
});

// ================= 辅助函数 =================

/**
 * 获取当前登录用户ID
 */
export async function getCurrentUserId() {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.user?.id || null;
}

/**
 * 检查用户状态 (用于 App 启动时校验是否被软删除)
 */
export async function checkUserStatus(): Promise<boolean> {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        if (session.user.user_metadata?.is_deleted) {
            await signOut();
            return false; // User is soft deleted
        }
        return true; // User is valid
    }
    return false; // No session
}

/**
 * 通用的重试逻辑 (处理网络波动)
 */
async function withRetry<T>(operation: () => Promise<T>, retries = 3): Promise<T> {
    try {
        return await operation();
    } catch (err: any) {
        if (retries > 0 && (err.message?.includes('fetch') || err.status === 500 || err.status === 503)) {
            console.warn(`请求失败，正在重试... 剩余次数: ${retries}`);
            await new Promise(r => setTimeout(r, 1000));
            return withRetry(operation, retries - 1);
        }
        throw err;
    }
}

// ================= 身份认证 (Auth) =================

export async function signUp(email: string, password: string) {
    return await supabase.auth.signUp({ 
        email, 
        password,
        options: {
            // Vercel 部署后，这里会自动适配当前域名
            emailRedirectTo: typeof window !== 'undefined' ? window.location.origin : undefined
        }
    });
}

export async function signIn(email: string, password: string) {
    return await supabase.auth.signInWithPassword({ email, password });
}

export async function signOut() {
    // 强制清除本地存储，防止缓存残留
    if (typeof window !== 'undefined') {
        localStorage.clear();
        sessionStorage.clear();
    }
    return await supabase.auth.signOut();
}

export async function resetPasswordForEmail(email: string) {
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
  });
  return { data, error };
}

// ================= 用户资料 (Profiles) =================

export async function fetchUserProfile() {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return { nickname: '未登录用户', avatarUrl: null, email: '' };

        const metaName = session.user.user_metadata?.full_name;
        const metaAvatar = session.user.user_metadata?.avatar_url;

        const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
        
        return {
            nickname: profile?.username || metaName || '奇思妙想家',
            avatarUrl: profile?.avatar_url || metaAvatar || null,
            email: session.user.email
        };
    } catch (e) {
        console.error("Fetch Profile Error:", e);
        return { nickname: '奇思妙想家', avatarUrl: null, email: '' };
    }
}

export async function updateUserProfile(nickname: string, avatarUrl: string | null) {
    const userId = await getCurrentUserId();
    if (!userId) return { error: '未登录' };
    
    try {
        // 1. 更新 Auth 元数据 (Supabase Auth)
        await supabase.auth.updateUser({
            data: { full_name: nickname, avatar_url: avatarUrl }
        });
        
        // 2. 更新 profiles 表 (业务数据)
        const { error } = await supabase.from('profiles').upsert({ 
            id: userId, 
            username: nickname, 
            avatar_url: avatarUrl,
            updated_at: new Date().toISOString()
        });

        return { error };
    } catch (e: any) {
        return { error: e };
    }
}

export async function deleteUserData(): Promise<boolean> {
    try {
        const userId = await getCurrentUserId();
        if (!userId) throw new Error("User not logged in");

        // 1. Soft Delete: Mark account as deleted in Auth metadata
        const { error: updateError } = await supabase.auth.updateUser({
            data: { is_deleted: true }
        });

        if (updateError) {
            console.error("Failed to mark user as deleted:", updateError);
            throw updateError;
        }

        // 2. Delete data (Projects & Materials only)
        // Retain Prompts as per requirement
        await supabase.from('projects').delete().eq('user_id', userId);
        await supabase.from('materials').delete().eq('user_id', userId);
        // await supabase.from('prompts').delete().eq('user_id', userId); // 保留提示词
        
        // 3. Aggressive Logout
        await signOut();
        return true;
    } catch (err: any) {
        console.error('删除用户数据失败:', err.message);
        // Force logout anyway to prevent access
        await signOut();
        return false;
    }
}

// ================= 📚 用户资源库 (聚合查询) =================

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

// ================= 📖 小说项目 (Projects) =================

export async function createProject(title: string, desc: string, type: 'novel' | 'script' | 'short' | 'short_story', coverUrl: string | null = null) {
    try {
        const userId = await getCurrentUserId();
        if (!userId) throw new Error("请先登录");

        const dbType = type === 'short' ? 'short_story' : type;

        const { data, error } = await withRetry(async () => await supabase
            .from('projects')
            .insert([{
                user_id: userId,
                title,
                description: desc,
                type: dbType,
                cover_image: coverUrl,
                status: 'draft',
                word_count: 0
            }])
            .select()
        );

        if (error) throw error;
        return { id: data?.[0]?.id, error: null };
    } catch (err: any) {
        console.error("创建项目失败:", err.message);
        return { id: null, error: err };
    }
}

export async function updateProject(projectId: string, updates: { title?: string, description?: string, cover_image?: string }) {
    try {
        const userId = await getCurrentUserId();
        if (!userId) throw new Error("未登录");

        const { error } = await supabase
            .from('projects')
            .update(updates)
            .eq('id', projectId)
            .eq('user_id', userId);

        if (error) throw error;
    } catch (err: any) {
        console.error('更新项目失败:', err.message);
    }
}

export async function fetchProjects() {
    try {
        const userId = await getCurrentUserId();
        if (!userId) return [];

        // OPTIMIZATION: Do NOT fetch chapters here. Use the 'word_count' column on the project table.
        // Fetching all chapter content for list view causes timeouts.
        const { data, error } = await withRetry(async () => await supabase
            .from('projects')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
        );

        if (error) throw error;

        return data.map(p => ({
            ...p,
            word_count: p.word_count || 0 // Use the cached word count from DB
        }));
    } catch (e) {
        console.error("获取项目失败", e);
        return [];
    }
}

export async function deleteProject(id: string) {
    const userId = await getCurrentUserId();
    if (!userId) return;
    await supabase.from('projects').delete().eq('id', id).eq('user_id', userId);
}

// ================= 📝 章节 (Chapters) =================

export async function fetchChapters(projectId: string) {
    try {
        const { data, error } = await supabase
            .from('chapters')
            .select('*')
            .eq('project_id', projectId)
            .order('order_index', { ascending: true });
        return error ? [] : data;
    } catch (e) { return []; }
}

export async function saveChapterToDB(projectId: string, chapterId: string, title: string, content: string, orderIndex: number) {
    try {
        const userId = await getCurrentUserId();
        if (!userId) throw new Error("未登录");

        let resultId = null;
        const isNew = chapterId.startsWith('ch-') || chapterId.startsWith('scene-') || chapterId.startsWith('new-');

        // 1. Save the chapter
        if (isNew) {
            const { data, error } = await supabase.from('chapters').insert([{
                project_id: projectId,
                title,
                content,
                order_index: orderIndex
            }]).select();
            if (error) throw error;
            resultId = data[0].id;
        } else {
            const { data, error } = await supabase.from('chapters').update({
                title,
                content,
                order_index: orderIndex
            }).eq('id', chapterId).select();
            if (error) throw error;
            resultId = data[0].id;
        }

        // 2. Update Project Word Count (Aggregation)
        // We calculate this after saving to ensure consistency
        const { data: chapters } = await supabase
            .from('chapters')
            .select('content')
            .eq('project_id', projectId);
        
        const totalWordCount = chapters?.reduce((acc, curr) => acc + (curr.content?.length || 0), 0) || 0;

        await supabase
            .from('projects')
            .update({ word_count: totalWordCount })
            .eq('id', projectId);

        return resultId;
    } catch (e) {
        console.error("保存章节失败", e);
        return null;
    }
}

export async function deleteChapterFromDB(chapterId: string) {
    if (chapterId.startsWith('ch-') || chapterId.startsWith('scene-')) return;
    
    // We should also update word count after delete, but strict consistency 
    // might be overkill for this simple app. It will sync next time a chapter is saved.
    await supabase.from('chapters').delete().eq('id', chapterId);
}

// ================= 🧩 素材 (Materials) =================

export async function saveMaterial(name: string, content: string, type: 'character' | 'plot' | 'idea' | 'inspiration', tags: string[] = []) {
    try {
        const userId = await getCurrentUserId();
        if (!userId) throw new Error("未登录");

        const dbType = type === 'inspiration' ? 'idea' : type;

        const { error } = await supabase.from('materials').insert([{
            user_id: userId,
            name,
            content,
            type: dbType,
            tags: tags
        }]);

        if (error) throw error;
        return { success: true };
    } catch (err: any) {
        return { success: false, error: err };
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
        return error ? [] : data;
    } catch (e) { return []; }
}

export async function deleteMaterial(id: string) {
    const userId = await getCurrentUserId();
    if (!userId) return;
    await supabase.from('materials').delete().eq('id', id).eq('user_id', userId);
}

// ================= 💡 提示词 (Prompts) =================

function mapPromptCategory(cat: string) {
    if (cat === 'short-story') return 'short';
    if (cat === 'long-story') return 'long';
    if (cat === 'script') return 'script';
    return 'general';
}

export async function savePrompt(title: string, content: string, mainCat: string, subCat: string) {
    try {
        const userId = await getCurrentUserId();
        if (!userId) throw new Error("未登录");

        const dbMainCat = mapPromptCategory(mainCat);
        
        let description = '';
        try {
            const parsed = JSON.parse(content);
            if (parsed.description) description = parsed.description;
            else description = content.substring(0, 50) + '...';
        } catch (e) {
            description = content.substring(0, 50) + '...';
        }

        const { error } = await supabase.from('prompts').insert([{
            user_id: userId,
            title,
            content,
            description,
            main_category: dbMainCat,
            sub_category: subCat,
            usage_count: 0
        }]);

        if (error) {
            console.error("Supabase Save Error:", error);
            throw error;
        }
        return { success: true };

    } catch (err: any) {
        console.error("保存提示词失败 - 完整错误:", err);
        return { success: false, error: err };
    }
}

export async function updatePrompt(id: string, updates: { title?: string, content?: string, main_category?: string, sub_category?: string }) {
    try {
        const userId = await getCurrentUserId();
        if (!userId) throw new Error("未登录");

        const dbUpdates: any = { ...updates };
        
        if (updates.main_category) {
            dbUpdates.main_category = mapPromptCategory(updates.main_category);
        }

        if (updates.content) {
             try {
                const parsed = JSON.parse(updates.content);
                if (parsed.description) dbUpdates.description = parsed.description;
             } catch(e) {}
        }

        const { error } = await supabase
            .from('prompts')
            .update(dbUpdates)
            .eq('id', id)
            .eq('user_id', userId);

        if (error) throw error;
        return { success: true };
    } catch (err: any) {
        return { success: false, error: err };
    }
}

export async function fetchPrompts(mainCategory?: string) {
    try {
        // Optimization: Limit fetch size to avoid timeout on large datasets
        let query = supabase
            .from('prompts')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(500);

        if (mainCategory && mainCategory !== 'all') {
            const dbCat = mapPromptCategory(mainCategory);
            query = query.eq('main_category', dbCat);
        }

        const { data, error } = await query;
        if (error) {
            console.error("Fetch Prompts Error:", error);
            return [];
        }
        return data;
    } catch (e) { 
        console.error("Fetch Prompts Exception:", e);
        return []; 
    }
}

export async function incrementPromptHeat(id: string) {
    try {
        if (!id || id.startsWith('prompt-')) return;
        const { data } = await supabase.from('prompts').select('usage_count').eq('id', id).single();
        if (data) {
            const newCount = (data.usage_count || 0) + 1;
            await supabase.from('prompts').update({ usage_count: newCount }).eq('id', id);
        }
    } catch (e) { console.error(e); }
}

export async function deletePrompt(id: string) {
    const userId = await getCurrentUserId();
    if (!userId) return;
    await supabase.from('prompts').delete().eq('id', id).eq('user_id', userId);
}

// ================= 🖼️ 文件存储 (Storage) =================

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
    } catch (e) {
        console.error("上传封面失败", e);
        return null;
    }
}
