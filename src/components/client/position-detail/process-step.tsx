export function ProcessStep({
  n,
  title,
  body,
  done,
}: {
  n: number;
  title: string;
  body: string;
  done: boolean;
}) {
  return (
    <li
      className={`rounded-lg border p-3 ${
        done ? "taas-bd-success taas-bg-success-soft" : "bg-muted/30"
      }`}
    >
      <div className="flex items-center gap-2 text-xs font-medium">
        <span
          className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${
            done
              ? "taas-bg-success-solid text-success-foreground"
              : "bg-muted-foreground/20 text-muted-foreground"
          }`}
        >
          {n}
        </span>
        {title}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{body}</p>
    </li>
  );
}
