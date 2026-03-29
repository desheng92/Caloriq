export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  const { system, messages, max_tokens } = req.body;
  const lastMessage = messages?.[messages.length - 1];

  // Convert Anthropic message format → Gemini parts
  const parts = [];
  if (Array.isArray(lastMessage?.content)) {
    for (const part of lastMessage.content) {
      if (part.type === 'image') {
        parts.push({ inline_data: { mime_type: part.source.media_type, data: part.source.data } });
      } else if (part.type === 'text') {
        parts.push({ text: part.text });
      }
    }
  } else {
    parts.push({ text: lastMessage?.content || '' });
  }

  const geminiBody = {
    contents: [{ parts }],
    generationConfig: { maxOutputTokens: max_tokens || 1000 },
  };
  if (system) {
    geminiBody.systemInstruction = { parts: [{ text: system }] };
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiBody),
    });

    const data = await response.json();

    // Log full response for debugging
    console.log('Gemini response:', JSON.stringify(data));

    // Check for API-level error
    if (data.error) {
      console.error('Gemini API error:', data.error);
      return res.status(500).json({ error: data.error.message || 'Gemini API error' });
    }

    const candidate = data.candidates?.[0];
    const finishReason = candidate?.finishReason;

    // Handle blocked/empty responses
    if (!candidate || finishReason === 'SAFETY' || finishReason === 'OTHER' || !candidate.content) {
      console.error('Gemini blocked or empty response. finishReason:', finishReason);
      return res.status(200).json({ content: [{ text: 'I was unable to generate a response for that request. Please try rephrasing.' }] });
    }

    const text = candidate.content?.parts?.[0]?.text || '';

    // Return in Anthropic-compatible format so the frontend needs no changes
    return res.status(200).json({ content: [{ text }] });
  } catch (e) {
    console.error('Gemini fetch error:', e);
    return res.status(500).json({ error: 'Failed to reach Gemini API' });
  }
}
