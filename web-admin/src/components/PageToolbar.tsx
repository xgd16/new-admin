import { type ReactNode } from 'react'

import { Text } from '@heroui/react'

import { motion, motionTokens } from './motionConfig'

export function PageToolbar({
  title,
  description,
  action,
}: {
  title: string
  description: ReactNode
  action?: ReactNode
}) {
  return (
    <motion.div className="flex flex-wrap items-center justify-between gap-3" {...motionTokens.item}>
      <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-baseline sm:gap-x-3 sm:gap-y-1">
        <Text className="block shrink-0 text-lg font-bold">{title}</Text>
        <Text className="block min-w-0 sm:inline sm:min-w-48" size="sm" variant="muted">
          {description}
        </Text>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </motion.div>
  )
}
