import type {
  HarnessAgent,
  HarnessCapabilities,
  HarnessSkill,
  HarnessTool,
  ContextProvider,
  HarnessPlugin,
} from './types';

export class HarnessRegistry {
  private tools = new Map<string, HarnessTool>();
  private agents = new Map<string, HarnessAgent>();
  private skills = new Map<string, HarnessSkill>();
  private contextProviders = new Map<string, ContextProvider>();

  registerPlugin(plugin: HarnessPlugin): void {
    if (!plugin.name || !plugin.version) throw new Error('Plugin name and version are required');
    const skillIds = new Set(this.skills.keys());
    const toolNames = new Set(this.tools.keys());
    const agentNames = new Set(this.agents.keys());
    const providerTypes = new Set(this.contextProviders.keys());
    for (const skill of plugin.skills) {
      if (skillIds.has(skill.id)) throw new Error('Duplicate skill: ' + skill.id);
      skillIds.add(skill.id);
      for (const tool of skill.tools) {
        if (toolNames.has(tool.name) || agentNames.has(tool.name)) throw new Error('Duplicate callable: ' + tool.name);
        toolNames.add(tool.name);
      }
      for (const agent of skill.agents ?? []) {
        if (agentNames.has(agent.name) || toolNames.has(agent.name)) throw new Error('Duplicate callable: ' + agent.name);
        agentNames.add(agent.name);
      }
      for (const provider of skill.contextProviders ?? []) {
        if (providerTypes.has(provider.type)) throw new Error('Duplicate context provider: ' + provider.type);
        providerTypes.add(provider.type);
      }
    }
    for (const skill of plugin.skills) this.registerSkill(skill);
  }

  registerSkill(skill: HarnessSkill): void {
    if (!skill.id) throw new Error('Skill ID is required');
    if (this.skills.has(skill.id)) throw new Error('Duplicate skill: ' + skill.id);
    const callables = new Set([...this.tools.keys(), ...this.agents.keys()]);
    for (const tool of skill.tools) {
      if (callables.has(tool.name)) throw new Error('Duplicate callable: ' + tool.name);
      callables.add(tool.name);
    }
    for (const agent of skill.agents ?? []) {
      if (callables.has(agent.name)) throw new Error('Duplicate callable: ' + agent.name);
      callables.add(agent.name);
    }
    const providerTypes = new Set(this.contextProviders.keys());
    for (const provider of skill.contextProviders ?? []) {
      if (providerTypes.has(provider.type)) throw new Error('Duplicate context provider: ' + provider.type);
      providerTypes.add(provider.type);
    }
    this.skills.set(skill.id, skill);
    for (const tool of skill.tools) {
      this.tools.set(tool.name, tool);
    }
    for (const agent of skill.agents ?? []) {
      this.agents.set(agent.name, agent);
    }
    for (const cp of skill.contextProviders ?? []) {
      this.contextProviders.set(cp.type, cp);
    }
  }

  unregisterSkill(skillId: string): void {
    const skill = this.skills.get(skillId);
    if (!skill) return;
    for (const tool of skill.tools) {
      this.tools.delete(tool.name);
    }
    for (const agent of skill.agents ?? []) {
      this.agents.delete(agent.name);
    }
    for (const cp of skill.contextProviders ?? []) {
      this.contextProviders.delete(cp.type);
    }
    this.skills.delete(skillId);
  }

  getTool(name: string): HarnessTool | undefined {
    const tool = this.tools.get(name);
    if (tool) return tool;
    const agent = this.agents.get(name);
    if (!agent) return undefined;
    return {
      name: agent.name,
      description: agent.description,
      category: 'agent',
      parameters: agent.parameters,
      outputDescription: agent.outputDescription,
      permission: agent.permission,
      requiresConfirmation: agent.requiresConfirmation,
      handler: (input, context) => agent.execute(input, context),
    };
  }

  getAgent(name: string): HarnessAgent | undefined {
    return this.agents.get(name);
  }

  getSkill(id: string): HarnessSkill | undefined {
    return this.skills.get(id);
  }

  getContextProvider(type: string): ContextProvider | undefined {
    return this.contextProviders.get(type);
  }

  getAllTools(): HarnessTool[] {
    return [...this.tools.values()];
  }

  getAllCallableTools(): HarnessTool[] {
    return [...this.tools.values(), ...this.agents.keys()].map((entry) =>
      typeof entry === 'string' ? this.getTool(entry)! : entry);
  }

  getAllAgents(): HarnessAgent[] {
    return [...this.agents.values()];
  }

  getAllSkills(): HarnessSkill[] {
    return [...this.skills.values()];
  }

  getAllContextProviders(): ContextProvider[] {
    return [...this.contextProviders.values()];
  }

  getCapabilities(): HarnessCapabilities {
    return {
      tools: this.getAllTools().map((t) => ({
        name: t.name,
        description: t.description,
        category: t.category,
        permission: t.permission,
        requiresConfirmation: t.permission !== 'read' || Boolean(t.requiresConfirmation),
      })),
      agents: this.getAllAgents().map((a) => ({
        name: a.name,
        displayName: a.displayName,
        description: a.description,
        permission: a.permission,
        requiresConfirmation: a.permission !== 'read' || Boolean(a.requiresConfirmation),
      })),
      skills: this.getAllSkills().map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        toolNames: s.tools.map((tool) => tool.name),
        agentNames: (s.agents ?? []).map((agent) => agent.name),
        contextTypes: (s.contextProviders ?? []).map((provider) => provider.type),
      })),
      contextProviders: this.getAllContextProviders().map((cp) => ({
        type: cp.type,
        displayName: cp.displayName,
        description: cp.description,
      })),
    };
  }

  buildSystemPrompt(): string {
    const parts: string[] = [];
    for (const skill of this.getAllSkills()) {
      parts.push('## ' + skill.name + ' (' + skill.id + ')');
      parts.push(skill.instructions);
      parts.push('');
    }
    return parts.join('\n');
  }
}
