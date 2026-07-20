import fs from "fs/promises";

import {
  SELECTOR_PROFILE_VERSION,
  findBlockingTextMatch,
  formatBlockingStateError,
} from "./selectors.mjs";

const DEFAULT_TIMEOUT_MS = 15000;

export async function openCdpChromePage(cdpUrl) {
  const target = await createTarget(cdpUrl, "about:blank");
  const client = await CdpClient.connect(target.webSocketDebuggerUrl);
  await client.send("Page.enable");
  await client.send("Runtime.enable");
  await client.send("DOM.enable");

  return {
    async goto(url) {
      await client.send("Page.bringToFront");
      await client.send("Page.navigate", { url });
      await waitForLoad(client).catch(() => {});
      await wait(1500);
    },

    async assertNoBlockingState() {
      const result = await evaluate(client, () => {
        return {
          url: location.href,
          text: document.body?.innerText ?? "",
          hasPassword: Boolean(document.querySelector('input[type="password"]')),
        };
      });

      if (/\/login|\/i\/flow\/login/.test(result.url)) {
        throw new Error(
          "X login screen is visible; login automation is not allowed"
        );
      }
      if (result.hasPassword) {
        throw new Error(
          "X login form is visible; login automation is not allowed"
        );
      }

      const blockingMatch = findBlockingTextMatch(result.text);
      if (blockingMatch) {
        throw new Error(formatBlockingStateError(blockingMatch));
      }
    },

    async verifyLoggedInAccount(expectedHandle) {
      const normalizedExpected = normalizeHandle(expectedHandle);
      let result = await readAccountText(client);

      let visibleHandle = findVisibleHandle(result, normalizedExpected);

      if (!visibleHandle) {
        await evaluate(client, () => {
          const switcher = document.querySelector(
            '[data-testid="SideNav_AccountSwitcher_Button"]'
          );
          if (switcher instanceof HTMLElement) {
            switcher.click();
            return true;
          }
          return false;
        });
        await wait(700);
        result = await readAccountText(client);
        visibleHandle = findVisibleHandle(result, normalizedExpected);
        await client.send("Input.dispatchKeyEvent", {
          type: "keyDown",
          key: "Escape",
          code: "Escape",
          windowsVirtualKeyCode: 27,
          nativeVirtualKeyCode: 27,
        });
        await client.send("Input.dispatchKeyEvent", {
          type: "keyUp",
          key: "Escape",
          code: "Escape",
          windowsVirtualKeyCode: 27,
          nativeVirtualKeyCode: 27,
        });
      }

      if (visibleHandle !== normalizedExpected) {
        throw new Error(
          `Could not verify logged-in X account @${normalizedExpected}`
        );
      }
      return visibleHandle;
    },

    async fillComposer(text) {
      await waitFor(client, findComposerExpression(), DEFAULT_TIMEOUT_MS);
      await client.send("Page.bringToFront");
      const focused = await evaluate(client, focusAndSelectComposerFunction());
      if (!focused) {
        throw new Error("Could not focus X composer");
      }
      await client.send("Input.dispatchKeyEvent", {
        type: "keyDown",
        key: "Backspace",
        code: "Backspace",
        windowsVirtualKeyCode: 8,
        nativeVirtualKeyCode: 51,
      });
      await client.send("Input.dispatchKeyEvent", {
        type: "keyUp",
        key: "Backspace",
        code: "Backspace",
        windowsVirtualKeyCode: 8,
        nativeVirtualKeyCode: 51,
      });
      await wait(300);
      await client.send("Input.insertText", { text });
      await wait(1200);

      const actualText = await readComposerText(client);
      if (!actualText || !actualText.includes(text.trim().split("\n")[0])) {
        throw new Error("X composer text was not filled correctly");
      }

      await wait(500);
      await this.assertNoBlockingState();
    },

    async addMedia(filePath) {
      const { root } = await client.send("DOM.getDocument", { depth: -1 });
      const { nodeId } = await client.send("DOM.querySelector", {
        nodeId: root.nodeId,
        selector: 'input[data-testid="fileInput"], input[type="file"]',
      });
      if (!nodeId) {
        throw new Error("Could not find X media file input");
      }
      await client.send("DOM.setFileInputFiles", {
        nodeId,
        files: [filePath],
      });
      await waitFor(
        client,
        `Boolean(document.querySelector('[data-testid="attachments"], [data-testid="mediaPreview0"], [data-testid="mediaPreview"]'))`,
        DEFAULT_TIMEOUT_MS
      ).catch(() => {
        throw new Error("X media attachment could not be verified");
      });
    },

    async addPoll(options) {
      if (!Array.isArray(options) || options.length < 2 || options.length > 4) {
        throw new Error("X poll requires 2 to 4 options");
      }
      const opened = await evaluate(client, () => {
        const direct = document.querySelector(
          '[data-testid="pollButton"], [data-testid="createPollButton"]'
        );
        const button =
          direct ||
          Array.from(document.querySelectorAll("button")).find((candidate) =>
            /投票|poll/i.test(
              `${candidate.getAttribute("aria-label") ?? ""} ${
                candidate.textContent ?? ""
              }`
            )
          );
        if (!(button instanceof HTMLElement)) {
          return false;
        }
        button.click();
        return true;
      });
      if (!opened) {
        throw new Error("Could not find X poll button");
      }
      await waitFor(
        client,
        `document.querySelectorAll('input[name^="Choice"]').length >= 2`,
        DEFAULT_TIMEOUT_MS
      );

      for (let index = 2; index < options.length; index += 1) {
        const count = await evaluate(
          client,
          () => document.querySelectorAll('input[name^="Choice"]').length
        );
        if (count > index) {
          continue;
        }
        const added = await evaluate(client, () => {
          const button =
            document.querySelector('[data-testid="addPollChoice"]') ||
            Array.from(document.querySelectorAll("button")).find(
              (candidate) =>
                /回答を追加|選択肢を追加|add (a )?choice/i.test(
                  `${candidate.getAttribute("aria-label") ?? ""} ${
                    candidate.textContent ?? ""
                  }`
                )
            );
          if (!(button instanceof HTMLElement)) {
            return false;
          }
          button.click();
          return true;
        });
        if (!added) {
          throw new Error("Could not add another X poll choice");
        }
        await wait(300);
      }

      const filled = await evaluate(client, (pollOptions) => {
        const inputs = Array.from(
          document.querySelectorAll('input[name^="Choice"]')
        );
        if (inputs.length < pollOptions.length) {
          return false;
        }
        const setter = Object.getOwnPropertyDescriptor(
          HTMLInputElement.prototype,
          "value"
        )?.set;
        for (let index = 0; index < pollOptions.length; index += 1) {
          const input = inputs[index];
          setter?.call(input, pollOptions[index]);
          input.dispatchEvent(new Event("input", { bubbles: true }));
          input.dispatchEvent(new Event("change", { bubbles: true }));
        }
        return inputs
          .slice(0, pollOptions.length)
          .every((input, index) => input.value === pollOptions[index]);
      }, options);
      if (!filled) {
        throw new Error("X poll choices could not be filled");
      }
      await wait(500);
    },

    async assertSubmitReady() {
      const ready = await waitForSubmitButton(client, DEFAULT_TIMEOUT_MS);
      if (!ready.found) {
        throw new Error("Could not find X submit button");
      }
      if (ready.disabled) {
        throw new Error("X submit button is disabled");
      }
    },

    async submitPost(accountHandle, expectedText = "") {
      await this.assertSubmitReady();
      const clicked = await evaluate(client, () => {
        const button = findSubmitButton();
        if (!button) {
          return false;
        }
        button.click();
        return true;

        function findSubmitButton() {
          const root =
            document.querySelector('[aria-modal="true"]') ||
            document.querySelector('[role="dialog"]') ||
            document;
          const candidates = [
            root.querySelector('[data-testid="tweetButton"]'),
            root.querySelector('[data-testid="tweetButtonInline"]'),
            ...Array.from(root.querySelectorAll('button')),
          ].filter(Boolean);
          return candidates.find((button) => {
            const label = button.textContent?.trim() ?? "";
            return (
              button.getAttribute("data-testid") === "tweetButton" ||
              button.getAttribute("data-testid") === "tweetButtonInline" ||
              ["Post", "Tweet", "投稿", "ポスト"].includes(label)
            );
          });
        }
      });
      if (!clicked) {
        throw new Error("Could not click X submit button");
      }
      await wait(5000);
      await this.assertNoBlockingState();
      const currentUrl = await this.findPostedUrl(accountHandle, expectedText);
      if (currentUrl) {
        return currentUrl;
      }
      await this.goto(`https://x.com/${normalizeHandle(accountHandle)}`);
      return this.findPostedUrl(accountHandle, expectedText);
    },

    async findPostedUrl(accountHandle, expectedText = "") {
      const normalizedHandle = normalizeHandle(accountHandle);
      return evaluate(
        client,
        (handle, postedText) => {
          const normalize = (value) =>
            String(value ?? "")
              .normalize("NFKC")
              .replace(/https?:\/\/\S+/gi, "")
              .replace(/\s+/g, "")
              .trim();
          const fragment = normalize(postedText).slice(0, 36);
          const matchingArticles = Array.from(
            document.querySelectorAll("article")
          )
            .slice(0, 8)
            .filter(
              (article) =>
                !fragment || normalize(article.innerText).includes(fragment)
            );
          const hrefs = matchingArticles
            .flatMap((article) =>
              Array.from(article.querySelectorAll('a[href*="/status/"]'))
            )
            .map((link) => link.href)
            .filter((href) =>
              href.toLowerCase().includes(`/${handle}/status/`)
            );
          return hrefs.find((href) => /\/status\/[0-9]+/.test(href)) ?? null;
        },
        normalizedHandle,
        expectedText
      );
    },

    async screenshot(filePath) {
      const { data } = await client.send("Page.captureScreenshot", {
        format: "png",
        captureBeyondViewport: true,
      });
      await fs.writeFile(filePath, Buffer.from(data, "base64"));
    },

    close: () => client.close(cdpUrl, target.id),
  };
}

