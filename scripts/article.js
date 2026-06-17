/* 文章全文页：根据 ?id= 渲染对应文章 */
(function () {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);

  // 基本信息
  document.querySelectorAll("[data-name]").forEach(
    (el) => (el.textContent = SITE.author.name)
  );
  $("#year").textContent = "2026";

  const params = new URLSearchParams(location.search);
  const id = params.get("id");
  const art = (SITE.articles || []).find((a) => a.id === id);
  const root = $("#article");

  if (!art) {
    root.innerHTML =
      `<div class="article__inner"><p class="article__notfound">未找到这篇文章。</p>` +
      `<a class="article__back" href="gallery.html">← 回到山水</a></div>`;
    return;
  }

  document.title = `${art.title} — ${SITE.author.name}`;

  const bodyHtml = (art.body || [])
    .map((p) => `<p>${esc(p)}</p>`)
    .join("");

  root.innerHTML =
    `<article class="article__inner">` +
    `<p class="article__spot">${esc(art.spot || "")}</p>` +
    `<h1 class="article__title">${esc(art.title)}</h1>` +
    `<p class="article__meta">${esc(art.meta || "")}</p>` +
    (art.excerpt
      ? `<p class="article__excerpt">${esc(art.excerpt)}</p>`
      : "") +
    `<div class="article__seal" aria-hidden="true">印</div>` +
    `<div class="article__body">${bodyHtml}</div>` +
    `<div class="article__nav">` +
    `<a class="article__back" href="gallery.html">← 回到山水寻章</a>` +
    `<a class="article__back" href="index.html">回到首页</a>` +
    `</div>` +
    `</article>`;

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
})();
