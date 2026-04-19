/// <reference types="node" />

import { describe, expect, it } from "vitest";
import {
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
});
