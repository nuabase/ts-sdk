export function resolveConfigValue<T extends Record<string, any>>(
  config: T,
  key: keyof T,
  envVar: string
): string | undefined {
  // 1. Explicit config wins
  if (config[key]) return config[key];

  // 2. Node env fallback
  const pe = (globalThis as any).process;
  const isNode = !!pe?.versions?.node;
  if (isNode) {
    return pe?.env?.[envVar];
  }

  // 3. Browser: no implicit values
  return undefined;
}
