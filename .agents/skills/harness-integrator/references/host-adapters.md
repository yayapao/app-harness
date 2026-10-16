# 宿主适配

## 源码边界

迁移包保留源仓库相对路径，在 source/ 下查找文件。manifest.json 提供分层目录、依赖参考和 SHA-256 清单。依赖参考供兼容性判断，不是要求整包安装；核心只使用服务端 TypeScript 与 Node API。

| 路径 | 用法 |
| --- | --- |
| `harness/core/` | Gateway、Orchestrator、Registry、权限、确认、缓存与事件，优先复用 |
| `harness/adapters/` | 模型与内存 Store，按已有提供者与存储适配 |
| `harness/browser/` | 运行配置、示例插件注册与 SSE，须替换白名单和宿主身份 |
| `templates/next/lib/harness/` | Next.js Cookie 身份和初始数据，按实际登录用户改造 |
| `templates/next/app/` | Next.js 对话、设置、Actions、SSE 和拦截路由参考 |
| `templates/next/components/harness/` | React 会话面板、消息流、确认与能力管理 |
| `templates/next/components/ui/` | UI 依赖闭环与 Cult UI 许可证，已有控件先合并 |
| `templates/next/components/harness/launcher.tsx` | 全局入口参考，合并到宿主工具栏 |
| 目标项目设置导航 | 将管理页链接并入已有设置系统 |
| 目标项目的全局样式与 `lib/utils.ts` | 样式 token 和基础类型参考，不整体替换宿主文件 |

原模板的工作台插件和浏览器内存身份仅为示例。默认 allowedTools 只有 get_time、list_notes、save_note，业务工具和 Agent 注册后必须显式更新权限策略。只复制插件不会让它自动获准执行。

## 按技术栈适配

| 目标                                      | 宿主方式                                                       | UI 方式                                                |
| ----------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------ |
| Next.js App Router                        | 合并 Actions、Route Handler、登录身份与服务端配置              | 复用对话组件、拦截路由和管理页                         |
| React + Node API，或 Next.js Pages Router | 用现有服务路由封装核心；前端请求替换 Server Actions            | 复用 React UI，用宿主 Router 和受控 Dialog             |
| Vue、Svelte 或其他 Web UI + Node          | 在现有 Node 服务接入核心                                       | 按原框架实现同等视图和流处理                           |
| Python、Go、Java 等后端                   | 由现有或新建 Node 适配服务运行核心，调用宿主授权业务接口       | 复用宿主 UI；经已鉴权的同源网关转发                    |
| 纯静态页面或无 Web UI 项目                | 需要服务端模型、身份和工具运行宿主；补充专用管理 UI 与服务入口 | 接入其已有管理页面；完全无宿主时记录并处理实际环境前提 |

discovery.strategy 是基于依赖与文件的建议，monorepo、SSR、自定义目录和部署平台须由 Agent 复核。非 Node 项目不要求迁移既有后端语言。选择 Node 适配服务时一并完成可运行的启动入口、依赖、宿主认证与部署配置；只放一份无法启动的 TypeScript 核心不算完成。

## 宿主接口

接口使用现有路径约定，至少提供这些语义：

| 操作                       | 必须保持的行为                                                  |
| -------------------------- | --------------------------------------------------------------- |
| 创建、列出、读取、删除会话 | 登录用户或明确的单用户边界；所有访问校验会话归属                |
| 发送消息流                 | 输入大小与格式校验、权限检查、SSE 类型化事件、AbortSignal、超时 |
| 确认工具                   | 验证会话与有效 confirmationId；确认操作不替代业务权限           |
| 停止运行                   | 只停止归属用户的运行，释放 pending confirmation                 |
| 读取、保存运行参数         | 管理权限、参数范围、持久化范围、下一次运行通过 loadConfig 读取  |
| 读取能力                   | 直接返回 Gateway.getCapabilities() 的投影                       |
| 读取记录                   | 按身份隔离，默认不记录模型和工具载荷                            |

Next.js 内页面直接调用服务端读取函数，写入优先 Server Actions；其他宿主采用自己的 API。修改当前 Next.js 代码前查目标安装版本的 node_modules/next/dist/docs/，不按模板版本强行升级目标。

模型密钥保持在服务端，复用目标项目现有模型配置来源。保留模型、轮数和输出上限的管理操作，UI 的保存结果和运行时的实际读取要对上。多进程部署的确认与运行状态需要共享存储或会话粘性，不能声称进程内 Map 已解决多实例问题。

## 界面接入

Next.js App Router 的全局入口参考 @harness/(.)harness，根 layout 接收插槽，default、首页和 catch-all 路由返回 null。有路由冲突或已有全局弹层时合并到现有模式。其他 Router 使用受控 Dialog，保留独立对话页和管理页路径。

对话模板以 ViewAI 为样式基准：紧凑工具栏、256px 桌面侧栏、低于 640px 的会话侧栏弹层、居中的消息与输入区、右侧用户气泡、自动增高输入框和单个等待提示。迁移时按目标组件体系保留这些行为；只在最后一条无正文的助手消息上显示等待动画，上翻历史后暂停滚动跟随。React 模板需合并 `sidebar.tsx`、新增 Harness props 类型及 Dialog 的 `layout="panel"`、`overlayClassName`，并检查窄屏、输入法、分层关闭和焦点恢复。

管理导航优先并入现有设置；无设置系统时生成最小共享导航。管理页展示运行参数和注册能力，Agent / 工具按 Skill 关系展示，权限与确认由注册代码投影。UI 不虚构 Agent、不将全部候选报告当成已注册能力。

合并 AnimatedIconButton、Halo 和 MorphPopover 时检查所有别名、基础控件、类型导出、CSS module、Provider 和许可证。非 Next.js React 需要替换 next/link、next/navigation 与 Actions 导入。表单错误、提交状态、确认弹层、Escape、焦点恢复、关闭中止消息流都应保留。
