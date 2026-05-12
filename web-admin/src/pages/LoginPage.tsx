import { useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import useSWR from 'swr'

import { Alert, Button, Form, Input, InputGroup, Label, Text } from '@heroui/react'

import { fetchLoginCaptcha } from '../api/captcha'
import { useAuth } from '../auth/authContext'
import { webAuthnSupported } from '../auth/webauthnClient'
import { MotionButton } from '../components/Motion'
import { AnimatePresence, motion, motionTokens } from '../components/motionConfig'
import { useTheme } from '../theme/themeContext'

export function LoginPage() {
  const navigate = useNavigate()
  const { login, token, loginWithPasskey } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [captchaCode, setCaptchaCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [passkeyBusy, setPasskeyBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const {
    data: captcha,
    mutate: refreshCaptcha,
    isLoading: captchaLoading,
    error: captchaLoadError,
  } = useSWR('admin-login-captcha', fetchLoginCaptcha, {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  })

  if (token) {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <motion.main
      className="app-shell grid min-h-svh place-items-center px-3 py-4 text-(--text) sm:px-4 sm:py-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
    >
      <div className="orb orb-primary -left-24 bottom-12" />
      <div className="orb orb-cyan -right-24 top-10" />
      <div className="soft-grid absolute inset-x-0 top-0 h-96 opacity-50" />

      <motion.section
        className="relative grid w-full max-w-6xl overflow-hidden rounded-xl border border-border shadow-(--shadow) lg:grid-cols-[1.05fr_0.95fr]"
        {...motionTokens.panel}
      >
        <div className="glass-panel relative hidden min-h-168 flex-col justify-between overflow-hidden rounded-none border-0 p-9 lg:flex">
          <div>
            <div className="mb-16 flex items-center gap-3">
              <div className="grid size-12 place-items-center rounded-xl bg-(--accent) text-2xl text-white shadow-[0_16px_40px_var(--glow)]">
                <i className="ri-flashlight-line" />
              </div>
              <div className="flex flex-col gap-0.5">
                <div className="text-xl font-black tracking-[0.24em]">NEXORA</div>
                <Text size="xs" variant="muted">
                  Intelligent Admin Console
                </Text>
              </div>
            </div>

            <p className="max-w-md text-5xl font-black leading-[1.05] tracking-tight">
              企业级后台，从身份到权限都清晰可控。
            </p>
            <Text className="mt-5 max-w-md" variant="muted">
              集中呈现业务数据与日常操作，深浅色界面随使用习惯切换。
            </Text>
          </div>

          <div className="grid gap-3">
            {[
              ['ri-shield-check-line', '安全可控', '按角色管理可见范围，降低误操作风险'],
              ['ri-command-line', '统一工作台', '关键指标与运行状态一屏掌握'],
              ['ri-moon-clear-line', '主题切换', '深色与浅色模式即时切换并自动记忆'],
            ].map(([icon, title, desc], index) => (
              <motion.div
                key={title}
                className="glass-card flex items-center gap-3 rounded-xl p-4"
                {...motionTokens.item}
                transition={{ ...motionTokens.softSpring, delay: 0.08 * index }}
              >
                <span className="icon-badge">
                  <i className={`${icon} text-xl`} />
                </span>
                <div className="flex flex-col gap-0.5">
                  <Text className="font-semibold">{title}</Text>
                  <Text size="xs" variant="muted">
                    {desc}
                  </Text>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        <div className="glass-panel rounded-none border-0 p-4 sm:p-8 lg:p-10">
          <div className="mb-8 flex items-center justify-between gap-4 sm:mb-10">
            <div className="flex min-w-0 items-center gap-3 lg:hidden">
              <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-(--accent) text-xl text-white sm:size-11">
                <i className="ri-flashlight-line" />
              </div>
              <span className="truncate font-black tracking-[0.2em]">NEXORA</span>
            </div>
            <MotionButton
              aria-label={`切换到 ${theme === 'dark' ? '浅色' : '深色'} 模式`}
              className="theme-toggle relative ml-auto flex h-8 w-14 items-center rounded-full p-1"
              type="button"
              onClick={toggleTheme}
            >
              <span className="theme-toggle-knob grid size-6 place-items-center rounded-full bg-(--accent) text-xs text-white shadow-lg">
                <i className={`${theme === 'dark' ? 'ri-moon-clear-line' : 'ri-sun-line'} leading-none`} />
              </span>
            </MotionButton>
          </div>

          <div className="mb-8 flex flex-col gap-2">
            <Text className="text-2xl font-black tracking-tight sm:text-3xl">登录管理后台</Text>
            <Text size="sm" variant="muted">
              已绑定通行密钥时，可先输入用户名再点「通行密钥」；否则使用下方密码与验证码登录。
            </Text>
          </div>

          <Form
            className="flex flex-col gap-5"
            onSubmit={async (e) => {
              e.preventDefault()
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

            <div className="flex flex-col gap-2">
              <Label className="flex items-center gap-2" htmlFor="login-username">
                <i className="ri-user-3-line text-(--accent)" />
                用户名
              </Label>
              <Input
                id="login-username"
                name="username"
                autoComplete="username"
                placeholder="请输入用户名"
                value={username}
                onChange={(ev) => setUsername(ev.target.value)}
                disabled={busy || passkeyBusy}
                fullWidth
              />
            </div>

            {webAuthnSupported() ? (
              <div className="flex flex-col gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  fullWidth
                  isDisabled={busy || passkeyBusy || !username.trim()}
                  onPress={async () => {
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
                  }}
                >
                  {passkeyBusy ? (
                    <>
                      <i className="ri-loader-4-line animate-spin" />
                      正在等待通行密钥…
                    </>
                  ) : (
                    <>
                      <i className="ri-fingerprint-line" />
                      使用通行密钥登录
                    </>
                  )}
                </Button>
                {!username.trim() ? (
                  <Text size="sm" variant="muted">
                    请先填写上方用户名，按钮即可点击（无需填写密码与验证码）。
                  </Text>
                ) : null}
                <div className="flex items-center gap-3 py-1">
                  <span className="h-px flex-1 bg-border" />
                  <Text className="shrink-0" size="sm" variant="muted">
                    或使用密码登录
                  </Text>
                  <span className="h-px flex-1 bg-border" />
                </div>
              </div>
            ) : null}

            <div className="flex flex-col gap-2">
              <Label className="flex items-center gap-2" htmlFor="login-password">
                <i className="ri-lock-password-line text-(--accent)" />
                密码
              </Label>
              <Input
                id="login-password"
                name="password"
                type="password"
                autoComplete="current-password"
                placeholder="请输入密码"
                value={password}
                onChange={(ev) => setPassword(ev.target.value)}
                disabled={busy}
                fullWidth
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label className="flex items-center gap-2" htmlFor="login-captcha-code">
                <i className="ri-shield-keyhole-line text-(--accent)" />
                验证码
              </Label>
              <InputGroup fullWidth className="group min-w-0 items-stretch">
                <InputGroup.Input
                  id="login-captcha-code"
                  name="captcha"
                  autoComplete="off"
                  inputMode="numeric"
                  placeholder="输入图中数字"
                  value={captchaCode}
                  onChange={(ev) => setCaptchaCode(ev.target.value.replace(/\D/g, '').slice(0, 8))}
                  disabled={busy || !captcha}
                />
                <InputGroup.Suffix className="w-auto! shrink-0 px-2!">
                  <button
                    type="button"
                    aria-label="点击刷新验证码"
                    title="看不清可点击验证码图片换一张"
                    className="flex h-full min-w-28 max-w-34 flex-col items-center justify-center border-0 bg-transparent p-0 outline-none transition-opacity enabled:cursor-pointer enabled:hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-(--accent) focus-visible:ring-offset-1"
                    disabled={busy || captchaLoading}
                    onClick={(e) => {
                      e.stopPropagation()
                      setCaptchaCode('')
                      void refreshCaptcha()
                    }}
                  >
                    {captchaLoadError ? (
                      <Text className="px-0.5 text-center" size="sm" variant="muted">
                        加载失败，点击重试
                      </Text>
                    ) : captchaLoading || !captcha ? (
                      <Text className="px-0.5 text-center" size="sm" variant="muted">
                        加载中…
                      </Text>
                    ) : (
                      <img
                        src={captcha.image_base64}
                        alt="图形验证码，数字图案"
                        className="max-h-full w-full object-contain"
                        width={120}
                        height={50}
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
                  <i className="ri-login-circle-line" />
                  进入控制台
                </>
              )}
            </Button>
          </Form>
        </div>
      </motion.section>
    </motion.main>
  )
}
