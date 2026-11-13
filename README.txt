个人视频作品集

直接用浏览器打开“影像作品集.html”，与 10 个原视频放在同一个文件夹即可。
修改源码后运行 node build-standalone.cjs 可更新单文件网页。

在原来的“视频合集”文件夹内保留 film-portfolio 子文件夹及 10 个原视频。
双击 start.cmd，看到 Local: http://127.0.0.1:4317 后，在浏览器打开这个地址。
电脑需要安装 Node.js。本地播放服务不需要安装额外依赖。
也可以直接用浏览器打开 dist/index.html，页面会通过相对路径访问原视频。

短剧 / 系列短视频（4）
尼罗秘语：11月13日.mp4
灯火人家：19937_raw.MP4
霓裳之下：290_raw.MP4
提灯入梦：4674.MP4

TVC 广告（5）
紫境幽兰：3319.MP4
一抹锋芒：5477.MP4
月满大唐：11月13日 (1).mp4
一瞬醒神：5618.MP4
粽游山海：飞书20261113-231403.mp4

MV（1）
甜梦舞台：6536.MP4

点击封面即可播放；支持浏览器原生进度、音量、全屏控制；Esc 关闭播放器。
“下一部作品”会在同一个分类内切换，不跨分类。

云端版本

网站源码和封面部署到 Vercel，视频上传到 Mux。此源码包不包含原始视频，也不包含任何密钥。
上传管理页为 /manage.html，仅在受 Vercel Authentication 保护的 Preview 部署中开放。
选择原文件名或 dist/videos 下的英文文件名均可，上传页会检查名称和文件大小。
公开网站：https://yingji-portfolio-tan.vercel.app/
10 个作品已全部上传到 Mux 并转码完成；公开网站可访问，播放器已修复 Chrome 原生 HLS 兼容问题。

构建：Node.js 24，npm install，然后 npm run build。Vercel 输出目录为 dist。
构建时若存在 dist/videos 会主动停止，防止原视频被作为静态资源发布。请从本源码包建立干净的云端部署目录，不要删除本地原视频。
Vercel 集成提供 MUX_TOKEN_ID、MUX_TOKEN_SECRET；私有 Blob 提供 BLOB_READ_WRITE_TOKEN。
若集成凭据缺少 System Write 权限，请在同一 Mux 环境的 Signing Keys 设置中创建签名密钥，将 ID 和 base64 私钥分别保存为 Vercel 的 MUX_SIGNING_KEY、MUX_PRIVATE_KEY（Preview 和 Production），然后重新部署。不要把私钥发到聊天或放进源码。
UPLOAD_ENABLED=1 仅设置在 Preview。上传管理不应开放给公共访问者。
私有 Blob 只保存签名密钥、播放域名限制和上传记录；视频文件直接传到 Mux。
更换域名或 Preview 部署后，应在新的受保护上传页运行初始化，以创建对应的播放域名限制。

视频使用签名播放地址、20 分钟有效期和域名限制；不会创建公开播放 ID 或公开原始 MP4 下载地址。
这能降低直接下载和盗链的便利程度，但不能保证阻止录屏或专业工具保存可播放内容。

验证：npm test 已通过管理接口访问范围和播放签名检查；10 个作品已在公开网站逐个点播，确认播放进度前进且媒体就绪。分类内“下一部作品”和 MV 独立展示已验证。无签名的视频直链返回 Not Authorized。
源码仓库：https://github.com/heyuwen99-wq/yingji-portfolio
GitHub 仓库只应包含本源码包的文件，禁止提交原视频、.env 或任何 API 密钥。
