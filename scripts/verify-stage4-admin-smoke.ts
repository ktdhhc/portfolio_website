/**
 * Stage 4 Admin Smoke 验证脚本
 *
 * 覆盖 admin 面板核心 seam：
 * 1. /api/admin/auth 正确/错误/限频三种响应
 * 2. /api/admin/stats/overview 返回 6 张 stat 卡数据结构
 * 3. /api/admin/stats/issues 返回 degraded/failed + D1 降级拼接
 * 4. /api/admin/logs 分页 + 字段集
 * 5. DELETE /api/admin/logs 单条/范围/全清三种路径
 * 6. GET /api/admin/logs/export CSV + JSON 两种格式
 * 7. /api/admin/stats/agent-config 返回 runtime + startupContext + tools
 * 8. D1 不可用时 stats 端点返回 db_unavailable
 *
 * 使用 fake store，不依赖真实 D1。
 */

import { onRequestPost as adminAuth } from '../functions/api/admin/auth';
import { onRequestGet as adminOverview } from '../functions/api/admin/stats/overview';
import { onRequestGet as adminIssues } from '../functions/api/admin/stats/issues';
import { onRequestGet as adminAgentConfig } from '../functions/api/admin/stats/agent-config';
import { onRequestGet as adminLogs, onRequestDelete as adminLogsDelete } from '../functions/api/admin/logs';
import { onRequestGet as adminLogsExport } from '../functions/api/admin/logs-export';
import { FakeAgentTurnStore, FakeBehaviorEventStore, FakeRateLimitStore } from '../functions/api/_store/fake';
import type { AgentTurnRecord } from '../functions/api/_store/types';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string): void {
  if (condition) {
    passed++;
    console.log(`  ✅ ${message}`);
  } else {
    failed++;
    console.error(`  ❌ ${message}`);
  }
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  assert(actual === expected, `${message} (got: ${JSON.stringify(actual)}, expected: ${JSON.stringify(expected)})`);
}

