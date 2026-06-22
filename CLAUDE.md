# CLAUDE.md — 爷爷的作家个人网站

给 Claude Code 的项目说明。请遵守这里的约定。

## 这是什么

为用户的爷爷（一位中国作家，李树楚/散文家）制作的个人网站。
**风格：典雅文学风**（衬线字体、宣纸米白底、墨色正文、印章朱红点缀、留白、书卷气）。
**语言：中文。** 计划免费发布到网上（推荐 Netlify 拖拽上传）。

## 技术栈

纯静态网站，无构建步骤：HTML + CSS + 原生 JS。
3D 部分用 Three.js（v0.160，通过 CDN importmap 引入）。
深度图用本地开源模型 Depth-Anything-V2 生成（见 `tools/gen_depth.py` + `.venv`）。

## 页面结构（四大板块，各自独立成页）

- `index.html` — 首页/入口页：左图（爷爷写作照，完整不裁切 + 呼吸式缩放）右栏（姓名 + 四个入口）
- `about.html` — 壹 · 作家介绍
- `gallery.html` — 贰 · 过往文章【重点】：把山水画做成可旋转/缩放/平移的 3D 立体浮雕，
  画中埋文章锚点（点光点→浮出标题→点击进全文）。右上角「沉浸式/列表」切换。
- `motto.html` — 叁 · 座右铭
- `contact.html` — 肆 · 联系方式
- `article.html?id=xxx` — 文章全文页

每个非首页页面左上角是「← 返回」按钮（`.nav__back` / gallery 用 `.g-back`）。

## 内容怎么改

**所有内容都在 `scripts/data.js`**（一个 SITE 对象，含详细中文注释）：
作家信息、作家介绍、座右铭、联系方式、以及 `articles[]`。
每篇文章有 `id / spot / anchor:{x,y}（画面相对坐标0~1）/ title / meta / excerpt / body[]`。
改 `anchor.x/y` 即可移动画中光点位置。

> 当前 articles 里是 5 篇**占位示范**（主峰/田间农民/小舟/石拱桥/远山），
> 等用户提供真实文章后替换。

## 关键实现要点（避坑）

- 3D 位移必须用 **MeshStandardMaterial**（不能用 MeshBasicMaterial，它会静默忽略
  displacementMap），并配灯光。`scripts/gallery.js` 顶部 `DISPLACE` 控制立体强度。
- 深度图：亮=近、暗=远。重新生成：
  ```bash
  source .venv/bin/activate
  python tools/gen_depth.py assets/painting/painting2.png assets/depth/painting2_depth.png
  ```
- `gallery.css` 不引用 main.css，需自带 `a{color:inherit;text-decoration:none}` 等基础重置。

## 本地预览

```bash
python3 -m http.server 4321   # 然后打开 http://localhost:4321
```
（必须用服务器打开；直接双击 html 会因安全限制无法加载 3D 模块。）
本项目已自带 `.claude/launch.json`（名为 grandfather-site，端口 4321），可配合预览工具使用。

## 素材

- `assets/portrait/grandpa2.png` — 爷爷写作照（首页主图），1672×941
- `assets/painting/painting.png` — 山水画原图，1672×941
- `assets/depth/painting_depth.png` — AI 生成的深度图
