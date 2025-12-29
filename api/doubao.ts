
export const config = {
  runtime: 'edge',
};

export default async function handler(request: Request) {
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
    const { model, messages, temperature, top_p, max_tokens, stream } = body;
    
    // Get API Key from the standard Volcengine env var name requested
    const apiKey = process.env.ARK_API_KEY;
    
    // Hardcode the specific endpoint ID for 'doubao-flash' as requested.
    // We map ANY model name starting with 'doubao' to this endpoint to prevent errors 
    // if the frontend sends a legacy model name (like doubao-pro-32k).
    let endpointId = '';
    if (model && model.startsWith('doubao')) {
        endpointId = 'ep-20251229180745-tbpdh';
    } else {
        // Fallback or direct pass-through if needed
        endpointId = model; 
    }

    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'ARK_API_KEY not configured on server' }), { status: 500 });
    }

    // Volcengine OpenAI Compatible Endpoint
    const response = await fetch("https://ark.cn-beijing.volces.com/api/v3/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "Accept": "application/json"
      },
      body: JSON.stringify({
        model: endpointId, // Volcengine uses the Endpoint ID as the model parameter
        messages,
        temperature,
        top_p,
        max_tokens,
        stream
      })
    });

    if (!response.ok) {
        const errorText = await response.text();
        return new Response(JSON.stringify({ error: `Volcengine Error: ${response.status} ${errorText}` }), { status: response.status });
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
