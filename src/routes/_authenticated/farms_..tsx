
// ===== RESOURCES =====
function ResourcesTab({ farmId, rows, canEdit }: { farmId: string; rows: any[]; canEdit: boolean }) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [confirmDel, setConfirmDel] = useState<any>(null);
  const qc = useQueryClient();
  const del = useServerFn(deleteResource);
  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["resources", farmId] }); setConfirmDel(null); toast.success("Resource deleted"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const data = rows.map((r) => ({
    ...r,
    plot_number: r.plots?.plot_number ?? "—",
    start_local: r.start_time ? new Date(r.start_time).toLocaleString() : "",
    end_local: r.end_time ? new Date(r.end_time).toLocaleString() : "",
    qty_label: r.quantity != null ? `${r.quantity} ${r.unit || ""}`.trim() : "—",
  }));

  const columns: ColumnDef<any>[] = [
    { id: "start_local", accessorKey: "start_local", header: "Start" },
    { id: "end_local", accessorKey: "end_local", header: "End" },
    { id: "resource_name", accessorKey: "resource_name", header: "Resource" },
    { id: "resource_type", accessorKey: "resource_type", header: "Type",
      cell: ({ getValue }) => <Badge variant="secondary" className="capitalize">{String(getValue() ?? "")}</Badge> },
    { id: "qty_label", accessorKey: "qty_label", header: "Qty" },
    { id: "plot_number", accessorKey: "plot_number", header: "Plot" },
    { id: "used_for", accessorKey: "used_for", header: "Used for",
      cell: ({ row }) => <span className="line-clamp-1 max-w-xs">{row.original.used_for}</span> },
    { id: "notes", accessorKey: "notes", header: "Notes",
      cell: ({ row }) => <span className="line-clamp-1 max-w-xs">{row.original.notes}</span> },
    ...(canEdit ? [{
      id: "actions", header: "", cell: ({ row }: any) => (
        <div className="flex gap-1 justify-end">
          <Button size="sm" variant="ghost" onClick={() => setEditing(row.original)}><Pencil className="size-3.5" /></Button>
          <Button size="sm" variant="ghost" onClick={() => setConfirmDel(row.original)}><Trash2 className="size-3.5" /></Button>
        </div>
      ),
    }] : []),
  ];

  return (
    <>
      <DataTable
        data={data} columns={columns} searchKeys={["resource_name", "resource_type", "plot_number", "used_for"]}
        searchPlaceholder="Search resources..." csvFilename="resources"
        toolbar={canEdit && <Button size="sm" onClick={() => setAdding(true)}><Plus className="size-3.5 mr-1" /> Record resource</Button>}
        emptyMessage="No resources recorded yet."
      />
      {(adding || editing) && (
        <ResourceFormDialog open onOpenChange={(v) => { if (!v) { setAdding(false); setEditing(null); } }}
                            initial={editing} farmId={farmId} />
      )}
      <AlertDialog open={!!confirmDel} onOpenChange={(v) => !v && setConfirmDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this resource record?</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive" onClick={() => delMut.mutate(confirmDel.id)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
