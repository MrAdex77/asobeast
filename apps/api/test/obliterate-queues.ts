import { getQueueToken } from '@nestjs/bullmq';
import { INestApplication } from '@nestjs/common';
import { Queue } from 'bullmq';
import { QUEUES } from '../src/jobs/jobs.types';

export async function obliterateQueues(app: INestApplication): Promise<void> {
  for (const name of Object.values(QUEUES)) {
    const queue = app.get<Queue>(getQueueToken(name), { strict: false });
    await queue.obliterate({ force: true });
  }
}

export async function pauseQueues(app: INestApplication): Promise<void> {
  for (const name of Object.values(QUEUES)) {
    const queue = app.get<Queue>(getQueueToken(name), { strict: false });
    await queue.pause();
  }
}
