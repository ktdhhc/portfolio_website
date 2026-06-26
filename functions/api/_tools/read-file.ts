import type { Tool } from '../_providers/types';
import { agentMaterials, readableAgentFileIds } from '../_generated/agent-materials';

export const readFileTool: Tool = {
  type: 'function',
  function: {
    name: 'read_file',
    description: 'Read one whitelisted resume or project material file.',
    parameters: {
      type: 'object',
      properties: {
        file: { type: 'string', description: 'Whitelisted file id.' },
      },
      required: ['file'],
      additionalProperties: false,
    },
  },
};

export function readAgentFile(file: string): string {
  if (!readableAgentFileIds.includes(file as (typeof readableAgentFileIds)[number])) {
    throw new Error(`File is not available to Candidate Agent: ${file}`);
  }
  const content = agentMaterials[file as keyof typeof agentMaterials];
  if (!content) {
    throw new Error(`Agent material is missing: ${file}`);
  }
  return content;
}
