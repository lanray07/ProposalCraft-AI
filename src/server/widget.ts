export const widgetUri = "ui://widget/proposalcraft-ai-v3.html";
export const widgetMimeType = "text/html+skybridge";

export function getBaseUrl(): string {
  return (
    process.env.BASE_URL ??
    process.env.VERCEL_URL?.replace(/^/, "https://") ??
    `http://localhost:${process.env.PORT ?? 8000}`
  ).replace(/\/$/, "");
}

export function getWidgetHtml(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>ProposalCraft AI</title>
    <style>
      * { box-sizing: border-box; }
      body { margin: 0; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #17201b; background: #f7f8f4; }
      main { max-width: 980px; margin: 0 auto; padding: 24px; }
      .eyebrow { margin: 0 0 8px; color: #51685a; font-size: 12px; font-weight: 700; letter-spacing: 0; text-transform: uppercase; }
      h1 { margin: 0 0 14px; font-size: 30px; line-height: 1.08; }
      h2 { margin: 0 0 10px; font-size: 17px; line-height: 1.2; }
      p, li { line-height: 1.55; color: #3d4941; }
      ul { display: grid; gap: 6px; margin: 0; padding-left: 18px; }
      section { margin-top: 18px; padding-top: 16px; border-top: 1px solid #d8ded4; }
      .actions { display: flex; flex-wrap: wrap; gap: 8px; margin: 18px 0 8px; }
      button { min-height: 40px; border: 1px solid #233129; border-radius: 8px; background: #233129; color: white; padding: 0 14px; font: inherit; cursor: pointer; }
      button.secondary { background: #fff; color: #233129; border-color: #d8ded4; }
      .empty { border: 1px solid #d8ded4; border-radius: 8px; background: #fff; padding: 20px; }
      @media (max-width: 520px) { main { padding: 18px; } button { width: 100%; } }
    </style>
  </head>
  <body>
    <main id="root">
      <h1>ProposalCraft AI</h1>
      <div class="empty">
        <p class="eyebrow">Widget ready</p>
        <p>Waiting for proposal data from ChatGPT.</p>
      </div>
    </main>
    <script>
      const root = document.getElementById("root");
      const output = window.openai && window.openai.toolOutput;
      const proposal = output && (output.proposal || (output.structuredContent && output.structuredContent.proposal));
      const renderBody = (body) => Array.isArray(body)
        ? "<ul>" + body.map((item) => "<li>" + escapeHtml(item) + "</li>").join("") + "</ul>"
        : "<p>" + escapeHtml(String(body || "")) + "</p>";
      const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
      if (proposal && root) {
        root.innerHTML = '<p class="eyebrow">' + escapeHtml(proposal.serviceLabel || "ProposalCraft AI") + "</p>"
          + "<h1>" + escapeHtml(proposal.title) + "</h1>"
          + '<div class="actions"><button type="button" id="copy">Copy proposal</button><button type="button" id="email" class="secondary">Copy email</button></div>'
          + proposal.sections.map((section) => "<section><h2>" + escapeHtml(section.title) + "</h2>" + renderBody(section.body) + "</section>").join("");
        document.getElementById("copy").addEventListener("click", () => navigator.clipboard && navigator.clipboard.writeText(proposal.clientReadyProposal));
        document.getElementById("email").addEventListener("click", () => navigator.clipboard && navigator.clipboard.writeText(proposal.followUpEmail || ""));
      }
    </script>
  </body>
</html>`;
}
