export default {
  async fetch(request, env) {
    if (new URL(request.url).pathname !== '/ably-token') {
      return new Response('Not found', { status: 404 });
    }

    // Optional: simple origin check / rate limit
    const origin = request.headers.get('Origin') || '';
    // Allow your GitHub Pages domain; adjust as needed
    const allowed = ['https://YOUR_GITHUB_USERNAME.github.io'];
    if (!allowed.includes(origin)) {
      return new Response('Forbidden', { status: 403 });
    }

    // Request a token from Ably using your API key (server-side only)
    // Minimal token for Realtime connections
    const res = await fetch('https://rest.ably.io/keys/' + encodeURIComponent(env.ABLY_API_KEY) + '/requestToken', {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + btoa(env.ABLY_API_KEY + ':'),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        // Narrow capabilities: allow publish/subscribe on app channels
        // Adjust as your app grows
        capabilities: {
          'kidcoin:profiles': ['publish', 'subscribe'],
          'kidcoin:transactions': ['publish', 'subscribe'],
          'kidcoin:activity': ['publish', 'subscribe'],
        },
        ttl: 60 * 60 * 1000 // 1 hour
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return new Response('Token request failed: ' + text, { status: 500 });
    }

    const tokenDetails = await res.json();
    return new Response(JSON.stringify(tokenDetails), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': origin }
    });
  }
};
