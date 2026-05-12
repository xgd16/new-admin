import {
  Checkbox,
  ListBox,
  Select,
  Separator,
  Text,
} from '@heroui/react'

import { motion, motionTokens } from '../components/motionConfig'
import {
  ALLOWED_PAGE_SIZES,
  setTablePageSize,
  type ScrollbarPref,
  type SidebarNavStyle,
  type TablePageSize,
  useReduceMotionPref,
  useScrollbarPref,
  useSidebarCompact,
  useSidebarDualMenu,
  useSidebarFolded,
  useSidebarNavStyle,
  useTablePageSize,
} from '../prefs/workspace'
import { PALETTE_OPTIONS, PALETTE_LIGHT_SWATCHES, type PaletteId } from '../theme/palette'
import { useTheme } from '../theme/themeContext'
import type { ThemePreference } from '../theme/themeContext'

function PalettePreviewStrip({ id, className = '' }: { id: PaletteId; className?: string }) {
  const [a, b, c] = PALETTE_LIGHT_SWATCHES[id]
  return (
    <span
      className={`inline-flex shrink-0 gap-px overflow-hidden rounded-md border border-[color:var(--border)] bg-[color:var(--surface-strong)] p-px shadow-[0_1px_2px_rgba(15,23,42,0.07)] dark:shadow-[0_1px_2px_rgba(0,0,0,0.25)] ${className}`}
      aria-hidden
    >
      <span className="size-3.5 rounded-[2px] sm:size-4 sm:rounded-[3px]" style={{ backgroundColor: a }} />
      <span className="size-3.5 rounded-[2px] sm:size-4 sm:rounded-[3px]" style={{ backgroundColor: b }} />
      <span className="size-3.5 rounded-[2px] sm:size-4 sm:rounded-[3px]" style={{ backgroundColor: c }} />
    </span>
  )
}

function SettingRow({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-8">
      <div className="flex min-w-0 max-w-md shrink-0 flex-col gap-1">
        <Text className="font-semibold">{title}</Text>
        <Text size="sm" variant="muted">
          {description}
        </Text>
      </div>
      <div className="w-full min-w-0 sm:max-w-xs sm:w-auto sm:flex-1">{children}</div>
    </div>
  )
}

const THEME_OPTIONS: { id: ThemePreference; label: string; hint: string }[] = [
  { id: 'light', label: '浅色', hint: '固定亮色界面' },
  { id: 'dark', label: '深色', hint: '固定暗色界面' },
  { id: 'system', label: '跟随系统', hint: '随操作系统明暗自动切换' },
]

const SCROLLBAR_OPTIONS: { id: ScrollbarPref; label: string; hint: string }[] = [
  { id: 'overlay', label: '完全隐藏', hint: '不显示滚动条，仍可用滚轮、触控板或手指滑动' },
  { id: 'visible', label: '始终显示', hint: '常规滚动条与轨道，更容易看出可滚动区域' },
]

const SIDEBAR_LAYOUT_OPTIONS: { id: 'tree' | 'dual'; label: string; hint: string }[] = [
  {
    id: 'tree',
    label: '单栏树形',
    hint: '左侧一组内可折叠分组与入口；可选「仅图标窄栏」',
  },
  {
    id: 'dual',
    label: '双栏（主菜单 + 子菜单）',
    hint: '大屏下左侧图标主菜单 + 旁侧文字子菜单；开启后会自动关闭「仅图标窄栏」',
  },
]

const SIDEBAR_NAV_STYLE_OPTIONS: { id: SidebarNavStyle; label: string; hint: string }[] = [
  { id: 'line', label: '底部强调线 (默认)', hint: '选中时底部出现渐变强调线' },
  { id: 'pill', label: '面性胶囊', hint: '柔和的纯色背景块，适合喜欢圆润包裹感的人' },
  { id: 'glow', label: '左侧光柱', hint: '左侧边缘光柱与背景微亮，充满现代感' },
]

