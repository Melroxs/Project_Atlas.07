/**
 * Tool registry.
 *
 * The voice package defines the registry + execution contract. The host app
 * registers its own tools (implemented against its existing APIs) so no
 * business logic is duplicated here.
 */

import type { ToolContext, ToolDefinition, ToolResult } from "./types";

export class ToolRegistry {
  private tools = new Map<string, ToolDefinition>();

  register(def: ToolDefinition): void {
    this.tools.set(def.id, def);
  }

  registerAll(defs: ToolDefinition[]): void {
    for (const def of defs) this.register(def);
  }

  has(id: string): boolean {
    return this.tools.has(id);
  }

  list(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  async run(
    id: string,
    args: Record<string, unknown>,
    ctx: ToolContext
  ): Promise<ToolResult> {
    const tool = this.tools.get(id);
    if (!tool) {
      return {
        ok: false,
        text: `I don't have a tool for that yet (${id}). Try asking the AI directly.`,
        error: `Unknown tool: ${id}`,
      };
    }
    try {
      return await tool.run(args, ctx);
    } catch (error) {
      return {
        ok: false,
        text: `That action failed: ${
          error instanceof Error ? error.message : String(error)
        }. I've kept the conversation going so we can retry.`,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
