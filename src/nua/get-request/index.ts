import { NuabaseAPIClient } from '../../lib/api-client';
import { NuabaseError } from '../../lib/error-response';
import { ApiResponseLlmRequest, NuaInternalError } from './types';
import { z } from 'zod';

const errorParseFailed: NuaInternalError = {
  kind: 'internal-error',
  message: 'Unable to parse stored LLM result',
};

const dateFromIso = z.preprocess(
  (value) => {
    if (value == null) return null;
    if (value instanceof Date) return value;
    if (typeof value === 'string') {
      const parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
    return z.NEVER;
  },
  z.union([z.date(), z.null()])
);

const mandatoryDateFromIso = z.preprocess((value) => {
  if (value instanceof Date) return value;
  if (typeof value === 'string') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return z.NEVER;
}, z.date());

const apiResponseSchema: z.ZodType<ApiResponseLlmRequest> = z.object({
  id: z.string(),
  requestType: z.string(),
  llmStatus: z.union([
    z.literal('pending'),
    z.literal('processing'),
    z.literal('success'),
    z.literal('failed'),
  ]),
  sseStatus: z.union([
    z.literal('n/a'),
    z.literal('pending'),
    z.literal('sent'),
    z.literal('failed'),
  ]),
  webhookStatus: z.union([
    z.literal('n/a'),
    z.literal('pending'),
    z.literal('sent'),
    z.literal('failed'),
  ]),
  input: z.object({
    prompt: z.union([z.string(), z.null()]),
    data: z.union([z.string(), z.null()]),
    primaryKey: z.union([z.string(), z.null()]),
  }),
  output: z.object({
    name: z.string(),
    schema: z.string(),
    effectiveSchema: z.string(),
  }),
  result: z.union([z.record(z.string(), z.unknown()), z.null()]).optional(),
  error: z.union([z.string(), z.null()]),
  fullPrompt: z.string(),
  model: z.string(),
  provider: z.string(),
  startedAt: dateFromIso,
  finishedAt: dateFromIso,
  createdAt: mandatoryDateFromIso,
  updatedAt: mandatoryDateFromIso,
});

const isNuabaseError = (value: unknown): value is NuabaseError =>
  Boolean(value && typeof value === 'object' && 'isError' in value && value.isError);

export type GetRequestResult = ApiResponseLlmRequest | NuaInternalError | NuabaseError;

export async function getRequest(
  client: NuabaseAPIClient,
  llmRequestId: string
): Promise<GetRequestResult> {
  const response = await client.request('GET', `requests/${encodeURIComponent(llmRequestId)}`);

  if (isNuabaseError(response)) {
    return response;
  }

  const parsedResponse = apiResponseSchema.safeParse(response);
  if (!parsedResponse.success) {
    return errorParseFailed;
  }

  return parsedResponse.data;
}

export type {
  ApiResponseLlmRequest,
  LlmRequestStatus,
  NuaInternalError,
  SseRequestStatus,
  WebhookRequestStatus,
} from './types';
