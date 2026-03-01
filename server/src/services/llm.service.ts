import axios from 'axios';
import { jsonrepair } from 'jsonrepair';
import { LLMConfig, LLMMessage, LLMResponse } from '../types';

const DEFAULT_CONFIG: LLMConfig = {
  model: process.env.OLLAMA_MODEL || 'qwen2.5-coder:7b',
  baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
  temperature: parseFloat(process.env.OLLAMA_TEMPERATURE || '0.7'),
  maxTokens: parseInt(process.env.OLLAMA_MAX_TOKENS || '4000', 10)
};

const ENABLE_DEBUG = process.env.ENABLE_DEBUG_LOGS === 'true';

const log = (...args: any[]) => {
  if (ENABLE_DEBUG) {
    console.log('[LLM]', ...args);
  }
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
      log(`Sending request to ${this.config.baseUrl}/api/chat with model ${this.config.model}`);

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

      log(`Received response, tokens used: ${response.data.eval_count}`);

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
  async generateJSON<T>(prompt: string, systemPrompt?: string, retryCount = 0): Promise<T> {
    const strictRules = `

CRITICAL JSON RULES:
- Return ONLY valid JSON
- No comments (// or /* */)
- No markdown or code blocks
- No trailing commas
- Strings must use double quotes only
- If a list is empty, return []
- Do NOT add explanations or text outside the JSON`;

    const jsonSystemPrompt = `${systemPrompt || ''}${strictRules}`;

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

    // Attempt 1: Direct parse
    try {
      return JSON.parse(jsonStr) as T;
    } catch (firstError) {
      log('First JSON parse failed, attempting repair...');

      // Attempt 2: Use jsonrepair library
      try {
        const repaired = jsonrepair(jsonStr);
        log('JSON repaired successfully');
        return JSON.parse(repaired) as T;
      } catch (repairError) {
        log('JSON repair failed, attempting manual cleanup...');

        // Attempt 3: Manual cleanup
        try {
          let cleaned = jsonStr
            .replace(/\/\/.*$/gm, '')  // Remove // comments
            .replace(/\/\*[\s\S]*?\*\//g, '')  // Remove /* */ comments
            .replace(/,\s*([}\]])/g, '$1')  // Remove trailing commas
            .trim();

          return JSON.parse(cleaned) as T;
        } catch (cleanupError) {
          // Attempt 4: Retry with stricter prompt (only once)
          if (retryCount === 0) {
            console.warn('All JSON parsing attempts failed. Retrying with stricter prompt...');
            const retryPrompt = `${prompt}\n\n⚠️ IMPORTANT: The previous output was invalid JSON. Please produce the SAME content again, but as strictly valid JSON with no comments or extra text.`;
            return this.generateJSON<T>(retryPrompt, systemPrompt, 1);
          }

          console.error('Failed to parse JSON response after all attempts:');
          console.error('Original:', jsonStr);
          throw new Error('LLM returned invalid JSON after multiple attempts');
        }
      }
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
