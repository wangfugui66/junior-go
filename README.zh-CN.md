[English](README.md) | 中文

# junior-go

一套可移植的 Claude Code + Codex 闭环开发 harness：Claude Code 侧使用 `CLAUDE.md`、`.claude-plugin/`
和六个有权限边界的 sub-agent 定义；Codex 侧使用 `AGENTS.md`、`.codex-plugin/plugin.json` 和共享的编排
skill。它把"跟 agent 对话、祈祷它靠谱"变成一个有对抗评审、真实运行验证、外加人话版讲解和成长记录的
可复现系统。

## 这套东西是给谁用的

这套 loop 只面向一种读者：**用 AI coding agent 做真实项目的 junior engineer，想要的是自己在过程中变强，
而不是攒一堆"能跑但看不懂"的代码。**

这个前提决定了每一个设计选择：

- **护栏顶替你还没有的经验。** `adversarial-architect` 在写代码之前就先把方案证伪；`runtime-verifier`
  真的把结果跑起来验证，而不是让你凭一份 diff 就相信它。两者都不要求你已经会分辨"什么方案是烂的""什么
  改动是有问题的"——这正是它们存在的意义。
- **人工验收这一步永远不会被自动化掉。** tester 给出的 `PASS` 只代表"按方案实现完成"，不代表"你理解了
  改了什么"。loop 走到你面前的最后一步，永远是人的判断，不是某个 agent 的判断。
- **`junior-explainer` 存在的唯一理由，就是一份 `PASS` 判定加一份原始 diff，对一个还读不太懂代码的人来说
  是不够的。** 它把已经落地的改动翻译成大白话——一句话讲清目标、每个改动文件配一句理由、3-5 个最核心
  函数"以前 vs 现在"、哪些场景真的测过哪些没测、以及最值得你亲自看一眼的几处 diff——让"接受这次改动"
  变成一个真正理解后的决定，而不是盖个章。它还会提出一份 `memory/junior/` 成长记录的更新提案，让下一轮
  的讲解能接着这一轮讲，而不是每次会话都从零开始。
- **这套 loop 是设计来随着你变强而"变短"的。** 它是一个可以按需精简的模板，不是一条你永远要从头跑到尾
  的流水线（详见 `agents/LOOP.md` 里的 "Right-size it"）。如果你发现自己跑的阶段越来越少，那不是偷
  懒，是 loop 本来就该这样——因为原来要靠 agent 把关的地方，现在你自己的判断力已经够用了。这个变强的
  过程会被记录在 `memory/junior/growth-map.yaml` 里，不只是一种感觉。

## 仓库里有什么

- **`agents/*.md`** — 组成 loop 的六个全局 sub-agent，外加 `agents/LOOP.md`（操作手册）：六个角色怎么
  串联交接、让它成为"闭环"而不是"流水线"的反馈边、跨会话存活的记忆脊柱，以及什么时候该跑 0 个阶段、
  什么时候该跑全部 6 个。
- **`AGENTS.md`** — 给 Codex 看的仓库级指令：同时保留 Claude Code 和 Codex 两套入口，并明确哪些保证
  是特定 harness 才有的。
- **`.codex-plugin/plugin.json`** — Codex plugin 元数据，把共享的 `skills/` 暴露给 Codex。
- **`CLAUDE.md`** — 几条通用的个人偏好（主要是回复语言），跟 loop 本身无关。
- **`.claude-plugin/`** — Claude Code plugin 元数据和 marketplace 入口，用来安装六个注册过的 sub-agent
  以及共享 skills。
- **`settings.json`** — 个人的编辑器/模型/插件设置。这部分更像是 dotfile 而不是系统本身：不要直接照
  抄，挑你真正需要的部分合并（见下面的安装说明）。
- **`LOOP-STATE.md`（项目本地，这个仓库里没有）** — 由 loop 的 agent 在每个项目根目录自动创建的项目
  本地工作簿。所有 agent 启动时都会读 `## Pitfalls / gotchas`（踩过的坑）和 `## Decisions / rejected paths`
  （已经否决的设计），这样 loop 就不会踩同样的坑两次；`runtime-verifier` + `surgical-implementer` 发现有
  价值的项目级观察时会追加到这个文件里。详见 `agents/LOOP.md` 的"记忆脊柱"章节。建议把 `LOOP-STATE.md`
  加进 `.gitignore`——它是临时工作记录，不是真实代码库的一部分。
