import { AnimatePresence, motion } from 'framer-motion'

export { AnimatePresence, motion }

const spring = { type: 'spring', stiffness: 420, damping: 34, mass: 0.82 } as const
const softSpring = { type: 'spring', stiffness: 260, damping: 28, mass: 0.9 } as const

export const motionTokens = {
  spring,
  softSpring,
  page: {
    initial: { opacity: 0, y: 16, scale: 0.99 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, y: -10, scale: 0.995 },
    transition: softSpring,
  },
  panel: {
    initial: { opacity: 0, y: 14, scale: 0.985 },
    animate: { opacity: 1, y: 0, scale: 1 },
    transition: softSpring,
  },
  list: {
    initial: { opacity: 0 },
    animate: { opacity: 1, transition: { staggerChildren: 0.055, delayChildren: 0.04 } },
  },
  item: {
    initial: { opacity: 0, y: 12, scale: 0.985 },
    animate: { opacity: 1, y: 0, scale: 1 },
    transition: softSpring,
  },
  modalBackdrop: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.18 },
  },
  modalPanel: {
    initial: { opacity: 0, y: 22, scale: 0.96 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, y: 14, scale: 0.98 },
    transition: spring,
  },
} as const
