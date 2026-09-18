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
        if ((c.columnDef.meta as any)?.excludeFromCsv || c.id === "actions") continue;
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
    triggerDownload(buildBlob("csv"), "csv");
  }

  function downloadXlsx() {
    triggerDownload(buildBlob("xlsx"), "xlsx");
  }

  function buildBlob(fmt: FileFormat): Blob {
    const rows = getRows();
    if (fmt === "csv") {
      return new Blob([Papa.unparse(rows)], { type: "text/csv" });
    }
    if (fmt === "xlsx") {
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
      const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
      return new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    }
    // pdf
    const headers = rows.length ? Object.keys(rows[0]) : table.getVisibleLeafColumns().map((c) => c.id);
    const body = rows.map((r) => headers.map((h) => String(r[h] ?? "")));
    const doc = new jsPDF({ orientation: headers.length > 6 ? "landscape" : "portrait" });
    doc.setFontSize(14);
    doc.text(csvFilename || "Export", 14, 14);
    autoTable(doc, { head: [headers], body, startY: 20, styles: { fontSize: 8 } });
    return doc.output("blob");
  }

  function mimeFor(fmt: FileFormat) {
    return fmt === "csv"
      ? "text/csv"
      : fmt === "xlsx"
        ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        : "application/pdf";
  }

  async function exportToDrive(fmt: FileFormat) {
    setUploading(true);
    try {
      const blob = buildBlob(fmt);
      const buf = await blob.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let bin = "";
      for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
      const contentBase64 = btoa(bin);
      const r = await driveUpload({
        data: {
          filename: `${csvFilename || "export"}.${fmt}`,
          contentBase64,
          mimeType: mimeFor(fmt),
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

  async function share(channel: ShareChannel, fmt: FileFormat) {
    const blob = buildBlob(fmt);
    const filename = `${csvFilename || "export"}.${fmt}`;
    const file = new File([blob], filename, { type: mimeFor(fmt) });
    const title = csvFilename || "Export";
    const text = `${title} (${fmt.toUpperCase()})`;

    // Native share with file attachment (mobile / supported browsers)
    const nav = navigator as any;
    if (nav.canShare?.({ files: [file] })) {
      try {
        await nav.share({ files: [file], title, text });
        return;
      } catch (e: any) {
        if (e?.name === "AbortError") return;
      }
    }

    // Fallback: download the file, then open the channel with a text message
    triggerDownload(blob, fmt);
    const msg = `${title} attached (${filename}). Please find the ${fmt.toUpperCase()} file just downloaded.`;
    const encoded = encodeURIComponent(msg);
    let url = "";
    if (channel === "email") {
      url = `mailto:?subject=${encodeURIComponent(title)}&body=${encoded}`;
    } else if (channel === "whatsapp") {
      url = `https://wa.me/?text=${encoded}`;
    } else {
      url = `sms:?&body=${encoded}`;
    }
    window.open(url, channel === "whatsapp" ? "_blank" : "_self");
    toast.info("File downloaded — attach it in the opened share window.");
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
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Download</DropdownMenuLabel>
            <DropdownMenuItem onClick={downloadCsv}><FileText className="size-3.5 mr-2" /> CSV (.csv)</DropdownMenuItem>
            <DropdownMenuItem onClick={downloadXlsx}><FileSpreadsheet className="size-3.5 mr-2" /> Excel (.xlsx)</DropdownMenuItem>
            <DropdownMenuItem onClick={() => triggerDownload(buildBlob("pdf"), "pdf")}><FileType className="size-3.5 mr-2" /> PDF (.pdf)</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuSub>
              <DropdownMenuSubTrigger><Cloud className="size-3.5 mr-2" /> Save to Google Drive</DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuItem onClick={() => exportToDrive("csv")} disabled={uploading}>As CSV</DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportToDrive("xlsx")} disabled={uploading}>As Excel</DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportToDrive("pdf")} disabled={uploading}>As PDF</DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="flex items-center gap-2"><Share2 className="size-3.5" /> Share</DropdownMenuLabel>
            {([
              { ch: "email" as const, label: "Email", icon: Mail },
              { ch: "whatsapp" as const, label: "WhatsApp", icon: MessageCircle },
              { ch: "sms" as const, label: "Text message", icon: MessageSquare },
            ]).map(({ ch, label, icon: Icon }) => (
              <DropdownMenuSub key={ch}>
                <DropdownMenuSubTrigger><Icon className="size-3.5 mr-2" /> {label}</DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuItem onClick={() => share(ch, "pdf")}>As PDF</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => share(ch, "xlsx")}>As Excel</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => share(ch, "csv")}>As CSV</DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            ))}
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
