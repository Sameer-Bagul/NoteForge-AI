import { z } from 'zod';

export const FlowchartDirectionSchema = z.enum(['TB', 'TD', 'BT', 'LR', 'RL']).default('TB');

export const NodeShapeSchema = z.enum([
  'rectangle',
  'rounded',
  'stadium',
  'subroutine',
  'cylinder',
  'circle',
  'diamond',
  'hexagon',
]).default('rectangle');

export const FlowchartNodeSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  shape: NodeShapeSchema.optional(),
  type: z.enum(['service', 'database', 'client', 'queue', 'cache', 'process', 'external']).optional(),
});

export const FlowchartEdgeSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  label: z.string().optional(),
  style: z.enum(['solid', 'dotted', 'thick']).default('solid'),
  hasArrow: z.boolean().default(true),
});

export const FlowchartSubgraphSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  nodeIds: z.array(z.string()),
});

export const FlowchartIRSchema = z.object({
  diagramType: z.literal('flowchart'),
  direction: FlowchartDirectionSchema.optional(),
  title: z.string().optional(),
  nodes: z.array(FlowchartNodeSchema).min(1),
  edges: z.array(FlowchartEdgeSchema),
  subgraphs: z.array(FlowchartSubgraphSchema).optional(),
});

export const SequenceParticipantSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(['participant', 'actor']).default('participant'),
});

export const SequenceMessageSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  label: z.string(),
  type: z.enum(['solid_arrow', 'dotted_arrow', 'solid', 'dotted', 'async']).default('solid_arrow'),
  activate: z.boolean().optional(),
  deactivate: z.boolean().optional(),
});

export const SequenceNoteSchema = z.object({
  over: z.array(z.string()).min(1),
  text: z.string(),
  position: z.enum(['left', 'right', 'over']).default('over'),
});

export const SequenceIRSchema = z.object({
  diagramType: z.literal('sequence'),
  title: z.string().optional(),
  autonumber: z.boolean().default(true),
  participants: z.array(SequenceParticipantSchema).min(1),
  messages: z.array(SequenceMessageSchema),
  notes: z.array(SequenceNoteSchema).optional(),
});

export const ClassEntitySchema = z.object({
  name: z.string().min(1),
  attributes: z.array(z.string()).optional(),
  methods: z.array(z.string()).optional(),
});

export const ClassRelationSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  type: z.enum(['inheritance', 'composition', 'aggregation', 'association', 'dependency']).default('association'),
  label: z.string().optional(),
});

export const ClassIRSchema = z.object({
  diagramType: z.literal('class'),
  title: z.string().optional(),
  classes: z.array(ClassEntitySchema).min(1),
  relations: z.array(ClassRelationSchema).optional(),
});

export const ErAttributeSchema = z.object({
  name: z.string().min(1),
  type: z.string().min(1),
  isKey: z.boolean().optional(),
  isForeignKey: z.boolean().optional(),
  comment: z.string().optional(),
});

export const ErEntitySchema = z.object({
  name: z.string().min(1),
  attributes: z.array(ErAttributeSchema),
});

export const ErRelationshipSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  cardinality: z.enum(['1-to-1', '1-to-many', 'many-to-1', 'many-to-many', 'zero-or-one-to-many']).default('1-to-many'),
  label: z.string().optional(),
});

export const ErIRSchema = z.object({
  diagramType: z.literal('er'),
  title: z.string().optional(),
  entities: z.array(ErEntitySchema).min(1),
  relationships: z.array(ErRelationshipSchema),
});

export const StateTransitionSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  event: z.string().optional(),
});

export const StateNodeSchema = z.object({
  id: z.string().min(1),
  label: z.string().optional(),
  description: z.string().optional(),
});

export const StateIRSchema = z.object({
  diagramType: z.literal('state'),
  title: z.string().optional(),
  initialState: z.string().optional(),
  states: z.array(StateNodeSchema).optional(),
  transitions: z.array(StateTransitionSchema).min(1),
  terminalStates: z.array(z.string()).optional(),
});

export const GanttTaskSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  status: z.enum(['done', 'active', 'crit', '']).default(''),
  start: z.string().min(1),
  endOrDuration: z.string().min(1),
});

export const GanttSectionSchema = z.object({
  name: z.string().min(1),
  tasks: z.array(GanttTaskSchema).min(1),
});

export const GanttIRSchema = z.object({
  diagramType: z.literal('gantt'),
  title: z.string().min(1),
  dateFormat: z.string().default('YYYY-MM-DD'),
  sections: z.array(GanttSectionSchema).min(1),
});

export interface MindmapNodeValidation {
  id?: string;
  label: string;
  shape?: 'circle' | 'cloud' | 'bang' | 'default';
  children?: MindmapNodeValidation[];
}

export const MindmapNodeSchema: z.ZodType<MindmapNodeValidation> = z.lazy(() =>
  z.object({
    id: z.string().optional(),
    label: z.string().min(1),
    shape: z.enum(['circle', 'cloud', 'bang', 'default']).default('default'),
    children: z.array(MindmapNodeSchema).optional(),
  })
);

export const MindmapIRSchema = z.object({
  diagramType: z.literal('mindmap'),
  root: MindmapNodeSchema,
});

export const DiagramIRSchema = z.discriminatedUnion('diagramType', [
  FlowchartIRSchema,
  SequenceIRSchema,
  ClassIRSchema,
  ErIRSchema,
  StateIRSchema,
  GanttIRSchema,
  MindmapIRSchema,
]);

