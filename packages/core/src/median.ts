/**
 * The median, not the mean: one freak run with ten times the usual volume
 * must not move the baseline enough to turn every normal run into `thin`.
 */
export function median(values: readonly number[]): number | undefined {
  if (values.length === 0) return undefined;

  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const middle = sorted.length % 2 === 0 ? sorted.slice(mid - 1, mid + 1) : sorted.slice(mid, mid + 1);
  return middle.reduce((sum, value) => sum + value, 0) / middle.length;
}
