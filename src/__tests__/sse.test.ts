import { Nua } from '../nua';
import { processedSchema, sseResponseSchema, waitForSuccessfulSseMessage } from './utils/sse';

describe('sse streaming', () => {
  test('queued SSE request resolves to expected processed payload', async () => {
    const nua = new Nua();

    const echoQueuedId = nua.createFn({
      prompt:
        'You will receive a UUID. Respond only with JSON that matches the schema. Use the provided UUID verbatim in the processed_id field.',
      output: {
        name: 'processed',
        schema: processedSchema,
      },
    });

    // We'll use a stable value so this hits the cache rather than go thru an LLM everytime.
    // For cache busting actual LLM calls, we'll do separate tests.
    const originalId = 'eyJ0eXAiOiJKV1QiLC';
    const queuedResult = await echoQueuedId(originalId);

    if ('isError' in queuedResult) {
      throw new Error(`Error enqueuing SSE request: ${queuedResult.error}`);
    }

    const streamedPayload = await waitForSuccessfulSseMessage(queuedResult.sseUrl);
    const parsedStream = sseResponseSchema.parse(streamedPayload);

    expect(parsedStream.llmRequestId).toBe(queuedResult.id);

    const processed = processedSchema.parse(parsedStream.data);
    expect(processed.processed_id).toBe(originalId);
  }, 3000);
});
