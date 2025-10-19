/**
 * A TypeScript type guard to check if a value is an object
 * with a string 'message' property.
 */
function isErrorWithMessage(error: unknown): error is { message: string } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as any).message === 'string'
  );
}

/**
 * Safely extracts an error message from an unknown value.
 * @param error The unknown value caught in a catch block.
 * @returns A string representing the error message.
 */
export function getErrorMessageFromException(error: unknown): string {
  if (isErrorWithMessage(error)) {
    // Thanks to the type guard, TypeScript knows `error` has a `message` property.
    return error.message;
  }
  // If it's not an error-like object, stringify the whole thing.
  return String(error);
}
