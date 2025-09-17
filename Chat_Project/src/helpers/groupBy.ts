// helpers/groupBy.ts
export function groupBy<T, K extends string | number>(
  arr: T[],
  getKey: (x: T) => K
): Record<K, T[]> {
  return arr.reduce((acc: any, item) => {
    const k = getKey(item);
    (acc[k] ||= []).push(item);
    return acc;
  }, {});
}
