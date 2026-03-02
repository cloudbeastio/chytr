import { createSupabaseServiceClient } from '@/lib/supabase-service'

export async function getCursorApiKey(): Promise<string | null> {
  const supabase = createSupabaseServiceClient()
  const { data } = await supabase
    .from('instance_config')
    .select('value')
    .eq('key', 'CURSOR_API_KEY')
    .single()
  const fromConfig = data?.value
  if (typeof fromConfig === 'string' && fromConfig.trim()) return fromConfig.trim()
  const fromEnv = process.env.CURSOR_API_KEY
  if (typeof fromEnv === 'string' && fromEnv.trim()) return fromEnv.trim()
  return null
}

export function buildAgentPrompt(wo: Record<string, unknown>): string {
  const lines = Array.isArray(wo.lines) ? wo.lines : []
  const linesList = lines
    .map(
      (l: Record<string, unknown>, i: number) =>
        `${i + 1}. ${l.title}${l.definition_of_done ? ` — DoD: ${l.definition_of_done}` : ''}`
    )
    .join('\n')

  return `WORK_ORDER_ID=${wo.id}

## Objective
${wo.objective ?? 'See work order lines below'}

## Work Order Lines
${linesList || 'Complete the objective above'}

${wo.constraints && Object.keys(wo.constraints as object).length ? `## Constraints\n${JSON.stringify(wo.constraints, null, 2)}\n` : ''}
${wo.exploration_hints && Object.keys(wo.exploration_hints as object).length ? `## Exploration Hints\n${JSON.stringify(wo.exploration_hints, null, 2)}\n` : ''}
${wo.verification && Object.keys(wo.verification as object).length ? `## Verification\n${JSON.stringify(wo.verification, null, 2)}\n` : ''}

## Instructions
1. Start by reading your work order: the WORK_ORDER_ID above is ${wo.id}
2. The chytr hooks skill is installed in this repo — your actions are being logged automatically
3. Complete each work order line in order
4. When done, create a PR if applicable
`.trim()
}
