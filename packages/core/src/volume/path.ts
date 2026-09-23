/**
 * A deliberately small subset of JSONPath: `$`, `.key` and `[index]`.
 * Enough to point at "the list of things" inside any API response,
 * small enough to validate completely when the config is loaded.
 */
export type PathSegment = string | number;

const TOKEN = String.raw`\.([A-Za-z_$][\w$-]*)|\[(\d+)\]`;

export function parsePath(path: string): PathSegment[] {
  if (!path.startsWith('$')) {
    throw new Error(`"${path}" is not a path: it must start with "$", like "$.items" or "$.data.jobs"`);
  }

  const token = new RegExp(TOKEN, 'y');
  const segments: PathSegment[] = [];
  token.lastIndex = 1;
  while (token.lastIndex < path.length) {
    const position = token.lastIndex;
    const match = token.exec(path);
    if (!match) {
      throw new Error(`"${path}" is not a path: unexpected "${path.slice(position)}" — use ".key" or "[0]"`);
    }
    segments.push(match[1] ?? Number(match[2]));
  }
  return segments;
}

export type Resolved = { found: true; value: unknown } | { found: false; missing: string };

export function resolvePath(root: unknown, segments: readonly PathSegment[]): Resolved {
  let current = root;
  let walked = '$';
  for (const segment of segments) {
    walked += typeof segment === 'number' ? `[${segment}]` : `.${segment}`;
    if (current === null || typeof current !== 'object' || !Object.hasOwn(current, segment)) {
      return { found: false, missing: walked };
    }
    current = (current as Record<PathSegment, unknown>)[segment];
  }
  return { found: true, value: current };
}
