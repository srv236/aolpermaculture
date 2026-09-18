import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getMe } from "@/lib/farm.functions";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Info,
  Plus,
  Pencil,
  Trash2,
  ChevronUp,
  ChevronDown,
  Upload,
  Image as ImageIcon,
  X,
  Search,
  Heading1,
  Heading2,
  Heading3,
  Bold,
  Italic,
  List,
  ListOrdered,
  Quote,
  Minus,
  Table as TableIcon,
  Eye,
  Columns2,
  Maximize2,
  Link as LinkIcon,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/about")({
  component: AboutPage,
});

const BUCKET = "knowledge-images";

export type StoredImage = {
  path?: string;
  url?: string;
  name?: string;
  caption?: string;
};

export type SectionMeta = {
  font: "serif" | "sans" | "mono";
  imageLayout: "grid2" | "grid3" | "hero" | "stacked";
  items: StoredImage[];
};

export type Section = {
  id: string;
  title: string;
  content: string;
  sort_order: number;
  updated_at: string;
  images: any;
};

function parseSectionMeta(raw: any): SectionMeta {
  if (!raw) return { font: "serif", imageLayout: "grid2", items: [] };
  if (Array.isArray(raw)) {
    return {
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
      font: raw.font === "sans" || raw.font === "mono" ? raw.font : "serif",
      imageLayout: raw.imageLayout || "grid2",
      items,
    };
  }
  return { font: "serif", imageLayout: "grid2", items: [] };
}

