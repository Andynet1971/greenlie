export type Env = Readonly<Record<string, string | undefined>>;

const VARIABLE = /\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g;

export interface Interpolated {
  value: unknown;
  missing: string[];
}

/**
 * Replaces `${NAME}` with the environment variable, inside string values only.
 *
 * It runs on the parsed YAML, not on the raw text: a secret that happens to
 * contain a colon or a newline cannot change the structure of the config.
 */
export function interpolate(value: unknown, env: Env): Interpolated {
  const missing = new Set<string>();

  const walk = (node: unknown): unknown => {
    if (typeof node === 'string') {
      return node.replace(VARIABLE, (whole, name: string) => {
        const found = env[name];
        if (found === undefined) {
          missing.add(name);
          return whole;
        }
        return found;
      });
    }
    if (Array.isArray(node)) return node.map(walk);
    if (node !== null && typeof node === 'object') {
      return Object.fromEntries(Object.entries(node).map(([key, child]) => [key, walk(child)]));
    }
    return node;
  };

  return { value: walk(value), missing: [...missing] };
}
