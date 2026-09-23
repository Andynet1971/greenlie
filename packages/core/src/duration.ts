const UNITS = { ms: 1, s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 } as const;

type Unit = keyof typeof UNITS;

const PATTERN = /^(\d+(?:\.\d+)?)(ms|s|m|h|d)$/;

/** `"30s"` → `30000`. Durations in the config are always written with a unit. */
export function parseDuration(text: string): number {
  const match = PATTERN.exec(text.trim());
  if (!match) {
    throw new Error(`"${text}" is not a duration: use a number and a unit, like "500ms", "30s", "5m", "24h" or "7d"`);
  }
  const ms = Math.round(Number(match[1]) * UNITS[match[2] as Unit]);
  if (ms <= 0) {
    throw new Error(`"${text}" is not a duration: it must be longer than zero`);
  }
  return ms;
}

/** `93_600_000` → `"26h"`, `5_400_000` → `"1h 30m"`. Used in alert messages. */
export function formatDuration(ms: number): string {
  if (ms < UNITS.s) return `${Math.round(ms)}ms`;

  const parts: string[] = [];
  let rest = Math.round(ms / UNITS.s) * UNITS.s;
  for (const unit of ['d', 'h', 'm', 's'] as const) {
    const amount = Math.floor(rest / UNITS[unit]);
    if (amount > 0) parts.push(`${amount}${unit}`);
    rest -= amount * UNITS[unit];
  }
  // Two units are enough to read at a glance: "1d 2h", not "1d 2h 3m 4s".
  return parts.slice(0, 2).join(' ');
}
