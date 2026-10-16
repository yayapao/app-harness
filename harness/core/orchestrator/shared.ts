import type {
  HarnessTool,
  ModelToolMetadata,
  HarnessModelTool,
} from '../types';
import type { HarnessRegistry } from '../registry';

export interface PendingToolCall {
  id: string;
  name: string;
  arguments: string;
}

export function buildModelToolDefinitions(
  tools: HarnessTool[],
  metadata: Record<string, ModelToolMetadata>,
): HarnessModelTool[] {
  return tools.map((tool) => {
    const override = metadata[tool.name];
    return {
      name: tool.name,
      description: (override?.description || tool.description) + (tool.cacheTtlMs ? ' [cached]' : ''),
      parameters: {
        ...tool.parameters,
        properties: Object.fromEntries(Object.entries(tool.parameters.properties).map(([key, property]) => [
          key, { ...property, description: override?.parameterDescriptions?.[key] || property.description },
        ])),
      },
    };
  });
}

export function buildSystemPrompt(registry: HarnessRegistry, contextBlocks: string[], instructions = ''): string {
  const lines: string[] = [];
  lines.push('Use registered tools for facts. Do not invent tool results. Follow tool permissions and confirmation requests.');
  if (instructions) lines.push(instructions);
  lines.push('');

  const skillPrompt = registry.buildSystemPrompt();
  if (skillPrompt) {
    lines.push('技能指令:');
    lines.push(skillPrompt);
  }

  if (contextBlocks.length > 0) {
    lines.push('当前上下文:');
    for (const block of contextBlocks) {
      lines.push(block);
    }
    lines.push('');
  }

  return lines.join('\n');
}

export function summarizeResult(result: unknown): string {
  if (result === null || result === undefined) return 'null';
  if (typeof result === 'string') return result.slice(0, 200);
  if (typeof result === 'object') {
    const str = JSON.stringify(result);
    return str.length > 200 ? str.slice(0, 200) + '...' : str;
  }
  return String(result).slice(0, 200);
}
