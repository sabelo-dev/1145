import React, { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Shows a merchant's policy text with the formatting they typed: blank lines
 * start paragraphs, "1. Title" lines are section headings, "- " lines are
 * bullets and **text** is bold. Built from React elements only (merchant text
 * is never inserted as HTML).
 */

type Block =
  | { kind: "heading"; text: string }
  | { kind: "list"; items: string[] }
  | { kind: "paragraph"; lines: string[] };

const BULLET = /^\s*[-*•]\s+/;
// "1. Shipping Coverage" or "1) Returns": a short numbered line on its own.
const NUMBERED_HEADING = /^\s*\d{1,2}[.)]\s+\S.{0,70}$/;

function parse(text: string): Block[] {
  const blocks: Block[] = [];
  for (const chunk of text.replace(/\r\n?/g, "\n").split(/\n\s*\n/)) {
    const lines = chunk.split("\n").map((l) => l.trim()).filter(Boolean);
    let paragraph: string[] = [];
    let list: string[] = [];
    const flushParagraph = () => {
      if (paragraph.length) blocks.push({ kind: "paragraph", lines: paragraph });
      paragraph = [];
    };
    const flushList = () => {
      if (list.length) blocks.push({ kind: "list", items: list });
      list = [];
    };

    for (const line of lines) {
      if (BULLET.test(line)) {
        flushParagraph();
        list.push(line.replace(BULLET, ""));
      } else if (lines.length === 1 && NUMBERED_HEADING.test(line) && !/[.!?:]$/.test(line)) {
        flushList();
        blocks.push({ kind: "heading", text: line });
      } else {
        flushList();
        paragraph.push(line);
      }
    }
    flushList();
    flushParagraph();
  }
  return blocks;
}

/** **bold** spans; everything else is plain text. */
function inline(text: string): React.ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((part, i) =>
    part.startsWith("**") && part.endsWith("**")
      ? <strong key={i} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>
      : <React.Fragment key={i}>{part}</React.Fragment>);
}

export const FormattedPolicy: React.FC<{ text: string; className?: string }> = ({ text, className }) => (
  <div className={cn("space-y-3 text-sm leading-relaxed text-muted-foreground", className)}>
    {parse(text).map((block, i) => {
      if (block.kind === "heading") {
        return <h5 key={i} className="pt-2 font-semibold text-foreground">{inline(block.text)}</h5>;
      }
      if (block.kind === "list") {
        return (
          <ul key={i} className="list-disc space-y-1 pl-5">
            {block.items.map((item, j) => <li key={j}>{inline(item)}</li>)}
          </ul>
        );
      }
      return (
        <p key={i}>
          {block.lines.map((line, j) => (
            <React.Fragment key={j}>
              {j > 0 && <br />}
              {inline(line)}
            </React.Fragment>
          ))}
        </p>
      );
    })}
  </div>
);

/** A policy that starts as a short preview and expands in place. */
const PolicyText: React.FC<{ text: string; title: string; previewHeight?: number }> = ({ text, title, previewHeight = 260 }) => {
  const [open, setOpen] = useState(false);
  const long = text.length > 600;
  return (
    <div>
      <div
        className={cn("relative", long && !open && "overflow-hidden")}
        style={long && !open ? { maxHeight: previewHeight } : undefined}
      >
        <FormattedPolicy text={text} />
        {long && !open && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-card to-transparent" />
        )}
      </div>
      {long && (
        <Button
          variant="link"
          size="sm"
          className="mt-2 h-auto gap-1 px-0"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label={open ? `Show less of the ${title}` : `Read the full ${title}`}
        >
          {open ? <>Show less <ChevronUp className="h-4 w-4" /></> : <>Read full policy <ChevronDown className="h-4 w-4" /></>}
        </Button>
      )}
    </div>
  );
};

export default PolicyText;
