import proto from '@temporalio/proto';
import { registerSearchAttributes, type SearchAttributeMap } from './search-attributes';

const IVT = proto.temporal.api.enums.v1.IndexedValueType;

describe('registerSearchAttributes', () => {
  it('maps each IndexedValueTypeName to the correct proto enum value', async () => {
    const addSearchAttributes = jest.fn().mockResolvedValue(undefined);
    const attributes: SearchAttributeMap = {
      LeadId: 'Keyword',
      Count: 'Int',
      StartedAt: 'Datetime',
      IsActive: 'Bool',
      Score: 'Double',
      Notes: 'Text',
    };

    await registerSearchAttributes({ addSearchAttributes }, attributes, 'my-namespace');

    expect(addSearchAttributes).toHaveBeenCalledWith({
      namespace: 'my-namespace',
      searchAttributes: {
        LeadId: IVT.INDEXED_VALUE_TYPE_KEYWORD,
        Count: IVT.INDEXED_VALUE_TYPE_INT,
        StartedAt: IVT.INDEXED_VALUE_TYPE_DATETIME,
        IsActive: IVT.INDEXED_VALUE_TYPE_BOOL,
        Score: IVT.INDEXED_VALUE_TYPE_DOUBLE,
        Notes: IVT.INDEXED_VALUE_TYPE_TEXT,
      },
    });
  });

  it('swallows ALREADY_EXISTS (gRPC code 6)', async () => {
    const addSearchAttributes = jest.fn().mockRejectedValue({ code: 6 });

    await expect(
      registerSearchAttributes({ addSearchAttributes }, { LeadId: 'Keyword' }, 'my-namespace')
    ).resolves.toBeUndefined();
  });

  it('rethrows any other error', async () => {
    const err = { code: 5, message: 'not found' };
    const addSearchAttributes = jest.fn().mockRejectedValue(err);

    await expect(
      registerSearchAttributes({ addSearchAttributes }, { LeadId: 'Keyword' }, 'my-namespace')
    ).rejects.toBe(err);
  });

  it('rethrows errors without a code property', async () => {
    const err = new Error('boom');
    const addSearchAttributes = jest.fn().mockRejectedValue(err);

    await expect(
      registerSearchAttributes({ addSearchAttributes }, { LeadId: 'Keyword' }, 'my-namespace')
    ).rejects.toBe(err);
  });
});
