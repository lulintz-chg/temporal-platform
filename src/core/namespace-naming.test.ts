import { assertNamespaceName } from './namespace-naming';

describe('assertNamespaceName', () => {
  it.each([
    'workflow-orchestration-platform-temporal-platform-dev',
    'workflow-orchestration-platform-temporal-platform-prod',
  ])('accepts %s', (namespace) => {
    expect(() => assertNamespaceName(namespace)).not.toThrow();
  });

  it.each([
    'dev',
    'prod',
    'default',
    'my-ns',
    'workflow-orchestration-platform-temporal-platform-staging',
  ])('rejects %s', (namespace) => {
    expect(() => assertNamespaceName(namespace)).toThrow('invalid namespace');
  });
});
