# 来源

`core/`、`adapters/memory-store.ts`、`adapters/openai-model.ts` 及对应测试源自 [Niu](https://github.com/yayapao/niu) 的 browser harness。

参考版本：`f34c9adde729b251b5566bc4e9532c47ccf3bbd2`。本次从本地工作区复制通用核心，不包含股票插件、MySQL 适配器和 Niu 界面。

app-harness 在此基础上添加独立的浏览器宿主、演示模型、示例插件和 Next.js 集成。核心保持可替换的模型、存储、权限、缓存与事件接口。

输入器指令与多类型引用、门户 Prompt 校验及设计卡片提炼自 ViewAI 全局小助理的通用交互；本工具包通过宿主数据加载器、ContextProvider 和 PromptTarget 接入，不携带 ViewAI 的 OA、数据库或市场服务。

维护时从模板更新源码。已经由 CLI 生成的业务工程由使用者维护，重复执行集成命令不会覆盖。
