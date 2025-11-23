import { Webhook } from 'svix'
import { headers } from 'next/headers'
import { WebhookEvent } from '@clerk/nextjs/server'
import { getUserById, createUser } from '@/lib/db-queries'
import { logger } from '@/lib/logger'
import { getPool } from '@/lib/db'

export async function POST(req: Request) {
  // Get the webhook secret from environment variables
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET

  if (!WEBHOOK_SECRET) {
    throw new Error('Please add CLERK_WEBHOOK_SECRET to .env.local')
  }

  // Get the headers
  const headerPayload = await headers()
  const svix_id = headerPayload.get('svix-id')
  const svix_timestamp = headerPayload.get('svix-timestamp')
  const svix_signature = headerPayload.get('svix-signature')

  // If there are no headers, error out
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response('Error occurred -- no svix headers', {
      status: 400,
    })
  }

  // Get the body
  const payload = await req.json()
  const body = JSON.stringify(payload)

  // Create a new Svix instance with your webhook secret
  const wh = new Webhook(WEBHOOK_SECRET)

  let evt: WebhookEvent

  // Verify the webhook
  try {
    evt = wh.verify(body, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    }) as WebhookEvent
  } catch (err) {
    // Always log webhook verification errors to console (even in production)
    console.error('[CLERK_WEBHOOK] Signature verification failed:', err)
    logger.error('Error verifying webhook:', err)
    return new Response('Webhook signature verification failed', {
      status: 400,
    })
  }

  // Handle the webhook
  const eventType = evt.type
  console.log('[CLERK_WEBHOOK] Received event:', eventType, 'for user:', evt.data.id)

  if (eventType === 'user.created' || eventType === 'user.updated') {
    const { id, email_addresses, first_name, last_name, username } = evt.data

    // Get primary email
    const primaryEmail = email_addresses.find(
      (email) => email.id === evt.data.primary_email_address_id
    )

    if (!primaryEmail) {
      console.error('[CLERK_WEBHOOK] No primary email found for user:', id)
      logger.error('No primary email found for user:', id)
      return new Response('No primary email', { status: 400 })
    }

    // Create display name from available data
    const name = first_name && last_name
      ? `${first_name} ${last_name}`
      : first_name || last_name || username || 'User'

    try {
      // Check if user exists in MySQL
      const existingUser = await getUserById(id)
      console.log('[CLERK_WEBHOOK] User exists check:', existingUser ? 'YES' : 'NO')

      if (!existingUser) {
        // User doesn't exist, create new user
        await createUser({
          id,
          email: primaryEmail.email_address,
          name: name,
        })
        console.log('[CLERK_WEBHOOK] Created new user:', id)
        logger.info('Created new user in MySQL:', {
          id,
          email: primaryEmail.email_address,
          name,
        })
      } else {
        // User exists, update if needed
        const pool = getPool()
        await pool.execute(
          `UPDATE users SET email = ?, name = ?, updated_at = NOW() WHERE id = ?`,
          [primaryEmail.email_address, name, id]
        )
        console.log('[CLERK_WEBHOOK] Updated existing user:', id)
        logger.info('Updated existing user in MySQL:', {
          id,
          email: primaryEmail.email_address,
          name,
        })
      }
    } catch (error) {
      console.error('[CLERK_WEBHOOK] Error syncing user to MySQL:', error)
      logger.error('Error syncing user to MySQL:', error)
      return new Response('Error syncing user', { status: 500 })
    }
  } else {
    console.log('[CLERK_WEBHOOK] Ignoring event type:', eventType)
  }

  console.log('[CLERK_WEBHOOK] Webhook processed successfully')
  return new Response('Webhook processed successfully', { status: 200 })
}
