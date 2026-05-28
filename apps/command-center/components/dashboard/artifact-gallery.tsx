"use client";

import { ExternalLinkIcon, FileTextIcon, ImageIcon } from "lucide-react";
import type { ArtifactState } from "@/app/lib/types";

function isImageArtifact(artifact: ArtifactState) {
  return artifact.contentType?.startsWith("image/")
    || /\.(png|jpe?g|gif|webp|avif)$/i.test(artifact.uri)
    || /\.(png|jpe?g|gif|webp|avif)$/i.test(artifact.title);
}

function isMarkdownArtifact(artifact: ArtifactState) {
  return artifact.contentType === "text/markdown" || /\.md$/i.test(artifact.title) || /\.md($|\?)/i.test(artifact.uri);
}

export function ArtifactGallery({ artifacts }: { artifacts: ArtifactState[] }) {
  if (artifacts.length === 0) {
    return <p className="text-sm text-muted-foreground">Файлы, отчеты и скриншоты по этой задаче пока не прикреплены.</p>;
  }

  const images = artifacts.filter(isImageArtifact);
  const files = artifacts.filter((artifact) => !isImageArtifact(artifact));

  return (
    <div className="grid gap-4">
      {images.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {images.map((artifact) => (
            <a className="group overflow-hidden rounded-xl border bg-background" href={artifact.uri} key={artifact.id} rel="noreferrer" target="_blank">
              <div className="aspect-video bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img alt={artifact.title} className="size-full object-cover transition group-hover:scale-[1.02]" src={artifact.uri} />
              </div>
              <div className="flex items-center gap-2 px-3 py-2 text-sm">
                <ImageIcon className="size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate font-medium">{artifact.title}</span>
                <ExternalLinkIcon className="size-3.5 shrink-0 text-muted-foreground" />
              </div>
            </a>
          ))}
        </div>
      ) : null}

      {files.length > 0 ? (
        <div className="grid gap-2">
          {files.map((artifact) => (
            <a className="flex min-w-0 items-center gap-3 rounded-xl border bg-background px-3 py-3 text-sm transition hover:bg-muted/50" href={artifact.uri} key={artifact.id} rel="noreferrer" target="_blank">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                <FileTextIcon className="size-4 text-muted-foreground" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{artifact.title}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {isMarkdownArtifact(artifact) ? "Markdown отчет" : artifact.contentType ?? artifact.type}
                </span>
              </span>
              <ExternalLinkIcon className="size-4 shrink-0 text-muted-foreground" />
            </a>
          ))}
        </div>
      ) : null}
    </div>
  );
}
