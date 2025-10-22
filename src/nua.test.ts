import { Nua } from './nua';
import z from 'zod';

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
