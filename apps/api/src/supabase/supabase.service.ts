import { Inject, Injectable, Scope } from '@nestjs/common'
import { REQUEST } from '@nestjs/core'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { Request } from 'express'

@Injectable({ scope: Scope.REQUEST })
export class SupabaseService {
  private clientInstance: SupabaseClient

  constructor(@Inject(REQUEST) private readonly request: Request) {
    const authHeader = this.request.headers.authorization

    this.clientInstance = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
        global: {
          headers: {
            Authorization: authHeader || '',
          },
        },
      },
    )
  }

  getClient(): SupabaseClient {
    return this.clientInstance
  }
}