- **`memory/junior/`（项目本地，这个仓库里没有）** — 由 `junior-explainer` 独占的第二条、平行的记忆
  脊柱：记录 junior 操作者已经被讲解过什么、有什么证据、在前端/后端/数据库/测试/工作流各方向上的成长
  情况。它永远不会反向影响工程侧的 agent——只影响下一次讲解怎么写。完整 schema 见
  `agents/junior-explainer.md`；契约摘要见 `agents/LOOP.md` 的"Junior memory spine"一节。

## 六个角色

| 角色 | 文件 | 什么时候触发 | 能改源码吗？ |
|---|---|---|---|
| 调研证伪 / scout | `requirement-scout.md` | 有门槛 —— 只在需求本身新颖/从零开始/不确定时触发 | 否（只做调研） |
| 方案 / planner | `plan-author.md` | 任何非平凡任务开始时；或在被反对/失败后重新出方案 | 否（只读） |
| 对抗评审 / architect | `adversarial-architect.md` | 方案定了、代码还没写之前——负责证伪它 | 否（只读） |
| 执行 / implementer | `surgical-implementer.md` | 只在设计经过裁决之后 | **是** |
| 真跑验证 / tester | `runtime-verifier.md` | 实现落地之后——真的跑起来验证，PASS/FAIL/INCONCLUSIVE | 否（只能碰 scratch） |
| 讲解+成长记录 / junior-explainer | `junior-explainer.md` | tester PASS 之后、你做最终决定之前（可选，默认建议开启） | 否（只读） |

每个角色的 `tools:` frontmatter 才是真正生效的约束机制，不是一句建议——Claude Code 会在权限层直接
拦下没被授权的工具调用。这就是为什么 `plan-author`、`adversarial-architect`、`junior-explainer` 的
frontmatter 里根本没有 `Edit`/`Write`：它们是**物理上碰不到**源码，不是"被要求不要碰"。只有
`surgical-implementer` 能改。这条边界为什么重要到决定了整个仓库的结构，见下面的"为什么这不是一个
Skill"。

完整机制、loop 流程图、"这次到底要跑多少阶段"的判断表，以及记忆脊柱的约定，都在
[`agents/LOOP.md`](agents/LOOP.md) 里——正式跑第一个真实任务之前建议先读一遍。

## 为什么这不是一个 Skill

Claude Code 的 Skill 和 sub-agent 解决的是两类不同的问题，这个仓库刻意留在 sub-agent 这一侧。

Skill 本质上是加载进**当前**模型上下文的一段指令。它想让别的角色干活，走的也是同一个 Agent tool——
包括叫一个 `general-purpose` agent、把某个角色的指令文本塞进 prompt 里。这样能拿到一个干净的新上下文，
甚至能指定模型，但拿不到**硬性的工具边界**：`general-purpose` agent 默认权限是全开的，"不要调用
`Edit`"只是 prompt 里的一句请求，不是 harness 强制执行的规则。上下文一长、指令一drift、或者被注入
一句话，都有可能把它说动去用一个"本来只是被礼貌地要求不要用"的工具。

一个真正注册过的 sub-agent（`agents/*.md`，装进 `~/.claude/agents/`）的工具清单，是 Claude Code 自己
在权限层校验的，调用请求根本到不了模型那一层。`plan-author` 调不了 `Edit`——是权限层直接拒绝，跟
上下文里有什么、prompt 怎么写都没关系。这份 README 里每一句"planner/architect/reviewer 碰不了代码，
只有 implementer 能改"，背后靠的都是这个机制。把六个角色拼进一个 Skill，会在你换一种方式安装这个
项目的那一刻，悄悄把这条硬边界换成软边界。

所以这个仓库保持这个划分：`agents/` 扛着真正要紧的 maker/checker 保证，`skills/dev-loop-orchestrator`
只是一层很薄的**编排层**——教主模型什么时候该调用哪个已注册的 agent、怎么路由
PROCEED/REVISE/REJECT、PROCEED/REFRAME/KILL、PASS/FAIL/INCONCLUSIVE，它从不在自己内部重新实现某个
角色的行为。如果这一节你只记一句话：**走插件安装（见下文），不要手动复制 `agents/`，不要把六个角色
拼进一个 skill 文件**——这几件事任何一件做了，都会把一个机制层面的保证，悄悄换成一个祈祷层面的保证。

## 安装

### 能不能在 Codex 里用？

