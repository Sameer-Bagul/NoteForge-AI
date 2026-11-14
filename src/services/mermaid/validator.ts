/**
 * Mermaid Syntax and Semantic Validator
 * Uses official Mermaid.js parser for grammar verification + custom AST-like semantic checks.
 */

import mermaid from 'mermaid';
import { ValidationResult } from './types';

let isMermaidInitialized = false;

export function initMermaidValidator() {
  if (!isMermaidInitialized) {
    try {
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        suppressErrorRendering: true,
      });
      isMermaidInitialized = true;
    } catch (e) {
      console.warn('Failed to initialize mermaid parser:', e);
    }
  }
}

/**
 * Validates Mermaid diagram code using official parser and semantic rules.
 */
export async function validateMermaid(code: string): Promise<ValidationResult> {
  const cleanCode = (code || '').trim();
  if (!cleanCode) {
    return {
      valid: false,
      error: 'Empty diagram code provided.',
    };
  }

  initMermaidValidator();

  // Layer 1: Technical Grammar Validation via official mermaid.parse
  try {
    const parseResult = await mermaid.parse(cleanCode);
    const diagramType = (parseResult as any)?.diagramType || detectDiagramType(cleanCode);

    // Layer 2: Semantic Checks
    const semanticWarnings: string[] = [];

    // Check for unbalanced subgraphs in flowcharts
    if (diagramType.includes('flowchart') || diagramType.includes('graph')) {
      const subgraphCount = (cleanCode.match(/\bsubgraph\b/g) || []).length;
      const endCount = (cleanCode.match(/\bend\b/g) || []).length;
      if (subgraphCount !== endCount) {
        return {
          valid: false,
          error: `Unbalanced subgraphs: found ${subgraphCount} 'subgraph' statements but ${endCount} 'end' statements.`,
        };
      }

      // Check if flowchart has any connections
      const hasConnection = /(-->|---|==>|-\.->|--)/.test(cleanCode);
      if (!hasConnection && !cleanCode.includes('subgraph')) {
        semanticWarnings.push('Flowchart has no connected edges.');
      }
    }

    return {
      valid: true,
      error: null,
      diagramType,
      semanticWarnings: semanticWarnings.length > 0 ? semanticWarnings : undefined,
    };
  } catch (error: any) {
    const errMsg = error instanceof Error ? error.message : String(error);
    return {
      valid: false,
      error: cleanErrorMessage(errMsg),
      diagramType: detectDiagramType(cleanCode),
    };
  }
}

/**
 * Detects diagram type from source text header.
 */
export function detectDiagramType(code: string): string {
  const firstLines = code.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('%%') && !l.startsWith('---'));
  const header = (firstLines[0] || '').toLowerCase();

  if (header.startsWith('flowchart') || header.startsWith('graph')) return 'flowchart';
  if (header.startsWith('sequencediagram')) return 'sequence';
  if (header.startsWith('classdiagram')) return 'class';
  if (header.startsWith('erdiagram')) return 'er';
  if (header.startsWith('statediagram')) return 'state';
  if (header.startsWith('gantt')) return 'gantt';
  if (header.startsWith('mindmap')) return 'mindmap';
  if (header.startsWith('gitgraph')) return 'gitGraph';
  if (header.startsWith('pie')) return 'pie';
  return 'unknown';
}

/**
 * Simplifies and cleans technical lexer/parser error messages for presentation and repair prompts.
 */
function cleanErrorMessage(msg: string): string {
  // Strip stack traces or internal hash tokens if present
  let clean = msg.replace(/at .*?\(.*?\)/g, '').trim();
  if (clean.length > 400) {
    clean = clean.slice(0, 400) + '...';
  }
  return clean;
}
