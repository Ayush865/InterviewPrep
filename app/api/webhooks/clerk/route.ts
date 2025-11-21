import { Webhook } from 'svix'
import { headers } from 'next/headers'
import { WebhookEvent } from '@clerk/nextjs/server'
import { db } from '@/firebase/admin'

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
    console.error('Error verifying webhook:', err)
    return new Response('Error occurred', {
      status: 400,
    })
  }

  // Handle the webhook
  const eventType = evt.type

  if (eventType === 'user.created' || eventType === 'user.updated') {
    const { id, email_addresses, first_name, last_name, username } = evt.data

    // Get primary email
    const primaryEmail = email_addresses.find(
      (email) => email.id === evt.data.primary_email_address_id
    )

    if (!primaryEmail) {
      console.error('No primary email found for user:', id)
      return new Response('No primary email', { status: 400 })
    }

    // Create display name from available data
    const name = first_name && last_name 
      ? `${first_name} ${last_name}`
      : first_name || last_name || username || 'User'

    try {
      // Check if user exists in Firebase
      const userRef = db.collection('users').doc(id)
      const userDoc = await userRef.get()

      if (!userDoc.exists) {
        // User doesn't exist, create new document
        await userRef.set({
          email: primaryEmail.email_address,
          name: name,
          interviews: {}, // Initialize empty interviews map
          feedbacks: {}, // Initialize empty feedbacks map
          premium_user: false, // Default to non-premium
        })
        console.log('Created new user in Firebase:', {
          id,
          email: primaryEmail.email_address,
          name,
        })
      } else {
        // User exists, update if needed
        const updateData: any = {
          email: primaryEmail.email_address,
          name: name,
        }
        
        // Initialize interviews map if it doesn't exist
        if (!userDoc.data()?.interviews) {
          updateData.interviews = {}
        }
        
        await userRef.update(updateData)
        console.log('Updated existing user in Firebase:', {
          id,
          email: primaryEmail.email_address,
          name,
        })
      }
    } catch (error) {
      console.error('Error syncing user to Firebase:', error)
      return new Response('Error syncing user', { status: 500 })
    }
  }

  return new Response('Webhook processed successfully', { status: 200 })
}
