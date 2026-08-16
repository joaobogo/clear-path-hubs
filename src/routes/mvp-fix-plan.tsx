import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/mvp-fix-plan')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/mvp-fix-plan"!</div>
}
