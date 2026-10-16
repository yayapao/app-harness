import { z } from 'zod';

export const harnessSettingsSchema = z
  .object({
    model: z.string().trim().min(1, '请输入模型').max(200, '模型名称过长'),
    maxIterations: z
      .number({ error: '请输入运行轮数' })
      .int('请输入整数')
      .min(1, '至少 1 轮')
      .max(32, '最多 32 轮'),
    maxTokens: z
      .number({ error: '请输入输出上限' })
      .int('请输入整数')
      .min(256, '至少 256 tokens')
      .max(64000, '最多 64000 tokens'),
  })
  .strict();
