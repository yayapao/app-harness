import type {
  HarnessSession,
  HarnessTraceSink,
} from '../types';
import type { ConfirmHandler } from '../orchestrator/tool-execution';

export function createConfirmHandler(
  session: HarnessSession,
  stopController: AbortController,
  recordTrace: HarnessTraceSink,
): ConfirmHandler {
  return (toolName, params, confirmationId) => {
    const activeSession = session;
    let resolveAnswer!: (answer: string) => void;

    const promise = new Promise<string>((resolve) => {
      let settled = false;
      const settle = (answer: string) => {
        if (settled) return;
        settled = true;
        stopController.signal.removeEventListener('abort', onAbort);
        if (activeSession.pendingConfirmation?.id === confirmationId) {
          activeSession.pendingConfirmation = undefined;
        }
        resolve(answer);
        activeSession.runState = 'running';
        recordTrace({
          type: 'state_changed',
          label: '状态：恢复执行',
          payload: { tool: activeSession.pendingConfirmation?.tool ?? toolName, confirmationId, answer },
        });
      };
      const onAbort = () => settle('cancel');
      stopController.signal.addEventListener('abort', onAbort, { once: true });
      resolveAnswer = settle;
    });

    activeSession.runState = 'awaiting_confirmation';
    activeSession.pendingConfirmation = {
      id: confirmationId,
      tool: toolName,
      params,
      resolve: resolveAnswer,
    };
    recordTrace({
      type: 'state_changed',
      label: '状态：等待确认',
      payload: { tool: toolName, confirmationId, params },
    });
    if (stopController.signal.aborted) resolveAnswer('cancel');
    return promise;
  };
}
