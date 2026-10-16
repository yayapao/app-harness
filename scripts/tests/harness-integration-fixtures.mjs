import { createHash } from 'node:crypto';
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const repository = fileURLToPath(new URL('../../', import.meta.url));

export async function fixture(t) {
  const temporary = await mkdtemp(
    path.join(os.tmpdir(), 'nextpier-port-test-')
  );
  t.after(() => rm(temporary, { recursive: true, force: true }));
  const project = path.join(temporary, 'existing project');
  await mkdir(project);
  return { temporary, project };
}

export async function file(root, relative, content) {
  await mkdir(path.dirname(path.join(root, relative)), { recursive: true });
  await writeFile(path.join(root, relative), content);
}

export async function inventory(root, relative = '') {
  const result = {};
  for (const entry of await readdir(path.join(root, relative), {
    withFileTypes: true,
  })) {
    const next = path.posix.join(relative, entry.name);
    if (entry.isDirectory()) Object.assign(result, await inventory(root, next));
    else if (entry.isFile())
      result[next] = createHash('sha256')
        .update(await readFile(path.join(root, next)))
        .digest('hex');
  }
  return result;
}
