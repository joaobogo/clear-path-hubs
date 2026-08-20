/**
 * Small, honest scope label for admin overview blocks.
 *
 * Some overview blocks are account-level or outcome-level and have no single
 * staff owner to filter on (portfolio health, offers and hires, activity).
 * When the operator selected the "Mine" scope we must not let those blocks
 * read as theirs, so they carry this label instead.
 */
export function TeamScopeNote({ className }: { className?: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[11px] font-medium text-muted-foreground ${className ?? ""}`}
    >
      Across the whole team
    </span>
  );
}
