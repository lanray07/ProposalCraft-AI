import type { IncomingMessage, ServerResponse } from "node:http";
import { handleMcpHttpRequest } from "../src/server/http.js";

export const config = {
  api: {
    bodyParser: false
  }
};

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  await handleMcpHttpRequest(req, res);
}
