import IORedisModule from "ioredis";
import type { IngestEvent } from "@tokenlens/shared";
import type { EventQueue } from "./contracts.js";

export class RedisEventQueue implements EventQueue {
  constructor(
    private readonly redis = new (IORedisModule as unknown as { new(url?: string): any })(process.env.REDIS_URL),
    private readonly streamName = process.env.TOKENLENS_STREAM_NAME ?? "tokenlens:events",
  ) {}

  async publish(event: IngestEvent): Promise<void> {
    const dedupeKey = `tokenlens:dedupe:${event.traceId}`;
    const accepted = await this.redis.set(dedupeKey, "1", "EX", 300, "NX");
    if (!accepted) {
      return;
    }

    await this.redis.xadd(this.streamName, "*", "event", JSON.stringify(event));
  }
}
