
import { createClient } from '@supabase/supabase-js';

// ================= Configuration =================
// Please replace with your own Supabase project URL and Anon Key
const SUPABASE_URL = 'https://vydvxxarfjyjjjhyhfek.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ5ZHZ4eGFyZmp5ampqaHloZmVrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM5NzY4OTksImV4cCI6MjA3OTU1Mjg5OX0.Y9Q4JwTZnBBwDDAhz_TUcxZ-Jv-eN8BXqPauIQaI-Ds';

// Initialize Supabase Client
export const supabase = createClient(SUPABASE_URL.trim(), SUPABASE_ANON_KEY.trim());

// =================== 🆕 身份认证 (Auth) 函数 ===================

/**
 * 1. 用户注册
 */
export async function signUp(email, password) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // window.location.origin 会自动获取当前浏览器地址栏的域名（比如 https://novel2-nine.vercel.app）
      emailRedirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
    },
  });
  return { data, error };
}

/**
 * 2. 用户登录
 */
export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  return { data, error };
}

/**
 * 3. 用户登出
 */
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  return error;
}

/**
 * 3.5 找回密码 (发送重置邮件)
 */
export async function resetPasswordForEmail(email: string) {
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: typeof window !== 'undefined' ? `${window.location.origin}` : undefined,
  });
  return { data, error };
}

/**
 * 4. 获取当前登录用户的 ID
 */
export async function getCurrentUserId() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id || null;
}

/**
 * 5. 获取用户个人资料 (昵称等)
 */
export async function fetchUserProfile() {
    try {
        // For this demo without a profiles table, we return the default mock or check auth metadata
        const { data: { session } } = await supabase.auth.getSession();
        return {
            nickname: session?.user?.user_metadata?.full_name || '奇思妙想家',
            avatarUrl: session?.user?.user_metadata?.avatar_url || null
        };
    } catch (e) {
        return { nickname: '奇思妙想家', avatarUrl: null };
    }
}

/**
 * 6. 更新用户个人资料
 */
export async function updateUserProfile(nickname: string, avatarUrl: string | null) {
    try {
        const { data, error } = await supabase.auth.updateUser({
            data: { full_name: nickname, avatar_url: avatarUrl }
        });
        if (error) throw error;
        return { data, error: null };
    } catch (e: any) {
        console.error("Update Profile Error", e);
        return { data: null, error: e };
    }
}

/**
 * 7. 注销账号（删除数据保留提示词）
 */
export async function deleteUserData(): Promise<boolean> {
    try {
        const userId = await getCurrentUserId();
        if (!userId) throw new Error("User not logged in");

        // Delete Projects
        const { error: pError } = await supabase.from('projects').delete().eq('user_id', userId);
        if (pError) throw pError;

        // Delete Materials
        const { error: mError } = await supabase.from('materials').delete().eq('user_id', userId);
        if (mError) throw mError;

        // Sign out the user
        await signOut();
        return true;
    } catch (err: any) {
        console.error('Failed to delete user data:', err.message);
        return false;
    }
}

// ================= Storage Functions =================

/**
 * Upload Cover Image to Supabase Storage
 */
export async function uploadCoverImage(file: File): Promise<string | null> {
    try {
        const userId = await getCurrentUserId();
        if (!userId) throw new Error("User not logged in");

        // Create a unique file path: userId/timestamp-filename
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `${userId}/${fileName}`;

        // Upload to 'covers' bucket
        const { error: uploadError } = await supabase.storage
            .from('covers')
            .upload(filePath, file);

        if (uploadError) {
            console.error('Upload Error:', uploadError);
            throw uploadError;
        }

        // Get Public URL
        const { data } = supabase.storage.from('covers').getPublicUrl(filePath);
        return data.publicUrl;
    } catch (error: any) {
        console.error('Failed to upload cover:', error.message);
        return null;
    }
}

// ================= Core Functions =================

/**
 * 1. Create New Project (Novel/Script/Short Story)
 * Table: projects
 */
