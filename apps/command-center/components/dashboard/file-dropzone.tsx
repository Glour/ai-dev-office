"use client";

import { useState } from "react";
import { FileUpIcon } from "lucide-react";

export function FileDropzone({
  name = "attachments",
  title = "Перетащите файлы сюда",
  description = "Можно прикрепить любые файлы: документы, изображения, архивы, аудио или таблицы.",
}: {
  name?: string;
  title?: string;
  description?: string;
}) {
  const [files, setFiles] = useState<File[]>([]);

  return (
    <label className="group grid cursor-pointer gap-2 rounded-xl border border-dashed bg-background p-4 transition hover:border-foreground/25 hover:bg-muted/30">
      <span className="flex items-center gap-3">
        <span className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground transition group-hover:text-foreground">
          <FileUpIcon className="size-4" />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-medium">{title}</span>
          <span className="block text-xs leading-5 text-muted-foreground">{description}</span>
        </span>
      </span>
      <input
        className="sr-only"
        multiple
        name={name}
        onChange={(event) => setFiles(Array.from(event.currentTarget.files ?? []))}
        type="file"
      />
      {files.length > 0 ? (
        <span className="flex flex-wrap gap-1.5 pt-1">
          {files.map((file) => (
            <span className="max-w-full truncate rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground" key={`${file.name}-${file.size}`}>
              {file.name}
            </span>
          ))}
        </span>
      ) : null}
    </label>
  );
}
