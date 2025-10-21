export const validateArrayRequestParams = (data: unknown, primaryKeyName: unknown) => {
  if (!Array.isArray(data)) {
    throw new Error('`data` must be an array of objects.');
  }

  if (!primaryKeyName || typeof primaryKeyName !== 'string') {
    throw new Error('`primaryKeyName` must be a non-empty string.');
  }

  data.forEach((item, index) => {
    if (item === null || typeof item !== 'object' || Array.isArray(item)) {
      throw new Error(`data[${index}] must be a non-null object.`);
    }

    if (!(primaryKeyName in item)) {
      throw new Error(`data[${index}] must contain property '${primaryKeyName}'.`);
    }
  });
};
