'use strict';
const { createPrivateKey, sign } = require('node:crypto');
function signPlayback(playbackId, config, restrictionId, now = Date.now()) {
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const header = encode({ alg: 'RS256', typ: 'JWT', kid: config.id });
  const payload = encode({ sub: playbackId, aud: 'v', exp: Math.floor(now / 1000) + 1200,
    kid: config.id, playback_restriction_id: restrictionId });
  const input = header + '.' + payload;
  const key = createPrivateKey(Buffer.from(config.private_key, 'base64'));
  return input + '.' + sign('RSA-SHA256', Buffer.from(input), key).toString('base64url');
}
function allowedHosts(env = process.env) {
  return new Set([env.VERCEL_URL, env.VERCEL_PROJECT_PRODUCTION_URL]
    .filter(x => typeof x === 'string' && /^[a-z0-9.-]+$/i.test(x)));
}
function isSameOrigin(req, env = process.env) {
  try { const origin = new URL(req.headers.origin); return origin.protocol === 'https:' &&
    allowedHosts(env).has(origin.host) && origin.host === req.headers.host; } catch { return false; }
}
function adminAllowed(req, env = process.env) {
  return env.VERCEL_ENV === 'preview' && env.UPLOAD_ENABLED === '1' && isSameOrigin(req, env);
}
module.exports = { signPlayback, allowedHosts, isSameOrigin, adminAllowed };
