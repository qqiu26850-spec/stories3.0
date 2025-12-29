
export const config = {
  runtime: 'edge',
};

export default async function handler(request: Request) {
  // 处理 OPTIONS 预检请求
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { status: 405 });
  }

  try {
    const body = await request.json();
    
    // 获取环境变量中的 API Key
    const apiKey = process.env.DOUBAO_API_KEY;
    // 豆包通常需要 Endpoint ID，这里假设它是作为 model 参数传递，或者在环境变量中配置
    // 如果是 Volcengine 也就是火山引擎，通常 Endpoint 是固定的 URL 或者 specific ID
    // 这里作为通用代理结构，具体 URL 请根据实际购买的豆包服务配置
    const apiUrl = "https://ark.cn-beijing.volces.com/api/v3/chat/completions"; 

    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Doubao API Key not configured on server' }), { status: 500 });
    }

    // 转发请求到豆包 (兼容 OpenAI 格式)
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "Accept": "application/json"
      },
      body: JSON.stringify(body)
    });

    // 直接透传响应（包括流式响应）
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'application/json',
        'Access-Control-Allow-Origin': '*', // 允许前端访问
      },
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