export { SELECTOR_PROFILE_VERSION };

async function createTarget(cdpUrl, url) {
  const endpoint = `${cdpUrl.replace(/\/+$/, "")}/json/new?${encodeURIComponent(
    url
  )}`;
  let response = await fetch(endpoint, { method: "PUT" });
  if (!response.ok) {
    response = await fetch(endpoint);
  }
  if (!response.ok) {
    throw new Error(`Could not create Chrome target: ${response.status}`);
  }
  return response.json();
}

async function closeTarget(cdpUrl, targetId) {
  if (!targetId) {
    return;
  }
  await fetch(`${cdpUrl.replace(/\/+$/, "")}/json/close/${targetId}`).catch(
    () => null
  );
}

class CdpClient {
  static async connect(webSocketUrl) {
    const socket = new WebSocket(webSocketUrl);
    await new Promise((resolve, reject) => {
      socket.addEventListener("open", resolve, { once: true });
      socket.addEventListener("error", reject, { once: true });
    });
    return new CdpClient(socket);
  }

  constructor(socket) {
    this.socket = socket;
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();

    socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id && this.pending.has(message.id)) {
        const pending = this.pending.get(message.id);
        this.pending.delete(message.id);
        clearTimeout(pending.timeout);
        if (message.error) {
          pending.reject(new Error(message.error.message));
        } else {
          pending.resolve(message.result ?? {});
        }
        return;
      }
      if (message.method && this.listeners.has(message.method)) {
        for (const listener of this.listeners.get(message.method)) {
          listener(message.params ?? {});
        }
      }
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    this.socket.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`${method} timed out`));
        }
      }, DEFAULT_TIMEOUT_MS);
      this.pending.set(id, { resolve, reject, timeout });
    });
  }

  once(method) {
    return new Promise((resolve) => {
      const listener = (params) => {
        const listeners = this.listeners.get(method) ?? [];
        this.listeners.set(
          method,
          listeners.filter((entry) => entry !== listener)
        );
        resolve(params);
      };
      const listeners = this.listeners.get(method) ?? [];
      this.listeners.set(method, [...listeners, listener]);
    });
  }

  async close(cdpUrl, targetId) {
    if (this.socket.readyState === WebSocket.CLOSED) {
      await closeTarget(cdpUrl, targetId);
      return;
    }
    const closed = new Promise((resolve) => {
      this.socket.addEventListener("close", resolve, { once: true });
    });
    await closeTarget(cdpUrl, targetId);
    await Promise.race([closed, wait(800)]);
    if (
      this.socket.readyState === WebSocket.OPEN ||
      this.socket.readyState === WebSocket.CONNECTING
    ) {
      this.socket.close();
    }
    await Promise.race([closed, wait(800)]);
  }
}

