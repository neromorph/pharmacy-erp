import { ButtonHTMLAttributes } from 'react'

export function Button({
  variant = 'primary',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' }) {
  return (
    <button
      {...props}
      style={
        variant === 'primary'
          ? { background: 'var(--primary)', color: '#fff', border: 'none' }
          : { background: 'transparent', color: 'var(--text-primary)', border: '1px solid var(--border)' }
      }
    />
  )
}