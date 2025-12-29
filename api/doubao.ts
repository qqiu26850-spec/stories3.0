
import type { VercelRequest, VercelResponse } from '@vercel/node';

// 移除 Edge Runtime 配置，默认使用 Node.js (Serverless Function)
// Node.js 环境对 fetch 和流式传输的支持更稳定，能避免很多 Edge 环境下的 "internal error"
export const config = {
  maxDuration: 60, // 设置最大超时时间为 60秒 (Hobby 计划限制为 10s-60s)
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 处理 CORS 和 OPTIONS 请求
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  try {
    const apiKey = process.env.DOUBAO_API_KEY;
    const endpointId = process.env.DOUBAO_ENDPOINT_ID;

    // 1. 基础配置检查
    if (!apiKey) {
      console.error("Doubao API Key missing.");
      res.status(500).json({ error: '配置缺失: 请在 Vercel 环境变量中添加 DOUBAO_API_KEY。' });
      return;
    }

    // 2. 获取请求体 (Node.js 环境下 req.body 会自动解析 JSON)
    const body = req.body;

    // 3. 模型映射逻辑
    // 如果前端请求的是 doubao-pro-32k 或其他 doubao 开头的模型，强制替换为 Endpoint ID
    if (body.model === 'doubao-pro-32k' || (typeof body.model === 'string' && body.model.startsWith('doubao'))) {
        if (endpointId) {
            body.model = endpointId.trim(); // 去除可能的空格
        } else {
            console.error("Doubao Endpoint ID missing.");
            res.status(500).json({ error: '配置缺失: 请在 Vercel 环境变量中添加 DOUBAO_ENDPOINT_ID (格式如 ep-2024...)。' });
            return;
        }
    }

    // 4. 发起请求
    const apiUrl = "https://ark.cn-beijing.volces.com/api/v3/chat/completions";
    
    // Node 18+ 环境下全局 fetch 可用
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // 确保 Key 没有多余空格
        "Authorization": `Bearer ${apiKey.trim()}`
      },
      body: JSON.stringify(body)
    });

    // 5. 处理上游错误
    if (!response.ok) {
        const errorText = await response.text();
        console.error(`Doubao Upstream Error (${response.status}):`, errorText);
        res.status(response.status).json({ error: `豆包服务报错 (${response.status}): ${errorText}` });
        return;
    }

    // 6. 处理响应 (支持流式和非流式)
    if (body.stream) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        
        // 使用 Web Streams API 读取流并写入响应
        if (response.body) {
            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const chunk = decoder.decode(value, { stream: true });
                res.write(chunk);
            }
            res.end();
        }
    } else {
        const data = await response.json();
        res.status(200).json(data);
    }

  } catch (error: any) {
    console.error("Internal Handler Error:", error);
    res.status(500).json({ error: `代理服务内部错误: ${error.message}` });
  }
}
