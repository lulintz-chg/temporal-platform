import { Connection } from '@temporalio/client';
import { loadClientConnectConfig } from '@temporalio/envconfig';
import { createTemporalClientConnection } from './connection-client';

jest.mock('@temporalio/client', () => ({
  Connection: { connect: jest.fn() },
}));
jest.mock('@temporalio/envconfig', () => ({
  loadClientConnectConfig: jest.fn(),
}));

describe('createTemporalClientConnection', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('connects with connectionOptions from envconfig and passes through the namespace', async () => {
    const connectionOptions = { address: 'localhost:7233' };
    const fakeConnection = { close: jest.fn() };
    (loadClientConnectConfig as jest.Mock).mockReturnValue({
      connectionOptions,
      namespace: 'workflow-orchestration-platform-temporal-platform-prod',
    });
    (Connection.connect as jest.Mock).mockResolvedValue(fakeConnection);

    const result = await createTemporalClientConnection();

    expect(Connection.connect).toHaveBeenCalledWith(connectionOptions);
    expect(result).toEqual({
      connection: fakeConnection,
      namespace: 'workflow-orchestration-platform-temporal-platform-prod',
    });
  });

  it('rejects a namespace that does not follow team-service-environment naming', async () => {
    (loadClientConnectConfig as jest.Mock).mockReturnValue({
      connectionOptions: {},
      namespace: 'my-ns',
    });

    await expect(createTemporalClientConnection()).rejects.toThrow('invalid namespace');
    expect(Connection.connect).not.toHaveBeenCalled();
  });

  it('rejects when envconfig returns no namespace (defaults to "default")', async () => {
    (loadClientConnectConfig as jest.Mock).mockReturnValue({
      connectionOptions: {},
      namespace: undefined,
    });

    await expect(createTemporalClientConnection()).rejects.toThrow('invalid namespace');
  });
});
