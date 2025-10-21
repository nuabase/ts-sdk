import { NuabaseAPIClient, NuabaseConfig } from '../lib/api-client';
import { createArrayFn } from './array/factory';
import { validateArrayRequestParams } from './array/request-validation';
import { ArrayFn, ArrayFnDef } from './array/types';
import { z } from 'zod';

export class Nua {
  apiClient: NuabaseAPIClient;

  constructor(config?: NuabaseConfig) {
    this.apiClient = new NuabaseAPIClient(config);
  }

  static validateArrayRequestParams(data: unknown, primaryKeyName: unknown) {
    validateArrayRequestParams(data, primaryKeyName);
  }

  createArrayFn<OutputName extends string, OutputZodSchema extends z.ZodTypeAny>(
    fnDef: ArrayFnDef<OutputName, OutputZodSchema>
  ): ArrayFn<OutputZodSchema, OutputName> {
    return createArrayFn(this.apiClient, fnDef);
  }
}
