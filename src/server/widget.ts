import fs from "node:fs";
import path from "node:path";
const rootDir = process.cwd();
const distDir = path.resolve(rootDir, "dist");
const sourceWidgetPath = path.resolve(
  rootDir,
  "src",
  "widget",
  "proposalcraft.html"
);

export const widgetUri = "ui://widget/proposalcraft-ai-v2.html";
export const widgetMimeType = "text/html+skybridge";

export function getBaseUrl(): string {
  return (
    process.env.BASE_URL ??
    process.env.VERCEL_URL?.replace(/^/, "https://") ??
    `http://localhost:${process.env.PORT ?? 8000}`
  ).replace(/\/$/, "");
}

export function getWidgetHtml(): string {
  const builtWidgetPath = path.join(distDir, "proposalcraft.html");
  const nestedBuiltWidgetPath = path.join(
    distDir,
    "src",
    "widget",
    "proposalcraft.html"
  );
  const htmlPath = fs.existsSync(builtWidgetPath)
    ? builtWidgetPath
    : fs.existsSync(nestedBuiltWidgetPath)
      ? nestedBuiltWidgetPath
    : sourceWidgetPath;

  if (!fs.existsSync(htmlPath)) {
    return fallbackWidgetHtml();
  }

  const html = fs.readFileSync(htmlPath, "utf8");
  return qualifyAssetUrls(html, getBaseUrl());
}

function qualifyAssetUrls(html: string, baseUrl: string): string {
  return html
    .replaceAll('src="/', `src="${baseUrl}/`)
    .replaceAll('href="/', `href="${baseUrl}/`);
}

function fallbackWidgetHtml(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>ProposalCraft AI</title>
    <style>
      body { margin: 0; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #17201b; background: #f7f8f4; }
      main { padding: 24px; }
      h1 { margin: 0 0 12px; font-size: 28px; }
      section { margin-top: 18px; padding-top: 14px; border-top: 1px solid #d8ded4; }
      h2 { font-size: 16px; margin: 0 0 8px; }
      p, li { line-height: 1.5; color: #3d4941; }
      button { border: 1px solid #233129; border-radius: 8px; background: #233129; color: white; padding: 10px 14px; }
    </style>
  </head>
  <body>
    <main id="root">
      <h1>ProposalCraft AI</h1>
      <p>Loading proposal...</p>
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
        root.innerHTML = "<h1>" + escapeHtml(proposal.title) + "</h1>"
          + '<button type="button" id="copy">Copy proposal</button>'
          + proposal.sections.map((section) => "<section><h2>" + escapeHtml(section.title) + "</h2>" + renderBody(section.body) + "</section>").join("");
        document.getElementById("copy").addEventListener("click", () => navigator.clipboard && navigator.clipboard.writeText(proposal.clientReadyProposal));
      }
    </script>
  </body>
</html>`;
}
