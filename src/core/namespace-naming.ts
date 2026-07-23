// Enforces the platform's team-service-environment naming convention for
// Temporal namespaces — see README's Namespaces section. Catches a
// misconfigured TEMPORAL_NAMESPACE (typo, wrong env file) at connection time
// instead of silently connecting to an unexpected namespace.
const NAMESPACE_PATTERN = /^workflow-orchestration-platform-temporal-platform-(dev|prod)$/;

export function assertNamespaceName(namespace: string): void {
  if (!NAMESPACE_PATTERN.test(namespace)) {
    throw new Error(
      `invalid namespace '${namespace}': expected team-service-environment naming ` +
        `(workflow-orchestration-platform-temporal-platform-dev|prod)`
    );
  }
}
