'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { apiClient } from '@/lib/api/client'
import { clearAccountCache, useAccount } from '@/lib/useAccount'
import { daysUntil } from '@/lib/profile'
import { EXAMS } from '@/lib/exam'
import { Logo } from '@/components/brand/Logo'
import { Avatar } from '@/components/profile/ProfileFields'
import { BookIcon, ChartIcon, CloseIcon, GamepadIcon, HomeIcon, LogoutIcon, ClockIcon, MenuIcon, UploadIcon, UserIcon } from '@/components/brand/Icons'

interface DashboardLayoutProps {
  children: React.ReactNode
  // Optional right-hand column, shown on wide screens
  aside?: React.ReactNode
  // Widen the right-hand column, e.g. to watch a video while reading
  asideWide?: boolean
}

const NAV = [
  { href: '/dashboard', label: 'Home', Icon: HomeIcon },
  { href: '/learn', label: 'Learn', Icon: BookIcon },
  { href: '/games', label: 'Games', Icon: GamepadIcon },
  { href: '/mock', label: 'Mock exam', Icon: ClockIcon },
  { href: '/materials', label: 'My material', Icon: UploadIcon },
  { href: '/stats', label: 'Statistics', Icon: ChartIcon },
  { href: '/profile', label: 'Profile', Icon: UserIcon },
]

export function DashboardLayout({ children, aside, asideWide = false }: DashboardLayoutProps) {
  const pathname = usePathname() ?? ''
  const router = useRouter()
  const { account } = useAccount()
  const [menuOpen, setMenuOpen] = useState(false)
  const profile = account?.profile
  const name = profile?.display_name || account?.user?.email?.split('@')[0] || ''
  const countdown = daysUntil(profile?.test_date ?? null)

  const handleLogout = async () => {
    try {
      await apiClient.logout()
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      clearAccountCache()
      router.push('/login')
      router.refresh()
    }
  }

  const isActive = (href: string) => (href === '/games' || href === '/learn' ? pathname.startsWith(href) : pathname === href)

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="hidden lg:block">
        <Logo href="/dashboard" />
      </div>

      {/* Who's signed in */}
      <Link href="/profile" className="mt-8 flex flex-col items-center text-center">
        {account ? (
          <Avatar profile={{ display_name: name, avatar_color: profile?.avatar_color ?? '#3A33E8' }} size={76} />
        ) : (
          <span className="h-[76px] w-[76px] animate-pulse rounded-full border-2 border-ink/20 bg-white" />
        )}
        <span className="mt-3 text-lg font-extrabold leading-tight">{name || ' '}</span>
        <span className="text-sm text-ink/55">{profile ? `@${profile.username}` : account ? 'Profile not set up' : ' '}</span>
      </Link>

      <nav aria-label="Main" className="mt-8 space-y-1.5">
        {NAV.map(({ href, label, Icon }) => {
          const active = isActive(href)
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setMenuOpen(false)}
              aria-current={active ? 'page' : undefined}
              className={`flex items-center gap-3 rounded-2xl px-4 py-3 font-bold transition-colors ${
                active ? 'border-2 border-ink bg-ink text-white shadow-[3px_3px_0_0_#3A33E8]' : 'border-2 border-transparent hover:bg-white'
              }`}
            >
              <Icon />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Goal card */}
      <div className="mt-auto pt-8">
        {profile ? (
          <div className="rounded-[22px] border-2 border-dashed border-ink/40 p-4 text-center">
            <p className="text-sm text-ink/60">{EXAMS[profile.exam].name} goal</p>
            <p className="text-3xl font-extrabold">{profile.target_score ?? 'Not set'}</p>
            <p className="mt-1 text-sm text-ink/60">
              {countdown !== null && countdown >= 0
                ? `${countdown} ${countdown === 1 ? 'day' : 'days'} to test day`
                : `${profile.daily_minutes} min a day`}
            </p>
          </div>
        ) : account?.user ? (
          <Link href="/profile?setup=1" className="block rounded-[22px] border-2 border-ink bg-lime p-4 text-center font-bold shadow-brutal-sm">
            Set up your profile
          </Link>
        ) : null}
        <button onClick={handleLogout} className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-bold text-ink/60 hover:bg-white hover:text-ink">
          <LogoutIcon className="h-4 w-4" />
          Log out
        </button>
      </div>
    </div>
  )

  return (
    <div className="theme-paper paper-blobs lg:h-screen lg:p-4">
      <div className="flex min-h-screen flex-col overflow-hidden bg-mist/80 lg:h-full lg:min-h-0 lg:flex-row lg:rounded-[32px] lg:border-2 lg:border-ink lg:shadow-brutal-lg">
        {/* Mobile top bar */}
        <div className="flex items-center justify-between border-b-2 border-ink px-4 py-3 lg:hidden">
          <Logo href="/dashboard" />
          <button onClick={() => setMenuOpen(!menuOpen)} className="arrow-btn h-10 w-10 bg-white" aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-expanded={menuOpen}>
            {menuOpen ? <CloseIcon /> : <MenuIcon />}
          </button>
        </div>
        {menuOpen && <div className="border-b-2 border-ink bg-mist px-4 pb-6 lg:hidden">{sidebar}</div>}

        <aside className="hidden w-64 shrink-0 border-r-2 border-ink/10 p-6 lg:block">{sidebar}</aside>

        <main className="min-w-0 flex-1 lg:overflow-y-auto">{children}</main>

        {aside && (
          <aside
            className={`hidden shrink-0 overflow-y-auto border-l-2 border-ink/10 p-6 transition-[width] duration-300 xl:block ${
              asideWide ? 'w-[440px] 2xl:w-[560px]' : 'w-[320px]'
            }`}
          >
            {aside}
          </aside>
        )}
      </div>
    </div>
  )
}
