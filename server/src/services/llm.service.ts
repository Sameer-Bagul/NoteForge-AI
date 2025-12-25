import axios from 'axios';
import { LLMConfig, LLMMessage, LLMResponse } from '../types';

const DEFAULT_CONFIG: LLMConfig = {
  model: 'mistral',
  baseUrl: 'http://localhost:11434',
  temperature: 0.2,
  maxTokens: 4096
};

export class LLMService {
  private config: LLMConfig;

  constructor(config: Partial<LLMConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // Generate completion using Ollama
  async generate(prompt: string, systemPrompt?: string): Promise<LLMResponse> {
    const messages: LLMMessage[] = [];
    
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });

    return this.chat(messages);
  }

  // Chat with context
  async chat(messages: LLMMessage[]): Promise<LLMResponse> {
    try {
      const response = await axios.post(`${this.config.baseUrl}/api/chat`, {
        model: this.config.model,
        messages: messages.map(m => ({
          role: m.role,
          content: m.content
        })),
        stream: false,
        options: {
          temperature: this.config.temperature,
          num_predict: this.config.maxTokens
        }
      });

      return {
        content: response.data.message?.content || '',
        tokensUsed: response.data.eval_count
      };
    } catch (error) {
      console.error('LLM API Error:', error);
      throw new Error(`LLM request failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Generate with structured output (JSON)
  async generateJSON<T>(prompt: string, systemPrompt?: string): Promise<T> {
    const jsonSystemPrompt = `${systemPrompt || ''}\n\nIMPORTANT: You must respond ONLY with valid JSON. No explanations, no markdown, just pure JSON.`;
    
    const response = await this.generate(prompt, jsonSystemPrompt);
    
    // Extract JSON from response (handle potential markdown code blocks)
    let jsonStr = response.content.trim();
    
    // Remove markdown code blocks if present
    if (jsonStr.startsWith('```json')) {
      jsonStr = jsonStr.slice(7);
    } else if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.slice(3);
    }
    if (jsonStr.endsWith('```')) {
      jsonStr = jsonStr.slice(0, -3);
    }
    
    jsonStr = jsonStr.trim();

    try {
      return JSON.parse(jsonStr) as T;
    } catch (error) {
      console.error('Failed to parse JSON response:', jsonStr);
      throw new Error('LLM returned invalid JSON');
    }
  }

  // Check if Ollama is available
  async checkHealth(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.config.baseUrl}/api/tags`);
      return response.status === 200;
    } catch {
      return false;
    }
  }

  // List available models
  async listModels(): Promise<string[]> {
    try {
      const response = await axios.get(`${this.config.baseUrl}/api/tags`);
      return response.data.models?.map((m: any) => m.name) || [];
    } catch {
      return [];
    }
  }

  // Update configuration
  updateConfig(config: Partial<LLMConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): LLMConfig {
    return { ...this.config };
  }
}

export const llmService = new LLMService();
