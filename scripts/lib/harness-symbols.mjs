import { createRequire } from 'node:module';

let typescript;
try {
  typescript = createRequire(import.meta.url)('typescript');
} catch {
  // A source checkout without npm dependencies can still prepare a file inventory.
}

export const hasTypescriptParser = Boolean(typescript);

function permissionHint(name) {
  if (/^(GET|HEAD|OPTIONS)$/.test(name)) return 'read';
  if (name === 'DELETE') return 'destructive';
  if (/^(POST|PUT|PATCH)$/.test(name)) return 'write';
  if (/^(delete|remove|purge|drop|destroy)/i.test(name)) return 'destructive';
  if (
    /^(create|save|update|set|insert|publish|send|approve|reject)/i.test(name)
  )
    return 'write';
  if (/^(get|list|read|find|search|query|fetch)/i.test(name)) return 'read';
  return 'unknown';
}

export function discoverSymbols(file, source) {
  const ts = typescript;
  if (!ts) return [];
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  for (const node of tree.statements) {
    if (!ts.isExpressionStatement(node) || !ts.isStringLiteral(node.expression))
      break;
    if (node.expression.text === 'use client') return [];
  }
  const results = [];
  const exported = (node) =>
    node.modifiers?.some(
      (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword
    );
  function record(name, node, parameters) {
    const kind = /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)$/.test(name)
      ? 'route-handler'
      : 'exported-function';
    if (
      name.startsWith('_') ||
      (/^[A-Z]/.test(name) && kind !== 'route-handler')
    )
      return;
    results.push({
      file,
      line: tree.getLineAndCharacterOfPosition(node.getStart(tree)).line + 1,
      name,
      kind,
      parameterCount: parameters.length,
      permissionHint: permissionHint(name),
      reviewRequired: true,
      registered: false,
    });
  }
  for (const node of tree.statements) {
    if (!exported(node)) continue;
    if (ts.isFunctionDeclaration(node) && node.name) {
      const name = node.name.text;
      record(name, node, node.parameters);
    } else if (ts.isVariableStatement(node)) {
      for (const declaration of node.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name) || !declaration.initializer)
          continue;
        if (
          ts.isArrowFunction(declaration.initializer) ||
          ts.isFunctionExpression(declaration.initializer)
        )
          record(
            declaration.name.text,
            declaration,
            declaration.initializer.parameters
          );
      }
    }
  }
  return results;
}

export function discoverOpenApi(file, document) {
  const candidates = [];
  for (const [route, operations] of Object.entries(document.paths ?? {})) {
    if (!operations || typeof operations !== 'object') continue;
    for (const [method, operation] of Object.entries(operations)) {
      if (
        !/^(get|post|put|patch|delete|head|options)$/.test(method) ||
        !operation ||
        typeof operation !== 'object'
      )
        continue;
      candidates.push({
        file,
        route,
        method: method.toUpperCase(),
        name:
          typeof operation.operationId === 'string'
            ? operation.operationId
            : `${method} ${route}`,
        kind: 'openapi-operation',
        permissionHint:
          method === 'delete'
            ? 'destructive'
            : ['get', 'head', 'options'].includes(method)
              ? 'read'
              : 'write',
        reviewRequired: true,
        registered: false,
      });
    }
  }
  return candidates;
}
