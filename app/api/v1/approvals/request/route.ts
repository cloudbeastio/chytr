import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabase-server'
import { authenticateApiKey } from '@/lib/api-auth'
import { loadLicenseFromDB } from '@/lib/license-server'
import { isFeatureEnabled } from '@/lib/license'

export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateApiKey(req)
    if (!auth) {
      return NextResponse.json({ error: 'Invalid or missing API key' }, { status: 401 })
    }

    const body = (await req.json()) as {
      work_order_id?: string
      agent_id?: string
      question?: string
      options?: string[]
      context?: unknown
    }

    if (!body.question || typeof body.question !== 'string') {
      return NextResponse.json({ error: 'question required' }, { status: 400 })
    }

    await loadLicenseFromDB()
    if (!isFeatureEnabled('approvals')) {
      return NextResponse.json(
        {
          error: 'feature_not_available',
          required_tier: 'pro',
          upgrade_url: 'https://www.chytr.ai/pricing',
        },
        { status: 403 }
      )
    }

    const supabase = createSupabaseServiceClient()

    const { data: approval, error: insertError } = await supabase
      .from('approvals')
      .insert({
        user_id: auth.userId,
        work_order_id: body.work_order_id ?? null,
        agent_id: body.agent_id ?? null,
        question: body.question,
        options: body.options ?? [],
        context: body.context ?? null,
        status: 'pending',
      })
      .select()
      .single()

    if (insertError) {
      console.error('[v1/approvals/request]', insertError)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    let notificationConfig: Record<string, unknown> | null = null
    if (body.agent_id) {
      const { data: agent } = await supabase
        .from('agents')
        .select('notification_config')
        .eq('id', body.agent_id)
        .eq('user_id', auth.userId)
        .single()
      notificationConfig = (agent?.notification_config as Record<string, unknown>) ?? null
    }

    const channel = (notificationConfig?.channel as string) ?? 'slack'
    const webhookUrl =
      (notificationConfig?.webhook_url as string) || process.env.SLACK_WEBHOOK_URL

    if (channel === 'slack' && webhookUrl) {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : ''
      const buttons = (body.options ?? []).map((opt: string) => ({
        type: 'button',
        text: { type: 'plain_text', text: opt },
        value: JSON.stringify({ approval_id: approval.id, decision: opt }),
        action_id: `approval_${approval.id}_${opt}`,
      }))
      const blocks = [
        {
          type: 'section',
          text: { type: 'mrkdwn', text: `*Approval Required*\n${body.question}` },
        },
        ...(body.context
          ? [
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `*Context:*\n\`\`\`${String(body.context).substring(0, 500)}\`\`\``,
                },
              },
            ]
          : []),
        {
          type: 'section',
          text: { type: 'mrkdwn', text: `_Approval ID: \`${approval.id}\`_` },
        },
        ...(buttons.length > 0 ? [{ type: 'actions', elements: buttons }] : []),
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `Or resolve via API: \`PATCH ${baseUrl}/api/v1/approvals/resolve\``,
          },
        },
      ]
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blocks }),
      }).catch((e) => console.error('[v1/approvals/request] Slack notify', e))
    }

    return NextResponse.json({ ok: true, approval_id: approval.id })
  } catch (err) {
    console.error('[v1/approvals/request]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
