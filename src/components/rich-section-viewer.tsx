import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Maximize2, X, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export const KNOWLEDGE_BUCKET = "knowledge-images";

export type StoredImage = {
  path?: string;
  url?: string;
  name?: string;
  caption?: string;
};

export type SectionMeta = {
  scope?: "note" | "about";
  font: "serif" | "sans" | "mono";
  imageLayout: "grid2" | "grid3" | "hero" | "stacked";
  items: StoredImage[];
};

export type KnowledgeSection = {
  id: string;
  title: string;
  content: string;
  sort_order: number;
  updated_at: string;
  images: any;
};

export function parseKnowledgeMeta(raw: any, defaultScope: "note" | "about" = "note"): SectionMeta {
  if (!raw) return { scope: defaultScope, font: "serif", imageLayout: "grid2", items: [] };

  if (Array.isArray(raw)) {
    return {
      scope: defaultScope,
      font: "serif",
      imageLayout: "grid2",
      items: raw.map((item) => (typeof item === "string" ? { path: item } : item)),
    };
  }

  if (typeof raw === "object") {
    const items = Array.isArray(raw.items)
      ? raw.items.map((item: any) => (typeof item === "string" ? { path: item } : item))
      : [];
    return {
      scope: raw.scope === "about" ? "about" : "note",
      font: raw.font === "sans" || raw.font === "mono" ? raw.font : "serif",
      imageLayout: raw.imageLayout || "grid2",
      items,
    };
  }

  return { scope: defaultScope, font: "serif", imageLayout: "grid2", items: [] };
}

export function useResolvedImageUrl(img?: StoredImage) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!img) {
      setUrl(null);
      return;
    }
    if (img.url) {
      setUrl(img.url);
      return;
    }
    if (img.path?.startsWith("http://") || img.path?.startsWith("https://") || img.path?.startsWith("data:")) {
      setUrl(img.path);
      return;
    }
    if (img.path) {
      supabase.storage
        .from(KNOWLEDGE_BUCKET)
        .createSignedUrl(img.path, 60 * 60 * 24)
        .then(({ data }) => {
          if (cancelled) return;
          if (data?.signedUrl) {
            setUrl(data.signedUrl);
          } else {
            const pub = supabase.storage.from(KNOWLEDGE_BUCKET).getPublicUrl(img.path!);
            setUrl(pub.data.publicUrl);
          }
        })
        .catch(() => {
          if (!cancelled && img.path) {
            const pub = supabase.storage.from(KNOWLEDGE_BUCKET).getPublicUrl(img.path);
            setUrl(pub.data.publicUrl);
          }
        });
    }
    return () => {
      cancelled = true;
    };
  }, [img?.path, img?.url]);

  return url;
}

export function SectionImageItem({
  image,
  onClick,
}: {
  image: StoredImage;
  onClick: () => void;
}) {
  const url = useResolvedImageUrl(image);

  return (
    <figure
      onClick={onClick}
      className="group relative cursor-pointer overflow-hidden rounded-lg border bg-muted/40 transition hover:shadow-md"
    >
      <div className="aspect-[4/3] w-full overflow-hidden bg-muted/20">
        {url ? (
          <img
            src={url}
            alt={image.caption || image.name || "Attached photo"}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
            <ImageIcon className="mr-1.5 size-4 opacity-50" /> Loading image...
          </div>
        )}
      </div>
      <div className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/20" />
      <div className="absolute right-2 top-2 rounded-full bg-background/80 p-1.5 opacity-0 shadow-sm backdrop-blur transition-opacity group-hover:opacity-100">
        <Maximize2 className="size-3.5" />
      </div>
      {image.caption && (
        <figcaption className="border-t bg-background/90 p-2.5 text-xs text-muted-foreground">
          {image.caption}
        </figcaption>
      )}
    </figure>
  );
}

