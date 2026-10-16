import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';

async function exists(file) {
  try {
    await access(file);
    return true;
  } catch (error) {
    if (['ENOENT', 'ENOTDIR'].includes(error.code)) return false;
    throw error;
  }
}

export async function validateInstallation(root) {
  const modern = path.join(root, 'harness/app-harness.json');
  const legacy = path.join(root, 'harness/nextpier.json');
  const markerPath = (await exists(modern)) ? modern : legacy;
  if (!(await exists(markerPath))) return null;
  const marker = JSON.parse(await readFile(markerPath, 'utf8'));
  const generator = markerPath === modern ? 'app-harness' : 'nextpier-harness';
  if (
    marker.generator !== generator ||
    marker.schemaVersion !== 1 ||
    !Array.isArray(marker.files) ||
    !marker.files.includes('app/harness/page.tsx')
  )
    throw new Error('harness/ 不是兼容的 Harness 工程');
  for (const file of marker.files) {
    if (
      typeof file !== 'string' ||
      file.includes('\\') ||
      path.posix.isAbsolute(file) ||
      file.split('/').some((part) => !part || part === '.' || part === '..')
    )
      throw new Error('Harness 集成标记包含无效路径');
    if (!(await exists(path.join(root, file))))
      throw new Error(`集成文件缺失：${file}；请恢复后重试`);
  }
  return marker;
}

export async function doctorHarness(root) {
  if (!(await validateInstallation(root)))
    throw new Error('请先运行 npm run upgrade:harness');
  const missing = [];
  for (const dependency of ['openai', 'eventsource-parser', 'tsx'])
    if (
      !(await exists(
        path.join(root, 'node_modules', dependency, 'package.json')
      ))
    )
      missing.push(dependency);
  const config = JSON.parse(
    await readFile(path.join(root, 'nextpier.config.json'), 'utf8')
  );
  if (!config.features?.harness) missing.push('features.harness');
  if (missing.length)
    throw new Error(`缺少 ${missing.join('、')}；请检查配置并运行 npm install`);
  const { loadEnvConfig } = createRequire(path.join(root, 'package.json'))(
    '@next/env'
  );
  loadEnvConfig(root, process.env.NODE_ENV !== 'production');
  const mode = process.env.HARNESS_MODE?.trim() || 'demo';
  if (!['demo', 'openai'].includes(mode))
    throw new Error('HARNESS_MODE 必须为 demo 或 openai');
  if (
    mode === 'openai' &&
    (!process.env.HARNESS_MODEL?.trim() || !process.env.OPENAI_API_KEY?.trim())
  )
    throw new Error('openai 模式缺少 HARNESS_MODEL 或 OPENAI_API_KEY');
  console.log(
    `Harness 工程、依赖与配置已就绪，模式：${mode}。未请求模型；配置见 .env.harness.example。`
  );
}
