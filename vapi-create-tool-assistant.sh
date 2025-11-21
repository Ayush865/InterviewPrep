#!/usr/bin/env bash
set -euo pipefail

# vapi-create-tool-assistant.sh
# Usage:
#   VAPI_API_KEY=sk_xxx ./vapi-create-tool-assistant.sh
# or
#   ./vapi-create-tool-assistant.sh --api-key sk_xxx
#
# Requirements: curl, jq
# NOTE: Run server-side only. Do NOT expose API keys to the browser.

VAPI_BASE="${VAPI_BASE:-https://api.vapi.ai}"
TMPDIR="$(mktemp -d)"

cleanup() {
  rm -rf "$TMPDIR"
}
trap cleanup EXIT

# parse args
API_KEY="${VAPI_API_KEY:-}"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --api-key) API_KEY="$2"; shift 2 ;;
    --help|-h) echo "Usage: VAPI_API_KEY=sk_xxx $0  OR  $0 --api-key sk_xxx"; exit 0 ;;
    *) echo "Unknown arg: $1"; exit 2 ;;
  esac
done

if [[ -z "${API_KEY}" ]]; then
  echo "Error: Provide Vapi API key via VAPI_API_KEY env var or --api-key argument."
  exit 2
fi

# check dependencies
if ! command -v jq >/dev/null 2>&1; then
  echo "Error: jq is required but not installed. Install jq and re-run."
  exit 2
fi
if ! command -v curl >/dev/null 2>&1; then
  echo "Error: curl is required but not installed."
  exit 2
fi

echo "Using Vapi base: $VAPI_BASE"
echo

# create tool payload (from your provided JSON)
cat > "$TMPDIR/tool_payload.json" <<'JSON'
{
  "name": "SendDataToGemini",
  "type": "apiRequest",
  "function": {
    "name": "api_request_tool",
    "description": "send data in structured format to a api end point to generate interview for user "
  },
  "messages": [
    { "type": "request-start", "blocking": false },
    { "type": "request-failed", "content": "Oops! Looks like something went wrong while sending the data to the app. Please try again.", "endCallAfterSpokenEnabled": true },
    { "role": "assistant", "type": "request-complete", "content": "The request has been sent and your interview has been generated. Thank you for the call!\nBye!", "endCallAfterSpokenEnabled": true }
  ],
  "url": "https://interview-prep-eoi85q5aa-ayush865s-projects-b0b3b22c.vercel.app/api/vapi/generate/",
  "method": "POST",
  "body": {
    "type": "object",
    "required": [],
    "properties": {
      "role": { "description": "What role should would you like to train for? For example Frontend, Backend, Fullstack, Design, UX? ", "type": "string", "default": "Software Development Engineer" },
      "type": { "description": "What type of the interview should it be? ", "type": "string", "default": "Technical" },
      "level": { "description": "The job experience level. ", "type": "string", "default": "Junior" },
      "amount": { "description": "The number of questions to be generated", "type": "number", "default": "1" },
      "userid": { "description": "The userId of the user.", "type": "string", "default": "NULL" },
      "techstack": { "description": "Technologies to ask questions from ", "type": "string", "default": "React.js" }
    }
  },
  "variableExtractionPlan": {
    "schema": { "type": "object", "required": [], "properties": {} },
    "aliases": []
  }
}
JSON

# POST /tool
echo "Creating tool..."
TOOL_CREATE_RESPONSE="$TMPDIR/tool_create_response.json"
HTTP_STATUS=$(curl -sS -w "%{http_code}" -o "$TOOL_CREATE_RESPONSE" \
  -X POST "$VAPI_BASE/tool" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H "Content-Type: application/json" \
  --data-binary @"$TMPDIR/tool_payload.json")

if [[ "$HTTP_STATUS" -lt 200 || "$HTTP_STATUS" -ge 300 ]]; then
  echo "Tool creation failed (HTTP $HTTP_STATUS). Response:"
  cat "$TOOL_CREATE_RESPONSE"
  exit 3
fi

# extract new tool id
NEW_TOOL_ID=$(jq -r '.id // ._id // .data.id // empty' "$TOOL_CREATE_RESPONSE")
if [[ -z "$NEW_TOOL_ID" || "$NEW_TOOL_ID" == "null" ]]; then
  echo "Failed to extract tool id from response. Full response:"
  cat "$TOOL_CREATE_RESPONSE"
  exit 4
fi

echo "Tool created successfully. Tool ID: $NEW_TOOL_ID"
echo