export async function createProject(title: string, desc: string, type: 'novel' | 'script' | 'short_story', coverUrl: string | null = null): Promise<string | null> {
    try {
        const userId = await getCurrentUserId();
        if (!userId) throw new Error("用户未登录，请先登录。");

        const { data, error } = await supabase
            .from('projects')
            .insert([
                {
                    user_id: userId,
                    title: title,
                    description: desc,
                    type: type,
                    status: 'draft',
                    cover_image: coverUrl
                }
            ])
            .select();

        if (error) throw error;
        return data[0].id;
    } catch (err: any) {
        console.error('Failed to create project:', err);
        let msg = err.message;
        if (msg === 'Failed to fetch') {
            msg = '网络连接失败。请检查您的网络，或关闭可能拦截请求的广告拦截器/代理插件。';
        }
        alert('创建云端项目失败: ' + msg);
        return null;
    }
}

/**
 * 2. Update Project Metadata (Title, etc.)
 */
export async function updateProject(projectId: string, updates: { title?: string, description?: string, cover_image?: string }) {
    try {
        const userId = await getCurrentUserId();
        if (!userId) throw new Error("User not logged in");

        const { error } = await supabase
            .from('projects')
            .update(updates)
            .eq('id', projectId)
            .eq('user_id', userId);

        if (error) throw error;
    } catch (err: any) {
        console.error('Failed to update project:', err.message);
    }
}

/**
 * 3. Fetch Chapters for a Project
 */
export async function fetchChapters(projectId: string) {
    try {
        const { data, error } = await supabase
            .from('chapters')
            .select('*')
            .eq('project_id', projectId)
            .order('order_index', { ascending: true });
        
        if (error) throw error;
        return data;
    } catch (err: any) {
        console.error('Failed to fetch chapters:', err.message);
        return [];
    }
}

/**
 * 4. Smart Save Chapter (Insert or Update)
 */
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
            // INSERT
            const { data, error } = await supabase
                .from('chapters')
                .insert([
                    {
                        project_id: projectId,
                        title: title,
                        content: content,
                        order_index: orderIndex
                    }
                ])
                .select();

            if (error) throw error;
            return data[0].id;
        } else {
            // UPDATE
            const { data, error } = await supabase
                .from('chapters')
                .update({
                    title: title,
                    content: content,
                    order_index: orderIndex
                })
                .eq('id', chapterId)
                .select();

            if (error) throw error;
            return data[0].id;
        }
    } catch (err: any) {
        console.error('Failed to save chapter:', err.message);
        return null;
    }
}

/**
 * 5. Delete Chapter
 */
export async function deleteChapterFromDB(chapterId: string): Promise<void> {
    try {
        const userId = await getCurrentUserId();
        if (!userId) throw new Error("User not logged in");

        if (chapterId.startsWith('ch-') || chapterId.startsWith('scene-') || chapterId.startsWith('new-')) {
            return;
        }

        const { error } = await supabase
            .from('chapters')
            .delete()
            .eq('id', chapterId);

        if (error) throw error;
    } catch (err: any) {
        console.error('Failed to delete chapter:', err.message);
        alert('删除云端章节失败。');
    }
}

// --- Material & Prompt Functions ---

export async function saveMaterial(name: string, content: string, type: 'character' | 'plot' | 'idea', tags: string[] = []): Promise<void> {
    try {
        const userId = await getCurrentUserId();
        if (!userId) throw new Error("User not logged in");

        const { error } = await supabase
            .from('materials')
            .insert([
                { user_id: userId, name, content, type, tags: tags }
            ]);
        if (error) throw error;
        alert('素材已同步到云端！');
    } catch (err: any) {
        console.error('Failed to save material:', err.message);
        alert('保存素材失败: ' + err.message);
    }
}

export async function savePrompt(title: string, content: string, mainCat: string, subCat: string): Promise<void> {
    try {
        const userId = await getCurrentUserId();
        if (!userId) throw new Error("User not logged in");

        const { error } = await supabase
            .from('prompts')
            .insert([
                { 
                    user_id: userId, 
                    title, 
                    content, 
                    main_category: mainCat, 
                    sub_category: subCat,
                    heat: 0
                }
            ]);
        if (error) throw error;
        alert('提示词已保存到云端库！');
    } catch (err: any) {
        console.error('Failed to save prompt:', err.message);
        alert('保存提示词失败: ' + err.message);
    }
}

