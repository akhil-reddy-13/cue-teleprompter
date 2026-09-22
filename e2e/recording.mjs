import {
  DESKTOP,
  PHONE,
  createReporter,
  enableCamera,
  frameBox,
  grantedContext,
  launch,
  openApp,
  openPanel,
} from "./harness.mjs";

/**
 * The recording path: camera startup, prompter motion, and — the thing that
 * actually matters — that a take comes out at the dimensions that were framed.
 */
export default async function run() {
  const { check, failures } = createReporter("Recording");
  const browser = await launch();

  try {
    const page = await openApp(await grantedContext(browser, DESKTOP));

    check("app renders", (await page.locator("h1").innerText()) === "Cue");

    await enableCamera(page);
    const camera = await page.evaluate(() => {
      const video = document.querySelectorAll("video")[1];
      return { w: video?.videoWidth, h: video?.videoHeight };
    });
    check(
      "camera stream is live",
      camera.w > 0 && camera.h > 0,
      `${camera.w}x${camera.h}`,
    );

    // ---- prompter ---------------------------------------------------------
    await openPanel(page, "Script");
    await page.getByRole("button", { name: "Load sample" }).click();
    await page.waitForTimeout(400);

    const words = Number(
      await page.locator("[data-word-count]").first().innerText(),
    );
    check("word count is computed", words > 30, `${words} words`);

    const offset = () =>
      page.evaluate(() => {
        const el = document.querySelector(".will-change-transform");
        if (!el) return null;
        return Math.round(
          new DOMMatrixReadOnly(getComputedStyle(el).transform).m42,
        );
      });
    const contentHeight = await page.evaluate(
      () => document.querySelector(".will-change-transform")?.scrollHeight ?? 0,
    );

    const before = await offset();
    await page.getByRole("button", { name: "Scroll script" }).click();
    await page.waitForTimeout(2500);
    const after = await offset();
    await page.getByRole("button", { name: "Pause script" }).click();

    check("prompter auto-scrolls", before === 0 && after < -5, `${before} → ${after}`);
    // 2.5s at ~145wpm is a handful of words, not a third of the script.
    check(
      "scroll rate is plausible",
      Math.abs(after) < contentHeight * 0.5,
      `${-after}px of ${contentHeight}px`,
    );

    // ---- record a 16:9 take ----------------------------------------------
    await openPanel(page, "Setup");
    await page.getByRole("radio", { name: "Off" }).click();
    await page.keyboard.press("Escape");

    await page.getByRole("button", { name: "Start recording" }).click();
    await page.waitForTimeout(3500);
    check(
      "record badge shows while live",
      await page.locator("[data-rec-badge]").isVisible(),
    );
    await page.getByRole("button", { name: "Stop recording" }).click();
    await page.waitForTimeout(2500);

    const card = await page.evaluate(() => ({
      cards: document.querySelectorAll("[data-take-dims]").length,
      posters: [...document.querySelectorAll("img")].filter((img) =>
        img.src.startsWith("data:image/jpeg"),
      ).length,
    }));
    check(
      "take is listed with a poster thumbnail",
      card.cards === 1 && card.posters === 1,
      JSON.stringify(card),
    );

    const dims = await page.locator("[data-take-dims]").first().innerText();
    check(
      "16:9 take is 1920x1080",
      dims.replace(/\s/g, "") === "1920×1080",
      dims,
    );

    // Players are lazy; clicking play is what mounts the <video>.
    await page.getByRole("button", { name: /^Play take/ }).first().click();
    await page.waitForTimeout(600);
    const player = await page.evaluate(() => {
      const video = [...document.querySelectorAll("video")].find(
        (v) => v.controls,
      );
      return { present: !!video, blob: video?.src?.startsWith("blob:") ?? false };
    });
    check(
      "clicking play mounts the take player",
      player.present && player.blob,
      JSON.stringify(player),
    );

    const bytes = await page.evaluate(async () => {
      const video = [...document.querySelectorAll("video")].find(
        (v) => v.controls,
      );
      if (!video) return 0;
      return (await (await fetch(video.src)).blob()).size;
    });
    check("take holds real bytes", bytes > 20000, `${bytes} bytes`);

    // ---- record a 9:16 take ----------------------------------------------
    await openPanel(page, "Setup");
    await page.getByRole("button", { name: "9:16" }).click();
    await page.waitForTimeout(1000);
    await page.getByRole("button", { name: "Start recording" }).click();
    await page.waitForTimeout(2500);
    await page.getByRole("button", { name: "Stop recording" }).click();
    await page.waitForTimeout(2500);

    const portrait = await page.locator("[data-take-dims]").first().innerText();
    check(
      "9:16 take is 1080x1920",
      portrait.replace(/\s/g, "") === "1080×1920",
      portrait,
    );

    // A second take used to come out silent: the recorder stopped every track
    // in its capture stream on teardown, and when the mic was the only audio
    // source that stream held the *live* mic track itself.
    const micLive = await page.evaluate(() => {
      const video = document.querySelectorAll("video")[1];
      const tracks = video?.srcObject?.getAudioTracks?.() ?? [];
      return tracks.length > 0 && tracks.every((t) => t.readyState === "live");
    });
    check("mic survives a finished take", micLive);

    await page.getByRole("button", { name: /^Play take/ }).first().click();
    await page.waitForTimeout(700);
    const audio = await page.evaluate(async () => {
      const video = [...document.querySelectorAll("video")].find(
        (v) => v.controls,
      );
      if (!video) return { peak: 0 };
      const buffer = await (await fetch(video.src)).arrayBuffer();
      try {
        const decoded = await new AudioContext().decodeAudioData(buffer);
        const channel = decoded.getChannelData(0);
        let peak = 0;
        for (let i = 0; i < channel.length; i++) {
          peak = Math.max(peak, Math.abs(channel[i]));
        }
        return { peak };
      } catch {
        return { peak: 0 };
      }
    });
    check(
      "the second take carries audible audio",
      audio.peak > 0.001,
      `peak ${audio.peak.toFixed(3)}`,
    );

    check(
      "no console errors",
      page.collectedErrors.length === 0,
      page.collectedErrors.slice(0, 2).join(" | "),
    );

    // ---- phone defaults ---------------------------------------------------
    const phone = await openApp(await grantedContext(browser, PHONE));
    await phone.waitForTimeout(600);
    const box = await frameBox(phone);
    check(
      "a phone defaults to a vertical frame",
      box !== null && box.ratio > 0.5 && box.ratio < 0.6,
      JSON.stringify(box),
    );
  } finally {
    await browser.close();
  }

  return failures;
}
