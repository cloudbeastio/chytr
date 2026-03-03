import { createSupabaseServerClient } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import { ProjectForm } from '@/components/projects/project-form'
import type { Project } from '@/lib/database.types'

export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()

  const { data: contract, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (error || !contract) notFound()

  return (
    <div className="space-y-6 max-w-full">
      <h1 className="text-xl font-semibold tracking-tight">Edit contract</h1>
      <ProjectForm contract={contract as Project} isEdit={true} />
    </div>
  )
}
