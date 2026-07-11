import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { DiffableChangeSnapshot } from './change-detector';
import { ChangesService } from './changes.service';

function makeSnapshot(
  overrides: Partial<DiffableChangeSnapshot> = {},
): DiffableChangeSnapshot {
  return {
    title: 'My App',
    subtitle: 'A subtitle',
    summary: 'A summary',
    description: 'A description',
    version: '1.0.0',
    price: 0,
    screenshotsCount: 5,
    iconUrl: 'https://cdn/icon-1.png',
    ...overrides,
  };
}

describe('ChangesService', () => {
  let service: ChangesService;
  const createMany = jest.fn();

  beforeEach(async () => {
    createMany.mockReset();
    const moduleRef = await Test.createTestingModule({
      providers: [
        ChangesService,
        { provide: PrismaService, useValue: { changeEvent: { createMany } } },
      ],
    }).compile();
    service = moduleRef.get(ChangesService);
  });

  it('persists a row per detected change and returns them', async () => {
    const prev = makeSnapshot({ title: 'Old' });
    const next = makeSnapshot({ title: 'New', version: '1.1.0' });

    const changes = await service.recordRefresh('app_1', prev, next);

    expect(changes).toEqual([
      { field: 'title', before: 'Old', after: 'New' },
      { field: 'version', before: '1.0.0', after: '1.1.0' },
    ]);
    expect(createMany).toHaveBeenCalledWith({
      data: [
        { appId: 'app_1', field: 'title', before: 'Old', after: 'New' },
        { appId: 'app_1', field: 'version', before: '1.0.0', after: '1.1.0' },
      ],
    });
  });

  it('writes nothing when there are no changes', async () => {
    const changes = await service.recordRefresh(
      'app_1',
      makeSnapshot(),
      makeSnapshot(),
    );

    expect(changes).toEqual([]);
    expect(createMany).not.toHaveBeenCalled();
  });

  it('writes nothing for the first snapshot', async () => {
    const changes = await service.recordRefresh('app_1', null, makeSnapshot());

    expect(changes).toEqual([]);
    expect(createMany).not.toHaveBeenCalled();
  });
});
