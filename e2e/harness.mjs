import { chromium } from "playwright";

export const BASE_URL = process.env.CUE_URL ?? "http://localhost:3000";

export const DESKTOP = { viewport: { width: 1440, height: 900 } };
export const PHONE = {
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
};
export const PHONE_LANDSCAPE = {
  viewport: { width: 844, height: 390 },
  isMobile: true,
  hasTouch: true,
};

const MEDIA = ["camera", "microphone"];

/**
 * `--use-fake-device-for-media-stream` hands the page a synthetic camera.
 *
 * `--use-fake-ui-for-media-stream` additionally auto-accepts the permission
 * prompt, which makes Chrome report camera permission as already *granted*.
 * The app reads that and auto-starts, so anything testing the camera gate has
 * to launch with `fakeUi: false` or the gate will never appear.
 */
export function launch({ fakeUi = true } = {}) {
  const args = ["--use-fake-device-for-media-stream"];
  if (fakeUi) args.push("--use-fake-ui-for-media-stream");
  return chromium.launch({ channel: "chrome", headless: true, args });
}

/** A context with camera/mic pre-granted, so the app starts straight up. */
export function grantedContext(browser, profile) {
  return browser.newContext({ ...profile, permissions: MEDIA });
}

export async function openApp(context, { seedStorage } = {}) {
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  if (seedStorage) {
    await page.addInitScript(
      ([key, value]) => localStorage.setItem(key, value),
      ["cue.studio.v2", JSON.stringify(seedStorage)],
    );
  }
  await page.goto(BASE_URL, { waitUntil: "networkidle" });
  await page.waitForTimeout(900);
  page.collectedErrors = errors;
  return page;
}

/** Bring the camera up whether or not the gate happens to be showing. */
export async function enableCamera(page) {
  await page
    .getByRole("button", { name: "Enable camera" })
    .click({ timeout: 2500 })
    .catch(() => {});
  await page.waitForFunction(
    () => {
      const video = document.querySelectorAll("video")[1];
      return !!video && video.readyState >= 2;
    },
    undefined,
    { timeout: 15000 },
  );
}

export function openPanel(page, name) {
  return page.locator("aside button", { hasText: name }).click();
}

export function frameBox(page) {
  return page.evaluate(() => {
    const el = document.querySelector("[data-stage-frame]");
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return {
      w: Math.round(rect.width),
      h: Math.round(rect.height),
      ratio: Number((rect.width / rect.height).toFixed(3)),
    };
  });
}

export function createReporter(title) {
  const failures = [];
  console.log(`\n${title}`);
  return {
    check(name, condition, detail = "") {
      const mark = condition ? "  ok  " : "  FAIL";
      console.log(`${mark}  ${name}${detail ? `  — ${detail}` : ""}`);
      if (!condition) failures.push(name);
    },
    failures,
  };
}

export async function assertServerUp() {
  try {
    const response = await fetch(BASE_URL);
    if (!response.ok) throw new Error(`status ${response.status}`);
  } catch (error) {
    console.error(
      `\nCan't reach ${BASE_URL} — start the app first (npm run dev).\n${error.message}`,
    );
    process.exit(1);
  }
}
