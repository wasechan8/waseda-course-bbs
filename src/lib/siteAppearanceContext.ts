import { createContext } from 'react'
import type { PortalAppearance } from './portalAppearance'

export const SiteAppearanceContext = createContext<PortalAppearance | null>(null)
