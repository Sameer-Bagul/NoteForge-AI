import { describe, it, expect } from 'vitest';
import { sanitizeMarkdownMermaidBlocks } from '../pipeline';
import { validateMermaid } from '../validator';

describe('Mermaid Markdown Pipeline', () => {
  it('detects and fixes broken Mermaid blocks inside Markdown study notes', async () => {
    const rawNote = `
# System Design Note

Here is the architectural overview of the service:

\`\`\`mermaid
flowchart TD
  client[React Frontend (Vite)] --> server[Node.js API (Express)]
  server -- "SQL Query" --> db[(PostgreSQL (Primary))]
\`\`\`

## Key Takeaways
- The client communicates over HTTPS.
- The database is relational.
`;

    const sanitized = await sanitizeMarkdownMermaidBlocks(rawNote, {
      topicTitle: 'System Design Overview',
      useAiRepair: false,
    });

    expect(sanitized).toContain('# System Design Note');
    expect(sanitized).toContain('## Key Takeaways');

    // Extract the repaired mermaid code
    const match = sanitized.match(/```mermaid([\s\S]*?)```/);
    expect(match).not.toBeNull();

    const repairedCode = match![1].trim();
    const check = await validateMermaid(repairedCode);

    expect(check.valid).toBe(true);
    expect(repairedCode).toContain('client["React Frontend (Vite)"]');
  });

  it('leaves clean markdown without mermaid blocks untouched', async () => {
    const plainMarkdown = `
# Just Plain Notes
- Concept 1
- Concept 2
`;
    const result = await sanitizeMarkdownMermaidBlocks(plainMarkdown);
    expect(result).toBe(plainMarkdown);
  });
});

