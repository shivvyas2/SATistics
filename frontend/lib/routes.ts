// Pages that need a signed-in user. The middleware sends visitors without a session to /login,
// and the API client does the same when a session ends while one of these is open
export const PROTECTED_PREFIXES = ['/dashboard', '/games', '/learn', '/materials', '/mock', '/profile', '/stats']

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}
