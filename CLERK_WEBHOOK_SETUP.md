# Clerk Webhook Setup Guide

This guide will help you set up Clerk webhooks to automatically sync user data to Firebase when users sign up or sign in.

## Why Webhooks?

When a user signs in with Clerk, we need to:
1. Check if their profile exists in Firebase
2. Create a Firebase user document if it doesn't exist
3. Keep the email and name in sync

## Setup Steps

### 1. Get Your Webhook Endpoint URL

**For Local Development:**
You'll need to use a tool like [ngrok](https://ngrok.com) to expose your local server:

```bash
# Install ngrok (if not already installed)
brew install ngrok  # macOS
# or download from https://ngrok.com/download

# Start your Next.js app
npm run dev

# In another terminal, expose port 3000
ngrok http 3000
```

Your webhook URL will be: `https://YOUR-NGROK-URL.ngrok.io/api/webhooks/clerk`

**For Production (Vercel):**
Your webhook URL will be: `https://your-domain.vercel.app/api/webhooks/clerk`

### 2. Create Webhook in Clerk Dashboard

1. Go to your Clerk Dashboard: [https://dashboard.clerk.com](https://dashboard.clerk.com)
2. Select your application
3. Go to **Webhooks** in the left sidebar
4. Click **+ Add Endpoint**
5. Enter your webhook URL: 
   - Local: `https://YOUR-NGROK-URL.ngrok.io/api/webhooks/clerk`
   - Production: `https://your-domain.vercel.app/api/webhooks/clerk`
6. Subscribe to these events:
   - ✅ `user.created` - When a new user signs up
   - ✅ `user.updated` - When user profile is updated
7. Click **Create**

### 3. Get Your Webhook Secret

After creating the webhook:
1. Click on your newly created webhook endpoint
2. Find the **Signing Secret** section
3. Click **Show** to reveal the secret
4. Copy the secret (starts with `whsec_`)

### 4. Add Webhook Secret to Environment Variables

Add to your `.env.local`:

```bash
CLERK_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### 5. Restart Your Development Server

```bash
# Stop your server (Ctrl+C) and restart
npm run dev
```

## How It Works

### User Creation Flow

1. **User signs up** in Clerk (via `/sign-up`)
2. **Clerk fires webhook** → `user.created` event
3. **Your API receives webhook** at `/api/webhooks/clerk`
4. **Webhook handler**:
   - Verifies the webhook signature (security)
   - Extracts user data (id, email, name)
   - Checks if user exists in Firebase
   - Creates Firebase document if needed:
     ```javascript
     {
       email: "user@example.com",
       name: "John Doe"
     }
     ```
5. **User is now synced** between Clerk and Firebase

### User Update Flow

1. **User updates profile** in Clerk
2. **Clerk fires webhook** → `user.updated` event
3. **Your API updates** Firebase document

## Testing the Webhook

### Test Locally

1. Make sure ngrok is running
2. Go to Clerk Dashboard → Webhooks
3. Click your webhook endpoint
4. Go to **Testing** tab
5. Click **Send Example** for `user.created`
6. Check your terminal logs to see the webhook processing

### Test in Production

1. Deploy your app to Vercel
2. Update the webhook URL in Clerk dashboard
3. Create a test account on your live site
4. Check Firebase Console → Firestore → `users` collection
5. Verify the new user document was created

## Troubleshooting

### Webhook Verification Failed
**Error**: `Error verifying webhook`
**Solution**: 
- Verify `CLERK_WEBHOOK_SECRET` is correct in `.env.local`
- Make sure the secret starts with `whsec_`
- Restart your dev server after adding the secret

### User Not Created in Firebase
**Error**: User signs in but no Firebase document
**Solutions**:
1. Check webhook is configured in Clerk dashboard
2. Verify webhook URL is correct and accessible
3. Check server logs for errors
4. Ensure Firebase credentials are correct

### 400 Bad Request
**Error**: Webhook returns 400
**Solution**: 
- Check that all required Svix headers are present
- Verify the webhook endpoint URL doesn't have extra slashes

### ngrok Session Expired
**Error**: Webhook stops working after a while
**Solution**: 
- Free ngrok URLs expire after 2 hours
- Get a permanent ngrok URL (paid) or restart ngrok
- For production, deploy to Vercel

## Firebase User Document Structure

```javascript
// Collection: users
// Document ID: Clerk User ID (e.g., "user_2abc123def456")
{
  email: "ayushprakash865@gmail.com",  // Primary email from Clerk
  name: "Ayush Prakash"                 // First + Last name or username
}
```

## Security

✅ **Webhook signature verification** - Ensures webhooks are from Clerk
✅ **Secret key** - Stored in environment variables, never committed
✅ **HTTPS only** - Webhooks only work over HTTPS (ngrok provides this)

## Deployment Checklist

Before deploying to production:

- [ ] Webhook created in Clerk dashboard
- [ ] Production webhook URL configured
- [ ] `CLERK_WEBHOOK_SECRET` added to Vercel environment variables
- [ ] Tested webhook with a sign-up
- [ ] Verified Firebase user document creation

## Monitoring

Check webhook activity:
1. Clerk Dashboard → Webhooks
2. Click your endpoint
3. View **Recent Deliveries**
4. See success/failure status for each event

## Need Help?

- [Clerk Webhooks Documentation](https://clerk.com/docs/integrations/webhooks)
- [Svix Webhook Verification](https://docs.svix.com/receiving/verifying-payloads/how)
- [Next.js API Routes](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)
