/**
 * Mermaid Diagram Intermediate Representation (IR) Types
 * Strict, type-safe structures for deterministic diagram generation.
 */

export type FlowchartDirection = 'TB' | 'TD' | 'BT' | 'LR' | 'RL';

export type NodeShape =
  | 'rectangle'    // [label]
  | 'rounded'      // (label)
  | 'stadium'      // ([label])
  | 'subroutine'   // [[label]]
  | 'cylinder'     // [(label)]
  | 'circle'       // ((label))
  | 'diamond'      // {label}
  | 'hexagon';     // {{label}}

export interface FlowchartNode {
  id: string;
  label: string;
  shape?: NodeShape;
  type?: 'service' | 'database' | 'client' | 'queue' | 'cache' | 'process' | 'external';
}

export interface FlowchartEdge {
  from: string;
  to: string;
  label?: string;
  style?: 'solid' | 'dotted' | 'thick';
  hasArrow?: boolean;
}

export interface FlowchartSubgraph {
  id: string;
  title: string;
  nodeIds: string[];
}

export interface FlowchartIR {
  diagramType: 'flowchart';
  direction?: FlowchartDirection;
  title?: string;
  nodes: FlowchartNode[];
  edges: FlowchartEdge[];
  subgraphs?: FlowchartSubgraph[];
}

export interface SequenceParticipant {
  id: string;
  label: string;
  type?: 'participant' | 'actor';
}

export interface SequenceMessage {
  from: string;
  to: string;
  label: string;
  type?: 'solid_arrow' | 'dotted_arrow' | 'solid' | 'dotted' | 'async';
  activate?: boolean;
  deactivate?: boolean;
}

export interface SequenceNote {
  over: string[];
  text: string;
  position?: 'left' | 'right' | 'over';
}

export interface SequenceIR {
  diagramType: 'sequence';
  title?: string;
  autonumber?: boolean;
  participants: SequenceParticipant[];
  messages: SequenceMessage[];
  notes?: SequenceNote[];
}

export interface ClassAttribute {
  visibility?: '+' | '-' | '#' | '~';
  name: string;
  type: string;
}

export interface ClassMethod {
  visibility?: '+' | '-' | '#' | '~';
  name: string;
  returnType?: string;
  params?: string;
}

export interface ClassEntity {
  name: string;
  attributes?: string[];
  methods?: string[];
}

export interface ClassRelation {
  from: string;
  to: string;
  type: 'inheritance' | 'composition' | 'aggregation' | 'association' | 'dependency';
  label?: string;
}

export interface ClassIR {
  diagramType: 'class';
  title?: string;
  classes: ClassEntity[];
  relations?: ClassRelation[];
}

export interface ErAttribute {
  name: string;
  type: string;
  isKey?: boolean;
  isForeignKey?: boolean;
  comment?: string;
}

export interface ErEntity {
  name: string;
  attributes: ErAttribute[];
}

export interface ErRelationship {
  from: string;
  to: string;
  cardinality: '1-to-1' | '1-to-many' | 'many-to-1' | 'many-to-many' | 'zero-or-one-to-many';
  label?: string;
}

export interface ErIR {
  diagramType: 'er';
  title?: string;
  entities: ErEntity[];
  relationships: ErRelationship[];
}

export interface StateTransition {
  from: string;
  to: string;
  event?: string;
}

export interface StateNode {
  id: string;
  label?: string;
  description?: string;
}

export interface StateIR {
  diagramType: 'state';
  title?: string;
  initialState?: string;
  states?: StateNode[];
  transitions: StateTransition[];
  terminalStates?: string[];
}

export interface GanttTask {
  id?: string;
  name: string;
  status?: 'done' | 'active' | 'crit' | '';
  start: string;
  endOrDuration: string;
}

export interface GanttSection {
  name: string;
  tasks: GanttTask[];
}

export interface GanttIR {
  diagramType: 'gantt';
  title: string;
  dateFormat?: string;
  sections: GanttSection[];
}

export interface MindmapNode {
  id?: string;
  label: string;
  shape?: 'circle' | 'cloud' | 'bang' | 'default';
  children?: MindmapNode[];
}

export interface MindmapIR {
  diagramType: 'mindmap';
  root: MindmapNode;
}

export type DiagramIR =
  | FlowchartIR
  | SequenceIR
  | ClassIR
  | ErIR
  | StateIR
  | GanttIR
  | MindmapIR;

export interface ValidationResult {
  valid: boolean;
  error: string | null;
  diagramType?: string;
  semanticWarnings?: string[];
}

export interface RepairResult {
  repairedCode: string;
  wasRepaired: boolean;
  valid: boolean;
  attempts: number;
  error?: string | null;
}
