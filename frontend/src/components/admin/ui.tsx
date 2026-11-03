import type { ButtonHTMLAttributes, ReactNode } from 'react'

export const inputClass =
  'w-full rounded-md border border-border bg-surface-raised px-2 py-1 text-sm text-text placeholder:text-text-muted'

export function Field({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`flex flex-col gap-1 text-xs text-text-muted ${className}`}>
      {label}
      {children}
    </label>
  )
}

export function TextInput({ value, onChange, ...rest }: { value: string; onChange: (value: string) => void } & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'>) {
  return <input {...rest} value={value} onChange={(e) => onChange(e.target.value)} className={inputClass} />
}

/** Number input where an empty box means "no value" when the field is optional. */
export function NumberInput({
  value,
  onChange,
  optional = false,
}: {
  value: number | undefined
  onChange: (value: number | undefined) => void
  optional?: boolean
}) {
  return (
    <input
      type="number"
      step="any"
      value={value ?? ''}
      onChange={(e) => {
        if (e.target.value === '') onChange(optional ? undefined : 0)
        else onChange(Number(e.target.value))
      }}
      className={inputClass}
    />
  )
}

export function Button({
  variant = 'secondary',
  className = '',
  ...rest
}: { variant?: 'primary' | 'secondary' | 'danger' } & ButtonHTMLAttributes<HTMLButtonElement>) {
  const styles = {
    primary: 'bg-accent-hover text-white hover:bg-accent-active',
    secondary: 'border border-border-strong bg-surface-raised text-text hover:bg-surface-hover',
    danger: 'text-alarm-text hover:bg-surface-hover',
  }[variant]
  return (
    <button
      type="button"
      {...rest}
      className={`rounded-md px-3 py-1 text-sm font-medium whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-50 ${styles} ${className}`}
    />
  )
}
