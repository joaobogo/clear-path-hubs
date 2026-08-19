import { Link } from "@tanstack/react-router";
import { MoveLeft, Search } from "lucide-react";
import { Button } from "@/components/ui/button";

export function NotFound({ requested }: { requested?: string }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        <Search className="h-8 w-8 text-muted-foreground" />
      </div>
      <h1 className="mt-6 text-2xl font-bold tracking-tight">Page not found</h1>
      <p className="mt-2 max-w-sm text-muted-foreground">
        We couldn't find the page you're looking for.
        {requested && !requested.includes("/") && (
          <span className="text-xs text-muted-foreground opacity-50">
            {" "}
            (requested: {requested})
          </span>
        )}
      </p>
      <div className="mt-8">
        <Button asChild>
          <Link to="/">
            <MoveLeft className="mr-2 h-4 w-4" />
            Back to dashboard
          </Link>
        </Button>
      </div>
    </div>
  );
}
