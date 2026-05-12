import { useMemo } from 'react'
import { Chip, Text } from '@heroui/react'
import ReactECharts from 'echarts-for-react'

import type { DashboardStatDay } from '../api/types'
import { useTheme } from '../theme/themeContext'

export type DashboardFrontUserSummary = {
  total: number
  enabled: number
  disabled: number
  today: number
  yesterday: number
  inRange: number
}

/** 前台用户按日新增（ECharts）；可选底部摘要条。 */
export function DashboardUserTrendChart({
  byDay,
  windowDays,
  summary,
  daysHint,
}: {
  byDay: DashboardStatDay[]
  windowDays: number
  summary?: DashboardFrontUserSummary | null
  daysHint: string
}) {
  const { theme, paletteId } = useTheme()

  const { categories, values } = useMemo(() => {
    const n = byDay.length
    const cats = Array.from({ length: n }, (_, i) => {
      const d = byDay[i]
      return d?.date && d.date.length >= 5 ? d.date.slice(5) : (d?.date ?? '')
    })
    const vals = Array.from({ length: n }, (_, i) => byDay[i]?.count ?? 0)
    return { categories: cats, values: vals }
  }, [byDay])

  const option = useMemo(() => {
    void theme
    void paletteId
    const root = document.documentElement
    const g = (k: string, fallback: string) =>
      getComputedStyle(root).getPropertyValue(k).trim() || fallback
    const accent = g('--accent', '#6366f1')
    const muted = g('--muted', '#64748b')
    const border = g('--border', 'rgba(148,163,184,0.35)')

    return {
      color: [accent],
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' },
      },
      grid: { left: '2%', right: '2%', bottom: '8%', top: 24, containLabel: true },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: categories,
        axisLabel: { color: muted, fontSize: 11 },
        axisLine: { lineStyle: { color: border } },
      },
      yAxis: {
        type: 'value',
        minInterval: 1,
        axisLabel: { color: muted },
        splitLine: {
          lineStyle: { color: border, type: 'dashed', opacity: 0.65 },
        },
      },
      series: [
        {
          name: '前台新增',
          type: 'line',
          smooth: true,
          symbol: categories.length <= 18 ? ('circle' as const) : 'none',
          symbolSize: 6,
          lineStyle: { width: 2 },
          areaStyle: { opacity: 0.14 },
          data: values,
        },
      ],
    } as const
  }, [theme, paletteId, categories, values])

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Text className="text-lg font-bold">前台用户 · 新增趋势</Text>
        <Text size="sm" variant="muted">
          {daysHint}
        </Text>
      </div>
      <ReactECharts
        key={`${theme}-${paletteId}`}
        option={option}
        style={{ height: 280, width: '100%' }}
        opts={{ renderer: 'canvas' }}
        notMerge
        lazyUpdate
      />
      {summary ? (
        <div className="flex flex-col gap-2 border-t border-border pt-3">
          <Text size="sm" variant="muted">
            指标快照（{windowDays} 日窗口内累计新增 {summary.inRange}）
          </Text>
          <div className="flex flex-wrap gap-2">
            <Chip size="sm" variant="soft">
              总计 {summary.total}
            </Chip>
            <Chip size="sm" variant="soft" className="text-(--accent-3)">
              启用 {summary.enabled}
            </Chip>
            <Chip size="sm" variant="soft" className="text-(--warning)">
              停用 {summary.disabled}
            </Chip>
            <Chip size="sm" variant="soft">
              今日 +{summary.today}
            </Chip>
            <Chip size="sm" variant="soft">
              昨日 +{summary.yesterday}
            </Chip>
          </div>
        </div>
      ) : null}
    </div>
  )
}
