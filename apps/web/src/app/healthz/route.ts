import { sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { getDb } from '../../lib/server';

export async function GET(): Promise<Response> {
  try {
    const db = await getDb();
    await db.execute(sql`select 1`);
    return NextResponse.json({ status: 'ok' });
  } catch (error) {
    return NextResponse.json({ status: 'error', message: (error as Error).message }, { status: 503 });
  }
}
