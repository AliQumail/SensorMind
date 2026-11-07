import { useState, type FormEvent } from 'react'
import { login, setToken, type LoginResult } from '../../api/client'
import plantIllustration from '../../assets/plant-illustration.svg'

const inputClass =
  'w-full rounded-lg border border-border-strong bg-surface-raised px-3.5 py-3 text-sm text-text focus:border-accent focus:outline-none'

function Logo() {
  return (
    <div className="flex items-center gap-3">
      <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className="size-9" />
      <span className="text-lg font-semibold">SensorMind</span>
    </div>
  )
}

export function LoginPage({ onLoggedIn }: { onLoggedIn: (user: LoginResult) => void }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(false)
  const [showResetNote, setShowResetNote] = useState(false)
  const [busy, setBusy] = useState(false)

  const signIn = async (name: string, pass: string) => {
    setBusy(true)
    try {
      const user = await login(name, pass)
      setToken(user.token, remember)
      onLoggedIn(user)
    } catch {
      // The API client already showed a toast explaining what went wrong.
    } finally {
      setBusy(false)
    }
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    void signIn(username, password)
  }

  return (
    <div className="grid min-h-full lg:h-dvh lg:grid-cols-[68fr_32fr]">
      <section className="hidden min-h-0 flex-col gap-7 bg-surface px-14 py-9 lg:flex">
        <Logo />
        <div className="flex min-h-0 flex-1 items-center justify-center [container-type:size]">
          <img
            src={plantIllustration}
            alt="Isometric plant with a process building, utility building, chimney stack, water tank and pump skid"
            className="aspect-[1100/575] w-[min(100cqw,calc(100cqh*1100/575))] rounded-2xl shadow-[0_12px_40px_rgb(59_47_40/0.12)]"
          />
        </div>
        <div className="max-w-lg">
          <h1 className="max-w-md text-3xl leading-tight font-semibold tracking-tight">Every floor of your plant, in one live view.</h1>
          <p className="mt-3 text-text-muted">
            Asset health, warnings and alarms from the shop floor, laid out the way your site is actually built.
          </p>
        </div>
      </section>

      <section className="mx-auto flex w-full max-w-md flex-col justify-center gap-6 border-border bg-bg px-6 py-10 sm:px-10 lg:max-w-none lg:overflow-y-auto lg:border-l">
        <div className="lg:hidden">
          <Logo />
        </div>
        <form onSubmit={submit} className="space-y-5">
          <div>
            <h2 className="text-2xl font-semibold">Sign in</h2>
            <p className="mt-2 text-sm text-text-muted">Use the account your plant administrator set up for you.</p>
          </div>
          <label className="block space-y-2 text-sm font-medium">
            <span>Username</span>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoFocus
              className={inputClass}
            />
          </label>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <label htmlFor="password" className="font-medium">
                Password
              </label>
              <button type="button" onClick={() => setShowResetNote(true)} className="text-xs text-accent-text hover:underline">
                Forgot password?
              </button>
            </div>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className={`${inputClass} pr-16`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute inset-y-0 right-3 text-xs font-medium text-text-muted hover:text-text"
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            {showResetNote && <p className="text-xs text-text-muted">Ask your plant administrator to reset it.</p>}
          </div>
          <label className="flex items-center gap-3 text-sm">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="size-4 accent-accent-hover" />
            Keep me signed in on this device
          </label>
          <button
            type="submit"
            disabled={busy || !username || !password}
            className="w-full rounded-lg bg-accent-hover py-3 text-sm font-medium text-white hover:bg-accent-active disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className="flex items-center gap-3 text-xs tracking-widest text-text-muted">
          <span className="h-px flex-1 bg-border" />
          OR
          <span className="h-px flex-1 bg-border" />
        </div>

        <button
          type="button"
          disabled={busy}
          onClick={() => void signIn('guest', 'guest')}
          className="flex w-full items-center justify-between rounded-lg border border-border bg-surface-raised px-4 py-3.5 text-left hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span>
            <span className="block text-sm font-semibold">Explore the demo plant</span>
            <span className="block text-xs text-text-muted">Sign-in as a Guest</span>
          </span>
          <span aria-hidden className="text-accent-text">
            →
          </span>
        </button>

      </section>
    </div>
  )
}
