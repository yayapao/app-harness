'use client';

import { useEffect, useRef, useState } from 'react';
import { EventSourceParserStream } from 'eventsource-parser/stream';
import {
  createConversation,
  loadConversation,
  removeConversation,
  confirmTool,
  stopConversation,
} from '@/app/harness/actions';
import type { HarnessChatState, HarnessInitialData } from '@/types';
import type { HarnessStreamEvent } from '@/harness/core';

const idle: HarnessChatState = {
  busy: false,
  error: '',
  progress: '',
  confirmation: null,
};

export function useHarness(initialData: HarnessInitialData) {
  const [data, setData] = useState(initialData);
  const [state, setState] = useState(idle);
  const controller = useRef<AbortController | null>(null);
  const locked = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      controller.current?.abort();
    };
  }, []);

  async function manage(action: () => Promise<HarnessInitialData>) {
    if (locked.current) return;
    locked.current = true;
    setState({ ...idle, busy: true });
    try {
      const next = await action();
      if (mounted.current) setData(next);
    } catch (error) {
      if (mounted.current)
        setState({
          ...idle,
          error: error instanceof Error ? error.message : '操作失败',
        });
    } finally {
      locked.current = false;
      if (mounted.current) setState((current) => ({ ...current, busy: false }));
    }
  }

  async function send(message: string) {
    if (locked.current || !message.trim()) return;
    locked.current = true;
    setState({ ...idle, busy: true });
    const abort = new AbortController();
    controller.current = abort;
    let sessionId = data.sessionId;
    let reader: ReadableStreamDefaultReader<{ data: string }> | undefined;
    try {
      const current = sessionId ? data : await createConversation();
      if (abort.signal.aborted) return;
      sessionId = current.sessionId;
      const assistantId = crypto.randomUUID();
      setData({
        ...current,
        messages: [
          ...current.messages,
          {
            id: crypto.randomUUID(),
            role: 'user',
            content: message,
            timestamp: Date.now(),
          },
          {
            id: assistantId,
            role: 'assistant',
            content: '',
            timestamp: Date.now(),
          },
        ],
      });
      const response = await fetch('/api/harness/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, message }),
        signal: abort.signal,
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || `请求失败 (${response.status})`);
      }
      if (!response.body) throw new Error('服务未返回消息流');
      reader = response.body
        .pipeThrough(new TextDecoderStream())
        .pipeThrough(new EventSourceParserStream())
        .getReader();
      let terminal = false;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const event = JSON.parse(value.data) as HarnessStreamEvent;
        if (event.type === 'message_delta') {
          setData((current) => ({
            ...current,
            messages: current.messages.map((item) =>
              item.id === assistantId
                ? { ...item, content: item.content + event.content }
                : item
            ),
          }));
        } else if (event.type === 'message_action') {
          setData((current) => ({ ...current, messages: current.messages.map((item) => item.id === assistantId ? { ...item, action: event.action } : item) }));
        } else if (event.type === 'confirmation_request') {
          setState((current) => ({
            ...current,
            confirmation: event,
            progress: '等待确认',
          }));
        } else if (event.type === 'tool_call_started') {
          setState((current) => ({
            ...current,
            confirmation: null,
            progress: '正在执行操作',
          }));
        } else if (event.type === 'tool_progress') {
          setState((current) => ({ ...current, progress: event.message }));
        } else if (event.type === 'done') {
          terminal = true;
        } else if (event.type === 'error') {
          terminal = true;
          if (event.message !== '已停止') throw new Error(event.message);
        }
      }
      if (!terminal) throw new Error('连接已中断');
    } catch (error) {
      if (!abort.signal.aborted)
        setState((current) => ({
          ...current,
          error: error instanceof Error ? error.message : '发送失败',
        }));
    } finally {
      await reader?.cancel().catch(() => undefined);
      if (sessionId && !abort.signal.aborted) {
        try {
          const next = await loadConversation(sessionId);
          if (mounted.current) setData(next);
        } catch {}
      }
      controller.current = null;
      locked.current = false;
      if (mounted.current)
        setState((current) => ({
          ...current,
          busy: false,
          progress: '',
          confirmation: null,
        }));
    }
  }

  async function answer(value: string) {
    if (!state.confirmation) return;
    await confirmTool(data.sessionId, state.confirmation.id, value);
    if (mounted.current)
      setState((current) => ({
        ...current,
        confirmation: null,
        progress: '执行中',
      }));
  }

  async function stop() {
    try {
      await stopConversation(data.sessionId);
    } catch (error) {
      if (mounted.current)
        setState((current) => ({
          ...current,
          error: error instanceof Error ? error.message : '停止失败',
        }));
    }
  }

  return {
    data,
    state,
    send,
    answer,
    stop,
    create: () => manage(createConversation),
    select: (id: string) => manage(() => loadConversation(id)),
    remove: () => manage(() => removeConversation(data.sessionId)),
  };
}
