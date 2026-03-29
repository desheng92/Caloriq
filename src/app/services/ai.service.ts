import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

const DEFAULT_SYSTEM = 'You are a helpful, knowledgeable, and encouraging nutrition and diet assistant. Be practical and specific. Keep responses concise and well-structured.';

const IMAGE_SYSTEM = 'You are a nutrition expert. Identify each food item in the image and estimate calories. Respond ONLY with valid JSON — no markdown. Format: {"items":[{"name":"Food name","calories":123,"portion":"e.g. 1 cup / 150g","confidence":"high|medium|low"}],"notes":"optional"}';

@Injectable({ providedIn: 'root' })
export class AiService {
  constructor(private http: HttpClient) {}

  async callClaude(prompt: string, systemPrompt?: string): Promise<string> {
    const body = {
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system: systemPrompt || DEFAULT_SYSTEM,
      messages: [{ role: 'user', content: prompt }]
    };

    const data = await firstValueFrom(
      this.http.post<{ content: Array<{ text: string }> }>('/api/claude', body)
    );

    return data.content?.[0]?.text || 'Sorry, I could not generate a response.';
  }

  async scanImage(base64: string, mimeType: string): Promise<{ items: ScanItem[]; notes?: string }> {
    const body = {
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system: IMAGE_SYSTEM,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mimeType, data: base64 }
          },
          {
            type: 'text',
            text: 'Identify all foods in this image and estimate calories for each item as plated/served.'
          }
        ]
      }]
    };

    const data = await firstValueFrom(
      this.http.post<{ content: Array<{ text: string }> }>('/api/claude', body)
    );

    const raw = data.content?.[0]?.text || '';
    const cleaned = raw.replace(/```json|```/g, '').trim();
    return JSON.parse(cleaned);
  }
}

export interface ScanItem {
  name: string;
  calories: number;
  portion: string;
  confidence: 'high' | 'medium' | 'low';
  added?: boolean;
}
