/** localStorage 键，与 workspace 偏好命名风格一致 */
export const PALETTE_STORAGE_KEY = 'new_admin_palette'

export const PALETTE_IDS = ['indigo', 'rose', 'emerald', 'amber', 'slate'] as const

export type PaletteId = (typeof PALETTE_IDS)[number]

export const DEFAULT_PALETTE_ID: PaletteId = 'indigo'

export const PALETTE_OPTIONS: {
  id: PaletteId
  label: string
  hint: string
}[] = [
  { id: 'indigo', label: '靛蓝（默认）', hint: '与原版工作台一致的紫蓝主色' },
  { id: 'rose', label: '玫瑰', hint: '玫红主色，辅色偏粉与薄荷绿点缀' },
  { id: 'emerald', label: '翡翠', hint: '绿色系主色，清爽后台风' },
  { id: 'amber', label: '琥珀', hint: '暖金琥珀强调，适合运营类面板' },
  { id: 'slate', label: '岩灰', hint: '低饱和中性主色，蓝色点缀' },
]

export function isPaletteId(value: string | null | undefined): value is PaletteId {
  return value != null && (PALETTE_IDS as readonly string[]).includes(value)
}

export function readStoredPaletteId(): PaletteId {
  try {
    const raw = window.localStorage.getItem(PALETTE_STORAGE_KEY)
    if (isPaletteId(raw)) return raw
  } catch {
    /* ignore */
  }
  return DEFAULT_PALETTE_ID
}