function useResolvedImageUrl(img?: StoredImage) {
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
        .from(BUCKET)
        .createSignedUrl(img.path, 60 * 60 * 24)
        .then(({ data, error }) => {
          if (cancelled) return;
          if (data?.signedUrl) {
            setUrl(data.signedUrl);
          } else {
            const pub = supabase.storage.from(BUCKET).getPublicUrl(img.path);
            setUrl(pub.data.publicUrl);
          }
        })
        .catch(() => {
          if (!cancelled && img.path) {
            const pub = supabase.storage.from(BUCKET).getPublicUrl(img.path);
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

function SectionImageItem({
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
            alt={image.caption || image.name || "About image"}
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

// Markdown parser & renderer
function MarkdownContent({ content, font = "serif" }: { content: string; font?: "serif" | "sans" | "mono" }) {
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

    // Code block toggle
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

    // Horizontal rule
    if (/^(---|___|\*\*\*)$/.test(line.trim())) {
      flushList();
      flushTable();
      elements.push(<hr key={`hr-${elements.length}`} className="my-6 border-border" />);
      continue;
    }

    // Tables (| col | col |)
    if (line.trim().startsWith("|") && line.trim().endsWith("|")) {
      flushList();
      // Skip separator row like | --- | --- |
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

    // Headings
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

    // Blockquote or Callout
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

    // Unordered List
    if (/^\s*[-*]\s+/.test(line)) {
      const text = line.replace(/^\s*[-*]\s+/, "");
      if (!inList || inList.type !== "ul") {
        flushList();
        inList = { type: "ul", items: [] };
      }
      inList.items.push(text);
      continue;
    }

    // Ordered List
    if (/^\s*\d+\.\s+/.test(line)) {
      const text = line.replace(/^\s*\d+\.\s+/, "");
      if (!inList || inList.type !== "ol") {
        flushList();
        inList = { type: "ol", items: [] };
      }
      inList.items.push(text);
      continue;
    }

    // Empty line
    if (!line.trim()) {
      flushList();
      elements.push(<div key={`sp-${elements.length}`} className="h-3" />);
      continue;
    }

    // Regular paragraph
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
  // Simple inline token replacement for **bold**, *italic*, `code`, and [link](url)
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // Links [text](url)
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

    // Bold **text**
    const boldMatch = remaining.match(/^\*\*([^*]+)\*\*/);
    if (boldMatch) {
      parts.push(<strong key={key++} className="font-semibold text-foreground">{boldMatch[1]}</strong>);
      remaining = remaining.slice(boldMatch[0].length);
      continue;
    }

    // Italic *text*
    const italicMatch = remaining.match(/^\*([^*]+)\*/);
    if (italicMatch) {
      parts.push(<em key={key++}>{italicMatch[1]}</em>);
      remaining = remaining.slice(italicMatch[0].length);
      continue;
    }

    // Inline code `code`
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

    // Find nearest formatting token
    const nextSpecial = remaining.search(/(\*\*|\*|`|\[)/);
    if (nextSpecial === -1) {
      parts.push(remaining);
      break;
    } else if (nextSpecial === 0) {
      // Single stray symbol
      parts.push(remaining[0]);
      remaining = remaining.slice(1);
    } else {
      parts.push(remaining.slice(0, nextSpecial));
      remaining = remaining.slice(nextSpecial);
    }
  }

  return parts;
}

export function AboutPage() {
  const getMeFn = useServerFn(getMe);
  const me = useQuery({ queryKey: ["me"], queryFn: () => getMeFn() });
  const roles = me.data?.roles ?? [];
  const canEdit = roles.includes("admin") || roles.includes("editor");

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Partial<Section> | null>(null);
  const [confirmDel, setConfirmDel] = useState<Section | null>(null);
  const [search, setSearch] = useState("");
  const [lightboxImg, setLightboxImg] = useState<StoredImage | null>(null);

  const qc = useQueryClient();
  const sections = useQuery({
    queryKey: ["knowledge_sections"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("knowledge_sections")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []) as Section[];
    },
  });

  const list = sections.data ?? [];
  const filteredList = list.filter(
    (s) =>
      s.title.toLowerCase().includes(search.toLowerCase()) ||
      s.content.toLowerCase().includes(search.toLowerCase()),
  );

  const active = list.find((s) => s.id === selectedId) || (list.length > 0 ? list[0] : null);

  const delMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("knowledge_sections").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["knowledge_sections"] });
      setConfirmDel(null);
      toast.success("Section deleted");
      if (selectedId === confirmDel?.id) {
        setSelectedId(null);
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reorderMut = useMutation({
    mutationFn: async (updatedList: Section[]) => {
      const updates = updatedList.map((s, idx) =>
        supabase.from("knowledge_sections").update({ sort_order: idx * 10 }).eq("id", s.id),
      );
      await Promise.all(updates);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["knowledge_sections"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  function move(index: number, direction: number) {
    const target = index + direction;
    if (target < 0 || target >= list.length) return;
    const copy = [...list];
    const [item] = copy.splice(index, 1);
    copy.splice(target, 0, item);
    reorderMut.mutate(copy);
  }

  const activeMeta = active ? parseSectionMeta(active.images) : { font: "serif", imageLayout: "grid2", items: [] };

  return (
    <AppShell>
      <div className="flex h-[calc(100vh-theme(spacing.16))] flex-col md:flex-row overflow-hidden bg-background">
        {/* Left Sidebar: Sections navigation */}
        <aside className="w-full md:w-80 shrink-0 border-b md:border-b-0 md:border-r border-border bg-muted/10 flex flex-col">
          <div className="p-4 border-b border-border space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Info className="size-5 text-primary" />
                <h1 className="font-serif text-xl font-semibold">About</h1>
              </div>
              {canEdit && (
                <Button
                  size="sm"
                  onClick={() =>
                    setEditing({
                      title: "",
                      content: "",
                      images: { font: "serif", imageLayout: "grid2", items: [] },
                      sort_order: (list.at(-1)?.sort_order ?? 0) + 10,
                    })
                  }
                >
                  <Plus className="size-4 mr-1" /> Add Section
                </Button>
              )}
            </div>

            {list.length > 1 && (
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search sections..."
                  className="pl-8 h-8 text-xs bg-background"
                />
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {filteredList.map((s, i) => {
              const meta = parseSectionMeta(s.images);
              const isSelected = active?.id === s.id;
              return (
                <div
                  key={s.id}
                  onClick={() => setSelectedId(s.id)}
                  className={cn(
                    "group flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm cursor-pointer transition",
                    isSelected
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "hover:bg-muted text-foreground",
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{s.title || "Untitled Section"}</div>
                    {meta.items.length > 0 && (
                      <div
                        className={cn(
                          "text-[11px] flex items-center gap-1 mt-0.5 opacity-70",
                          isSelected ? "text-primary-foreground" : "text-muted-foreground",
                        )}
                      >
                        <ImageIcon className="size-3" />
                        <span>{meta.items.length} image{meta.items.length === 1 ? "" : "s"}</span>
                      </div>
                    )}
                  </div>

                  {canEdit && (
                    <div
                      className={cn(
                        "flex items-center opacity-0 group-hover:opacity-100 transition-opacity",
                        isSelected && "opacity-100",
                      )}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button
                        size="icon"
                        variant="ghost"
                        className={cn("size-6 p-0", isSelected && "hover:bg-primary-foreground/20 text-primary-foreground")}
                        onClick={() => move(i, -1)}
                        disabled={i === 0}
                        title="Move Up"
                      >
                        <ChevronUp className="size-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className={cn("size-6 p-0", isSelected && "hover:bg-primary-foreground/20 text-primary-foreground")}
                        onClick={() => move(i, 1)}
                        disabled={i === list.length - 1}
                        title="Move Down"
                      >
                        <ChevronDown className="size-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}

            {filteredList.length === 0 && list.length > 0 && (
              <p className="p-4 text-center text-xs text-muted-foreground">No sections match "{search}"</p>
            )}

            {list.length === 0 && (
              <div className="p-6 text-center text-xs text-muted-foreground space-y-2">
                <Info className="size-6 mx-auto opacity-40 mb-1" />
                <p>No sections created yet.</p>
                {canEdit && <p className="text-[11px]">Click "Add Section" above to get started.</p>}
              </div>
            )}
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto">
          {active ? (
            <article className="max-w-4xl mx-auto p-6 md:p-10 space-y-8">
              {/* Header */}
              <div className="border-b pb-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div className="space-y-1">
                  <h1
                    className={cn(
                      "text-3xl sm:text-4xl font-bold tracking-tight text-foreground",
                      activeMeta.font === "serif" && "font-serif",
                      activeMeta.font === "mono" && "font-mono",
                    )}
                  >
                    {active.title}
                  </h1>
                  <div className="text-xs text-muted-foreground flex items-center gap-3 pt-1">
                    <span>Last updated {new Date(active.updated_at).toLocaleDateString(undefined, { dateStyle: "medium" })}</span>
                    <Badge variant="outline" className="capitalize text-[10px] font-normal">
                      Font: {activeMeta.font}
                    </Badge>
                  </div>
                </div>

                {canEdit && (
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditing(active)}
                    >
                      <Pencil className="size-3.5 mr-1.5" /> Edit Section
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:bg-destructive/10"
                      onClick={() => setConfirmDel(active)}
                      title="Delete Section"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                )}
              </div>

              {/* Main Body */}
              <div className="prose-container">
                <MarkdownContent content={active.content} font={activeMeta.font} />
              </div>

              {/* Images Gallery */}
              {activeMeta.items.length > 0 && (
                <div className="space-y-3 pt-4 border-t">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">
                      Photos ({activeMeta.items.length})
                    </h3>
                  </div>

                  <div
                    className={cn(
                      "grid gap-4",
                      activeMeta.imageLayout === "hero" && "grid-cols-1",
                      activeMeta.imageLayout === "grid3" && "grid-cols-1 sm:grid-cols-2 md:grid-cols-3",
                      activeMeta.imageLayout === "stacked" && "grid-cols-1 max-w-2xl mx-auto",
                      (!activeMeta.imageLayout || activeMeta.imageLayout === "grid2") && "grid-cols-1 sm:grid-cols-2",
                    )}
                  >
                    {activeMeta.items.map((img, idx) => (
                      <SectionImageItem
                        key={idx}
                        image={img}
                        onClick={() => setLightboxImg(img)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </article>
          ) : (
            /* Empty State */
            <div className="h-full flex items-center justify-center p-8">
              <div className="max-w-md text-center space-y-4">
                <div className="size-16 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
                  <Info className="size-8" />
                </div>
                <div className="space-y-1">
                  <h2 className="font-serif text-2xl font-bold">About Section is Empty</h2>
                  <p className="text-sm text-muted-foreground">
                    This section is ready to be filled with farm background, history,
                    mission, team, guidelines, and permaculture principles.
                  </p>
                </div>

                {canEdit ? (
                  <div className="pt-2">
                    <Button
                      onClick={() =>
                        setEditing({
                          title: "",
                          content: "",
                          images: { font: "serif", imageLayout: "grid2", items: [] },
                          sort_order: 10,
                        })
                      }
                    >
                      <Plus className="size-4 mr-1.5" /> Add First Section
                    </Button>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">
                    An editor or administrator can add sections and images to this page.
                  </p>
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Section Edit Dialog */}
      {editing && (
        <SectionEditDialog
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={(id) => {
            setEditing(null);
            setSelectedId(id);
          }}
        />
      )}

      {/* Delete Confirmation Alert */}
      <AlertDialog open={!!confirmDel} onOpenChange={(v) => !v && setConfirmDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete section "{confirmDel?.title}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The section content and associated images will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => confirmDel && delMut.mutate(confirmDel.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Image Lightbox Modal */}
      {lightboxImg && (
        <ImageLightboxModal image={lightboxImg} onClose={() => setLightboxImg(null)} />
      )}
    </AppShell>
  );
}

// Section Edit Dialog with Rich Toolbar, Font Selection, and Image Uploader
function SectionEditDialog({
  initial,
  onClose,
  onSaved,
}: {
  initial: Partial<Section>;
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const initialMeta = parseSectionMeta(initial.images);

  const [title, setTitle] = useState(initial.title || "");
  const [content, setContent] = useState(initial.content || "");
  const [font, setFont] = useState<"serif" | "sans" | "mono">(initialMeta.font);
  const [imageLayout, setImageLayout] = useState(initialMeta.imageLayout || "grid2");
  const [images, setImages] = useState<StoredImage[]>(initialMeta.items);
  const [uploading, setUploading] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [editorTab, setEditorTab] = useState<"write" | "split" | "preview">("write");

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const qc = useQueryClient();

  function insertFormat(before: string, after: string = "", defaultText: string = "") {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const current = el.value;
    const selection = current.substring(start, end) || defaultText;
    const replacement = `${before}${selection}${after}`;
    const nextVal = current.substring(0, start) + replacement + current.substring(end);
    setContent(nextVal);
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + before.length, start + before.length + selection.length);
    }, 0);
  }

  async function handleFileUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id ?? "farm-user";
      const uploaded: StoredImage[] = [];

      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) {
          toast.error(`${file.name} is not an image`);
          continue;
        }
        if (file.size > 15 * 1024 * 1024) {
          toast.error(`${file.name} exceeds 15 MB limit`);
          continue;
        }

        const ext = file.name.split(".").pop() || "jpg";
        const path = `${uid}/${crypto.randomUUID()}.${ext}`;

        const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type,
        });

        if (error) {
          toast.error(`Upload error: ${error.message}`);
          continue;
        }

        uploaded.push({ path, name: file.name, caption: "" });
      }

      if (uploaded.length > 0) {
        setImages((prev) => [...prev, ...uploaded]);
        toast.success(`Uploaded ${uploaded.length} image${uploaded.length === 1 ? "" : "s"}`);
      }
    } finally {
      setUploading(false);
    }
  }

  function addImageUrl() {
    const u = urlInput.trim();
    if (!u) return;
    try {
      new URL(u);
      setImages((prev) => [...prev, { url: u, name: "Web Image", caption: "" }]);
      setUrlInput("");
      setShowUrlInput(false);
      toast.success("Image URL added");
    } catch {
      toast.error("Please enter a valid URL (e.g. https://...)");
    }
  }

  function removeImage(index: number) {
    setImages((prev) => prev.filter((_, i) => i !== index));
  }

  function updateImageCaption(index: number, caption: string) {
    setImages((prev) =>
      prev.map((img, i) => (i === index ? { ...img, caption } : img)),
    );
  }

  const save = useMutation({
    mutationFn: async () => {
      const t = title.trim();
      if (!t) throw new Error("Please enter a section title");

      const payload = {
        title: t,
        content: content,
        images: {
          font,
          imageLayout,
          items: images,
        } as any,
      };

      if (initial.id) {
        const { data, error } = await supabase
          .from("knowledge_sections")
          .update(payload)
          .eq("id", initial.id)
          .select("id")
          .single();
        if (error) throw new Error(error.message);
        return data.id as string;
      } else {
        const { data, error } = await supabase
          .from("knowledge_sections")
          .insert({ ...payload, sort_order: initial.sort_order ?? 10 })
          .select("id")
          .single();
        if (error) throw new Error(error.message);
        return data.id as string;
      }
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ["knowledge_sections"] });
      toast.success("Section saved");
      onSaved(id);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-4xl max-h-[92vh] p-0 flex flex-col gap-0 overflow-hidden">
        {/* Pinned Header */}
        <DialogHeader className="p-5 border-b shrink-0 pr-12">
          <DialogTitle className="font-serif text-2xl">
            {initial.id ? "Edit Section" : "Add New Section"}
          </DialogTitle>
          <DialogDescription>
            Customize headings, typography, text formatting, and images for this about section.
          </DialogDescription>
        </DialogHeader>

        {/* Scrollable Form Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Section Title & Options */}
          <div className="grid gap-4 md:grid-cols-3">
            <div className="md:col-span-2 space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                Section Title *
              </Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Our Farm History, Permaculture Philosophy, Visiting Guidelines..."
                className="font-medium text-base"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                Font Family
              </Label>
              <Select value={font} onValueChange={(v) => setFont(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="serif">Classic Serif (Editorial)</SelectItem>
                  <SelectItem value="sans">Clean Sans-Serif (Modern)</SelectItem>
                  <SelectItem value="mono">Monospace (Structured)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Content Editor Toolbar */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 border rounded-t-lg bg-muted/30 p-2">
              {/* Formatting Actions */}
              <div className="flex flex-wrap items-center gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-8 px-2 font-bold"
                  onClick={() => insertFormat("# ", "", "Heading 1")}
                  title="Heading 1"
                >
                  <Heading1 className="size-4" />
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-8 px-2 font-semibold"
                  onClick={() => insertFormat("## ", "", "Heading 2")}
                  title="Heading 2"
                >
                  <Heading2 className="size-4" />
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-8 px-2"
                  onClick={() => insertFormat("### ", "", "Heading 3")}
                  title="Heading 3"
                >
                  <Heading3 className="size-4" />
                </Button>
                <div className="h-4 w-px bg-border mx-1" />

                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-8 px-2"
                  onClick={() => insertFormat("**", "**", "bold text")}
                  title="Bold (**text**)"
                >
                  <Bold className="size-4" />
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-8 px-2"
                  onClick={() => insertFormat("*", "*", "italic text")}
                  title="Italic (*text*)"
                >
                  <Italic className="size-4" />
                </Button>
                <div className="h-4 w-px bg-border mx-1" />

                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-8 px-2"
                  onClick={() => insertFormat("- ", "", "List item")}
                  title="Bullet list"
                >
                  <List className="size-4" />
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-8 px-2"
                  onClick={() => insertFormat("1. ", "", "First item")}
                  title="Numbered list"
                >
                  <ListOrdered className="size-4" />
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-8 px-2"
                  onClick={() => insertFormat("> ", "", "Important note or quote")}
                  title="Quote / Callout"
                >
                  <Quote className="size-4" />
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-8 px-2"
                  onClick={() => insertFormat("> 💡 **Note:** ", "", "Tip or observation")}
                  title="Callout Box"
                >
                  <Sparkles className="size-4" />
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-8 px-2"
                  onClick={() => insertFormat("\n---\n", "")}
                  title="Divider line"
                >
                  <Minus className="size-4" />
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-8 px-2"
                  onClick={() =>
                    insertFormat("\n| Topic | Details |\n| --- | --- |\n| Item 1 | Value 1 |\n", "")
                  }
                  title="Insert table"
                >
                  <TableIcon className="size-4" />
                </Button>
              </div>

              {/* View modes */}
              <div className="flex items-center gap-1 border rounded-md bg-background p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setEditorTab("write")}
                  className={cn(
                    "px-2.5 py-1 rounded font-medium transition",
                    editorTab === "write" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground",
                  )}
                >
                  Write
                </button>
                <button
                  type="button"
                  onClick={() => setEditorTab("split")}
                  className={cn(
                    "hidden sm:flex items-center gap-1 px-2.5 py-1 rounded font-medium transition",
                    editorTab === "split" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground",
                  )}
                >
                  <Columns2 className="size-3" /> Split
                </button>
                <button
                  type="button"
                  onClick={() => setEditorTab("preview")}
                  className={cn(
                    "flex items-center gap-1 px-2.5 py-1 rounded font-medium transition",
                    editorTab === "preview" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground",
                  )}
                >
                  <Eye className="size-3" /> Preview
                </button>
              </div>
            </div>

            {/* Editor Area */}
            <div className="border border-t-0 rounded-b-lg overflow-hidden bg-background">
              {editorTab === "write" && (
                <Textarea
                  ref={textareaRef}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Write section text here... Use # for headings, - for bullet points, > for quotes, and **bold** formatting."
                  rows={14}
                  className={cn(
                    "border-0 rounded-none focus-visible:ring-0 resize-y p-4 text-[15px] leading-relaxed",
                    font === "mono" && "font-mono text-sm",
                  )}
                />
              )}

              {editorTab === "preview" && (
                <div className="p-6 min-h-[350px] max-h-[500px] overflow-y-auto">
                  <MarkdownContent content={content} font={font} />
                </div>
              )}

              {editorTab === "split" && (
                <div className="grid grid-cols-2 divide-x h-[380px]">
                  <Textarea
                    ref={textareaRef}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Write text here..."
                    className={cn(
                      "h-full border-0 rounded-none focus-visible:ring-0 resize-none p-4 text-[14px]",
                      font === "mono" && "font-mono text-sm",
                    )}
                  />
                  <div className="p-4 overflow-y-auto bg-muted/10">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
                      Live Preview
                    </div>
                    <MarkdownContent content={content} font={font} />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Image Uploader & Gallery Manager */}
          <div className="space-y-4 pt-2 border-t">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                  Section Images ({images.length})
                </Label>
                <p className="text-xs text-muted-foreground">
                  Upload photos or add image links. Each image can have a custom caption.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Select value={imageLayout} onValueChange={(v) => setImageLayout(v as any)}>
                  <SelectTrigger className="h-8 text-xs w-[140px]">
                    <SelectValue placeholder="Image Layout" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="grid2">2-Col Grid</SelectItem>
                    <SelectItem value="grid3">3-Col Grid</SelectItem>
                    <SelectItem value="hero">Full Hero</SelectItem>
                    <SelectItem value="stacked">Stacked</SelectItem>
                  </SelectContent>
                </Select>

                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setShowUrlInput(!showUrlInput)}
                  className="h-8 text-xs"
                >
                  <LinkIcon className="size-3.5 mr-1" /> Add from URL
                </Button>

                <Label
                  htmlFor="about-image-upload"
                  className={cn(
                    "inline-flex items-center justify-center rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow hover:bg-primary/90 cursor-pointer h-8",
                    uploading && "opacity-50 pointer-events-none",
                  )}
                >
                  <Upload className="size-3.5 mr-1" />
                  {uploading ? "Uploading..." : "Upload Photos"}
                </Label>
                <input
                  id="about-image-upload"
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => handleFileUpload(e.target.files)}
                />
              </div>
            </div>

            {/* URL input drawer */}
            {showUrlInput && (
              <div className="flex items-center gap-2 p-3 bg-muted/40 rounded-lg border">
                <Input
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://example.com/photo.jpg"
                  className="h-8 text-xs"
                />
                <Button type="button" size="sm" onClick={addImageUrl} className="h-8 text-xs shrink-0">
                  Add Image
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowUrlInput(false)}
                  className="h-8 px-2"
                >
                  <X className="size-3.5" />
                </Button>
              </div>
            )}

            {/* Uploaded Images List */}
            {images.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {images.map((img, idx) => (
                  <div
                    key={idx}
                    className="flex gap-3 p-2.5 rounded-lg border bg-card items-start relative group"
                  >
                    <div className="size-16 rounded overflow-hidden bg-muted shrink-0 border">
                      <ThumbnailImage img={img} />
                    </div>
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="text-xs font-medium truncate text-foreground">
                        {img.name || (img.url ? "Web Image" : "Uploaded Photo")}
                      </div>
                      <Input
                        value={img.caption || ""}
                        onChange={(e) => updateImageCaption(idx, e.target.value)}
                        placeholder="Add a photo caption..."
                        className="h-7 text-xs"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeImage(idx)}
                      className="text-muted-foreground hover:text-destructive p-1 rounded transition"
                      title="Remove image"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 border border-dashed rounded-lg text-center space-y-1.5 bg-muted/10">
                <ImageIcon className="size-8 mx-auto text-muted-foreground/50" />
                <p className="text-xs text-muted-foreground">
                  No images attached yet. Click <strong>Upload Photos</strong> or <strong>Add from URL</strong> to attach pictures to this section.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Pinned Bottom Footer */}
        <DialogFooter className="p-4 px-6 border-t bg-background shrink-0 flex flex-row items-center justify-end gap-2 m-0">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || !title.trim()}>
            {save.isPending ? "Saving..." : "Save Section"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ThumbnailImage({ img }: { img: StoredImage }) {
  const url = useResolvedImageUrl(img);
  if (!url) {
    return (
      <div className="size-full grid place-items-center text-[10px] text-muted-foreground">
        ...
      </div>
    );
  }
  return <img src={url} alt="" className="size-full object-cover" />;
}

// Lightbox Modal for high-res photo viewing
function ImageLightboxModal({
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
