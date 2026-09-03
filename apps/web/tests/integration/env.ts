// Load apps/web/.env.local before any app module reads process.env.
// CI provides the same vars directly; real env wins.
import { readFileSync } from 'node:fs'

try {
  const raw = readFileSync(new URL('../../.env.local', import.meta.url), 'utf8')
  for (const line of raw.split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
  }
} catch {
  // No .env.local — env must come from the caller (CI).
}
