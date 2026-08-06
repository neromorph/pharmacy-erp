import { login } from './actions'
import { Logo } from '@/components/brand/Logo'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SubmitButton } from '@/components/submit-button'

interface LoginPageProps {
  searchParams: Promise<{ error?: string }>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { error } = await searchParams

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <Logo name="Pharmacy ERP" />
        <p className="text-sm text-slate-500">Point of Sale · Stock · Compliance</p>
      </div>

      <Card className="w-full">
        <CardHeader>
          <h1 data-slot="card-title" className="font-heading text-lg leading-snug font-medium">
            Sign in
          </h1>
          <CardDescription>Use your branch account to continue.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={login} className="flex flex-col gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" autoComplete="email" required />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            </div>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <SubmitButton className="mt-1 w-full">Sign In</SubmitButton>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}