// server.js
// node >=18 recommended
import express from "express";
import cors from "cors";

const app = express();
app.use(cors()); // allow browser to call this server
app.use(express.json());

app.post("/api/create-call", async (req, res) => {
  console.log("[server] /api/create-call incoming", { body: req.body });

  const WORKFLOW_ID = "51d55520-7183-4531-baa9-e2fba5894e1b" || req.body.workflowId;
  const API_KEY = "f5381901-3d93-4678-bd02-9aef26af050a";

  if (!API_KEY) {
    console.error("[server] missing VAPI_SERVER_API_KEY env");
    return res.status(500).json({ error: "missing VAPI_SERVER_API_KEY on server" });
  }
  if (!WORKFLOW_ID) {
    console.error("[server] missing WORKFLOW_ID env");
    return res.status(400).json({ error: "missing WORKFLOW_ID" });
  }

  try {
    const callBody = {
      workflowId: WORKFLOW_ID,
      transport: { provider: "vapi.websocket" } // request websocket monitor URLs
    };

    console.log("[server] calling vapi POST /call with body:", callBody);

    const vapiResp = await fetch("https://api.vapi.ai/call", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(callBody),
      // timeout not provided; you can add AbortController if desired
    });

    const status = vapiResp.status;
    const text = await vapiResp.text(); // raw text to allow non-json bodies
    console.log("[server] vapi response status:", status);
    console.log("[server] vapi response body (raw):", text);

    // try parse JSON, fall back to raw text
    let parsed;
    try { parsed = JSON.parse(text); } catch (e) { parsed = { raw: text }; }

    // return vapi response to frontend (include status for debugging)
    return res.status(200).json({ vapiStatus: status, vapiBody: parsed });
  } catch (err) {
    console.error("[server] error calling vapi:", err);
    return res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`[server] listening on http://localhost:${PORT}`));
