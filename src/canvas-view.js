/** Software projection of the same 3D orbital samples when WebGL is unavailable. */
export function createCanvasView(container,{autoRotate=false}={}){
  const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d',{alpha:false});
  if(!ctx)throw new Error('Canvas is unavailable.');
  canvas.setAttribute('aria-hidden','true');container.appendChild(canvas);
  let width=1,height=1,dpr=1,yaw=.65,pitch=.23,zoom=1,positions=null,signs=null,cut=false;
  let rotating=autoRotate,drag=null,raf=0,running=false,last=0,dirty=true,disposed=false;
  function resize(){width=container.clientWidth;height=container.clientHeight;dpr=Math.min(devicePixelRatio||1,2);canvas.width=width*dpr;canvas.height=height*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);dirty=true;}
  const observer=new ResizeObserver(resize);observer.observe(container);resize();
  function project(x,y,z){
    const cy=Math.cos(yaw),sy=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch);
    const a=x*cy-y*sy,b=x*sy+y*cy,c=z*cp-b*sp,depth=z*sp+b*cp;
    const perspective=115/(115-depth),scale=Math.min(width,height)*.0108*zoom;
    return [width*.5+a*scale*perspective,height*.51-c*scale*perspective,perspective,depth];
  }
  function draw(){
    if(!positions||width<2||height<2)return;
    ctx.fillStyle='#102d29';ctx.fillRect(0,0,width,height);
    ctx.strokeStyle='#60827255';ctx.lineWidth=.6;ctx.setLineDash([2,4]);ctx.font='10px monospace';ctx.fillStyle='#9ab4a3';
    for(let axis=0;axis<3;axis++){
      const a=[0,0,0],b=[0,0,0];a[axis]=-34;b[axis]=34;
      const p=project(...a),q=project(...b);ctx.beginPath();ctx.moveTo(p[0],p[1]);ctx.lineTo(q[0],q[1]);ctx.stroke();ctx.fillText(['x','y','z'][axis],q[0]+4,q[1]);
    }
    ctx.setLineDash([]);
    // Position samples are translucent, not solid surfaces: two colour batches
    // are sufficient and avoid a large per-frame depth sort on software paths.
    for(const sign of [1,-1]){
      ctx.fillStyle=sign>0?'rgba(119,197,181,.44)':'rgba(228,183,119,.44)';
      for(let i=0;i<signs.length;i++){
        if(signs[i]!==sign||(cut&&positions[i*3]>0))continue;
        const p=project(positions[i*3],positions[i*3+1],positions[i*3+2]);
        const size=Math.max(.55,Math.min(1.65,p[2]*.85));
        ctx.fillRect(p[0],p[1],size,size);
      }
    }
    ctx.fillStyle='#e9e7c8';ctx.beginPath();ctx.arc(width/2,height*.51,1.5,0,2*Math.PI);ctx.fill();
  }
  function loop(time){
    if(disposed||!running)return;
    raf=requestAnimationFrame(loop);
    if(time-last<33)return;
    const dt=Math.min(.07,(time-last)/1000);last=time;
    if(rotating&&!drag){yaw+=dt*.1;dirty=true;}
    if(dirty){draw();dirty=false;}
  }
  function start(){if(running||disposed)return;running=true;last=performance.now();dirty=true;raf=requestAnimationFrame(loop);}
  function stop(){running=false;cancelAnimationFrame(raf);}
  const pointerDown=event=>{drag=[event.clientX,event.clientY];canvas.setPointerCapture(event.pointerId);};
  const pointerMove=event=>{if(!drag)return;yaw+=(event.clientX-drag[0])*.007;pitch=Math.max(-1.4,Math.min(1.4,pitch+(event.clientY-drag[1])*.007));drag=[event.clientX,event.clientY];dirty=true;};
  const pointerUp=()=>{drag=null;};
  const wheel=event=>{event.preventDefault();zoom=Math.max(.5,Math.min(2.8,zoom*Math.exp(-event.deltaY*.001)));dirty=true;};
  canvas.addEventListener('pointerdown',pointerDown);canvas.addEventListener('pointermove',pointerMove);canvas.addEventListener('pointerup',pointerUp);canvas.addEventListener('pointercancel',pointerUp);canvas.addEventListener('wheel',wheel,{passive:false});
  return {
    setCloud(p,s){positions=p;signs=s;dirty=true;},
    setCutaway(value){cut=value;dirty=true;},
    setAutoRotate(value){rotating=value;},
    reset(){yaw=.65;pitch=.23;zoom=1;dirty=true;},
    key(event){
      const changes={ArrowLeft:-.12,ArrowRight:.12};
      if(event.key in changes)yaw+=changes[event.key];
      else if(event.key==='ArrowUp')pitch=Math.max(-1.4,pitch-.12);
      else if(event.key==='ArrowDown')pitch=Math.min(1.4,pitch+.12);
      else if(['+','=','-','_'].includes(event.key))zoom=Math.max(.5,Math.min(2.8,zoom*((event.key==='-' || event.key==='_') ? .9 : 1.1)));
      else return;
      event.preventDefault();dirty=true;
    },
    start,stop,
    dispose(){disposed=true;stop();observer.disconnect();canvas.remove();}
  };
}
