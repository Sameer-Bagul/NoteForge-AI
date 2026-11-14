import { describe, it, expect } from 'vitest';
import { repairMermaidDeterministic, createSafeFallbackDiagram } from '../repair';
import { validateMermaid } from '../validator';

describe('Mermaid Deterministic Repair', () => {
  it('repairs unquoted parentheses inside flowchart node labels', async () => {
    // This is the #1 syntax error LLMs produce
    const brokenCode = `flowchart TD
  client[React Frontend (Vite)] --> server[Node.js API (Express)]
  server --> db[(PostgreSQL (Primary DB))]`;

    const initialCheck = await validateMermaid(brokenCode);
    expect(initialCheck.valid).toBe(false);

    const repaired = repairMermaidDeterministic(brokenCode);
    const postCheck = await validateMermaid(repaired);

    expect(postCheck.valid).toBe(true);
    expect(repaired).toContain('client["React Frontend (Vite)"]');
    expect(repaired).toContain('server["Node.js API (Express)"]');
  });

  it('repairs invalid edge arrow syntax', async () => {
    // LLMs often write invalid single-dash A -> B instead of A --> B in flowcharts
    const brokenCode = `flowchart LR
  client -> server
  server -> db`;

    const initialCheck = await validateMermaid(brokenCode);
    expect(initialCheck.valid).toBe(false);

    const repaired = repairMermaidDeterministic(brokenCode);
    const postCheck = await validateMermaid(repaired);

    expect(postCheck.valid).toBe(true);
    expect(repaired).toContain('client --> server');
    expect(repaired).toContain('server --> db');
  });

  it('repairs unclosed subgraphs', async () => {
    const brokenCode = `flowchart TD
  subgraph Backend Tier
    api["API Gateway"]
    db[("Main Database")]
  client["Web Browser"] --> api`;

    const initialCheck = await validateMermaid(brokenCode);
    expect(initialCheck.valid).toBe(false);

    const repaired = repairMermaidDeterministic(brokenCode);
    const postCheck = await validateMermaid(repaired);

    expect(postCheck.valid).toBe(true);
    expect(repaired).toContain('end');
  });

  it('strips ChatGPT markdown fences, CSS selectors and scripts', async () => {
    const messyCode = `\`\`\`mermaid
#chatgpt-mermaid-_r_29t_{font-family:sans-serif;}
flowchart TD
  A["Start"] --> B["End"]
\`\`\``;

    const repaired = repairMermaidDeterministic(messyCode);
    const postCheck = await validateMermaid(repaired);

    expect(postCheck.valid).toBe(true);
    expect(repaired).not.toContain('```');
    expect(repaired).not.toContain('#chatgpt-mermaid');
  });

  it('provides a guaranteed-valid fallback diagram', async () => {
    const fallback = createSafeFallbackDiagram('Microservices Architecture');
    const check = await validateMermaid(fallback);

    expect(check.valid).toBe(true);
    expect(fallback).toContain('title: "Microservices Architecture"');
  });
});
