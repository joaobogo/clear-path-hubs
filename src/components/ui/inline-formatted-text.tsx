import * as React from "react";
import { parseInlineMarkup } from "@/lib/marketing/inline-format";

/**
 * Renders the three permitted inline styles (bold, italic, underline) from a
 * stored string. Nothing is injected as HTML — the string is parsed into runs
 * and each run becomes a real element.
 */
export function InlineFormattedText({ value }: { value: string }) {
  const segments = React.useMemo(() => parseInlineMarkup(value ?? ""), [value]);

  return (
    <>
      {segments.map((s, i) => {
        let node: React.ReactNode = s.text;
        if (s.underline) node = <u key="u">{node}</u>;
        if (s.italic) node = <em key="em">{node}</em>;
        if (s.bold) node = <strong key="strong">{node}</strong>;
        return <React.Fragment key={i}>{node}</React.Fragment>;
      })}
    </>
  );
}
