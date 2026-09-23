import { z } from 'zod';
import { parseDuration } from '../duration.js';
import { parsePath } from '../volume/path.js';

/** Turns a function that throws into a zod check with the same message. */
function validWith<T>(parse: (text: string) => T) {
  return z.string().transform((text, ctx) => {
    try {
      return parse(text);
    } catch (error) {
      ctx.addIssue({ code: 'custom', message: (error as Error).message });
      return z.NEVER;
    }
  });
}

const duration = validWith(parseDuration);
const path = validWith((text) => (parsePath(text), text));

const id = z
  .string()
  .regex(/^[a-z0-9][a-z0-9-]*$/, 'use lowercase letters, digits and dashes, like "api-orders"');

const common = {
  id,
  name: z.string().min(1).optional(),
};

const probe = {
  ...common,
  url: z.url({ protocol: /^https?$/ }),
  every: duration.optional(),
  timeout: duration.optional(),
  expectStatus: z.array(z.int().min(100).max(599)).min(1).default([200]),
  slowAfter: duration.optional(),
  headers: z.record(z.string(), z.string()).optional(),
};

const httpCheck = z.object({
  ...probe,
  type: z.literal('http'),
});

const jsonVolumeCheck = z
  .object({
    ...probe,
    type: z.literal('json-volume'),
    path,
    thinBelow: z.number().gt(0).lt(1).default(0.5),
    baselineWindow: z.int().min(3).default(20),
    minSamples: z.int().min(2).default(5),
  })
  .refine((check) => check.minSamples <= check.baselineWindow, {
    message: 'minSamples cannot be larger than baselineWindow',
    path: ['minSamples'],
  });

const heartbeatCheck = z.object({
  ...common,
  type: z.literal('heartbeat'),
  every: duration,
  grace: duration.default(5 * 60_000),
  // The token is the only thing that lets a job report in: keep it out of git.
  token: z.string().min(16, 'use at least 16 characters, and read it from an environment variable'),
});

const check = z.discriminatedUnion('type', [httpCheck, jsonVolumeCheck, heartbeatCheck]);

const alerts = z
  .object({
    webhook: z.object({ url: z.url({ protocol: /^https?$/ }) }).optional(),
    email: z
      .object({
        from: z.email(),
        to: z.array(z.email()).min(1),
      })
      .optional(),
  })
  .default({});

export const configSchema = z
  .object({
    defaults: z
      .object({
        every: duration.default(5 * 60_000),
        timeout: duration.default(10_000),
      })
      .default({ every: 5 * 60_000, timeout: 10_000 }),
    checks: z.array(check).min(1, 'add at least one check'),
    alerts,
  })
  .superRefine((config, ctx) => {
    const ids = new Set<string>();
    const tokens = new Set<string>();
    config.checks.forEach((check, index) => {
      if (ids.has(check.id)) {
        ctx.addIssue({ code: 'custom', message: `"${check.id}" is already used by another check`, path: ['checks', index, 'id'] });
      }
      ids.add(check.id);

      if (check.type !== 'heartbeat') return;
      if (tokens.has(check.token)) {
        // Never echo a token back: the message may end up in a log.
        ctx.addIssue({ code: 'custom', message: 'this token is already used by another check', path: ['checks', index, 'token'] });
      }
      tokens.add(check.token);
    });
  });

export type RawConfig = z.output<typeof configSchema>;
