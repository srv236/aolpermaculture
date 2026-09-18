import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getMe } from "@/lib/farm.functions";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  Info,
  Plus,
  Pencil,
  Trash2,
  ChevronUp,
  ChevronDown,
  Search,
  Image as ImageIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  KnowledgeSection,
  parseKnowledgeMeta,
  MarkdownContent,
  SectionImageItem,
  ImageLightboxModal,
  StoredImage,
} from "@/components/rich-section-viewer";
import { RichSectionDialog } from "@/components/rich-section-dialog";

export const Route = createFileRoute("/_authenticated/about")({
  component: AboutPage,
});

export function AboutPage() {
  const getMeFn = useServerFn(getMe);
  const me = useQuery({ queryKey: ["me"], queryFn: () => getMeFn() });
  const roles = me.data?.roles ?? [];
  const canEdit = roles.includes("admin") || roles.includes("editor");

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Partial<KnowledgeSection> | null>(null);
  const [confirmDel, setConfirmDel] = useState<KnowledgeSection | null>(null);
  const [search, setSearch] = useState("");
  const [lightboxImg, setLightboxImg] = useState<StoredImage | null>(null);

  const qc = useQueryClient();
  const sectionsQuery = useQuery({
    queryKey: ["knowledge_sections"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("knowledge_sections")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []) as KnowledgeSection[];
    },
  });

  // Filter for about sections (where meta.scope === "about")
  const allRows = sectionsQuery.data ?? [];
  const aboutList = allRows.filter((r) => {
    const meta = parseKnowledgeMeta(r.images, "note");
    return meta.scope === "about";
  });

  const filteredList = aboutList.filter(
    (s) =>
      s.title.toLowerCase().includes(search.toLowerCase()) ||
      s.content.toLowerCase().includes(search.toLowerCase()),
  );

  const active =
    aboutList.find((s) => s.id === selectedId) || (aboutList.length > 0 ? aboutList[0] : null);

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
    mutationFn: async (updatedList: KnowledgeSection[]) => {
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
    if (target < 0 || target >= aboutList.length) return;
    const copy = [...aboutList];
    const [item] = copy.splice(index, 1);
    copy.splice(target, 0, item);
    reorderMut.mutate(copy);
  }

  const activeMeta = active ? parseKnowledgeMeta(active.images, "about") : { font: "serif", imageLayout: "grid2", items: [] };

  return (
    <AppShell>
      <div className="flex h-[calc(100vh-theme(spacing.16))] flex-col md:flex-row overflow-hidden bg-background">
        {/* Left Sidebar: About Sections / Tabs navigation */}
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
                      images: { scope: "about", font: "serif", imageLayout: "grid2", items: [] },
                      sort_order: (aboutList.at(-1)?.sort_order ?? 0) + 10,
                    })
                  }
                >
                  <Plus className="size-4 mr-1" /> Add Section
                </Button>
              )}
            </div>

            {aboutList.length > 1 && (
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search about sections..."
                  className="pl-8 h-8 text-xs bg-background"
                />
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {filteredList.map((s, i) => {
              const meta = parseKnowledgeMeta(s.images, "about");
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
                        <span>{meta.items.length} photo{meta.items.length === 1 ? "" : "s"}</span>
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
                        disabled={i === aboutList.length - 1}
                        title="Move Down"
                      >
                        <ChevronDown className="size-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}

            {filteredList.length === 0 && aboutList.length > 0 && (
              <p className="p-4 text-center text-xs text-muted-foreground">No sections match "{search}"</p>
            )}

            {aboutList.length === 0 && (
              <div className="p-6 text-center text-xs text-muted-foreground space-y-2">
                <Info className="size-6 mx-auto opacity-40 mb-1" />
                <p>No about sections created yet.</p>
                {canEdit && <p className="text-[11px]">Click "Add Section" above to add your first about section.</p>}
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
                      Attached Photos ({activeMeta.items.length})
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
                  <h2 className="font-serif text-2xl font-bold">About Section is Ready</h2>
                  <p className="text-sm text-muted-foreground">
                    This page is empty and ready to be customized. Create your own sections,
                    headings, guidelines, mission, and photo galleries.
                  </p>
                </div>

                {canEdit ? (
                  <div className="pt-2">
                    <Button
                      onClick={() =>
                        setEditing({
                          title: "",
                          content: "",
                          images: { scope: "about", font: "serif", imageLayout: "grid2", items: [] },
                          sort_order: 10,
                        })
                      }
                    >
                      <Plus className="size-4 mr-1.5" /> Add First Section
                    </Button>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">
                    An editor or administrator can add sections and photos here.
                  </p>
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Section Edit Dialog */}
      {editing && (
        <RichSectionDialog
          entityName="Section"
          scope="about"
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
              This action cannot be undone. The section and its photos will be permanently removed.
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
