/**
 * Mermaid Generation, Validation & Repair Pipeline
 * Orchestrates the full lifecycle from LLM generation to deterministic compilation,
 * syntax validation, auto-repair, and markdown integration.
 */

import { DiagramIR, ValidationResult, RepairResult } from './types';
import { DiagramIRSchema } from './schemas';
import { compileDiagramIR } from './compiler';
import { validateMermaid } from './validator';
import { repairMermaid, createSafeFallbackDiagram } from './repair';
import { tauriApi } from '../tauri';
import { getAIConfigForTask } from '../nativePipeline';

export interface MermaidPipelineOptions {
  topicTitle?: string;
  useAiRepair?: boolean;
  maxAttempts?: number;
}

/**
 * Scans markdown content for all ```mermaid ... ``` code blocks,
 * validates each one against the official Mermaid parser,
 * repairs any invalid syntax (via fast deterministic rules or AI repair),
 * and returns the updated markdown with guaranteed-valid diagrams.
 */
export async function sanitizeMarkdownMermaidBlocks(
  markdown: string,
  options: MermaidPipelineOptions = {}
): Promise<string> {
  if (!markdown || !markdown.includes('```mermaid')) {
    return markdown;
  }

  const mermaidRegex = /```mermaid([\s\S]*?)```/g;
  let match: RegExpExecArray | null;
  const matches: Array<{ fullMatch: string; innerCode: string; index: number }> = [];

  while ((match = mermaidRegex.exec(markdown)) !== null) {
    matches.push({
      fullMatch: match[0],
      innerCode: match[1],
      index: match.index,
    });
  }

  if (matches.length === 0) return markdown;

  let updatedMarkdown = markdown;

  for (const item of matches) {
    const rawCode = item.innerCode.trim();
    if (!rawCode) continue;

    // Validate and repair
    const repairRes: RepairResult = await repairMermaid(rawCode, {
      maxAiAttempts: options.maxAttempts ?? 2,
      diagramTitle: options.topicTitle || 'System Architecture',
      useAi: options.useAiRepair ?? false, // Default to deterministic in fast stream/save
    });

    const finalCode = repairRes.valid ? repairRes.repairedCode : createSafeFallbackDiagram(options.topicTitle);
    const replacement = `\`\`\`mermaid\n${finalCode}\n\`\`\``;

    updatedMarkdown = updatedMarkdown.replace(item.fullMatch, replacement);
  }

  return updatedMarkdown;
}

/**
 * High-Reliability Diagram Generator:
 * 1. Prompts LLM for a structured JSON Diagram IR (NOT raw Mermaid).
 * 2. Validates JSON structure using Zod.
 * 3. Compiles deterministically into safe Mermaid syntax.
 * 4. Validates with official Mermaid parser.
 * 5. If needed, runs auto-repair.
 */
export async function generateReliableDiagram(
  systemDescription: string,
  options: {
    preferredType?: 'flowchart' | 'sequence' | 'class' | 'er' | 'state' | 'mindmap';
    title?: string;
  } = {}
): Promise<{ code: string; ir?: DiagramIR; valid: boolean }> {
  const aiConfig = getAIConfigForTask('features');
  const type = options.preferredType || 'flowchart';

  const prompt = `Design a clear, educational architectural diagram for the following system or concept:
"${systemDescription}"

CRITICAL INSTRUCTION:
Do NOT write raw Mermaid code. Instead, generate a valid JSON object matching the Diagram Intermediate Representation (IR).

Type: "${type}"
JSON SCHEMA REQUIREMENT:
{
  "diagramType": "flowchart",
  "direction": "TB",
  "title": "${options.title || 'System Overview'}",
  "nodes": [
    { "id": "client", "label": "Client Application", "shape": "rounded" },
    { "id": "server", "label": "API Backend Service", "shape": "rectangle" },
    { "id": "db", "label": "Primary Database", "shape": "cylinder" }
  ],
  "edges": [
    { "from": "client", "to": "server", "label": "REST Calls" },
    { "from": "server", "to": "db", "label": "SQL Queries" }
  ]
}

Return ONLY the raw JSON object with NO markdown fences and no conversational comments.`;

  const systemPrompt = 'You are an expert systems architect. Output ONLY valid JSON.';

  let rawResponse = '';
  try {
    await tauriApi.streamLLM(
      prompt,
      systemPrompt,
      aiConfig.provider,
      aiConfig.model,
      aiConfig.baseUrl,
      (delta) => {
        rawResponse += delta;
      },
      aiConfig.apiKey
    );

    // Clean JSON fences if present
    let cleaned = rawResponse.trim();
    if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
    if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
    if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
    cleaned = cleaned.trim();

    const parsedJson = JSON.parse(cleaned);
    const validatedIR = DiagramIRSchema.parse(parsedJson);

    // Compile deterministically
    const compiledCode = compileDiagramIR(validatedIR);
    const valResult = await validateMermaid(compiledCode);

    if (valResult.valid) {
      return {
        code: compiledCode,
        ir: validatedIR,
        valid: true,
      };
    }

    // Attempt repair if compiler edge case failed
    const repairResult = await repairMermaid(compiledCode, {
      diagramTitle: options.title,
      useAi: false,
    });

    return {
      code: repairResult.repairedCode,
      ir: validatedIR,
      valid: repairResult.valid,
    };
  } catch (error) {
    console.warn('Structured diagram generation failed, generating deterministic fallback:', error);
    const fallbackCode = createSafeFallbackDiagram(options.title || systemDescription.slice(0, 40));
    return {
      code: fallbackCode,
      valid: true,
    };
  }
}

