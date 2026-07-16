import type { Tool } from '../_providers/types';
import { agentMaterials, readableAgentFileIds } from '../_generated/agent-materials';

export const readFileTool: Tool = {
  type: 'function',
  function: {
    name: 'read_file',
    description: 'Read one whitelisted resume or project material file. If the question needs multiple files, call this tool multiple times in the same assistant turn instead of defaulting to one file per round.',
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

export function getAgentFilePublicName(file: string): string {
  if (file === 'resume.json') return '候选人简历';

  const content = agentMaterials[file as keyof typeof agentMaterials];
  if (!content) return '候选人资料';

  if (file.endsWith('/index.md')) {
    const name = content.match(/^name:\s*(.+)$/m)?.[1]?.trim();
    return name ? `${name} 项目正文` : '项目正文';
  }

  const heading = content.match(/^#\s+(.+)$/m)?.[1]?.trim();
  return heading || '项目补充资料';
}
