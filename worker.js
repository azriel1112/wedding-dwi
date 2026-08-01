const GOOGLE_APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbwuchKWHAfC9i6GQxsUpAdUfqHybHKVjXEqklcySNaTVN-EpfLNMl41K-IYuXl4SA7XSQ/exec";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // ==========================
    // API UCAPAN TAMU
    // ==========================
    if (
      url.pathname === "/api/wishes" &&
      request.method === "GET"
    ) {
      try {
        let limit = parseInt(
          url.searchParams.get("limit") || "12",
          10
        );

        if (isNaN(limit)) {
          limit = 12;
        }

        limit = Math.max(1, Math.min(limit, 50));

        const googleUrl = new URL(
          GOOGLE_APPS_SCRIPT_URL
        );

        googleUrl.searchParams.set(
          "action",
          "wishes"
        );

        googleUrl.searchParams.set(
          "limit",
          String(limit)
        );

        // Cloudflare yang menghubungi Google,
        // bukan browser HP tamu.
        const response = await fetch(
          googleUrl.toString(),
          {
            method: "GET",
            redirect: "follow",
            headers: {
              Accept:
                "application/json,text/plain,*/*"
            }
          }
        );

        const body = await response.text();

        if (!response.ok) {
          return new Response(
            JSON.stringify({
              success: false,
              message:
                "Google Apps Script memberikan error.",
              status: response.status
            }),
            {
              status: 502,
              headers: {
                "Content-Type":
                  "application/json; charset=UTF-8",
                "Cache-Control": "no-store"
              }
            }
          );
        }

        return new Response(body, {
          status: 200,
          headers: {
            "Content-Type":
              response.headers.get(
                "Content-Type"
              ) ||
              "application/json; charset=UTF-8",

            "Cache-Control":
              "no-store, no-cache, must-revalidate"
          }
        });
      } catch (error) {
        return new Response(
          JSON.stringify({
            success: false,
            message:
              "Gagal mengambil ucapan tamu.",
            error: error.message
          }),
          {
            status: 500,
            headers: {
              "Content-Type":
                "application/json; charset=UTF-8",
              "Cache-Control": "no-store"
            }
          }
        );
      }
    }

    // Route API yang tidak tersedia
    if (url.pathname.startsWith("/api/")) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "API tidak ditemukan."
        }),
        {
          status: 404,
          headers: {
            "Content-Type":
              "application/json; charset=UTF-8"
          }
        }
      );
    }

    return new Response("Not Found", {
      status: 404
    });
  }
};