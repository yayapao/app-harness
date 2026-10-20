import { HarnessGateway } from './core';
import type { HarnessGatewayOptions } from './core';

/**
 * Public framework-neutral boundary. A host supplies the model, store, policy
 * and business plugins; the returned gateway owns orchestration and sessions.
 */
export function createHarness(options: HarnessGatewayOptions) {
  const gateway = new HarnessGateway(options);
  return {
    gateway,
    getCapabilities: () => gateway.getCapabilities(),
    createSession: (title?: string) => gateway.createSession(title),
    handleChat: gateway.handleChat.bind(gateway),
    stopSession: (sessionId: string) => gateway.stopSession(sessionId),
    listSessionLogs: (sessionId?: string) => gateway.listSessionLogs(sessionId),
    resolveMentions: (message: string) => gateway.resolveMentions(message),
    searchReferences: gateway.searchReferences.bind(gateway),
  };
}
