import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, useMe } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Trash2, BookOpen, ChevronUp, ChevronDown } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/introduction")({
  component: IntroductionPage,
});

type Section = {
  id: string;
  title: string;
  content: string;
  sort_order: number;
  updated_at: string;
};

function IntroductionPage() {
  const me = useMe();
  const canEdit = !!me.data?.roles.some((r) => r === "admin" || r === "editor");
  const qc = useQueryClient();

  const sections = useQuery({
    queryKey: ["knowledge_sections"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("knowledge_sections")
        .select("*")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []) as Section[];
    },
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Partial<Section> | null>(null);
  const [confirmDel, setConfirmDel] = useState<Section | null>(null);

  const list = sections.data ?? [];
  const active = list.find((s) => s.id === selectedId) ?? list[0];

  const delMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("knowledge_sections").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["knowledge_sections"] });
      setConfirmDel(null);
      setSelectedId(null);
      toast.success("Section removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const moveMut = useMutation({
    mutationFn: async ({ a, b }: { a: Section; b: Section }) => {
      const { error: e1 } = await supabase
        .from("knowledge_sections")
        .update({ sort_order: b.sort_order })
        .eq("id", a.id);
      if (e1) throw new Error(e1.message);
      const { error: e2 } = await supabase
        .from("knowledge_sections")
        .update({ sort_order: a.sort_order })
        .eq("id", b.id);
      if (e2) throw new Error(e2.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["knowledge_sections"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  function move(idx: number, dir: -1 | 1) {
    const a = list[idx];
    const b = list[idx + dir];
    if (!a || !b) return;
    // If sort_order equal, seed differently first
    if (a.sort_order === b.sort_order) {
      a.sort_order = idx;
      b.sort_order = idx + dir;
    }
    moveMut.mutate({ a, b });
  }

  return (
    <AppShell>
      <div className="flex h-screen">
        {/* Section list sidebar */}
        <aside className="w-72 shrink-0 border-r bg-muted/20 flex flex-col">
          <div className="p-4 border-b flex items-center justify-between">
            <div>
              <h2 className="font-serif text-lg leading-tight">Introduction</h2>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground mt-0.5">
                Practices & notes
              </p>
            </div>
            {canEdit && (
              <Button size="sm" variant="ghost" onClick={() =>
                setEditing({ title: "", content: "", sort_order: (list.at(-1)?.sort_order ?? 0) + 1 })
              }>
                <Plus className="size-4" />
              </Button>
            )}
          </div>
          <div className="flex-1 overflow-auto p-2 space-y-1">
            {sections.isLoading && <div className="p-3 text-sm text-muted-foreground">Loading…</div>}
            {!sections.isLoading && list.length === 0 && (
              <div className="p-4 text-sm text-muted-foreground">
                No sections yet.{canEdit ? " Click + to add the first one." : ""}
              </div>
            )}
            {list.map((s, i) => (
              <div
                key={s.id}
                className={cn(
                  "group flex items-center gap-1 rounded-md px-2 py-1.5 text-sm cursor-pointer hover:bg-accent",
                  active?.id === s.id && "bg-accent text-accent-foreground",
                )}
                onClick={() => setSelectedId(s.id)}
              >
                <BookOpen className="size-3.5 shrink-0 opacity-60" />
                <span className="flex-1 truncate">{s.title || "Untitled"}</span>
                {canEdit && (
                  <div className="opacity-0 group-hover:opacity-100 flex items-center">
                    <Button size="icon" variant="ghost" className="size-6"
                      onClick={(e) => { e.stopPropagation(); move(i, -1); }}
                      disabled={i === 0}
                    ><ChevronUp className="size-3" /></Button>
                    <Button size="icon" variant="ghost" className="size-6"
                      onClick={(e) => { e.stopPropagation(); move(i, 1); }}
                      disabled={i === list.length - 1}
                    ><ChevronDown className="size-3" /></Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </aside>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          {active ? (
            <article className="max-w-3xl mx-auto p-10">
              <div className="flex items-start justify-between gap-4 mb-6">
                <h1 className="font-serif text-4xl leading-tight">{active.title}</h1>
                {canEdit && (
                  <div className="flex gap-1 shrink-0">
                    <Button size="sm" variant="outline" onClick={() => setEditing(active)}>
                      <Pencil className="size-3.5 mr-1" /> Edit
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setConfirmDel(active)}>
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                )}
              </div>
              <div className="prose prose-neutral max-w-none whitespace-pre-wrap text-[15px] leading-relaxed">
                {active.content || (
                  <span className="text-muted-foreground italic">No content yet.</span>
                )}
              </div>
              <div className="mt-8 text-xs text-muted-foreground">
                Updated {new Date(active.updated_at).toLocaleString()}
              </div>
            </article>
          ) : (
            <div className="h-full grid place-items-center text-center p-10">
              <div className="max-w-md">
                <BookOpen className="size-10 mx-auto mb-4 text-muted-foreground" />
                <h1 className="font-serif text-2xl mb-2">Introduction</h1>
                <p className="text-sm text-muted-foreground">
                  A shared reference for our permaculture practices, techniques,
                  and important notes across the farms.
                  {canEdit && " Use the + button on the left to add the first section."}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {editing && (
        <SectionDialog
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={(id) => { setEditing(null); setSelectedId(id); }}
        />
      )}

      <AlertDialog open={!!confirmDel} onOpenChange={(v) => !v && setConfirmDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{confirmDel?.title}"?</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive"
              onClick={() => confirmDel && delMut.mutate(confirmDel.id)}
            >Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}

function SectionDialog({
  initial, onClose, onSaved,
}: {
  initial: Partial<Section>;
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const [title, setTitle] = useState(initial.title ?? "");
  const [content, setContent] = useState(initial.content ?? "");
  const qc = useQueryClient();

  const save = useMutation({
    mutationFn: async () => {
      const t = title.trim();
      if (!t) throw new Error("Title is required");
      if (initial.id) {
        const { data, error } = await supabase
          .from("knowledge_sections")
          .update({ title: t, content })
          .eq("id", initial.id)
          .select("id")
          .single();
        if (error) throw new Error(error.message);
        return data.id as string;
      } else {
        const { data, error } = await supabase
          .from("knowledge_sections")
          .insert({ title: t, content, sort_order: initial.sort_order ?? 0 })
          .select("id")
          .single();
        if (error) throw new Error(error.message);
        return data.id as string;
      }
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ["knowledge_sections"] });
      toast.success("Saved");
      onSaved(id);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">
            {initial.id ? "Edit section" : "New section"}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div>
            <Label>Title</Label>
            <Input
              value={title}
              maxLength={200}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Bed Preparation Basics"
            />
          </div>
          <div>
            <Label>Content</Label>
            <Textarea
              rows={14}
              value={content}
              maxLength={20000}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write practices, techniques, notes…"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Line breaks are preserved.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || !title.trim()}>
            {save.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
