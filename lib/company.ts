import { envOf } from '@/lib/env';
import { filmingMode } from '@/lib/paths';

/**
 * The registered company — the business this OS runs for. Set
 * `LEGACYAI_COMPANY_NAME` in `.env.local` (with the matching company when this
 * instance serves one). While filming (demo mode) the demo company's name
 * stands in. When nothing is known, null; surfaces show the host instead
 * rather than a made-up name.
 */
export function companyName(): string | null {
  const own = envOf('COMPANY_NAME')?.trim();
  if (own) return own;
  return filmingMode() ? 'Halden Studio' : null;
}