async function evaluate(client, fn, ...args) {
  const expression = `(${fn.toString()})(...${JSON.stringify(args)})`;
  const result = await client.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error("Chrome evaluation failed");
  }
  return result.result?.value;
}

async function waitForLoad(client) {
  await Promise.race([
    client.once("Page.loadEventFired"),
    client.once("Page.domContentEventFired"),
    wait(DEFAULT_TIMEOUT_MS),
  ]);
}

async function waitFor(client, expression, timeoutMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const found = await client.send("Runtime.evaluate", {
      expression,
      returnByValue: true,
    });
    if (found.result?.value === true) {
      return;
    }
    await wait(500);
  }
  throw new Error("Timed out waiting for X composer");
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeHandle(value) {
  return String(value).trim().replace(/^@/, "").toLowerCase();
}

async function readAccountText(client) {
  return evaluate(client, () => {
    const sideNav = document.querySelector(
      '[data-testid="SideNav_AccountSwitcher_Button"]'
    );
    return {
      sideNavText: sideNav?.textContent ?? "",
      bodyText: document.body?.innerText ?? "",
    };
  });
}

function findVisibleHandle(result, expectedHandle) {
  const sideNavMatch = /@([A-Za-z0-9_]{1,15})/.exec(result.sideNavText);
  if (sideNavMatch) {
    return normalizeHandle(sideNavMatch[1]);
  }
  const bodyMatch = new RegExp(`@${escapeRegExp(expectedHandle)}\\b`, "i").exec(
    result.bodyText
  );
  return bodyMatch ? expectedHandle : null;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findComposerExpression() {
  return `Boolean(
    document.querySelector('[aria-modal="true"] [data-testid="tweetTextarea_0"]') ||
    document.querySelector('[role="dialog"] [data-testid="tweetTextarea_0"]') ||
    document.querySelector('[data-testid="tweetTextarea_0"]') ||
    document.querySelector('[aria-label="ポスト本文"]') ||
    document.querySelector('[aria-label="Post text"]') ||
    document.querySelector('[contenteditable="true"][role="textbox"]')
  )`;
}

function findSubmitButtonFunction() {
  return () => {
    const root =
      document.querySelector('[aria-modal="true"]') ||
      document.querySelector('[role="dialog"]') ||
      document;
    const candidates = [
      root.querySelector('[data-testid="tweetButton"]'),
      root.querySelector('[data-testid="tweetButtonInline"]'),
      ...Array.from(root.querySelectorAll('button')),
    ].filter(Boolean);
    const button = candidates.find((entry) => {
      const label = entry.textContent?.trim() ?? "";
      return (
        entry.getAttribute("data-testid") === "tweetButton" ||
        entry.getAttribute("data-testid") === "tweetButtonInline" ||
        ["Post", "Tweet", "投稿", "ポスト"].includes(label)
      );
    });
    return {
      found: Boolean(button),
      disabled:
        !button ||
        button.disabled ||
        button.getAttribute("aria-disabled") === "true",
    };
  };
}

function focusAndSelectComposerFunction() {
  return () => {
    const root =
      document.querySelector('[aria-modal="true"]') ||
      document.querySelector('[role="dialog"]') ||
      document;
    const textbox =
      root.querySelector('[data-testid="tweetTextarea_0"]') ||
      root.querySelector('[aria-label="ポスト本文"]') ||
      root.querySelector('[aria-label="Post text"]') ||
      root.querySelector('[contenteditable="true"][role="textbox"]');
    if (!(textbox instanceof HTMLElement)) {
      return false;
    }
    textbox.focus();
    const range = document.createRange();
    range.selectNodeContents(textbox);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    return true;
  };
}

async function waitForSubmitButton(client, timeoutMs) {
  const startedAt = Date.now();
  let lastReady = { found: false, disabled: true };
  while (Date.now() - startedAt < timeoutMs) {
    lastReady = await evaluate(client, findSubmitButtonFunction());
    if (lastReady.found && !lastReady.disabled) {
      return lastReady;
    }
    await wait(500);
  }
  return lastReady;
}

async function readComposerText(client) {
  return evaluate(client, () => {
    const textbox =
      document.querySelector('[aria-modal="true"] [data-testid="tweetTextarea_0"]') ||
      document.querySelector('[role="dialog"] [data-testid="tweetTextarea_0"]') ||
      document.querySelector('[data-testid="tweetTextarea_0"]') ||
      document.querySelector('[aria-label="ポスト本文"]') ||
      document.querySelector('[aria-label="Post text"]') ||
      document.querySelector('[contenteditable="true"][role="textbox"]');
    return textbox?.innerText || textbox?.textContent || "";
  });
}
