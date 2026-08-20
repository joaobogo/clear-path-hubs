/**
 * Subtle marker shown when a screen refreshed itself because something changed
 * elsewhere. It states that the view moved, so a client never wonders whether
 * the rows they are looking at are the rows they read a moment ago.
 */
import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { formatRelative } from "@/lib/format/datetime";

export function LiveUpdatedChip({
	updatedAt,
	className = "",
}: {
	updatedAt: number | null;
	className?: string;
}) {
	const [now, setNow] = useState(() => Date.now());
	useEffect(() => {
		if (!updatedAt) return;
		const t = window.setInterval(() => setNow(Date.now()), 10_000);
		return () => window.clearInterval(t);
	}, [updatedAt]);

	if (!updatedAt) return null;
	return (
		<span
			role="status"
			className={`inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-2.5 py-1 text-xs text-muted-foreground ${className}`}
		>
			<RefreshCw className="h-3 w-3" aria-hidden />
			Updated {formatRelative(updatedAt)}
		</span>
	);
}