export function SettingsPage() {
  const { themePreference, setThemePreference, paletteId, setPaletteId } = useTheme()
  const [reduceMotion, setReduceMotion] = useReduceMotionPref()
  const [sidebarCompact, setSidebarCompact] = useSidebarCompact()
  const [sidebarFolded, setSidebarFolded] = useSidebarFolded()
  const [sidebarDual, setSidebarDual] = useSidebarDualMenu()
  const [sidebarNavStyle, setSidebarNavStyle] = useSidebarNavStyle()
  const pageSize = useTablePageSize()
  const [scrollbarPref, setScrollbarPref] = useScrollbarPref()

  return (
    <motion.section
      className="glass-panel rounded-xl p-6 sm:p-8"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={motionTokens.softSpring}
    >
      <div className="flex max-w-2xl flex-col gap-2">
        <Text className="text-lg font-semibold">系统设置</Text>
        <Text size="sm" variant="muted">
          以下为工作台本地偏好，保存在当前浏览器；更换设备或清除站点数据后需重新配置。
        </Text>
      </div>

      <Separator className="my-8" />

      <div className="flex flex-col gap-10">
        <SettingRow
          title="外观模式"
          description="控制全局明暗主题；强调色与辅色由下方「配色预设」独立组合。顶栏月亮/太阳按钮在浅色与深色之间切换，并退出「跟随系统」。"
        >
          <Select
            aria-label="外观模式"
            selectedKey={themePreference}
            onSelectionChange={(key) => {
              if (key == null) return
              setThemePreference(key as ThemePreference)
            }}
            fullWidth
          >
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                {THEME_OPTIONS.map((o) => (
                  <ListBox.Item key={o.id} id={o.id} textValue={o.label}>
                    <div className="flex flex-col py-0.5">
                      <span className="font-medium">{o.label}</span>
                      <span className="text-xs text-[color:var(--muted)]">{o.hint}</span>
                    </div>
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>
        </SettingRow>

        <SettingRow
          title="配色预设"
          description="与明暗模式任意组合；切换后主色、光晕与渐变点缀会立即生效（保存在本浏览器）。"
        >
          <Select
            aria-label="配色预设"
            selectedKey={paletteId}
            onSelectionChange={(key) => {
              if (key == null) return
              setPaletteId(key as PaletteId)
            }}
            fullWidth
          >
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                {PALETTE_OPTIONS.map((o) => (
                  <ListBox.Item key={o.id} id={o.id} textValue={o.label}>
                    <div className="flex items-start gap-3 py-0.5">
                      <PalettePreviewStrip id={o.id} className="mt-0.5" />
                      <div className="flex min-w-0 flex-col">
                        <span className="font-medium">{o.label}</span>
                        <span className="text-xs text-[color:var(--muted)]">{o.hint}</span>
                      </div>
                    </div>
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>
        </SettingRow>

        <SettingRow
          title="列表默认每页条数"
          description="适用于用户管理、前台用户、操作日志等分页表格的请求条数。"
        >
          <Select
            aria-label="每页条数"
            selectedKey={String(pageSize)}
            onSelectionChange={(key) => {
              if (key == null) return
              const n = Number(key)
              if ((ALLOWED_PAGE_SIZES as readonly number[]).includes(n)) {
                setTablePageSize(n as TablePageSize)
              }
            }}
            fullWidth
          >
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                {ALLOWED_PAGE_SIZES.map((n) => (
                  <ListBox.Item key={n} id={String(n)} textValue={`${n} 条`}>
                    {n} 条 / 页
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>
        </SettingRow>

        <SettingRow
          title="滚动条样式"
          description="隐藏时不绘制滚动条，内容仍可通过滚轮、触控板或触屏滑动；仅影响当前浏览器。"
        >
          <Select
            aria-label="滚动条样式"
            selectedKey={scrollbarPref}
            onSelectionChange={(key) => {
              if (key == null) return
              setScrollbarPref(key as ScrollbarPref)
            }}
            fullWidth
          >
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                {SCROLLBAR_OPTIONS.map((o) => (
                  <ListBox.Item key={o.id} id={o.id} textValue={o.label}>
                    <div className="flex flex-col py-0.5">
                      <span className="font-medium">{o.label}</span>
                      <span className="text-xs text-[color:var(--muted)]">{o.hint}</span>
                    </div>
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>
        </SettingRow>

        <SettingRow
          title="左侧菜单布局"
          description="双栏模式下主栏为一级入口（图标）、旁列为子入口（文字）；仅在大屏（lg）生效，手机与平板仍用顶栏折叠菜单。开启双栏后会关闭「仅图标窄栏」以免布局冲突。"
        >
          <Select
            aria-label="左侧菜单布局"
            selectedKey={sidebarDual ? 'dual' : 'tree'}
            onSelectionChange={(key) => {
              if (key == null) return
              const k = key as 'tree' | 'dual'
              if (k === 'dual') {
                setSidebarDual(true)
                setSidebarFolded(false)
              } else {
                setSidebarDual(false)
              }
            }}
            fullWidth
          >
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                {SIDEBAR_LAYOUT_OPTIONS.map((o) => (
                  <ListBox.Item key={o.id} id={o.id} textValue={o.label}>
                    <div className="flex flex-col py-0.5">
                      <span className="font-medium">{o.label}</span>
                      <span className="text-xs text-[color:var(--muted)]">{o.hint}</span>
                    </div>
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>
        </SettingRow>

        <SettingRow
          title="菜单选中样式"
          description="定制侧边栏菜单项被选中时的视觉反馈，支持下划线、面性胶囊、左侧光柱等多种动画与高亮样式。"
        >
          <Select
            aria-label="菜单选中样式"
            selectedKey={sidebarNavStyle}
            onSelectionChange={(key) => {
              if (key == null) return
              setSidebarNavStyle(key as SidebarNavStyle)
            }}
            fullWidth
          >
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                {SIDEBAR_NAV_STYLE_OPTIONS.map((o) => (
                  <ListBox.Item key={o.id} id={o.id} textValue={o.label}>
                    <div className="flex flex-col py-0.5">
                      <span className="font-medium">{o.label}</span>
                      <span className="text-xs text-[color:var(--muted)]">{o.hint}</span>
                    </div>
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>
        </SettingRow>

        <SettingRow
          title="简洁工作台布局"
          description="同时收窄大屏左侧菜单，并收紧顶栏的内边距、标题字号与操作按钮尺寸（移动端顶栏同样生效）；简洁模式下顶栏不展示页面副标题以留白。"
        >
          <div className="settings-option-slab rounded-xl border border-[color:var(--border)] p-4 transition hover:bg-[color:var(--surface-soft)]">
            <Checkbox isSelected={sidebarCompact} onChange={(on) => setSidebarCompact(on)}>
              <Checkbox.Control>
                <Checkbox.Indicator />
              </Checkbox.Control>
              <Checkbox.Content>
                <span className="block font-medium">使用简洁布局（侧栏 + 顶栏）</span>
                <span className="mt-1 block text-sm text-[color:var(--muted)]">
                  开启后立即生效
                </span>
              </Checkbox.Content>
            </Checkbox>
          </div>
        </SettingRow>

        <SettingRow
          title="大屏图标窄栏"
          description="仅在桌面宽度将左侧菜单收窄为图标列，点击分组图标可在旁侧展开子菜单；侧栏顶部可恢复完整菜单。手机和平板仍使用顶部折叠菜单，不受影响。开启「双栏菜单」时此项会自动关闭；若当前为单栏树形仍可单独使用。"
        >
          <div
            className={`settings-option-slab rounded-xl border border-[color:var(--border)] p-4 transition hover:bg-[color:var(--surface-soft)] ${sidebarDual ? 'pointer-events-none opacity-55' : ''}`}
          >
            <Checkbox
              isSelected={sidebarFolded && !sidebarDual}
              isDisabled={sidebarDual}
              onChange={(on) => setSidebarFolded(on)}
            >
              <Checkbox.Control>
                <Checkbox.Indicator />
              </Checkbox.Control>
              <Checkbox.Content>
                <span className="block font-medium">默认使用仅图标侧栏</span>
                <span className="mt-1 block text-sm text-[color:var(--muted)]">
                  偏好保存在本浏览器
                </span>
              </Checkbox.Content>
            </Checkbox>
          </div>
        </SettingRow>

        <SettingRow
          title="减少界面动效"
          description="弱化过渡与动画，页面切换更快；若系统已开启「减少动态效果」，浏览器本身也会限制动效。"
        >
          <div className="settings-option-slab rounded-xl border border-[color:var(--border)] p-4 transition hover:bg-[color:var(--surface-soft)]">
            <Checkbox isSelected={reduceMotion} onChange={(on) => setReduceMotion(on)}>
              <Checkbox.Control>
                <Checkbox.Indicator />
              </Checkbox.Control>
              <Checkbox.Content>
                <span className="block font-medium">启用精简动效</span>
                <span className="mt-1 block text-sm text-[color:var(--muted)]">
                  立即作用于当前标签页
                </span>
              </Checkbox.Content>
            </Checkbox>
          </div>
        </SettingRow>
      </div>
    </motion.section>
  )
}
