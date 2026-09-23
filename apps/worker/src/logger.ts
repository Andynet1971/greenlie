export type Level = 'info' | 'warn' | 'error';

export type Logger = (level: Level, message: string, fields?: Record<string, unknown>) => void;

/** One JSON object per line on stdout: what `docker logs` and every log shipper expect. */
export function createLogger(write: (line: string) => void = (line) => process.stdout.write(`${line}\n`)): Logger {
  return (level, message, fields = {}) => {
    write(JSON.stringify({ time: new Date().toISOString(), level, message, ...fields }));
  };
}
