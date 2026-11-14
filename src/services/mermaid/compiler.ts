/**
 * Deterministic Mermaid Compiler
 * Translates structured Diagram IR into syntactically perfect, escaped Mermaid code.
 */

import {
  DiagramIR,
  FlowchartIR,
  SequenceIR,
  ClassIR,
  ErIR,
  StateIR,
  GanttIR,
  MindmapIR,
  MindmapNode,
  NodeShape,
} from './types';

/**
 * Sanitizes an ID string into a strict alphanumeric + underscore identifier.
 * Ensures the identifier starts with a letter and contains no whitespace or special characters.
 */
export function sanitizeId(rawId: string, prefix = 'n'): string {
  if (!rawId || typeof rawId !== 'string') return `${prefix}_${Math.random().toString(36).substring(2, 7)}`;
  let clean = rawId.trim().replace(/[^a-zA-Z0-9_]/g, '_');
  if (/^[0-9]/.test(clean)) {
    clean = `${prefix}_${clean}`;
  }
  if (!clean || clean === '_') {
    clean = `${prefix}_${Math.random().toString(36).substring(2, 7)}`;
  }
  return clean;
}

/**
 * Escapes label text to prevent syntax breakage in Mermaid.
 * Double quotes are escaped or normalized to single quotes.
 * Angle brackets, parentheses, and brackets are preserved safely inside quotes.
 */
