#!/bin/sh
# 一键把 .githooks 装到当前仓库。
# 用法：sh scripts/install-hooks.sh

set -e

REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || echo ".")
cd "$REPO_ROOT"

echo "→ 设置 core.hooksPath 为 .githooks"
git config core.hooksPath .githooks

echo "→ 确保 hook 可执行"
chmod +x .githooks/pre-push 2>/dev/null || true

echo ""
echo "✅ 已安装。验证："
echo "   git config core.hooksPath"
echo "   → 应输出 .githooks"
echo ""
echo "⚠️  注意：agent 可以用 git push --no-verify 跳过本地 hook。"
echo "   所以服务端的 Branch Protection 是必需的，不是可选的。"
