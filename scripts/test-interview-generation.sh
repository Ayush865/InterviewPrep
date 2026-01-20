#!/bin/bash

API_URL="https://interview-prep-6930w0xnz-ayush865s-projects-b0b3b22c.vercel.app/api/vapi/generate/"

# 10 predefined calls with different combinations
calls=(
  '{"type":"Behavioural","role":"Software Developer","level":"Junior","techstack":"React,JS,Tailwind CSS","amount":"1","userid":"user_35Fub1HWUb88mvKi7JjdY4byEmQ"}'
  '{"type":"Technical","role":"Frontend Developer","level":"Mid","techstack":"React,TypeScript,Next.js","amount":"2","userid":"user_35Fwa1tZBtOkOA1D7ABq9pqFtrW"}'
  '{"type":"Mixed","role":"Backend Developer","level":"Senior","techstack":"Node.js,Express,MongoDB","amount":"1","userid":"user_35I4C8vDTBO2QiikZOHfuVFFmh8"}'
  '{"type":"Behavioural","role":"Full Stack Developer","level":"Junior","techstack":"Python,Django,PostgreSQL","amount":"3","userid":"user_35W95bDlMq2u6GKAWZRBroyFKcH"}'
  '{"type":"Technical","role":"DevOps Engineer","level":"Mid","techstack":"Go,Docker,Kubernetes","amount":"1","userid":"user_35Fub1HWUb88mvKi7JjdY4byEmQ"}'
  '{"type":"Mixed","role":"Software Developer","level":"Senior","techstack":"Java,Spring Boot,AWS","amount":"2","userid":"user_35Fwa1tZBtOkOA1D7ABq9pqFtrW"}'
  '{"type":"Technical","role":"Frontend Developer","level":"Junior","techstack":"Vue.js,JavaScript,CSS","amount":"1","userid":"user_35I4C8vDTBO2QiikZOHfuVFFmh8"}'
  '{"type":"Behavioural","role":"Backend Developer","level":"Mid","techstack":"Python,FastAPI,Redis","amount":"2","userid":"user_35W95bDlMq2u6GKAWZRBroyFKcH"}'
  '{"type":"Mixed","role":"Full Stack Developer","level":"Senior","techstack":"React,Node.js,PostgreSQL","amount":"1","userid":"user_35Fub1HWUb88mvKi7JjdY4byEmQ"}'
  '{"type":"Technical","role":"Software Developer","level":"Junior","techstack":"C++,Python,Linux","amount":"3","userid":"user_35Fwa1tZBtOkOA1D7ABq9pqFtrW"}'
)

echo "Starting 10 API calls to generate interviews..."
echo "================================================"

for i in {0..9}; do
  echo ""
  echo "=== Call $((i+1)) of 10 ==="
  echo "Data: ${calls[$i]}"
  echo ""

  curl --location "$API_URL" \
    --header 'Content-Type: application/json' \
    --data "${calls[$i]}"

  echo -e "\n"

  if [ $i -lt 9 ]; then
    echo "Waiting 2 seconds before next call..."
    sleep 2
  fi
done

echo "================================================"
echo "Done! Made 10 API calls."
