/**
 * Layout-mirroring pending states for the client workspace.
 *
 * Every skeleton here matches the real page it stands in for — same page
 * width, same header block, same card grid, same column widths — so nothing
 * shifts when the data lands. Routes wire these up as `pendingComponent`
 * with a small `pendingMs`, so a fast navigation never flashes a skeleton
 * at all and a slow one never shows a bare empty layout.
 */
import { Skeleton } from "@/components/ui/skeleton";

type Shape = "kpis" | "rows" | "board" | "cards" | "detail";

function HeaderBlock() {
	return (
		<header className="space-y-2">
			<Skeleton className="h-8 w-64" />
			<Skeleton className="h-4 w-96 max-w-full" />
		</header>
	);
}

function KpiGrid() {
	return (
		<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
			{Array.from({ length: 4 }).map((_, i) => (
				<div key={i} className="rounded-xl border bg-card p-4 space-y-3">
					<Skeleton className="h-3 w-24" />
					<Skeleton className="h-7 w-16" />
					<Skeleton className="h-3 w-32" />
				</div>
			))}
		</div>
	);
}

function Rows({ rows = 5 }: { rows?: number }) {
	return (
		<div className="rounded-xl border bg-card divide-y">
			{Array.from({ length: rows }).map((_, i) => (
				<div key={i} className="flex items-center justify-between gap-4 p-4">
					<div className="space-y-2">
						<Skeleton className="h-4 w-48" />
						<Skeleton className="h-3 w-32" />
					</div>
					<Skeleton className="h-8 w-20" />
				</div>
			))}
		</div>
	);
}

function Cards() {
	return (
		<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{Array.from({ length: 3 }).map((_, i) => (
				<div key={i} className="rounded-xl border bg-card p-4 space-y-3">
					<Skeleton className="h-4 w-40" />
					<Skeleton className="h-3 w-full" />
					<Skeleton className="h-3 w-2/3" />
					<Skeleton className="h-9 w-28" />
				</div>
			))}
		</div>
	);
}

function Board() {
	return (
		<div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
			{Array.from({ length: 5 }).map((_, col) => (
				<div key={col} className="rounded-xl border bg-muted/30 p-3 space-y-3">
					<Skeleton className="h-3 w-24" />
					{Array.from({ length: 2 }).map((_, card) => (
						<div key={card} className="rounded-lg border bg-card p-3 space-y-2">
							<Skeleton className="h-4 w-28" />
							<Skeleton className="h-3 w-20" />
						</div>
					))}
				</div>
			))}
		</div>
	);
}

function DetailBody() {
	return (
		<div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
			<div className="space-y-4">
				<div className="rounded-xl border bg-card p-4 space-y-3">
					<Skeleton className="h-4 w-40" />
					<Skeleton className="h-3 w-full" />
					<Skeleton className="h-3 w-4/5" />
				</div>
				<Rows rows={3} />
			</div>
			<div className="space-y-4">
				<div className="rounded-xl border bg-card p-4 space-y-3">
					<Skeleton className="h-3 w-24" />
					<Skeleton className="h-6 w-20" />
					<Skeleton className="h-3 w-28" />
				</div>
				<div className="rounded-xl border bg-card p-4 space-y-3">
					<Skeleton className="h-3 w-28" />
					<Skeleton className="h-3 w-full" />
					<Skeleton className="h-3 w-2/3" />
				</div>
			</div>
		</div>
	);
}

/**
 * Build a route-level pending component that mirrors one page shape.
 * `width` matches the page container so the header never jumps sideways.
 */
export function makeWorkspacePending(opts: {
	shape: Shape;
	kpis?: boolean;
	rows?: number;
	width?: "5xl" | "6xl" | "7xl";
}) {
	const max =
		opts.width === "5xl" ? "max-w-5xl" : opts.width === "6xl" ? "max-w-6xl" : "max-w-7xl";
	return function WorkspacePending() {
		return (
			<div className={`mx-auto ${max} px-4 sm:px-6 py-6 sm:py-8 space-y-6`}>
				<HeaderBlock />
				{opts.kpis ? <KpiGrid /> : null}
				{opts.shape === "kpis" ? <Rows rows={opts.rows ?? 4} /> : null}
				{opts.shape === "rows" ? <Rows rows={opts.rows ?? 5} /> : null}
				{opts.shape === "cards" ? <Cards /> : null}
				{opts.shape === "board" ? <Board /> : null}
				{opts.shape === "detail" ? <DetailBody /> : null}
			</div>
		);
	};
}

/** Inline body-only skeletons for in-component loading branches. */
export const WorkspaceRowsSkeleton = Rows;
export const WorkspaceCardsSkeleton = Cards;
export const WorkspaceKpiSkeleton = KpiGrid;
