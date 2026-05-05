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
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-xl border border-gray-200 p-8 w-full max-w-sm shadow-sm">
        <h1 className="text-xl font-bold text-gray-900 mb-1">Admin</h1>
        <p className="text-sm text-gray-500 mb-6">Enter the password to continue.</p>
        <form action={loginAction} className="flex flex-col gap-4">
          <div>
            <input
              type="password"
              name="password"
              placeholder="Password"
              autoFocus
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
            {error && (
              <p className="text-red-500 text-xs mt-1">Incorrect password. Try again.</p>
            )}
          </div>
          <button
            type="submit"
            className="bg-amber-400 hover:bg-amber-500 text-white font-semibold rounded-lg py-2 text-sm transition-colors"
          >
            Continue
          </button>
        </form>
      </div>
    </div>
  )
}
