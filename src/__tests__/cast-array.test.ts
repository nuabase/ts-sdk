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
      expect(Object.keys(entry).sort()).toEqual(['foodItem', 'id']);

      const parsedFoodItem = FoodItemSchema.safeParse(entry.foodItem);
      expect(parsedFoodItem.success).toBe(true);

      if (parsedFoodItem.success) {
        expect(parsedFoodItem.data.food_name).toBe(inputData[index].name);
      }
    });
  });
});
