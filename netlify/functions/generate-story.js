// netlify/functions/generate-story.js
export default async (req) => {
  // CORS (fine to keep even though same-origin when hosted on Netlify)
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (req.method === "OPTIONS") {
    return new Response("", { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Use POST." }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Missing OPENAI_API_KEY in Netlify environment variables." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let payload;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body." }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const {
    name = "Hero",
    age = "",
    tone = "soft and sleepy",
    length = "medium",
    setting = "",
    focus = "",
    supporting = "",
    holidayModeEnabled = false,
  } = payload;

  const lengthHint =
    length === "short" ? "3–5 minutes" : length === "long" ? "10–15 minutes" : "7–10 minutes";

  const prompt = `
Write a cozy bedtime story for a child.
- Child name: ${name}
- Age: ${age || "unknown"}
- Tone: ${tone}
- Length: ${lengthHint}
- Setting: ${setting || "surprise me (choose something magical and comforting)"}
- Focus: ${focus || "just for fun"}
- Supporting character: ${supporting || "optional (include only if it fits naturally)"}
- Holiday mode: ${holidayModeEnabled ? "YES (gentle festive elements, not loud)" : "NO"}

Rules:
- No scary content.
- Make it warm, calm, and comforting.
- Use simple language suitable for the age.
- End with a soothing wind-down and sleep cue.
`.trim();

  try {
    const r = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-5-mini",
        input: prompt,
        text: { verbosity: "medium" },
      }),
    });

    if (!r.ok) {
      const errText = await r.text();
      return new Response(JSON.stringify({ error: "OpenAI request failed", details: errText }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await r.json();

    // Responses API commonly provides "output_text" in many SDKs;
    // in raw JSON, best fallback is to extract any text-like fields safely.
    const story =
      data.output_text ||
      (Array.isArray(data.output) ? data.output.map(o => JSON.stringify(o)).join("\n") : "") ||
      "";

    return new Response(JSON.stringify({ story }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e?.message || "Server error." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};

    return new Response(JSON.stringify({ error: e?.message || "Server error." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};
