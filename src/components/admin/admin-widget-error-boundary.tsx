import { Component, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface Props {
  label: string;
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Per-widget error boundary for the admin overview.
 *
 * A failing server read or render inside one widget must never take down the
 * whole /admin page. Instead, the widget renders an inline retry card and the
 * rest of the desk keeps working.
 */
export class AdminWidgetErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  retry = () => {
    this.setState({ error: null });
    // In a real app, this might trigger a QueryClient invalidation
  };


  render() {
    if (this.state.error) {
      return (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 text-destructive" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-destructive">{this.props.label} could not load</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {this.state.error.message || "Something went wrong while loading this panel."}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3 h-7 text-xs"
                onClick={this.retry}
              >
                Retry
              </Button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
