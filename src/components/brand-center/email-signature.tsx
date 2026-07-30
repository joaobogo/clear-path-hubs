import { useMemo, useState } from "react";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { C } from "@/lib/brand-center/palette";

/**
 * Email signature — editable, never hardcodes a real person.
 * Produces copy-ready HTML using table layout for mail-client support.
 */
export function EmailSignatureBuilder() {
  const [fields, setFields] = useState({
    name: "Your name",
    role: "Your role",
    email: "you@taasflow.com",
    phone: "",
    url: "taasflow.com",
  });
  const [copied, setCopied] = useState(false);

  const html = useMemo(
    () => `<table cellpadding="0" cellspacing="0" style="font-family:Inter,Helvetica,Arial,sans-serif;color:${C.ink};font-size:14px;line-height:1.5">
  <tr>
    <td style="padding-right:16px;border-right:2px solid ${C.ocean}">
      <img src="https://taasflow.com/og-image.png" alt="TaaSFlow" width="120" style="display:block;width:120px;height:auto" />
    </td>
    <td style="padding-left:16px">
      <div style="font-weight:600;color:${C.navy};font-size:15px">${fields.name}</div>
      <div style="color:${C.slate}">${fields.role} · TaaSFlow</div>
      <div style="margin-top:6px">
        <a href="mailto:${fields.email}" style="color:${C.oceanText};text-decoration:none">${fields.email}</a>${
          fields.phone ? ` &nbsp;·&nbsp; <span style="color:${C.slate}">${fields.phone}</span>` : ""
        }
      </div>
      <div style="margin-top:2px">
        <a href="https://${fields.url}" style="color:${C.oceanText};text-decoration:none">${fields.url}</a>
      </div>
      <div style="margin-top:6px;color:${C.slate};font-size:12px">ATS + recruiting + outreach.</div>
    </td>
  </tr>
</table>`,
    [fields],
  );

  const set = (key: keyof typeof fields) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setFields((f) => ({ ...f, [key]: e.target.value }));

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-3">
        {(
          [
            ["name", "Full name"],
            ["role", "Role"],
            ["email", "Email address"],
            ["phone", "Phone (optional)"],
            ["url", "Website"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="block text-sm font-medium text-foreground">
            {label}
            <Input className="mt-1" value={fields[key]} onChange={set(key)} />
          </label>
        ))}
        <p className="text-sm text-muted-foreground">
          Nothing here is hardcoded — the signature renders from these fields. Replace the sample values before use.
        </p>
      </div>

      <div className="space-y-3">
        <div
          className="rounded-xl border border-border bg-card p-4"
          dangerouslySetInnerHTML={{ __html: html }}
        />
        <Button
          className="min-h-11 print:hidden"
          onClick={async () => {
            await navigator.clipboard.writeText(html);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
        >
          {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
          Copy email signature HTML
        </Button>
        <pre className="max-h-56 overflow-auto rounded-lg border border-border bg-muted/40 p-3 text-xs">
          {html}
        </pre>
      </div>
    </div>
  );
}
