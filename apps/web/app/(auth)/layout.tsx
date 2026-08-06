// Auth shell: blank canvas, no app chrome, centered content area.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen justify-center bg-slate-50 px-4">
      <div className="mx-auto flex w-full max-w-md flex-col justify-center py-12">
        {children}
      </div>
    </div>
  )
}