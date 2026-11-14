/**
 * Predefined Mermaid Template Library
 * Standard, production-grade structural templates for common educational & architectural patterns.
 */

import {
  FlowchartIR,
  SequenceIR,
  ClassIR,
  ErIR,
  StateIR,
  MindmapIR,
} from './types';
import { compileDiagramIR } from './compiler';

export const MermaidTemplates = {
  /**
   * System Architecture (Client - Gateway - Microservices - Database)
   */
  systemArchitecture(title = 'System Architecture'): FlowchartIR {
    return {
      diagramType: 'flowchart',
      direction: 'TB',
      title,
      nodes: [
        { id: 'client_ui', label: 'Web / Mobile Client', shape: 'rounded', type: 'client' },
        { id: 'cdn', label: 'CDN / Edge Cache', shape: 'stadium', type: 'cache' },
        { id: 'api_gw', label: 'API Gateway & Auth', shape: 'rectangle', type: 'service' },
        { id: 'core_svc', label: 'Core Application Service', shape: 'rectangle', type: 'service' },
        { id: 'worker_svc', label: 'Async Background Worker', shape: 'subroutine', type: 'process' },
        { id: 'msg_queue', label: 'Message Queue / PubSub', shape: 'hexagon', type: 'queue' },
        { id: 'primary_db', label: 'Primary Relational Database', shape: 'cylinder', type: 'database' },
        { id: 'redis_cache', label: 'In-Memory Cache (Redis)', shape: 'cylinder', type: 'cache' },
      ],
      edges: [
        { from: 'client_ui', to: 'cdn', label: 'Static Assets' },
        { from: 'client_ui', to: 'api_gw', label: 'REST / GraphQL' },
        { from: 'api_gw', to: 'core_svc', label: 'Validated Requests' },
        { from: 'core_svc', to: 'redis_cache', label: 'Cache Lookup' },
        { from: 'core_svc', to: 'primary_db', label: 'Read / Write' },
        { from: 'core_svc', to: 'msg_queue', label: 'Publish Event' },
        { from: 'msg_queue', to: 'worker_svc', label: 'Consume Job' },
        { from: 'worker_svc', to: 'primary_db', label: 'Persist Results' },
      ],
      subgraphs: [
        {
          id: 'sg_backend',
          title: 'Backend Services Tier',
          nodeIds: ['core_svc', 'worker_svc', 'msg_queue'],
        },
        {
          id: 'sg_data',
          title: 'Data & Persistence Tier',
          nodeIds: ['primary_db', 'redis_cache'],
        },
      ],
    };
  },

  /**
   * Request / Response Sequence Flow
   */
  authSequence(title = 'Authentication & API Workflow'): SequenceIR {
    return {
      diagramType: 'sequence',
      title,
      autonumber: true,
      participants: [
        { id: 'user', label: 'User Client', type: 'actor' },
        { id: 'gateway', label: 'API Gateway', type: 'participant' },
        { id: 'auth_srv', label: 'Auth Service', type: 'participant' },
        { id: 'db', label: 'User Vault (DB)', type: 'participant' },
      ],
      messages: [
        { from: 'user', to: 'gateway', label: 'POST /auth/login (Credentials)', type: 'solid_arrow' },
        { from: 'gateway', to: 'auth_srv', label: 'Verify Credentials', type: 'solid_arrow', activate: true },
        { from: 'auth_srv', to: 'db', label: 'Query User Record & Hash', type: 'solid_arrow' },
        { from: 'db', to: 'auth_srv', label: 'User Record + Salt', type: 'dotted_arrow' },
        { from: 'auth_srv', to: 'gateway', label: 'JWT Access & Refresh Token', type: 'dotted_arrow', deactivate: true },
        { from: 'gateway', to: 'user', label: '200 OK (Set-Cookie / Token)', type: 'dotted_arrow' },
      ],
      notes: [
        { over: ['auth_srv'], text: 'Bcrypt Hash Verification', position: 'over' },
      ],
    };
  },

  /**
   * Concept Mindmap
   */
  conceptMindmap(rootTitle: string, branches: Array<{ title: string; subtopics: string[] }>): MindmapIR {
    return {
      diagramType: 'mindmap',
      root: {
        label: rootTitle,
        shape: 'circle',
        children: branches.map(b => ({
          label: b.title,
          shape: 'default',
          children: b.subtopics.map(st => ({
            label: st,
            shape: 'default',
          })),
        })),
      },
    };
  },

  /**
   * State Machine Workflow
   */
  pipelineStateFlow(title = 'Pipeline Processing Lifecycle'): StateIR {
    return {
      diagramType: 'state',
      title,
      initialState: 'Idle',
      states: [
        { id: 'Idle', description: 'Awaiting user input or video URL' },
        { id: 'Extracting', description: 'Fetching captions and timeline markers' },
        { id: 'Indexing', description: 'Generating structured curriculum outline' },
        { id: 'Review', description: 'Awaiting human outline approval' },
        { id: 'Generating', description: 'Synthesizing comprehensive notes & diagrams' },
        { id: 'Complete', description: 'Archived to local SQLite vault' },
      ],
      transitions: [
        { from: 'Idle', to: 'Extracting', event: 'Submit URL' },
        { from: 'Extracting', to: 'Indexing', event: 'Transcripts Loaded' },
        { from: 'Indexing', to: 'Review', event: 'Outline Ready' },
        { from: 'Review', to: 'Generating', event: 'User Approves' },
        { from: 'Generating', to: 'Complete', event: 'All Notes Synthesized' },
      ],
      terminalStates: ['Complete'],
    };
  },

  /**
   * Quick string compiler for a template
   */
  render(templateName: 'systemArchitecture' | 'authSequence' | 'pipelineStateFlow'): string {
    switch (templateName) {
      case 'systemArchitecture':
        return compileDiagramIR(this.systemArchitecture());
      case 'authSequence':
        return compileDiagramIR(this.authSequence());
      case 'pipelineStateFlow':
        return compileDiagramIR(this.pipelineStateFlow());
    }
  },
};
