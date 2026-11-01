import { envOf } from '@/lib/env';

/**
 * The operator — the one person this OS runs for. Set LEGACYAI_OPERATOR_NAME in
 * .env.local; every surface that names the operator reads it from here.
 */
export const OPERATOR_NAME = envOf('OPERATOR_NAME')?.trim() || 'Operator';
