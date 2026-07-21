"use client";
import { useRef, useState, useCallback } from "react";
import { UploadCloud, FileText, X, FolderUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { readableBytes } from "@/lib/image";

// Allow selecting a whole folder (webkitdirectory) — typed loosely for React.
type DirInputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  webkitdirectory?: string;
  directory?: string;
};

export function FileDropzone({
  files,
  onChange,
}: {
  files: File[];
  onChange: (files: File[]) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);

  const add = useCallback(
    (incoming: FileList | null) => {
      if (!incoming) return;
      const next = Array.from(incoming).filter(
        (f) => f.size > 0 && f.size < 8 * 1024 * 1024
      );
      const byKey = new Map(files.map((f) => [f.name + f.size, f]));
      next.forEach((f) => byKey.set(f.name + f.size, f));
      onChange(Array.from(byKey.values()));
    },
    [files, onChange]
  );

  const remove = (name: string, size: number) =>
    onChange(files.filter((f) => !(f.name === name && f.size === size)));

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          add(e.dataTransfer.files);
        }}
        className={cn(
          "relative flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed px-6 py-10 text-center transition-all duration-200",
          drag
            ? "border-iris-500 bg-iris-50"
            : "border-line-strong bg-surface-inset/60 hover:border-line-strong hover:bg-surface-inset"
        )}
      >
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-iris-soft text-iris-600">
          <UploadCloud className="h-6 w-6" />
        </div>
        <div>
          <p className="text-sm font-medium text-content">
            Drag &amp; drop your reference files
          </p>
          <p className="mt-0.5 text-xs text-content-subtle">
            Docs, notes, playbooks, CSVs. We&apos;ll turn them into shared knowledge. Max 8MB each.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line-strong bg-surface-overlay px-3 py-1.5 text-xs font-medium text-content hover:bg-surface-raised"
          >
            <FileText className="h-3.5 w-3.5" /> Choose files
          </button>
          <button
            type="button"
            onClick={() => folderRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-content/[0.04] px-3 py-1.5 text-xs font-medium text-content-muted hover:text-content"
          >
            <FolderUp className="h-3.5 w-3.5" /> Upload a folder
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => add(e.target.files)}
        />
        <input
          ref={folderRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => add(e.target.files)}
          {...({ webkitdirectory: "", directory: "" } as DirInputProps)}
        />
      </div>

      {files.length > 0 && (
        <div className="mt-3 space-y-1.5">
          <p className="text-2xs font-medium uppercase tracking-wide text-content-subtle">
            {files.length} file{files.length > 1 ? "s" : ""} ready
          </p>
          <div className="max-h-44 space-y-1.5 overflow-y-auto pr-1">
            {files.map((f) => (
              <div
                key={f.name + f.size}
                className="flex items-center gap-2.5 rounded-lg border border-line bg-surface-inset px-3 py-2"
              >
                <FileText className="h-4 w-4 shrink-0 text-iris-600" />
                <span className="min-w-0 flex-1 truncate text-xs text-content">{f.name}</span>
                <span className="shrink-0 text-2xs text-content-subtle">
                  {readableBytes(f.size)}
                </span>
                <button
                  type="button"
                  onClick={() => remove(f.name, f.size)}
                  className="text-content-subtle hover:text-danger"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
