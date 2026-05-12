import { useLayoutEffect, useRef, useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import useSWR from 'swr'

import { Alert, Button, Form, Input, InputGroup, Label, Text } from '@heroui/react'

import { fetchLoginCaptcha } from '../api/captcha'
import { useAuth } from '../auth/authContext'
import { webAuthnSupported } from '../auth/webauthnClient'
import { MotionButton } from '../components/Motion'
import { AnimatePresence, motion, motionTokens } from '../components/motionConfig'
import { useTheme } from '../theme/themeContext'

type LoginMode = 'password' | 'passkey'

export function LoginPage() {
  const navigate = useNavigate()
  const { login, token, loginWithPasskey } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const [loginMode, setLoginMode] = useState<LoginMode>('password')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [captchaCode, setCaptchaCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [passkeyBusy, setPasskeyBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const passkeyAvailable = webAuthnSupported()
  const loginSwitchContentRef = useRef<HTMLDivElement>(null)
  const [loginSwitchHeight, setLoginSwitchHeight] = useState<number | undefined>(undefined)

  const {
    data: captcha,
    mutate: refreshCaptcha,
    isLoading: captchaLoading,
    error: captchaLoadError,
  } = useSWR('admin-login-captcha', fetchLoginCaptcha, {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  })

  useLayoutEffect(() => {
    const el = loginSwitchContentRef.current
    if (!el) return

    const measure = () => {
      const next = el.getBoundingClientRect().height
      setLoginSwitchHeight((prev) => {
        if (prev === undefined) return next
        if (Math.abs(prev - next) < 0.75) return prev
        return next
      })
    }

    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  if (token) {
    return <Navigate to="/dashboard" replace />
  }

  const goPasskey = async () => {
    setError(null)
    setPasskeyBusy(true)
    try {
      await loginWithPasskey(username)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : '通行密钥登录失败')
    } finally {
      setPasskeyBusy(false)
    }
  }

  return (
    <motion.main
      className="app-shell grid min-h-svh place-items-center px-3 py-6 text-(--text) sm:px-6 sm:py-10"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.28 }}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="orb orb-primary -left-28 bottom-0 opacity-55 sm:opacity-70" />
        <div className="orb orb-cyan -right-20 top-8 opacity-55 sm:opacity-70" />
        <div className="soft-grid absolute inset-x-0 top-0 h-112 opacity-[0.35] sm:opacity-45" />
      </div>

      <motion.section
        className="relative z-1 w-full max-w-5xl overflow-hidden rounded-2xl border border-border shadow-(--shadow) lg:grid lg:min-h-128 lg:grid-cols-[1.12fr_0.88fr]"
        {...motionTokens.panel}
      >
        <div className="relative hidden flex-col justify-between border-border bg-linear-to-br from-(--surface-strong) via-surface to-[color-mix(in_srgb,var(--page)_72%,var(--surface-soft))] p-8 sm:p-10 lg:flex lg:border-r">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_22%,color-mix(in_srgb,var(--accent)_14%,transparent),transparent_55%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_92%_88%,color-mix(in_srgb,var(--accent-2)_12%,transparent),transparent_50%)]" />

          <div className="relative">
            <div className="mb-14 flex items-center gap-3">
              <div className="grid size-11 place-items-center rounded-2xl bg-(--accent) text-xl text-white shadow-[0_14px_36px_var(--glow)]">
                <i className="ri-layout-grid-line" />
              </div>
              <div className="flex min-w-0 flex-col gap-0.5">
                <div className="text-[0.8125rem] font-semibold tracking-[0.14em] text-muted uppercase">
                  NEXORA
                </div>
                <Text className="text-base font-medium text-(--text)">管理控制台</Text>
              </div>
            </div>

            <h1 className="max-w-[20rem] text-3xl font-semibold leading-tight tracking-tight sm:max-w-md sm:text-4xl sm:leading-[1.12]">
              身份、权限与审计，一站式收拢。
            </h1>
            <Text className="mt-4 max-w-md text-[0.9375rem] leading-relaxed" variant="muted">
              为运营与研发团队准备的统一入口；深浅色与主题色可在登录后随偏好调整。
            </Text>
          </div>

          <ul className="relative mt-10 grid gap-2.5 lg:mt-0">
            {[
              ['ri-shield-check-line', '权限按角色隔离', '减少误触与越权操作'],
              ['ri-pulse-line', '运行状态可感知', '关键指标集中呈现'],
              ['ri-brush-ai-line', '界面可定制', '工作台布局与主题随团队习惯'],
            ].map(([icon, title, desc], index) => (
              <motion.li
                key={title}
                className="flex items-start gap-3 rounded-xl border border-border/80 bg-(--surface-soft)/80 px-3.5 py-3 backdrop-blur-sm"
                {...motionTokens.item}
                transition={{ ...motionTokens.softSpring, delay: 0.06 * index }}
              >
                <span className="icon-badge mt-0.5 shrink-0">
                  <i className={`${icon} text-lg leading-none`} />
                </span>
                <div className="flex min-w-0 flex-col gap-0.5">
                  <Text className="text-sm font-medium">{title}</Text>
                  <Text className="text-[0.8125rem] leading-snug" variant="muted">
                    {desc}
                  </Text>
                </div>
              </motion.li>
            ))}
          </ul>
        </div>

        <div className="relative bg-(--surface-strong)/95 px-5 py-8 backdrop-blur-md sm:px-8 sm:py-10">
          <header className="mb-8 flex items-start justify-between gap-4 sm:mb-10">
            <div className="flex min-w-0 items-center gap-3 lg:hidden">
              <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-(--accent) text-lg text-white">
                <i className="ri-layout-grid-line" />
              </div>
              <div className="min-w-0">
                <div className="truncate text-[0.6875rem] font-semibold tracking-[0.12em] text-muted uppercase">
                  NEXORA
                </div>
                <span className="truncate text-sm font-medium text-(--text)">登录</span>
              </div>
            </div>
            <div className="ml-auto shrink-0">
              <MotionButton
                aria-label={`切换到 ${theme === 'dark' ? '浅色' : '深色'} 模式`}
                className="theme-toggle relative flex h-8 w-14 items-center rounded-full p-1"
                type="button"
                onClick={toggleTheme}
              >
                <span className="theme-toggle-knob grid size-6 place-items-center rounded-full bg-(--accent) text-xs text-white shadow-md">
                  <i className={`${theme === 'dark' ? 'ri-moon-clear-line' : 'ri-sun-line'} leading-none`} />
                </span>
              </MotionButton>
            </div>
          </header>

          <div className="mb-7 flex flex-col gap-1 sm:mb-8">
            <h2 className="text-2xl font-semibold tracking-tight text-(--text) sm:text-[1.65rem]">
              登录管理后台
            </h2>
            <Text className="text-[0.9375rem] leading-snug" variant="muted">
              {passkeyAvailable
                ? '选择登录方式，按提示完成验证即可进入工作台。'
                : '使用用户名、密码与验证码登录。'}
            </Text>
          </div>

          {passkeyAvailable ? (
            <div
              className="relative mb-6 flex rounded-full border border-border p-1 shadow-[inset_0_1px_2px_color-mix(in_srgb,var(--text)_8%,transparent)] bg-[color-mix(in_srgb,var(--text)_11%,var(--surface-soft))]"
              role="tablist"
              aria-label="登录方式"
            >
              {loginMode === 'password' ? (
                <motion.div
                  layoutId="login-mode-tab-bg"
                  className="pointer-events-none absolute inset-y-1 left-1 right-1/2 rounded-full bg-(--surface-strong) shadow-[0_2px_10px_color-mix(in_srgb,var(--accent)_32%,rgba(15,23,42,0.12)),0_0_0_1.5px_color-mix(in_srgb,var(--accent)_38%,var(--border)),inset_0_1px_0_color-mix(in_srgb,white_55%,transparent)]"
                  transition={motionTokens.softSpring}
                />
              ) : (
                <motion.div
                  layoutId="login-mode-tab-bg"
                  className="pointer-events-none absolute inset-y-1 left-1/2 right-1 rounded-full bg-(--surface-strong) shadow-[0_2px_10px_color-mix(in_srgb,var(--accent)_32%,rgba(15,23,42,0.12)),0_0_0_1.5px_color-mix(in_srgb,var(--accent)_38%,var(--border)),inset_0_1px_0_color-mix(in_srgb,white_55%,transparent)]"
                  transition={motionTokens.softSpring}
                />
              )}
              <button
                type="button"
                role="tab"
                aria-selected={loginMode === 'password'}
                className={`relative z-10 flex-1 rounded-full px-3 py-2 text-sm transition-[color,font-weight] duration-200 ${
                  loginMode === 'password'
                    ? 'font-semibold text-(--text)'
                    : 'font-normal text-(--faint) hover:text-muted'
                }`}
                onClick={() => {
                  setLoginMode('password')
                  setError(null)
                }}
              >
                密码登录
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={loginMode === 'passkey'}
                className={`relative z-10 flex-1 rounded-full px-3 py-2 text-sm transition-[color,font-weight] duration-200 ${
                  loginMode === 'passkey'
                    ? 'font-semibold text-(--text)'
                    : 'font-normal text-(--faint) hover:text-muted'
                }`}
                onClick={() => {
                  setLoginMode('passkey')
                  setError(null)
                }}
              >
                通行密钥
              </button>
            </div>
          ) : null}

          <Form
            className="flex flex-col gap-5"
            onSubmit={async (e) => {
              e.preventDefault()
              if (loginMode !== 'password') return
              setError(null)
              if (!captcha?.captcha_id) {
                setError('请等待验证码加载完成或点击刷新重试')
                return
              }
              const code = captchaCode.trim()
              if (code.length < 4) {
                setError('请输入验证码')
                return
              }
              setBusy(true)
              try {
                await login(username.trim(), password, captcha.captcha_id, code)
                navigate('/dashboard', { replace: true })
              } catch (err) {
                setError(err instanceof Error ? err.message : '登录失败')
                setCaptchaCode('')
                void refreshCaptcha()
              } finally {
                setBusy(false)
              }
            }}
          >
            <AnimatePresence>
              {error ? (
                <motion.div {...motionTokens.item} exit={{ opacity: 0, y: -8 }}>
                  <Alert status="danger">
                    <Alert.Content>
                      <Alert.Title>登录失败</Alert.Title>
                      <Alert.Description>{error}</Alert.Description>
                    </Alert.Content>
                  </Alert>
                </motion.div>
              ) : null}
            </AnimatePresence>

            <div className="flex flex-col gap-1.5">
              <Label className="text-sm font-medium text-(--text)" htmlFor="login-username">
                用户名
              </Label>
              <Input
                id="login-username"
                name="username"
                autoComplete="username"
                placeholder="工作台账号"
                value={username}
                onChange={(ev) => setUsername(ev.target.value)}
                disabled={busy || passkeyBusy}
                fullWidth
              />
            </div>

            <motion.div
              className="w-full overflow-hidden"
              initial={false}
              animate={loginSwitchHeight === undefined ? false : { height: loginSwitchHeight }}
              transition={motionTokens.softSpring}
            >
              <div ref={loginSwitchContentRef} className="w-full">
                <AnimatePresence mode="wait" initial={false}>
                  {passkeyAvailable && loginMode === 'passkey' ? (
                    <motion.div
                      key="login-panel-passkey"
                      className="flex flex-col gap-3"
                      initial={{ opacity: 0, y: 10, filter: 'blur(4px)' }}
                      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                      exit={{ opacity: 0, y: -8, filter: 'blur(2px)' }}
                      transition={motionTokens.softSpring}
                    >
                  <Button
                    type="button"
                    variant="primary"
                    fullWidth
                    isDisabled={busy || passkeyBusy || !username.trim()}
                    onPress={goPasskey}
                  >
                    {passkeyBusy ? (
                      <>
                        <i className="ri-loader-4-line animate-spin" />
                        正在等待通行密钥…
                      </>
                    ) : (
                      <>
                        <i className="ri-fingerprint-line" />
                        使用通行密钥继续
                      </>
                    )}
                  </Button>
                  {!username.trim() ? (
                    <Text className="text-center text-[0.8125rem] leading-snug" variant="muted">
                      请先填写用户名；无需密码与验证码。
                    </Text>
                  ) : null}
                    </motion.div>
                  ) : !passkeyAvailable || loginMode === 'password' ? (
                    <motion.div
                      key="login-panel-password"
                      className="flex flex-col gap-5"
                      initial={{ opacity: 0, y: 10, filter: 'blur(4px)' }}
                      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                      exit={{ opacity: 0, y: -8, filter: 'blur(2px)' }}
                      transition={motionTokens.softSpring}
                    >
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-sm font-medium text-(--text)" htmlFor="login-password">
                      密码
                    </Label>
                    <Input
                      id="login-password"
                      name="password"
                      type="password"
                      autoComplete="current-password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(ev) => setPassword(ev.target.value)}
                      disabled={busy}
                      fullWidth
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <Label className="text-sm font-medium text-(--text)" htmlFor="login-captcha-code">
                        验证码
                      </Label>
                      <Text className="text-[0.75rem]" variant="muted">
                        点击图片可更换
                      </Text>
                    </div>
                    <InputGroup fullWidth className="group min-w-0 items-stretch">
                      <InputGroup.Input
                        id="login-captcha-code"
                        name="captcha"
                        autoComplete="off"
                        inputMode="numeric"
                        placeholder="图中数字"
                        value={captchaCode}
                        onChange={(ev) => setCaptchaCode(ev.target.value.replace(/\D/g, '').slice(0, 8))}
                        disabled={busy || !captcha}
                      />
                      <InputGroup.Suffix className="w-auto! shrink-0 px-2!">
                        <button
                          type="button"
                          aria-label="点击刷新验证码"
                          title="看不清可点击换一张"
                          className="flex h-full min-h-11 min-w-29 items-center justify-center rounded-lg border border-border bg-(--surface-soft) px-1 outline-none transition-[opacity,box-shadow] enabled:cursor-pointer enabled:hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-(--accent) focus-visible:ring-offset-2 focus-visible:ring-offset-(--surface-strong)"
                          disabled={busy || captchaLoading}
                          onClick={(e) => {
                            e.stopPropagation()
                            setCaptchaCode('')
                            void refreshCaptcha()
                          }}
                        >
                          {captchaLoadError ? (
                            <Text className="px-1 text-center text-[0.8125rem]" variant="muted">
                              加载失败，点击重试
                            </Text>
                          ) : captchaLoading || !captcha ? (
                            <Text className="px-1 text-center text-[0.8125rem]" variant="muted">
                              加载中…
                            </Text>
                          ) : (
                            <img
                              src={captcha.image_base64}
                              alt="验证码"
                              className="max-h-11 w-full max-w-28 rounded object-contain"
                              width={120}
                              height={44}
                            />
                          )}
                        </button>
                      </InputGroup.Suffix>
                    </InputGroup>
                  </div>

                  <Button type="submit" variant="primary" fullWidth isDisabled={busy}>
                    {busy ? (
                      <>
                        <i className="ri-loader-4-line animate-spin" />
                        登录中…
                      </>
                    ) : (
                      <>
                        进入控制台
                        <i className="ri-arrow-right-line text-lg" />
                      </>
                    )}
                  </Button>
                </motion.div>
              ) : null}
                </AnimatePresence>
              </div>
            </motion.div>
          </Form>
        </div>
      </motion.section>
    </motion.main>
  )
}
