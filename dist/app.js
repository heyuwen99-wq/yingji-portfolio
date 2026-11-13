'use strict';
const films = [
  {id:'nile',title:'尼罗秘语',category:'shorts',duration:'04:28',file:'11月13日.mp4'},
  {id:'citylights',title:'灯火人家',category:'shorts',duration:'03:09',file:'19937_raw.MP4'},
  {id:'fashion',title:'霓裳之下',category:'shorts',duration:'02:48',file:'290_raw.MP4'},
  {id:'lantern',title:'提灯入梦',category:'shorts',duration:'04:59',file:'4674.MP4'},
  {id:'orchid',title:'紫境幽兰',category:'tvc',duration:'00:38',file:'3319.MP4'},
  {id:'rouge',title:'一抹锋芒',category:'tvc',duration:'00:34',file:'5477.MP4'},
  {id:'moon',title:'月满大唐',category:'tvc',duration:'00:55',file:'11月13日 (1).mp4'},
  {id:'coffee',title:'一瞬醒神',category:'tvc',duration:'00:44',file:'5618.MP4'},
  {id:'zongzi',title:'粽游山海',category:'tvc',duration:'01:12',file:'飞书20261113-231403.mp4'},
  {id:'sweetdream',title:'甜梦舞台',category:'mv',duration:'02:53',file:'6536.MP4'}
];
const labels={shorts:'短剧 / 系列短视频',tvc:'TVC',mv:'MV'};
const playIcon='<span class="play-circle" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M6 3.5v17L21 12z"/></svg></span>';
function imageMarkup(f){return `<span class="film-image"><img src="posters/${f.id}.jpg" alt="${f.title}视频封面" loading="lazy" decoding="async">${playIcon}<span class="duration">${f.duration}</span></span>`;}
for(const category of ['shorts','tvc','mv']){
  document.getElementById(category+'-grid').innerHTML=films.filter(f=>f.category===category).map(f=>`<article class="film-card"><button class="film-open" data-film="${f.id}" aria-label="播放《${f.title}》，时长 ${f.duration}">${imageMarkup(f)}<span class="film-meta"><span class="film-title">${f.title}</span></span></button></article>`).join('');
}
const dialog=document.getElementById('player');
const video=document.getElementById('video');
const message=document.getElementById('video-message');
let currentFilm=null;
let returnFocus=null;
let hls=null;
let playbackRequest=0;
function sourceFor(f){return 'videos/'+f.id+'.mp4';}
async function openFilm(id){
  const film=films.find(f=>f.id===id);if(!film)return;
  if(!dialog.open)returnFocus=document.activeElement;
  const request=++playbackRequest;
  currentFilm=film; video.pause(); hls?.destroy();hls=null;message.hidden=true;
  video.removeAttribute('src');video.load();
  document.getElementById('player-title').textContent=film.title;
  document.getElementById('player-category').textContent=labels[film.category]+' / '+film.duration;
  video.poster='posters/'+film.id+'.jpg';
  const group=films.filter(f=>f.category===film.category);
  document.getElementById('next-film').hidden=group.length===1;
  if(!dialog.open)dialog.showModal();
  document.body.classList.add('player-open');
  const play=()=>video.play().catch(e=>{if(e.name!=='AbortError'&&e.name!=='NotAllowedError')showError();});
  if(location.protocol==='file:'||['localhost','127.0.0.1'].includes(location.hostname)){
    video.src=sourceFor(film);video.load();play();return;
  }
  message.textContent='正在加载…';message.hidden=false;
  try{
    const response=await fetch('/api/video?action=playback&id='+encodeURIComponent(film.id),{cache:'no-store'});
    const data=await response.json();
    if(request!==playbackRequest||!dialog.open)return;
    if(!response.ok)throw new Error(data.error||'视频载入失败，请重新打开。');
    if(window.Hls?.isSupported()){
      hls=new Hls({maxBufferLength:30});
      hls.loadSource(data.url);hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED,play);
      hls.on(Hls.Events.ERROR,(_,info)=>{if(info.fatal){console.warn('Video stream error',{type:info.type,detail:info.details,status:info.response?.code||null});showError();}});
    }else if(video.canPlayType('application/vnd.apple.mpegurl')){video.src=data.url;video.load();play();}
    else throw new Error('当前浏览器暂不支持播放，请使用新版浏览器。');
  }catch(error){if(request===playbackRequest&&dialog.open){message.textContent=error.message;message.hidden=false;}}
}
function showError(){if(!dialog.open)return;message.textContent='视频载入失败，请重新打开。';message.hidden=false;}
function closePlayer(){if(dialog.open)dialog.close();}
dialog.addEventListener('close',()=>{++playbackRequest;hls?.destroy();hls=null;video.pause();video.removeAttribute('src');video.load();document.body.classList.remove('player-open');message.hidden=true;returnFocus?.focus({preventScroll:true});});
dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closePlayer();}});
document.getElementById('close-player').addEventListener('click',closePlayer);
document.querySelectorAll('[data-film]').forEach(b=>b.addEventListener('click',()=>openFilm(b.dataset.film)));
document.getElementById('next-film').addEventListener('click',()=>{if(!currentFilm)return;const group=films.filter(f=>f.category===currentFilm.category);openFilm(group[(group.indexOf(currentFilm)+1)%group.length].id);});
video.addEventListener('error',showError);
video.addEventListener('playing',()=>{message.hidden=true;});
