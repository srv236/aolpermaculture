import { useState, useMemo, type ReactNode } from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
  DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { ArrowUpDown, ChevronLeft, ChevronRight, Download, FileSpreadsheet, FileText, Cloud, Loader2, Share2, Mail, MessageCircle, MessageSquare, FileType } from "lucide-react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useServerFn } from "@tanstack/react-start";
import { uploadToDrive } from "@/lib/drive.functions";
import { toast } from "sonner";

type FileFormat = "csv" | "xlsx" | "pdf";
type ShareChannel = "email" | "whatsapp" | "sms";

type Props<T> = {
  data: T[];
  columns: ColumnDef<T, any>[];
  searchKeys?: (keyof T)[];
  searchPlaceholder?: string;
  toolbar?: ReactNode;
  csvFilename?: string;
  emptyMessage?: string;
};

export function DataTable<T extends Record<string, any>>({
  data, columns, searchKeys, searchPlaceholder = "Search...", toolbar, csvFilename, emptyMessage,
}: Props<T>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [filter, setFilter] = useState("");

  const filtered = useMemo(() => {
    if (!filter.trim() || !searchKeys?.length) return data;
    const f = filter.toLowerCase();
    return data.filter((r) =>
      searchKeys.some((k) => String(r[k] ?? "").toLowerCase().includes(f)),
    );
  }, [data, filter, searchKeys]);

  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  });

  const [uploading, setUploading] = useState(false);
  const driveUpload = useServerFn(uploadToDrive);

  function getRows() {
    return table.getFilteredRowModel().rows.map((r) => {
      const o: Record<string, any> = {};
      for (const c of table.getVisibleLeafColumns()) {
        const key = (c.columnDef.meta as any)?.csvKey || c.id;
        o[key] = r.getValue(c.id);
      }
      return o;
    });
  }

  function triggerDownload(blob: Blob, ext: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${csvFilename || "export"}.${ext}`; a.click();
    URL.revokeObjectURL(url);
  }

  function downloadCsv() {
    triggerDownload(new Blob([Papa.unparse(getRows())], { type: "text/csv" }), "csv");
  }

  function downloadXlsx() {
    const ws = XLSX.utils.json_to_sheet(getRows());
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
    triggerDownload(
      new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
      "xlsx",
    );
  }

  async function exportToDrive() {
    setUploading(true);
    try {
      const ws = XLSX.utils.json_to_sheet(getRows());
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
      const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
      const bytes = new Uint8Array(buf);
      let bin = "";
      for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
      const contentBase64 = btoa(bin);
      const r = await driveUpload({
        data: {
          filename: `${csvFilename || "export"}.xlsx`,
          contentBase64,
          mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        },
      });
      toast.success("Saved to Google Drive", {
        description: r.name,
        action: r.webViewLink ? { label: "Open", onClick: () => window.open(r.webViewLink, "_blank") } : undefined,
      });
    } catch (e: any) {
      toast.error(e?.message || "Drive export failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {searchKeys?.length ? (
          <Input
            placeholder={searchPlaceholder}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="max-w-xs"
          />
        ) : null}
        <div className="flex-1" />
        {toolbar}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" size="sm" disabled={uploading}>
              {uploading ? <Loader2 className="size-3.5 mr-1.5 animate-spin" /> : <Download className="size-3.5 mr-1.5" />}
              Export
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={downloadCsv}><FileText className="size-3.5 mr-2" /> Download CSV</DropdownMenuItem>
            <DropdownMenuItem onClick={downloadXlsx}><FileSpreadsheet className="size-3.5 mr-2" /> Download Excel (.xlsx)</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={exportToDrive} disabled={uploading}><Cloud className="size-3.5 mr-2" /> Save to Google Drive</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="border rounded-md bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((h) => (
                  <TableHead key={h.id}>
                    {h.isPlaceholder ? null : (
                      <button
                        type="button"
                        onClick={h.column.getToggleSortingHandler()}
                        className="inline-flex items-center gap-1 hover:text-foreground"
                      >
                        {flexRender(h.column.columnDef.header, h.getContext())}
                        {h.column.getCanSort() && <ArrowUpDown className="size-3 opacity-40" />}
                      </button>
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="text-center text-muted-foreground py-10">
                  {emptyMessage || "Nothing here yet."}
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((r) => (
                <TableRow key={r.id}>
                  {r.getVisibleCells().map((c) => (
                    <TableCell key={c.id}>
                      {flexRender(c.column.columnDef.cell, c.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <div>
          {table.getFilteredRowModel().rows.length} row(s)
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" disabled={!table.getCanPreviousPage()}
                  onClick={() => table.previousPage()}>
            <ChevronLeft className="size-4" />
          </Button>
          <span>
            Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount() || 1}
          </span>
          <Button type="button" variant="outline" size="sm" disabled={!table.getCanNextPage()}
                  onClick={() => table.nextPage()}>
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
