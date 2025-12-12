import { createClient } from '@supabase/supabase-js';

// ================= 配置区域 =================
// 🔴 请务必填入你的 Key，不要留空！
const SUPABASE_URL = 'https://kuvfgccoyekvkolkgwby.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1dmZnY2NveWVrdmtvbGtnd2J5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0NDc5NzIsImV4cCI6MjA4MTAyMzk3Mn0.94-LLSUIN5HSfi4-wq0dhmxAP1T2beyKiR8z7CdWstg';

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
 * 通用的重试逻辑 (处理网络波动)
 */
async function withRetry<T>(operation: () => Promise<T>, retries = 3): Promise<T> {
    try {
        return await operation();
    } catch (err: any) {
        if (retries > 0 && (err.message?.includes('fetch') || err.status === 500)) {
            console.warn(`请求失败，正在重试... 剩余次数: ${retries}`);
            await new Promise(r => setTimeout(r, 1000));
            return withRetry(operation, retries - 1);
        }
        throw err;
    }
}

// ================= 身份认证 =================

export async function signUp(email: string, password: string) {
    return await supabase.auth.signUp({ 
        email, 
        password,
        options: {
            // 关闭邮箱验证后，这一行其实可以不加，但加上更保险
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

// ================= 小说项目 (Projects) - 私有 =================

export async function createProject(title: string, desc: string, type: 'novel' | 'script' | 'short' | 'short_story', coverUrl: string | null = null) {
    try {
        const userId = await getCurrentUserId();
        if (!userId) throw new Error("请先登录");

        // 统一类型映射
        const dbType = type === 'short' ? 'short_story' : type;

        const { data, error } = await withRetry(async () => await supabase
            .from('projects')
            .insert([{
                user_id: userId,
                title,
                description: desc,
                type: dbType,
                cover_image: coverUrl,
                status: 'draft'
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

export async function fetchProjects() {
    try {
        const userId = await getCurrentUserId();
        if (!userId) return [];

        const { data, error } = await withRetry(async () => await supabase
            .from('projects')
            .select('*')
            .eq('user_id', userId) // 🔒 私有：只查自己的
            .order('created_at', { ascending: false })
        );

        return error ? [] : data;
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

// ================= 章节 (Chapters) - 私有 =================

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

        // 判断是新建还是更新 (本地临时ID通常以 ch- 开头)
        const isNew = chapterId.startsWith('ch-') || chapterId.startsWith('new-');

        if (isNew) {
            const { data, error } = await supabase.from('chapters').insert([{
                project_id: projectId,
                title,
                content,
                order_index: orderIndex
            }]).select();
            if (error) throw error;
            return data[0].id;
        } else {
            const { data, error } = await supabase.from('chapters').update({
                title,
                content,
                order_index: orderIndex
            }).eq('id', chapterId).select();
            if (error) throw error;
            return data[0].id;
        }
    } catch (e) {
        console.error("保存章节失败", e);
        return null;
    }
}

export async function deleteChapterFromDB(chapterId: string) {
    if (chapterId.startsWith('ch-')) return;
    await supabase.from('chapters').delete().eq('id', chapterId);
}

// ================= 素材 (Materials) - 私有 =================

export async function saveMaterial(name: string, content: string, type: 'character' | 'plot' | 'idea' | 'inspiration') {
    try {
        const userId = await getCurrentUserId();
        if (!userId) throw new Error("未登录");

        const dbType = type === 'inspiration' ? 'idea' : type;

        const { error } = await supabase.from('materials').insert([{
            user_id: userId,
            name,
            content,
            type: dbType,
            tags: []
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
        
        // 处理类型映射
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

// ================= 提示词 (Prompts) - 🌍 公开共享 =================

function mapPromptCategory(cat: string) {
    if (cat === 'short-story') return 'short';
    if (cat === 'long-story') return 'long';
    return 'general';
}

export async function savePrompt(title: string, content: string, mainCat: string, subCat: string) {
    try {
        const userId = await getCurrentUserId();
        if (!userId) throw new Error("未登录");

        const dbMainCat = mapPromptCategory(mainCat);
        
        // ✅ 尝试从 content JSON 中解析 description
        let description = '';
        try {
            const parsed = JSON.parse(content);
            if (parsed.description) description = parsed.description;
            else description = content.substring(0, 50) + '...'; // 如果没json，截取前50字
        } catch (e) {
            description = content.substring(0, 50) + '...';
        }

        const { error } = await supabase.from('prompts').insert([{
            user_id: userId,
            title,
            content,
            description: description, // ✅ 这里使用了 description 字段
            main_category: dbMainCat,
            sub_category: subCat,
            usage_count: 0 // ✅ 这里使用了 usage_count 字段
        }]);

        if (error) throw error;
        return { success: true };

    } catch (err: any) {
        console.error("保存提示词失败", err);
        return { success: false, error: err };
    }
}

export async function fetchPrompts(mainCategory?: string) {
    try {
        // 🌍 注意：这里没有 .eq('user_id', userId)
        // 我们要获取所有人的提示词
        let query = supabase
            .from('prompts')
            .select(`
                *,
                profiles ( username, avatar_url )
            `)
            .order('created_at', { ascending: false });

        if (mainCategory && mainCategory !== 'all') {
            const dbCat = mapPromptCategory(mainCategory);
            query = query.eq('main_category', dbCat);
        }

        const { data, error } = await query;
        return error ? [] : data;
    } catch (e) { return []; }
}

export async function incrementPromptHeat(id: string) {
    try {
        // ✅ 统一使用 usage_count
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
    // RLS 会保证只有作者能删除，这里加 user_id 只是双重保险
    await supabase.from('prompts').delete().eq('id', id).eq('user_id', userId);
}

// ================= 文件存储 (Storage) =================

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
// ================= 补全缺失的 Auth 函数 (修复报错) =================

/**
 * 重置密码 (修复 AuthModal 报错)
 */
export async function resetPasswordForEmail(email: string) {
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
  });
  return { data, error };
}

/**
 * 获取用户个人资料 (修复可能出现的个人中心报错)
 */
export async function fetchUserProfile() {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return { nickname: '用户', avatarUrl: null };

        const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
        
        return {
            nickname: profile?.username || session.user.user_metadata?.full_name || '用户',
            avatarUrl: profile?.avatar_url || session.user.user_metadata?.avatar_url || null
        };
    } catch (e) {
        return { nickname: '用户', avatarUrl: null };
    }
}

/**
 * 更新用户个人资料
 */
export async function updateUserProfile(nickname: string, avatarUrl: string | null) {
    const userId = await getCurrentUserId();
    if (!userId) return { error: '未登录' };
    
    // 1. 更新 Auth 元数据
    await supabase.auth.updateUser({
        data: { full_name: nickname, avatar_url: avatarUrl }
    });
    
    // 2. 更新 profiles 表 (确保数据同步)
    const { error } = await supabase.from('profiles').upsert({ 
        id: userId, 
        username: nickname, 
        avatar_url: avatarUrl,
        updated_at: new Date().toISOString()
    });

    return { error };
}
// ================= 补全缺失的 Prompt 和 User 函数 (修复 Build 报错) =================

/**
 * 更新提示词 (修复 PromptLibrary 报错)
 */
export async function updatePrompt(id: string, updates: { title?: string, content?: string, main_category?: string, sub_category?: string }) {
    try {
        const userId = await getCurrentUserId();
        if (!userId) throw new Error("未登录");

        const dbUpdates: any = { ...updates };
        
        // 如果更新了分类，需要映射一下数据库字段
        if (updates.main_category) {
            if (updates.main_category === 'short-story') dbUpdates.main_category = 'short';
            else if (updates.main_category === 'long-story') dbUpdates.main_category = 'long';
            else if (updates.main_category === 'script') dbUpdates.main_category = 'script';
            else dbUpdates.main_category = 'general';
        }

        // 如果更新了内容，尝试提取 description
        if (updates.content) {
             try {
                const parsed = JSON.parse(updates.content);
                if (parsed.description) dbUpdates.description = parsed.description;
                else dbUpdates.description = updates.content.substring(0, 50) + '...';
             } catch(e) {
                dbUpdates.description = updates.content.substring(0, 50) + '...';
             }
        }

        const { error } = await supabase
            .from('prompts')
            .update(dbUpdates)
            .eq('id', id)
            .eq('user_id', userId); // 确保只能改自己的

        if (error) throw error;
        return { success: true };
    } catch (err: any) {
        console.error('更新提示词失败:', err.message);
        return { success: false, error: err };
    }
}

/**
 * 删除用户所有数据 (修复 PersonalCenter 可能出现的报错)
 */
export async function deleteUserData(): Promise<boolean> {
    try {
        const userId = await getCurrentUserId();
        if (!userId) throw new Error("User not logged in");

        // 删除关联数据
        await supabase.from('projects').delete().eq('user_id', userId);
        await supabase.from('materials').delete().eq('user_id', userId);
        await supabase.from('prompts').delete().eq('user_id', userId);
        
        // 登出
        await signOut();
        return true;
    } catch (err: any) {
        console.error('删除用户数据失败:', err.message);
        return false;
    }
}