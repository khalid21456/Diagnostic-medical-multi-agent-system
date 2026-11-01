/**
 * API configuration, read from Vite env vars (see `.env.example`).
 * Vite exposes only variables prefixed with `VITE_` via `import.meta.env`,
 * so no `dotenv` import is needed on the frontend.
 */

export const API_BASE_URL: string =
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api'

/** Defaults to the mock API until the backend exists. Set `VITE_USE_MOCK_API=false` to hit the real one. */
export const USE_MOCK_API: boolean = import.meta.env.VITE_USE_MOCK_API !== 'false'

export const TOTAL_QUESTIONS = 5
