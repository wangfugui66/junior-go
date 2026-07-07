[English](README.md) | 中文

# claude -harness

一套可移植的 Claude Code 全局配置：`CLAUDE.md` + `settings.json` + 一套**六个 agent 组成的闭环开发
流水线**（`agents/`），把"跟 agent 对话、祈祷它靠谱"变成一个有对抗评审、真实运行验证、外加人话版验收
简报的可复现系统。

## 这套东西是给谁用的

这套 harness 只面向一种读者：**用 Claude Code 做真实项目的 junior engineer，想要的是自己在过程中变强，
而不是攒一堆"能跑但看不懂"的代码。**

这个前提决定了每一个设计选择：

- **护栏顶替你还没有的经验。** `adversarial-architect` 在写代码之前就先把方案证伪；`runtime-verifier`
  真的把结果跑起来验证，而不是让你凭一份 diff 就相信它。两者都不要求你已经会分辨"什么方案是烂的""什么
  改动是有问题的"——这正是它们存在的意义。
- **人工验收这一步永远不会被自动化掉。** tester 给出的 `PASS` 只代表"按方案实现完成"，不代表"你理解了
  改了什么"。harness 走到你面前的最后一步，永远是人的判断，不是某个 agent 的判断。
- **`review-briefer` 存在的唯一理由，就是一份 `PASS` 判定加一份原始 diff，对一个还读不太懂代码的人来说
  是不够的。** 它把已经落地的改动翻译成大白话——一句话讲清目标、每个改动文件配一句理由、3-5 个最核心
  函数"以前 vs 现在"、哪些场景真的测过哪些没测、以及最值得你亲自看一眼的几处 diff——让"接受这次改动"
  变成一个真正理解后的决定，而不是盖个章。
- **这套 harness 是设计来随着你变强而"变短"的。** 它是一个可以按需精简的模板，不是一条你永远要从头跑到尾
  的流水线（详见 `agents/harness.md` 里的 "Right-size it"）。如果你发现自己跑的阶段越来越少，那不是偷
  懒，是 harness 本来就该这样——因为原来要靠 agent 把关的地方，现在你自己的判断力已经够用了。

## 仓库里有什么

- **`agents/*.md`** — 组成 harness 的六个全局 sub-agent，外加 `agents/harness.md`（操作手册）：六个角色怎么
  串联交接、让它成为"闭环"而不是"流水线"的反馈边、跨会话存活的记忆脊柱，以及什么时候该跑 0 个阶段、
  什么时候该跑全部 6 个。
- **`CLAUDE.md`** — 几条通用的个人偏好（主要是回复语言），跟 harness 本身无关。
- **`settings.json`** — 个人的编辑器/模型/插件设置。这部分更像是 dotfile 而不是系统本身：不要直接照
  抄，挑你真正需要的部分合并（见下面的安装说明）。

## 六个角色

| 角色 | 文件 | 什么时候触发 | 能改源码吗？ |
|---|---|---|---|
| 调研证伪 / scout | `requirement-scout.md` | 有门槛 —— 只在需求本身新颖/从零开始/不确定时触发 | 否（只做调研） |
| 方案 / planner | `plan-author.md` | 任何非平凡任务开始时；或在被反对/失败后重新出方案 | 否（只读） |
| 对抗评审 / architect | `adversarial-architect.md` | 方案定了、代码还没写之前——负责证伪它 | 否（只读） |
| 执行 / implementer | `surgical-implementer.md` | 只在设计经过裁决之后 | **是** |
| 真跑验证 / tester | `runtime-verifier.md` | 实现落地之后——真的跑起来验证，PASS/FAIL/INCONCLUSIVE | 否（只能碰 scratch） |
| 验收简报 / review-briefer | `review-briefer.md` | tester PASS 之后、你做最终决定之前（可选，默认建议开启） | 否（只读） |

完整机制、harness 流程图、"这次到底要跑多少阶段"的判断表，以及记忆脊柱的约定，都在
[`agents/harness.md`](agents/harness.md) 里——正式跑第一个真实任务之前建议先读一遍。

## 安装

```powershell
git clone https://github.com/wangfugui66/claude-harness-harness.git
Copy-Item claude-harness-harness\CLAUDE.md "$env:USERPROFILE\.claude\CLAUDE.md"
Copy-Item claude-harness-harness\agents "$env:USERPROFILE\.claude\agents" -Recurse
# settings.json 建议手动合并，不要整体覆盖——这个文件本来就是"个人化、每台机器都不一样"的
```

（macOS/Linux 同理，把目标路径换成 `~/.claude/` 即可。）

**一个值得知道的坑：** Claude Code 自带的安全机制会把"写入 `~/.claude/CLAUDE.md` 和
`~/.claude/agents/`"识别为**自我修改**——也就是 agent 在改自己未来的全局行为/权限——即便你已经在对话里
明确批准了，它也可能自己拦下这个安装动作。这是故意设计成这样的，不是 bug：不应该允许 agent 靠自己
一句话就给自己扩权。如果遇到这种拦截，就在普通终端里自己跑一遍复制命令，或者用 `/permissions` 提前
放行。

## 快速上手

普通功能/修复：`plan-author` → 自己裁决 `adversarial-architect` 提出的异议 → `surgical-implementer` →
`runtime-verifier` → PASS 之后跑 `review-briefer` → 你自己做最终的 accept/reject 判断。如果连需求本身
都还没想清楚，就从 `requirement-scout` 往前多起一步。如果只是一个没什么影响面的琐碎改动，直接改文件
就行——完整的判断标准见 `agents/harness.md`。
