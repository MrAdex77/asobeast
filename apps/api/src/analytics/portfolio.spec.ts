import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { AnalyticsService } from './analytics.service';

describe('AnalyticsService.portfolio', () => {
  let service: AnalyticsService;
  const appFindMany = jest.fn();
  const rankingFindFirst = jest.fn();
  const trackedFindMany = jest.fn();
  const changeEventCount = jest.fn();

  beforeEach(async () => {
    appFindMany.mockReset();
    rankingFindFirst.mockReset();
    trackedFindMany.mockReset();
    changeEventCount.mockReset();

    const moduleRef = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        {
          provide: PrismaService,
          useValue: {
            app: { findMany: appFindMany },
            keywordRanking: { findFirst: rankingFindFirst },
            trackedKeyword: { findMany: trackedFindMany },
            changeEvent: { count: changeEventCount },
          },
        },
      ],
    }).compile();
    service = moduleRef.get(AnalyticsService);
  });

  it('yields zero current and empty sparkline for an app with no rankings', async () => {
    appFindMany.mockImplementation(
      (args: { where: { isCompetitor?: boolean } }) =>
        args.where.isCompetitor === false
          ? [
              {
                id: 'app_1',
                store: 'APP_STORE',
                country: 'us',
                name: 'Empty',
                iconUrl: null,
                groupId: null,
                group: null,
                _count: { competitors: 0 },
                snapshots: [],
              },
            ]
          : [{ id: 'app_1' }],
    );
    rankingFindFirst.mockResolvedValue(null);
    trackedFindMany.mockResolvedValue([]);
    changeEventCount.mockResolvedValue(0);

    const result = await service.portfolio();

    expect(result.apps).toEqual([
      {
        id: 'app_1',
        store: 'APP_STORE',
        country: 'us',
        name: 'Empty',
        iconUrl: null,
        groupId: null,
        groupName: null,
        visibility: { current: 0, delta7d: null },
        sparkline: [],
        trackedKeywords: 0,
        competitors: 0,
        lastCapturedAt: null,
      },
    ]);
    expect(result.totals).toEqual({
      apps: 1,
      competitors: 0,
      trackedKeywords: 0,
      changes7d: 0,
    });
  });

  it('orders apps by current visibility then name and totals across the workspace', async () => {
    const reference = new Date('2026-07-13T00:00:00Z');
    appFindMany.mockImplementation(
      (args: { where: { isCompetitor?: boolean } }) =>
        args.where.isCompetitor === false
          ? [
              {
                id: 'low',
                store: 'APP_STORE',
                country: 'us',
                name: 'Low',
                iconUrl: null,
                groupId: null,
                group: null,
                _count: { competitors: 1 },
                snapshots: [{ capturedAt: reference }],
              },
              {
                id: 'high',
                store: 'APP_STORE',
                country: 'us',
                name: 'High',
                iconUrl: null,
                groupId: null,
                group: null,
                _count: { competitors: 2 },
                snapshots: [{ capturedAt: reference }],
              },
            ]
          : [{ id: 'low' }, { id: 'high' }],
    );
    rankingFindFirst.mockResolvedValue({ date: reference });
    trackedFindMany.mockImplementation((args: { where: { appId: string } }) => {
      const position = args.where.appId === 'high' ? 1 : 50;
      return [
        {
          keywordId: 'k1',
          source: 'TITLE',
          relevance: null,
          keyword: {
            text: 'kw',
            metrics: [{ traffic: 10, difficulty: 10, date: reference }],
            rankings: [{ position, date: reference }],
          },
        },
      ];
    });
    changeEventCount.mockResolvedValue(4);

    const result = await service.portfolio();

    expect(result.apps.map((app) => app.id)).toEqual(['high', 'low']);
    expect(result.apps[0].visibility.current).toBeGreaterThan(
      result.apps[1].visibility.current,
    );
    expect(result.apps[0].sparkline).toEqual([
      { date: '2026-07-13', visibility: result.apps[0].visibility.current },
    ]);
    expect(result.totals).toEqual({
      apps: 2,
      competitors: 3,
      trackedKeywords: 2,
      changes7d: 4,
    });
  });
});
