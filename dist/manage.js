'use strict';
let manifest=[],selected=new Map(),busy=false,canUpload=false;
const notice=document.getElementById('notice');
const stateLabels={ready:'已就绪',preparing:'正在转码',errored:'转码失败'};
function rowState(id,text,percent){
  const row=document.getElementById('row-'+id);if(!row)return;
  row.querySelector('.state').textContent=text;
  const progress=row.querySelector('progress');progress.hidden=percent===undefined;if(percent!==undefined)progress.value=percent;
}
async function api(action,body){
  const response=await fetch('/api/video?action='+action,{cache:'no-store',...(body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})});
  const data=await response.json();if(!response.ok)throw new Error(data.error||'请求失败，请稍后重试。');return data;
}
async function refresh(){
  try{const data=await api('status');canUpload=data.uploadsEnabled;
    for(const f of data.films)rowState(f.id,f.asset?(stateLabels[f.asset.status]||f.asset.status):(selected.has(f.id)?'已选择':'等待选择'));
    const ready=data.films.filter(f=>f.asset?.status==='ready').length;
    notice.textContent=canUpload?`已就绪 ${ready} / 10 个作品`:'上传入口当前未开放。';
    document.getElementById('start').disabled=busy||!canUpload||!selected.size;
    return data;
  }catch(error){notice.textContent=error.message;throw error;}
}
function send(url,blob,range,onProgress){
  return new Promise((resolve,reject)=>{
    const xhr=new XMLHttpRequest();xhr.open('PUT',url);xhr.timeout=180000;
    xhr.setRequestHeader('Content-Type','video/mp4');xhr.setRequestHeader('Content-Range',range);
    if(onProgress)xhr.upload.onprogress=e=>onProgress(e.loaded);
    xhr.onload=()=>[200,201,308].includes(xhr.status)?resolve({status:xhr.status,range:xhr.getResponseHeader('Range')}):reject(new Error('上传服务返回 '+xhr.status));
    xhr.onerror=()=>reject(new Error('网络连接中断'));xhr.ontimeout=()=>reject(new Error('上传超时'));xhr.send(blob);
  });
}
async function uploadFile(film,file,url){
  const chunk=8*1024*1024;let offset=0,retries=0;
  // Query the resumable session first, including when recovering after a page refresh.
  const query=await send(url,new Blob([]),'bytes */'+file.size);
  if(query.status===200||query.status===201)return;
  if(query.range)offset=Number(query.range.split('-').pop())+1;
  while(offset<file.size){
    const end=Math.min(offset+chunk,file.size);
    try{
      await send(url,file.slice(offset,end),`bytes ${offset}-${end-1}/${file.size}`,loaded=>{
        const percent=Math.min(100,(offset+loaded)/file.size*100);rowState(film.id,`上传中 ${Math.floor(percent)}%`,percent);
      });offset=end;retries=0;
    }catch(error){
      if(++retries>3)throw error;rowState(film.id,'网络重试…',offset/file.size*100);
      await new Promise(resolve=>setTimeout(resolve,1000*retries));
      const check=await send(url,new Blob([]),'bytes */'+file.size);
      if(check.status===200||check.status===201)return;
      if(check.range)offset=Number(check.range.split('-').pop())+1;
    }
  }
}
document.getElementById('files').addEventListener('change',event=>{
  selected=new Map();const unmatched=[];
  for(const file of event.target.files){const film=manifest.find(f=>[f.original_file.toLowerCase(),f.id+'.mp4'].includes(file.name.toLowerCase())&&f.bytes===file.size);
    if(film)selected.set(film.id,file);else unmatched.push(file.name);}
  for(const f of manifest)rowState(f.id,selected.has(f.id)?'已选择':'等待选择');
  notice.textContent=`已选择 ${selected.size} 个匹配的作品`+(unmatched.length?'；未匹配：'+unmatched.join('、'):'');
  document.getElementById('start').disabled=busy||!canUpload||!selected.size;
});
document.getElementById('refresh').addEventListener('click',()=>refresh().catch(()=>{}));
document.getElementById('start').addEventListener('click',async()=>{
  busy=true;document.getElementById('start').disabled=true;document.getElementById('files').disabled=true;
  try{
    notice.textContent='正在准备上传…';await api('setup',{});
    for(const film of manifest){const file=selected.get(film.id);if(!file)continue;
      notice.textContent='正在上传：'+film.title;rowState(film.id,'准备中',0);
      const upload=await api('upload',{id:film.id,bytes:file.size});
      if(upload.existing){rowState(film.id,stateLabels[upload.existing.status]||upload.existing.status);continue;}
      await uploadFile(film,file,upload.url);rowState(film.id,'上传完成，正在转码');
    }
    notice.textContent='所选视频已上传，正在等待转码。';
    for(let i=0;i<60;i++){await new Promise(resolve=>setTimeout(resolve,10000));const data=await refresh();if(data.films.every(f=>f.asset?.status==='ready')){notice.textContent='10 个作品全部上传完成，可以播放。';break;}}
  }catch(error){notice.textContent=error.message.replace(/[。．.]+$/,'')+'。保留文件选择后可重试，已完成的作品不会重复上传。';}
  finally{busy=false;document.getElementById('files').disabled=false;document.getElementById('start').disabled=!canUpload||!selected.size;}
});
window.addEventListener('beforeunload',event=>{if(busy){event.preventDefault();event.returnValue='';}});
(async()=>{try{
  const response=await fetch('upload-manifest.json');manifest=await response.json();
  const list=document.getElementById('list');
  for(const film of manifest){const row=document.createElement('div');row.className='row';row.id='row-'+film.id;
    const name=document.createElement('span');name.textContent=film.title+' ';const size=document.createElement('small');size.textContent=(film.bytes/1000000).toFixed(1)+' MB';name.append(size);
    const status=document.createElement('span');status.className='state';status.textContent='等待选择';
    const progress=document.createElement('progress');progress.max=100;progress.value=0;progress.hidden=true;row.append(name,status,progress);list.append(row);}
  await refresh();
}catch(error){notice.textContent=error.message;}})();
