'use strict';
const fs = require('node:fs');
const path = require('node:path');
const dist = path.join(__dirname, 'dist');
// Publishing original MP4 files would defeat signed playback.
if (fs.existsSync(path.join(dist, 'videos'))) throw new Error('Cloud source must exclude dist/videos.');
fs.mkdirSync(path.join(dist, 'vendor'), { recursive: true });
fs.copyFileSync(require.resolve('hls.js/dist/hls.min.js'), path.join(dist, 'vendor', 'hls.min.js'));
const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'media-manifest.json'), 'utf8'));
fs.writeFileSync(path.join(dist, 'upload-manifest.json'), JSON.stringify(manifest.map(({id,title,category,bytes,original_file})=>({id,title,category,bytes,original_file}))));
