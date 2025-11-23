# Getting Your Vapi Server API Key

## Why You Need This

The **Web SDK cannot start workflows directly**. The error you're seeing:

```
"Couldn't Get Assistant. `assistantId` 51d55520-7183-4531-baa9-e2fba5894e1b Does Not Exist."
```

...happens because the Web SDK treats workflow IDs as assistant IDs. To start workflows, you need the **Server SDK**, which requires a **Server API Key**.

## Steps to Get Server API Key

1. **Go to Vapi Dashboard**
   - Visit: https://dashboard.vapi.ai

2. **Navigate to API Keys**
   - Click on your profile/settings
   - Go to **"API Keys"** or **"Developer Settings"**

3. **Create a New Server API Key**
   - Click **"Create API Key"** or **"New Key"**
   - Select **"Server"** or **"Private"** key type (NOT web/public key)
   - Give it a name like "Interview Prep Server"
   - Copy the generated key (starts with something like `sk_...` or similar)

4. **Add to Your Environment Variables**

   **Local Development** (`.env.local`):
   ```bash
   VAPI_SERVER_API_KEY="your_server_api_key_here"
   ```

   **Vercel Deployment**:
   - Go to: https://vercel.com/ayush865s-projects-b0b3b22c/interview-prep/settings/environment-variables
   - Add variable:
     - Name: `VAPI_SERVER_API_KEY`
     - Value: `your_server_api_key_here`
   - Click **Save**
   - **Redeploy** your project

5. **Restart Your Dev Server**
   ```bash
   # Stop the current server (Ctrl+C)
   npm run dev
   ```

## How It Works Now

```
User clicks "Call"
    ↓
Agent.tsx → POST /api/vapi/start-workflow
    ↓
Server SDK creates web call with workflow
    ↓
Returns call details to client
    ↓
Web SDK connects to the created call
    ↓
Workflow runs (collect info → call /api/vapi/generate → end call)
```

## Verify It Works

After adding the key, test locally:

1. Start dev server: `npm run dev`
2. Go to generate interview page
3. Click "Call"
4. Check console - should see:
   ```
   Creating workflow call via server: {...}
   Workflow call created: {...}
   Connecting to web call: ...
   ```

## Troubleshooting

### Error: "VAPI_SERVER_API_KEY is not configured"
- Double-check you added the key to `.env.local`
- Restart your dev server
- Make sure the key name matches exactly: `VAPI_SERVER_API_KEY`

### Error: "401 Unauthorized" from Vapi API
- Your server API key is invalid or expired
- Generate a new key from dashboard
- Make sure you're using a **server/private** key, not a web/public key

### Still getting "Couldn't Get Assistant" error
- The server route isn't being called (check Network tab)
- The Web SDK is still trying to start the workflow directly
- Check that `/api/vapi/start-workflow` route exists and is working

## Alternative: Use Assistant Instead of Workflow

If you can't get a server API key right now, you can:

1. Create an **Assistant** in Vapi dashboard
2. Configure it to use your workflow
3. Use the assistant ID instead of workflow ID
4. The Web SDK can start assistants directly

But using the Server SDK approach is the proper solution for workflows.
