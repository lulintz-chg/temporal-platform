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
      namespace: 'my-ns',
    });
    (Connection.connect as jest.Mock).mockResolvedValue(fakeConnection);

    const result = await createTemporalClientConnection();

    expect(Connection.connect).toHaveBeenCalledWith(connectionOptions);
    expect(result).toEqual({ connection: fakeConnection, namespace: 'my-ns' });
  });

  it('defaults namespace to "default" when envconfig returns none', async () => {
    const fakeConnection = { close: jest.fn() };
    (loadClientConnectConfig as jest.Mock).mockReturnValue({
      connectionOptions: {},
      namespace: undefined,
    });
    (Connection.connect as jest.Mock).mockResolvedValue(fakeConnection);

    const result = await createTemporalClientConnection();

    expect(result.namespace).toBe('default');
  });
});
