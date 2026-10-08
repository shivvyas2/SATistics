'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { apiClient } from '@/lib/api/client'
import { clearAccountCache } from '@/lib/useAccount'

const CONFIRM_WORD = 'DELETE'

// Download everything stored about the account, or delete the account and all of it
export function YourData() {
  const router = useRouter()
  const [busy, setBusy] = useState<'export' | 'delete' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [typed, setTyped] = useState('')

  const download = async () => {
    setBusy('export')
    setError(null)
    try {
      const data = await apiClient.exportMyData()
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
      const link = document.createElement('a')
      link.href = url
      link.download = 'satistics-data.json'
      link.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not download your data.')
    } finally {
      setBusy(null)
    }
  }

  const remove = async () => {
    setBusy('delete')
    setError(null)
    try {
      await apiClient.deleteAccount()
      clearAccountCache()
      router.replace('/')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete your account.')
      setBusy(null)
    }
  }

  return (
    <section className="mt-12 rounded-[24px] border-2 border-ink bg-white p-6">
      <h2 className="text-2xl font-extrabold">Your data</h2>
      <p className="mt-2 text-sm text-ink/65">
        Download everything SATistics stores about you, or delete your account. See the{' '}
        <Link href="/privacy" className="font-bold underline underline-offset-2">Privacy Policy</Link> for details.
      </p>
      {error && <p className="mt-3 text-sm font-bold text-coral">{error}</p>}
      <div className="mt-4 flex flex-wrap gap-3">
        <button onClick={download} disabled={busy !== null} className="btn btn-paper">
          {busy === 'export' ? 'Preparing…' : 'Download my data'}
        </button>
        {!confirming && (
          <button onClick={() => setConfirming(true)} disabled={busy !== null} className="btn border-2 border-ink bg-coral-soft">
            Delete my account
          </button>
        )}
      </div>
      {confirming && (
        <div className="mt-4 rounded-[18px] border-2 border-ink bg-coral-soft p-4">
          <p className="text-sm font-bold">
            This permanently deletes your account, scores, history and uploads. It can&rsquo;t be undone.
          </p>
          <label className="mt-3 block text-sm">
            Type {CONFIRM_WORD} to confirm
            <input value={typed} onChange={(e) => setTyped(e.target.value)} className="field mt-1" autoComplete="off" />
          </label>
          <div className="mt-3 flex flex-wrap gap-3">
            <button onClick={remove} disabled={typed !== CONFIRM_WORD || busy !== null} className="btn btn-ink">
              {busy === 'delete' ? 'Deleting…' : 'Delete forever'}
            </button>
            <button onClick={() => { setConfirming(false); setTyped('') }} disabled={busy !== null} className="btn btn-paper">
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