export async function updatePrompt(id: string, updates: { title?: string, content?: string, main_category?: string, sub_category?: string }): Promise<void> {
    try {
        const userId = await getCurrentUserId();
        if (!userId) throw new Error("User not logged in");

        const { error } = await supabase
            .from('prompts')
            .update(updates)
            .eq('id', id)
            .eq('user_id', userId);

        if (error) throw error;
        alert('提示词已更新！');
    } catch (err: any) {
        console.error('Failed to update prompt:', err.message);
        alert('更新提示词失败: ' + err.message);
    }
}

export async function incrementPromptHeat(id: string): Promise<void> {
    try {
        if (!id || id.startsWith('prompt-user-')) return; 
        const { data } = await supabase.from('prompts').select('heat').eq('id', id).single();
        if (data) {
            const newHeat = (data.heat || 0) + 1;
            await supabase.from('prompts').update({ heat: newHeat }).eq('id', id);
        }
    } catch (e) {
        console.error("Failed to increment heat", e);
    }
}

export async function fetchProjects() {
    try {
        const userId = await getCurrentUserId();
        if (!userId) return [];

        const { data: projects, error } = await supabase
            .from('projects')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });
        
        if (error || !projects) return [];

        const projectIds = projects.map(p => p.id);
        if (projectIds.length === 0) return projects;

        const { data: chapters, error: chapterError } = await supabase
            .from('chapters')
            .select('project_id, content')
            .in('project_id', projectIds);

        if (chapterError) {
            console.error("Failed to fetch chapters for word count", chapterError);
            return projects;
        }

        const projectsWithCount = projects.map(p => {
            const pChapters = chapters?.filter(c => c.project_id === p.id) || [];
            const totalWords = pChapters.reduce((acc, c) => acc + (c.content ? c.content.length : 0), 0);
            return { ...p, word_count: totalWords };
        });

        return projectsWithCount;
    } catch (e) {
        console.error("Fetch Projects Error", e);
        return [];
    }
}

export async function fetchMaterials(type?: 'character' | 'plot' | 'idea') {
    try {
        const userId = await getCurrentUserId();
        if (!userId) return [];

        let query = supabase.from('materials').select('*').eq('user_id', userId).order('created_at', { ascending: false });
        if (type) query = query.eq('type', type);
        const { data, error } = await query;
        return error ? [] : data;
    } catch (e) {
        return [];
    }
}

export async function fetchPrompts(mainCategory?: string) {
    try {
        let query = supabase.from('prompts').select('*').order('created_at', { ascending: false });
        
        if (mainCategory && mainCategory !== 'all') {
             query = query.eq('main_category', mainCategory);
        }
        
        const { data, error } = await query;
        return error ? [] : data;
    } catch (e) {
        return [];
    }
}

export async function fetchUserLibrary() {
    try {
        const userId = await getCurrentUserId();
        if (!userId) return { prompts: [], materials: [] };

        const { data: prompts } = await supabase
            .from('prompts')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        const { data: materials } = await supabase
            .from('materials')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        return {
            prompts: prompts || [],
            materials: materials || []
        };
    } catch (e) {
        console.error("Fetch User Library Error", e);
        return { prompts: [], materials: [] };
    }
}

export async function deleteProject(id: string): Promise<void> {
    try {
        const userId = await getCurrentUserId();
        if (!userId) throw new Error("User not logged in");
        await supabase.from('projects').delete().eq('id', id).eq('user_id', userId);
    } catch (e) {
        console.error("Delete Project Error", e);
    }
}

export async function deleteMaterial(id: string): Promise<void> {
    try {
        const userId = await getCurrentUserId();
        if (!userId) throw new Error("User not logged in");
        await supabase.from('materials').delete().eq('id', id).eq('user_id', userId);
    } catch (e) {
        console.error("Delete Material Error", e);
    }
}

export async function deletePrompt(id: string): Promise<void> {
    try {
        const userId = await getCurrentUserId();
        if (!userId) throw new Error("User not logged in");
        await supabase.from('prompts').delete().eq('id', id).eq('user_id', userId);
    } catch (e) {
        console.error("Delete Prompt Error", e);
    }
}
