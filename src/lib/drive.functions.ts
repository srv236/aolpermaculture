import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const inputSchema = z.object({
  filename: z.string().min(1),
  // base64-encoded file bytes
  contentBase64: z.string().min(1),
  mimeType: z.string().min(1),
});

export const uploadToDrive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }) => {
    const lovableKey = process.env.LOVABLE_API_KEY;
    const driveKey = process.env.GOOGLE_DRIVE_API_KEY;
    if (!lovableKey || !driveKey) {
      throw new Error("Google Drive is not connected for this project.");
    }

    const bytes = Uint8Array.from(atob(data.contentBase64), (c) => c.charCodeAt(0));

    const boundary = "lovable_" + Math.random().toString(36).slice(2);
    const metadata = { name: data.filename, mimeType: data.mimeType };
    const enc = new TextEncoder();
    const head = enc.encode(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
      JSON.stringify(metadata) +
      `\r\n--${boundary}\r\nContent-Type: ${data.mimeType}\r\n\r\n`,
    );
    const tail = enc.encode(`\r\n--${boundary}--`);
    const body = new Uint8Array(head.length + bytes.length + tail.length);
    body.set(head, 0);
    body.set(bytes, head.length);
    body.set(tail, head.length + bytes.length);

    const res = await fetch(
      "https://connector-gateway.lovable.dev/google_drive/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableKey}`,
          "X-Connection-Api-Key": driveKey,
          "Content-Type": `multipart/related; boundary=${boundary}`,
        },
        body,
      },
    );

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Drive upload failed (${res.status}): ${text.slice(0, 300)}`);
    }
    const json = (await res.json()) as { id: string; name: string; webViewLink?: string };
    return json;
  });
