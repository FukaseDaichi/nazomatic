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

export async function assertSubmitReady(page) {
  const button = await findSubmitButton(page);
  const disabled = await button.getAttribute("aria-disabled").catch(() => null);
  if (disabled === "true" || !(await button.isEnabled())) {
    throw new Error("X submit button is disabled");
  }
  return button;
}

export async function submitPost(page, accountHandle) {
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
  return findPostedUrl(page, accountHandle);
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

async function findPostedUrl(page, accountHandle) {
  const normalizedHandle = normalizeHandle(accountHandle);
  const hrefs = await page
    .locator(`a[href*="/${normalizedHandle}/status/"]`)
    .evaluateAll((links) =>
      links
        .map((link) => link.getAttribute("href"))
        .filter((href) => typeof href === "string")
    )
    .catch(() => []);
  const href = hrefs.find((candidate) => /\/status\/[0-9]+/.test(candidate));
  if (!href) {
    return null;
  }
  return new URL(href, "https://x.com").toString();
}

function normalizeHandle(value) {
  return String(value).trim().replace(/^@/, "").toLowerCase();
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
