import type { AgentConfigResponse } from './admin-dashboard-shared';

type RuntimeKey = 'provider' | 'model' | 'temperature' | 'effort' | 'toolLoopCap';

const runtimeLabels: Record<RuntimeKey, string> = {
  provider: 'Provider',
  model: 'Model',
  temperature: 'Temperature',
  effort: 'Effort',
  toolLoopCap: 'Tool Loop Cap',
};

function formatRuntimeValue(key: RuntimeKey, value: string | number | null): string {
  if (value === null || value === undefined) return '—';
  if (key === 'toolLoopCap') return `${value} 轮`;
  return String(value);
}

export function renderAgentConfig(data: AgentConfigResponse & { ok: true }): void {
  const grid = document.querySelector<HTMLElement>('[data-agent-config-grid]');
  const unavailable = document.querySelector<HTMLElement>('[data-module="agent-config"] [data-module-unavailable]');
  if (!grid || !unavailable) return;

  unavailable.hidden = true;
  grid.hidden = false;

  // Runtime
  const runtimeList = grid.querySelector<HTMLElement>('[data-runtime-list]');
  if (runtimeList) {
    runtimeList.replaceChildren(
      ...(['provider', 'model', 'temperature', 'effort', 'toolLoopCap'] as const).map((key) => {
        const row = document.createElement('div');
        row.className = 'snapshot-item';
        const k = document.createElement('div');
        k.className = 'snapshot-key';
        k.textContent = runtimeLabels[key];
        const v = document.createElement('div');
        v.className = 'snapshot-value';
        const val = data.data.runtime[key];
        v.innerHTML = `<strong>${formatRuntimeValue(key, val)}</strong>`;
        row.append(k, v);
        return row;
      }),
    );
  }

  // Startup context
  const startupList = grid.querySelector<HTMLElement>('[data-startup-list]');
  if (startupList) {
    const contextBlock = document.createElement('div');
    contextBlock.className = 'snapshot-block';
    const contextTop = document.createElement('div');
    contextTop.className = 'snapshot-block-top';
    const contextTitle = document.createElement('div');
    contextTitle.className = 'snapshot-block-title';
    contextTitle.textContent = 'startup context';
    const contextPills = document.createElement('div');
    contextPills.className = 'snapshot-pills';
    const contextNames = ['system prompt', 'answer rules', 'profile 摘要', '可读文件索引', '项目文件目录'];
    for (const name of contextNames) {
      const pill = document.createElement('span');
      pill.className = 'snapshot-pill context-name';
      pill.textContent = name;
      contextPills.appendChild(pill);
    }
    contextTop.appendChild(contextTitle);
    contextBlock.append(contextTop, contextPills);

    const filesBlock = document.createElement('div');
    filesBlock.className = 'snapshot-block';
    const filesTop = document.createElement('div');
    filesTop.className = 'snapshot-block-top';
    const filesToggle = document.createElement('button');
    filesToggle.type = 'button';
    filesToggle.className = 'snapshot-block-toggle';
    filesToggle.textContent = `可读文件索引（${data.data.startupContext.files.length} 个）`;
    filesToggle.setAttribute('aria-expanded', 'false');
    const filesPills = document.createElement('div');
    filesPills.className = 'snapshot-pills';
    filesPills.style.display = 'none';
    for (const file of data.data.startupContext.files) {
      const pill = document.createElement('span');
      pill.className = 'snapshot-pill';
      pill.textContent = file;
      filesPills.appendChild(pill);
    }
    filesToggle.addEventListener('click', () => {
      const isOpen = filesPills.style.display === 'none';
      filesPills.style.display = isOpen ? 'flex' : 'none';
      filesToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });
    filesTop.appendChild(filesToggle);
    filesBlock.append(filesTop, filesPills);

    const toolsBlock = document.createElement('div');
    toolsBlock.className = 'snapshot-block';
    const toolsTop = document.createElement('div');
    toolsTop.className = 'snapshot-block-top';
    const toolsTitle = document.createElement('div');
    toolsTitle.className = 'snapshot-block-title';
    toolsTitle.textContent = 'tools';
    const toolsPills = document.createElement('div');
    toolsPills.className = 'snapshot-pills';
    for (const tool of data.data.tools) {
      const pill = document.createElement('span');
      pill.className = 'snapshot-pill';
      pill.textContent = tool;
      toolsPills.appendChild(pill);
    }
    toolsTop.appendChild(toolsTitle);
    toolsBlock.append(toolsTop, toolsPills);

    startupList.replaceChildren(contextBlock, filesBlock, toolsBlock);
  }
}

export function renderAgentConfigUnavailable(): void {
  const grid = document.querySelector<HTMLElement>('[data-agent-config-grid]');
  const unavailable = document.querySelector<HTMLElement>('[data-module="agent-config"] [data-module-unavailable]');
  if (grid) grid.hidden = true;
  if (unavailable) {
    unavailable.hidden = false;
    unavailable.textContent = '暂不可用';
  }
}
