# 爷爷的作家个人网站

典雅文学风的个人网站。四大板块：**作家介绍 / 过往文章 / 座右铭 / 联系方式**。
其中「过往文章」是亮点——把一幅山水画用 AI 深度信息做成可旋转、缩放、拖动的
**3D 立体浮雕**，并在山、农民、小舟等位置埋入文章锚点，点击即可阅读全文。

## 📁 文件结构

```
grandfather-site/
├── index.html              ← 首页（左图右栏 + 四大板块）
├── gallery.html            ← 过往文章：3D 山水探索页
├── article.html            ← 文章全文页（?id=xxx）
├── scripts/
│   ├── data.js             ← 【所有内容都在这里改】
│   ├── main.js             ← 首页逻辑
│   ├── gallery.js          ← 3D 山水引擎（Three.js）
│   └── article.js          ← 文章页逻辑
├── styles/  (main.css, gallery.css)
├── assets/
│   ├── portrait/grandpa2.png   ← 爷爷写作照（首页主图）
│   ├── painting/painting.png   ← 山水画原图
│   └── depth/painting_depth.png← AI 生成的深度图
└── tools/gen_depth.py      ← 生成深度图的脚本
```

## ✏️ 如何修改内容（改 `scripts/data.js`）

- **作家介绍 / 座右铭 / 联系方式**：找到对应字段直接改文字。
- **文章**：在 `articles: [ ... ]` 里编辑。每篇文章包含：
  - `id`：唯一标识（英文/拼音，跳转用）
  - `spot`：对应画中的位置名（如「主峰」「田间农民」）
  - `anchor: { x, y }`：锚点在画面上的相对坐标，`x` 左0→右1，`y` 上0→下1
  - `title` / `meta` / `excerpt` / `body`（正文段落数组）
- **调整锚点位置**：改 `anchor.x` / `anchor.y` 即可，刷新 gallery.html 实时生效。

## 🔁 换山水画 / 重新生成深度图

1. 把新画放到 `assets/painting/painting.png`
2. 运行（首次已装好环境）：
   ```bash
   cd grandfather-site
   source .venv/bin/activate
   python tools/gen_depth.py assets/painting/painting.png assets/depth/painting_depth.png
   ```
3. 如需调立体强度，改 `scripts/gallery.js` 顶部的 `DISPLACE`（数值越大越立体）。

## 👀 本地预览

```bash
cd grandfather-site
python3 -m http.server 4321
# 浏览器打开 http://localhost:4321
```
（必须用服务器打开，直接双击 html 会因浏览器安全限制无法加载 3D 模块。）

## 🌐 发布到网上（免费）

推荐 **Netlify**：打开 https://app.netlify.com/drop ，把整个
`grandfather-site` 文件夹拖进去，几秒得到一个可分享网址。
（`.venv` 和 `tools` 不影响线上运行，可一并上传或忽略。）
