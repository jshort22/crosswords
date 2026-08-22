import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

async function loginAction(formData: FormData) {
  'use server'
  if (formData.get('password') === 'rebus') {
    const cookieStore = await cookies()
    cookieStore.set('admin-auth', 'authenticated', {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    })
    redirect('/admin')
  }
  redirect('/admin/login?error=1')
}

interface Props {
  searchParams: Promise<{ error?: string }>
}

export default async function LoginPage({ searchParams }: Props) {
  const { error } = await searchParams

  return (
    <main className="min-h-screen bg-sunken flex items-center justify-center">
      <div className="bg-surface rounded-xl border border-line p-8 w-full max-w-sm shadow-sm">
        <h1 className="text-xl font-bold text-ink mb-1">Admin</h1>
        <p className="text-sm text-ink-soft mb-6">Enter the password to continue.</p>
        <form action={loginAction} className="flex flex-col gap-4">
          <div>
            {/* A placeholder is not a label — it disappears the moment you type,
                which is exactly when you might need to check what the field
                wanted (WCAG 3.3.2). The visible placeholder stays; this gives
                the field a real name for a screen reader. */}
            <label htmlFor="admin-password" className="sr-only">Password</label>
            <input
              id="admin-password"
              type="password"
              name="password"
              placeholder="Password"
              autoFocus
              // WCAG 2.2 3.3.8 Accessible Authentication: password managers and
              // paste must work, so the field is named for autofill and nothing
              // blocks pasting into it.
              autoComplete="current-password"
              aria-describedby={error ? 'admin-password-error' : undefined}
              aria-invalid={error ? true : undefined}
              className="w-full px-3 py-2 rounded-lg border border-line text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            />
            {error && (
              // role=alert so the failure is announced, not just recoloured.
              <p id="admin-password-error" role="alert" className="text-danger text-xs mt-1">
                Incorrect password. Try again.
              </p>
            )}
          </div>
          <button
            type="submit"
            className="bg-accent hover:opacity-90 text-accent-ink font-semibold rounded-lg py-2 text-sm transition-colors"
          >
            Continue
          </button>
        </form>
      </div>
    </main>
  )
}
