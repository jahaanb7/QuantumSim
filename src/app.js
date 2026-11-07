import { history, equations } from './lessons.js';
import { sampleCloud } from './physics/orbitals.js';
import { mountOrbitalLab } from './lab.js';

const $ = selector => document.querySelector(selector);
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let currentHistory = 0, currentEquation = 0;

function setupTabs(container, items, label, render) {
  container.innerHTML = items.map((item,index)=>`<button id="${label}-tab-${index}" type="button" role="tab" aria-controls="${label}-panel" aria-selected="${index===0}" tabindex="${index===0?0:-1}" data-index="${index}">${label==='history' ? `<span>${item.date}</span><strong>${item.who}</strong>` : `<span>0${index+1}</span><strong>${item.name}</strong><small>${item.short}</small>`}</button>`).join('');
  container.addEventListener('click',event=>{const tab=event.target.closest('[role=tab]');if(tab)render(Number(tab.dataset.index));});
  container.addEventListener('keydown',event=>{
    const tab=event.target.closest('[role=tab]');if(!tab)return;
    let index=Number(tab.dataset.index);
    if(['ArrowDown','ArrowRight'].includes(event.key))index=(index+1)%items.length;
    else if(['ArrowUp','ArrowLeft'].includes(event.key))index=(index+items.length-1)%items.length;
    else if(event.key==='Home')index=0;
    else if(event.key==='End')index=items.length-1;
    else return;
    event.preventDefault();render(index);container.children[index].focus();
  });
}
function selectTab(container,index,panel,label){
  [...container.children].forEach((button,i)=>{button.setAttribute('aria-selected',String(index===i));button.tabIndex=index===i?0:-1;});
  panel.setAttribute('aria-labelledby',`${label}-tab-${index}`);
}
const pagination=(index,total,kind)=>`<div class="lesson-pagination"><button type="button" data-page="-1" ${index===0?'disabled':''}>← Previous</button><span>${String(index+1).padStart(2,'0')} / ${String(total).padStart(2,'0')}</span>${index===total-1?`<a href="#${kind==='history'?'equation':'atom'}">${kind==='history'?'Build the equation':'Open the lab'} ↗</a>`:'<button type="button" data-page="1">Next idea →</button>'}</div>`;
function showHistory(index){
  currentHistory=index;const lesson=history[index],panel=$('#history-panel');
  selectTab($('#timeline'),index,panel,'history');
  panel.innerHTML=`<p class="eyebrow">${lesson.date} / ${lesson.tag}</p><h3>${lesson.title}</h3><p>${lesson.body}</p><figure class="lesson-illustration">${lesson.diagram}</figure><p class="evidence"><strong>The idea to keep.</strong> ${lesson.evidence}</p><div class="lesson-connection"><span aria-hidden="true">↳</span><span>${lesson.connection}</span></div>${pagination(index,history.length,'history')}`;
}
function showEquation(index){
  currentEquation=index;const lesson=equations[index],panel=$('#equation-panel');
  selectTab($('#equation-steps'),index,panel,'equation');
  panel.innerHTML=`<h3>${lesson.title}</h3><div class="formula" aria-label="${lesson.formula.replace(/<[^>]*>/g,' ').replaceAll('&nbsp;',' ')}">${lesson.formula}</div>${lesson.diagram??''}<p>${lesson.body}</p>${lesson.mini?`<div class="mini-derivation">${lesson.mini}</div>`:''}<div class="equation-takeaway">${lesson.takeaway}</div><details><summary>Go a little deeper</summary><p>${lesson.detail}</p></details>${pagination(index,equations.length,'equation')}`;
}
setupTabs($('#timeline'),history,'history',showHistory);
setupTabs($('#equation-steps'),equations,'equation',showEquation);
showHistory(0);showEquation(0);
function handlePagination(panel,handler,current){panel.addEventListener('click',event=>{const button=event.target.closest('[data-page]');if(button){handler(current()+Number(button.dataset.page));panel.focus({preventScroll:true});}});}
handlePagination($('#history-panel'),showHistory,()=>currentHistory);
handlePagination($('#equation-panel'),showEquation,()=>currentEquation);

// Old shared deep links lead to the single, current orbital lab.
if(['#/elements','#/configurations','#/wavefunction'].includes(location.hash))location.replace('#atom');
if(location.hash==='#/learn')location.replace('#history');
const chapterObserver=new IntersectionObserver(entries=>{
  for(const entry of entries){if(entry.isIntersecting){document.querySelectorAll('.masthead nav a').forEach(link=>{const active=link.hash===`#${entry.target.id}`;link.classList.toggle('active',active);if(active)link.setAttribute('aria-current','location');else link.removeAttribute('aria-current');});}}
},{rootMargin:'-15% 0px -60% 0px',threshold:0});
['history','equation','atom'].forEach(id=>chapterObserver.observe(document.getElementById(id)));
let scrollTick=false;
window.addEventListener('scroll',()=>{if(!scrollTick){scrollTick=true;requestAnimationFrame(()=>{$('#progress').style.width=`${100*scrollY/Math.max(1,document.documentElement.scrollHeight-innerHeight)}%`;scrollTick=false;});}},{passive:true});

// An actual sampled orbital introduces the destination before the lessons.
const canvas=$('#hero-orbital'),ctx=canvas.getContext('2d');
const cloud=sampleCloud({n:3,l:2,m:-2,zEff:1,count:18000,seed:19});
function drawHero(){
  if(!ctx)return;
  const {width:w,height:h}=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);
  canvas.width=w*dpr;canvas.height=h*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
  const scale=Math.min(w*.45,h*.42)/cloud.extent,points=[];
  const cy=Math.cos(.26),sy=Math.sin(.26),cx=Math.cos(.72),sx=Math.sin(.72);
  for(let i=0;i<cloud.signs.length;i++){
    const x=cloud.positions[i*3],y=cloud.positions[i*3+1],z=cloud.positions[i*3+2];
    const a=x*cy-z*sy,b=x*sy+z*cy;
    points.push([w*.51+(a*.91-y*.25)*scale,h*.42-(y*cx-b*sx)*scale,y*sx+b*cx,cloud.signs[i]]);
  }
  points.sort((a,b)=>a[2]-b[2]);
  for(const [x,y,z,sign] of points){ctx.fillStyle=sign>0?'rgba(34,110,93,.40)':'rgba(160,104,43,.36)';const r=.55+Math.max(0,Math.min(1,(z/cloud.extent+1)/2))*.45;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();}
  ctx.fillStyle='#536f5d';ctx.beginPath();ctx.arc(w*.51,h*.42,2.1,0,Math.PI*2);ctx.fill();
}
const heroResize=new ResizeObserver(drawHero);heroResize.observe(canvas);
const disposeLab=mountOrbitalLab({reducedMotion});
window.addEventListener('pagehide',()=>{heroResize.disconnect();chapterObserver.disconnect();disposeLab();},{once:true});
