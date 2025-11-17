import { Nua } from '../nua';
import z from 'zod';

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

    const response = await extractAddressFromFreeformText(inputData);

    if (response.isError) throw new Error(`error in api response: ${response.error}`);
    expect(response).toBeTruthy();
  });

  test('usage field validation in success response', async () => {
    // Expected usage: {"promptTokens": 224, "completionTokens": 54, "totalTokens": 278}
    const nua = new Nua();

    const NumberSchema = z.number();

    const returnTheNumberTen = nua.createFn({
      prompt: 'Return the number 10',
      output: {
        name: 'result',
        schema: NumberSchema,
      },
    });

    const response = await returnTheNumberTen(null);

    if (response.isError) throw new Error(`error in api response: ${response.error}`);

    expect(response.isSuccess).toBe(true);
    expect(response.usage).toBeDefined();

    /*
    Depending on the LLM, these values vary widely, so we cast a wide net.
    The numbers have to be essentially non-zero and fall inside a big enough bucket.
    */
    expect(response.usage.promptTokens).toBeGreaterThanOrEqual(30);
    expect(response.usage.promptTokens).toBeLessThanOrEqual(500);
    expect(response.usage.completionTokens).toBeGreaterThanOrEqual(30);
    expect(response.usage.completionTokens).toBeLessThanOrEqual(500);
    expect(response.usage.totalTokens).toBeGreaterThanOrEqual(30);
    expect(response.usage.totalTokens).toBeLessThanOrEqual(500);
    expect(response.usage.totalTokens).toBe(
      response.usage.promptTokens + response.usage.completionTokens
    );
  });
});
