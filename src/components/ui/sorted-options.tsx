"use client";

import * as React from "react";
import { useLanguage } from "@/store/useLanguage";

function optionText(node: React.ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(optionText).join("");
  if (!React.isValidElement(node)) return "";
  if (node.props["aria-hidden"] || node.type === "svg") return "";
  const sortKey = node.props["data-sort"] ?? node.props.textValue;
  return sortKey === undefined ? optionText(node.props.children) : String(sortKey);
}

function flatten(children: React.ReactNode): React.ReactNode[] {
  return React.Children.toArray(children).flatMap((child) =>
    React.isValidElement(child) && child.type === React.Fragment
      ? flatten(child.props.children).map((nested, index) =>
          React.isValidElement(nested)
            ? React.cloneElement(nested, { key: `${child.key}/${nested.key ?? index}` })
            : nested
        )
      : [child]
  );
}

/** Sort selectable rows by their visible labels, retaining non-option rows. */
export function sortOptions(children: React.ReactNode, lang: string): React.ReactNode[] {
  const nodes = flatten(children);
  const isOption = (node: React.ReactNode) => {
    if (!React.isValidElement(node)) return false;
    if (node.type === "option" || node.type === "button") return true;
    const name = typeof node.type === "string" ? node.type :
      (node.type as { displayName?: string }).displayName ?? "";
    return /^(SelectItem|DropdownMenu(Item|CheckboxItem|RadioItem|SubTrigger))$/.test(name);
  };
  const collator = new Intl.Collator(lang, { sensitivity: "base", numeric: true });
  const options = nodes.filter(isOption).sort((a, b) =>
    collator.compare(optionText(a).trim(), optionText(b).trim())
  );
  let index = 0;
  return nodes.map((node) => isOption(node) ? options[index++] : node);
}

export function SortedOptions({ children }: { children: React.ReactNode }) {
  const lang = useLanguage((state) => state.lang);
  return <>{sortOptions(children, lang)}</>;
}

export const NativeSelect = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ children, ...props }, ref) => {
  const lang = useLanguage((state) => state.lang);
  return <select ref={ref} {...props}>{sortOptions(children, lang)}</select>;
});
NativeSelect.displayName = "NativeSelect";
