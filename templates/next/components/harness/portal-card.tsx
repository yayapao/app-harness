'use client';

import { useId, useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  buildPortalPrompt,
  type PortalProposal,
  type PortalDesign,
} from '@/harness/core/resource-portal';
import type { PromptTarget } from '@/harness/core/message-actions';
import { PromptActions } from './prompt-actions';

export function PortalCard({
  proposal,
  disabled,
  target,
  onRecommend,
}: {
  proposal: PortalProposal;
  disabled: boolean;
  target?: PromptTarget;
  onRecommend: (message: string) => void;
}) {
  const id = useId();
  const [design, setDesign] = useState(() => structuredClone(proposal.design));
  const [name, setName] = useState('');
  let prompt = '';
  try {
    prompt = buildPortalPrompt(proposal, design);
  } catch {
    /* Incomplete edits disable handoff. */
  }
  const field = (key: 'title' | 'style' | 'grouping', value: string) =>
    setDesign((current) => ({ ...current, [key]: value }));
  return (
    <section
      aria-label="门户 Prompt 设计"
      className="mt-3 min-w-0 space-y-3 rounded-lg border border-border p-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="min-w-0 truncate text-sm font-medium">
          {proposal.source.name} · {proposal.source.entries.length}/{proposal.source.total}
        </h3>
        <PromptActions prompt={prompt} disabled={disabled} target={target} />
      </div>
      {proposal.fallback && (
        <p role="status" className="text-xs text-muted-foreground">
          模型暂时不可用，当前为可编辑基础方案，尚未重新推荐分类。
        </p>
      )}
      <label htmlFor={`${id}-title`} className="block space-y-1.5 text-xs">
        <span>门户标题</span>
        <Input
          id={`${id}-title`}
          value={design.title}
          maxLength={128}
          onChange={(event) => field('title', event.target.value)}
        />
      </label>
      <label htmlFor={`${id}-style`} className="block space-y-1.5 text-xs">
        <span>视觉风格</span>
        <Textarea
          id={`${id}-style`}
          value={design.style}
          maxLength={1200}
          rows={3}
          onChange={(event) => field('style', event.target.value)}
        />
      </label>
      <label htmlFor={`${id}-grouping`} className="block space-y-1.5 text-xs">
        <span>分类策略</span>
        <Textarea
          id={`${id}-grouping`}
          value={design.grouping}
          maxLength={800}
          rows={2}
          onChange={(event) => field('grouping', event.target.value)}
        />
      </label>
      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="min-w-0 space-y-1.5 text-xs">
          <span>展示布局</span>
          <select
            value={design.layout}
            onChange={(event) =>
              setDesign((current) => ({
                ...current,
                layout: event.target.value as PortalDesign['layout'],
              }))
            }
            className="block h-8 w-full rounded-md border border-border bg-background px-2"
          >
            <option value="cards">卡片网格</option>
            <option value="list">阅读列表</option>
          </select>
        </label>
        <label className="min-w-0 space-y-1.5 text-xs">
          <span>入口排序</span>
          <select
            value={design.sort}
            onChange={(event) =>
              setDesign((current) => ({
                ...current,
                sort: event.target.value as PortalDesign['sort'],
              }))
            }
            className="block h-8 w-full rounded-md border border-border bg-background px-2"
          >
            <option value="updated">最近更新优先</option>
            <option value="title">按标题排序</option>
            <option value="manual">保留当前顺序</option>
          </select>
        </label>
      </div>
      <details open>
        <summary className="cursor-pointer text-xs font-medium">分类与入口</summary>
        <div className="mt-2 max-h-80 space-y-2 overflow-y-auto overscroll-contain">
          {design.groups.map((group, index) => (
            <div key={index} className="min-w-0 rounded-md border border-border/70 p-2.5">
              <Input
                aria-label={`分类 ${index + 1} 名称`}
                value={group.name}
                maxLength={64}
                onChange={(event) =>
                  setDesign((current) => ({
                    ...current,
                    groups: current.groups.map((item, at) =>
                      at === index ? { ...item, name: event.target.value } : item,
                    ),
                  }))
                }
              />
              {group.entryIds.map((entryId) => {
                const entry = proposal.source.entries.find((item) => item.id === entryId)!;
                return (
                  <div
                    key={entryId}
                    className="flex min-w-0 flex-wrap items-center justify-between gap-2 py-1.5 text-xs"
                  >
                    <a
                      href={entry.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-w-0 max-w-full truncate hover:underline"
                    >
                      {entry.title}
                    </a>
                    <select
                      aria-label={`调整 ${entry.title} 的分类`}
                      className="h-7 w-32 max-w-full rounded border border-border bg-background px-1"
                      value={index}
                      onChange={(event) => {
                        const targetIndex = Number(event.target.value);
                        setDesign((current) => ({
                          ...current,
                          groups: current.groups.map((item, at) => ({
                            ...item,
                            entryIds: [
                              ...item.entryIds.filter((value) => value !== entryId),
                              ...(at === targetIndex ? [entryId] : []),
                            ],
                          })),
                        }));
                      }}
                    >
                      {design.groups.map((item, at) => (
                        <option key={at} value={at}>
                          {item.name || '未命名分类'}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </details>
      <div className="flex min-w-0 gap-2">
        <Input
          aria-label="新分类名称"
          placeholder="新分类名称"
          value={name}
          maxLength={64}
          className="min-w-0 flex-1"
          onChange={(event) => setName(event.target.value)}
        />
        <Button
          type="button"
          size="icon-sm"
          aria-label="添加分类"
          disabled={
            !name.trim() ||
            design.groups.some((item) => item.name === name.trim()) ||
            design.groups.length >= 16
          }
          onClick={() => {
            setDesign((current) => ({
              ...current,
              groups: [...current.groups, { name: name.trim(), entryIds: [] }],
            }));
            setName('');
          }}
        >
          <Plus />
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          disabled={disabled || !prompt}
          onClick={() =>
            onRecommend(
              `请为集合 ${proposal.source.id} 重新推荐门户，保留当前设置并按策略重新分类：${JSON.stringify({ ...design, groups: design.groups.map((group) => group.name) })}`,
            )
          }
        >
          按策略重新推荐
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => setDesign(structuredClone(proposal.design))}
        >
          恢复推荐
        </Button>
      </div>
      {!prompt && (
        <p role="status" className="text-xs text-destructive">
          请填写标题、风格和分类策略，分类名称不能重复。
        </p>
      )}
      <details>
        <summary className="cursor-pointer text-xs">查看完整 Prompt</summary>
        <pre className="mt-2 max-h-64 overflow-y-auto whitespace-pre-wrap break-words text-xs">
          {prompt}
        </pre>
      </details>
    </section>
  );
}
