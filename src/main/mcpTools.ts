import type { Repository } from './db/repository';
import { createPetTools, runPetTool, type PetTool, type ToolBridge } from './petTools';

// The app's tools (main/petTools.ts) in the shape the MCP server registers.

export type { TimerCommand } from './petTools';
export type McpBridge = ToolBridge;

type ToolResult = { content: { type: 'text'; text: string }[]; isError?: boolean };

export const mcpToolsFrom = (tools: PetTool[]) =>
  Object.fromEntries(tools.map((tool) => [tool.name, {
    description: tool.description,
    inputSchema: tool.schema,
    handler: async (input?: unknown): Promise<ToolResult> => {
      const { ok, text } = await runPetTool(tool, input);
      return ok ? { content: [{ type: 'text', text }] } : { content: [{ type: 'text', text }], isError: true };
    }
  }])) as Record<string, { description: string; inputSchema: PetTool['schema']; handler: (input?: any) => Promise<ToolResult> }>;

export const createMcpTools = (repo: Repository, bridge: McpBridge) => mcpToolsFrom(createPetTools(repo, bridge));

export type McpTools = ReturnType<typeof createMcpTools>;
