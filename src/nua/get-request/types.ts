export type LlmRequestType = string;

export type LlmRequestStatus = 'pending' | 'processing' | 'success' | 'failed';
export type SseRequestStatus = 'n/a' | 'pending' | 'sent' | 'failed';
export type WebhookRequestStatus = 'n/a' | 'pending' | 'sent' | 'failed';

export type NuaInternalError = {
  kind: 'internal-error';
  message: string;
};

export type ApiResponseLlmRequest = {
  id: string;
  requestType: LlmRequestType;
  llmStatus: LlmRequestStatus;
  sseStatus: SseRequestStatus;
  webhookStatus: WebhookRequestStatus;
  input: {
    prompt: string | null;
    data: string | null;
    primaryKey: string | null;
  };
  output: {
    name: string;
    schema: string;
    effectiveSchema: string;
  };
  result?: Record<string, unknown> | null;
  error: string | null;
  fullPrompt: string;
  model: string;
  provider: string;
  startedAt: Date | null;
  finishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};
