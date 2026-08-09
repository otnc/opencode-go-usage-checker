// @ts-check
/**
 * Dumb renderer for the OpenCode Go usage panel.
 *
 * Every string is formatted on the extension host and arrives ready to print,
 * so this file only builds DOM. Nothing here uses innerHTML — all text goes in
 * via textContent, which keeps the strict CSP honest.
 */

/**
 * @typedef {Object} Meter
 * @property {string} kind
 * @property {string} label
 * @property {number} percent
 * @property {"ok" | "warn" | "critical"} severity
 * @property {string | null | undefined} countdown
 */

/**
 * @typedef {Object} SetupVm
 * @property {string} heading
 * @property {string} hint
 * @property {string[]} steps
 * @property {string} connect
 */

/**
 * @typedef {Object} Labels
 * @property {string} loading
 * @property {string} refresh
 * @property {string} retry
 * @property {string} openConsole
 * @property {string} staleNotice
 * @property {string} reconnect
 */

/**
 * @typedef {Object} OptionVm
 * @property {string} value
 * @property {string} label
 */

/**
 * @typedef {Object} SettingsVm
 * @property {string} title
 * @property {string} statusBarWindowLabel
 * @property {string} languageLabel
 * @property {OptionVm[]} meterOptions
 * @property {OptionVm[]} languageOptions
 * @property {string} currentMeter
 * @property {string} currentLanguage
 * @property {string} openSettingsLabel
 */

/**
 * @typedef {Object} ViewModel
 * @property {string} title
 * @property {"loading" | "ready" | "error" | "needsSetup"} kind
 * @property {string | null | undefined} message
 * @property {Meter[]} meters
 * @property {string[]} footer
 * @property {boolean} stale
 * @property {SetupVm | null | undefined} setup
 * @property {SettingsVm | null | undefined} settings
 * @property {Labels} labels
 */

(function () {
  // @ts-ignore — injected by VS Code into the webview at runtime
  const vscode = acquireVsCodeApi();
  const root = /** @type {HTMLElement} */ (document.getElementById("root"));

  /**
   * @param {keyof HTMLElementTagNameMap} tag
   * @param {string | null} [className]
   * @param {string | null} [text]
   * @returns {HTMLElement}
   */
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

  /**
   * @param {string} label
   * @param {string | null} className
   * @param {string} messageType
   * @returns {HTMLButtonElement}
   */
  function button(label, className, messageType) {
    const node = /** @type {HTMLButtonElement} */ (el("button", className, label));
    node.addEventListener("click", () => vscode.postMessage({ type: messageType }));
    return node;
  }

  /**
   * @param {OptionVm[]} options
   * @param {string} currentValue
   * @param {string} messageType
   * @returns {HTMLSelectElement}
   */
  function select(options, currentValue, messageType) {
    const node = /** @type {HTMLSelectElement} */ (el("select", "settings-select"));
    for (const opt of options) {
      const option = /** @type {HTMLOptionElement} */ (el("option", null, opt.label));
      option.value = opt.value;
      if (opt.value === currentValue) {
        option.selected = true;
      }
      node.appendChild(option);
    }
    node.addEventListener("change", () =>
      vscode.postMessage({ type: messageType, value: node.value }),
    );
    return node;
  }

  /**
   * @param {SettingsVm} settings
   * @param {Labels} labels
   * @returns {HTMLElement}
   */
  function renderSettings(settings, labels) {
    const section = el("section", "settings");

    section.appendChild(el("h2", "settings-title", settings.title));

    const meterRow = el("div", "settings-row");
    meterRow.appendChild(el("label", "settings-label", settings.statusBarWindowLabel));
    meterRow.appendChild(select(settings.meterOptions, settings.currentMeter, "selectMeter"));
    section.appendChild(meterRow);

    const langRow = el("div", "settings-row");
    langRow.appendChild(el("label", "settings-label", settings.languageLabel));
    langRow.appendChild(
      select(settings.languageOptions, settings.currentLanguage, "selectLanguage"),
    );
    section.appendChild(langRow);

    const actions = el("div", "actions");
    actions.appendChild(button(labels.reconnect, "secondary", "connectWorkspace"));
    actions.appendChild(button(settings.openSettingsLabel, "secondary", "openSettings"));
    section.appendChild(actions);

    return section;
  }

  /**
   * @param {Meter} meter
   * @returns {HTMLElement}
   */
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

  /**
   * First-run screen: what this needs, and the three places to get it.
   * @param {SetupVm} setup
   * @param {Labels} labels
   */
  function renderSetup(setup, labels) {
    root.appendChild(el("h2", "setup-heading", setup.heading));
    root.appendChild(el("p", "hint", setup.hint));

    const steps = el("ol", "steps");
    setup.steps.forEach((step) => steps.appendChild(el("li", null, step)));
    root.appendChild(steps);

    const actions = el("div", "actions");
    actions.appendChild(button(setup.connect, null, "connectWorkspace"));
    actions.appendChild(button(labels.openConsole, "secondary", "openConsole"));
    root.appendChild(actions);
  }

  /**
   * @param {ViewModel} vm
   */
  function render(vm) {
    root.textContent = "";
    root.appendChild(el("h1", null, vm.title));

    if (vm.setup) {
      renderSetup(vm.setup, vm.labels);
    } else if (vm.meters.length === 0) {
      root.appendChild(
        el("p", vm.kind === "error" ? "notice" : "hint", vm.message || vm.labels.loading),
      );
      const actions = el("div", "actions");
      if (vm.kind === "error") {
        actions.appendChild(button(vm.labels.reconnect, null, "connectWorkspace"));
        actions.appendChild(button(vm.labels.retry, "secondary", "refresh"));
      } else {
        actions.appendChild(button(vm.labels.refresh, null, "refresh"));
      }
      actions.appendChild(button(vm.labels.openConsole, "secondary", "openConsole"));
      root.appendChild(actions);
    } else {
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
      if (vm.kind === "error") {
        actions.appendChild(button(vm.labels.reconnect, null, "connectWorkspace"));
        actions.appendChild(button(vm.labels.retry, "secondary", "refresh"));
      } else {
        actions.appendChild(button(vm.labels.refresh, null, "refresh"));
      }
      actions.appendChild(button(vm.labels.openConsole, "secondary", "openConsole"));
      root.appendChild(actions);
    }

    // The settings section is always visible, regardless of state.
    if (vm.settings) {
      root.appendChild(renderSettings(vm.settings, vm.labels));
    }
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
