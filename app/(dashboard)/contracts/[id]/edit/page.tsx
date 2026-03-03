import { createSupabaseServerClient } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import { ContractForm } from '@/components/contracts/contract-form'
import type { Contract } from '@/lib/database.types'

export default async function EditContractPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()

  const { data: contract, error } = await supabase
    .from('contracts')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (error || !contract) notFound()

  return (
    <div className="space-y-6 max-w-full">
      <h1 className="text-xl font-semibold tracking-tight">Edit contract</h1>
      <ContractForm contract={contract as Contract} isEdit={true} />
    </div>
  )
}
