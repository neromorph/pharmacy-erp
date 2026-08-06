// App shell: left sidebar + top header + main content.
// The real sidebar content lands in Task 2; this establishes the grid.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white md:block" />
      <div className="flex min-w-0 flex-1 flex-col">
        <main className="flex-1 bg-slate-50 p-6">{children}</main>
      </div>
    </div>
  )
}
