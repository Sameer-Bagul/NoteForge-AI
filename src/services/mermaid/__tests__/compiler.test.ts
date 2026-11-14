import { describe, it, expect } from 'vitest';
import {
  compileFlowchart,
  compileSequence,
  compileClass,
  compileER,
  compileState,
  compileGantt,
  compileMindmap,
  compileDiagramIR,
  sanitizeId,
  escapeLabel,
} from '../compiler';
import { validateMermaid } from '../validator';

describe('Mermaid Compiler', () => {
  describe('Helper Functions', () => {
    it('sanitizes IDs safely', () => {
      expect(sanitizeId('client app')).toBe('client_app');
      expect(sanitizeId('123node')).toBe('n_123node');
      expect(sanitizeId('api:gw/v1')).toBe('api_gw_v1');
      expect(sanitizeId('valid_id_1')).toBe('valid_id_1');
    });

    it('escapes labels safely', () => {
      expect(escapeLabel('React (Frontend)')).toBe('React (Frontend)');
      expect(escapeLabel('Say "Hello"')).toBe("Say 'Hello'");
      expect(escapeLabel('Line 1\nLine 2')).toBe('Line 1<br/>Line 2');
    });
  });

  describe('Flowchart Compiler', () => {
    it('compiles valid flowchart with shapes, subgraphs, and edges', async () => {
      const code = compileFlowchart({
        diagramType: 'flowchart',
        direction: 'TD',
        title: 'Architecture Overview',
        nodes: [
          { id: 'client', label: 'React Client (Web & Mobile)', shape: 'rounded' },
          { id: 'api_gw', label: 'API Gateway', shape: 'rectangle' },
          { id: 'database', label: 'PostgreSQL (Primary Vault)', shape: 'cylinder' },
        ],
        edges: [
          { from: 'client', to: 'api_gw', label: 'HTTPS JSON' },
          { from: 'api_gw', to: 'database', label: 'SQL Connection', style: 'thick' },
        ],
        subgraphs: [
          { id: 'backend_tier', title: 'Internal Services', nodeIds: ['api_gw', 'database'] },
        ],
      });

      expect(code).toContain('flowchart TD');
      expect(code).toContain('subgraph backend_tier ["Internal Services"]');
      expect(code).toContain('client("React Client (Web & Mobile)")');
      expect(code).toContain('database[("PostgreSQL (Primary Vault)")]');
      expect(code).toContain('|"HTTPS JSON"|');

      const validation = await validateMermaid(code);
      expect(validation.valid).toBe(true);
      expect(validation.error).toBeNull();
    });
  });

  describe('Sequence Compiler', () => {
    it('compiles valid sequence diagram with participants and notes', async () => {
      const code = compileSequence({
        diagramType: 'sequence',
        title: 'Auth Flow',
        autonumber: true,
        participants: [
          { id: 'user', label: 'Browser Client', type: 'actor' },
          { id: 'api', label: 'Node API', type: 'participant' },
          { id: 'db', label: 'SQLite DB', type: 'participant' },
        ],
        messages: [
          { from: 'user', to: 'api', label: 'POST /login', type: 'solid_arrow', activate: true },
          { from: 'api', to: 'db', label: 'SELECT * FROM users', type: 'solid_arrow' },
          { from: 'db', to: 'api', label: 'User Record', type: 'dotted_arrow' },
          { from: 'api', to: 'user', label: 'JWT Token', type: 'dotted_arrow', deactivate: true },
        ],
        notes: [
          { over: ['api'], text: 'Token generation with secret key' },
        ],
      });

      expect(code).toContain('sequenceDiagram');
      expect(code).toContain('autonumber');
      expect(code).toContain('actor user as Browser Client');
      expect(code).toContain('user->>api: POST /login');
      expect(code).toContain('Note over api: Token generation with secret key');

      const validation = await validateMermaid(code);
      expect(validation.valid).toBe(true);
      expect(validation.error).toBeNull();
    });
  });

  describe('Class Diagram Compiler', () => {
    it('compiles valid class diagram with relations', async () => {
      const code = compileClass({
        diagramType: 'class',
        classes: [
          {
            name: 'User',
            attributes: ['+String id', '+String email'],
            methods: ['+authenticate(String password) bool'],
          },
          {
            name: 'Profile',
            attributes: ['+String displayName', '+String avatarUrl'],
          },
        ],
        relations: [
          { from: 'User', to: 'Profile', type: 'composition', label: 'has profile' },
        ],
      });

      expect(code).toContain('classDiagram');
      expect(code).toContain('class User {');
      expect(code).toContain('User *-- Profile : has profile');

      const validation = await validateMermaid(code);
      expect(validation.valid).toBe(true);
    });
  });

  describe('ER Diagram Compiler', () => {
    it('compiles valid ER diagram with entities and cardinalities', async () => {
      const code = compileER({
        diagramType: 'er',
        entities: [
          {
            name: 'USERS',
            attributes: [
              { name: 'id', type: 'string', isKey: true },
              { name: 'email', type: 'string' },
            ],
          },
          {
            name: 'NOTEBOOKS',
            attributes: [
              { name: 'id', type: 'string', isKey: true },
              { name: 'user_id', type: 'string', isForeignKey: true },
              { name: 'title', type: 'string' },
            ],
          },
        ],
        relationships: [
          { from: 'USERS', to: 'NOTEBOOKS', cardinality: '1-to-many', label: 'creates' },
        ],
      });

      expect(code).toContain('erDiagram');
      expect(code).toContain('USERS ||--o{ NOTEBOOKS : "creates"');

      const validation = await validateMermaid(code);
      expect(validation.valid).toBe(true);
    });
  });

  describe('State Diagram Compiler', () => {
    it('compiles valid state machine', async () => {
      const code = compileState({
        diagramType: 'state',
        initialState: 'Pending',
        states: [
          { id: 'Pending', description: 'Task queued' },
          { id: 'Running', description: 'In execution' },
          { id: 'Finished', description: 'Done' },
        ],
        transitions: [
          { from: 'Pending', to: 'Running', event: 'start' },
          { from: 'Running', to: 'Finished', event: 'success' },
        ],
        terminalStates: ['Finished'],
      });

      expect(code).toContain('stateDiagram-v2');
      expect(code).toContain('[*] --> Pending');
      expect(code).toContain('Finished --> [*]');

      const validation = await validateMermaid(code);
      expect(validation.valid).toBe(true);
    });
  });

  describe('Mindmap Compiler', () => {
    it('compiles valid mindmap with hierarchy', async () => {
      const code = compileMindmap({
        diagramType: 'mindmap',
        root: {
          label: 'AI Architecture',
          shape: 'circle',
          children: [
            {
              label: 'Frontend',
              children: [{ label: 'React' }, { label: 'Vite' }],
            },
            {
              label: 'Backend',
              children: [{ label: 'Tauri v2' }, { label: 'Rust Core' }],
            },
          ],
        },
      });

      expect(code).toContain('mindmap');
      expect(code).toContain('(("AI Architecture"))');
      expect(code).toContain('["React"]');

      const validation = await validateMermaid(code);
      expect(validation.valid).toBe(true);
    });
  });
});
