// Schema validation tests - runs as plain Node script, no Playwright needed.
// These tests verify that `astro build` fails when frontmatter is invalid.
// Uses a temporary fixture file to avoid corrupting real content.
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import resumeJson from '../content/resume.json' with { type: 'json' };
import { resumeDataSchema } from '../src/data/resume';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const fixtureDir = `${projectRoot}/content/projects/__test-fixture__`;

let passed = 0;
let failed = 0;

function runBuild(): { status: number; output: string } {
  try {
    const output = execSync('npm run build 2>&1', {
      cwd: projectRoot,
      encoding: 'utf-8',
      timeout: 60000,
    });
    return { status: 0, output };
  } catch (e: any) {
    return { status: e.status ?? 1, output: (e.stdout ?? '') + (e.stderr ?? '') };
  }
}

function createFixture(frontmatter: string): void {
  mkdirSync(`${fixtureDir}`, { recursive: true });
  writeFileSync(
    `${fixtureDir}/index.md`,
    `---\n${frontmatter}\n---\n\n## 测试 fixture\n\n这是 schema 测试用的临时文件。\n`,
    'utf-8'
  );
}

function removeFixture(): void {
  if (existsSync(fixtureDir)) {
    rmSync(fixtureDir, { recursive: true, force: true });
  }
}

function test(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e: any) {
    console.log(`  ✗ ${name}`);
    console.log(`    ${e.message}`);
    failed++;
  }
}

function expectBuildToFail(name: string, frontmatter: string): void {
  test(name, () => {
    createFixture(frontmatter);
    try {
      const result = runBuild();
      if (result.status === 0) {
        throw new Error('Build should have failed but succeeded');
      }
    } finally {
      removeFixture();
    }
  });
}

function expectBuildToPass(name: string, frontmatter: string): void {
  test(name, () => {
    createFixture(frontmatter);
    try {
      const result = runBuild();
      if (result.status !== 0) {
        throw new Error(`Build should have succeeded but failed:\n${result.output}`);
      }
    } finally {
      removeFixture();
    }
  });
}

function expectResumeParseToFail(name: string, candidate: unknown): void {
  test(name, () => {
    const result = resumeDataSchema.safeParse(candidate);
    if (result.success) {
      throw new Error('Resume schema should have failed but succeeded');
    }
  });
}

console.log('Schema validation tests\n');

// T4: 缺 tagline 时 build 失败
expectBuildToFail(
  'T4: 缺 tagline 时 build 失败',
  `name: TestProject
type: personal
role: 测试
period: "2025.01"
tags: []`
);

// T5: type 非法时 build 失败
expectBuildToFail(
  'T5: type 非法时 build 失败',
  `name: TestProject
tagline: 测试
type: invalid_type
role: 测试
period: "2025.01"
tags: []`
);

// T6: type=internship 缺 company 时 build 失败
expectBuildToFail(
  'T6: type=internship 缺 company 时 build 失败',
  `name: TestProject
tagline: 测试
type: internship
role: 测试
period: "2025.01"
tags: []`
);

// T7: refs 缺 summary 时 build 失败（通过临时 refs 文件测试）
test('T7: refs 缺 summary 时 build 失败', () => {
  mkdirSync(`${fixtureDir}/refs`, { recursive: true });
  writeFileSync(
    `${fixtureDir}/refs/test.md`,
    '---\n---\n\n## 测试 ref\n\n无 summary 的 ref 文件。\n',
    'utf-8'
  );
  // 同时需要有效的 index.md 才能让 refs collection 加载
  writeFileSync(
    `${fixtureDir}/index.md`,
    `---\nname: TestProject\ntagline: 测试\ntype: personal\nrole: 测试\nperiod: "2025.01"\ntags: []\n---\n\n## 测试\n`,
    'utf-8'
  );
  try {
    const result = runBuild();
    if (result.status === 0) {
      throw new Error('Build should have failed but succeeded');
    }
  } finally {
    removeFixture();
  }
});

expectBuildToPass(
  'T8: links.paper 为合法 URL 时 build 通过',
  `name: TestProject
tagline: 测试
type: personal
role: 测试
period: "2025.01"
tags:
  - 测试
links:
  paper: https://arxiv.org/abs/2605.30058`
);

expectBuildToFail(
  'T9: links.paper 非法 URL 时 build 失败',
  `name: TestProject
tagline: 测试
type: personal
role: 测试
period: "2025.01"
tags:
  - 测试
links:
  paper: not-a-url`
);

expectResumeParseToFail('R1: skills.group 非法时 resume schema 校验失败', {
  ...resumeJson,
  skills: resumeJson.skills.map((skill, index) => (
    index === 0 ? { ...skill, group: 'invalid-group' } : skill
  )),
});

expectResumeParseToFail('R2: skills.group 缺失时 resume schema 校验失败', {
  ...resumeJson,
  skills: resumeJson.skills.map((skill, index) => {
    if (index !== 0) {
      return skill;
    }

    const { group, ...rest } = skill;
    return rest;
  }),
});

test('R3: 当前 resume.json 通过 resume schema 校验', () => {
  const result = resumeDataSchema.safeParse(resumeJson);
  if (!result.success) {
    throw new Error(`Expected current resume.json to pass schema validation: ${result.error.message}`);
  }
});

// Clean rebuild with valid content
removeFixture();
runBuild();

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
