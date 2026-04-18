import type { Proposal } from "../core/types";

type ToolResult = {
  structuredContent?: {
    proposal?: Proposal;
    error?: string;
  };
  content?: Array<{ type: string; text?: string }>;
};

type OpenAIHost = {
  toolInput?: Record<string, unknown>;
  toolOutput?: {
    structuredContent?: {
      proposal?: Proposal;
      error?: string;
    };
  };
  callTool?: (name: string, args: Record<string, unknown>) => Promise<ToolResult>;
  setWidgetState?: (state: Record<string, unknown>) => Promise<void>;
};

declare global {
  interface Window {
    openai?: OpenAIHost;
  }
}

export {};
