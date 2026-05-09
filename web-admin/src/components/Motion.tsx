import { type ComponentProps, type ReactNode } from 'react'

import { useReducedMotion } from 'framer-motion'

import { motion, motionTokens } from './motionConfig'

export function PageMotion({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  const reduceMotion = useReducedMotion()

  return (
    <motion.div
      className={className}
      {...(reduceMotion
        ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
        : motionTokens.page)}
    >
      {children}
    </motion.div>
  )
}

export function MotionButton({
  children,
  whileHover = { y: -1, scale: 1.03 },
  whileTap = { scale: 0.94 },
  transition = motionTokens.spring,
  ...props
}: ComponentProps<typeof motion.button>) {
  return (
    <motion.button whileHover={whileHover} whileTap={whileTap} transition={transition} {...props}>
      {children}
    </motion.button>
  )
}
