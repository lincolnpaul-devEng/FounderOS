/**
 * Environment-variable naming for LegacyAI.
 *
 * LegacyAI is the product; "GladOS" is the retired codename that older
 * installs still carry in their .env.local and scripts. Every setting has
 * ONE canonical name under LEGACYAI_*, and the GLADOS_* spelling of the same
 * setting is still read (and accepted in .env.local) so an existing setup
 * keeps working untouched. When both spellings are set, LEGACYAI_* wins.
 *
 * New code calls `env('NAME')` / `envOf('NAME', record)`; never
 * `process.env.GLADOS_*` or its LEGACYAI_ sibling directly, so the legacy
 * fallback stays in one place.
 */

/** Canonical prefix, set once here. */
export const ENV_PREFIX = 'LEGACYAI_';

/** The spelling older installs continue to use. Accepted, never recommended. */
export const LEGACY_ENV_PREFIX = 'GLADOS_';

/** [canonical, legacy] spellings of a setting's key, in read order. */
export function envNames(name: string): [string, string] {
  return [`${ENV_PREFIX}${name}`, `${LEGACY_ENV_PREFIX}${name}`];
}

/**
 * The named setting, first key that is DEFINED (an empty string counts).
 * Blank-vs-set semantics are the caller's concern, exactly as when reading
 * `process.env.X` directly.
 */
export function envOf(name: string, env: Record<string, string | undefined> = process.env): string | undefined {
  for (const key of envNames(name)) {
    const value = env[key];
    if (value !== undefined) return value;
  }
  return undefined;
}

/** Same, straight off process.env. */
export function env(name: string): string | undefined {
  return envOf(name);
}

/** The LEGACYAI_* spelling of a setting (for docs and error copy). */
export function canonicalEnvName(name: string): string {
  return `${ENV_PREFIX}${name}`;
}
