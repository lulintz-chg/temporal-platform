import { readFileSync } from 'fs';

export interface NamespaceConfig {
  namespace: string;
  address: string;
  tlsCertPath?: string;
  tlsKeyPath?: string;
  apiKey?: string;
}

export function loadNamespaceConfig(): NamespaceConfig {
  const namespace = requireEnv('TEMPORAL_NAMESPACE');
  const address = requireEnv('TEMPORAL_ADDRESS');

  return {
    namespace,
    address,
    tlsCertPath: emptyToUndefined(process.env.TEMPORAL_TLS_CERT_PATH),
    tlsKeyPath: emptyToUndefined(process.env.TEMPORAL_TLS_KEY_PATH),
    apiKey: emptyToUndefined(process.env.TEMPORAL_CLOUD_API_KEY),
  };
}

export function connectionOptions(config: NamespaceConfig) {
  if (config.apiKey) {
    return {
      address: config.address,
      tls: true,
      apiKey: config.apiKey,
    };
  }

  if (config.tlsCertPath && config.tlsKeyPath) {
    return {
      address: config.address,
      tls: {
        clientCertPair: {
          crt: readFileSync(config.tlsCertPath),
          key: readFileSync(config.tlsKeyPath),
        },
      },
    };
  }

  return { address: config.address };
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`missing required env var ${name} (load a docker/namespaces/*.env file first)`);
  }
  return value;
}

function emptyToUndefined(value: string | undefined): string | undefined {
  return value && value.length > 0 ? value : undefined;
}
