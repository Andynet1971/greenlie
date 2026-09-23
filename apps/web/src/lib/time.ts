const MINUTE = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;

/** `3 min ago`, `2 h ago`, `4 days ago` — never a raw timestamp on the page. */
export function relativeTime(date: Date, now: Date): string {
  const diff = now.getTime() - date.getTime();
  if (diff < MINUTE) return 'just now';
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)} min ago`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)} h ago`;
  const days = Math.floor(diff / DAY);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}