export function escapeLabel(label: string): string {
  if (!label) return '';
  return label
    .trim()
    .replace(/\r?\n/g, '<br/>')
    .replace(/"/g, "'"); // replace double quotes with single quotes to avoid breaking outer quotes
}

/**
 * Wraps node label into shape delimiters with strict double quoting.
 */
export function formatNodeShape(id: string, label: string, shape: NodeShape = 'rectangle'): string {
  const safeLabel = escapeLabel(label);
  switch (shape) {
    case 'rounded':
      return `${id}("${safeLabel}")`;
    case 'stadium':
      return `${id}(["${safeLabel}"])`;
    case 'subroutine':
      return `${id}[["${safeLabel}"]]`;
    case 'cylinder':
      return `${id}[("${safeLabel}")]`;
    case 'circle':
      return `${id}(("${safeLabel}"))`;
    case 'diamond':
      return `${id}{"${safeLabel}"}`;
    case 'hexagon':
      return `${id}{{"${safeLabel}"}}`;
    case 'rectangle':
    default:
      return `${id}["${safeLabel}"]`;
  }
}

/**
 * Compiles a Flowchart IR into valid Mermaid syntax.
 */
export function compileFlowchart(ir: FlowchartIR): string {
  const lines: string[] = [];

  if (ir.title) {
    lines.push('---');
    lines.push(`title: "${ir.title.replace(/"/g, "'")}"`);
    lines.push('---');
  }

  const direction = ir.direction || 'TB';
  lines.push(`flowchart ${direction}`);

  const idMap = new Map<string, string>();
  for (const node of ir.nodes) {
    idMap.set(node.id, sanitizeId(node.id));
  }

  // Handle subgraphs
  const nodesInSubgraphs = new Set<string>();
  if (ir.subgraphs && ir.subgraphs.length > 0) {
    for (const sg of ir.subgraphs) {
      const sgId = sanitizeId(sg.id, 'sg');
      const sgTitle = escapeLabel(sg.title);
      lines.push(`  subgraph ${sgId} ["${sgTitle}"]`);
      for (const nid of sg.nodeIds) {
        const node = ir.nodes.find(n => n.id === nid);
        if (node) {
          const safeId = idMap.get(node.id)!;
          const nodeStr = formatNodeShape(safeId, node.label, node.shape);
          lines.push(`    ${nodeStr}`);
          nodesInSubgraphs.add(node.id);
        }
      }
      lines.push('  end');
    }
  }

  // Standalone nodes
  for (const node of ir.nodes) {
    if (!nodesInSubgraphs.has(node.id)) {
      const safeId = idMap.get(node.id)!;
      const nodeStr = formatNodeShape(safeId, node.label, node.shape);
      lines.push(`  ${nodeStr}`);
    }
  }

  // Edges
  for (const edge of ir.edges) {
    const fromId = idMap.get(edge.from) || sanitizeId(edge.from);
    const toId = idMap.get(edge.to) || sanitizeId(edge.to);

    let connector = '-->';
    if (edge.style === 'dotted') connector = '-.->';
    else if (edge.style === 'thick') connector = '==>';

    if (edge.hasArrow === false) {
      if (edge.style === 'dotted') connector = '-.-';
      else if (edge.style === 'thick') connector = '===';
      else connector = '---';
    }

    if (edge.label && edge.label.trim()) {
      const safeEdgeLabel = escapeLabel(edge.label);
      lines.push(`  ${fromId} ${connector}|"${safeEdgeLabel}"| ${toId}`);
    } else {
      lines.push(`  ${fromId} ${connector} ${toId}`);
    }
  }

  return lines.join('\n');
}

/**
 * Compiles a Sequence Diagram IR into valid Mermaid syntax.
 */
export function compileSequence(ir: SequenceIR): string {
  const lines: string[] = ['sequenceDiagram'];

  if (ir.autonumber !== false) {
    lines.push('  autonumber');
  }

  const idMap = new Map<string, string>();
  for (const p of ir.participants) {
    const safeId = sanitizeId(p.id, 'p');
    idMap.set(p.id, safeId);
    const pType = p.type === 'actor' ? 'actor' : 'participant';
    lines.push(`  ${pType} ${safeId} as ${escapeLabel(p.label)}`);
  }

  // Notes and messages in sequence
  for (const msg of ir.messages) {
    const fromId = idMap.get(msg.from) || sanitizeId(msg.from, 'p');
    const toId = idMap.get(msg.to) || sanitizeId(msg.to, 'p');

    let arrow = '->>';
    switch (msg.type) {
      case 'dotted_arrow':
        arrow = '-->>';
        break;
      case 'solid':
        arrow = '->';
        break;
      case 'dotted':
        arrow = '-->';
        break;
      case 'async':
        arrow = '-)';
        break;
      case 'solid_arrow':
      default:
        arrow = '->>';
        break;
    }

    const safeLabel = escapeLabel(msg.label);
    lines.push(`  ${fromId}${arrow}${toId}: ${safeLabel}`);

    if (msg.activate) {
      lines.push(`  activate ${toId}`);
    }
    if (msg.deactivate) {
      lines.push(`  deactivate ${fromId}`);
    }
  }

  if (ir.notes) {
    for (const note of ir.notes) {
      const targets = note.over.map(id => idMap.get(id) || sanitizeId(id, 'p')).join(',');
      const pos = note.position === 'left' ? 'left of' : note.position === 'right' ? 'right of' : 'over';
      lines.push(`  Note ${pos} ${targets}: ${escapeLabel(note.text)}`);
    }
  }

  return lines.join('\n');
}

/**
 * Compiles a Class Diagram IR into valid Mermaid syntax.
 */
export function compileClass(ir: ClassIR): string {
  const lines: string[] = ['classDiagram'];

  for (const cls of ir.classes) {
    const safeName = sanitizeId(cls.name, 'Class');
    lines.push(`  class ${safeName} {`);
    if (cls.attributes) {
      for (const attr of cls.attributes) {
        lines.push(`    ${attr.trim()}`);
      }
    }
    if (cls.methods) {
      for (const m of cls.methods) {
        lines.push(`    ${m.trim()}`);
      }
    }
    lines.push('  }');
  }

  if (ir.relations) {
    for (const rel of ir.relations) {
      const from = sanitizeId(rel.from, 'Class');
      const to = sanitizeId(rel.to, 'Class');
      let arrow = '-->';
      switch (rel.type) {
        case 'inheritance':
          arrow = '<|--';
          break;
        case 'composition':
          arrow = '*--';
          break;
        case 'aggregation':
          arrow = 'o--';
          break;
        case 'dependency':
          arrow = '<..';
          break;
        case 'association':
        default:
          arrow = '-->';
          break;
      }
      if (rel.label) {
        lines.push(`  ${from} ${arrow} ${to} : ${escapeLabel(rel.label)}`);
      } else {
        lines.push(`  ${from} ${arrow} ${to}`);
      }
    }
  }

  return lines.join('\n');
}

/**
 * Compiles an ER Diagram IR into valid Mermaid syntax.
 */
export function compileER(ir: ErIR): string {
  const lines: string[] = ['erDiagram'];

  for (const ent of ir.entities) {
    const safeName = sanitizeId(ent.name, 'Entity').toUpperCase();
    lines.push(`  ${safeName} {`);
    for (const attr of ent.attributes) {
      const type = sanitizeId(attr.type, 'type');
      const name = sanitizeId(attr.name, 'attr');
      const key = attr.isKey ? 'PK' : attr.isForeignKey ? 'FK' : '';
      const comment = attr.comment ? `"${escapeLabel(attr.comment)}"` : '';
      lines.push(`    ${type} ${name} ${key} ${comment}`.trimEnd());
    }
    lines.push('  }');
  }

  for (const rel of ir.relationships) {
    const from = sanitizeId(rel.from, 'Entity').toUpperCase();
    const to = sanitizeId(rel.to, 'Entity').toUpperCase();
    let card = '||--o{';
    switch (rel.cardinality) {
      case '1-to-1':
        card = '||--||';
        break;
      case '1-to-many':
        card = '||--o{';
        break;
      case 'many-to-1':
        card = '}o--||';
        break;
      case 'many-to-many':
        card = '}o--o{';
        break;
      case 'zero-or-one-to-many':
        card = '|o--o{';
        break;
    }
    const label = rel.label ? `"${escapeLabel(rel.label)}"` : '"relates"';
    lines.push(`  ${from} ${card} ${to} : ${label}`);
  }

  return lines.join('\n');
}

/**
 * Compiles a State Diagram IR into valid Mermaid syntax.
 */
export function compileState(ir: StateIR): string {
  const lines: string[] = ['stateDiagram-v2'];

  if (ir.initialState) {
    const initial = sanitizeId(ir.initialState, 's');
    lines.push(`  [*] --> ${initial}`);
  }

  if (ir.states) {
    for (const st of ir.states) {
      const sid = sanitizeId(st.id, 's');
      if (st.description) {
        lines.push(`  ${sid} : ${escapeLabel(st.description)}`);
      }
    }
  }

  for (const trans of ir.transitions) {
    const from = trans.from === '[*]' ? '[*]' : sanitizeId(trans.from, 's');
    const to = trans.to === '[*]' ? '[*]' : sanitizeId(trans.to, 's');
    if (trans.event) {
      lines.push(`  ${from} --> ${to}: ${escapeLabel(trans.event)}`);
    } else {
      lines.push(`  ${from} --> ${to}`);
    }
  }

  if (ir.terminalStates) {
    for (const term of ir.terminalStates) {
      lines.push(`  ${sanitizeId(term, 's')} --> [*]`);
    }
  }

  return lines.join('\n');
}

/**
 * Compiles a Gantt Diagram IR into valid Mermaid syntax.
 */
export function compileGantt(ir: GanttIR): string {
  const lines: string[] = ['gantt'];
  lines.push(`  title ${escapeLabel(ir.title)}`);
  lines.push(`  dateFormat ${ir.dateFormat || 'YYYY-MM-DD'}`);

  for (const sec of ir.sections) {
    lines.push(`  section ${escapeLabel(sec.name)}`);
    for (const task of sec.tasks) {
      const status = task.status ? `${task.status}, ` : '';
      const idPart = task.id ? `${sanitizeId(task.id)}, ` : '';
      lines.push(`    ${escapeLabel(task.name)} : ${status}${idPart}${task.start}, ${task.endOrDuration}`);
    }
  }

  return lines.join('\n');
}

/**
 * Recursively compiles Mindmap nodes with strict 2-space indentation.
 */
function compileMindmapNodes(node: MindmapNode, depth: number): string[] {
  const indent = '  '.repeat(depth);
  const safeLabel = escapeLabel(node.label);
  let formatted = safeLabel;

  if (node.shape === 'circle') {
    formatted = `(("${safeLabel}"))`;
  } else if (node.shape === 'cloud') {
    formatted = `)("${safeLabel}")`;
  } else if (node.shape === 'bang') {
    formatted = `))"${safeLabel}"((`;
  } else {
    formatted = `["${safeLabel}"]`;
  }

  const lines = [`${indent}${formatted}`];
  if (node.children) {
    for (const child of node.children) {
      lines.push(...compileMindmapNodes(child, depth + 1));
    }
  }
  return lines;
}

/**
 * Compiles a Mindmap IR into valid Mermaid syntax.
 */
export function compileMindmap(ir: MindmapIR): string {
  const lines: string[] = ['mindmap'];
  lines.push(...compileMindmapNodes(ir.root, 1));
  return lines.join('\n');
}

/**
 * Master compiler dispatcher: compiles any supported DiagramIR to valid Mermaid code.
 */
export function compileDiagramIR(ir: DiagramIR): string {
  switch (ir.diagramType) {
    case 'flowchart':
      return compileFlowchart(ir);
    case 'sequence':
      return compileSequence(ir);
    case 'class':
      return compileClass(ir);
    case 'er':
      return compileER(ir);
    case 'state':
      return compileState(ir);
    case 'gantt':
      return compileGantt(ir);
    case 'mindmap':
      return compileMindmap(ir);
    default:
      throw new Error(`Unsupported diagram type: ${(ir as any)?.diagramType}`);
  }
}

