import { Text } from '@heroui/react'

import type { DashboardStatDay } from '../api/types'

function maxCountPair(a: DashboardStatDay[], b: DashboardStatDay[]): number {
  let m = 1
  for (const s of [a, b]) {
    for (const p of s) {
      if (p.count > m) m = p.count
    }
  }
  return m
}

/** 轻量折线图：前台 / 后台按日新增（数据来自控制台 overview）。 */
export function DashboardUserTrendChart({
  front,
  admin,
  daysHint,
}: {
  front: DashboardStatDay[]
  admin: DashboardStatDay[]
  daysHint: string
}) {
  const n = Math.max(front.length, admin.length, 1)
  const maxY = maxCountPair(front, admin)
  const w = 720
  const h = 220
  const padL = 40
  const padR = 16
  const padT = 16
  const padB = 32
  const innerW = w - padL - padR
  const innerH = h - padT - padB

  const step = n <= 1 ? 0 : innerW / (n - 1)

  const linePoints = (series: DashboardStatDay[]) =>
    Array.from({ length: n }, (_, i) => {
      const x = padL + (n <= 1 ? innerW / 2 : i * step)
      const c = series[i]?.count ?? 0
      const y = padT + innerH - (c / maxY) * innerH
      return `${x.toFixed(1)},${y.toFixed(1)}`
    }).join(' ')

  const polyFront = linePoints(front)
  const polyAdmin = linePoints(admin)

  const labels = front.length >= admin.length ? front : admin
  const tickEvery = n <= 7 ? 1 : n <= 14 ? 2 : Math.ceil(n / 7)

  const closedArea = (poly: string) =>
    `${poly} ${padL + innerW},${padT + innerH} ${padL},${padT + innerH}`

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Text className="text-lg font-bold">用户增长趋势</Text>
        <Text size="sm" variant="muted">
          {daysHint}
        </Text>
      </div>
      <div className="flex flex-wrap items-center gap-4 text-xs">
        <span className="inline-flex items-center gap-1.5 font-medium">
          <span className="size-2.5 rounded-full bg-(--accent)" aria-hidden />
          前台新增
        </span>
        <span className="inline-flex items-center gap-1.5 font-medium">
          <span className="size-2.5 rounded-full bg-(--accent-2)" aria-hidden />
          后台新增
        </span>
      </div>
      <div className="w-full overflow-x-auto">
        <svg
          className="mx-auto block max-h-55 min-w-[min(100%,720px)] text-muted"
          viewBox={`0 0 ${w} ${h}`}
          role="img"
          aria-label="按日新增用户折线图"
        >
          <defs>
            <linearGradient id="dashFrontFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.22" />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="dashAdminFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent-2)" stopOpacity="0.18" />
              <stop offset="100%" stopColor="var(--accent-2)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <line
            x1={padL}
            y1={padT + innerH}
            x2={padL + innerW}
            y2={padT + innerH}
            stroke="currentColor"
            strokeOpacity={0.35}
            strokeWidth={1}
          />
          {labels.map((d, i) => {
            if (i % tickEvery !== 0 && i !== n - 1) return null
            const x = padL + (n <= 1 ? innerW / 2 : i * step)
            const short = d.date.length >= 5 ? d.date.slice(5) : d.date
            return (
              <text key={`${d.date}-${i}`} x={x} y={h - 8} textAnchor="middle" className="fill-current text-[10px]">
                {short}
              </text>
            )
          })}
          {n > 1 ? (
            <>
              <polygon fill="url(#dashFrontFill)" points={closedArea(polyFront)} />
              <polygon fill="url(#dashAdminFill)" points={closedArea(polyAdmin)} />
            </>
          ) : null}
          <polyline
            fill="none"
            stroke="var(--accent)"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            points={polyFront}
          />
          <polyline
            fill="none"
            stroke="var(--accent-2)"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            points={polyAdmin}
          />
        </svg>
      </div>
    </div>
  )
}
