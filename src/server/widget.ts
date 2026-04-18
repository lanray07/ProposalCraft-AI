import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..", "..");
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
  return qualifyAssetUrls(html, getBaseUrl());
}

function qualifyAssetUrls(html: string, baseUrl: string): string {
  return html
    .replaceAll('src="/', `src="${baseUrl}/`)
    .replaceAll('href="/', `href="${baseUrl}/`);
}
