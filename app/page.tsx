import { redirect } from 'next/navigation'
import { getLicense } from '@/lib/license'

export default function RootPage() {
  const license = getLicense()
  if (!license) {
    redirect('/activate')
  }
  redirect('/dashboard')
}
