import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

export interface Received {
  method: string | undefined;
  headers: IncomingMessage['headers'];
  body: string;
}

export interface TestServer {
  url: string;
  received: Received[];
  close(): Promise<void>;
}

/** A real HTTP server on a random local port: probes and webhooks talk to it for real. */
export async function startServer(handler: (req: IncomingMessage, res: ServerResponse) => void): Promise<TestServer> {
  const received: Received[] = [];
  const server = createServer((req, res) => {
    let body = '';
    req.on('data', (chunk: Buffer) => (body += chunk.toString()));
    req.on('end', () => {
      received.push({ method: req.method, headers: req.headers, body });
      handler(req, res);
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;

  return {
    url: `http://127.0.0.1:${port}`,
    received,
    close: () =>
      new Promise((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
}

/** A port nobody listens on: the fastest way to get ECONNREFUSED. */
export async function closedPortUrl(): Promise<string> {
  const server = await startServer(() => undefined);
  await server.close();
  return server.url;
}
