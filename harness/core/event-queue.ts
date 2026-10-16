type QueueResult<T> = { done: true } | { done: false; value: T };

interface QueueWaiter<T> {
  resolve: (result: QueueResult<T>) => void;
}

export class AsyncEventQueue<T> {
  private buffer: T[] = [];
  private waiters: Array<QueueWaiter<T>> = [];
  private closed = false;

  push(value: T): void {
    if (this.closed) return;
    const waiter = this.waiters.shift();
    if (waiter) {
      waiter.resolve({ done: false, value });
      return;
    }
    this.buffer.push(value);
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    for (const waiter of this.waiters.splice(0)) {
      waiter.resolve({ done: true });
    }
  }

  async *stream(): AsyncGenerator<T> {
    while (true) {
      if (this.buffer.length > 0) {
        const value = this.buffer.shift();
        if (value !== undefined) yield value;
        continue;
      }

      if (this.closed) return;

      const result = await new Promise<QueueResult<T>>((resolve) => {
        this.waiters.push({ resolve });
      });
      if (result.done) return;
      yield result.value;
    }
  }
}
