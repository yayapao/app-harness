import test from 'node:test';
import assert from 'node:assert/strict';
import { buildModelToolDefinitions } from './orchestrator';
import type { HarnessTool } from './types';

test('工具配置只覆盖 LLM 说明，不修改代码执行边界', () => {
  const handler: HarnessTool['handler'] = async () => 'ok';
  const tool: HarnessTool = {
    name: 'sample', description: '默认说明', category: 'test', permission: 'write',
    requiresConfirmation: true, handler,
    parameters: { type: 'object', properties: { symbol: { type: 'string', description: '默认参数' } }, required: ['symbol'] },
  };
  const [modelTool] = buildModelToolDefinitions([tool], {
    sample: { description: '模型说明', parameterDescriptions: { symbol: '模型参数', unknown: '不会增加参数' } },
  });
  assert.equal(modelTool.name, 'sample');
  assert.equal(modelTool.description, '模型说明');
  assert.deepEqual(modelTool.parameters, {
    type: 'object', properties: { symbol: { type: 'string', description: '模型参数' } }, required: ['symbol'],
  });
  assert.equal(tool.handler, handler);
  assert.equal(tool.permission, 'write');
  assert.equal(tool.description, '默认说明');
});
