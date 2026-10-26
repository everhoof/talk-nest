import { OrderedNestDataLoader } from './dataloader';

describe('GraphQL data loaders', () => {
  it('batches IDs, preserves ordering, and reports missing records individually', async () => {
    const query = jest.fn(async () => [{ id: 2 }, { id: 1 }]);
    class RecordsLoader extends OrderedNestDataLoader<number, { id: number }> {
      protected getOptions = () => ({ query });
    }
    const loader = new RecordsLoader().generateDataLoader();
    expect(await loader.loadMany([1, 2, 3])).toEqual([{ id: 1 }, { id: 2 }, expect.any(Error)]);
    expect(query).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledWith([1, 2, 3]);
  });

  it('keeps cached records within each request', async () => {
    const query = jest.fn(async () => [{ id: 1 }]);
    class RecordsLoader extends OrderedNestDataLoader<number, { id: number }> {
      protected getOptions = () => ({ query });
    }
    const first = new RecordsLoader().generateDataLoader();
    await first.load(1);
    await first.load(1);
    expect(query).toHaveBeenCalledTimes(1);
    await new RecordsLoader().generateDataLoader().load(1);
    expect(query).toHaveBeenCalledTimes(2);
  });

  it('batches subscription loads while reading fresh records on later events', async () => {
    let name = 'Original';
    const query = jest.fn(async (keys: number[]) => keys.map((id) => ({ id, name })));
    class RecordsLoader extends OrderedNestDataLoader<number, { id: number; name: string }> {
      protected getOptions = () => ({ query });
    }
    const loader = new RecordsLoader().generateDataLoader({ cache: false });

    expect(await loader.loadMany([1, 2])).toEqual([
      { id: 1, name },
      { id: 2, name },
    ]);
    expect(query).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledWith([1, 2]);

    name = 'Updated';
    expect(await loader.load(1)).toEqual({ id: 1, name });
    expect(query).toHaveBeenCalledTimes(2);
    expect(query).toHaveBeenLastCalledWith([1]);
  });

  it('matches and caches composite punishment keys by all properties', async () => {
    type Key = { targetId: number; type: string };
    const query = jest.fn(async () => [
      { targetId: 1, type: 'ban' },
      { targetId: 1, type: 'mute' },
    ]);
    class PunishmentsLoader extends OrderedNestDataLoader<Key, Key> {
      protected getOptions = () => ({ query, propertyKey: ['targetId', 'type'] });
    }
    const loader = new PunishmentsLoader().generateDataLoader();
    expect(
      await loader.loadMany([
        { targetId: 1, type: 'mute' },
        { targetId: 1, type: 'ban' },
      ]),
    ).toEqual([
      { targetId: 1, type: 'mute' },
      { targetId: 1, type: 'ban' },
    ]);
    await loader.load({ targetId: 1, type: 'mute' });
    expect(query).toHaveBeenCalledTimes(1);
  });
});
