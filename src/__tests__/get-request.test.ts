import { Nua } from '../nua';
import z from 'zod';

describe('get request', () => {
  test('returns 200 for completed request', async () => {
    const nua = new Nua();

    const GreetingSchema = z.object({
      greeting: z.string(),
    });

    const greetingFn = nua.createFn({
      prompt: 'Respond with a JSON object that greets the provided name.',
      output: {
        name: 'greetingResponse',
        schema: GreetingSchema,
      },
    });

    const result = await greetingFn.now('Test user');

    if (result.isError) {
      throw new Error(`Unexpected error from cast/value now: ${result.error}`);
    }

    const requestId = result.llmRequestId;
    expect(typeof requestId).toBe('string');

    const requestDetails = await nua.getRequest(requestId);

    console.log('Nuabase getResponse result', requestDetails);

    if ('isError' in requestDetails && requestDetails.isError) {
      throw new Error(`Nuabase API returned error: ${requestDetails.error}`);
    }

    if ('kind' in requestDetails && requestDetails.kind === 'internal-error') {
      throw new Error(`Unable to parse request payload: ${requestDetails.message}`);
    }

    if (!('id' in requestDetails)) {
      throw new Error('getResponse did not return request metadata');
    }

    expect(requestDetails.id).toBe(requestId);
    expect(requestDetails.llmStatus).toBe('success');
    expect(requestDetails.output.name).toBe('greetingResponse');
  }, 10000);
});
