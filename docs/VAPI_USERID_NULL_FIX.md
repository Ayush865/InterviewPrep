# Fixing "NULL" userId in Vapi Integration

## Problem
Interviews are being created with `userId: "NULL"` instead of the actual Clerk user ID.

## Root Cause
The Vapi assistant has a default value of `"NULL"` for the `userid` variable, which overrides the value passed from the client.

## Solution

### Step 1: Check Vapi Assistant Configuration

1. Go to your [Vapi Dashboard](https://dashboard.vapi.ai)
2. Select your assistant (ID: `e1793143-f26f-4afb-a561-7f76fc98904e`)
3. Navigate to **Variables** section
4. Find the `userid` variable
5. Check if it has a default value set to `"NULL"` or `NULL`

### Step 2: Update Vapi Assistant Variable

**Option A: Remove Default Value**
- Remove any default value for the `userid` variable
- The variable should accept the value passed from `variableValues`

**Option B: Configure Variable Properly**
- Set the variable type to `string`
- Ensure it's marked as **required** (no default)
- Make sure it's used in your function call parameters

### Step 3: Update Function Call Configuration

In your Vapi assistant's function call configuration, ensure:

```json
{
  "name": "generateInterviewQuestions",
  "parameters": {
    "type": "object",
    "properties": {
      "userid": {
        "type": "string",
        "description": "The user's unique identifier"
      },
      "type": { ... },
      "role": { ... },
      // ... other parameters
    },
    "required": ["userid", "type", "role", "level", "techstack", "amount"]
  }
}
```

### Step 4: Verify Variable Mapping

Make sure the assistant's prompt or system message uses the variable correctly:

```
You have access to a variable called {{userid}} which contains the user's ID.
When calling the generateInterviewQuestions function, use this variable.
```

## Verification Steps

### 1. Check Client-Side Logging
Open browser console and look for:
```
Starting assistant with Web SDK: {
  assistantId: "...",
  userId: "user_xxxxx",  // Should be actual Clerk ID
  userName: "...",
  vapiInstance: true
}

Call started successfully: {
  callId: "...",
  variablesSet: { userid: "user_xxxxx" },  // Should match userId above
  actualUserId: "user_xxxxx",
  userIdType: "string"
}
```

### 2. Check Server-Side Logging
In your terminal/Vercel logs, look for:
```
Received request body: { ... }
Raw userid received: {
  userid: "user_xxxxx",  // Should be actual Clerk ID, NOT "NULL"
  type: "string",
  isNull: false,
  isStringNull: false
}
```

### 3. Check Firebase Document
After creating an interview, verify in Firebase Console:
```javascript
{
  userId: "user_2xyz...",  // Should start with "user_" (Clerk format)
  role: "...",
  type: "...",
  // ... other fields
}
```

## Common Issues

### Issue 1: Variable Name Mismatch
**Symptom**: userid is always "NULL"
**Fix**: Ensure the Vapi variable name matches exactly: `userid` (lowercase, no camelCase)

### Issue 2: Variable Not Passed to Function
**Symptom**: Function call doesn't receive userid
**Fix**: In Vapi assistant, map the variable to the function parameter:
```
{{userid}} → function parameter "userid"
```

### Issue 3: Client Not Authenticated
**Symptom**: userId is undefined or null on client
**Fix**: Ensure Clerk authentication is working:
```typescript
const clerkUser = await currentUser();
console.log("Clerk user:", clerkUser?.id); // Should be defined
```

## Updated Code Changes

### Agent.tsx
Added validation to catch "NULL" string:
```typescript
if (userId === "NULL" || userId === "null") {
  throw new Error("userId is set to NULL - user authentication failed");
}
```

### route.ts (Vapi API)
Added validation and detailed logging:
```typescript
console.log("Raw userid received:", { 
  userid, 
  type: typeof userid, 
  isNull: userid === null, 
  isStringNull: userid === "NULL" 
});

if (!userid || userid === "NULL" || userid === "null") {
  return Response.json({ 
    success: false, 
    error: "Missing required fields or userid is NULL"
  }, { status: 400 });
}
```

## Testing Checklist

- [ ] Vapi assistant variable `userid` has no default value
- [ ] Function call includes `userid` in required parameters
- [ ] Client logs show actual Clerk user ID
- [ ] API logs show actual Clerk user ID (not "NULL")
- [ ] Firebase interview document has correct userId
- [ ] User's `interviews` map is updated with new interview reference

## Additional Resources

- [Vapi Variables Documentation](https://docs.vapi.ai/assistants/dynamic-variables)
- [Vapi Function Calling](https://docs.vapi.ai/assistants/function-calling)
- [Clerk User Object](https://clerk.com/docs/references/nextjs/current-user)
