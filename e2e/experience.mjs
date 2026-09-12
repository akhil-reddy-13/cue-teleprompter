import {
  DESKTOP,
  PHONE,
  PHONE_LANDSCAPE,
  createReporter,
  enableCamera,
  frameBox,
  grantedContext,
  launch,
  openApp,
  openPanel,
} from "./harness.mjs";

/** First run, phone gestures, orientation, and what the chrome claims. */
export default async function run() {
  const { check, failures } = createReporter("Experience");
  const browser = await launch();
  // The gate only appears when camera permission is still "prompt"; see the
  // note on launch() in harness.mjs.
  const gateBrowser = await launch({ fakeUi: false });

  try {
    // ---- first run vs returning ------------------------------------------
    {
      const page = await openApp(await gateBrowser.newContext(DESKTOP));
      const pitch = await page
        .getByText("A teleprompter that isn't trying to sell you anything")
        .isVisible()
        .catch(() => false);
      check("first run leads with the pitch", pitch);
      const bullets = await page.locator("li").count();
      check("first run says what it does", bullets >= 3, `${bullets} points`);
    }
    {
      const page = await openApp(await gateBrowser.newContext(DESKTOP), {
        seedStorage: { aspect: "16:9" },
      });
      const compact = await page
        .getByText("Turn on your camera")
        .isVisible()
        .catch(() => false);
      const pitch = await page
        .getByText("isn't trying to sell you anything")
        .isVisible()
        .catch(() => false);
      check(
        "a returning visitor gets the compact gate",
        compact && !pitch,
        `compact=${compact} pitch=${pitch}`,
      );
    }

    // ---- a saved choice outranks the phone default ------------------------
    {
      const page = await openApp(await grantedContext(browser, PHONE), {
        seedStorage: { aspect: "16:9" },
      });
      await page.waitForTimeout(600);
      const box = await frameBox(page);
      check(
        "a saved landscape choice survives on a phone",
        box !== null && box.ratio > 1.7,
        `ratio ${box?.ratio}`,
      );
    }

    // ---- sheet gestures ---------------------------------------------------
    {
      const page = await openApp(await grantedContext(browser, PHONE));
      await page.getByRole("button", { name: "Script", exact: true }).click();
      await page.waitForTimeout(400);
      check("the sheet opens as a dialog", await page.getByRole("dialog").isVisible());

      const handle = await page.evaluate(() => {
        const rect = document
          .querySelector('[role="dialog"]')
          .getBoundingClientRect();
        return { x: rect.left + rect.width / 2, y: rect.top + 8 };
      });
      await page.mouse.move(handle.x, handle.y);
      await page.mouse.down();
      await page.mouse.move(handle.x, handle.y + 60, { steps: 6 });
      await page.mouse.move(handle.x, handle.y + 180, { steps: 10 });
      await page.mouse.up();
      await page.waitForTimeout(500);
      const open = await page
        .getByRole("dialog")
        .isVisible()
        .catch(() => false);
      check("swiping the handle down dismisses it", !open);

      // The close button lives inside the drag area. Capturing the pointer too
      // eagerly makes Chrome deliver the click to the wrapper instead, which
      // is exactly how this button got silently broken once already.
      await page.getByRole("button", { name: "Script", exact: true }).click();
      await page.waitForTimeout(350);
      await page.getByRole("button", { name: "Close Script" }).click();
      await page.waitForTimeout(350);
      const afterClose = await page
        .getByRole("dialog")
        .isVisible()
        .catch(() => false);
      check("the close button inside the drag area still works", !afterClose);

      // And a tap on the handle must not be mistaken for a dismiss gesture.
      await page.getByRole("button", { name: "Script", exact: true }).click();
      await page.waitForTimeout(350);
      const tap = await page.evaluate(() => {
        const rect = document
          .querySelector('[role="dialog"]')
          .getBoundingClientRect();
        return { x: rect.left + rect.width / 2, y: rect.top + 8 };
      });
      await page.mouse.click(tap.x, tap.y);
      await page.waitForTimeout(350);
      const afterTap = await page
        .getByRole("dialog")
        .isVisible()
        .catch(() => false);
      check("tapping the handle leaves the sheet open", afterTap);
    }

    // ---- orientation ------------------------------------------------------
    {
      const page = await openApp(
        await grantedContext(browser, PHONE_LANDSCAPE),
      );
      await enableCamera(page);
      const hint = await page
        .getByText("Hold your phone upright")
        .isVisible()
        .catch(() => false);
      check("a landscape phone with a vertical frame is told to rotate", hint);
    }

    // ---- the resolution chip tells the truth ------------------------------
    {
      const page = await openApp(await grantedContext(browser, DESKTOP));
      await enableCamera(page);
      const chip = () =>
        page.evaluate(() => {
          const el = [...document.querySelectorAll("span")].find((span) =>
            /^\d+p$/.test(span.textContent?.trim() ?? ""),
          );
          return el?.textContent?.trim() ?? null;
        });

      const wide = await chip();
      await openPanel(page, "Setup");
      await page.getByRole("button", { name: "9:16" }).click();
      await page.waitForTimeout(600);
      const tall = await chip();
      // Resolution means the short edge, so a 9:16 take is 1080p, not 1920p.
      check(
        "resolution reads the short edge in both orientations",
        wide === "1080p" && tall === "1080p",
        `16:9=${wide} 9:16=${tall}`,
      );

      await page.getByRole("radio", { name: "720p — smaller file" }).click();
      await page.waitForTimeout(400);
      const smaller = await chip();
      check("changing quality updates it", smaller === "720p", `${smaller}`);
    }
  } finally {
    await browser.close();
    await gateBrowser.close();
  }

  return failures;
}
