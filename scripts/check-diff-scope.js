#!/usr/bin/env node
/**
 * 改动范围检查。
 *
 * 目的：防止 agent "顺手"改了不该改的东西（比如把测试改了让测试通过）。
 *
 * 规则：
 *   1. 只改测试不改实现 —— 拒绝（防止用改测试来"通过"）
 *   2. 触碰红线文件但提交信息未声明 —— 拒绝
 *
 * 重要：本脚本必须能证明自己会变红。
 * 验证方法：只改 tests/ 下文件后提交，跑本脚本应当退出码 1。
 */

import { execFileSync } from "node:child_process";

const RED_LINE_FILES = ["src/calc.ts"];
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
if (touchedTests.length > 0 && touchedSrc.length === 0) {
  if (!/SKIP-DIFF-SCOPE:/i.test(subject)) {
    console.error("❌ 只改了测试没改实现 —— 拒绝");
    console.error(`   测试文件：${touchedTests.join(", ")}`);
    console.error("   如确实只需调测试，请在提交信息加 SKIP-DIFF-SCOPE: <原因>");
    process.exit(1);
  }
  console.log("  ⚠️  已声明跳过本规则");
}

// 规则 2：红线文件需要显式声明
const touchedRedLine = files.filter((f) => RED_LINE_FILES.includes(f));
if (touchedRedLine.length > 0) {
  if (!/REDLINE-CHANGE:/i.test(subject)) {
    console.error("❌ 触碰了红线文件，但提交信息里没有声明");
    console.error(`   涉及：${touchedRedLine.join(", ")}`);
    console.error("   需要提交信息包含：REDLINE-CHANGE: <原因>");
    process.exit(1);
  }
  console.log(`  ⚠️  已声明改动红线文件：${touchedRedLine.join(", ")}`);
}

console.log("  ✅ 改动范围合规");
