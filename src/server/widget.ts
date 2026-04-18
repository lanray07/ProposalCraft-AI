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

export const widgetUri = "ui://widget/proposalcraft-ai.html";
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
    throw new Error(`ProposalCraft widget HTML was not found at ${htmlPath}.`);
  }

  const html = fs.readFileSync(htmlPath, "utf8");
  return inlineBuiltAssets(html) ?? qualifyAssetUrls(html, getBaseUrl());
}

function qualifyAssetUrls(html: string, baseUrl: string): string {
  return html
    .replaceAll('src="/', `src="${baseUrl}/`)
    .replaceAll('href="/', `href="${baseUrl}/`);
}

function inlineBuiltAssets(html: string): string | undefined {
  const scriptTag = html.match(/<script\b[^>]*\bsrc="([^"]+)"[^>]*><\/script>/);
  const stylesheetTag = html.match(/<link\b[^>]*\brel="stylesheet"[^>]*\bhref="([^"]+)"[^>]*>/);
  const scriptSrc = scriptTag?.[1];
  const stylesheetHref = stylesheetTag?.[1];

  if (!scriptSrc) {
    return undefined;
  }

  const scriptPath = path.join(distDir, scriptSrc.replace(/^\//, ""));

  if (!fs.existsSync(scriptPath)) {
    return undefined;
  }

  const script = fs.readFileSync(scriptPath, "utf8");
  const css = stylesheetHref
    ? readBuiltAsset(stylesheetHref)
    : "";

  return html
    .replace(
      /<link\b[^>]*\brel="stylesheet"[^>]*>/,
      css ? `<style>${css}</style>` : ""
    )
    .replace(
      /<script\b[^>]*\bsrc="[^"]+"[^>]*><\/script>/,
      `<script type="module">${script}</script>`
    );
}

function readBuiltAsset(assetUrl: string): string {
  const assetPath = path.join(distDir, assetUrl.replace(/^\//, ""));
  return fs.existsSync(assetPath) ? fs.readFileSync(assetPath, "utf8") : "";
}
