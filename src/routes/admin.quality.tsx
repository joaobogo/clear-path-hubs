import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/admin/quality')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/admin/quality"!</div>
}
