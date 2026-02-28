import { createSupabaseServiceClient } from '@/lib/supabase'

const CURSOR_API_URL = 'https://api.cursor.com/v0/agents'
const CURSOR_API_KEY = process.env.CURSOR_API_KEY ?? ''
const CHYTR_PUBLIC_URL = process.env.CHYTR_PUBLIC_URL ?? ''
const CHYTR_API_KEY = process.env.CHYTR_API_KEY ?? ''

export interface LaunchResult {
  ok: boolean
  cursor_agent_id?: string
  skipped?: string
  error?: string
}

export async function launchAgent(workOrderId: string): Promise<LaunchResult> {
  if (!CURSOR_API_KEY) {
    return { ok: false, error: 'CURSOR_API_KEY not configured' }
  }

  const supabase = createSupabaseServiceClient()

  const { data: wo, error: rpcError } = await supabase.rpc('get_work_order', {
    p_work_order_id: workOrderId,
  })

  if (rpcError || !wo) {
    return { ok: false, error: rpcError?.message ?? 'Work order not found' }
  }

  const record = wo as Record<string, unknown>

  if (record.source === 'local') {
    return { ok: true, skipped: 'local source' }
  }

  if (!record.repo_url) {
    return { ok: false, error: 'No repository linked to this work order' }
  }

  const prompt = buildAgentPrompt(record)
  const repoUrl = String(record.repo_url)
  const branch = String(record.branch_name ?? record.default_branch ?? 'main')

  const webhookUrl = CHYTR_PUBLIC_URL
    ? `${CHYTR_PUBLIC_URL.replace(/\/$/, '')}/api/v1/webhook/cursor`
    : ''

  const body: Record<string, unknown> = {
    prompt: { text: prompt },
    source: { repository: repoUrl, ref: branch },
    target: { autoCreatePr: true },
  }

  if (webhookUrl && CHYTR_API_KEY) {
    body.webhook_url = webhookUrl
    body.webhook_secret = CHYTR_API_KEY
  }

  const basicAuth = Buffer.from(`${CURSOR_API_KEY}:`).toString('base64')

  let cursorRes: Response
  try {
    cursorRes = await fetch(CURSOR_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basicAuth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    })
  } catch (err) {
    return { ok: false, error: `Cursor API request failed: ${String(err)}` }
  }

  if (!cursorRes.ok) {
    const errText = await cursorRes.text().catch(() => '')
    return { ok: false, error: `Cursor API ${cursorRes.status}: ${errText}` }
  }

  let cursorData: Record<string, unknown>
  try {
    cursorData = await cursorRes.json()
  } catch {
    return { ok: false, error: 'Failed to parse Cursor API response' }
  }

  const cursorAgentId = String(cursorData.id ?? cursorData.agent_id ?? '')

  await supabase
    .from('work_orders')
    .update({ status: 'running', cursor_agent_id: cursorAgentId })
    .eq('id', workOrderId)

  return { ok: true, cursor_agent_id: cursorAgentId }
}

function buildAgentPrompt(wo: Record<string, unknown>): string {
  const lines = Array.isArray(wo.lines) ? wo.lines : []
  const linesList = lines
    .map(
      (l: Record<string, unknown>, i: number) =>
        `${i + 1}. ${l.title}${l.definition_of_done ? ` — DoD: ${l.definition_of_done}` : ''}`
    )
    .join('\n')

  const sections: string[] = [
    `WORK_ORDER_ID=${wo.id}`,
    '',
    `## Objective`,
    String(wo.objective ?? 'See work order lines below'),
    '',
    `## Work Order Lines`,
    linesList || 'Complete the objective above',
  ]

  if (wo.constraints && Object.keys(wo.constraints as object).length) {
    sections.push('', '## Constraints', JSON.stringify(wo.constraints, null, 2))
  }
  if (wo.exploration_hints && Object.keys(wo.exploration_hints as object).length) {
    sections.push('', '## Exploration Hints', JSON.stringify(wo.exploration_hints, null, 2))
  }
  if (wo.verification && Object.keys(wo.verification as object).length) {
    sections.push('', '## Verification', JSON.stringify(wo.verification, null, 2))
  }

  sections.push(
    '',
    '## Instructions',
    `1. Start by reading your work order: the WORK_ORDER_ID above is ${wo.id}`,
    '2. The chytr hooks skill is installed in this repo — your actions are being logged automatically',
    '3. Complete each work order line in order',
    '4. When done, create a PR if applicable'
  )

  return sections.join('\n').trim()
}
