import assert from 'node:assert/strict';
import { symlink } from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';
import { discoverHarnessProject } from '../lib/harness-discovery.mjs';
import { file, fixture, inventory } from './harness-integration-fixtures.mjs';

test('discovery parses callable exports without importing code or exposing defaults', async (t) => {
  const { project } = await fixture(t);
  await file(
    project,
    'package.json',
    JSON.stringify({
      dependencies: { express: '^5' },
      scripts: { test: 'TOKEN=private-test-token node test.mjs' },
    })
  );
  await file(
    project,
    'services/tickets.ts',
    [
      'throw new Error("must not execute during discovery");',
      'export async function listTickets(ownerId: string) { return []; }',
      'export const saveTicket = async (value = "private-default-token") => value;',
      'function internalQuery() {}',
      'export type Ticket = { id: string };',
    ].join('\n')
  );
  await file(
    project,
    'client.ts',
    "'use strict';\n'use client';\nexport function saveBrowserState() {}\n"
  );
  await file(
    project,
    'components/widget.tsx',
    'export function readWidget() {}'
  );
  await file(
    project,
    'services/tickets.test.ts',
    'export function createFixture() {}'
  );
  const before = await inventory(project);
  const report = await discoverHarnessProject(project);
  assert.equal(report.strategy, 'node-host-adapter');
  assert.deepEqual(
    report.candidates.map((item) => item.name),
    ['listTickets', 'saveTicket']
  );
  assert.equal(report.candidates[0].line, 2);
  assert.equal(report.candidates[1].permissionHint, 'write');
  assert.ok(
    report.candidates.every((item) => item.reviewRequired && !item.registered)
  );
  assert.doesNotMatch(
    JSON.stringify(report),
    /private-test-token|private-default-token/
  );
  assert.deepEqual(await inventory(project), before);
});

test('discovery includes function and arrow route handlers with method hints', async (t) => {
  const { project } = await fixture(t);
  await file(
    project,
    'app/api/tickets/route.ts',
    [
      'export async function GET() { return []; }',
      'export const POST = async () => ({});',
      'export const DELETE = function () {};',
      'export function TicketComponent() {}',
    ].join('\n')
  );
  const { candidates } = await discoverHarnessProject(project);
  assert.deepEqual(
    candidates.map((item) => [item.name, item.kind, item.permissionHint]),
    [
      ['GET', 'route-handler', 'read'],
      ['POST', 'route-handler', 'write'],
      ['DELETE', 'route-handler', 'destructive'],
    ]
  );
});

test('discovery selects host strategies and finds JSON OpenAPI for other languages', async (t) => {
  const { project } = await fixture(t);
  await file(project, 'go.mod', 'module existing.app\ngo 1.25\n');
  await file(project, 'server.go', 'package main');
  await file(
    project,
    'openapi.json',
    JSON.stringify({
      paths: {
        '/tickets': {
          get: { operationId: 'listTickets' },
          post: { operationId: 'createTicket' },
        },
        '/tickets/{id}': { delete: { operationId: 'removeTicket' } },
      },
    })
  );
  const report = await discoverHarnessProject(project);
  assert.equal(report.strategy, 'service-host-adapter');
  assert.deepEqual(
    report.candidates.map((item) => item.permissionHint),
    ['read', 'write', 'destructive']
  );
  assert.ok(report.sourceFiles.includes('server.go'));
  await file(
    project,
    'package.json',
    JSON.stringify({ dependencies: { react: '^19' } })
  );
  assert.equal(
    (await discoverHarnessProject(project)).strategy,
    'react-host-adapter'
  );
  await file(
    project,
    'package.json',
    JSON.stringify({ dependencies: { next: '^16', react: '^19' } })
  );
  await file(
    project,
    'src/app/layout.tsx',
    'export default function Layout() {}'
  );
  assert.equal(
    (await discoverHarnessProject(project)).strategy,
    'next-app-router'
  );
});

test('discovery reports skipped links, invalid manifests, oversized files and limits', async (t) => {
  const { temporary, project } = await fixture(t);
  await file(temporary, 'outside.ts', 'export function readPrivate() {}');
  await symlink(
    path.join(temporary, 'outside.ts'),
    path.join(project, 'linked.ts')
  );
  await file(project, 'package.json', '{broken');
  await file(project, 'large.ts', 'x'.repeat(1024));
  await file(project, '.env.local', 'PRIVATE=not-for-discovery');
  await file(
    project,
    'node_modules/vendor/api.ts',
    'export function readVendor() {}'
  );
  const report = await discoverHarnessProject(project, { maxFileBytes: 256 });
  assert.equal(report.candidates.length, 0);
  assert.ok(
    report.discovery.warnings.some((item) => item.reason === 'symlink-skipped')
  );
  assert.ok(
    report.discovery.warnings.some((item) => item.reason === 'invalid-json')
  );
  assert.ok(
    report.discovery.warnings.some(
      (item) => item.reason === 'file-unavailable-or-too-large'
    )
  );
  assert.ok(!report.sourceFiles.some((item) => item.includes('node_modules')));
  assert.equal(
    (await discoverHarnessProject(project, { maxFiles: 1 })).discovery
      .truncated,
    true
  );
});
