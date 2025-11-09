# Clerk Authentication Setup Guide

This application now uses Clerk for authentication instead of Firebase Auth. Follow these steps to set up Clerk:

## 1. Create a Clerk Account

1. Go to [clerk.com](https://clerk.com) and sign up for a free account
2. Create a new application in the Clerk dashboard
3. Choose "Next.js" as your framework

## 2. Get Your API Keys

From your Clerk dashboard:
1. Go to **API Keys** in the left sidebar
2. Copy your **Publishable Key** and **Secret Key**

## 3. Add Environment Variables

Add these to your `.env.local` file:

```bash
# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxxxx
CLERK_SECRET_KEY=sk_test_xxxxx

# Optional - Clerk URLs (defaults work for most cases)
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/
```

## 4. Configure Clerk Dashboard

In your Clerk dashboard:

1. **Go to "Paths"** (under "User & Authentication")
   - Sign-in path: `/sign-in`
   - Sign-up path: `/sign-up`
   - After sign-in: `/`
   - After sign-up: `/`

2. **Enable Email/Password** (under "Email, Phone, Username")
   - Enable email addresses
   - Enable password authentication

3. **Customize appearance** (optional)
   - Go to "Customization" > "Theme"
   - Match your app's dark theme

## 5. Set Up Webhooks (Important!)

To sync users between Clerk and Firebase:

1. **Install ngrok** for local development (or skip for production):
   ```bash
   brew install ngrok  # macOS
   ngrok http 3000     # Expose your local server
   ```

2. **Create webhook in Clerk**:
   - Go to Clerk Dashboard → Webhooks
   - Click **+ Add Endpoint**
   - URL: `https://your-ngrok-url.ngrok.io/api/webhooks/clerk` (local) or `https://your-domain.vercel.app/api/webhooks/clerk` (production)
   - Subscribe to: `user.created` and `user.updated`
   - Copy the **Signing Secret**

3. **Add webhook secret** to `.env.local`:
   ```bash
   CLERK_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```

4. **Restart your server**

See `CLERK_WEBHOOK_SETUP.md` for detailed instructions.

## 6. User ID Synchronization

Clerk automatically generates user IDs. The integration:
- Uses `currentUser()` from `@clerk/nextjs/server` for server-side auth
- Uses `useClerk()` for client-side operations (sign out)
- Stores `clerkUser.id` in Firebase for interviews and feedback

## 6. Migration from Firebase Auth (Optional)

If you have existing users:
1. Export users from Firebase Auth
2. Import them to Clerk using the Clerk API or dashboard
3. Or let users re-register with the same email

## Features

✅ Built-in sign-in/sign-up UI components
✅ Session management handled by Clerk
✅ Protected routes via middleware
✅ User profile management
✅ Social login support (optional)
✅ Multi-factor authentication (optional)

## What Changed

### Removed
- Firebase Authentication (`firebase/auth`)
- Custom `auth.action.ts` functions (replaced by Clerk)
- Custom `AuthForm` component (replaced by Clerk components)

### Added
- `@clerk/nextjs` package
- `middleware.ts` for route protection
- Clerk's `<SignIn />` and `<SignUp />` components
- `currentUser()` for server-side auth

### Updated
- All pages now use `currentUser()` from Clerk
- User data structure: `clerkUser.id`, `clerkUser.firstName`, `clerkUser.username`
- Sign out uses `useClerk().signOut()`

## Testing

1. Start your development server: `npm run dev`
2. Visit `http://localhost:3000`
3. You'll be redirected to `/sign-in`
4. Create a new account or sign in
5. After authentication, you'll be redirected to the dashboard

## Troubleshooting

**Issue**: Infinite redirect loop
- **Solution**: Check that your Clerk API keys are correct and paths match

**Issue**: "Invalid publishable key"
- **Solution**: Ensure you're using the correct key from your Clerk dashboard

**Issue**: Styling looks off
- **Solution**: Customize Clerk's appearance in the dashboard or via `appearance` prop

## Support

- [Clerk Documentation](https://clerk.com/docs)
- [Clerk Discord Community](https://clerk.com/discord)
- [Next.js Integration Guide](https://clerk.com/docs/quickstarts/nextjs)
