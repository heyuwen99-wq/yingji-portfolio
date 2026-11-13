'use strict';
const { get, put } = require('@vercel/blob');
const manifest = require('../media-manifest.json');
const { signPlayback, allowedHosts, adminAllowed } = require('../lib/security.cjs');
const cache = new Map();
let assetsCache = { at: 0, value: [] };
const prefix = 'yingji-v1/';
async function signingKey(fresh = false) {
  const id = process.env.MUX_SIGNING_KEY;
  const privateKey = process.env.MUX_PRIVATE_KEY;
  if (id && privateKey) return { id, private_key: privateKey };
  return read('signing.json', fresh);
}
async function mux(path, method = 'GET', body) {
  if (!process.env.MUX_TOKEN_ID || !process.env.MUX_TOKEN_SECRET) throw new Error('MUX_NOT_CONFIGURED');
  const response = await fetch('https://api.mux.com' + path, {
    method, signal: AbortSignal.timeout(25000),
    headers: { Authorization: 'Basic ' + Buffer.from(process.env.MUX_TOKEN_ID + ':' + process.env.MUX_TOKEN_SECRET).toString('base64'), 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
  const json = await response.json();
  if (!response.ok) { const error = new Error('MUX_' + response.status); error.status = response.status; throw error; }
  return json.data;
}
async function read(name, fresh = false) {
  const key = prefix + name;
  if (!fresh && cache.has(key)) return cache.get(key);
  const response = await get(key, { access: 'private', useCache: false });
  if (!response || response.statusCode !== 200) return null;
  const value = await new Response(response.stream).json();
  if (!fresh) cache.set(key, value);
  return value;
}
async function write(name, value, overwrite = false) {
  await put(prefix + name, JSON.stringify(value), { access: 'private', addRandomSuffix: false,
    allowOverwrite: overwrite, contentType: 'application/json', cacheControlMaxAge: 60 });
  cache.set(prefix + name, value);
}
async function assets(fresh = false) {
  if (!fresh && Date.now() - assetsCache.at < 30000) return assetsCache.value;
  const list = await mux('/video/v1/assets?limit=100');
  assetsCache = { at: Date.now(), value: list };
  return list;
}
function safeAsset(asset) {
  return asset && { id: asset.id, status: asset.status, duration: asset.duration,
    signed: !!asset.playback_ids?.some(p => p.policy === 'signed'),
    public: !!asset.playback_ids?.some(p => p.policy === 'public') };
}
async function setup() {
  let key = await signingKey(true);
  if (!key) {
    let candidate;
    try { candidate = await mux('/system/v1/signing-keys', 'POST', {}); }
    catch (error) {
      if (error.status === 403) error.message = 'MUX_SIGNING_PERMISSION_REQUIRED';
      throw error;
    }
    try { await write('signing.json', candidate); key = candidate; }
    catch (error) {
      // Never discard a live signing key. Only revoke this unused candidate.
      try { await mux('/system/v1/signing-keys/' + candidate.id, 'DELETE'); } catch {}
      key = await read('signing.json', true); if (!key) throw error;
    }
  }
  for (const host of allowedHosts()) {
    if (!await read('restrictions/' + host + '.json', true)) {
      const restriction = await mux('/video/v1/playback-restrictions', 'POST', {
        referrer: { allowed_domains: [host], allow_no_referrer: false }
      });
      await write('restrictions/' + host + '.json', { id: restriction.id });
    }
  }
  return { configured: true };
}
async function createUpload(body, req) {
  const film = manifest.find(f => f.id === body.id);
  if (!film || body.bytes !== film.bytes) return { status: 400, error: '文件与作品清单不匹配。' };
  const existing = (await assets(true)).find(a => a.passthrough === 'yingji:' + film.id);
  if (existing) return { existing: safeAsset(existing) };
  const name = 'uploads/' + film.id + '.json';
  const record = await read(name, true);
  if (record?.id) {
    const old = await mux('/video/v1/uploads/' + record.id);
    if (old.status === 'waiting' && record.origin === req.headers.origin) return { id: old.id, url: old.url };
    if (old.status === 'asset_created') return { existing: safeAsset(await mux('/video/v1/assets/' + old.asset_id)) };
    if (!['timed_out', 'cancelled', 'errored'].includes(old.status)) return { status: 409, error: '此视频已有上传任务，请稍后重试。' };
  } else if (record && Date.now() - record.at < 120000) return { status: 409, error: '正在准备此视频，请稍后重试。' };
  await write(name, { at: Date.now() }, !!record);
  const upload = await mux('/video/v1/uploads', 'POST', { timeout: 3600, cors_origin: req.headers.origin,
    new_asset_settings: { playback_policies: ['signed'], video_quality: 'basic',
      passthrough: 'yingji:' + film.id, meta: { title: film.title, external_id: film.id } } });
  await write(name, { id: upload.id, origin: req.headers.origin, at: Date.now() }, true);
  return { id: upload.id, url: upload.url };
}
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  const reply = (status, value) => res.status(status).json(value);
  try {
    const url = new URL(req.url, 'https://' + req.headers.host);
    const action = url.searchParams.get('action');
    if (req.method === 'GET' && action === 'status') {
      const list = await assets();
      return reply(200, { connected: true, uploadsEnabled: process.env.VERCEL_ENV === 'preview' && process.env.UPLOAD_ENABLED === '1',
        signingReady: !!await signingKey(),
        films: manifest.map(f => ({ id: f.id, title: f.title, category: f.category,
          asset: safeAsset(list.find(a => a.passthrough === 'yingji:' + f.id)) })) });
    }
    if (req.method === 'GET' && action === 'playback') {
      if (req.headers['sec-fetch-site'] === 'cross-site') return reply(403, { error: '请从作品集打开视频。' });
      const host = req.headers.host;
      if (!allowedHosts().has(host)) return reply(403, { error: '此域名尚未启用播放。' });
      const film = manifest.find(f => f.id === url.searchParams.get('id'));
      if (!film) return reply(404, { error: '未找到作品。' });
      const asset = (await assets()).find(a => a.passthrough === 'yingji:' + film.id);
      if (!asset || asset.status !== 'ready') return reply(409, { error: '视频正在准备中，请稍后再试。' });
      const playback = asset.playback_ids?.find(p => p.policy === 'signed');
      if (!playback || asset.playback_ids.some(p => p.policy === 'public')) return reply(503, { error: '视频保护配置待检查。' });
      const key = await signingKey();
      const restriction = await read('restrictions/' + host + '.json');
      if (!key || !restriction) return reply(503, { error: '播放配置正在准备中。' });
      const token = signPlayback(playback.id, key, restriction.id);
      return reply(200, { url: 'https://stream.mux.com/' + playback.id + '.m3u8?token=' + token, expiresIn: 1200 });
    }
    if (req.method !== 'POST') { res.setHeader('Allow', 'GET, POST'); return reply(405, { error: '请求方式不支持。' }); }
    // Administrative mutations only exist on the Vercel-authenticated Preview deployment.
    if (!adminAllowed(req)) return reply(403, { error: '上传管理仅在受保护的预览页面开放。' });
    if (!String(req.headers['content-type'] || '').startsWith('application/json')) return reply(415, { error: '请求格式不支持。' });
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    if (action === 'setup') return reply(200, await setup());
    if (action === 'upload') {
      if (!await signingKey()) return reply(409, { error: '请先初始化播放保护。' });
      const result = await createUpload(body, req);
      return reply(result.status || 200, result);
    }
    return reply(404, { error: '未找到操作。' });
  } catch (error) {
    // Never log API credentials, signed upload URLs, or private signing keys.
    console.error('Video operation failed:', /^MUX_/.test(error.message) ? error.message : error.name);
    if (error.message === 'MUX_SIGNING_PERMISSION_REQUIRED') return reply(403, { error: 'Mux 当前凭据没有创建播放签名密钥的权限。请为同一 Mux 环境创建 Signing Key，并在 Vercel 配置 MUX_SIGNING_KEY 和 MUX_PRIVATE_KEY 后重新部署。' });
    return reply(502, { error: /^MUX_/.test(error.message) ? '视频服务暂时不可用（' + error.message + '）。' : '处理失败，请稍后重试。' });
  }
};
