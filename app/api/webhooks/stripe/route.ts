import { decodeJwt } from 'jose'
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createSupabaseServiceClient } from '@/lib/supabase-server'
import { generateLicenseJWT } from '@/lib/license-issuer'

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET

function deriveTierFromPrice(price: Stripe.Price | null): 'pro' | 'team' {
  if (!price) return 'pro'
  const meta = price.metadata
  if (meta?.tier === 'team') return 'team'
  if (meta?.tier === 'pro') return 'pro'
  const amt = price.unit_amount ?? 0
  if (amt >= 4900) return 'team'
  return 'pro'
}

async function upsertStripeConfig(rows: { key: string; value: string }[]) {
  const supabase = createSupabaseServiceClient()
  const { error } = await supabase.from('instance_config').upsert(rows, {
    onConflict: 'key',
  })
  if (error) throw error
}

export async function POST(req: NextRequest) {
  if (!STRIPE_WEBHOOK_SECRET) {
    console.error('[stripe-webhook] STRIPE_WEBHOOK_SECRET missing')
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 })
  }

  let body: string
  try {
    body = await req.text()
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const sig = req.headers.get('stripe-signature')
  if (!sig) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = Stripe.webhooks.constructEvent(body, sig, STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Signature verification failed'
    console.error('[stripe-webhook]', msg)
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  if (!STRIPE_SECRET_KEY) {
    console.error('[stripe-webhook] STRIPE_SECRET_KEY missing')
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 })
  }

  const stripe = new Stripe(STRIPE_SECRET_KEY)

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const customerId = session.customer as string | null
        const subscriptionId = session.subscription as string | null

        if (!customerId || !subscriptionId) {
          return NextResponse.json({ received: true })
        }

        const sub = await stripe.subscriptions.retrieve(subscriptionId, {
          expand: ['items.data.price'],
        })
        const price = sub.items.data[0]?.price ?? null
        const tier = deriveTierFromPrice(price)

        const email = session.customer_email ?? ''
        const licenseJwt = await generateLicenseJWT(email, tier)
        const licenseDecoded = JSON.stringify(decodeJwt(licenseJwt))
        await upsertStripeConfig([
          { key: 'stripe_customer_id', value: customerId },
          { key: 'stripe_subscription_id', value: subscriptionId },
          { key: 'stripe_tier', value: tier },
          { key: 'license_key', value: licenseJwt },
          { key: 'license_decoded', value: licenseDecoded },
          { key: 'activated_at', value: new Date().toISOString() },
        ])
        return NextResponse.json({ received: true })
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription
        const firstItem = sub.items.data[0]
        let price: Stripe.Price | null = null
        if (firstItem) {
          price =
            typeof firstItem.price === 'object'
              ? firstItem.price
              : await stripe.prices.retrieve(firstItem.price)
        }
        const tier = deriveTierFromPrice(price)

        let customerEmail = ''
        try {
          const customer = await stripe.customers.retrieve(sub.customer as string)
          if (!customer.deleted && customer.email) {
            customerEmail = customer.email
          }
        } catch {
          // keep customerEmail empty
        }
        if (!customerEmail) {
          const { data: existing } = await createSupabaseServiceClient()
            .from('instance_config')
            .select('value')
            .eq('key', 'license_decoded')
            .single()
          if (existing?.value) {
            try {
              const decoded = JSON.parse(existing.value) as { email?: string }
              customerEmail = decoded.email ?? ''
            } catch {
              // ignore
            }
          }
        }
        const email = customerEmail || 'noreply@chytr.ai'
        const licenseJwt = await generateLicenseJWT(email, tier)
        const licenseDecoded = JSON.stringify(decodeJwt(licenseJwt))

        await upsertStripeConfig([
          { key: 'stripe_customer_id', value: sub.customer as string },
          { key: 'stripe_subscription_id', value: sub.id },
          { key: 'stripe_tier', value: tier },
          { key: 'license_key', value: licenseJwt },
          { key: 'license_decoded', value: licenseDecoded },
          { key: 'activated_at', value: new Date().toISOString() },
        ])
        return NextResponse.json({ received: true })
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        await upsertStripeConfig([
          { key: 'stripe_customer_id', value: sub.customer as string },
          { key: 'stripe_subscription_id', value: '' },
          { key: 'stripe_tier', value: 'free' },
        ])
        return NextResponse.json({ received: true })
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        console.warn(
          '[stripe-webhook] payment_failed',
          invoice.customer,
          invoice.id,
          invoice.attempt_count
        )
        return NextResponse.json({ received: true })
      }

      default:
        return NextResponse.json({ received: true })
    }
  } catch (err) {
    console.error('[stripe-webhook]', event.type, err)
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    )
  }
}
