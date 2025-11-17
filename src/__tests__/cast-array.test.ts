import { Nua } from '../nua';
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

    const result = response.data;
    expect(Array.isArray(result)).toBe(true);
    if (!Array.isArray(result)) return;

    expect(result).toHaveLength(3);

    result.forEach((entry, index) => {
      expect(Object.keys(entry).sort()).toEqual(['foodItem', 'id', 'sourceRow']);

      const parsedFoodItem = FoodItemSchema.safeParse(entry.foodItem);
      expect(parsedFoodItem.success).toBe(true);

      if (parsedFoodItem.success) {
        expect(parsedFoodItem.data.food_name).toBe(inputData[index].name);
      }
    });
  });

  test('usage field validation in success response', async () => {
    // Expected usage: {"promptTokens": 384, "completionTokens": 148, "totalTokens": 532}
    const nua = new Nua();

    const NumberSchema = z.number();

    const returnDoubleValue = nua.createArrayFn({
      prompt: 'Return double the value of the input number',
      output: {
        name: 'doubled',
        schema: NumberSchema,
      },
    });

    const inputData = [
      { id: 1, value: 5 },
      { id: 2, value: 10 },
    ];

    const response = await returnDoubleValue.now(inputData, 'id');

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
    expect(response.usage.totalTokens).toBeLessThanOrEqual(700);
    expect(response.usage.totalTokens).toBe(
      response.usage.promptTokens + response.usage.completionTokens
    );
  });
});
