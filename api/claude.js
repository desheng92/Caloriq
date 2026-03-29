export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  const { system, messages, max_tokens } = req.body;
  const lastMessage = messages?.[messages.length - 1];

  // Determine if this is a vision request (image content)
  const isVision = Array.isArray(lastMessage?.content) &&
    lastMessage.content.some(p => p.type === 'image');

  // Build Groq-compatible message content
  let userContent;
  if (Array.isArray(lastMessage?.content)) {
    userContent = lastMessage.content.map(part => {
      if (part.type === 'image') {
        return {
          type: 'image_url',
          image_url: {
            url: `data:${part.source.media_type};base64,${part.source.data}`
          }
        };
      }
      return { type: 'text', text: part.text };
    });
  } else {
    userContent = lastMessage?.content || '';
  }

  const groqMessages = [];
  if (system) {
    groqMessages.push({ role: 'system', content: system });
  }
  groqMessages.push({ role: 'user', content: userContent });

  const model = isVision ? 'meta-llama/llama-4-scout-17b-16e-instruct' : 'llama-3.3-70b-versatile';

  const groqBody = {
    model,
    max_tokens: max_tokens || 1000,
    messages: groqMessages,
  };

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(groqBody),
    });

    const data = await response.json();

    if (data.error) {
      console.error('Groq API error:', data.error);
      return res.status(500).json({ error: data.error.message || 'Groq API error' });
    }

    const text = data.choices?.[0]?.message?.content || '';

    // Return in Anthropic-compatible format so the frontend needs no changes
    return res.status(200).json({ content: [{ text }] });
  } catch (e) {
    console.error('Groq fetch error:', e);
    return res.status(500).json({ error: 'Failed to reach Groq API' });
  }
}
