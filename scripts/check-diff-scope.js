#!/usr/bin/env node
/**
 * 改动范围检查。
 *
 * 目的：防止 agent "顺手"改了不该改的东西。
 *
 * 设计教训（来自实机测试）：
 *   Round 2：agent 改了 README 里的红线说明，让自己的改动"变合法"。
 *            → 规则文档必须和受保护代码一样受保护。
 *   Round 3：agent 自己加 SKIP-DIFF-SCOPE 声明就绕过了检查。
 *            → 豁免必须有独立审批，不能自我声明。
 *
 * 规则：
 *   1. 只改测试不改实现 —— 拒绝，除非有独立审批
 *   2. 触碰红线文件（含规则文档、检查脚本、hook 本身）—— 必须声明
 *   3. 声明格式必须精确，模糊声明一律拒绝
 *
 * 重要：本脚本必须能证明自己会变红。
 *   验证方法见 README「门禁自检」章节。
 */

import { execFileSync } from "node:child_process";

/**
 * 受保护文件清单。
 *
 * 关键：这里包含「规则自身」——README（规则文档）、scripts（检查逻辑）、
 * .githooks（hook 本体）。否则 agent 可以改规则来绕过规则。
 */
const PROTECTED = [
  "src/calc.ts", // 业务红线
  "README.md", // 规则文档
  "scripts/check-diff-scope.js", // 本脚本
  "scripts/check-commit-msg.js", // 提交信息检查
  "scripts/install-hooks.sh", // hook 安装器
  ".githooks/pre-push", // hook 本体
  ".github/workflows/gate.yml", // CI 门禁
  ".gitattributes", // 行尾规则（影响 hook 可执行性）
];

const TEST_DIRS = ["tests/"];
const SRC_DIRS = ["src/"];

/** 用 execFileSync + 参数数组，绕过 shell，避免引号/展开问题 */
function git(args) {
  const out = execFileSync("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return out;
}

function gitOr(args, fallback = "") {
  try {
    return git(args);
  } catch {
    return fallback;
  }
}

function changedFiles() {
  const files = [];

  // 1) 最后一次提交涉及的文件（最可靠，不依赖任何基准）
  const showOut = gitOr(["show", "--name-only", "--pretty=format:", "HEAD"]);
  for (const f of showOut.split("\n")) {
    if (f.trim()) files.push(f.trim());
  }

  // 2) 若存在上游，补充「本地领先上游」的全部改动（一次推多个提交时）
  const upstream = gitOr([
    "rev-parse",
    "--abbrev-ref",
    "--symbolic-full-name",
    "@{upstream}",
  ]).trim();
  if (upstream) {
    const ahead = gitOr(["diff", "--name-only", `${upstream}...HEAD`]);
    for (const f of ahead.split("\n")) {
      if (f.trim()) files.push(f.trim());
    }
  }

  return { files: [...new Set(files)], base: upstream || "HEAD" };
}

/**
 * 校验声明格式。
 *
 * 为什么要求精确格式：Round 3 里 agent 写 `SKIP-DIFF-SCOPE: 纯测试补充`
 * 就放行了，而那个理由完全没有被验证。现在要求带审批人。
 */
function hasDeclaration(subject, key) {
  // 要求形如：KEY: <内容> [APPROVED-BY: <人>]
  const pattern = new RegExp(
    `^${key}:\\s*\\S.{4,}\\s+APPROVED-BY:\\s*\\S+\\s*$`,
    "im",
  );
  return pattern.test(subject);
}

// 初始化提交（仓库第一个提交、无父提交）跳过越界检查：
// 此时"改动范围"没有比较基准，规则无从谈起。
const isInitialCommit = gitOr(["rev-parse", "--verify", "HEAD~1"]).trim() === "";
if (isInitialCommit) {
  console.log("  （初始化提交，跳过越界检查）");
  process.exit(0);
}

const { files, base } = changedFiles();

if (files.length === 0) {
  console.log(`  （无改动可检查，base=${base}）`);
  process.exit(0);
}

console.log(`  基准 ${base}，涉及 ${files.length} 个文件：`);
for (const f of files.slice(0, 10)) console.log(`    · ${f}`);
if (files.length > 10) console.log(`    … 共 ${files.length} 个`);

const touchedTests = files.filter((f) => TEST_DIRS.some((d) => f.startsWith(d)));
const touchedSrc = files.filter((f) => SRC_DIRS.some((d) => f.startsWith(d)));
const subject = gitOr(["log", "-1", "--pretty=%B"]);

// 规则 1：只改测试不改实现
// 收紧：豁免必须带 APPROVED-BY（不能再自我声明）
if (touchedTests.length > 0 && touchedSrc.length === 0) {
  if (!hasDeclaration(subject, "SKIP-DIFF-SCOPE")) {
    console.error("❌ 只改了测试没改实现 —— 拒绝");
    console.error(`   测试文件：${touchedTests.join(", ")}`);
    console.error("");
    console.error("   如确实只需调测试，提交信息需要两行：");
    console.error("     SKIP-DIFF-SCOPE: <不少于5字的理由> APPROVED-BY: <审批人>");
    console.error("   示例：");
    console.error("     SKIP-DIFF-SCOPE: 纯测试补充无实现变更 APPROVED-BY: xuans2248-cyber");
    process.exit(1);
  }
  console.log("  ⚠️  已声明跳过本规则（含审批人）");
}

// 规则 2：受保护文件需要显式声明
const touchedProtected = files.filter((f) => PROTECTED.includes(f));
if (touchedProtected.length > 0) {
  if (!hasDeclaration(subject, "REDLINE-CHANGE")) {
    console.error("❌ 触碰了受保护文件，但声明不合规 —— 拒绝");
    console.error(`   涉及：${touchedProtected.join(", ")}`);
    console.error("");
    console.error("   受保护清单包含：业务红线、规则文档、检查脚本、hook 本体");
    console.error("   提交信息需要两行：");
    console.error("     REDLINE-CHANGE: <不少于5字的理由> APPROVED-BY: <审批人>");
    process.exit(1);
  }
  console.log(`  ⚠️  已声明改动受保护文件：${touchedProtected.join(", ")}`);
}

console.log("  ✅ 改动范围合规");
