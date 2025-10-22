import { NuabaseAPIClient, NuabaseConfig } from '../lib/api-client';
import { createArrayFn } from './cast_array/factory';
import { ArrayFn, ArrayFnDef } from './cast_array/types';
import { createValueFn } from './cast_value/factory';
import { ValueFn, ValueFnDef } from './cast_value/types';
import { z } from 'zod';

export class Nua {
  apiClient: NuabaseAPIClient;

  constructor(config?: NuabaseConfig) {
    this.apiClient = new NuabaseAPIClient(config);
  }

  createArrayFn<OutputName extends string, OutputZodSchema extends z.ZodTypeAny>(
    fnDef: ArrayFnDef<OutputName, OutputZodSchema>
  ): ArrayFn<OutputZodSchema, OutputName> {
    return createArrayFn(this.apiClient, fnDef);
  }

  createFn<OutputName extends string, OutputZodSchema extends z.ZodTypeAny>(
    fnDef: ValueFnDef<OutputName, OutputZodSchema>
  ): ValueFn<OutputZodSchema, OutputName> {
    return createValueFn(this.apiClient, fnDef);
  }
}
