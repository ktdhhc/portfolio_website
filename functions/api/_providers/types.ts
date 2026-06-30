// Provider 抽象接口
// DeepSeek、MiMo、fake 三家实现同一接口，由 ACTIVE_PROVIDER 决定当前生效供应商。

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
}

export interface Tool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface ToolCall {
  id: string;
  function: { name: string; arguments: string };
}

export interface ChatRequest {
  messages: ChatMessage[];
  tools?: Tool[];
  temperature?: number;
  reasoningEffort?: 'high' | 'max';
  extraBody?: Readonly<Record<string, unknown>>;
}

export interface ChatResponse {
  content: string;
  tool_calls?: ToolCall[];
}

export interface Provider {
  chat(request: ChatRequest): Promise<ChatResponse>;
}