# create assistant payload (template), sanitize and inject tool id
cat > "$TMPDIR/template_assistant.json" <<'JSON'
{
  "name": "Interview Prep",
  "voice": { "voiceId": "Elliot", "provider": "vapi" },
  "model": {
    "model": "gpt-5.1",
    "toolIds": [],
    "messages": [
      {
        "role": "system",
        "content": "You are a voice assistant that will build a perfect interview pkg for the caller.\nGreet the user\nTell them you will gather a few details to generate the interview.\nThen ask each question one-by-one and wait for the user to answer. Do NOT ask multiple questions at once.\nThe questions to ask (in order):\n1) What is the job experience level? (example: Junior, Mid, Senior)\n2) How many questions should I generate?\n3) What tech stack should I cover? (e.g., React, Node)\n4) What role should I prepare for? (e.g., Frontend, Backend)\n5) What type of the interview should it be? (e.g. Technical, Behavoural or Mix of both)\nWhen all answers are collected and validated, call the tool 'SendDataToGemini' with the structured output fields, then speak the requestComplete message and end the call.\nThis is a voice conversation — keep answers short and do not use special characters.\nSpeak more like a human with punctuations and pauses. But keep the conversation concise and quick."
      }
    ],
    "provider": "openai"
  },
  "firstMessage": "Hello.",
  "voicemailMessage": "Please call back when you're available.",
  "endCallMessage": "Goodbye.",
  "transcriber": { "model": "nova-2", "language": "en", "provider": "deepgram" },
  "analysisPlan": {
    "minMessagesThreshold": 2,
    "structuredDataPlan": {
      "enabled": true,
      "messages": [
        {
          "content": "Create a structured output resource in Vapi that matches your variableExtractionPlan. Example JSON schema \n{\n  \"name\": \"interview_prep_input\",\n  \"description\": \"Collect interview parameters from the caller\",\n  \"schema\": {\n    \"type\": \"object\",\n    \"properties\": {\n      \"level\": { \"type\": \"string\", \"description\": \"job experience level\" },\n      \"amount\": { \"type\": \"number\", \"description\": \"how many questions to generate\" },\n      \"techstack\": { \"type\": \"string\", \"description\": \"technologies to cover\" },\n      \"role\": { \"type\": \"string\", \"description\": \"role, e.g. Frontend/Backend\" },\n      \"type\": { \"type\": \"string\", \"description\": \"interview type\" },\n      \"userId\": { \"type\": \"string\", \"enum\": [\"test1\", \"test2\"], \"description\": \"user id\" }\n    },\n    \"required\": [\"level\",\"amount\",\"techstack\",\"role\",\"type\",\"userId\"]\n  }\n}\n\nJson Schema:\n{{schema}}\n\nOnly respond with the JSON.",
          "role": "system"
        },
        {
          "content": "Here is the transcript:\n\n{{transcript}}\n\n. Here is the ended reason of the call:\n\n{{endedReason}}\n\n",
          "role": "user"
        }
      ]
    }
  },
  "startSpeakingPlan": { "smartEndpointingPlan": { "provider": "vapi" } },
  "compliancePlan": { "pciEnabled": false },
  "isServerUrlSecretSet": false
}
JSON

# inject new tool id into assistant payload and remove any read-only fields if present
jq --arg tid "$NEW_TOOL_ID" '
  (.model.toolIds) = [$tid]
  | del(.id, ._id, .orgId, .createdAt, .updatedAt, .isServerUrlSecretSet)
' "$TMPDIR/template_assistant.json" > "$TMPDIR/assistant_payload.json"

echo "Assistant payload prepared (tool id injected)."
echo

# POST /assistant
echo "Creating assistant..."
ASSISTANT_CREATE_RESPONSE="$TMPDIR/assistant_create_response.json"
HTTP_STATUS=$(curl -sS -w "%{http_code}" -o "$ASSISTANT_CREATE_RESPONSE" \
  -X POST "$VAPI_BASE/assistant" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H "Content-Type: application/json" \
  --data-binary @"$TMPDIR/assistant_payload.json")

if [[ "$HTTP_STATUS" -lt 200 || "$HTTP_STATUS" -ge 300 ]]; then
  echo "Assistant creation failed (HTTP $HTTP_STATUS). Response:"
  cat "$ASSISTANT_CREATE_RESPONSE"
  exit 5
fi

NEW_ASSISTANT_ID=$(jq -r '.id // ._id // .data.id // empty' "$ASSISTANT_CREATE_RESPONSE")
if [[ -z "$NEW_ASSISTANT_ID" || "$NEW_ASSISTANT_ID" == "null" ]]; then
  echo "Failed to extract assistant id from response. Full response:"
  cat "$ASSISTANT_CREATE_RESPONSE"
  exit 6
fi

echo "Assistant created successfully. Assistant ID: $NEW_ASSISTANT_ID"
echo
echo "=== RESULT ==="
echo "Tool ID:      $NEW_TOOL_ID"
echo "Assistant ID: $NEW_ASSISTANT_ID"
echo "Tool response saved: $TOOL_CREATE_RESPONSE"
echo "Assistant response saved: $ASSISTANT_CREATE_RESPONSE"
echo

echo "Done. If you want idempotency, add a check (GET /assistant or GET /tool) before creating."
