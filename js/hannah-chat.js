// Hannah Chatbot – SecureTax (Cloudflare Worker backend)

// UI
const toggler = document.getElementById("hannah-toggler");
const popup = document.getElementById("hannah-popup");
const closeBtn = document.getElementById("hannah-close");
const form = document.getElementById("hannah-form");
const input = document.getElementById("hannah-input");
const body = document.getElementById("hannah-body");

// IMPORTANT: this must match your Cloudflare Worker route
const API_URL = "/api/hannah";

// Build “website context” so Hannah answers using your page content
function collectSiteContext() {
  const title = document.title || "Secure Tax";

  const links = Array.from(document.querySelectorAll("a"))
    .map((a) => ({
      text: (a.innerText || "").trim(),
      href: a.getAttribute("href") || "",
    }))
    .filter(
      (x) =>
        x.href &&
        (x.href.startsWith("http") ||
          x.href.startsWith("#") ||
          x.href.endsWith(".html"))
    )
    .slice(0, 30);

  const mainText = Array.from(document.querySelectorAll("h1,h2,h3,h4,p,li"))
    .map((el) => (el.innerText || "").trim())
    .filter((t) => t.length > 0 && t.length < 220)
    .slice(0, 140)
    .join("\n");

  const compactLinks = links
    .map((l) => `- ${l.text || l.href}: ${l.href}`)
    .join("\n");

  return `
You are Hannah, the Secure Tax website assistant.
Only answer using the information in the WEBSITE CONTENT below.
If the answer isn't on the site, say:
"I’m not 100% sure from the website. Please contact Secure Tax or use the Contact Us page."

WEBSITE TITLE:
${title}

WEBSITE LINKS:
${compactLinks}

WEBSITE CONTENT (snippets):
${mainText}
`.trim();
}

// Chat history (OpenAI style)
const history = []; // { role: "user"|"assistant", content: "..." }

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
        message: msg,       // <-- REQUIRED by Worker
        context: context,   // system prompt / website snippets
        history: history,   // prior messages
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
