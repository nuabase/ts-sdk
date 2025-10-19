export type NuabaseError = {
  error: string;
  isError: true;
  isSuccess?: false;
};

export async function parseErrorResponse(
  response: Response,
  urlPath: string
): Promise<NuabaseError> {
  const fallbackMessage = `Request to ${urlPath} failed with status ${response.status}${
    response.statusText ? ` ${response.statusText}` : ''
  }`;

  let responseBody = '';

  try {
    responseBody = (await response.text()).trim();
  } catch {
    return { error: fallbackMessage, isError: true };
  }

  if (!responseBody) {
    return { error: fallbackMessage, isError: true };
  }

  const parsedBody = safeParseJson(responseBody);

  if (parsedBody && typeof parsedBody === 'object') {
    const errorMessage = extractErrorMessage(parsedBody as Record<string, unknown>);
    if (errorMessage) {
      return { error: errorMessage, isError: true };
    }
  }

  return { error: responseBody, isError: true };
}

function safeParseJson(payload: string): undefined | unknown {
  try {
    return JSON.parse(payload);
  } catch {
    return undefined;
  }
}

function extractErrorMessage(body: Record<string, unknown>): string | undefined {
  const e = body['error'];
  if (e && typeof e === 'string') return e;
  return undefined;
}
