import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UploadCloud, Upload, Trash2, Link as LinkIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ImageUploadSectionProps {
  imageUrl: string | null;
  onChange: (url: string | null) => void;
  label?: string;
}

export function ImageUploadSection({
  imageUrl,
  onChange,
  label = "Thumbnail photo",
}: ImageUploadSectionProps) {
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState<"upload" | "url">("upload");
  const [urlInput, setUrlInput] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  async function handleFile(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file (PNG, JPG, WEBP)");
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      toast.error("Image must be smaller than 15 MB");
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `crops/${crypto.randomUUID()}.${ext}`;

      const { error } = await supabase.storage.from("knowledge-images").upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type,
      });

      if (error) {
        // Fallback to Base64 Data URL if Supabase storage upload fails or bucket not configured
        const reader = new FileReader();
        reader.onload = () => {
          onChange(reader.result as string);
          toast.success("Image attached");
        };
        reader.onerror = () => {
          toast.error(`Upload error: ${error.message}`);
        };
        reader.readAsDataURL(file);
        return;
      }

      const { data: pub } = supabase.storage.from("knowledge-images").getPublicUrl(path);

      onChange(pub.publicUrl);
      toast.success("Image uploaded successfully");
    } catch (err: any) {
      // Fallback to Base64
      try {
        const reader = new FileReader();
        reader.onload = () => {
          onChange(reader.result as string);
          toast.success("Image attached");
        };
        reader.readAsDataURL(file);
      } catch {
        toast.error(err?.message || "Failed to upload image");
      }
    } finally {
      setUploading(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  function applyUrl() {
    const trimmed = urlInput.trim();
    if (!trimmed) return;
    if (
      !trimmed.startsWith("http://") &&
      !trimmed.startsWith("https://") &&
      !trimmed.startsWith("data:image/")
    ) {
      toast.error("Please enter a valid web image URL (e.g. https://...)");
      return;
    }
    onChange(trimmed);
    setUrlInput("");
    toast.success("Image URL applied");
  }

  if (imageUrl) {
    return (
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">{label}</Label>
        <div className="flex items-center gap-4 p-3 rounded-lg border bg-muted/20">
          <div className="relative size-20 sm:size-24 rounded-md overflow-hidden border bg-muted shrink-0 shadow-2xs">
            <img
              src={imageUrl}
              alt="Photo preview"
              className="size-full object-cover"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.opacity = "0.3";
              }}
            />
          </div>
          <div className="flex-1 min-w-0 space-y-2">
            <div className="space-y-0.5">
              <p className="text-xs font-medium text-foreground truncate">
                {imageUrl.startsWith("data:") ? "Direct image attachment" : imageUrl}
              </p>
              <p className="text-[11px] text-muted-foreground">Photo preview ready to save</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? (
                  <>
                    <Loader2 className="size-3.5 mr-1.5 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="size-3.5 mr-1.5" />
                    Change image
                  </>
                )}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => onChange(null)}
                disabled={uploading}
              >
                <Trash2 className="size-3.5 mr-1.5" />
                Remove image
              </Button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/jpg"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
                e.target.value = "";
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium">{label}</Label>
        <div className="flex items-center text-xs text-muted-foreground gap-1.5">
          <button
            type="button"
            onClick={() => setActiveTab("upload")}
            className={cn(
              "px-2 py-0.5 rounded transition-colors text-xs cursor-pointer",
              activeTab === "upload"
                ? "bg-muted text-foreground font-medium"
                : "hover:text-foreground",
            )}
          >
            File upload
          </button>
          <span>•</span>
          <button
            type="button"
            onClick={() => setActiveTab("url")}
            className={cn(
              "px-2 py-0.5 rounded transition-colors text-xs cursor-pointer",
              activeTab === "url"
                ? "bg-muted text-foreground font-medium"
                : "hover:text-foreground",
            )}
          >
            Image URL
          </button>
        </div>
      </div>

      {activeTab === "upload" ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => !uploading && fileInputRef.current?.click()}
          className={cn(
            "border-2 border-dashed rounded-lg p-5 flex flex-col items-center justify-center text-center cursor-pointer transition-colors",
            dragOver
              ? "border-primary bg-primary/5"
              : "border-border/80 hover:border-muted-foreground/50 hover:bg-muted/30",
            uploading && "opacity-70 pointer-events-none",
          )}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/jpg"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
              e.target.value = "";
            }}
          />
          {uploading ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="size-6 animate-spin text-primary" />
              <p className="text-xs text-muted-foreground">Uploading image to storage...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1.5">
              <div className="size-9 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                <UploadCloud className="size-5" />
              </div>
              <p className="text-xs font-medium text-foreground">
                Click to upload or drag and drop
              </p>
              <p className="text-[11px] text-muted-foreground">PNG, JPG, or WebP up to 15MB</p>
            </div>
          )}
        </div>
      ) : (
        <div className="flex gap-2">
          <div className="relative flex-1">
            <LinkIcon className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://images.unsplash.com/photo-..."
              className="pl-8 text-xs"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  applyUrl();
                }
              }}
            />
          </div>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={applyUrl}
            disabled={!urlInput.trim()}
          >
            Attach
          </Button>
        </div>
      )}
    </div>
  );
}
