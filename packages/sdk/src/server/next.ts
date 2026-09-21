import {
  NextResponse,
  type NextFetchEvent,
  type NextRequest,
} from "next/server.js";
import { sendServerRequest, type ServerSdkOptions } from "./shared.js";

export function statifyNext(options: ServerSdkOptions) {
  return (request: NextRequest, event: NextFetchEvent) => {
    const send = sendServerRequest(options, {
      method: request.method,
      url: request.url,
      ip:
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        request.headers.get("cf-connecting-ip") ??
        undefined,
      getHeader: (name) => request.headers.get(name) ?? undefined,
    });
    event.waitUntil(send);
    return NextResponse.next();
  };
}
