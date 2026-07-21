import { NativeConnection, Worker } from '@temporalio/worker';
import { loadClientConnectConfig } from '@temporalio/envconfig';
import { createTemporalNativeConnection, makeActivities, startWorker } from './connection-worker';

jest.mock('@temporalio/worker', () => ({
  NativeConnection: { connect: jest.fn() },
  Worker: { create: jest.fn() },
  bundleWorkflowCode: jest.fn(),
}));
jest.mock('@temporalio/envconfig', () => ({
  loadClientConnectConfig: jest.fn(),
}));

describe('makeActivities', () => {
  it('wraps each Effect-returning function to run on the given runtime', async () => {
    const runPromise = jest
      .fn()
      .mockImplementation((effect: unknown) => Promise.resolve(`ran:${String(effect)}`));
    const runtime = { runPromise } as never;

    const greet = jest.fn().mockImplementation((name: string) => `effect(${name})`);
    const activities = makeActivities(runtime, { greet } as never);

    const result = await (
      activities as Record<string, (...args: unknown[]) => Promise<unknown>>
    ).greet('World');

    expect(greet).toHaveBeenCalledWith('World');
    expect(runPromise).toHaveBeenCalledWith('effect(World)');
    expect(result).toBe('ran:effect(World)');
  });

  it('passes through args and results for multiple activities independently', async () => {
    const runPromise = jest.fn().mockResolvedValue('ok');
    const runtime = { runPromise } as never;

    const a = jest.fn().mockReturnValue('effect-a');
    const b = jest.fn().mockReturnValue('effect-b');
    const activities = makeActivities(runtime, { a, b } as never) as Record<
      string,
      (...args: unknown[]) => Promise<unknown>
    >;

    await activities.a(1, 2);
    await activities.b('x');

    expect(a).toHaveBeenCalledWith(1, 2);
    expect(b).toHaveBeenCalledWith('x');
    expect(runPromise).toHaveBeenCalledTimes(2);
  });
});

describe('createTemporalNativeConnection', () => {
  afterEach(() => jest.clearAllMocks());

  it('connects with connectionOptions and passes through namespace', async () => {
    const connectionOptions = { address: 'localhost:7233' };
    const fakeConnection = { close: jest.fn() };
    (loadClientConnectConfig as jest.Mock).mockReturnValue({
      connectionOptions,
      namespace: 'my-ns',
    });
    (NativeConnection.connect as jest.Mock).mockResolvedValue(fakeConnection);

    const result = await createTemporalNativeConnection();

    expect(NativeConnection.connect).toHaveBeenCalledWith(connectionOptions);
    expect(result).toEqual({ connection: fakeConnection, namespace: 'my-ns' });
  });

  it('defaults namespace to "default" when envconfig returns none', async () => {
    (loadClientConnectConfig as jest.Mock).mockReturnValue({
      connectionOptions: {},
      namespace: undefined,
    });
    (NativeConnection.connect as jest.Mock).mockResolvedValue({ close: jest.fn() });

    const result = await createTemporalNativeConnection();

    expect(result.namespace).toBe('default');
  });
});

describe('startWorker', () => {
  let connection: { close: jest.Mock };
  let worker: { run: jest.Mock; shutdown: jest.Mock };
  let processOnceSpy: jest.SpyInstance;
  let processOffSpy: jest.SpyInstance;

  beforeEach(() => {
    connection = { close: jest.fn().mockResolvedValue(undefined) };
    worker = { run: jest.fn().mockResolvedValue(undefined), shutdown: jest.fn() };
    (loadClientConnectConfig as jest.Mock).mockReturnValue({
      connectionOptions: {},
      namespace: 'configured-ns',
    });
    (NativeConnection.connect as jest.Mock).mockResolvedValue(connection);
    (Worker.create as jest.Mock).mockResolvedValue(worker);
    processOnceSpy = jest.spyOn(process, 'once');
    processOffSpy = jest.spyOn(process, 'off');
  });

  afterEach(() => {
    jest.clearAllMocks();
    processOnceSpy.mockRestore();
    processOffSpy.mockRestore();
  });

  it('uses workflowsPath, defaults namespace, registers shutdown handlers, and closes the connection', async () => {
    await startWorker({ taskQueue: 'tq', workflowsPath: '/wf.js', activities: {} });

    expect(Worker.create).toHaveBeenCalledWith(
      expect.objectContaining({
        connection,
        namespace: 'configured-ns',
        taskQueue: 'tq',
        activities: {},
        workflowsPath: '/wf.js',
      })
    );
    expect(worker.run).toHaveBeenCalled();
    expect(processOnceSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function));
    expect(processOnceSpy).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
    expect(processOffSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function));
    expect(processOffSpy).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
    expect(connection.close).toHaveBeenCalled();
  });

  it('uses workflowBundle instead of workflowsPath when provided', async () => {
    const workflowBundle = { codePath: '/bundle.js' } as never;

    await startWorker({ taskQueue: 'tq', workflowBundle, activities: {} });

    const createArgs = (Worker.create as jest.Mock).mock.calls[0][0];
    expect(createArgs.workflowBundle).toBe(workflowBundle);
    expect(createArgs.workflowsPath).toBeUndefined();
  });

  it('an explicit namespace overrides the configured one', async () => {
    await startWorker({
      taskQueue: 'tq',
      workflowsPath: '/wf.js',
      activities: {},
      namespace: 'explicit-ns',
    });

    expect(Worker.create).toHaveBeenCalledWith(
      expect.objectContaining({ namespace: 'explicit-ns' })
    );
  });

  it('closes the connection even if worker.run() rejects', async () => {
    worker.run.mockRejectedValue(new Error('worker crashed'));

    await expect(
      startWorker({ taskQueue: 'tq', workflowsPath: '/wf.js', activities: {} })
    ).rejects.toThrow('worker crashed');
    expect(connection.close).toHaveBeenCalled();
  });
});
