# Workflow Debugging Guide

## Environment Setup

Your workflow ID: `51d55520-7183-4531-baa9-e2fba5894e1b`

## Debug Endpoints

### 1. Check Environment Variables
```bash
curl http://localhost:3000/api/debug/env
```

This will show if all required environment variables are loaded.

### 2. Test Workflow Configuration
```bash
curl http://localhost:3000/api/vapi/test-workflow
```

This will:
- Verify workflow ID is valid
- Check if workflow exists in Vapi
- Show workflow configuration details

## Debugging Steps

### Step 1: Verify Environment Variables

1. Check `.env.local` has:
   ```
   NEXT_PUBLIC_VAPI_WORKFLOW_ID="51d55520-7183-4531-baa9-e2fba5894e1b"
   NEXT_PUBLIC_VAPI_WEB_TOKEN="56523826-a0c1-484e-90c7-a38735d7371f"
   ```

2. **Restart your dev server** (env vars only load on startup):
   ```bash
   # Stop server (Ctrl+C)
   npm run dev
   ```

3. Test: `curl http://localhost:3000/api/debug/env`

### Step 2: Check Workflow in Vapi Dashboard

1. Go to: https://dashboard.vapi.ai
2. Navigate to "Workflows"
3. Find workflow `51d55520-7183-4531-baa9-e2fba5894e1b`
4. Verify:
   - Workflow exists
   - Has "introduction" node as start
   - Has "API Request" node
   - Edge from introduction → API Request exists
   - API Request URL is correct

### Step 3: Test Workflow Start

1. Open browser console (F12)
2. Click "Call" button in your app
3. Look for logs:
   ```
   === STARTING WORKFLOW ===
   Workflow ID: 51d55520-7183-4531-baa9-e2fba5894e1b
   User ID: <your-user-id>
   Workflow started successfully
   ```

### Step 4: Check Vapi Dashboard Logs

1. Go to Vapi Dashboard
2. Click "Logs" or "Calls"
3. Find your recent call
4. Check:
   - Did workflow start?
   - Which nodes executed?
   - Did it reach "API Request" node?
   - Any errors?

### Step 5: Check Vercel Logs (for deployed version)

1. Go to: https://vercel.com/ayush865s-projects-b0b3b22c/interview-prep
2. Click "Logs"
3. Look for requests to `/api/vapi/generate`
4. Check request body format

## Common Issues

### Issue: Workflow doesn't transition to API Request

**Cause**: Edge condition not met (AI didn't detect all variables collected)

**Fix**: Update edge condition in Vapi workflow:
```json
{
  "from": "introduction",
  "to": "API Request",
  "condition": {
    "type": "ai",
    "prompt": "If user has provided values for ALL of these: role, type, level, amount, techstack"
  }
}
```

### Issue: API call sends wrong data

**Cause**: Using default values instead of {{variable}} references

**Fix**: Update API Request body to use:
```json
{
  "role": {
    "type": "string",
    "default": "{{role}}"
  }
}
```

### Issue: Empty error object {}

**Cause**: Vapi SDK rejecting call silently

**Fix**: Check browser console for detailed error logs we added

## Updated Workflow JSON

Replace your workflow with this corrected version:

```json
{
  "name": "Prakash_InterviewPrep",
  "nodes": [
    {
      "name": "introduction",
      "type": "conversation",
      "isStart": true,
      "variableExtractionPlan": {
        "input": [
          {
            "type": "string",
            "title": "userid",
            "description": "User ID from application"
          }
        ],
        "output": [
          {
            "type": "string",
            "title": "role",
            "description": "Job role"
          },
          {
            "type": "string",
            "title": "type",
            "description": "Interview type"
          },
          {
            "type": "string",
            "title": "level",
            "description": "Experience level"
          },
          {
            "type": "string",
            "title": "amount",
            "description": "Number of questions"
          },
          {
            "type": "string",
            "title": "techstack",
            "description": "Technologies"
          }
        ]
      },
      "prompt": "Greet the user and collect: role, type, level, amount, techstack. Ask one by one."
    },
    {
      "name": "API Request",
      "type": "tool",
      "tool": {
        "url": "https://interview-prep-9enbp8ay4-ayush865s-projects-b0b3b22c.vercel.app/api/vapi/generate",
        "type": "apiRequest",
        "method": "POST",
        "body": {
          "type": "object",
          "required": ["role", "type", "level", "amount", "userid", "techstack"],
          "properties": {
            "role": { "type": "string", "default": "{{role}}" },
            "type": { "type": "string", "default": "{{type}}" },
            "level": { "type": "string", "default": "{{level}}" },
            "amount": { "type": "string", "default": "{{amount}}" },
            "userid": { "type": "string", "default": "{{userid}}" },
            "techstack": { "type": "string", "default": "{{techstack}}" }
          }
        }
      }
    },
    {
      "name": "hangup",
      "type": "tool",
      "tool": {
        "type": "endCall"
      }
    }
  ],
  "edges": [
    {
      "from": "introduction",
      "to": "API Request",
      "condition": {
        "type": "ai",
        "prompt": "If ALL variables collected: role, type, level, amount, techstack"
      }
    },
    {
      "from": "API Request",
      "to": "hangup",
      "condition": { "type": "always" }
    }
  ],
  "voice": { "voiceId": "Elliot", "provider": "vapi" }
}
```

## Next Steps

1. Run debug endpoints
2. Share output with me
3. Check Vapi dashboard logs
4. We'll identify the exact issue
