/**
 * Bounded-concurrency worker pool with backpressure.
 *
 * The scheduler submits jobs; the pool guarantees that no more than
 * `concurrency` run at once. Extra jobs wait in an internal queue (backpressure)
 * rather than all firing simultaneously, which is what keeps any one stage from
 * flooding downstream consumers. `onPeak` reports the high-water mark of
 * simultaneous jobs so the run can record its true parallel peak.
 */

export interface PoolJob<T> {
  /** Stable id, used for telemetry and to look the result up. */
  id: string
  /** Higher number = scheduled first when capacity frees up. */
  priority: number
  run: () => Promise<T>
}

export interface WorkerPoolOptions {
  concurrency: number
  onActiveChange?: (active: number) => void
}

export class WorkerPool<T = unknown> {
  private concurrency: number
  private active = 0
  private peak = 0
  private queue: PoolJob<T>[] = []
  private onActiveChange?: (active: number) => void
  private idleResolvers: Array<() => void> = []

  constructor(opts: WorkerPoolOptions) {
    this.concurrency = Math.max(1, opts.concurrency)
    this.onActiveChange = opts.onActiveChange
  }

  get peakConcurrency(): number {
    return this.peak
  }

  get activeCount(): number {
    return this.active
  }

  get pendingCount(): number {
    return this.queue.length
  }

  /** Resize the pool at runtime (e.g. adaptive scaling). */
  setConcurrency(n: number) {
    this.concurrency = Math.max(1, n)
    this.pump()
  }

  /** Submit a job; resolves with its result (or rejects with its error). */
  submit(job: PoolJob<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const wrapped: PoolJob<T> = {
        ...job,
        run: () => job.run().then(resolve, reject).then(() => undefined as unknown as T),
      }
      // Insert keeping the queue sorted by priority (stable-ish insertion).
      const idx = this.queue.findIndex((q) => q.priority < wrapped.priority)
      if (idx === -1) this.queue.push(wrapped)
      else this.queue.splice(idx, 0, wrapped)
      this.pump()
    })
  }

  /** Resolves once every queued + active job has finished. */
  onIdle(): Promise<void> {
    if (this.active === 0 && this.queue.length === 0) return Promise.resolve()
    return new Promise((resolve) => this.idleResolvers.push(resolve))
  }

  private pump() {
    while (this.active < this.concurrency && this.queue.length > 0) {
      const job = this.queue.shift()!
      this.active++
      this.peak = Math.max(this.peak, this.active)
      this.onActiveChange?.(this.active)
      void job
        .run()
        .catch(() => undefined)
        .finally(() => {
          this.active--
          this.onActiveChange?.(this.active)
          this.pump()
          if (this.active === 0 && this.queue.length === 0) {
            const resolvers = this.idleResolvers
            this.idleResolvers = []
            for (const r of resolvers) r()
          }
        })
    }
  }
}