可以——这个仓库现在在原来的 Claude Code 入口旁边，补了 Codex 入口：

- **Codex 项目指令：** `AGENTS.md` 告诉 Codex 这个仓库要同时维护 Claude Code / Codex 两套入口，改动时
  不要用其中一套覆盖另一套。
- **Codex plugin 清单：** `.codex-plugin/plugin.json` 把共享的 `skills/` 暴露给 Codex plugin 机制。
- **共享 loop 资产：** `agents/`、`skills/`、`workflows/`、`memory/` 仍然是同一套源文件，不按平台 fork
  出两份。

最重要的注意点：Claude Code 和 Codex 的 sub-agent 注册机制不是完全同一个东西。在 Claude Code 里，
`agents/*.md` 通过 Claude Code plugin 安装后，会变成有硬权限边界的 sub-agent；但在 Codex 里，能直接
复用的是编排 skill 和仓库级指令，不能因为 Codex 能读到这些 Markdown 文件，就默认 Claude Code 的
`tools:` 权限边界也自动生效。如果你的 Codex 环境已经注册了同名 sub-agent，就使用它们；否则就把
`agents/*.md` 当作可移植的角色定义，并在主会话里显式保持 maker/checker 分离。

### 方式一 —— 作为 Claude Code Plugin 安装（推荐）

这个仓库自带一份 marketplace：仓库根目录下的 `.claude-plugin/marketplace.json`，里面唯一的 plugin 条目
指向 `./`（也就是仓库自己）。用这种方式安装，会把 `agents/` 和 `skills/` 一起装进去——不用手动复制
文件，也完全不会碰到下面方式二里说的"自我修改"拦截（原因见下文）。

**斜杠命令流程**（在 Claude Code 会话里）：

```
/plugin marketplace add wangfugui66/junior-go
/plugin install junior-go@junior-go
```

**或者走 `settings.json`**——把下面两段都加进去。这跟这台机器上安装 `andrej-karpathy-skills`
（来自 GitHub 仓库 `forrestchang/andrej-karpathy-skills`）的写法完全是同一个模式：

```json
{
  "enabledPlugins": {
    "junior-go@junior-go": true
  },
  "extraKnownMarketplaces": {
    "junior-go": {
      "source": {
        "source": "github",
        "repo": "wangfugui66/junior-go"
      }
    }
  }
}
```

两条路径都能让你拿到六个 agent 和 skills，全程不需要自己手写 `~/.claude/agents/`。

### 方式二 —— 手动复制（只剩 CLAUDE.md + settings.json）

`agents/` 和 `skills/` 现在都由上面的 plugin 安装覆盖了，不再需要手动复制——剩下要手动复制的只有两个
个人配置文件：

```powershell
git clone https://github.com/wangfugui66/junior-go.git
Copy-Item junior-go\CLAUDE.md "$env:USERPROFILE\.claude\CLAUDE.md"
# settings.json 建议手动合并，不要整体覆盖——这个文件本来就是"个人化、每台机器都不一样"的
```

（macOS/Linux 同理，把目标路径换成 `~/.claude/` 即可。）

**一个值得知道的坑：** Claude Code 自带的安全机制会把"写入 `~/.claude/CLAUDE.md` 和
`~/.claude/agents/`"识别为**自我修改**——也就是 agent 在改自己未来的全局行为/权限——即便你已经在对话里
明确批准了，它也可能自己拦下这个安装动作。以前手动复制 `agents/` 正是触发这个拦截的原因；方式一能完全
绕开它，因为动手写文件的是 plugin 管理器，而不是 agent 自己改自己的全局文件。这是故意设计成这样的，不是
bug：不应该允许 agent 靠自己一句话就给自己扩权。如果这个拦截出现在剩下的 `CLAUDE.md` 复制上，就在普通
终端里自己跑一遍，或者用 `/permissions` 提前放行。

## 快速上手

普通功能/修复：`plan-author` → 自己裁决 `adversarial-architect` 提出的异议 → `surgical-implementer` →
`runtime-verifier` → PASS 之后跑 `junior-explainer`（大白话讲解 + 一份你自己落盘的 `memory/junior/`
更新提案）→ 你自己做最终的 accept/reject 判断。如果连需求本身都还没想清楚，就从 `requirement-scout`
往前多起一步。如果只是一个没什么影响面的琐碎改动，直接改文件就行——完整的判断标准见 `agents/LOOP.md`
的 "Right-size it" 小节。
