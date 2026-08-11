import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Server-side calls go to the in-VPS Supabase endpoint (same Docker
// network) to skip the public DNS + Cloudflare round trip. Unset in
// local dev, so fall back to the public URL.
const serverBaseUrl =
  process.env.SUPABASE_INTERNAL_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL!

export const publicSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!

// Storage URLs (signed or public) are consumed by the browser, so their
// origin must always be the public endpoint.
export function toPublicUrl(url: string): string {
  const internal = process.env.SUPABASE_INTERNAL_URL
  return internal && url.startsWith(internal)
    ? url.replace(internal, publicSupabaseUrl)
    : url
}

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    serverBaseUrl,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Context is server component, ignore set errors
          }
        },
      },
    }
  )
}
