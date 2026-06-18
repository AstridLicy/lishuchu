/* ============================================================
   首页渲染 + 交互（无需修改，除非想调整功能）
   ============================================================ */
(function () {
  "use strict";
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  const a = SITE.author;

  /* —— 基本信息 —— */
  $$("[data-name]").forEach((el) => (el.textContent = a.name));
  setText("[data-title]", a.title);
  setText("[data-penname]", a.penName);
  setText("[data-tagline]", a.tagline);

  /* —— hero 主图 —— */
  const photo = $("[data-photo]");
  if (photo && a.photo) photo.style.backgroundImage = `url("${a.photo}")`;

  /* —— 作家介绍头像（无 portrait 时回退到 photo）—— */
  const portrait = $("[data-portrait]");
  const portraitSrc = a.portrait || a.photo;
  if (portrait && portraitSrc)
    portrait.style.backgroundImage = `url("${portraitSrc}")`;

  /* —— 一、作家介绍 —— */
  setText("[data-about-intro]", SITE.about.intro);
  const paras = $("[data-about-paragraphs]");
  if (paras) {
    (SITE.about.paragraphs || []).forEach((text) => {
      const p = document.createElement("p");
      p.textContent = text;
      paras.appendChild(p);
    });
  }

  /* —— 二、过往文章：标题列表（画外的文字入口）—— */
  const list = $("[data-article-list]");
  if (list) {
    (SITE.articles || []).forEach((art) => {
      const li = document.createElement("li");
      li.className = "feature__list-item";
      li.innerHTML =
        `<a href="article.html?id=${encodeURIComponent(art.id)}">` +
        `<span class="feature__list-spot">${esc(art.spot || "")}</span>` +
        `<span class="feature__list-title">${esc(art.title)}</span>` +
        `<span class="feature__list-meta">${esc(art.meta || "")}</span>` +
        `</a>`;
      list.appendChild(li);
    });
  }

  /* —— 三、座右铭 —— */
  const ml = $("[data-mottos]");
  if (ml) {
    (SITE.mottos || []).forEach((q) => {
      const div = document.createElement("blockquote");
      div.className = "motto reveal";
      div.textContent = q;
      ml.appendChild(div);
    });
  }

  /* —— 四、联系方式 —— */
  setText("[data-contact-note]", SITE.contact.note);
  const contactList = $("[data-contact-list]");
  if (contactList) {
    const c = SITE.contact;
    const rows = [];
    if (c.phone) rows.push({ label: "手机", value: c.phone, href: "tel:" + c.phone });
    if (c.wechat) rows.push({ label: "微信", value: c.wechat });
    if (c.email) rows.push({ label: "邮箱", value: c.email, href: "mailto:" + c.email });
    if (c.address) rows.push({ label: "地址", value: c.address });
    contactList.innerHTML = rows
      .map((r) => {
        const val = r.href
          ? `<a class="contact__value" href="${r.href}">${esc(r.value)}</a>`
          : `<span class="contact__value">${esc(r.value)}</span>`;
        return `<li class="contact__item"><span class="contact__label">${esc(r.label)}</span>${val}</li>`;
      })
      .join("");
  }

  const yr = $("#year");
  if (yr) yr.textContent = "2026";

  /* —— 导航滚动效果 —— */
  const nav = $("#nav");
  if (nav) {
    const onScroll = () => nav.classList.toggle("nav--scrolled", window.scrollY > 60);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  /* —— 滚动揭示动画 —— */
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          io.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
  );
  $$(".reveal").forEach((el) => io.observe(el));

  /* —— 工具 —— */
  function setText(sel, value) {
    const el = $(sel);
    if (!el) return;
    if (value) el.textContent = value;
    else el.style.display = "none";
  }
  function esc(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
})();
