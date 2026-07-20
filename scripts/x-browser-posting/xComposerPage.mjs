import {
  SELECTOR_PROFILE_VERSION,
  SUBMIT_BUTTON_NAMES,
  findBlockingTextMatch,
  formatBlockingStateError,
} from "./selectors.mjs";

export async function openComposer(page) {
  await page.goto("https://x.com/compose/post", {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });
  await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
  await assertNoBlockingState(page);
}

export async function verifyLoggedInAccount(page, expectedHandle) {
  const normalizedExpected = normalizeHandle(expectedHandle);
  const sideNavHandle = await readSideNavHandle(page);

  if (sideNavHandle) {
    if (sideNavHandle !== normalizedExpected) {
      throw new Error(
        `Logged-in X account @${sideNavHandle} does not match @${normalizedExpected}`
      );
    }
    return sideNavHandle;
  }

  const expectedVisible = await page
    .getByText(new RegExp(`@${escapeRegExp(normalizedExpected)}\\b`, "i"))
    .first()
    .isVisible({ timeout: 3000 })
    .catch(() => false);

  if (!expectedVisible) {
    throw new Error(
      `Could not verify logged-in X account @${normalizedExpected}`
    );
  }

  return normalizedExpected;
}

export async function fillComposer(page, text) {
  const textbox = await findComposerTextbox(page);
  await textbox.click({ timeout: 10000 });
  await textbox.fill(text).catch(async () => {
    await page.keyboard.press(
      process.platform === "darwin" ? "Meta+A" : "Control+A"
    );
    await page.keyboard.insertText(text);
  });
  await assertNoBlockingState(page);
}

export async function addMedia(page, filePath) {
  const input = page.locator('input[data-testid="fileInput"], input[type="file"]');
  if ((await input.count()) === 0) {
    throw new Error("Could not find X media file input");
  }
  await input.first().setInputFiles(filePath);
  const attached = await page
    .locator(
      '[data-testid="attachments"], [data-testid="mediaPreview0"], [data-testid="mediaPreview"]'
    )
    .first()
    .isVisible({ timeout: 10000 })
    .catch(() => false);
  if (!attached) {
    throw new Error("X media attachment could not be verified");
  }
}

export async function addPoll(page, options) {
  if (!Array.isArray(options) || options.length < 2 || options.length > 4) {
    throw new Error("X poll requires 2 to 4 options");
  }
  const buttons = [
    page.locator('[data-testid="pollButton"]').first(),
    page.locator('[data-testid="createPollButton"]').first(),
    page.getByRole("button", { name: /投票|poll/i }).first(),
  ];
  let opened = false;
  for (const button of buttons) {
    if (await button.isVisible({ timeout: 2000 }).catch(() => false)) {
      await button.click();
      opened = true;
      break;
    }
  }
  if (!opened) {
    throw new Error("Could not find X poll button");
  }

  for (let index = 2; index < options.length; index += 1) {
    const currentInputs = page.locator('input[name^="Choice"]');
    if ((await currentInputs.count()) > index) {
      continue;
    }
    const addChoice = page
      .locator('[data-testid="addPollChoice"]')
      .or(
        page.getByRole("button", {
          name: /回答を追加|選択肢を追加|add (a )?choice/i,
        })
      )
      .first();
    if (!(await addChoice.isVisible({ timeout: 3000 }).catch(() => false))) {
      throw new Error("Could not add another X poll choice");
    }
    await addChoice.click();
  }

  const inputs = page.locator('input[name^="Choice"]');
  if ((await inputs.count()) < options.length) {
    throw new Error("Could not find enough X poll choice inputs");
  }
  for (let index = 0; index < options.length; index += 1) {
    await inputs.nth(index).fill(options[index]);
  }
}

export async function assertSubmitReady(page) {
  const button = await findSubmitButton(page);
  const disabled = await button.getAttribute("aria-disabled").catch(() => null);
  if (disabled === "true" || !(await button.isEnabled())) {
    throw new Error("X submit button is disabled");
  }
  return button;
}

