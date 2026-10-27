#!/usr/bin/env node
/**
 * 提交信息格式检查。
 *
 * 格式：<type>(<scope>): <subject>
 *   type ∈ feat|fix|test|refactor|docs|chore|perf|ci|build
 *   subject 非空，不超过 72 字符
 *
 * 为什么需要：提交信息是复盘 Loop 的唯一线索。
 * agent 提交"update"、"fix bug"这种，等于把复盘材料毁掉。
 */

import { execFileSync } from "node:child_process";

const ALLOWED_TYPES = [
  "feat",
  "fix",
  "test",
  "refactor",
  "revert",
  "docs",
  "chore",
  "perf",
  "ci",
  "build",
];

const PATTERN = new RegExp(
  `^(${ALLOWED_TYPES.join("|")})(\\([a-z0-9-]+\\))?: .{1,72}$`,
);

function lastCommits(n = 1) {
  try {
    // 只用 %s（subject 第一行），多行正文不参与格式校验
    return execFileSync("git", ["log", `-${n}`, "--pretty=%s"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    })
      .trim()
      .split("\n")
      .filter(Boolean);
  } catch {
    return [];
  }
}

// 检查本次推送涉及的最后一次提交
// 只取第一行标题做格式校验
const subjects = lastCommits(1);
if (subjects.length === 0) {
  console.log("  （无提交可检查）");
  process.exit(0);
}

const subject = subjects[0];
if (!PATTERN.test(subject)) {
  console.error("❌ 提交信息不合规：", JSON.stringify(subject));
  console.error(
    `   正确格式：<type>(<scope>): <subject>`,
  );
  console.error(`   type 可为：${ALLOWED_TYPES.join(" | ")}`);
  console.error(`   示例：feat(calc): add modulo with NaN on zero divisor`);
  process.exit(1);
}

console.log("  ✅ 提交信息合规");
