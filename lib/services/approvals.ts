import { createSupabaseServiceClient } from '@/lib/supabase'
import { isFeatureEnabled } from '@/lib/license'

const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL ?? ''
const CHYTR_PUBLIC_URL = process.env.CHYTR_PUBLIC_URL ?? ''

export interface CreateApprovalInput {
  work_order_id?: string
  agent_id?: string
  question: string
  options?: string[]
  context?: unknown
}

export async function createApproval(input: CreateApprovalInput) {
  if (!isFeatureEnabled('approvals')) {
    return {
      ok: false,
      status: 403,
      error: 'feature_not_available',
      required_tier: 'pro',
    }
  }

  const { work_order_id, agent_id, question, options, context } = input

  if (!question) {
    return { ok: false, status: 400, error: 'question required' }
  }

  const supabase = createSupabaseServiceClient()

  const { data: approval, error: insertError } = await supabase
    .from('approvals')
    .insert({
      work_order_id: work_order_id ?? null,
      agent_id: agent_id ?? null,
      question,
      options: options ?? [],
      context: context ?? null,
      status: 'pending',
    })
    .select()
    .single()

  if (insertError) throw insertError

  let notificationConfig: Record<string, unknown> | null = null
  if (agent_id) {
    const { data: agent } = await supabase
      .from('agents')
      .select('notification_config')
      .eq('id', agent_id)
      .single()
    notificationConfig = agent?.notification_config ?? null
  }

  const channel = (notificationConfig?.channel as string) ?? 'slack'

  if (channel === 'slack') {
    await notifySlack(notificationConfig, approval.id, question, options ?? [], context)
  }

  return { ok: true, approval_id: approval.id }
}

export async function resolveApproval(
  approvalId: string,
  decision: string,
  decidedBy?: string
) {
  if (!isFeatureEnabled('approvals')) {
    return {
      ok: false,
      status: 403,
      error: 'feature_not_available',
      required_tier: 'pro',
    }
  }

  if (!approvalId) return { ok: false, status: 400, error: 'approval_id required' }
  if (!decision) return { ok: false, status: 400, error: 'decision required' }

  const supabase = createSupabaseServiceClient()

  const { data: approval, error: fetchError } = await supabase
    .from('approvals')
    .select('id, status, options')
    .eq('id', approvalId)
    .single()

  if (fetchError || !approval) {
    return { ok: false, status: 404, error: 'approval not found' }
  }

  if (approval.status !== 'pending') {
    return { ok: false, status: 409, error: 'approval already resolved' }
  }

  const options = approval.options as string[] | null
  if (options && options.length > 0 && !options.includes(decision)) {
    return { ok: false, status: 400, error: 'invalid decision', allowed: options }
  }

  const { error: updateError } = await supabase
    .from('approvals')
    .update({
      status: 'resolved',
      decision,
      decided_by: decidedBy ?? null,
      decided_at: new Date().toISOString(),
    })
    .eq('id', approvalId)

  if (updateError) throw updateError

  return { ok: true, approval_id: approvalId, decision }
}

async function notifySlack(
  config: Record<string, unknown> | null,
  approvalId: string,
  question: string,
  options: string[],
  context: unknown
): Promise<void> {
  const webhookUrl = (config?.webhook_url as string) ?? SLACK_WEBHOOK_URL
  if (!webhookUrl) {
    console.warn('[approvals] no Slack webhook URL configured')
    return
  }

  const resolveUrl = CHYTR_PUBLIC_URL
    ? `${CHYTR_PUBLIC_URL.replace(/\/$/, '')}/api/v1/approvals/${approvalId}/resolve`
    : ''

  const buttons = options.map((opt: string) => ({
    type: 'button',
    text: { type: 'plain_text', text: opt },
    value: JSON.stringify({ approval_id: approvalId, decision: opt }),
    action_id: `approval_${approvalId}_${opt}`,
  }))

  const blocks = [
    {
      type: 'section',
      text: { type: 'mrkdwn', text: `*Approval Required*\n${question}` },
    },
    ...(context
      ? [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*Context:*\n\`\`\`${String(context).substring(0, 500)}\`\`\``,
            },
          },
        ]
      : []),
    {
      type: 'section',
      text: { type: 'mrkdwn', text: `_Approval ID: \`${approvalId}\`_` },
    },
    ...(buttons.length > 0 ? [{ type: 'actions', elements: buttons }] : []),
    ...(resolveUrl
      ? [
          {
            type: 'section',
            text: { type: 'mrkdwn', text: `Or resolve via API:\n\`POST ${resolveUrl}\`` },
          },
        ]
      : []),
  ]

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blocks }),
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) {
      const text = await res.text()
      console.error('[approvals] Slack notify failed', res.status, text)
    }
  } catch (err) {
    console.error('[approvals] Slack notify error', err)
  }
}
