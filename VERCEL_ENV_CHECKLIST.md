# Vercel Environment Variables Checklist

## Required for /api/vapi/generate endpoint

Go to your Vercel project → Settings → Environment Variables and add:

### Google AI (Gemini)
- ✅ `GOOGLE_GENERATIVE_AI_API_KEY`
  - Value: `AIzaSyDJxILgyCkU65iZ7vHQfVWWZqw8ouEqJxM`

### Firebase Admin SDK
- ✅ `FIREBASE_PROJECT_ID`
  - Value: `interviewprep-bc752`

- ✅ `FIREBASE_CLIENT_EMAIL`
  - Value: `firebase-adminsdk-fbsvc@interviewprep-bc752.iam.gserviceaccount.com`

- ✅ `FIREBASE_PRIVATE_KEY`
  - Value: (Copy the entire private key from .env.local INCLUDING the quotes and newlines)
  - ⚠️ **IMPORTANT**: In Vercel, paste it exactly as:
    ```
    -----BEGIN PRIVATE KEY-----\nMIIEvwIBADANBgkqhkiG9w0BAQEFAASCBKkwggSlAgEAAoIBAQDBqXnCsTqisWoS\n1tWnw9dYkxbprdcpB31guvnLHBU+hniEOaWLF4Do9SbEGl36A1Rwtej9p2ODQRHH\n...(rest of key)...\n-----END PRIVATE KEY-----\n
    ```
  - The `\n` should be literal backslash-n, NOT actual newlines in Vercel

### Vapi (Optional, if you decide to use workflows)
- `NEXT_PUBLIC_VAPI_WEB_TOKEN`
- `NEXT_PUBLIC_VAPI_WORKFLOW_ID`

## How to verify

### ⚠️ IMPORTANT: Disable Deployment Protection First

Your Vercel deployment has protection enabled, which blocks Vapi from accessing your API.

**Option 1: Disable Protection (Recommended for API endpoints)**

1. Go to: https://vercel.com/ayush865s-projects-b0b3b22c/interview-prep/settings/deployment-protection
2. Under "Vercel Authentication", click **Edit**
3. Select **"Only Preview Deployments"** or **"Disabled"**
4. Save changes
5. Redeploy if needed

**Option 2: Whitelist Vapi's IP addresses**

If you want to keep protection enabled:
1. Contact Vapi support to get their server IP ranges
2. Add them to Vercel's IP allowlist
3. Or use Vercel's Protection Bypass for automation (more complex)

### After disabling protection, test:

1. Go to: https://vercel.com/ayush865s-projects-b0b3b22c/your-project/settings/environment-variables

2. Add each variable with the correct value

3. **Redeploy** your project after adding variables (Vercel doesn't auto-redeploy)

4. Test the endpoint:
   ```bash
   curl -X POST https://interview-prep-ee610bwzr-ayush865s-projects-b0b3b22c.vercel.app/api/vapi/generate \
     -H "Content-Type: application/json" \
     -d '{
       "type": "Technical",
       "role": "Full Stack Developer", 
       "level": "Mid-Level",
       "techstack": "React, Node.js",
       "amount": "3",
       "userid": "test-123"
     }'
   ```

5. Check Vercel logs for detailed error messages

## Common Issues

### 🔒 401 Unauthorized / Authentication Required (CURRENT ISSUE)
**Cause**: Vercel Deployment Protection is blocking external requests

**Solution**:
1. Go to your Vercel project settings: https://vercel.com/ayush865s-projects-b0b3b22c/interview-prep/settings/deployment-protection
2. Change "Vercel Authentication" from "All Deployments" to **"Only Preview Deployments"**
3. This allows production API endpoints to be accessed by Vapi
4. Click Save
5. Wait 1-2 minutes for changes to propagate

**Alternative**: Create a bypass token for Vapi (more complex, not recommended for this use case)

### 401 Unauthorized (after disabling protection)
- Missing environment variables
- Firebase private key not properly formatted
- CORS issues (now fixed with CORS headers)

### 500 Internal Server Error
- Check Vercel logs for specific error
- Verify Gemini API key is valid
- Ensure Firebase credentials are correct

## After fixing

Push this updated code to trigger a new deployment:
```bash
git add .
git commit -m "Add CORS headers and better error handling for Vapi integration"
git push
```
