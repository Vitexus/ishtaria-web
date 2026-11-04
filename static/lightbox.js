// Click a screenshot to see it full screen. Without JavaScript the link opens the large picture itself.
(function () {
  var box = document.querySelector(".shots");
  if (!box) return;
  var links = Array.prototype.slice.call(box.querySelectorAll("a.zoom"));
  var overlay, image, caption, current = 0, opener = null;

  function build() {
    overlay = document.createElement("div");
    overlay.className = "lightbox";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.hidden = true;
    image = document.createElement("img");
    caption = document.createElement("p");
    var close = button("close", "×", box.dataset.close);
    var prev = button("prev", "‹", box.dataset.prev);
    var next = button("next", "›", box.dataset.next);
    close.addEventListener("click", hide);
    prev.addEventListener("click", function (e) { e.stopPropagation(); step(-1); });
    next.addEventListener("click", function (e) { e.stopPropagation(); step(1); });
    image.addEventListener("click", function (e) { e.stopPropagation(); });
    overlay.addEventListener("click", hide);
    [image, caption, close, prev, next].forEach(function (n) { overlay.appendChild(n); });
    document.body.appendChild(overlay);
  }

  function button(name, text, label) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "lb-" + name;
    b.textContent = text;
    b.setAttribute("aria-label", label || name);
    b.addEventListener("click", function (e) { e.stopPropagation(); });
    return b;
  }

  function show(index) {
    current = (index + links.length) % links.length;
    var link = links[current];
    image.src = link.href;
    image.alt = link.querySelector("img").alt;
    caption.textContent = image.alt;
  }

  function step(delta) { show(current + delta); }

  function open(index, from) {
    if (!overlay) build();
    opener = from;
    show(index);
    overlay.hidden = false;
    document.body.classList.add("lightbox-open");
    overlay.querySelector(".lb-close").focus();
  }

  function hide() {
    overlay.hidden = true;
    document.body.classList.remove("lightbox-open");
    if (opener) opener.focus();
  }

  links.forEach(function (link, i) {
    link.addEventListener("click", function (e) {
      if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
      e.preventDefault();
      open(i, link);
    });
  });

  document.addEventListener("keydown", function (e) {
    if (!overlay || overlay.hidden) return;
    if (e.key === "Escape") hide();
    else if (e.key === "ArrowLeft") step(-1);
    else if (e.key === "ArrowRight") step(1);
  });
})();
