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

    const response = await extractAddressFromFreeformText.now(inputData);

    if (response.isError) throw new Error(`error in api response: ${response.error}`);
    expect(response).toBeTruthy();
  });
});
