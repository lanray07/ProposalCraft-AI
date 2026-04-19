/// <reference types="node" />

import { describe, expect, it } from "vitest";
import {
  debugWidgetUri,
  getDebugWidgetHtml,
  getWidgetHtml,
  widgetMimeType,
  widgetUri
} from "../src/server/widget.js";

describe("widget resource", () => {
  it("uses the current MCP Apps widget resource shape", () => {
    const html = getWidgetHtml();

    expect(widgetUri).toBe("ui://widget/proposalcraft-ai-v5.html");
    expect(widgetMimeType).toBe("text/html;profile=mcp-app");
    expect(html).toContain("Widget ready");
    expect(html).toContain("ui/notifications/tool-result");
    expect(html).toContain("window.openai && window.openai.toolOutput");
  });

  it("ships a minimal debug widget for ChatGPT iframe diagnostics", () => {
    const html = getDebugWidgetHtml();

    expect(debugWidgetUri).toBe("ui://widget/proposalcraft-debug-v1.html");
    expect(html).toContain("Debug widget loaded");
    expect(html).not.toContain("ui/notifications/tool-result");
  });
});
