"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { ChevronLeftIcon, ChevronRightIcon, DownloadIcon, FileTextIcon, ImageIcon, XIcon } from "lucide-react";
import type { ArtifactState } from "@/app/lib/types";
import { Button } from "@/components/ui/button";
import { MarkdownView } from "@/components/dashboard/markdown-view";

type ViewerState = {
  artifacts: ArtifactState[];
  index: number;
};

function isImageArtifact(artifact: ArtifactState) {
  return artifact.contentType?.startsWith("image/")
    || /\.(png|jpe?g|gif|webp|avif)$/i.test(artifact.uri)
    || /\.(png|jpe?g|gif|webp|avif)$/i.test(artifact.title);
}

function isMarkdownArtifact(artifact: ArtifactState) {
  return artifact.contentType?.includes("markdown") || /\.md$/i.test(artifact.title) || /\.md($|\?)/i.test(artifact.uri);
}

function isTextArtifact(artifact: ArtifactState) {
  return isMarkdownArtifact(artifact) || artifact.contentType?.startsWith("text/") || artifact.contentType?.includes("json") || /\.(txt|log|json)$/i.test(artifact.title);
}

function isPdfArtifact(artifact: ArtifactState) {
  return artifact.contentType === "application/pdf" || /\.pdf($|\?)/i.test(artifact.uri) || /\.pdf$/i.test(artifact.title);
}

function artifactKind(artifact: ArtifactState) {
  if (isImageArtifact(artifact)) return "Изображение";
  if (isMarkdownArtifact(artifact)) return "Markdown";
  if (isPdfArtifact(artifact)) return "PDF";
  if (isTextArtifact(artifact)) return "Текст";
  return artifact.contentType ?? artifact.type;
}

export function ArtifactGallery({ artifacts }: { artifacts: ArtifactState[] }) {
  const [viewerState, setViewerState] = useState<ViewerState | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  function openViewer(index: number) {
    setViewerState({ artifacts: artifacts.slice(), index });
  }

  function changeViewerIndex(index: number) {
    setViewerState((current) => current ? { ...current, index } : current);
  }

  if (artifacts.length === 0) {
    return <p className="text-sm text-muted-foreground">Файлы, отчеты и скриншоты по этой задаче пока не прикреплены.</p>;
  }

  const images = artifacts.filter(isImageArtifact);
  const files = artifacts.filter((artifact) => !isImageArtifact(artifact));

  return (
    <div className="grid gap-4">
      {images.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {images.map((artifact) => {
            const index = artifacts.findIndex((item) => item.id === artifact.id);
            return (
              <button className="group overflow-hidden rounded-xl border bg-background text-left" key={artifact.id} onClick={() => openViewer(index)} type="button">
                <div className="aspect-video bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img alt={artifact.title} className="size-full object-cover transition group-hover:scale-[1.02]" src={artifact.uri} />
                </div>
                <div className="flex items-center gap-2 px-3 py-2 text-sm">
                  <ImageIcon className="size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate font-medium">{artifact.title}</span>
                </div>
              </button>
            );
          })}
        </div>
      ) : null}

      {files.length > 0 ? (
        <div className="grid gap-2">
          {files.map((artifact) => {
            const index = artifacts.findIndex((item) => item.id === artifact.id);
            return (
              <button className="flex min-w-0 items-center gap-3 rounded-xl border bg-background px-3 py-3 text-left text-sm transition hover:bg-muted/50" key={artifact.id} onClick={() => openViewer(index)} type="button">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <FileTextIcon className="size-4 text-muted-foreground" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{artifact.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">{artifactKind(artifact)}</span>
                </span>
              </button>
            );
          })}
        </div>
      ) : null}

      {mounted && viewerState ? createPortal(
        <ArtifactViewer
          artifacts={viewerState.artifacts}
          index={viewerState.index}
          onClose={() => setViewerState(null)}
          onIndexChange={changeViewerIndex}
        />,
        document.body
      ) : null}
    </div>
  );
}

