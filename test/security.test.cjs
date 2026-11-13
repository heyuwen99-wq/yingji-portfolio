const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {adminAllowed,signPlayback}=require('../lib/security.cjs');
const env={VERCEL_ENV:'preview',UPLOAD_ENABLED:'1',VERCEL_URL:'preview.example.vercel.app',VERCEL_PROJECT_PRODUCTION_URL:'yingji-portfolio.vercel.app'};
const req={headers:{host:env.VERCEL_URL,origin:'https://'+env.VERCEL_URL}};
test('upload routes reject production even when upload flag is set',()=>{assert.equal(adminAllowed(req,{...env,VERCEL_ENV:'production'}),false);});
test('upload routes require same origin and an enabled preview',()=>{
  assert.equal(adminAllowed(req,env),true);
  assert.equal(adminAllowed(req,{...env,UPLOAD_ENABLED:'0'}),false);
  assert.equal(adminAllowed({headers:{...req.headers,origin:'https://attacker.example'}},env),false);
  assert.equal(adminAllowed({headers:{...req.headers,origin:undefined}},env),false);
});
test('playback token binds video, restriction and expiry with a valid RSA signature',()=>{
  const {privateKey,publicKey}=crypto.generateKeyPairSync('rsa',{modulusLength:2048});
  const config={id:'signing-key',private_key:Buffer.from(privateKey.export({type:'pkcs8',format:'pem'})).toString('base64')};
  const token=signPlayback('video-id',config,'restriction-id',1800000000000);
  const [h,p,s]=token.split('.');const payload=JSON.parse(Buffer.from(p,'base64url'));
  assert.deepEqual(payload,{sub:'video-id',aud:'v',exp:1800001200,kid:'signing-key',playback_restriction_id:'restriction-id'});
  assert.equal(crypto.verify('RSA-SHA256',Buffer.from(h+'.'+p),publicKey,Buffer.from(s,'base64url')),true);
  assert.equal(crypto.verify('RSA-SHA256',Buffer.from(h+'.'+p+'x'),publicKey,Buffer.from(s,'base64url')),false);
});
