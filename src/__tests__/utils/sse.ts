import { EventSource, ErrorEvent as EventSourceErrorEvent } from 'eventsource';
import z from 'zod';

export const processedSchema = z.object({
  processed_id: z.string(),
});

export const sseResponseSchema = z
  .object({
    isSuccess: z.literal(true),
    llmRequestId: z.string(),
    kind: z.literal('cast/value'),
    data: z.unknown(),
    isCacheHit: z.boolean().optional(),
  })
  .passthrough();

export const waitForSuccessfulSseMessage = async (sseUrl: string, timeoutMs = 30000) => {
  const eventSource = new EventSource(sseUrl);

  return await new Promise<Record<string, unknown>>((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timeoutId);
      eventSource.removeEventListener('message', handleMessage);
      eventSource.removeEventListener('error', handleError);
      eventSource.close();
    };

    const handleMessage = (event: MessageEvent<string>) => {
      const rawData = event.data;
      if (typeof rawData !== 'string' || rawData.length === 0) return;

      let parsed: unknown;
      try {
        parsed = JSON.parse(rawData);
      } catch (e) {
        cleanup();
        reject(e instanceof Error ? e : new Error('Unable to parse SSE payload'));
        return;
      }

      if (!parsed || typeof parsed !== 'object') return;

      const payload = parsed as Record<string, unknown>;
      if (payload['isError'] === true) {
        cleanup();
        const message =
          typeof payload['error'] === 'string'
            ? payload['error']
            : 'SSE stream returned an error payload';
        reject(new Error(message));
        return;
      }

      if (payload['isSuccess'] === true) {
        cleanup();
        resolve(payload);
      }
    };

    const handleError = (event: EventSourceErrorEvent) => {
      cleanup();
      const message =
        (event && typeof event.message === 'string' && event.message.length > 0
          ? event.message
          : event.type) || 'unknown error';
      reject(new Error(`SSE stream error: ${message}`));
    };

    const timeoutId = setTimeout(() => {
      cleanup();
      reject(new Error('Timed out while waiting for SSE result'));
    }, timeoutMs);

    eventSource.addEventListener('message', handleMessage);
    eventSource.addEventListener('error', handleError);
  });
};
