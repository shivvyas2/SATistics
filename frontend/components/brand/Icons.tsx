// Small stroke icons used across the app. All inherit currentColor.

type IconProps = { className?: string }

const base = (className = 'h-5 w-5') => ({
  className,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2.2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
})

export const ArrowUpRight = ({ className }: IconProps) => (
  <svg {...base(className)}><path d="M7 17 17 7M8 7h9v9" /></svg>
)
export const ArrowLeft = ({ className }: IconProps) => (
  <svg {...base(className)}><path d="M19 12H5M11 18l-6-6 6-6" /></svg>
)
export const HomeIcon = ({ className }: IconProps) => (
  <svg {...base(className)}><path d="M4 11 12 4l8 7v9h-5v-6H9v6H4z" /></svg>
)
export const GamepadIcon = ({ className }: IconProps) => (
  <svg {...base(className)}><rect x="2.5" y="7" width="19" height="11" rx="5" /><path d="M7.5 10.5v4M5.5 12.5h4M15.5 11.5h.01M18 13.5h.01" /></svg>
)
export const ChartIcon = ({ className }: IconProps) => (
  <svg {...base(className)}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></svg>
)
export const UserIcon = ({ className }: IconProps) => (
  <svg {...base(className)}><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></svg>
)
export const SearchIcon = ({ className }: IconProps) => (
  <svg {...base(className)}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
)
export const LogoutIcon = ({ className }: IconProps) => (
  <svg {...base(className)}><path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10" /></svg>
)
export const CheckIcon = ({ className }: IconProps) => (
  <svg {...base(className)}><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
)
export const PlayIcon = ({ className }: IconProps) => (
  <svg {...base(className)} fill="currentColor"><path d="M7 4.5v15l13-7.5z" /></svg>
)
export const MenuIcon = ({ className }: IconProps) => (
  <svg {...base(className)}><path d="M4 7h16M4 12h16M4 17h16" /></svg>
)
export const CloseIcon = ({ className }: IconProps) => (
  <svg {...base(className)}><path d="M6 6l12 12M18 6 6 18" /></svg>
)
export const BookIcon = ({ className }: IconProps) => (
  <svg {...base(className)}><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5zM4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5" /></svg>
)
