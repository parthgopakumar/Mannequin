/**
 * outfit-mapper.js
 * Handles communication with the Anthropic API to parse outfit
 * descriptions / images into structured JSON, then validates that
 * JSON for use by Mannequin.applyOutfit().
 */

// ── Color name → approximate hex map ─────────────────────────
const COLOR_MAP = {
  // Neutrals
  white: '#f5f5f0',
  'off-white': '#ede8de',
  cream: '#f0ead6',
  ivory: '#fffff0',
  beige: '#d4c9a8',
  grey: '#8a8a8a',
  gray: '#8a8a8a',
  'light grey': '#c8c8c8',
  'light gray': '#c8c8c8',
  'dark grey': '#3a3a3a',
  'dark gray': '#3a3a3a',
  charcoal: '#2f2f2f',
  black: '#1a1a1a',
  // Earthy
  brown: '#6b4423',
  tan: '#c4a35a',
  caramel: '#b5651d',
  khaki: '#c3b091',
  olive: '#6b6b2a',
  // Blues
  navy: '#1a2a4a',
  'navy blue': '#1a2a4a',
  blue: '#2256b0',
  'light blue': '#6db3e8',
  'sky blue': '#87ceeb',
  'cobalt blue': '#0047ab',
  denim: '#1560bd',
  'royal blue': '#4169e1',
  teal: '#008080',
  // Greens
  green: '#2d6a2d',
  'forest green': '#228b22',
  'olive green': '#6b7c2a',
  mint: '#98ff98',
  sage: '#b2ac88',
  // Reds / Pinks
  red: '#c0392b',
  crimson: '#dc143c',
  burgundy: '#800020',
  maroon: '#800000',
  wine: '#722f37',
  rose: '#e8a0bf',
  pink: '#f4a8c7',
  // Yellows / Oranges
  yellow: '#f0d060',
  mustard: '#e3a020',
  orange: '#e87020',
  // Purples
  purple: '#7b3fa0',
  lavender: '#9b86c0',
  violet: '#8b00ff',
  // Metallics
  gold: '#c8a830',
  silver: '#c0c0c0',
  bronze: '#8c5a20',
};

function resolveColor(colorStr) {
  if (!colorStr) return '#888888';
  const c = colorStr.toLowerCase().trim();
  if (c.startsWith('#')) return c;
  // Try direct lookup
  if (COLOR_MAP[c]) return COLOR_MAP[c];
  // Try partial match
  for (const [key, val] of Object.entries(COLOR_MAP)) {
    if (c.includes(key) || key.includes(c)) return val;
  }
  return '#888888';
}

// ── Roughness / metalness by material type ────────────────────
function materialProps(materialStr = '') {
  const m = materialStr.toLowerCase();
  if (m.includes('leather') || m.includes('patent')) return { roughness: 0.25, metalness: 0.15 };
  if (m.includes('silk') || m.includes('satin')) return { roughness: 0.10, metalness: 0.05 };
  if (m.includes('denim')) return { roughness: 0.90, metalness: 0.0 };
  if (m.includes('wool') || m.includes('knit')) return { roughness: 0.95, metalness: 0.0 };
  if (m.includes('cotton') || m.includes('linen')) return { roughness: 0.85, metalness: 0.0 };
  if (m.includes('suede')) return { roughness: 0.92, metalness: 0.0 };
  if (m.includes('velvet')) return { roughness: 0.98, metalness: 0.0 };
  if (m.includes('metallic') || m.includes('foil')) return { roughness: 0.15, metalness: 0.80 };
  if (m.includes('sequin') || m.includes('glitter')) return { roughness: 0.10, metalness: 0.90 };
  return { roughness: 0.80, metalness: 0.0 };
}

// ── Build the prompt for Claude ───────────────────────────────
function buildPrompt() {
  return `You are an outfit analysis assistant. Parse the given outfit description or image into a structured JSON object.

Return ONLY valid JSON with this exact structure (no markdown, no explanation, no backticks):
{
  "pieces": [
    {
      "type": "shirt|blazer|jacket|coat|hoodie|sweater|tshirt|tank top|trousers|jeans|shorts|chinos|skirt|dress|shoes|boots|sneakers|loafers|heels|oxford shoes|socks|hat|cap|beanie|tie|scarf|belt",
      "color": "descriptive color name (e.g. 'navy blue', 'charcoal', 'off-white')",
      "color_hex": "#hexcode if you can estimate it, else null",
      "material": "fabric or material type (e.g. 'cotton', 'denim', 'leather', 'wool')",
      "style_notes": "brief style description"
    }
  ],
  "overall_style": "one-phrase style summary (e.g. 'business casual', 'streetwear', 'smart formal')"
}

Rules:
- Include every garment piece you can identify
- color_hex should be your best estimate of the actual color as a 6-digit hex code
- type must be one of the listed options; pick the closest match
- Keep style_notes under 12 words
- If no outfit is described, return { "pieces": [], "overall_style": "unknown" }`;
}

// ── Main export: parse outfit via Claude API ──────────────────
export async function parseOutfit({ description, imageBase64, imageMimeType }) {
  const userContent = [];

  if (imageBase64) {
    userContent.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: imageMimeType || 'image/jpeg',
        data: imageBase64,
      },
    });
    userContent.push({
      type: 'text',
      text: description
        ? `Analyze this outfit image. Additional context: ${description}`
        : 'Analyze the outfit worn in this image.',
    });
  } else {
    userContent.push({
      type: 'text',
      text: `Parse this outfit description: ${description}`,
    });
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system: buildPrompt(),
      messages: [{ role: 'user', content: userContent }],
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || `API error ${response.status}`);
  }

  const data = await response.json();
  const rawText = data.content?.find(b => b.type === 'text')?.text || '';

  // Clean and parse JSON
  const clean = rawText.replace(/```json|```/g, '').trim();
  let parsed;
  try {
    parsed = JSON.parse(clean);
  } catch {
    throw new Error('Could not parse outfit JSON from AI response.');
  }

  // Enrich each piece with resolved colors + material props
  parsed.pieces = (parsed.pieces || []).map(piece => {
    const hex = piece.color_hex || resolveColor(piece.color);
    const { roughness, metalness } = materialProps(piece.material);
    return { ...piece, color_hex: hex, roughness, metalness };
  });

  return parsed;
}
