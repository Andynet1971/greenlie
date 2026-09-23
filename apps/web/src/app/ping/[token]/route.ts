import { notFound } from 'next/navigation';
import { NextResponse } from 'next/server';
import { findHeartbeatByToken } from '../../../lib/token';
import { getConfig, getStore } from '../../../lib/server';

interface RouteParams {
  params: Promise<{ token: string }>;
}

async function handlePing(token: string): Promise<Response> {
  const config = await getConfig();
  const check = findHeartbeatByToken(config.checks, token);
  if (!check) notFound();

  const store = await getStore();
  const now = new Date();
  await store.ensureCheck(check.id, now);
  await store.recordPing(check.id, now);
  await store.insertRun({ checkId: check.id, at: now, verdict: 'ok', reason: 'ping received' });
  return NextResponse.json({ status: 'ok' });
}

export async function GET(_request: Request, { params }: RouteParams): Promise<Response> {
  const { token } = await params;
  return handlePing(token);
}

export const POST = GET;
