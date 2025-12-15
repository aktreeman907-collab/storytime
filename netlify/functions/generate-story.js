// netlify/functions/generate-story.js

export default async (req) => {
  // Basic CORS (so GitHub Pages can call this Netlify function)
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (req.method === "OPTIONS") {
    return new Response("", { status: 204, headers: corsHeaders });
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

  let body = {};
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON." }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const {
    kidName = "Hero",
    kidAge = null,
    tone = "soft and sleepy",
    length = "medium",
    setting = null,
    focus = null,
    supporting = null,
    holidayMode = false,
  } = body || {};

  const safeName = String(kidName).slice(0, 40);
  const safeTone = String(tone).slice(0, 40);
  const safeLength = String(length).slice(0, 20);
  const safeSetting = setting ? String(setting).slice(0, 120) : "";
  const safeFocus = focus ? String(focus).slice(0, 80) : "";
  const safeSupporting = supporting ? String(supporting).slice(0, 60) : "";

  const minutesTarget =
    safeLength === "short" ? "3–5" :
    safeLength === "long" ? "10–15" :
    "7–10";

  const system = `
You are StoryTime, a cozy bedtime storyteller.
Write soothing, child-safe stories. No scary content, no violence, no adult themes.
Keep the style warm, gentle, and imaginative. Use simple language.
End with a calm, sleepy landing and a reassuring final line.
Return only the story text (no titles, no bullet points).
`.trim();

  const user = `
Create a ${safeTone} bedtime story about a child named ${safeName}${kidAge ? ` (age ${kidAge})` : ""}.
Target length: about ${minutesTarget} minutes when read aloud.

Include:
- A clear beginning, middle, and gentle ending
- Soft sensory details (warm light, soft blankets, friendly sounds)
- A small lesson that matches the "Tonight's Focus" if provided
- A supporting character if provided

Optional details:
- Setting: ${safeSetting || "surprise me"}
- Tonight's Focus: ${safeFocus || "just for fun"}
- Supporting character: ${safeSupporting || "none"}
- Holiday mode: ${holidayMode ? "ON (festive, cozy, tasteful)" : "OFF"}

Constraints:
- No brand names
- No moralizing lectures
- Keep it comforting and sleepy
`.trim();

  try {
    // Call OpenAI Responses API
    const r = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        input: [
          { role: "system", content: system },
          { role: "user", content: user }
        ],
        max_output_tokens: safeLength === "short" ? 700 : safeLength === "long" ? 1800 : 1200,
      }),
    });

    const data = await r.json();

    if (!r.ok) {
      const msg = data?.error?.message || "OpenAI request failed.";
      return new Response(JSON.stringify({ error: msg }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Extract text safely
    let story = "";
    if (Array.isArray(data?.output)) {
      for (const item of data.output) {
        if (item?.content) {
          for (const c of item.content) {
            if (c?.type === "output_text" && typeof c?.text === "string") {
              story += c.text;
            }
          }
        }
      }
    }

    story = String(story || "").trim();

    if (!story) {
      return new Response(JSON.stringify({ error: "No story text returned from model." }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
