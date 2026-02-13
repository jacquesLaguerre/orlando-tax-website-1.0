// Hannah Chatbot – SecureTax (Cloudflare Worker backend)

// UI
const toggler = document.getElementById("hannah-toggler");
const popup = document.getElementById("hannah-popup");
const closeBtn = document.getElementById("hannah-close");
const form = document.getElementById("hannah-form");
const input = document.getElementById("hannah-input");
const body = document.getElementById("hannah-body");

// IMPORTANT: must match your Cloudflare Worker route
const API_URL = "/api/hannah";

// Chat history (OpenAI style)
const history = []; // { role: "user"|"assistant", content: "..." }

// -----------------------------
// Helpers: safe HTML + linkify
// -----------------------------
function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Makes ONLY these items clickable while keeping display text clean:
 * - Phone numbers like 407-951-6379 -> <a href="tel:+14079516379">407-951-6379</a>
 * - Exact Secure Tax addresses -> <a href="maps-search-url">address</a> (address text only)
 */
function linkifySecureTax(text) {
  let out = escapeHtml(text);

  // Phone numbers -> tel:
  out = out.replace(
    /\b(\d{3})[-.\s]?(\d{3})[-.\s]?(\d{4})\b/g,
    (m, a, b, c) => `<a href="tel:+1${a}${b}${c}">${m}</a>`
  );

  // Exact addresses -> Google Maps search link (but display stays address only)
  const addresses = [
    "111 Sermon Blvd, Fern Park, FL 32730 United States",
    "4418 S Orange Blossom Trl, Orlando, FL 32839 United States",
  ];

  for (const addr of addresses) {
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      addr
    )}`;
    const re = new RegExp(addr.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");
    out = out.replace(
      re,
      `<a href="${url}" target="_blank" rel="noopener noreferrer">${addr}</a>`
    );
  }

  // Newlines -> <br/>
  out = out.replace(/\n/g, "<br/>");
  return out;
}

// ---------------------------------------------------
// Build website context (CONTENT ONLY — no instructions)
// IMPORTANT: includes key sections even if page is long
// ---------------------------------------------------
function collectSiteContext() {
  const title = document.title || "Secure Tax";
  const url = location.href;

  // Baseline visible text
  let text = (document.body?.innerText || "").trim();
  text = text.replace(/\n{3,}/g, "\n\n");

  // High-priority sections that must be included for answers
  const cashSection =
    document.querySelector(".cash-advance-section")?.innerText?.trim() || "";
  const locationsSection =
    document.querySelector("#doc-locations")?.innerText?.trim() || "";
  const topFeature =
    document.querySelector(".top-feature")?.innerText?.trim() || "";

  // Links (kept, useful)
  const links = Array.from(document.querySelectorAll("a"))
    .map((a) => ({
      text: (a.innerText || "").trim(),
      href: (a.getAttribute("href") || "").trim(),
    }))
    .filter((x) => x.href && (x.text || x.href))
    .slice(0, 60)
    .map((l) => `- ${l.text || l.href}: ${l.href}`)
    .join("\n");

  // Combine with priority sections first
  let combined = `
PAGE TITLE:
${title}

PAGE URL:
${url}

IMPORTANT SECTIONS:
CASH ADVANCE SECTION:
${cashSection || "(not found)"}

LOCATIONS SECTION:
${locationsSection || "(not found)"}

CALL US / WALK IN SECTION:
${topFeature || "(not found)"}

PAGE LINKS:
${links || "(none found)"}

PAGE TEXT:
${text || "(no page text found)"}
`.trim();

  // Limit size safely
  if (combined.length > 12000) combined = combined.slice(0, 12000);

  return combined;
}

// UI helpers
function addMessage(text, who = "bot") {
  const wrap = document.createElement("div");
  wrap.className = `hannah-msg ${who}`;

  const bubble = document.createElement("div");
  bubble.className = "bubble";

  // ✅ Render clickable phones/addresses without showing extra link text
  bubble.innerHTML = linkifySecureTax(text);

  wrap.appendChild(bubble);
  body.appendChild(wrap);
  body.scrollTop = body.scrollHeight;
  return bubble;
}

function setOpen(open) {
  document.body.classList.toggle("hannah-open", open);
}

toggler?.addEventListener("click", () =>
  setOpen(!document.body.classList.contains("hannah-open"))
);
closeBtn?.addEventListener("click", () => setOpen(false));

// Enter to send (shift+enter for newline)
input?.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    form.requestSubmit();
  }
});

// Send handler
form?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const msg = input.value.trim();
  if (!msg) return;

  input.value = "";
  addMessage(msg, "user");
  const thinking = addMessage("…", "bot");

  try {
    const context = collectSiteContext();

    const resp = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        // ✅ Worker reads this
        message: msg,
        context: context,

        // ✅ IMPORTANT: send conversation as `messages` (not `history`)
        // so the Worker can actually use it if you ever switch to messages-based logic
        messages: history,
      }),
    });

    const data = await resp.json();

    if (!resp.ok) {
      throw new Error(data?.error || `Request failed (${resp.status})`);
    }

    const answer = String(data?.reply || "").trim();

    // ✅ Render clickable phones/addresses without showing tel/maps text
    thinking.innerHTML = answer
      ? linkifySecureTax(answer)
      : "Sorry — I couldn’t generate a response.";

    // Save history (OpenAI chat format)
    history.push({ role: "user", content: msg });
    history.push({ role: "assistant", content: answer || "" });
  } catch (err) {
    thinking.innerHTML = `Sorry — I ran into an issue: ${escapeHtml(
      String(err.message || err)
    )}`;
  }

  body.scrollTop = body.scrollHeight;
});
