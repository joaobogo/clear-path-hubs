/**
 * The product tracks candidate progress, but it does not schedule interviews
 * or issue employment offers. The function deliberately returns a boolean
 * rather than a literal type so legacy server functions can be rejected
 * before writes without invalidating their existing TypeScript flow checks.
 */
export function offSystemWorkflowRequired(): boolean {
  return true;
}
