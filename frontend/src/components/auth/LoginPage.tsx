import { useState, type FormEvent } from 'react'
import { login, setToken, type LoginResult } from '../../api/client'
import { Button, Field, TextInput } from '../admin/ui'

export function LoginPage({ onLoggedIn }: { onLoggedIn: (user: LoginResult) => void }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const user = await login(username, password)
      setToken(user.token)
      onLoggedIn(user)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid h-full place-items-center p-6">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-[var(--radius-panel)] border border-border bg-surface p-6 shadow-soft">
        <div className="flex items-center gap-3">
          <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className="size-8" />
          <h1 className="text-lg font-semibold">SensorMind</h1>
        </div>
        <Field label="Username">
          <TextInput value={username} onChange={setUsername} autoComplete="username" autoFocus />
        </Field>
        <Field label="Password">
          <TextInput type="password" value={password} onChange={setPassword} autoComplete="current-password" />
        </Field>
        {error && <p className="text-sm text-alarm-text">{error}</p>}
        <Button variant="primary" type="submit" disabled={busy || !username || !password} className="w-full">
          {busy ? 'Signing in…' : 'Sign in'}
        </Button>
        <Button
          onClick={() => {
            setUsername('guest')
            setPassword('guest')
          }}
          className="w-full"
        >
          Login as Guest
        </Button>
      </form>
    </div>
  )
}
