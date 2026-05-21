const { fetchWithSafeRedirects } = require('../dist/modules/webhook/utils/safe-webhook-fetch.util');

async function main() {
  process.env.NODE_ENV = 'production';
  const calls = [];

  global.fetch = async (url, init) => {
    calls.push({ url, redirect: init.redirect });
    if (url === 'https://safe.example/webhook') {
      return new Response('', { status: 302, headers: { location: 'https://safe.example/next' } });
    }
    if (url === 'https://safe.example/next') {
      return new Response('', { status: 302, headers: { location: 'http://127.0.0.1/internal' } });
    }
    return new Response('', { status: 200 });
  };

  const dns = require('dns/promises');
  const originalLookup = dns.lookup;
  dns.lookup = async host => {
    if (host === 'safe.example') return [{ address: '8.8.8.8', family: 4 }];
    if (host === '127.0.0.1') return [{ address: '127.0.0.1', family: 4 }];
    return [{ address: '8.8.8.8', family: 4 }];
  };

  try {
    await fetchWithSafeRedirects('https://safe.example/webhook', { method: 'POST' });
    console.log('UNEXPECTED_OK');
    process.exitCode = 1;
  } catch (error) {
    console.log('EXPECTED_BLOCK', error.message);
    console.log('CALLS', JSON.stringify(calls));
    if (!calls.every(c => c.redirect === 'manual')) {
      console.log('FAILED_NON_MANUAL_REDIRECT');
      process.exitCode = 1;
    }
  } finally {
    dns.lookup = originalLookup;
  }
}

main();
