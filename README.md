# paseo-gate-test

**用途：验证 Paseo 双机编排 + 门禁体系的隔离沙盒。**

这个项目不承载真实业务。它存在的唯一目的是回答一个问题：

> **当 agent 改坏了东西，门禁能不能真的拦住？**

如果拦不住，整套体系就是空的。

---

## 门禁的设计

### 五道闸

| # | 检查 | 强度 | 拦什么 |
|---|---|---|---|
| 1 | `tsc --noEmit` | 强 | 类型错误 |
| 2 | `eslint` | 强 | 规范问题、未使用变量 |
| 3 | `node --test` | **最强** | 行为回归（除零 NaN 红线） |
| 4 | `check-diff-scope.js` | 中 | 只改测试不改实现、私改红线文件 |
| 5 | `check-commit-msg.js` | 中 | 提交信息不可复盘 |

### 三层防线

```
① 本地 pre-push hook（本仓库 .githooks/pre-push）
       ↓ 可能被 --no-verify 绕过
② GitHub Branch Protection（必须 PR + 必须 checks 通过）
       ↓ 服务端强制，绕不过
③ CI（后续在 GitHub Actions 加）
```

**关键认知**：本地 hook 只防"粗心"，防不了"故意"。**真正的最强防线在 ②**。

---

## 红线：除零统一返回 NaN

`src/calc.ts` 的 `divide` 在除数为 0 时**返回 NaN**（与 `modulo` 保持一致）。
这是业务侧决定的验收锚点。

- 测试文件里有对应的断言
- 改动这个文件需要提交信息带 `REDLINE-CHANGE: <原因>`

**这不是形式主义**：agent 很容易"为了让测试过"偷偷把 `throw` 改成 `return NaN`。
红线 + 测试 + 越界检查三者叠加，让它没法悄悄做到。

---

## 用法

```bash
npm install
sh scripts/install-hooks.sh   # 装 hook

npm run gate                  # 手动跑完整门禁
```

### 验证门禁真的有效（必做）

**关键：必须破坏「红线本身」**，而不是随便破坏点什么。

```bash
# 破坏红线：让除零不再返回 NaN
# 注意 a/b 在 b=0 时返回 Infinity，不是 NaN —— 这正是要拦的
sed -i 's/  if (b === 0) {/  if (false) {/' src/calc.ts
npm run gate
# → 必须失败（测试会抓到 divide(1,0) 不是 NaN）。
#   如果它通过了，说明门禁是假的。
```

**为什么不能随便写个破坏？**

早期版本用 `s/return a \/ b;/return a + b;/`，它只会让 `10/2` 算错，
**根本没碰到除零逻辑** —— 脚本能变红，但红的地方不对，等于没测红线。

> **一个变红的地方不对的检查，和永远不会变红的检查一样没用。**

这条经验来自一次独立审查：执行 agent 改了红线后自作主张把自检脚本改成
「破坏普通除法」，审查 agent 指出「这完全丧失了证明红线的作用」。

**每一道闸都要用一个「已知答案为否」的输入验证过。**

---

## 目录

```
src/calc.ts              被测代码（含红线）
tests/calc.test.ts       锁住行为的测试
.githooks/pre-push       五道闸
scripts/check-diff-scope.js   越界检查
scripts/check-commit-msg.js   提交信息检查
scripts/install-hooks.sh      一键安装
```

---

## 后续（阶段 B）

- [ ] 建 GitHub private 仓库
- [ ] 开 Branch Protection（require PR + require status checks）
- [ ] 用 Paseo 派任务给 agent，观察它被门禁拦住后的反应
- [ ] 记录：agent 失败后是「自己修」还是「无视继续」