export function ArtifactViewer({
  actions,
  artifacts,
  index,
  onClose,
  onIndexChange,
}: {
  actions?: ReactNode;
  artifacts: ArtifactState[];
  index: number;
  onClose: () => void;
  onIndexChange: (index: number) => void;
}) {
  const artifact = artifacts[index];
  const artifactUri = artifact?.uri ?? "";
  const [textByUri, setTextByUri] = useState<Record<string, string>>({});
  const [loadingText, setLoadingText] = useState(false);
  const text = artifactUri ? textByUri[artifactUri] ?? "" : "";
  const hasCachedText = artifactUri ? Object.prototype.hasOwnProperty.call(textByUri, artifactUri) : false;
  const canPrev = index > 0;
  const canNext = index < artifacts.length - 1;

  useEffect(() => {
    let cancelled = false;
    if (!artifact || !artifactUri || !isTextArtifact(artifact) || hasCachedText) return;
    setLoadingText(true);
    fetch(artifactUri, { cache: "no-store" })
      .then((response) => response.ok ? response.text() : Promise.reject(new Error(`HTTP ${response.status}`)))
      .then((body) => {
        if (!cancelled) setTextByUri((current) => ({ ...current, [artifactUri]: body }));
      })
      .catch((error: Error) => {
        if (!cancelled) setTextByUri((current) => ({ ...current, [artifactUri]: `Не удалось загрузить файл: ${error.message}` }));
      })
      .finally(() => {
        if (!cancelled) setLoadingText(false);
      });
    return () => {
      cancelled = true;
    };
  }, [artifact, artifactUri, hasCachedText]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft" && canPrev) onIndexChange(index - 1);
      if (event.key === "ArrowRight" && canNext) onIndexChange(index + 1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canNext, canPrev, index, onClose, onIndexChange]);

  if (!artifact) return null;

  return (
    <div className="fixed inset-0 z-[70] grid bg-black/70 p-3 backdrop-blur-sm md:p-6" role="dialog" aria-modal="true">
      <div className="grid min-h-0 overflow-hidden rounded-2xl border bg-background shadow-2xl">
        <div className="flex min-h-14 items-center gap-3 border-b px-4">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{artifact.title}</p>
            <p className="text-xs text-muted-foreground">{index + 1} из {artifacts.length} · {artifactKind(artifact)}</p>
          </div>
          {actions}
          <Button asChild size="icon" title="Скачать" type="button" variant="ghost">
            <a href={artifact.uri} download>
              <DownloadIcon className="size-4" />
            </a>
          </Button>
          <Button onClick={onClose} size="icon" title="Закрыть" type="button" variant="ghost">
            <XIcon className="size-4" />
          </Button>
        </div>

        <div className="grid min-h-0 grid-cols-[auto_minmax(0,1fr)_auto] items-stretch">
          <button className="w-11 border-r text-muted-foreground transition hover:bg-muted disabled:opacity-30" disabled={!canPrev} onClick={() => onIndexChange(index - 1)} type="button">
            <ChevronLeftIcon className="mx-auto size-5" />
          </button>
          <div className="min-h-[65vh] min-w-0 overflow-auto bg-muted/25 p-4">
            {isImageArtifact(artifact) ? (
              <div className="flex min-h-full items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img alt={artifact.title} className="max-h-[76vh] max-w-full rounded-xl object-contain shadow-sm" src={artifact.uri} />
              </div>
            ) : isPdfArtifact(artifact) ? (
              <iframe className="h-[76vh] w-full rounded-xl border bg-background" src={artifact.uri} title={artifact.title} />
            ) : isMarkdownArtifact(artifact) ? (
              <article className="mx-auto max-w-4xl rounded-xl border bg-background p-5">
                {loadingText ? <p className="text-sm text-muted-foreground">Загружаю файл...</p> : <MarkdownView value={text} />}
              </article>
            ) : isTextArtifact(artifact) ? (
              <pre className="mx-auto max-w-5xl overflow-x-auto rounded-xl border bg-background p-4 text-xs leading-6">
                {loadingText ? "Загружаю файл..." : text}
              </pre>
            ) : (
              <div className="mx-auto grid max-w-lg place-items-center rounded-xl border bg-background p-8 text-center">
                <FileTextIcon className="mb-3 size-8 text-muted-foreground" />
                <p className="font-medium">Предпросмотр недоступен</p>
                <p className="mt-1 text-sm text-muted-foreground">Файл можно скачать кнопкой в правом верхнем углу.</p>
              </div>
            )}
          </div>
          <button className="w-11 border-l text-muted-foreground transition hover:bg-muted disabled:opacity-30" disabled={!canNext} onClick={() => onIndexChange(index + 1)} type="button">
            <ChevronRightIcon className="mx-auto size-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
