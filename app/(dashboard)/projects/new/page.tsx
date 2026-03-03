import { ProjectForm } from '@/components/projects/project-form'

export default function NewProjectPage() {
  return (
    <div className="space-y-6 max-w-full">
      <h1 className="text-xl font-semibold tracking-tight">New contract</h1>
      <ProjectForm contract={null} isEdit={false} />
    </div>
  )
}
