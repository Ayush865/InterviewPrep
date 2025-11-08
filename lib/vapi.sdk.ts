import Vapi from "@vapi-ai/web";

const webToken = process.env.NEXT_PUBLIC_VAPI_WEB_TOKEN;

if (!webToken) {
  console.error("NEXT_PUBLIC_VAPI_WEB_TOKEN is not defined");
}

console.log("Initializing VAPI with token:", webToken ? "Token present" : "Token missing");

export const vapi = new Vapi(webToken!);
