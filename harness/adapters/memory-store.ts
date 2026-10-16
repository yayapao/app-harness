import type { HarnessMessage, HarnessSession, HarnessSessionLog, HarnessStore } from '../core/types';

export function createMemoryHarnessStore(): HarnessStore & { deleteConversation(id: string): Promise<void> } {
  const conversations = new Map<string, HarnessSession>();
  const runs = new Map<string, HarnessSessionLog>();

  return {
    async deleteConversation(id) {
      conversations.delete(id);
      for (const [key, log] of runs) if (log.sessionId === id) runs.delete(key);
    },
    async createConversation(title = 'New conversation') {
      const now = Date.now();
      const session: HarnessSession = {
        id: crypto.randomUUID(), title, createdAt: now, updatedAt: now,
        messages: [], runState: 'idle', installedSkillIds: [],
      };
      conversations.set(session.id, session);
      return structuredClone(session);
    },
    async getConversation(id) {
      const session = conversations.get(id);
      return session ? structuredClone(session) : null;
    },
    async touchConversation(id, title) {
      const session = conversations.get(id);
      if (!session) throw new Error('Conversation not found');
      if (title !== undefined) session.title = title;
      session.updatedAt = Date.now();
    },
    async appendMessage(id, message: HarnessMessage) {
      const session = conversations.get(id);
      if (!session) throw new Error('Conversation not found');
      session.messages.push(structuredClone(message));
      session.updatedAt = Date.now();
    },
    async rewindMessages(id, count) {
      const session = conversations.get(id);
      if (!session || count < 0 || count > session.messages.length) return false;
      session.messages.splice(count);
      session.updatedAt = Date.now();
      return true;
    },
    async createRun(log) {
      runs.set(log.id, structuredClone(log));
    },
    async saveRunTrace(log) {
      const run = runs.get(log.id);
      if (run) run.trace = structuredClone(log.trace ?? []);
    },
    async finishRun(log) {
      runs.set(log.id, structuredClone(log));
    },
    async listRuns(id?: string) {
      return [...runs.values()].filter((run) => !id || run.sessionId === id)
        .sort((a, b) => b.startedAt - a.startedAt).map((run) => structuredClone(run));
    },
  };
}
