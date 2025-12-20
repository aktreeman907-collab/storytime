// netlify/functions/generate-story.js
// Force redeploy - corrected OpenAI API integration

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

exports.handler = async (event) => {
  // Handle CORS preflight
  if (event.httpMethod === "OPTIONS" ) {
    return { statusCode: 200, headers: corsHeaders, body: "" };
  }

  // Only allow POST
  if (event.httpMethod !== "POST" ) {
    return {
      statusCode: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Use POST." }),
    };
  }

  // API key from Netlify env vars
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Missing OPENAI_API_KEY in Netlify env vars." }),
    };
  }

  // Parse body
  let body = {};
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return {
      statusCode: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Invalid JSON." }),
    };
  }

  const {
    kidname = "friend",
    age = "",
    tone = "soft and sleepy",
    length = "short",
    setting = "",
    focus = "",
    supporting = "",
    holidayMode = false,
  } = body || {};

  const safeTone = String(tone).slice(0, 60);
  const safeSetting = String(setting).slice(0, 120);
  const safeFocus = String(focus).slice(0, 120);
  const safeSupporting = String(supporting).slice(0, 80);

  const minutesTarget =
    String(length).toLowerCase() === "long" ? "10–15" :
    String(length).toLowerCase() === "medium" ? "5–8" :
    "3–5";

  const system = `
You are a warm, gentle bedtime storyteller.
Write a child-safe story: no violence, no adult themes, no scary content.
Keep sentences simple and calming.
End with a soothing, reassuring final line.
Return only the story text (no title, no bullets).
`.trim();

  const user = `
Create a bedtime story about ${kidname}${age ? ` (age ${age})` : ""}.
Target length: about ${minutesTarget} minutes when read aloud.
Tone: ${safeTone}.
Setting: ${safeSetting || "surprise me"}.
Tonight's focus: ${safeFocus || "surprise me"}.
Supporting character: ${safeSupporting || "none"}.
Holiday mode: ${holidayMode ? "ON (festive, cozy, gentle)" : "OFF"}.
`.trim();

  try {
    // CORRECTED: Use the correct OpenAI Chat Completions endpoint
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      // CORRECTED: Use the correct request format with "messages" array
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        max_tokens:
          String(length ).toLowerCase() === "long" ? 1800 :
          String(length).toLowerCase() === "medium" ? 1200 :
          700,
      }),
    });

    const data = await resp.json();

    if (!resp.ok) {
      const msg = data?.error?.message || "OpenAI request failed.";
      return {
        statusCode: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ error: msg }),
      };
    }

    // CORRECTED: Extract text from the correct response structure
    const story = data?.choices?.[0]?.message?.content || "";

    if (!story) {
      return {
        statusCode: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ error: "No story text returned from model." }),
      };
    }

    return {
      statusCode: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ story }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ error: err?.message || "Server error" }),
    };
  }
};
