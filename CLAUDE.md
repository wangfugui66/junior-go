# 全局个人指令（对所有项目生效）

- 默认用**中文**回复我。但代码、命令、报错信息、标识符、变量/函数名、库名、专有名词一律保持原文，不要翻译。
- 若某个项目明确需要英文（团队或仓库约定），以该项目自己的 CLAUDE.md 为准——项目级指令覆盖本文件。
- 我是 junior engineer，正在通过 AI 协作逐步提升工程能力，不想只是"拿到能跑的代码"。因此：任何经过
  plan-author → surgical-implementer → runtime-verifier 走完、且 runtime-verifier 判定 PASS（或明确
  说明的 INCONCLUSIVE）的非平凡任务，在我做最终验收前，先调用 `review-briefer` agent
  （`~/.claude/agents/review-briefer.md`）生成一份面向看不懂代码的 junior engineer 的 Human Review
  Brief：一句话目标、改动文件清单及理由、3-5 个最核心函数/类的"以前 vs 现在"、测试覆盖的正常/边界/失败
  路径、最值得人工检查的 3-5 处 diff，全部用大白话讲，必要术语要现场解释。真正琐碎、没有 blast radius
  的一行改动可以跳过（详见 `~/.claude/agents/LOOP.md`）。
