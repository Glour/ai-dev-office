"use client";

import * as React from "react";
import { CheckIcon, ChevronDownIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Option = {
  value: string;
  label: string;
};

function optionsFromChildren(children: React.ReactNode) {
  return React.Children.toArray(children).flatMap<Option>((child) => {
    if (!React.isValidElement<React.OptionHTMLAttributes<HTMLOptionElement>>(child)) return [];
    const value = String(child.props.value ?? "");
    const label = typeof child.props.children === "string" ? child.props.children : value;
    return [{ value, label }];
  });
}

function SelectField({
  "aria-label": ariaLabel,
  children,
  className,
  defaultValue,
  name,
  ...props
}: React.ComponentProps<"select">) {
  const options = optionsFromChildren(children);
  const initialValue = String(defaultValue ?? options[0]?.value ?? "");
  const [value, setValue] = React.useState(initialValue);
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLSpanElement>(null);
  const activeOption = options.find((option) => option.value === value) ?? options[0];

  React.useEffect(() => {
    function close(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    }
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, []);

  return (
    <span className="relative block w-full" ref={rootRef}>
      <input name={name} type="hidden" value={value} />
      <button
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        className={cn(
          "flex h-9 w-full min-w-0 items-center justify-between gap-2 rounded-lg border border-input bg-background px-3 py-1 text-left text-sm transition-colors outline-none",
          "hover:bg-muted/40 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:bg-input/50 disabled:opacity-50",
          className
        )}
        disabled={props.disabled}
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <span className="truncate">{activeOption?.label ?? "Выбрать"}</span>
        <ChevronDownIcon className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open ? "rotate-180" : "")} />
      </button>
      {open ? (
        <span
          className="absolute left-0 top-[calc(100%+6px)] z-50 grid max-h-64 w-full min-w-48 overflow-auto rounded-xl border bg-popover p-1 text-sm text-popover-foreground shadow-xl"
          role="listbox"
        >
          {options.map((option) => (
            <button
              className={cn(
                "flex min-h-9 items-center gap-2 rounded-lg px-2.5 text-left transition hover:bg-muted",
                option.value === value ? "bg-muted font-medium" : ""
              )}
              aria-selected={option.value === value}
              key={option.value}
              onClick={() => {
                setValue(option.value);
                setOpen(false);
              }}
              role="option"
              type="button"
            >
              <CheckIcon className={cn("size-4 shrink-0", option.value === value ? "opacity-100" : "opacity-0")} />
              <span className="truncate">{option.label}</span>
            </button>
          ))}
        </span>
      ) : null}
    </span>
  );
}

export { SelectField };
