/**
 * Mermaid Diagram Generation Skill for ytvideo2notes AI Engine
 */

export const MERMAID_SKILL_PROMPT = `
MERMAID DIAGRAM GENERATION GUIDELINES:
When including Mermaid diagrams (\`\`\`mermaid ... \`\`\`), follow these strict rules to ensure 100% renderability:

1. CHART TYPES:
   - Use 'flowchart TD' or 'flowchart LR' for architecture, data flow, and user journeys.
   - Use 'sequenceDiagram' for API request/response cycles and protocol handshakes.
   - Use 'erDiagram' for database models and schema relationships.
   - Use 'classDiagram' for object-oriented systems.

2. NODE IDENTIFIERS & LABELS:
   - Node IDs MUST be simple alphanumeric identifiers without spaces, hyphens, or dots (e.g. use 'client_app', 'api_gateway', 'dbPrimary').
   - ALWAYS wrap node label text in double quotes if it contains spaces, parentheses, slashes, or special characters.
     Correct: nodeA["Client Application (React/Vite)"] --> nodeB["API Gateway (/v1/notes)"]
     Incorrect: nodeA[Client Application (React/Vite)] --> nodeB[API Gateway (/v1/notes)]

3. CONNECTIONS & ARROWS:
   - Flowchart standard arrow: -->
   - Flowchart labeled arrow: -->|"HTTPS Request"|
   - Sequence diagram message: ParticipantA->>ParticipantB: Request

4. LINE BREAKS:
   - Use HTML <br/> for multi-line labels inside quotes: nodeA["Step 1<br/>Validate Payload"]

5. SUBGRAPHS:
   - Ensure every 'subgraph Name' block has a matching 'end' statement.
`;
