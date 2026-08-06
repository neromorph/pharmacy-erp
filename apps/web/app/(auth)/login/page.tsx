import { login } from './actions'

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="mb-6 text-2xl font-bold text-slate-900">Pharmacy ERP</h1>
        <form action={login} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm text-slate-500">
            Email
            <input name="email" type="email" required className="rounded border border-slate-200 p-2 text-slate-900 focus:border-teal-600 focus:outline-none" />
          </label>
          <label className="flex flex-col gap-1 text-sm text-slate-500">
            Password
            <input name="password" type="password" required className="rounded border border-slate-200 p-2 text-slate-900 focus:border-teal-600 focus:outline-none" />
          </label>
          <button type="submit" className="mt-2 rounded bg-teal-600 p-2 font-medium text-white hover:bg-teal-700">
            Sign In
          </button>
        </form>
      </div>
    </div>
  )
}
