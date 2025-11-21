# Vapi Assistant & Tool Cloning System

Complete implementation files for secure, idempotent cloning of Vapi assistants and tools.

## File Structure

```
app/api/vapi/
├── link/route.ts          # Link user's Vapi API key
└── clone/route.ts         # Clone assistant and tool

lib/
├── vapi/
│   ├── client.ts          # Vapi API wrapper
│   ├── sanitize.ts        # Assistant sanitizer
│   └── types.ts           # TypeScript types
├── version.ts             # Version parsing/comparison
├── crypto.ts              # Encryption utilities
└── db.ts                  # Database helpers

data/
├── template-assistant.json # Template assistant
└── template-tool.json      # Template tool

db/
└── schema.sql             # Database schema

__tests__/
├── version.test.ts        # Version tests
├── sanitize.test.ts       # Sanitizer tests
└── crypto.test.ts         # Crypto tests

.env.example               # Environment variables
jest.config.js             # Jest configuration
```

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your configuration
   ```

3. **Initialize database:**
   ```bash
   # For PostgreSQL
   psql -d your_database -f db/schema.sql
   
   # For SQLite (development)
   sqlite3 dev.db < db/schema.sql
   ```

4. **Run development server:**
   ```bash
   npm run dev
   ```

5. **Run tests:**
   ```bash
   npm test
   ```

## Usage

### 1. Link User's Vapi API Key

```bash
curl -X POST http://localhost:3000/api/vapi/link \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user_123",
    "apiKey": "sk_vapi_..."
  }'
```

**Response:**
```json
{
  "ok": true,
  "message": "API key validated and stored successfully"
}
```

### 2. Clone Assistant and Tool

```bash
curl -X POST http://localhost:3000/api/vapi/clone \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user_123"
  }'
```

**Response:**
```json
{
  "assistantId": "asst_abc123",
  "toolId": "tool_xyz789",
  "actions": [
    "created-tool:tool_xyz789",
    "created-assistant:asst_abc123"
  ]
}
```

## Security Notes

⚠️ **IMPORTANT:** This implementation uses AES-256-GCM with a master key for demonstration. 

**For production:**
- Replace with cloud KMS (AWS KMS, Google Cloud KMS, Azure Key Vault)
- Rotate encryption keys regularly
- Use environment-specific secrets management
- Enable audit logging
- Implement rate limiting
- Add request signing

## Production Hardening Checklist

- [ ] Replace crypto.ts encryption with cloud KMS
- [ ] Implement proper user authentication
- [ ] Add rate limiting (e.g., 10 requests/minute per user)
- [ ] Set up structured logging (Winston, Pino)
- [ ] Configure CORS properly
- [ ] Add request validation middleware
- [ ] Implement API key rotation mechanism
- [ ] Set up monitoring and alerting
- [ ] Add database connection pooling
- [ ] Configure proper error tracking (Sentry, etc.)
- [ ] Enable HTTPS only in production
- [ ] Add request ID tracking
- [ ] Implement idempotency keys for requests
- [ ] Set up backup and disaster recovery
- [ ] Add comprehensive integration tests

## Environment Variables

See `.env.example` for required variables.

## Files Included

All files are provided as separate artifacts. Copy them to your Next.js project maintaining the directory structure shown above.
