/**
 * Setup global Vitest.
 *
 * Injecte les variables d'env de test AVANT que `env.ts` ne les parse.
 * Vitest charge ce fichier avant chaque suite grace a `setupFiles` dans vitest.config.ts.
 */

// Les env vars sont deja injectees via vitest.config.ts > test.env
// Ce fichier est un point d'extension pour d'eventuels hooks globaux (beforeAll, afterAll).
