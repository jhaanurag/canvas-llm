import { ConvexHttpClient } from "convex/browser";

let client: ConvexHttpClient | null | undefined;

export function getConvexBrowserClient() {
  if (client !== undefined) {
    return client;
  }

  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  client = url ? new ConvexHttpClient(url) : null;
  return client;
}
