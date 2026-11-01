/**
 * The product name and mark this deployment shows. One codebase ships as two
 * products: LegacyAI — the operator's own instance (LEGACYAI_BRAND=glados,
 * the retired GLADOS_BRAND spelling still works) — and the invite-only client
 * build, which is the default so a fresh clone needs no setting.
 * next.config.mjs inlines LEGACYAI_BRAND at build, so this reads the same on
 * the server and in the browser.
 */
export type Brand = { id: 'glados' | 'legacyai'; name: string; title: string; mark: string };

const BRANDS: Record<Brand['id'], Brand> = {
  glados: { id: 'glados', name: 'GladOS', title: 'GLADOS', mark: '/brand/glados-mark.png' },
  legacyai: { id: 'legacyai', name: 'LegacyAI', title: 'LEGACYAI', mark: '/brand/legacyai-mark.png' },
};

export function brandFor(raw: string | undefined): Brand {
  return raw?.trim().toLowerCase() === 'glados' ? BRANDS.glados : BRANDS.legacyai;
}

export const BRAND: Brand = brandFor(process.env.LEGACYAI_BRAND ?? process.env.GLADOS_BRAND);
