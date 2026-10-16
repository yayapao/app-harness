'use client';

import { Bot, ShieldCheck, Wrench } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  HaloTabs as Tabs,
  HaloTabsContent as TabsContent,
  HaloTabsList as TabsList,
  HaloTabsTrigger as TabsTrigger,
} from '@/components/ui/halo-tabs';
import type { HarnessCapabilityDetailsProps } from '@/types';

const permissions = { read: '只读', write: '写入', destructive: '删除' };

export function HarnessCapabilityDetails({
  skill,
  capabilities,
}: HarnessCapabilityDetailsProps) {
  const agents = capabilities.agents.filter((agent) =>
    skill.agentNames.includes(agent.name)
  );
  const tools = capabilities.tools.filter((tool) =>
    skill.toolNames.includes(tool.name)
  );
  return (
    <Tabs
      defaultValue={agents.length ? 'agents' : 'tools'}
      className="flex min-h-0 flex-col gap-0"
    >
      <TabsList className="mx-4 mb-2 h-8 shrink-0" aria-label="能力明细">
        <TabsTrigger value="agents">
          <Bot aria-hidden />
          Agent <span className="font-mono text-xs">{agents.length}</span>
        </TabsTrigger>
        <TabsTrigger value="tools">
          <Wrench aria-hidden />
          工具 <span className="font-mono text-xs">{tools.length}</span>
        </TabsTrigger>
      </TabsList>
      <TabsContent
        value="agents"
        className="min-h-0 overflow-y-auto overscroll-contain px-4 pb-3"
        tabIndex={0}
      >
        {agents.length ? (
          <ul className="divide-y">
            {agents.map((agent) => (
              <li key={agent.name} className="flex flex-col gap-1.5 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className="min-w-0 flex-1 break-words font-medium"
                    title={agent.name}
                  >
                    {agent.displayName}
                  </span>
                  <Badge variant="outline">
                    {permissions[agent.permission]}
                  </Badge>
                  {agent.requiresConfirmation ? (
                    <Badge variant="secondary">
                      <ShieldCheck aria-hidden />
                      需确认
                    </Badge>
                  ) : null}
                </div>
                <p className="break-words text-xs leading-relaxed text-muted-foreground">
                  {agent.description}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-6 text-center text-sm text-muted-foreground">
            无已注册 Agent
          </p>
        )}
      </TabsContent>
      <TabsContent
        value="tools"
        className="min-h-0 overflow-y-auto overscroll-contain px-4 pb-3"
        tabIndex={0}
      >
        {tools.length ? (
          <ul className="divide-y">
            {tools.map((tool) => (
              <li key={tool.name} className="flex flex-col gap-1.5 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="min-w-0 flex-1 break-all font-mono text-xs font-medium">
                    {tool.name}
                  </span>
                  <Badge variant="outline">
                    {permissions[tool.permission]}
                  </Badge>
                  {tool.requiresConfirmation ? (
                    <Badge variant="secondary">
                      <ShieldCheck aria-hidden />
                      需确认
                    </Badge>
                  ) : null}
                </div>
                <p className="break-words text-xs leading-relaxed text-muted-foreground">
                  {tool.description}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-6 text-center text-sm text-muted-foreground">
            无已注册工具
          </p>
        )}
      </TabsContent>
    </Tabs>
  );
}
