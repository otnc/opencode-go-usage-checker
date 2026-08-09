// @ts-check
/**
 * Dumb renderer for the OpenCode Go usage panel.
 *
 * Every string is formatted on the extension host and arrives ready to print,
 * so this file only builds DOM. Nothing here uses innerHTML — all text goes in
 * via textContent, which keeps the strict CSP honest.
 */
(function () {
  const vscode = acquireVsCodeApi();
  const root = /** @type {HTMLElement} */ (document.getElementById("root"));

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) {
      node.className = className;
    }
    if (text !== undefined && text !== null) {
      node.textContent = text;
    }
    return node;
  }

  function button(label, className, messageType) {
    const node = el("button", className, label);
    node.addEventListener("click", () => vscode.postMessage({ type: messageType }));
    return node;
  }

  function renderMeter(meter) {
    const wrap = el("section", `meter ${meter.severity}`);

    const head = el("div", "meter-head");
    head.appendChild(el("span", "meter-label", meter.label));
    head.appendChild(el("span", "meter-percent", `${meter.percent}%`));
    wrap.appendChild(head);

    const track = el("div", "track");
    const fill = el("div", "fill");
    fill.style.width = `${Math.min(100, Math.max(0, meter.percent))}%`;
    track.appendChild(fill);
    wrap.appendChild(track);

    // The console reports no amounts, so a countdown is the only detail there
    // is — and a window that has not opened yet does not even have that.
    if (meter.countdown) {
      const detail = el("div", "meter-detail");
      detail.appendChild(el("span", null, meter.countdown));
      wrap.appendChild(detail);
    }

    return wrap;
  }

  /** First-run screen: what this needs, and the three places to get it. */
  function renderSetup(vm) {
    root.appendChild(el("h2", "setup-heading", vm.setup.heading));
    root.appendChild(el("p", "hint", vm.setup.hint));

    const steps = el("ol", "steps");
    vm.setup.steps.forEach((step) => steps.appendChild(el("li", null, step)));
    root.appendChild(steps);

    const actions = el("div", "actions");
    actions.appendChild(button(vm.setup.connect, null, "connectWorkspace"));
    actions.appendChild(button(vm.labels.openConsole, "secondary", "openConsole"));
    root.appendChild(actions);
  }

  function render(vm) {
    root.textContent = "";
    root.appendChild(el("h1", null, vm.title));

    if (vm.setup) {
      renderSetup(vm);
      return;
    }

    if (vm.meters.length === 0) {
      root.appendChild(
        el("p", vm.kind === "error" ? "notice" : "hint", vm.message || vm.labels.loading),
      );
      const actions = el("div", "actions");
      actions.appendChild(
        button(vm.kind === "error" ? vm.labels.retry : vm.labels.refresh, null, "refresh"),
      );
      actions.appendChild(button(vm.labels.openConsole, "secondary", "openConsole"));
      root.appendChild(actions);
      return;
    }

    if (vm.kind === "error" && vm.message) {
      const notice = el("p", "notice");
      notice.appendChild(el("div", null, vm.message));
      notice.appendChild(el("div", null, vm.labels.staleNotice));
      root.appendChild(notice);
    }

    const list = el("div", vm.stale ? "stale" : null);
    vm.meters.forEach((meter) => list.appendChild(renderMeter(meter)));
    root.appendChild(list);

    if (vm.footer.length > 0) {
      const footer = el("footer");
      vm.footer.forEach((line) => footer.appendChild(el("div", null, line)));
      root.appendChild(footer);
    }

    const actions = el("div", "actions");
    actions.appendChild(
      button(vm.kind === "error" ? vm.labels.retry : vm.labels.refresh, null, "refresh"),
    );
    actions.appendChild(button(vm.labels.openConsole, "secondary", "openConsole"));
    root.appendChild(actions);
  }

  window.addEventListener("message", (event) => {
    const message = event.data;
    if (message && message.type === "state") {
      render(message.payload);
    }
  });

  // The host may have posted before this script attached its listener.
  vscode.postMessage({ type: "ready" });
})();
