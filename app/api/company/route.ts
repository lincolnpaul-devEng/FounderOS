import { NextResponse } from 'next/server';
import { companyName } from '@/lib/company';

export const dynamic = 'force-dynamic';

/** The registered company the dashboard names (null: unknown — not a fake name). */
export async function GET() {
  return NextResponse.json({ company: companyName() });
}
