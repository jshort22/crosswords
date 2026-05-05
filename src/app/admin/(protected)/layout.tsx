import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export default async function AdminProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const cookieStore = await cookies()
  if (cookieStore.get('admin-auth')?.value !== 'authenticated') {
    redirect('/admin/login')
  }
  return <>{children}</>
}