export async function submitPost(page, accountHandle, expectedText = "") {
  const button = await assertSubmitReady(page);
  await button.click({ timeout: 10000 });

  await Promise.race([
    page
      .locator('[data-testid="toast"]')
      .first()
      .waitFor({ state: "visible", timeout: 15000 }),
    page
      .locator('[data-testid="tweetTextarea_0"]')
      .first()
      .waitFor({ state: "detached", timeout: 15000 }),
    page.waitForTimeout(8000),
  ]).catch(() => {});

  await assertNoBlockingState(page);
  const currentUrl = await findPostedUrl(page, accountHandle, expectedText);
  if (currentUrl) {
    return currentUrl;
  }
  await page.goto(`https://x.com/${normalizeHandle(accountHandle)}`, {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });
  await page.waitForTimeout(2000);
  return findPostedUrl(page, accountHandle, expectedText);
}

export async function assertNoBlockingState(page) {
  const url = page.url();
  if (/\/login|\/i\/flow\/login/.test(url)) {
    throw new Error("X login screen is visible; login automation is not allowed");
  }

  const passwordInputVisible = await page
    .locator('input[type="password"]')
    .first()
    .isVisible({ timeout: 1000 })
    .catch(() => false);
  if (passwordInputVisible) {
    throw new Error("X login form is visible; login automation is not allowed");
  }

  const bodyText = await page
    .locator("body")
    .innerText({ timeout: 1000 })
    .catch(() => "");
  const blockingMatch = findBlockingTextMatch(bodyText);
  if (blockingMatch) {
    throw new Error(formatBlockingStateError(blockingMatch));
  }
}

export { SELECTOR_PROFILE_VERSION };

async function readSideNavHandle(page) {
  const text = await page
    .locator('[data-testid="SideNav_AccountSwitcher_Button"]')
    .first()
    .innerText({ timeout: 5000 })
    .catch(() => "");
  const match = /@([A-Za-z0-9_]{1,15})/.exec(text);
  return match ? normalizeHandle(match[1]) : null;
}

async function findComposerTextbox(page) {
  const candidates = [
    page.locator('[data-testid="tweetTextarea_0"]').first(),
    page.getByRole("textbox").first(),
    page.locator('[contenteditable="true"]').first(),
  ];

  for (const locator of candidates) {
    const visible = await locator.isVisible({ timeout: 3000 }).catch(() => false);
    if (visible) {
      return locator;
    }
  }

  throw new Error("Could not find X composer textbox");
}

async function findSubmitButton(page) {
  const locators = [
    page.locator('[data-testid="tweetButton"]').first(),
    page.locator('[data-testid="tweetButtonInline"]').first(),
    ...SUBMIT_BUTTON_NAMES.map((name) =>
      page.getByRole("button", { name }).first()
    ),
  ];

  for (const locator of locators) {
    const visible = await locator.isVisible({ timeout: 3000 }).catch(() => false);
    if (visible) {
      return locator;
    }
  }

  throw new Error("Could not find X submit button");
}

async function findPostedUrl(page, accountHandle, expectedText = "") {
  const normalizedHandle = normalizeHandle(accountHandle);
  const expectedFragment = normalizePostText(expectedText).slice(0, 36);
  const articles = page.locator("article");
  const hrefs = [];
  for (let index = 0; index < Math.min(await articles.count(), 8); index += 1) {
    const article = articles.nth(index);
    const articleText = normalizePostText(
      await article.innerText().catch(() => "")
    );
    if (expectedFragment && !articleText.includes(expectedFragment)) {
      continue;
    }
    const articleHrefs = await article
      .locator('a[href*="/status/"]')
      .evaluateAll((links, handle) =>
        links
          .map((link) => link.getAttribute("href"))
          .filter((href) => typeof href === "string")
          .filter((href) =>
            href.toLowerCase().includes(`/${handle}/status/`)
          ),
        normalizedHandle
      )
      .catch(() => []);
    hrefs.push(...articleHrefs);
  }
  if (!expectedFragment && hrefs.length === 0) {
    hrefs.push(
      ...(await page
        .locator('a[href*="/status/"]')
        .evaluateAll((links, handle) =>
          links
            .map((link) => link.getAttribute("href"))
            .filter((href) => typeof href === "string")
            .filter((href) =>
              href.toLowerCase().includes(`/${handle}/status/`)
            ),
          normalizedHandle
        )
        .catch(() => []))
    );
  }
  const href = hrefs.find((candidate) => /\/status\/[0-9]+/.test(candidate));
  if (!href) {
    return null;
  }
  return new URL(href, "https://x.com").toString();
}

function normalizePostText(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/\s+/g, "")
    .trim();
}

function normalizeHandle(value) {
  return String(value).trim().replace(/^@/, "").toLowerCase();
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
