import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listUsers, createUser, setUserRole, setUserActive, deleteUserAccount } from "@/lib/admin.functions";
import { getMe } from "@/lib/farm.functions";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Power } from "lucide-react";
import { DataTable } from "@/components/data-table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";

export const Route = createFileRoute("/_authenticated/admin/users")({
  ssr: false,
  beforeLoad: async () => {
    const me = await getMe();
    if (!me.roles.includes("admin")) throw redirect({ to: "/farms" });
  },
  component: UsersPage,
});

function UsersPage() {
  const list = useServerFn(listUsers);
  const setRole = useServerFn(setUserRole);
  const setActive = useServerFn(setUserActive);
  const del = useServerFn(deleteUserAccount);
  const users = useQuery({ queryKey: ["users"], queryFn: () => list() });
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [confirmDel, setConfirmDel] = useState<any>(null);

  const roleMut = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: "admin" | "editor" | "viewer" }) =>
      setRole({ data: { userId, role } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["users"] }); toast.success("Role updated"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const activeMut = useMutation({
    mutationFn: ({ userId, isActive }: { userId: string; isActive: boolean }) =>
      setActive({ data: { userId, isActive } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["users"] }); toast.success("Status updated"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const delMut = useMutation({
    mutationFn: (userId: string) => del({ data: { userId } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["users"] }); setConfirmDel(null); toast.success("User deleted"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const columns: ColumnDef<any>[] = [
    { id: "full_name", accessorKey: "full_name", header: "Name" },
    { id: "email", accessorKey: "email", header: "Email" },
    { id: "role", header: "Role", cell: ({ row }) => (
      <Select
        value={row.original.roles?.[0] || "viewer"}
        onValueChange={(v) => roleMut.mutate({ userId: row.original.id, role: v as any })}
      >
        <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="admin">admin</SelectItem>
          <SelectItem value="editor">editor</SelectItem>
          <SelectItem value="viewer">viewer</SelectItem>
        </SelectContent>
      </Select>
    )},
    { id: "is_active", header: "Status", cell: ({ row }) =>
      row.original.is_active
        ? <Badge variant="secondary">Active</Badge>
        : <Badge variant="outline">Inactive</Badge> },
    { id: "actions", header: "", cell: ({ row }) => (
      <div className="flex gap-1 justify-end">
        <Button size="sm" variant="ghost" onClick={() => activeMut.mutate({ userId: row.original.id, isActive: !row.original.is_active })}>
          <Power className="size-3.5" />
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setConfirmDel(row.original)}>
          <Trash2 className="size-3.5" />
        </Button>
      </div>
    )},
  ];

  return (
    <AppShell>
      <div className="p-8 max-w-5xl">
        <div className="flex items-end justify-between mb-6">
          <div>
            <h1 className="font-serif text-3xl">Team & Roles</h1>
            <p className="text-sm text-muted-foreground mt-1">Admins, editors, and viewers</p>
          </div>
        </div>
        <DataTable
          data={users.data || []} columns={columns}
          searchKeys={["full_name", "email"]}
          searchPlaceholder="Search users..." csvFilename="users"
          toolbar={<Button size="sm" onClick={() => setAdding(true)}><Plus className="size-3.5 mr-1" /> Add user</Button>}
        />
        {adding && <AddUserDialog open onOpenChange={setAdding} />}
        <AlertDialog open={!!confirmDel} onOpenChange={(v) => !v && setConfirmDel(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {confirmDel?.full_name || confirmDel?.email}?</AlertDialogTitle>
              <AlertDialogDescription>This permanently removes the account and access. This cannot be undone.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction className="bg-destructive" onClick={() => delMut.mutate(confirmDel.id)}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppShell>
  );
}

function AddUserDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [full_name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "editor" | "viewer">("viewer");
  const create = useServerFn(createUser);
  const qc = useQueryClient();
  const mut = useMutation({
    mutationFn: () => create({ data: { full_name, email, password, role } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      toast.success("User created — share the password with them");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">Add a user</DialogTitle>
          <DialogDescription>Create an account with a temporary password they can use to sign in.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div><Label>Full name</Label><Input value={full_name} onChange={(e) => setName(e.target.value)} /></div>
          <div><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div><Label>Temporary password</Label><Input type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" /></div>
          <div>
            <Label>Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin — full access incl. user management</SelectItem>
                <SelectItem value="editor">Editor — can add/edit data</SelectItem>
                <SelectItem value="viewer">Viewer — read-only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending || !email || password.length < 8 || !full_name}>
            {mut.isPending ? "Creating..." : "Create user"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
