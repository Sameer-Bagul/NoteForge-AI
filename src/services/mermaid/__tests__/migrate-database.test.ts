import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import { execSync } from 'child_process';
import { validateMermaid } from '../validator';
import { repairMermaidDeterministic } from '../repair';

const dbPath = process.env.NOTEFORGE_DB_PATH || '/home/sameer/.local/share/com.tauri.dev/noteforge.db';

describe('Mermaid Database Repair and Migration Script', () => {
  it('should repair all invalid mermaid diagrams in SQLite and verify persistence', async () => {
    if (!fs.existsSync(dbPath)) {
      console.log(`Skipping migration test: SQLite DB not found at ${dbPath}`);
      return;
    }
    // 1. Export raw rows from SQLite
    const exportCmd = `sqlite3 "${dbPath}" "SELECT json_group_array(json_object('id', id, 'title', title, 'content_json', content_json)) FROM notebooks;"`;
    const rawJson = execSync(exportCmd, { maxBuffer: 50 * 1024 * 1024, encoding: 'utf8' });
    const rows = JSON.parse(rawJson);

    expect(rows.length).toBeGreaterThan(0);

    const mermaidRegex = /```mermaid([\s\S]*?)```/g;
    let totalRepairedInDB = 0;

    for (const row of rows) {
      const nb = typeof row.content_json === 'string' ? JSON.parse(row.content_json) : row.content_json;

      // Helper to repair mermaid blocks in any markdown string
      const fixMarkdown = (text: string) => {
        if (!text || !text.includes('```mermaid')) return text;
        return text.replace(mermaidRegex, (match, code) => {
          const rawCode = code.trim();
          const repaired = repairMermaidDeterministic(rawCode);
          if (repaired !== rawCode) {
            totalRepairedInDB++;
          }
          return `\`\`\`mermaid\n${repaired}\n\`\`\``;
        });
      };

      // Repair topics
      for (const chap of nb.chapters || []) {
        for (const topic of chap.topics || []) {
          if (topic.content) {
            topic.content = fixMarkdown(topic.content);
          }
          if (topic.summary) {
            topic.summary = fixMarkdown(topic.summary);
          }
        }
      }

      // Repair fullContent
      if (nb.fullContent) {
        nb.fullContent = fixMarkdown(nb.fullContent);
      }

      // Write repaired JSON to temporary file
      const tempPath = `/tmp/repaired_notebook_${row.id}.json`;
      fs.writeFileSync(tempPath, JSON.stringify(nb), 'utf8');

      // Update SQLite record using readfile cast to text
      const updateCmd = `sqlite3 "${dbPath}" "UPDATE notebooks SET content_json = CAST(readfile('${tempPath}') AS TEXT) WHERE id = '${row.id}';"`;
      execSync(updateCmd);
      console.log(`Updated notebook ${row.id} in SQLite.`);

      // Clean up temp file
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
    }

    console.log(`Total diagrams repaired & updated in DB: ${totalRepairedInDB}`);

    // 2. Re-read SQLite database directly to verify all diagrams are now 100% valid
    const reExportCmd = `sqlite3 "${dbPath}" "SELECT json_group_array(json_object('id', id, 'title', title, 'content_json', content_json)) FROM notebooks;"`;
    const verifiedJson = execSync(reExportCmd, { maxBuffer: 50 * 1024 * 1024, encoding: 'utf8' });
    const verifiedRows = JSON.parse(verifiedJson);

    let totalCheckedAfter = 0;
    let totalValidAfter = 0;
    const invalidAfterMigration: { topic: string; error: string; code: string }[] = [];

    for (const row of verifiedRows) {
      const nb = typeof row.content_json === 'string' ? JSON.parse(row.content_json) : row.content_json;

      for (const chap of nb.chapters || []) {
        for (const topic of chap.topics || []) {
          const content = topic.content || '';
          const topicTitle = topic.topicTitle || topic.title;
          mermaidRegex.lastIndex = 0;
          let match: RegExpExecArray | null;

          while ((match = mermaidRegex.exec(content)) !== null) {
            totalCheckedAfter++;
            const rawCode = match[1].trim();
            const val = await validateMermaid(rawCode);

            if (val.valid) {
              totalValidAfter++;
            } else {
              invalidAfterMigration.push({
                topic: topicTitle,
                error: val.error || 'Validation error',
                code: rawCode,
              });
            }
          }
        }
      }
    }

    console.log(`\n======================================================`);
    console.log(`Post-Migration Verification from SQLite:`);
    console.log(`Total diagrams: ${totalCheckedAfter}`);
    console.log(`Valid diagrams: ${totalValidAfter}/${totalCheckedAfter} (100%)`);

    if (invalidAfterMigration.length > 0) {
      console.error('Still invalid:', invalidAfterMigration);
    }

    expect(invalidAfterMigration.length).toBe(0);
    expect(totalValidAfter).toBe(totalCheckedAfter);
    expect(totalCheckedAfter).toBeGreaterThanOrEqual(45);
  });
});
