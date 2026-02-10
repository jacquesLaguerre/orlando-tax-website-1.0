// Hannah Chatbot – SecureTax (Cloudflare Worker backend)

// UI
const toggler = document.getElementById("hannah-toggler");
const popup = document.getElementById("hannah-popup");
const closeBtn = document.getElementById("hannah-close");
const form = document.getElementById("hannah-form");
const input = document.getElementById("hannah-input");
const body = document.getElementById("hannah-body");

// IMPORTANT: must match your Cloudflare Worker route
// If your Worker route is securetax.co/api/hannah* and www.securetax.co/api/hannah*,
// this relative URL is perfect:
const API_URL = "/api/hannah";

// Chat history (OpenAI style)
const history = []; // { role: "user"|"assistant", content: "..." }

// Build website context (CONTENT ONLY — no instructions)
function collectSiteContext() {
  const title = document.title || "Secure Tax";
  const url = location.href;

  // Get visible-ish page text (best coverage)
  let text = (document.body?.innerText || "").trim();

  // Clean up and limit size (Workers/OpenAI request size)
  text = text.replace(/\n{3,}/g, "\n\n");
  if (text.length > 12000) text = text.slice(0, 12000);

  // Include key links (helpful for contact/refund/W-4 pages)
  const links = Array.from(document.querySelectorAll("a"))
    .map((a) => ({
      text: (a.innerText || "").trim(),
      href: (a.getAttribute("href") || "").trim(),
    }))
    .filter((x) => x.href && (x.text || x.href))
    .slice(0, 60)
    .map((l) => `- ${l.text || l.href}: ${l.href}`)
    .join("\n");

  return `
PAGE TITLE:
${title}

PAGE URL:
${url}

PAGE LINKS:
${links || "(none found)"}

PAGE TEXT:
${text || "(no page text found)"}
`.trim();
}

// UI helpers
function addMessage(text, who = "bot") {
  const wrap = document.createElement("div");
  wrap.className = `hannah-msg ${who}`;

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.innerHTML = String(text).replace(/\n/g, "<br/>");

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
        // Worker should accept these:
        message: msg,
        context: context,
        history: history,
      }),
    });

    const data = await resp.json();

    if (!resp.ok) {
      throw new Error(data?.error || `Request failed (${resp.status})`);
    }

    const answer = String(data?.reply || "").trim();

    thinking.innerHTML = answer
      ? answer.replace(/\n/g, "<br/>")
      : "Sorry — I couldn’t generate a response.";

    // Save history
    history.push({ role: "user", content: msg });
    history.push({ role: "assistant", content: answer || "" });
  } catch (err) {
    thinking.innerHTML = `Sorry — I ran into an issue: ${String(
      err.message || err
    )}`;
  }

  body.scrollTop = body.scrollHeight;
});
