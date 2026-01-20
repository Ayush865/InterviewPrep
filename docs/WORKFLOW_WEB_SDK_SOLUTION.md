# How to Use Workflow with Web SDK

## The Problem

The Vapi Web SDK **cannot start workflows directly**. When you try:
```typescript
await vapi.start(workflowId, { ... })
```

You get:
```
"Couldn't Get Assistant. `assistantId` {workflowId} Does Not Exist."
```

## The Solution: Create an Assistant That Uses Your Workflow

### Option 1: Via Vapi Dashboard (Easiest)

1. **Go to Vapi Dashboard**
   - Visit: https://dashboard.vapi.ai

2. **Create a New Assistant**
   - Go to **"Assistants"** section
   - Click **"Create Assistant"** or **"New"**

3. **Configure the Assistant**
   - **Name**: "Interview Generator Assistant"
   - **Model**: Select your preferred model (e.g., GPT-4)
   - **Voice**: "Elliot" (Vapi voice)
   - **First Message**: "Hi! I'll help you create a custom AI interviewer..."

4. **Link to Your Workflow**
   - In the assistant settings, look for **"Workflow"** or **"Use Workflow"** option
   - Select your workflow: `Prakash_InterviewPrep` (ID: `51d55520-7183-4531-baa9-e2fba5894e1b`)
   - Or paste the workflow ID directly

5. **Save and Copy Assistant ID**
   - Click **Save**
   - Copy the **Assistant ID** (will look like: `asst_xxxxx...`)

6. **Update Your .env.local**
   ```bash
   NEXT_PUBLIC_VAPI_ASSISTANT_ID="asst_your_assistant_id_here"
   ```

7. **Update Agent.tsx**
   ```typescript
   const assistantId = process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID;
   await vapi.start(assistantId, {
     variableValues: {
       userid: userId,
     },
   });
   ```

### Option 2: Create Assistant Programmatically

Use the assistant creation approach in your code:

```typescript
const workflowAssistant = {
  workflowId: process.env.NEXT_PUBLIC_VAPI_WORKFLOW_ID,  // Link to workflow
  name: "Interview Generator",
  voice: {
    voiceId: "Elliot",
    provider: "vapi",
  },
  transcriber: {
    provider: "deepgram",
    model: "nova-2",
    language: "en",
  },
};

await vapi.start(workflowAssistant, {
  variableValues: {
    userid: userId,
  },
});
```

### Option 3: Use Transient Assistant (Current Implementation)

Keep your current setup but pass the workflow inline:

```typescript
await vapi.start({
  workflow: {
    id: workflowId,  // Your workflow ID
  },
  // OR use the full workflow definition
  // workflow: yourWorkflowJSON,
}, {
  variableValues: {
    userid: userId,
  },
});
```

## Why This Works

- **Assistants** can be started by the Web SDK ✅
- **Assistants** can use/reference workflows ✅
- **Workflows** define the conversation flow ✅
- **Result**: Your workflow runs through an assistant wrapper

## What Doesn't Work

❌ `vapi.start(workflowId)` - Web SDK treats it as assistant ID
❌ Server SDK `calls.create()` - Requires phone number for phone calls
❌ Server SDK for web calls - No dedicated web call method

## Recommended Approach

**Create a persisted assistant in Vapi dashboard** that references your workflow. This is:
- Cleaner than transient assistants
- Easier to manage and update
- Better for production use
- Trackable in Vapi analytics

Then simply:
```typescript
await vapi.start(assistantId, { variableValues: { userid } });
```

Done! 🎉
