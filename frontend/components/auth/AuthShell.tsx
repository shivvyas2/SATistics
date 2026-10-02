import { Logo } from '@/components/brand/Logo'
import { GameCover } from '@/components/brand/GameCover'

interface AuthShellProps {
  children: React.ReactNode
  // Left panel copy
  title: React.ReactNode
  caption: string
}

export function AuthShell({ children, title, caption }: AuthShellProps) {
  return (
    <div className="theme-paper paper-blobs flex min-h-screen p-3 sm:p-4">
      {/* Showcase panel */}
      <aside className="relative hidden w-[46%] overflow-hidden rounded-[32px] border-2 border-ink bg-cobalt p-10 text-white lg:flex lg:flex-col">
        <Logo inverted />
        <h1 className="mt-14 max-w-md text-[clamp(2.4rem,3.6vw,3.4rem)] font-extrabold leading-[0.98] tracking-[-0.03em]">{title}</h1>
        <p className="mt-5 max-w-sm text-lg text-white/75">{caption}</p>

        {/* Covers fanned behind a frosted card */}
        <div className="relative mt-auto h-[330px]">
          <div className="absolute bottom-2 left-0 w-[30%] -rotate-6">
            <GameCover gameId="zombie" showTitle={false} className="aspect-[3/4] w-full rounded-[22px] border-2 border-ink" />
          </div>
          <div className="absolute bottom-10 left-[34%] w-[30%] rotate-3">
            <GameCover gameId="carnival" showTitle={false} className="aspect-[3/4] w-full rounded-[22px] border-2 border-ink" />
          </div>
          <div className="absolute bottom-0 right-0 w-[30%] rotate-[8deg]">
            <GameCover gameId="pac-man" showTitle={false} className="aspect-[3/4] w-full rounded-[22px] border-2 border-ink" />
          </div>
          <div className="absolute left-[14%] right-[14%] top-0 z-10 rounded-[22px] border border-white/40 bg-white/20 p-5 shadow-glass backdrop-blur-xl">
            <p className="text-sm text-white/80">Today&apos;s focus</p>
            <p className="mt-1 text-xl font-extrabold">Advanced Math, 10 questions</p>
            <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/25">
              <div className="h-full w-[62%] rounded-full bg-lime" />
            </div>
          </div>
        </div>
      </aside>

      {/* Form column */}
      <main className="flex flex-1 flex-col px-2 py-4 sm:px-10 lg:px-16">
        <div className="lg:hidden">
          <Logo />
        </div>
        <div className="mx-auto flex w-full max-w-[440px] flex-1 flex-col justify-center py-10">{children}</div>
      </main>
    </div>
  )
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <p role="alert" className="rounded-2xl border-2 border-ink bg-coral-soft px-4 py-3 text-sm font-semibold">
      {message}
    </p>
  )
}

export function Field({ label, htmlFor, hint, children }: { label: string; htmlFor: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-bold">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1.5 text-[13px] text-ink/55">{hint}</p>}
    </div>
  )
}
