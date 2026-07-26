import { Component, type ErrorInfo, type ReactNode } from "react";
import { normalizeError, logTechnical, type AudienceTone } from "@/lib/error-taxonomy";
import { ErrorState } from "./error-state";

interface Props {
  children: ReactNode;
  /** Named for private logs, e.g. "admin.pipeline-chart". */
  boundary: string;
  tone?: AudienceTone;
  /** Optional custom fallback; receives a retry callback. */
  fallback?: (retry: () => void) => ReactNode;
}

interface State {
  error: Error | null;
  correlationId: string | null;
}

/**
 * Isolates a single component subtree so one failing widget cannot blank the
 * whole page. Renders human copy from the error taxonomy and keeps technical
 * detail in private logs only.
 */
export class ComponentErrorBoundary extends Component<Props, State> {
  state: State = { error: null, correlationId: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const normalized = normalizeError(error, { tone: this.props.tone });
    this.setState({ correlationId: normalized.correlationId });
    logTechnical(error, normalized, {
      boundary: this.props.boundary,
      componentStack: info.componentStack,
    });
  }

  private retry = () => this.setState({ error: null, correlationId: null });

  render() {
    if (!this.state.error) return this.props.children;
    if (this.props.fallback) return this.props.fallback(this.retry);

    const normalized = normalizeError(this.state.error, { tone: this.props.tone });
    return (
      <ErrorState
        title={normalized.title}
        description={normalized.description}
        traceId={this.state.correlationId ?? normalized.correlationId}
        onRetry={this.retry}
      />
    );
  }
}
