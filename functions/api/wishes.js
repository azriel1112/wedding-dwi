const APPS_SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbwuchKWHAfC9i6GQxsUpAdUfqHybHKVjXEqklcySNaTVN-EpfLNMl41K-IYuXl4SA7XSQ/exec';

export async function onRequestGet(context) {
  try {
    const requestUrl = new URL(context.request.url);

    let limit = Number.parseInt(
      requestUrl.searchParams.get('limit') || '12',
      10
    );

    if (!Number.isInteger(limit)) {
      limit = 12;
    }

    limit = Math.min(Math.max(limit, 1), 50);

    const googleUrl = new URL(APPS_SCRIPT_URL);

    googleUrl.searchParams.set('action', 'wishes');
    googleUrl.searchParams.set('limit', String(limit));
    googleUrl.searchParams.set('_', Date.now().toString());

    const response = await fetch(googleUrl.toString(), {
      method: 'GET',
      redirect: 'follow',
      headers: {
        Accept: 'application/json'
      }
    });

    const text = await response.text();

    let data;

    try {
      data = JSON.parse(text);
    } catch (error) {
      console.error('Response Google bukan JSON:', text);

      return new Response(
        JSON.stringify({
          ok: false,
          message: 'Respons Google Apps Script tidak valid.'
        }),
        {
          status: 502,
          headers: {
            'Content-Type': 'application/json; charset=UTF-8',
            'Cache-Control': 'no-store'
          }
        }
      );
    }

    if (!response.ok || data?.ok === false) {
      return new Response(JSON.stringify(data), {
        status: 502,
        headers: {
          'Content-Type': 'application/json; charset=UTF-8',
          'Cache-Control': 'no-store'
        }
      });
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=UTF-8',
        'Cache-Control': 'no-store'
      }
    });
  } catch (error) {
    console.error('Gagal mengambil wishes:', error);

    return new Response(
      JSON.stringify({
        ok: false,
        message: 'Gagal mengambil ucapan tamu.'
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json; charset=UTF-8',
          'Cache-Control': 'no-store'
        }
      }
    );
  }
}