function makeContext(handler: Function, url: string, method = 'GET', body?: unknown, env?: Record<string, unknown>) {
  const request = new Request(url, {
    method,
    headers: {
      'Authorization': 'Bearer test-token',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { request, env: env ?? {} } as never;
}

async function json(res: Response) {
  return res.json();
}

function makeTurn(overrides: Partial<AgentTurnRecord> = {}): AgentTurnRecord {
  return {
    visitorUuid: 'test-uuid-001',
    agentSessionId: 'test-session-001',
    turnType: 'chat',
    userMessage: 'test question',
    assistantAnswer: 'test answer',
    answerStatus: 'success',
    durationMs: 1000,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function minutesAgoIso(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

async function run(): Promise<void> {
  console.log('\n🔍 Stage 4 Admin Smoke 验证\n');

  // ─── 1. Auth ───
  console.log('1. Auth 端点');
  {
    const rateLimitStore = new FakeRateLimitStore();
    const env = { ADMIN_TOKEN: 'test-token', RATE_LIMIT_STORE: rateLimitStore };

    // 正确 token
    const resOk = await adminAuth(makeContext(adminAuth, 'http://localhost/api/admin/auth', 'POST', { token: 'test-token' }, env));
    const dataOk = await json(resOk);
    assertEqual(dataOk.ok, true, '正确 token 返回 ok: true');

    // 错误 token
    const resBad = await adminAuth(makeContext(adminAuth, 'http://localhost/api/admin/auth', 'POST', { token: 'wrong' }, env));
    const dataBad = await json(resBad);
    assertEqual(dataBad.ok, false, '错误 token 返回 ok: false');
    assertEqual(dataBad.reason, 'invalid', '错误 token 返回 reason: invalid');

    // 限频
    for (let i = 0; i < 5; i++) {
      await adminAuth(makeContext(adminAuth, 'http://localhost/api/admin/auth', 'POST', { token: 'wrong' }, env));
    }
    const resLimited = await adminAuth(makeContext(adminAuth, 'http://localhost/api/admin/auth', 'POST', { token: 'wrong' }, env));
    const dataLimited = await json(resLimited);
    assertEqual(dataLimited.ok, false, '限频后返回 ok: false');
    assertEqual(dataLimited.reason, 'rate_limited', '限频后返回 reason: rate_limited');
  }

  // ─── 2. Stats Overview ───
  console.log('\n2. Stats Overview 端点');
  {
    const eventStore = new FakeBehaviorEventStore();
    const turnStore = new FakeAgentTurnStore();
    const rateLimitStore = new FakeRateLimitStore();
    const env = { BEHAVIOR_EVENT_STORE: eventStore, AGENT_TURN_STORE: turnStore, RATE_LIMIT_STORE: rateLimitStore };

    // 插入测试数据
    eventStore.records.push(
      { visitorUuid: 'v1', eventType: 'page_view', path: '/', createdAt: new Date().toISOString() },
      { visitorUuid: 'v2', eventType: 'pdf_download', createdAt: new Date().toISOString() },
    );
    turnStore.records.push(
      makeTurn({ answerStatus: 'success' }),
      makeTurn({ answerStatus: 'degraded' }),
    );

    const res = await adminOverview(makeContext(adminOverview, 'http://localhost/api/admin/stats/overview?period=week', 'GET', undefined, env));
    const data = await json(res);
    assertEqual(data.ok, true, 'overview 返回 ok: true');
    assert(typeof data.data.metrics.pageViews === 'object', 'overview 包含 pageViews 指标');
    assert(typeof data.data.metrics.pdfDownloads === 'object', 'overview 包含 pdfDownloads 指标');
    assert(typeof data.data.metrics.agentTurns === 'object', 'overview 包含 agentTurns 指标');
    assert(typeof data.data.metrics.jdAnalyses === 'object', 'overview 包含 jdAnalyses 指标');
    assert(typeof data.data.metrics.avgPageDurationMs === 'object', 'overview 包含 avgPageDurationMs 指标');
    assert(typeof data.data.metrics.agentFailures === 'object', 'overview 包含 agentFailures 指标');
    assert(typeof data.data.metrics.pageViews.current === 'number', '指标包含 current 数值');
    assert(typeof data.data.metrics.pageViews.previous === 'number', '指标包含 previous 数值');
  }

  // ─── 3. Stats Issues ───
  console.log('\n3. Stats Issues 端点');
  {
    const turnStore = new FakeAgentTurnStore();
    const inWindowTime = new Date().toISOString();
    turnStore.records.push(
      makeTurn({ answerStatus: 'degraded', createdAt: inWindowTime }),
      makeTurn({ answerStatus: 'degraded', createdAt: inWindowTime }),
      makeTurn({ answerStatus: 'failed', createdAt: inWindowTime }),
      makeTurn({ answerStatus: 'success', createdAt: inWindowTime }),
    );
    const env = { AGENT_TURN_STORE: turnStore, BEHAVIOR_EVENT_STORE: new FakeBehaviorEventStore() };

    const res = await adminIssues(makeContext(adminIssues, 'http://localhost/api/admin/stats/issues?period=week', 'GET', undefined, env));
    const data = await json(res);
    assertEqual(data.ok, true, 'issues 返回 ok: true');
    assert(Array.isArray(data.data.items), 'issues 包含 items 数组');
    const degradedItem = data.data.items.find((item: { kind: string }) => item.kind === 'degraded');
    const failedItem = data.data.items.find((item: { kind: string }) => item.kind === 'failed');
    const d1Item = data.data.items.find((item: { kind: string }) => item.kind === 'd1_write_failure');
    assertEqual(degradedItem?.count, 2, 'issues degraded 计数正确');
    assertEqual(failedItem?.count, 1, 'issues failed 计数正确');
    assert(typeof d1Item?.count === 'number', 'issues 包含 d1_write_failure');
  }

  // ─── 4. Logs 分页 + 字段集 ───
  console.log('\n4. Logs 分页 + 字段集');
  {
    const turnStore = new FakeAgentTurnStore();
    for (let i = 0; i < 25; i++) {
      turnStore.records.push(makeTurn({ id: String(i + 1), createdAt: minutesAgoIso(i) }));
    }
    const env = { AGENT_TURN_STORE: turnStore };

    // 列表（使用相对当前时间的记录，确保命中 today 窗口）
    const resList = await adminLogs(makeContext(adminLogs, 'http://localhost/api/admin/logs?period=today&page=1&pageSize=10', 'GET', undefined, env));
    const dataList = await json(resList);
    assertEqual(dataList.ok, true, 'logs 列表返回 ok: true');
    assert(dataList.data.items.length <= 10, 'logs 列表每页不超过 10 条');
    assert(dataList.data.total >= 1, 'logs total >= 1');
    assert(dataList.data.totalPages >= 1, 'logs totalPages >= 1');

    // 字段集
    const item = dataList.data.items[0];
    assert(typeof item.id === 'string', '列表项包含 id');
    assert(typeof item.createdAt === 'string', '列表项包含 createdAt');
    assert(typeof item.userMessage === 'string', '列表项包含 userMessage');
    assert(typeof item.turnType === 'string', '列表项包含 turnType');
    assert(typeof item.answerStatus === 'string', '列表项包含 answerStatus');
    assert(item.assistantAnswer === undefined, '列表项不包含 assistantAnswer');

    // 详情
    const resDetail = await adminLogs(makeContext(adminLogs, `http://localhost/api/admin/logs?period=today&id=${dataList.data.items[0].id}`, 'GET', undefined, env));
    const dataDetail = await json(resDetail);
    assertEqual(dataDetail.ok, true, 'logs 详情返回 ok: true');
    assert(typeof dataDetail.data.item.assistantAnswer === 'string', '详情包含 assistantAnswer');
    assert(typeof dataDetail.data.item.durationMs === 'number', '详情包含 durationMs');
    assert(typeof dataDetail.data.item.toolTraceSummary === 'object', '详情包含 toolTraceSummary');
    assert(typeof dataDetail.data.item.visitorUuidShort === 'string', '详情包含 visitorUuidShort');
    assert(typeof dataDetail.data.item.agentSessionIdShort === 'string', '详情包含 agentSessionIdShort');
  }

  // ─── 5. DELETE 三种路径 ───
  console.log('\n5. DELETE 三种路径');
  {
    const turnStore = new FakeAgentTurnStore();
    for (let i = 0; i < 5; i++) {
      turnStore.records.push(makeTurn({ id: String(i + 1), createdAt: '2026-06-28T10:00:00.000Z' }));
    }
    const env = { AGENT_TURN_STORE: turnStore };

    // 单条删除
    const resSingle = await adminLogsDelete(makeContext(adminLogsDelete, 'http://localhost/api/admin/logs?id=1', 'DELETE', undefined, env));
    const dataSingle = await json(resSingle);
    assertEqual(dataSingle.ok, true, '单条删除返回 ok: true');
    assertEqual(dataSingle.deleted, 1, '单条删除返回 deleted: 1');

    // 范围删除
    const resRange = await adminLogsDelete(makeContext(adminLogsDelete, 'http://localhost/api/admin/logs?rangeStart=2026-06-28T00:00:00.000Z&rangeEnd=2026-06-29T00:00:00.000Z', 'DELETE', undefined, env));
    const dataRange = await json(resRange);
    assertEqual(dataRange.ok, true, '范围删除返回 ok: true');
    assert(dataRange.deleted >= 1, '范围删除返回 deleted >= 1');

    // 全清
    const turnStore2 = new FakeAgentTurnStore();
    turnStore2.records.push(makeTurn({ id: 'a' }), makeTurn({ id: 'b' }));
    const env2 = { AGENT_TURN_STORE: turnStore2 };

    const resAll = await adminLogsDelete(makeContext(adminLogsDelete, 'http://localhost/api/admin/logs?all=true&confirm=DELETE', 'DELETE', undefined, env2));
    const dataAll = await json(resAll);
    assertEqual(dataAll.ok, true, '全清返回 ok: true');
    assertEqual(dataAll.deleted, 2, '全清返回 deleted: 2');

    // 全清缺 confirm
    const turnStore3 = new FakeAgentTurnStore();
    turnStore3.records.push(makeTurn({ id: 'a' }));
    const env3 = { AGENT_TURN_STORE: turnStore3 };

    const resNoConfirm = await adminLogsDelete(makeContext(adminLogsDelete, 'http://localhost/api/admin/logs?all=true', 'DELETE', undefined, env3));
    const dataNoConfirm = await json(resNoConfirm);
    assertEqual(dataNoConfirm.ok, false, '全清缺 confirm 返回 ok: false');
    assertEqual(dataNoConfirm.reason, 'confirm_required', '全清缺 confirm 返回 reason: confirm_required');
  }

  // ─── 6. Export CSV + JSON ───
  console.log('\n6. Export CSV + JSON');
  {
    const turnStore = new FakeAgentTurnStore();
    turnStore.records.push(makeTurn({
      id: 'exp-1',
      userMessage: '测试问题',
      assistantAnswer: '测试回答',
      visitorUuid: 'uuid-12345678-abcd',
      agentSessionId: 'sess-12345678-abcd',
      createdAt: new Date().toISOString(),
    }));
    const env = { AGENT_TURN_STORE: turnStore };

    // JSON（用 all 避免把 smoke 和自然周窗口耦合；窗口过滤已由专门测试覆盖）
    const resJson = await adminLogsExport(makeContext(adminLogsExport, 'http://localhost/api/admin/logs/export?format=json&period=all', 'GET', undefined, env));
    assert(resJson.headers.get('Content-Type') === 'application/json', 'JSON 导出 Content-Type 正确');
    const jsonData = await resJson.json();
    assert(jsonData.length >= 1, 'JSON 导出返回数据');
    assert(typeof jsonData[0].id === 'string', 'JSON 导出包含 id');

    // CSV
    const resCsv = await adminLogsExport(makeContext(adminLogsExport, 'http://localhost/api/admin/logs/export?format=csv&period=all', 'GET', undefined, env));
    assert(resCsv.headers.get('Content-Type')?.includes('text/csv'), 'CSV 导出 Content-Type 正确');
    assert(resCsv.headers.get('Content-Disposition')?.includes('attachment'), 'CSV 导出 Content-Disposition 正确');
    const csvText = await resCsv.text();
    assert(csvText.startsWith('id,created_at,turn_type,'), 'CSV 以 10 列头开始');
  }

  // ─── 7. Agent Config ───
  console.log('\n7. Agent Config 端点');
  {
    const env = {};

    const res = await adminAgentConfig(makeContext(adminAgentConfig, 'http://localhost/api/admin/stats/agent-config', 'GET', undefined, env));
    const data = await json(res);
    assertEqual(data.ok, true, 'agent-config 返回 ok: true');

    // runtime
    assert(typeof data.data.runtime.provider === 'string', 'runtime 包含 provider');
    assert(typeof data.data.runtime.toolLoopCap === 'number', 'runtime 包含 toolLoopCap');
    assertEqual(data.data.runtime.toolLoopCap, 5, 'toolLoopCap 为 5');
    // test provider 下 model 为 null
    assertEqual(data.data.runtime.model, null, 'test provider 下 model 为 null');

    // startup context
    assert(Array.isArray(data.data.startupContext.files), 'startupContext.files 为数组');
    assert(data.data.startupContext.files.length > 0, 'startupContext.files 非空');
    assert(data.data.startupContext.files.includes('resume.json'), 'startupContext.files 包含 resume.json');

    // tools
    assert(Array.isArray(data.data.tools), 'tools 为数组');
    assert(data.data.tools.includes('read_file'), 'tools 包含 read_file');

    // A3: 不暴露 API Key
    const jsonStr = JSON.stringify(data);
    assert(!jsonStr.includes('api_key') && !jsonStr.includes('API_KEY') && !jsonStr.includes('apiKey'), '返回值不包含 API Key');
  }

  // ─── 8. D1 不可用降级 ───
  console.log('\n7. D1 不可用降级');
  {
    const eventStore = new FakeBehaviorEventStore();
    const turnStore = new FakeAgentTurnStore();
    const rateLimitStore = new FakeRateLimitStore();
    eventStore.shouldFailList = true;
    turnStore.shouldFailList = true;
    const env = { BEHAVIOR_EVENT_STORE: eventStore, AGENT_TURN_STORE: turnStore, RATE_LIMIT_STORE: rateLimitStore };

    const resOverview = await adminOverview(makeContext(adminOverview, 'http://localhost/api/admin/stats/overview?period=week', 'GET', undefined, env));
    const dataOverview = await json(resOverview);
    assertEqual(dataOverview.ok, false, 'overview D1 不可用返回 ok: false');
    assertEqual(dataOverview.reason, 'db_unavailable', 'overview D1 不可用返回 db_unavailable');

    const resIssues = await adminIssues(makeContext(adminIssues, 'http://localhost/api/admin/stats/issues?period=week', 'GET', undefined, env));
    const dataIssues = await json(resIssues);
    assertEqual(dataIssues.ok, false, 'issues D1 不可用返回 ok: false');
    assertEqual(dataIssues.reason, 'db_unavailable', 'issues D1 不可用返回 db_unavailable');
  }

  // ─── 结果 ───
  console.log(`\n${'='.repeat(40)}`);
  console.log(`✅ Passed: ${passed}`);
  if (failed > 0) {
    console.error(`❌ Failed: ${failed}`);
    process.exit(1);
  } else {
    console.log('🎉 All smoke checks passed!');
  }
}

run().catch((error) => {
  console.error('Smoke verification crashed:', error);
  process.exit(1);
});
