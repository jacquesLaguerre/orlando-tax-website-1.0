// Hannah Chatbot – SecureTax (Front-end)
// Talks to your Cloudflare Worker at /api/hannah

const toggler = document.getElementById("hannah-toggler");
const closeBtn = document.getElementById("hannah-close");
const form = document.getElementById("hannah-form");
const input = document.getElementById("hannah-input");
const body = document.getElementById("hannah-body");

// IMPORTANT: This must match your Worker route
const API_URL = "/api/hannah";

// Website context builder
function collectSiteContext() {
  const title = document.title || "Secure Tax";

  const links = Array.from(document.querySelectorAll("a"))
    .map((a) => ({
      text: (a.innerText || "").trim(),
      href: a.getAttribute("href") || "",
    }))
    .filter((x) => x.href)
    .slice(0, 30);

  const mainText = Array.from(document.querySelectorAll("h1,h2,h3,h4,p,li"))
    .map((el) => (el.innerText || "").trim())
    .filter((t) => t.length > 0 && t.length < 240)
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

// Keep short chat history for the server
const history = []; // {role:"user"|"assistant", content:"..."}

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

toggler?.addEventListener("click", () => {
  setOpen(!document.body.classList.contains("hannah-open"));
});
closeBtn?.addEventListener("click", () => setOpen(false));

// Enter to send, shift+enter for newline
input?.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    form.requestSubmit();
  }
});

form?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const msg = String(input.value || "").trim();
  if (!msg) return;

  input.value = "";

  addMessage(msg, "user");
  const thinking = addMessage("…", "bot");

  try {
    const payload = {
      message: msg,
      context: collectSiteContext(),
      history: history.slice(-10), // last 10 turns only
    };

    const resp = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await resp.json().catch(() => ({}));

    if (!resp.ok) {
      const errMsg = data?.error || `Request failed (${resp.status})`;
      throw new Error(errMsg);
    }

    const reply = String(data?.reply || "").trim();
    thinking.innerHTML = reply ? reply.replace(/\n/g, "<br/>") : "Sorry — I couldn’t generate a response.";

    // store turns
    history.push({ role: "user", content: msg });
    history.push({ role: "assistant", content: reply || "" });
  } catch (err) {
    thinking.innerHTML = `Sorry — I ran into an issue: ${String(err.message || err)}`;
  }

  body.scrollTop = body.scrollHeight;
});