export function ImageLightboxModal({
  image,
  onClose,
}: {
  image: StoredImage;
  onClose: () => void;
}) {
  const url = useResolvedImageUrl(image);

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden bg-black/95 text-white border-0 shadow-2xl">
        <div className="relative flex flex-col items-center justify-center p-2">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3 right-3 rounded-full bg-white/20 p-2 text-white hover:bg-white/40 transition z-10"
          >
            <X className="size-5" />
          </button>

          <div className="max-h-[80vh] w-full flex items-center justify-center overflow-hidden">
            {url ? (
              <img
                src={url}
                alt={image.caption || "Full size photo"}
                className="max-h-[75vh] w-auto max-w-full object-contain rounded"
              />
            ) : (
              <div className="py-20 text-sm opacity-60">Loading photo...</div>
            )}
          </div>

          {image.caption && (
            <div className="p-4 text-center text-sm text-white/90 max-w-2xl">
              {image.caption}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Markdown renderer
export function MarkdownContent({ content, font = "serif" }: { content: string; font?: "serif" | "sans" | "mono" }) {
  if (!content || !content.trim()) {
    return <p className="italic text-muted-foreground">No content added yet.</p>;
  }

  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeBuffer: string[] = [];
  let inList: { type: "ul" | "ol"; items: string[] } | null = null;
  let inTable: string[][] | null = null;

  function flushList() {
    if (!inList) return;
    if (inList.type === "ul") {
      elements.push(
        <ul key={`ul-${elements.length}`} className="my-3 ml-6 list-disc space-y-1">
          {inList.items.map((item, idx) => (
            <li key={idx} className="leading-relaxed">
              {renderInline(item)}
            </li>
          ))}
        </ul>,
      );
    } else {
      elements.push(
        <ol key={`ol-${elements.length}`} className="my-3 ml-6 list-decimal space-y-1">
          {inList.items.map((item, idx) => (
            <li key={idx} className="leading-relaxed">
              {renderInline(item)}
            </li>
          ))}
        </ol>,
      );
    }
    inList = null;
  }

  function flushTable() {
    if (!inTable || inTable.length === 0) return;
    const [header, ...rows] = inTable;
    elements.push(
      <div key={`table-${elements.length}`} className="my-4 overflow-x-auto rounded-lg border">
        <table className="w-full text-left text-sm">
          {header && (
            <thead className="border-b bg-muted/50 font-medium">
              <tr>
                {header.map((col, i) => (
                  <th key={i} className="px-4 py-2.5">
                    {renderInline(col)}
                  </th>
                ))}
              </tr>
            </thead>
          )}
          <tbody className="divide-y">
            {rows.map((row, ri) => (
              <tr key={ri} className="hover:bg-muted/20">
                {row.map((cell, ci) => (
                  <td key={ci} className="px-4 py-2">
                    {renderInline(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>,
    );
    inTable = null;
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.trim().startsWith("```")) {
      flushList();
      flushTable();
      if (inCodeBlock) {
        elements.push(
          <pre
            key={`code-${elements.length}`}
            className="my-3 overflow-x-auto rounded-md bg-muted p-4 font-mono text-xs leading-relaxed text-foreground"
          >
            <code>{codeBuffer.join("\n")}</code>
          </pre>,
        );
        codeBuffer = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeBuffer.push(line);
      continue;
    }

    if (/^(---|___|\*\*\*)$/.test(line.trim())) {
      flushList();
      flushTable();
      elements.push(<hr key={`hr-${elements.length}`} className="my-6 border-border" />);
      continue;
    }

    if (line.trim().startsWith("|") && line.trim().endsWith("|")) {
      flushList();
      if (/^\|(\s*:?-+:?\s*\|)+$/.test(line.trim())) {
        continue;
      }
      const cells = line
        .trim()
        .slice(1, -1)
        .split("|")
        .map((c) => c.trim());
      if (!inTable) inTable = [];
      inTable.push(cells);
      continue;
    } else {
      flushTable();
    }

    if (line.startsWith("# ")) {
      flushList();
      elements.push(
        <h1
          key={`h1-${elements.length}`}
          className={cn(
            "mt-8 mb-4 border-b pb-2 text-2.5xl sm:text-3xl font-bold tracking-tight text-foreground",
            font === "serif" && "font-serif",
            font === "mono" && "font-mono tracking-normal",
          )}
        >
          {renderInline(line.slice(2))}
        </h1>,
      );
      continue;
    }

    if (line.startsWith("## ")) {
      flushList();
      elements.push(
        <h2
          key={`h2-${elements.length}`}
          className={cn(
            "mt-6 mb-3 text-xl sm:text-2xl font-semibold tracking-tight text-foreground",
            font === "serif" && "font-serif",
            font === "mono" && "font-mono tracking-normal",
          )}
        >
          {renderInline(line.slice(3))}
        </h2>,
      );
      continue;
    }

    if (line.startsWith("### ")) {
      flushList();
      elements.push(
        <h3
          key={`h3-${elements.length}`}
          className={cn(
            "mt-5 mb-2 text-lg sm:text-xl font-semibold text-foreground",
            font === "serif" && "font-serif",
            font === "mono" && "font-mono tracking-normal",
          )}
        >
          {renderInline(line.slice(4))}
        </h3>,
      );
      continue;
    }

    if (line.startsWith("#### ")) {
      flushList();
      elements.push(
        <h4 key={`h4-${elements.length}`} className="mt-4 mb-1.5 text-base font-medium text-foreground">
          {renderInline(line.slice(5))}
        </h4>,
      );
      continue;
    }

    if (line.startsWith("> ")) {
      flushList();
      const quoteText = line.slice(2);
      const isCallout = quoteText.startsWith("[!NOTE]") || quoteText.startsWith("[!TIP]") || quoteText.startsWith("💡");
      elements.push(
        <blockquote
          key={`quote-${elements.length}`}
          className={cn(
            "my-4 rounded-r-lg border-l-4 p-4 text-sm leading-relaxed",
            isCallout
              ? "border-primary/60 bg-primary/5 text-foreground"
              : "border-muted-foreground/40 bg-muted/30 italic text-muted-foreground",
          )}
        >
          {renderInline(quoteText.replace(/^\[!(NOTE|TIP|IMPORTANT)\]\s*/i, ""))}
        </blockquote>,
      );
      continue;
    }

    if (/^\s*[-*]\s+/.test(line)) {
      const text = line.replace(/^\s*[-*]\s+/, "");
      if (!inList || inList.type !== "ul") {
        flushList();
        inList = { type: "ul", items: [] };
      }
      inList.items.push(text);
      continue;
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      const text = line.replace(/^\s*\d+\.\s+/, "");
      if (!inList || inList.type !== "ol") {
        flushList();
        inList = { type: "ol", items: [] };
      }
      inList.items.push(text);
      continue;
    }

    if (!line.trim()) {
      flushList();
      elements.push(<div key={`sp-${elements.length}`} className="h-3" />);
      continue;
    }

    flushList();
    elements.push(
      <p key={`p-${elements.length}`} className="my-1.5 leading-relaxed text-foreground/90">
        {renderInline(line)}
      </p>,
    );
  }

  flushList();
  flushTable();

  return <div className={cn("space-y-1 text-[15px]", font === "mono" && "font-mono text-sm")}>{elements}</div>;
}

function renderInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    const linkMatch = remaining.match(/^\[([^\]]+)\]\(([^)]+)\)/);
    if (linkMatch) {
      parts.push(
        <a
          key={key++}
          href={linkMatch[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline underline-offset-2 hover:opacity-80"
        >
          {linkMatch[1]}
        </a>,
      );
      remaining = remaining.slice(linkMatch[0].length);
      continue;
    }

    const boldMatch = remaining.match(/^\*\*([^*]+)\*\*/);
    if (boldMatch) {
      parts.push(<strong key={key++} className="font-semibold text-foreground">{boldMatch[1]}</strong>);
      remaining = remaining.slice(boldMatch[0].length);
      continue;
    }

    const italicMatch = remaining.match(/^\*([^*]+)\*/);
    if (italicMatch) {
      parts.push(<em key={key++}>{italicMatch[1]}</em>);
      remaining = remaining.slice(italicMatch[0].length);
      continue;
    }

    const codeMatch = remaining.match(/^`([^`]+)`/);
    if (codeMatch) {
      parts.push(
        <code key={key++} className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
          {codeMatch[1]}
        </code>,
      );
      remaining = remaining.slice(codeMatch[0].length);
      continue;
    }

    const nextSpecial = remaining.search(/(\*\*|\*|`|\[)/);
    if (nextSpecial === -1) {
      parts.push(remaining);
      break;
    } else if (nextSpecial === 0) {
      parts.push(remaining[0]);
      remaining = remaining.slice(1);
    } else {
      parts.push(remaining.slice(0, nextSpecial));
      remaining = remaining.slice(nextSpecial);
    }
  }

  return parts;
}
