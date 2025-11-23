# Vapi UI Integration Guide

Complete guide for integrating the Vapi clone system with your UI.

## 🎯 Overview

This integration allows users to:
1. Link their own Vapi API key
2. Automatically clone the interview assistant and tool to their account
3. Use their personal assistant for all interview calls
4. Billing goes to their Vapi account

---

## 📁 Files Created

### Components
- ✅ `components/VapiSettings.tsx` - UI for linking API key and cloning
- ✅ `components/VapiInterview.tsx` - Interview call component with custom assistant
- ✅ `hooks/useVapiAssistant.ts` - Hook to manage assistant configuration
- ✅ `app/settings/vapi/page.tsx` - Settings page

---

## 🚀 Quick Start

### 1. Add Settings Link to Your Navigation

```tsx
// In your nav component
<Link href="/settings/vapi">
  Vapi Settings
</Link>
```

### 2. Use the Interview Component

```tsx
// In your interview page
import { VapiInterview } from '@/components/VapiInterview';

export default function InterviewPage() {
  return (
    <div>
      <h1>Start Your Interview</h1>
      <VapiInterview />
    </div>
  );
}
```

### 3. That's it!

The system will automatically:
- Use the user's custom assistant if they've linked their API key
- Fall back to your default assistant if not
- Handle all the switching automatically

---

## 🔄 How It Works

### User Flow:

1. **User visits** `/settings/vapi`
2. **User enters** their Vapi API key
3. **System calls** `/api/vapi/link` to validate and store the key (encrypted)
4. **System calls** `/api/vapi/clone` to:
   - Create the tool in user's account
   - Create the assistant (using the tool) in user's account
5. **System stores** assistant ID, tool ID, and API key in localStorage
6. **When user starts an interview:**
   - `useVapiAssistant` hook loads the custom assistant ID
   - Vapi Web SDK uses the custom assistant ID
   - Call billing goes to user's Vapi account

### Technical Flow:

```
User Input (API Key)
    ↓
POST /api/vapi/link
    ↓
Validate with Vapi API
    ↓
Encrypt & Store in Database
    ↓
POST /api/vapi/clone
    ↓
1. Create Tool (SendDataToGemini)
    ↓
2. Create Assistant (using tool ID)
    ↓
Return { assistantId, toolId }
    ↓
Store in localStorage
    ↓
Use in Vapi Web SDK calls
```

---

## 🎨 Customization

### Styling

The components use Tailwind CSS with dark mode support. Customize by:

```tsx
// Change colors in VapiSettings.tsx
className="bg-blue-600" // Change to your brand color
```

### Error Handling

Add custom error handling:

```tsx
// In VapiSettings.tsx
catch (err: any) {
  // Add custom error tracking
  trackError(err);
  setError(err.message);
}
```

### Custom Messages

Update the success/error messages:

```tsx
// In VapiSettings.tsx
setSuccess(`🎉 Success! Your assistant is ready: ${cloneData.assistantId}`);
```

---

## 🔐 Security Considerations

### What's Secure:
✅ API keys encrypted in database (AES-256-GCM)
✅ Validation happens server-side
✅ User can only clone to their own account
✅ API keys not exposed in network requests

### What to Consider:
⚠️ localStorage stores assistant ID (not sensitive, but visible in browser)
⚠️ User's API key temporarily in localStorage (for Vapi Web SDK)
⚠️ Routes are currently public (add auth later)

### Production Recommendations:
1. Add Clerk authentication to routes (see previous guide)
2. Clear localStorage on sign out
3. Add rate limiting
4. Implement API key rotation

---

## 🧪 Testing

### Test the Complete Flow:

1. **Sign in** to your app
2. **Visit** `/settings/vapi`
3. **Enter API key** (get from https://dashboard.vapi.ai)
4. **Click** "Link API Key & Clone Assistant"
5. **Verify** success message shows assistant ID
6. **Go to** interview page
7. **Start call** - should use your custom assistant
8. **Check** Vapi dashboard - should see the cloned assistant and tool

### Debug Mode:

Open browser console to see logs:
- "Using custom Vapi assistant: asst_..."
- "Call started with assistant: asst_..."

---

## 📊 Storage

### LocalStorage Keys:
- `vapi_assistant_id` - User's cloned assistant ID
- `vapi_tool_id` - User's cloned tool ID
- `vapi_user_api_key` - User's Vapi API key (for Web SDK)

### Database:
- Encrypted API key stored in `user_vapi_keys` table
- Linked to Clerk user ID

---

## 🔄 Updating Templates

When you update the template assistant or tool:

1. **Update version** in template files:
   ```json
   // data/template-assistant.json
   {
     "name": "Interview Prep_v2",  // Increment version
     ...
   }
   ```

2. **User visits settings** and re-links API key
3. **Clone endpoint** will:
   - Detect newer version
   - Create new version
   - Delete old version
   - Update stored assistant ID

---

## 🎯 Advanced Features

### Clear Custom Config

Add a "Reset to Default" button:

```tsx
import { useVapiAssistant } from '@/hooks/useVapiAssistant';

export function ResetButton() {
  const { clearCustomConfig } = useVapiAssistant();

  return (
    <button onClick={clearCustomConfig}>
      Reset to Default Assistant
    </button>
  );
}
```

### Check if User Has Custom Config

```tsx
const { isCustom } = useVapiAssistant();

if (isCustom) {
  // Show "Using your assistant" badge
} else {
  // Show "Link your API key" prompt
}
```

### Pre-fill API Key (for testing)

```tsx
// Only in development!
useEffect(() => {
  if (process.env.NODE_ENV === 'development') {
    setApiKey(process.env.NEXT_PUBLIC_TEST_VAPI_KEY || '');
  }
}, []);
```

---

## 🐛 Troubleshooting

### "API key not found" when cloning
- User must link API key first (link endpoint must succeed)
- Check database to verify encrypted key was stored

### Clone fails with 403
- User's API key lacks permissions
- Tell user to check Vapi dashboard permissions

### Interview uses wrong assistant
- Clear browser cache/localStorage
- Check console logs for which assistant ID is being used

### Tool not working in interview
- Verify tool was created successfully (check `actions` array)
- Tool server URL must be accessible
- Check Vapi dashboard for tool configuration

---

## 📖 API Reference

### VapiSettings Component

```tsx
<VapiSettings />
```

**Props:** None

**Events:**
- On success: Stores config in localStorage
- On error: Shows error message to user

### VapiInterview Component

```tsx
<VapiInterview />
```

**Props:** None

**Features:**
- Auto-detects custom vs default assistant
- Handles call lifecycle (start/end)
- Shows call status

### useVapiAssistant Hook

```tsx
const {
  assistantId,    // Current assistant ID (custom or default)
  toolId,         // Tool ID (if custom)
  apiKey,         // API key for Vapi Web SDK
  isCustom,       // Boolean: using custom config?
  isLoading,      // Boolean: loading state
  clearCustomConfig, // Function: reset to default
} = useVapiAssistant();
```

---

## 🎉 Summary

You now have a complete UI flow that:

1. ✅ Allows users to link their Vapi API key
2. ✅ Automatically clones assistant and tool
3. ✅ Uses custom assistant for interviews
4. ✅ Falls back to default if not configured
5. ✅ Handles errors gracefully
6. ✅ Works with versioning system
7. ✅ Stores configuration securely

**Next Steps:**
- Add the components to your app
- Test the flow end-to-end
- Customize styling to match your brand
- Add authentication (optional)
- Deploy to production

---

**Need help?** Check the console logs for detailed debugging info!
