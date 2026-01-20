# Clerk + Firebase User Sync - Quick Summary

## ✅ What Was Implemented

A webhook system that automatically syncs user data from Clerk to Firebase when users sign up or sign in.

## 📦 New Files Created

1. **`app/api/webhooks/clerk/route.ts`** - Webhook handler
2. **`CLERK_WEBHOOK_SETUP.md`** - Detailed webhook setup guide

## 🔧 Files Modified

- **`middleware.ts`** - Added `/api/webhooks/clerk` to public routes
- **`.env.example`** - Added `CLERK_WEBHOOK_SECRET`
- **`CLERK_SETUP.md`** - Added webhook setup section

## 📦 Packages Installed

- `svix` - For webhook signature verification

## 🔄 How It Works

### User Signs Up Flow:

1. User creates account in Clerk → `/sign-up`
2. Clerk sends webhook → `user.created` event
3. Your API receives at → `/api/webhooks/clerk`
4. Webhook handler:
   - ✅ Verifies webhook signature (security)
   - ✅ Extracts user data (email, name)
   - ✅ Checks if user exists in Firebase
   - ✅ Creates Firebase document:
     ```javascript
     // Collection: users
     // Document ID: Clerk User ID
     {
       email: "user@example.com",
       name: "User Name"
     }
     ```

### User Updates Profile Flow:

1. User updates profile in Clerk
2. Clerk sends webhook → `user.updated` event
3. Firebase document is updated with new data

## 🔑 Required Setup

### 1. Add to `.env.local`:
```bash
CLERK_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### 2. Create Webhook in Clerk Dashboard:
- Go to: Clerk Dashboard → Webhooks → + Add Endpoint
- URL (local): `https://YOUR-NGROK-URL.ngrok.io/api/webhooks/clerk`
- URL (prod): `https://your-domain.vercel.app/api/webhooks/clerk`
- Events: `user.created`, `user.updated`
- Copy the signing secret

### 3. For Local Development:
```bash
# Install ngrok
brew install ngrok

# Expose local server
ngrok http 3000

# Use the ngrok URL in Clerk webhook
```

## 🗄️ Firebase User Document

```javascript
// Collection: users
// Document ID: Clerk User ID (e.g., "user_2abc123def456")
{
  email: "ayushprakash865@gmail.com",  // From Clerk
  name: "Ayush Prakash"                 // From Clerk (firstName + lastName)
}
```

## ✨ Benefits

✅ **Automatic Sync** - No manual user creation needed
✅ **Consistent Data** - Email and name always match Clerk
✅ **Secure** - Webhook signature verification
✅ **Updates** - Profile changes sync automatically
✅ **No Code Changes** - Works with existing interview/feedback code

## 🧪 Testing

### Local Testing:
1. Start server: `npm run dev`
2. Start ngrok: `ngrok http 3000`
3. Update webhook URL in Clerk with ngrok URL
4. Sign up with a test account
5. Check Firebase Console → users collection
6. Verify user document was created

### Production Testing:
1. Deploy to Vercel
2. Update webhook URL in Clerk
3. Sign up on live site
4. Check Firebase for user document

## 📚 Documentation

- See `CLERK_WEBHOOK_SETUP.md` for complete setup guide
- See `CLERK_SETUP.md` for overall Clerk setup

## 🎉 Result

Now when any user signs in with Clerk, they automatically get a corresponding document in Firebase with their email and name! 🚀
