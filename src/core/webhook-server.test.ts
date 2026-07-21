import request from 'supertest';
import type { createWebhookApp as createWebhookAppType } from './webhook-server';

function makeGrpcServiceError(code: number, message = 'error'): Error {
  const err = new Error(message) as Error & {
    code: number;
    details: string;
    metadata: Record<string, unknown>;
  };
  err.code = code;
  err.details = message;
  err.metadata = {};
  return err;
}

function loadApp(secret?: string): typeof createWebhookAppType {
  jest.resetModules();
  if (secret === undefined) {
    delete process.env.WEBHOOK_SECRET;
  } else {
    process.env.WEBHOOK_SECRET = secret;
  }
  // Re-require (not a static import) so the module re-evaluates its top-level
  // WEBHOOK_SECRET constant against the env var just set above.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require('./webhook-server') as { createWebhookApp: typeof createWebhookAppType };
  return mod.createWebhookApp;
}

describe('createWebhookApp POST /callback', () => {
  const originalSecret = process.env.WEBHOOK_SECRET;

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.WEBHOOK_SECRET;
    } else {
      process.env.WEBHOOK_SECRET = originalSecret;
    }
    jest.resetModules();
  });

  describe('without WEBHOOK_SECRET set', () => {
    it('returns 400 when workflowId is missing', async () => {
      const createWebhookApp = loadApp(undefined);
      const signal = jest.fn();
      const app = createWebhookApp({ workflow: { getHandle: () => ({ signal }) } } as never);

      const res = await request(app).post('/callback').send({ foo: 'bar' });

      expect(res.status).toBe(400);
      expect(signal).not.toHaveBeenCalled();
    });

    it('returns 400 when workflowId is malformed', async () => {
      const createWebhookApp = loadApp(undefined);
      const app = createWebhookApp({ workflow: { getHandle: jest.fn() } } as never);

      const res = await request(app)
        .post('/callback?workflowId=' + encodeURIComponent('bad id!'))
        .send({});

      expect(res.status).toBe(400);
    });

    it('returns 200 and signals the workflow on a valid request', async () => {
      const createWebhookApp = loadApp(undefined);
      const signal = jest.fn().mockResolvedValue(undefined);
      const getHandle = jest.fn().mockReturnValue({ signal });
      const app = createWebhookApp({ workflow: { getHandle } } as never);

      const res = await request(app).post('/callback?workflowId=wf-123').send({ status: 'done' });

      expect(res.status).toBe(200);
      expect(getHandle).toHaveBeenCalledWith('wf-123');
      expect(signal).toHaveBeenCalledWith(expect.anything(), { status: 'done' });
    });

    it('returns 200 (not 502) when signaling a not-found workflow', async () => {
      const createWebhookApp = loadApp(undefined);
      const signal = jest.fn().mockRejectedValue(makeGrpcServiceError(5, 'not found'));
      const app = createWebhookApp({ workflow: { getHandle: () => ({ signal }) } } as never);

      const res = await request(app).post('/callback?workflowId=wf-123').send({});

      expect(res.status).toBe(200);
    });

    it('returns 502 on other signal errors', async () => {
      const createWebhookApp = loadApp(undefined);
      const signal = jest.fn().mockRejectedValue(new Error('boom'));
      const app = createWebhookApp({ workflow: { getHandle: () => ({ signal }) } } as never);

      const res = await request(app).post('/callback?workflowId=wf-123').send({});

      expect(res.status).toBe(502);
    });
  });

  describe('with WEBHOOK_SECRET set', () => {
    it('returns 401 when the Authorization header is missing', async () => {
      const createWebhookApp = loadApp('s3cret');
      const app = createWebhookApp({ workflow: { getHandle: jest.fn() } } as never);

      const res = await request(app).post('/callback?workflowId=wf-123').send({});

      expect(res.status).toBe(401);
    });

    it('returns 401 when the Authorization header is wrong', async () => {
      const createWebhookApp = loadApp('s3cret');
      const app = createWebhookApp({ workflow: { getHandle: jest.fn() } } as never);

      const res = await request(app)
        .post('/callback?workflowId=wf-123')
        .set('Authorization', 'Bearer wrong')
        .send({});

      expect(res.status).toBe(401);
    });

    it('returns 200 and signals when the Authorization header matches', async () => {
      const createWebhookApp = loadApp('s3cret');
      const signal = jest.fn().mockResolvedValue(undefined);
      const app = createWebhookApp({ workflow: { getHandle: () => ({ signal }) } } as never);

      const res = await request(app)
        .post('/callback?workflowId=wf-123')
        .set('Authorization', 'Bearer s3cret')
        .send({});

      expect(res.status).toBe(200);
      expect(signal).toHaveBeenCalled();
    });
  });
});
