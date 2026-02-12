#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

async function main() {
  const argv = process.argv.slice(2);
  if (argv.length === 0) {
    console.error('Usage: node migrate-file.js <path-to-json> [--url=${import.meta.env.VITE_API_URL}] [--key=APIKEY]');
    process.exit(1);
  }

  let file = argv[0];
  let url = '${import.meta.env.VITE_API_URL}';
  let apiKey = process.env.API_KEY || '';

  argv.slice(1).forEach(arg => {
    if (arg.startsWith('--url=')) url = arg.split('=')[1];
    if (arg.startsWith('--key=')) apiKey = arg.split('=')[1];
  });

  try {
    const full = path.resolve(process.cwd(), file);
    const raw = fs.readFileSync(full, 'utf8');
    const data = JSON.parse(raw);

    console.log(`Posting to ${url}/data/migrate ...`);

    const fetch = global.fetch || require('node-fetch');
    const res = await fetch(`${url}/data/migrate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { 'x-api-key': apiKey } : {})
      },
      body: JSON.stringify(data)
    });

    const text = await res.text();
    if (res.ok) {
      console.log('Migrasi berhasil:', text);
    } else {
      console.error('Migrasi gagal:', res.status, text);
      process.exit(2);
    }
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

main();
