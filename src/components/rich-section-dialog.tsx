import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  KNOWLEDGE_BUCKET,
  StoredImage,
  parseKnowledgeMeta,
  useResolvedImageUrl,
  MarkdownContent,
  KnowledgeSection,
} from "./rich-section-viewer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
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
  Upload,
  Image as ImageIcon,
  X,
  Link as LinkIcon,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function RichSectionDialog({
  entityName = "Note",
  scope = "note",
  initial,
  onClose,
  onSaved,
}: {
  entityName?: "Note" | "Section";
  scope?: "note" | "about";
  initial: Partial<KnowledgeSection>;
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const initialMeta = parseKnowledgeMeta(initial.images, scope);

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

        const { error } = await supabase.storage.from(KNOWLEDGE_BUCKET).upload(path, file, {
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
      toast.success("Image link added");
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
      if (!t) throw new Error(`Please enter a ${entityName.toLowerCase()} title`);

      const payload = {
        title: t,
        content: content,
        images: {
          scope,
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
      toast.success(`${entityName} saved`);
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
            {initial.id ? `Edit ${entityName}` : `Add ${entityName}`}
          </DialogTitle>
          <DialogDescription>
            Customize headings, typography, text formatting, and images for this {entityName.toLowerCase()}.
          </DialogDescription>
        </DialogHeader>

        {/* Scrollable Form Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Title & Font Options */}
          <div className="grid gap-4 md:grid-cols-3">
            <div className="md:col-span-2 space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                {entityName} Title *
              </Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={
                  scope === "about"
                    ? "e.g. Farm History, Permaculture Philosophy, Visiting Guidelines..."
                    : "e.g. Living Soil Preparation, Pruning Guidelines, Seed Saving Protocol..."
                }
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
                  onClick={() => insertFormat("> ", "", "Important quote or observation")}
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
                  placeholder="Write content here... Use # for headings, - for bullet points, > for quotes, and **bold** formatting."
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
                  Attached Photos ({images.length})
                </Label>
                <p className="text-xs text-muted-foreground">
                  Upload photos or add image links. Each photo can have a caption.
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
                  htmlFor="rich-image-upload"
                  className={cn(
                    "inline-flex items-center justify-center rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow hover:bg-primary/90 cursor-pointer h-8",
                    uploading && "opacity-50 pointer-events-none",
                  )}
                >
                  <Upload className="size-3.5 mr-1" />
                  {uploading ? "Uploading..." : "Upload Photos"}
                </Label>
                <input
                  id="rich-image-upload"
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
                  No images attached yet. Click <strong>Upload Photos</strong> or <strong>Add from URL</strong> to attach pictures.
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
            {save.isPending ? "Saving..." : `Save ${entityName}`}
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
