import { resolveConfigValue } from './env';
import { NuabaseError, parseErrorResponse } from './error-response';
import { getErrorMessageFromException } from './error-utils';

export type NuabaseConfig = {
  apiKey?: string;
  baseUrl?: string;
};

export class NuabaseAPIClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(config: NuabaseConfig = {}) {
    this.apiKey = resolveConfigValue(config, 'apiKey', 'NUABASE_API_KEY') || '';
    this.baseUrl =
      resolveConfigValue(config, 'baseUrl', 'NUABASE_API_URL') || 'https://api.nuabase.com';

    if (!this.apiKey) {
      throw new Error(
        'API key is required. Provide it via config.apiKey or NUABASE_API_KEY environment variable.'
      );
    }
  }

  async request(
    method: 'GET' | 'POST',
    urlPath: string,
    params?: object
  ): Promise<NuabaseError | unknown> {
    const url = `${this.baseUrl}/${urlPath}`;

    let response: Response;

    const hasBody = method !== 'GET' && params !== undefined;

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
    };

    if (hasBody) {
      headers['Content-Type'] = 'application/json';
    }

    try {
      response = await fetch(url, {
        method,
        headers,
        body: hasBody ? JSON.stringify(params) : undefined,
      });
    } catch (e) {
      return { error: `Error calling Nuabase API: ${getErrorMessageFromException(e)}` };
    }

    let result: unknown;

    if (!response.ok) {
      return await parseErrorResponse(response, urlPath);
    }

    try {
      result = await response.json();
    } catch {
      return { error: 'Invalid response received from Nuabase API call, unable to parse' };
    }

    return result;
  }
}
