"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Edit3Icon, FileTextIcon, XIcon } from "lucide-react";
import type { ArtifactState, MaterialState } from "@/app/lib/types";
import { MarkdownView } from "@/components/dashboard/markdown-view";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select-field";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

const statusLabels: Record<string, string> = {
  draft: "черновик",
  verified: "проверено",
  archived: "архив",
  instruction: "инструкция",
  report: "отчет",
  brief: "бриф",
  document: "документ",
};

function label(value: string) {
  return statusLabels[value] ?? value.replaceAll("_", " ");
}

function formatDate(value?: string) {
  if (!value) return "нет данных";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Moscow",
  }).format(date);
}

function toneClass(status: string) {
  if (status === "verified") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "draft") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-border bg-muted text-muted-foreground";
}

function contentTypeForMaterial(material: MaterialState) {
  if (material.contentType) return material.contentType;
  if (/\.md($|\?)/i.test(material.storageUri)) return "text/markdown";
  if (/\.pdf($|\?)/i.test(material.storageUri)) return "application/pdf";
  if (/\.(png|jpe?g|gif|webp|avif)$/i.test(material.storageUri)) return "image/*";
  if (/\.(txt|log|json)$/i.test(material.storageUri)) return "text/plain";
  return "application/octet-stream";
}

function isEditableMaterial(material: MaterialState) {
  const type = contentTypeForMaterial(material);
  return type.includes("markdown") || type.startsWith("text/") || type.includes("json");
}

function materialToArtifact(material: MaterialState): ArtifactState {
  return {
    id: material.id,
    title: material.title,
    type: material.type,
    uri: material.publicUri ?? material.storageUri,
    contentType: contentTypeForMaterial(material),
    createdAt: material.updatedAt,
  };
}

export function MaterialLibrary({ materials }: { materials: MaterialState[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const selected = useMemo(() => materials.find((material) => material.id === selectedId) ?? null, [materials, selectedId]);

  useEffect(() => setMounted(true), []);

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Материал</TableHead>
            <TableHead>Тип</TableHead>
            <TableHead>Статус</TableHead>
            <TableHead>Хранилище</TableHead>
            <TableHead className="text-right">Действия</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {materials.map((material) => (
            <TableRow className="cursor-pointer" key={material.id} onClick={() => setSelectedId(material.id)}>
              <TableCell>
                <p className="font-medium">{material.title}</p>
                <p className="text-muted-foreground">v{material.version} · {formatDate(material.updatedAt)}</p>
              </TableCell>
              <TableCell>{label(material.type)}</TableCell>
              <TableCell><Badge className={toneClass(material.status)} variant="outline">{label(material.status)}</Badge></TableCell>
              <TableCell className="max-w-md truncate font-mono text-xs">{material.storageUri}</TableCell>
              <TableCell className="text-right">
                <Button onClick={(event) => { event.stopPropagation(); setSelectedId(material.id); }} size="sm" type="button" variant="outline">
                  Открыть
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {materials.length === 0 ? <TableRow><TableCell colSpan={5}>Библиотека пока пустая.</TableCell></TableRow> : null}
        </TableBody>
      </Table>

      {mounted && selected ? createPortal(
        <MaterialModal material={selected} onClose={() => setSelectedId(null)} />,
        document.body
      ) : null}
    </>
  );
}

function MaterialModal({ material, onClose }: { material: MaterialState; onClose: () => void }) {
  const artifact = materialToArtifact(material);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const editable = isEditableMaterial(material);

  useEffect(() => {
    let cancelled = false;
    setContent("");
    if (!editable) return;
    setLoading(true);
    fetch(artifact.uri, { cache: "no-store" })
      .then((response) => response.ok ? response.text() : Promise.reject(new Error(`HTTP ${response.status}`)))
      .then((body) => {
        if (!cancelled) setContent(body);
      })
      .catch((error: Error) => {
        if (!cancelled) setContent(`Не удалось загрузить файл: ${error.message}`);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [artifact.uri, editable]);

  return (
    <div className="fixed inset-0 z-[65] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="grid max-h-[92vh] w-full max-w-6xl grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-2xl border bg-background shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b px-5 py-4">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge className={toneClass(material.status)} variant="outline">{label(material.status)}</Badge>
              <Badge variant="outline">{label(material.type)}</Badge>
            </div>
            <h2 className="line-clamp-2 text-xl font-semibold">{material.title}</h2>
            <p className="mt-1 text-xs text-muted-foreground">v{material.version} · {material.storageUri}</p>
          </div>
          <Button onClick={onClose} size="icon" type="button" variant="ghost">
            <XIcon className="size-4" />
          </Button>
        </div>

        <div className="grid min-h-0 gap-4 overflow-y-auto p-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
          <section className="min-w-0 overflow-hidden rounded-xl border bg-muted/20">
            <div className="border-b px-4 py-3">
              <p className="text-sm font-semibold">Просмотр файла</p>
              <p className="truncate text-xs text-muted-foreground">{artifact.uri}</p>
            </div>
            <div className="max-h-[68vh] overflow-auto p-4">
              {contentTypeForMaterial(material).startsWith("image/") ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img alt={material.title} className="mx-auto max-h-[64vh] rounded-xl object-contain" src={artifact.uri} />
              ) : contentTypeForMaterial(material) === "application/pdf" ? (
                <iframe className="h-[64vh] w-full rounded-xl border bg-background" src={artifact.uri} title={material.title} />
              ) : contentTypeForMaterial(material).includes("markdown") ? (
                <article className="rounded-xl border bg-background p-5">
                  {loading ? <p className="text-sm text-muted-foreground">Загружаю файл...</p> : <MarkdownView value={content} />}
                </article>
              ) : editable ? (
                <pre className="overflow-x-auto rounded-xl border bg-background p-4 text-xs leading-6">{loading ? "Загружаю файл..." : content}</pre>
              ) : (
                <div className="grid place-items-center rounded-xl border bg-background p-8 text-center">
                  <FileTextIcon className="mb-2 size-8 text-muted-foreground" />
                  <p className="font-medium">Предпросмотр недоступен</p>
                </div>
              )}
            </div>
          </section>

          <section className="min-w-0 rounded-xl border p-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <Edit3Icon className="size-4" />
              Карточка материала
            </h3>
            <form action="/api/materials/action" className="mt-4 grid gap-3" method="post">
              <input name="id" type="hidden" value={material.id} />
              <Input name="title" defaultValue={material.title} required />
              <SelectField aria-label="Статус материала" defaultValue={material.status} name="status">
                <option value="draft">Черновик</option>
                <option value="verified">Проверено</option>
                <option value="archived">Архив</option>
              </SelectField>
              <Textarea name="sourceSummary" defaultValue={material.sourceSummary ?? ""} placeholder="Описание материала" rows={4} />
              {editable ? (
                <Textarea
                  className="min-h-72 font-mono text-xs"
                  name="content"
                  onChange={(event) => setContent(event.currentTarget.value)}
                  value={loading ? "Загружаю файл..." : content}
                />
              ) : (
                <div className="rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground">
                  <FileTextIcon className="mb-2 size-5" />
                  Этот тип файла пока можно просматривать, но не редактировать как текст.
                </div>
              )}
              <div className="flex justify-end">
                <Button type="submit">Сохранить изменения</Button>
              </div>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}
