export type SiteTheme = {
  name: string
  colors: {
    page: string
    surface: string
    thread: string
    bar: string
    barStrong: string
    control: string
    subtle: string
    line: string
    lineSoft: string
    ink: string
    muted: string
    link: string
    visited: string
  }
}

export const SITE_THEMES = {
  classic: { name: '定番緑', colors: { page: '#ffffff', surface: '#ffffff', thread: '#efefef', bar: '#ccffcc', barStrong: '#a8dda8', control: '#dddddd', subtle: '#eeeeee', line: '#aaaaaa', lineSoft: '#d2d2d2', ink: '#111111', muted: '#666666', link: '#0000ee', visited: '#551a8b' } },
  gray: { name: '標準灰', colors: { page: '#f7f7f7', surface: '#ffffff', thread: '#eeeeee', bar: '#e2e2e2', barStrong: '#c8c8c8', control: '#d8d8d8', subtle: '#eeeeee', line: '#999999', lineSoft: '#d0d0d0', ink: '#111111', muted: '#666666', link: '#0645ad', visited: '#5a3696' } },
  sky: { name: '水色', colors: { page: '#f5fbff', surface: '#ffffff', thread: '#eef7fc', bar: '#d8f0ff', barStrong: '#b8dced', control: '#dceaf2', subtle: '#edf5f9', line: '#8aa9ba', lineSoft: '#c7dce7', ink: '#10202a', muted: '#5c6f79', link: '#005cc5', visited: '#62459b' } },
  navy: { name: '淡紺', colors: { page: '#f5f7fb', surface: '#ffffff', thread: '#eef1f7', bar: '#dce4f2', barStrong: '#bbc9de', control: '#d7deea', subtle: '#ebeff5', line: '#8493aa', lineSoft: '#c8d0dd', ink: '#172033', muted: '#5c6678', link: '#174ea6', visited: '#633e83' } },
  sakura: { name: '桜', colors: { page: '#fff8fa', surface: '#ffffff', thread: '#f9eff2', bar: '#f8dfe7', barStrong: '#e8bdca', control: '#ead9de', subtle: '#f6ecef', line: '#b8949e', lineSoft: '#dfcbd1', ink: '#2b171d', muted: '#735e64', link: '#b01855', visited: '#74408b' } },
  fuji: { name: '藤', colors: { page: '#faf8ff', surface: '#ffffff', thread: '#f2eff8', bar: '#e9e0f7', barStrong: '#d0bfe8', control: '#e0d9e9', subtle: '#f1edf6', line: '#9f91b2', lineSoft: '#d5ccdf', ink: '#241c2d', muted: '#6b6077', link: '#5b35a5', visited: '#8b3973' } },
  peach: { name: '桃', colors: { page: '#fff9f6', surface: '#ffffff', thread: '#f9f0eb', bar: '#ffe1d2', barStrong: '#edc1ad', control: '#eadbd3', subtle: '#f7eee9', line: '#b99a8b', lineSoft: '#dfcec5', ink: '#2b1d17', muted: '#746259', link: '#b13d18', visited: '#7b3e79' } },
  sand: { name: '砂', colors: { page: '#fbfaf4', surface: '#fffef9', thread: '#f2f0e5', bar: '#eee8ca', barStrong: '#d8cea1', control: '#e2dfd0', subtle: '#f1efe6', line: '#a49e82', lineSoft: '#d8d3bd', ink: '#29271d', muted: '#6d6956', link: '#3859a8', visited: '#6e477d' } },
  sage: { name: '若草', colors: { page: '#f7fbf6', surface: '#ffffff', thread: '#eef4ec', bar: '#dcebd5', barStrong: '#bfd4b5', control: '#dbe4d7', subtle: '#edf2eb', line: '#8da186', lineSoft: '#cad7c5', ink: '#1e291b', muted: '#62705e', link: '#17633a', visited: '#65447e' } },
  mint: { name: 'ミント', colors: { page: '#f4fcfa', surface: '#ffffff', thread: '#eaf6f3', bar: '#d2f0e8', barStrong: '#acd9ce', control: '#d5e7e2', subtle: '#eaf3f1', line: '#82a69d', lineSoft: '#c2d9d3', ink: '#172824', muted: '#5a706b', link: '#006b5b', visited: '#60458a' } },
  aqua: { name: '青緑', colors: { page: '#f4fbfb', surface: '#ffffff', thread: '#eaf3f4', bar: '#d1e9eb', barStrong: '#acd0d4', control: '#d4e2e4', subtle: '#e9f1f2', line: '#7e9fa3', lineSoft: '#bfd4d6', ink: '#16272a', muted: '#596f72', link: '#006b78', visited: '#654283' } },
  lemon: { name: '薄黄', colors: { page: '#fffef5', surface: '#ffffff', thread: '#f7f5e8', bar: '#fff4b8', barStrong: '#e8d682', control: '#e8e3cd', subtle: '#f6f3e3', line: '#ada276', lineSoft: '#ddd5ae', ink: '#2b2817', muted: '#716b4f', link: '#3d58a7', visited: '#764580' } },
  waseda: { name: 'えんじ', colors: { page: '#fcf8f9', surface: '#ffffff', thread: '#f3edef', bar: '#eddde2', barStrong: '#d1b4bd', control: '#e2d7da', subtle: '#f1ebed', line: '#9e878f', lineSoft: '#d4c6cb', ink: '#281b20', muted: '#6d5d62', link: '#8f1537', visited: '#573b82' } },
  retroBlue: { name: 'レトロ青', colors: { page: '#f8fafc', surface: '#ffffff', thread: '#eef1f4', bar: '#cfe1f5', barStrong: '#aac5e2', control: '#d5dce4', subtle: '#ebeff3', line: '#8295a9', lineSoft: '#c4d0dc', ink: '#17212b', muted: '#5c6874', link: '#0033cc', visited: '#663399' } },
  paper: { name: '紙', colors: { page: '#f9f7f0', surface: '#fffefa', thread: '#f0eee7', bar: '#e8e4d6', barStrong: '#cec7b2', control: '#ddd9cc', subtle: '#efede6', line: '#9e998c', lineSoft: '#d3cfc4', ink: '#24231f', muted: '#69665e', link: '#234d9b', visited: '#6c3d7f' } },
  ice: { name: '氷', colors: { page: '#f8fcff', surface: '#ffffff', thread: '#f0f6fa', bar: '#e4f3fb', barStrong: '#c3dfed', control: '#dce8ee', subtle: '#edf4f7', line: '#91a9b5', lineSoft: '#cadde5', ink: '#17252c', muted: '#60727b', link: '#1769aa', visited: '#68458b' } },
} as const satisfies Record<string, SiteTheme>

export type ThemeKey = keyof typeof SITE_THEMES

export const DEFAULT_THEME_KEY: ThemeKey = 'classic'

export function isThemeKey(value: unknown): value is ThemeKey {
  return typeof value === 'string' && value in SITE_THEMES
}

export function applySiteTheme(themeKey: ThemeKey) {
  const root = document.documentElement
  const colors = SITE_THEMES[themeKey].colors
  root.dataset.siteTheme = themeKey
  root.style.setProperty('--page', '#ffffff')
  root.style.setProperty('--surface', '#ffffff')
  root.style.setProperty('--thread', '#ffffff')
  root.style.setProperty('--bar', colors.bar)
  root.style.setProperty('--bar-strong', colors.barStrong)
  root.style.setProperty('--control', colors.control)
  root.style.setProperty('--subtle', colors.subtle)
  root.style.setProperty('--line', colors.line)
  root.style.setProperty('--line-soft', colors.lineSoft)
  root.style.setProperty('--ink', colors.ink)
  root.style.setProperty('--muted', colors.muted)
  root.style.setProperty('--link', colors.link)
  root.style.setProperty('--visited', colors.visited)
}
