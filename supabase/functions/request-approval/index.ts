import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { getServiceClient, getLicense, isFeatureEnabled } from '../_shared/supabase.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const { work_order_id, agent_id, question, options, context } = body

    if (!question) {
      return new Response(JSON.stringify({ error: 'question required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const license = await getLicense()
    if (!isFeatureEnabled(license, 'approvals')) {
      return new Response(
        JSON.stringify({ error: 'feature_not_available', required_tier: 'pro', upgrade_url: 'https://www.chytr.ai/pricing' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = getServiceClient()

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

    // Read notification_config from agent
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
    } else if (channel === 'agentmail') {
      await notifyAgentMail(notificationConfig, approval.id, question, options ?? [], context)
    }

    return new Response(
      JSON.stringify({ ok: true, approval_id: approval.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

async function notifySlack(
  config: Record<string, unknown> | null,
  approvalId: string,
  question: string,
  options: string[],
  context: unknown
): Promise<void> {
  const webhookUrl = (config?.webhook_url as string) ?? Deno.env.get('SLACK_WEBHOOK_URL')
  if (!webhookUrl) {
    console.warn('request-approval: no Slack webhook URL configured')
    return
  }

  const resolveBase = Deno.env.get('SUPABASE_URL') ?? ''
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
    ...(context ? [{
      type: 'section',
      text: { type: 'mrkdwn', text: `*Context:*\n\`\`\`${String(context).substring(0, 500)}\`\`\`` },
    }] : []),
    {
      type: 'section',
      text: { type: 'mrkdwn', text: `_Approval ID: \`${approvalId}\`_` },
    },
    ...(buttons.length > 0 ? [{
      type: 'actions',
      elements: buttons,
    }] : []),
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `Or resolve via API:\n\`POST ${resolveBase}/functions/v1/resolve-approval\``,
      },
    },
  ]

  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ blocks }),
  })

  if (!res.ok) {
    const text = await res.text()
    console.error('request-approval: Slack notify failed', res.status, text)
  }
}

async function notifyAgentMail(
  config: Record<string, unknown> | null,
  approvalId: string,
  question: string,
  options: string[],
  context: unknown
): Promise<void> {
  // AgentMail integration — log for now, wire to AgentMail API when configured
  console.log('request-approval: agentmail notify', {
    approvalId,
    question,
    options,
    context: String(context ?? '').substring(0, 200),
    config,
  })
}
