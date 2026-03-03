import { ContractForm } from '@/components/contracts/contract-form'

export default function NewContractPage() {
  return (
    <div className="space-y-6 max-w-full">
      <h1 className="text-xl font-semibold tracking-tight">New contract</h1>
      <ContractForm contract={null} isEdit={false} />
    </div>
  )
}
