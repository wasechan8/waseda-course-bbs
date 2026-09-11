import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim()
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    })
  : null

let anonymousSessionRequest: Promise<Session> | null = null

async function startAnonymousSession() {
  if (!supabase) {
    throw new Error('BBSは現在セットアップ中です')
  }

  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  if (data.session) return data.session

  const signInResult = await supabase.auth.signInAnonymously()
  if (signInResult.error) {
    throw new Error(
      signInResult.error.message.includes('Anonymous')
        ? 'Supabaseで匿名ログインを有効にしてください'
        : signInResult.error.message,
    )
  }
  if (!signInResult.data.session) {
    throw new Error('匿名セッションを開始できませんでした')
  }
  return signInResult.data.session
}

export function ensureAnonymousSession() {
  if (anonymousSessionRequest) return anonymousSessionRequest

  const request = startAnonymousSession()
  anonymousSessionRequest = request
  return request.finally(() => {
    if (anonymousSessionRequest === request) anonymousSessionRequest = null
  })
}
