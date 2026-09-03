import { supabase } from './supabase'

export const SITE_ASSETS_BUCKET = 'site-assets'
export const MAX_BACKGROUND_FILE_SIZE = 10 * 1024 * 1024

export type PortalAppearanceRow = {
  desktop_background_path?: string | null
  mobile_background_path?: string | null
  desktop_background_opacity?: number | string | null
  mobile_background_opacity?: number | string | null
  updated_at?: string | null
}

export type PortalAppearance = {
  desktopPath: string | null
  mobilePath: string | null
  desktopOpacity: number
  mobileOpacity: number
  updatedAt: string
}

export const DEFAULT_PORTAL_APPEARANCE: PortalAppearance = {
  desktopPath: null,
  mobilePath: null,
  desktopOpacity: 0.16,
  mobileOpacity: 0.16,
  updatedAt: '',
}

function normalizeOpacity(value: unknown, fallback: number) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? Math.min(1, Math.max(0, numeric)) : fallback
}

export function normalizePortalAppearance(row: PortalAppearanceRow | null | undefined): PortalAppearance {
  return {
    desktopPath: row?.desktop_background_path || null,
    mobilePath: row?.mobile_background_path || null,
    desktopOpacity: normalizeOpacity(row?.desktop_background_opacity, DEFAULT_PORTAL_APPEARANCE.desktopOpacity),
    mobileOpacity: normalizeOpacity(row?.mobile_background_opacity, DEFAULT_PORTAL_APPEARANCE.mobileOpacity),
    updatedAt: row?.updated_at || '',
  }
}

export function getPortalAssetUrl(path: string | null, version = '') {
  if (!supabase || !path) return ''
  const { data } = supabase.storage.from(SITE_ASSETS_BUCKET).getPublicUrl(path)
  if (!data.publicUrl) return ''
  return version ? `${data.publicUrl}?v=${encodeURIComponent(version)}` : data.publicUrl
}

function cssBackgroundUrl(url: string) {
  return url ? `url("${url.replaceAll('"', '%22')}")` : 'none'
}

export function applyPortalAppearance(appearance: PortalAppearance) {
  const desktopUrl = getPortalAssetUrl(appearance.desktopPath, appearance.updatedAt)
  const mobileUrl = getPortalAssetUrl(appearance.mobilePath, appearance.updatedAt) || desktopUrl
  const root = document.documentElement
  root.style.setProperty('--portal-background-desktop', cssBackgroundUrl(desktopUrl))
  root.style.setProperty('--portal-background-mobile', cssBackgroundUrl(mobileUrl))
  root.style.setProperty('--portal-background-desktop-opacity', String(appearance.desktopOpacity))
  root.style.setProperty('--portal-background-mobile-opacity', String(appearance.mobileOpacity))
}
