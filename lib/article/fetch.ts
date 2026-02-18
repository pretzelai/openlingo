async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number = 30000,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchHtmlDirect(
  url: string,
): Promise<{ html: string; success: boolean; error?: string }> {
  try {
    const urlObj = new URL(url);
    const response = await fetchWithTimeout(
      url,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9,fr;q=0.8,de;q=0.7",
          "Cache-Control": "no-cache",
          Referer: urlObj.origin,
          "Upgrade-Insecure-Requests": "1",
        },
      },
      30000,
    );
    if (!response.ok)
      return { html: "", success: false, error: `HTTP ${response.status}` };
    const html = await response.text();
    if (!html || html.length < 500)
      return { html: "", success: false, error: "Response too short" };
    return { html, success: true };
  } catch (error) {
    return {
      html: "",
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

async function fetchHtmlViaJina(
  url: string,
): Promise<{ html: string; success: boolean; error?: string }> {
  try {
    const jinaUrl = `https://r.jina.ai/${encodeURIComponent(url)}`;
    const response = await fetchWithTimeout(
      jinaUrl,
      {
        headers: {
          Authorization: `Bearer ${process.env.JINA_API_KEY}`,
          Accept: "text/html",
          "X-Return-Format": "html",
        },
      },
      45000,
    );
    if (!response.ok)
      return {
        html: "",
        success: false,
        error: `Jina HTTP ${response.status}`,
      };
    const html = await response.text();
    if (!html || html.length < 500)
      return { html: "", success: false, error: "Jina response too short" };
    return { html, success: true };
  } catch (error) {
    return {
      html: "",
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function fetchArticleHtml(
  url: string,
  articleId: string,
): Promise<{ html: string; method: string } | null> {
  console.log(`[${articleId}] Trying direct fetch...`);
  const directResult = await fetchHtmlDirect(url);

  if (directResult.success) {
    console.log(
      `[${articleId}] Direct fetch succeeded (${directResult.html.length} bytes)`,
    );
    return { html: directResult.html, method: "direct" };
  }

  console.log(
    `[${articleId}] Direct fetch failed: ${directResult.error}. Falling back to Jina...`,
  );
  const jinaResult = await fetchHtmlViaJina(url);

  if (jinaResult.success) {
    console.log(
      `[${articleId}] Jina fetch succeeded (${jinaResult.html.length} bytes)`,
    );
    return { html: jinaResult.html, method: "jina" };
  }

  console.log(`[${articleId}] Jina fetch also failed: ${jinaResult.error}`);
  return null;
}
