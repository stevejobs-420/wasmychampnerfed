const USER_AGENT =
  "wasmychampnerfed-bot/0.1 (+https://wasmychampnerfed.com; batch ingest ~26x/yr)";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Polite fetch: identifies the bot, follows redirects, retries transient failures. */
export async function politeFetch(url: string, retries = 3): Promise<string> {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "user-agent": USER_AGENT },
        redirect: "follow",
      });
      if (res.status === 429 || res.status >= 500) {
        throw new Error(`HTTP ${res.status}`);
      }
      if (!res.ok) {
        throw Object.assign(new Error(`HTTP ${res.status} for ${url}`), {
          permanent: true,
        });
      }
      return await res.text();
    } catch (err: any) {
      if (err.permanent || attempt > retries) throw err;
      await sleep(1500 * attempt);
    }
  }
}

export { sleep };
