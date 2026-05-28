"use client";

import type { ReactNode } from "react";

function inlineMarkdown(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /(`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text))) {
    if (match.index > cursor) nodes.push(text.slice(cursor, match.index));
    const token = match[0];
    if (token.startsWith("`")) {
      nodes.push(
        <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.92em]" key={`${token}-${match.index}`}>
          {token.slice(1, -1)}
        </code>
      );
    } else {
      const link = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (link) {
        nodes.push(
          <a className="font-medium underline underline-offset-4" href={link[2]} key={`${token}-${match.index}`} rel="noreferrer" target="_blank">
            {link[1]}
          </a>
        );
      }
    }
    cursor = match.index + token.length;
  }
  if (cursor < text.length) nodes.push(text.slice(cursor));
  return nodes;
}

export function MarkdownView({ value }: { value: string }) {
  const lines = value.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index] ?? "";
    if (!line.trim()) {
      index += 1;
      continue;
    }

    if (line.startsWith("```")) {
      const code: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index]?.startsWith("```")) {
        code.push(lines[index] ?? "");
        index += 1;
      }
      index += 1;
      blocks.push(
        <pre className="overflow-x-auto rounded-xl bg-muted p-3 text-xs leading-5" key={`code-${index}`}>
          <code>{code.join("\n")}</code>
        </pre>
      );
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      const Tag = heading[1].length === 1 ? "h2" : heading[1].length === 2 ? "h3" : "h4";
      blocks.push(<Tag className="mt-4 text-base font-semibold first:mt-0" key={`h-${index}`}>{inlineMarkdown(heading[2])}</Tag>);
      index += 1;
      continue;
    }

    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\s*[-*]\s+/.test(lines[index] ?? "")) {
        items.push((lines[index] ?? "").replace(/^\s*[-*]\s+/, ""));
        index += 1;
      }
      blocks.push(
        <ul className="my-2 list-disc space-y-1 pl-5" key={`ul-${index}`}>
          {items.map((item, itemIndex) => <li key={`${item}-${itemIndex}`}>{inlineMarkdown(item)}</li>)}
        </ul>
      );
      continue;
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\s*\d+\.\s+/.test(lines[index] ?? "")) {
        items.push((lines[index] ?? "").replace(/^\s*\d+\.\s+/, ""));
        index += 1;
      }
      blocks.push(
        <ol className="my-2 list-decimal space-y-1 pl-5" key={`ol-${index}`}>
          {items.map((item, itemIndex) => <li key={`${item}-${itemIndex}`}>{inlineMarkdown(item)}</li>)}
        </ol>
      );
      continue;
    }

    if (line.startsWith(">")) {
      const quote: string[] = [];
      while (index < lines.length && lines[index]?.startsWith(">")) {
        quote.push((lines[index] ?? "").replace(/^>\s?/, ""));
        index += 1;
      }
      blocks.push(
        <blockquote className="border-l-2 pl-3 text-muted-foreground" key={`quote-${index}`}>
          {quote.map((quoteLine, quoteIndex) => <p key={`${quoteLine}-${quoteIndex}`}>{inlineMarkdown(quoteLine)}</p>)}
        </blockquote>
      );
      continue;
    }

    const paragraph: string[] = [line];
    index += 1;
    while (
      index < lines.length
      && lines[index]?.trim()
      && !/^(#{1,3})\s+/.test(lines[index] ?? "")
      && !/^\s*[-*]\s+/.test(lines[index] ?? "")
      && !/^\s*\d+\.\s+/.test(lines[index] ?? "")
      && !lines[index]?.startsWith("```")
      && !lines[index]?.startsWith(">")
    ) {
      paragraph.push(lines[index] ?? "");
      index += 1;
    }
    blocks.push(<p className="leading-7" key={`p-${index}`}>{inlineMarkdown(paragraph.join(" "))}</p>);
  }

  return <div className="grid gap-3 text-sm leading-7">{blocks}</div>;
}
