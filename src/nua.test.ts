import { randomUUID } from 'node:crypto';
import { Nua } from './nua';
import { EventSource, ErrorEvent as EventSourceErrorEvent } from 'eventsource';
import z from 'zod';

const processedSchema = z.object({
  processed_id: z.string(),
});

const sseResponseSchema = z
  .object({
    isSuccess: z.literal(true),
    llmRequestId: z.string(),
    kind: z.literal('cast/value'),
    data: z.unknown(),
    isCacheHit: z.boolean().optional(),
  })
  .passthrough();

const waitForSuccessfulSseMessage = async (sseUrl: string, timeoutMs = 30000) => {
  const eventSource = new EventSource(sseUrl);

  return await new Promise<Record<string, unknown>>((resolve, reject) => {
    const handleMessage = (event: MessageEvent<string>) => {
      const rawData = event.data;
      if (typeof rawData !== 'string' || rawData.length === 0) return;

      let parsed: unknown;
      try {
        parsed = JSON.parse(rawData);
      } catch (e) {
        reject(e instanceof Error ? e : new Error('Unable to parse SSE payload'));
        cleanup();
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

    const cleanup = () => {
      clearTimeout(timeoutId);
      eventSource.removeEventListener('message', handleMessage);
      eventSource.removeEventListener('error', handleError);
      eventSource.close();
    };

    const timeoutId = setTimeout(() => {
      cleanup();
      reject(new Error('Timed out while waiting for SSE result'));
    }, timeoutMs);

    eventSource.addEventListener('message', handleMessage);
    eventSource.addEventListener('error', handleError);
  });
};

describe('cast/array', () => {
  test('basic response shape validation', async () => {
    const nua = new Nua();

    const FoodItemSchema = z.object({
      food_name: z.string(),
      quantity: z.number(),
      quantity_unit: z.string(),
      calories_per_unit: z.number(),
    });

    const enrichCalories = nua.createArrayFn({
      prompt:
        'Add calories_per_single_unit with the number of calories for each food item, for 1 unit of its qty',
      output: {
        name: 'foodItem',
        schema: FoodItemSchema,
      },
    });

    const inputData = [
      { id: 1, name: 'Biriyani' },
      { id: 2, name: 'Pizza slice' },
      { id: 3, name: 'Chapati' },
    ];

    const response = await enrichCalories.now(inputData, 'id');

    if (response.isError) throw new Error(`error in api response: ${response.error}`);

    /*
     * - result should be an array with two entries, and each should have two properties only -- `id` and `foodItem`.
     * - the `foodItem` in each element must be a FoodItemSchema (use appropriate Zod method to validate it)
     * - the `food_name` in the output element should match the ones in inputData, in order.
     */
    const result = response.data;
    expect(Array.isArray(result)).toBe(true);
    if (!Array.isArray(result)) return;

    expect(result).toHaveLength(3);

    result.forEach((entry, index) => {
      expect(Object.keys(entry).sort()).toEqual(['foodItem', 'id']);

      const parsedFoodItem = FoodItemSchema.safeParse(entry.foodItem);
      expect(parsedFoodItem.success).toBe(true);

      if (parsedFoodItem.success) {
        expect(parsedFoodItem.data.food_name).toBe(inputData[index].name);
      }
    });
  });
});

describe('cast/value', () => {
  test('basic response shape validation', async () => {
    const nua = new Nua();

    const AddressSchema = z.object({
      addressLine1: z.string().min(1, 'Address line 1 cannot be empty.'),
      addressLine2: z.string().optional(),
      city: z.string().min(1, 'City cannot be empty.'),
      region: z.string().optional(),
      postalCode: z.string().optional(),
      country: z
        .string()
        .length(2, 'Country must be a 2-letter ISO code.')
        .regex(/^[A-Z]{2}$/, 'Country must be a 2-letter uppercase ISO code.'),
    });

    const extractAddressFromFreeformText = nua.createFn({
      prompt: 'Map the given text into the address schema',
      output: {
        name: 'address',
        schema: AddressSchema,
      },
    });

    const inputData = `Unit 14
88 Lorikeet Lane
Chatswood NSW 2067
Australia`;

    const response = await extractAddressFromFreeformText.now(inputData);

    if (response.isError) throw new Error(`error in api response: ${response.error}`);
    console.log(JSON.stringify(response, null, 2), 'JSON.stringify(response, null, 2)');
    expect(response).toBeTruthy();
  });
});

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

    const originalId = randomUUID();
    const queuedResult = await echoQueuedId(originalId);

    if ('isError' in queuedResult) {
      throw new Error(`Error enqueuing SSE request: ${queuedResult.error}`);
    }

    const streamedPayload = await waitForSuccessfulSseMessage(queuedResult.sseUrl);
    const parsedStream = sseResponseSchema.parse(streamedPayload);

    expect(parsedStream.llmRequestId).toBe(queuedResult.id);

    const processed = processedSchema.parse(parsedStream.data);
    expect(processed.processed_id).toBe(originalId);
  }, 8000);
});
