import type {
  HarnessSessionLog,
  HarnessTraceEntry,
  HarnessTraceSink,
} from '../types';

export function createRunLog(sessionId: string, request: string): HarnessSessionLog {
  return {
    id: crypto.randomUUID(),
    sessionId,
    startedAt: Date.now(),
    status: 'running',
    request,
    result: '',
  };
}

export function createTraceRecorder(
  runLog: HarnessSessionLog,
  saveTrace: (log: HarnessSessionLog) => Promise<void>,
  includePayloads = false,
): HarnessTraceSink & { flush(): Promise<void> } {
  let pending = Promise.resolve();
  const record: HarnessTraceSink = (entry) => {
    const traceEntry: HarnessTraceEntry = {
      id: crypto.randomUUID(),
      at: Date.now(),
      ...entry,
      payload: includePayloads ? entry.payload : undefined,
    };
    runLog.trace = [...(runLog.trace ?? []), traceEntry];
    pending = pending.then(() => saveTrace(runLog)).catch((error) => {
      console.error('[Harness] 运行追踪保存失败', error);
    });
  };
  return Object.assign(record, { flush: () => pending });
}
