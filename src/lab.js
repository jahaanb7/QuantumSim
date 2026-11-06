import * as THREE from 'three';
import { createCanvasView } from './canvas-view.js';
import { createStage, disposeObject, makeGlowTexture, makeTextSprite } from './stage.js';
import { sampleCloud, radialSummary, orbitalLabel, mLabel, subshellLetter } from './physics/orbitals.js';

const $=selector=>document.querySelector(selector);
const state={n:2,l:1,m:0,z:1};
const count=32000;
const species=['','Hydrogen','Helium ion','Lithium ion'];
const labels=['spherical','two-lobed','d-orbital','f-orbital'];
export function mountOrbitalLab({reducedMotion}){
  let stage=null,software=null,points=null,axes=null,cloud=null,scale=1,visible=true,disposed=false;
  let basePositions=null;
  $('#rotate').checked=!reducedMotion.matches;
  const sprite=makeGlowTexture();
  try{
    stage=createStage($('#stage'),{cameraPosition:[70,45,90],cameraUp:[0,0,1],minDistance:35,maxDistance:220,autoRotate:$('#rotate').checked,autoRotateSpeed:.42});

  }catch(error){
    // The same cloud remains fully interactive on browsers without a GPU.
    $('#stage').replaceChildren();
    try { software=createCanvasView($('#stage'),{autoRotate:$('#rotate').checked}); }
    catch { $('#webgl-fallback').hidden=false; }
  }
  function orbitTitle(){return orbitalLabel(state.n,state.l,state.m).replace('_','<sub>')+(state.l?'</sub>':'');}
  function refreshControls(){
    $('#species').value=String(state.z);$('#charge').textContent=state.z;
    $('#principal').value=state.n;$('#principal-value').value=state.n;
    $('#subshells').innerHTML=[0,1,2,3].map(l=>`<button type="button" data-l="${l}" aria-pressed="${l===state.l}" aria-label="${subshellLetter(l)} subshell, ℓ equals ${l}" ${l>=state.n?'disabled':''}>${subshellLetter(l)}</button>`).join('');
    $('#subshell-help').textContent=`ℓ = ${state.l}. Only ℓ = 0 to n − 1 is allowed.`;
    const order=state.l===0?[0]:Array.from({length:2*state.l+1},(_,i)=>i-state.l);
    $('#orientation').innerHTML=order.map(m=>`<option value="${m}">${state.l===0?'Spherical (s)':`${subshellLetter(state.l)}${mLabel(state.l,m)}`}</option>`).join('');
    $('#orientation').value=String(state.m);$('#orientation').disabled=state.l===0;
    $('#orientation-help').textContent=state.l===0?'An s orbital has no preferred direction.':state.m===0?'The z-oriented real orbital has m = 0.':`This real shape combines m = +${Math.abs(state.m)} and −${Math.abs(state.m)}.`;
    $('#viewport-name').innerHTML=orbitTitle();$('#viewport-state').textContent=`${['','H','He⁺','Li²⁺'][state.z]} · n = ${state.n} · ℓ = ${state.l}`;
    $('#energy').innerHTML=`${(-13.605693*state.z**2/state.n**2).toFixed(2).replace('-','−')} <small>eV</small>`;
    $('#radial-nodes').textContent=state.n-state.l-1;$('#angular-nodes').textContent=state.l;
    $('#orbital-title').innerHTML=`The ${orbitTitle()} orbital`;
    const rn=state.n-state.l-1;
    let explanation=`${state.l===3?'An':'A'} ${labels[state.l]} standing-wave pattern in ${species[state.z].toLowerCase()}. `;
    explanation+=rn?`${rn===1?'One radial node is a spherical surface':`${rn} radial nodes are spherical surfaces`} where the wavefunction is zero. `:'There are no radial nodes in this state. ';
    explanation+=state.l?`${state.l} angular node${state.l===1?' separates':'s separate'} lobes of opposite sign. `:'There are no angular nodes. ';
    explanation+=state.l===1?'The two lobes belong to the same electron state. ':'';
    explanation+='Try the half cutaway to see inside, or change the shell while keeping the subshell.';
    $('#orbital-explanation').textContent=explanation;
    $('#orbital-viewport').setAttribute('aria-label',`${species[state.z]} ${orbitalLabel(state.n,state.l,state.m).replace('_',' ')} orbital, ${rn} radial and ${state.l} angular nodes. Drag to rotate, scroll to zoom, or use arrow keys and plus or minus when focused.`);
  }
  function cutaway(){
    if(software){software.setCutaway($('#cutaway').checked);return;}
    if(!points)return;
    const positions=points.geometry.attributes.position;
    const cut=$('#cutaway').checked;
    for(let i=0;i<count;i++){
      const hide=cut&&basePositions[i*3]>0;
      for(let k=0;k<3;k++)positions.array[i*3+k]=hide?1e6:basePositions[i*3+k];
    }
    positions.needsUpdate=true;
  }
  function renderCloud(){
    if(disposed)return;
    refreshControls();
    cloud=sampleCloud({n:state.n,l:state.l,m:state.m,zEff:state.z,count,seed:120+state.n*35+state.l*8+state.m});
    $('#view-radius').innerHTML=`${cloud.extent95.toFixed(2)} <small>a₀</small>`;
    scale=27/radialSummary(state.n,state.l,1).extent;
    if(software){
      basePositions=Float32Array.from(cloud.positions,x=>x*scale);
      software.setCloud(basePositions,cloud.signs);cutaway();return;
    }
    if(!stage)return;
    if(points){stage.scene.remove(points);points.geometry.dispose();points.material.dispose();}
    if(axes){stage.scene.remove(axes);disposeObject(axes);}
    // Reframe for n/ℓ, but preserve a common length scale when only Z changes.
    scale=27/radialSummary(state.n,state.l,1).extent;
    basePositions=new Float32Array(cloud.positions.length);
    const colours=new Float32Array(count*3),positive=new THREE.Color('#77c5b5'),negative=new THREE.Color('#e4b777');
    for(let i=0;i<count;i++){
      for(let k=0;k<3;k++)basePositions[i*3+k]=cloud.positions[i*3+k]*scale;
      const color=cloud.signs[i]>0?positive:negative;color.toArray(colours,i*3);
    }
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(basePositions.slice(),3));geometry.setAttribute('color',new THREE.BufferAttribute(colours,3));
    const material=new THREE.PointsMaterial({size:.19,map:sprite,vertexColors:true,transparent:true,opacity:.8,depthWrite:false,sizeAttenuation:true,blending:THREE.AdditiveBlending});
    points=new THREE.Points(geometry,material);points.frustumCulled=false;stage.scene.add(points);cutaway();
    axes=new THREE.Group();
    for(const [index,label] of ['x','y','z'].entries()){
      const vector=new THREE.Vector3();vector.setComponent(index,34);
      const axis=new THREE.Line(new THREE.BufferGeometry().setFromPoints([vector.clone().negate(),vector]),new THREE.LineDashedMaterial({color:'#608272',transparent:true,opacity:.35,dashSize:.35,gapSize:.6}));axis.computeLineDistances();axes.add(axis);
      const text=makeTextSprite(label,{color:'#a1b5a3',fontSize:36,height:1.9,opacity:.75});text.position.copy(vector.clone().multiplyScalar(1.02));axes.add(text);
    }
    const nucleus=new THREE.Mesh(new THREE.SphereGeometry(.28,12,8),new THREE.MeshBasicMaterial({color:'#e9e7c8'}));axes.add(nucleus);stage.scene.add(axes);
  }
  $('#species').addEventListener('change',()=>{state.z=Number($('#species').value);renderCloud();});
  $('#principal').addEventListener('input',()=>{state.n=Number($('#principal').value);state.l=Math.min(state.l,state.n-1);state.m=Math.max(-state.l,Math.min(state.l,state.m));renderCloud();});
  $('#subshells').addEventListener('click',event=>{const button=event.target.closest('[data-l]');if(!button||button.disabled)return;state.l=Number(button.dataset.l);state.m=0;renderCloud();});
  $('#orientation').addEventListener('change',()=>{state.m=Number($('#orientation').value);renderCloud();});
  function preset(n,l,m){Object.assign(state,{n,l,m});renderCloud();}
  document.querySelectorAll('[data-preset]').forEach(button=>button.addEventListener('click',()=>preset(...button.dataset.preset.split(',').map(Number))));
  $('#cutaway').addEventListener('change',cutaway);
  $('#rotate').addEventListener('change',()=>{if(stage)stage.controls.autoRotate=$('#rotate').checked;if(software)software.setAutoRotate($('#rotate').checked);});
  $('#reset-view').addEventListener('click',()=>{if(software)software.reset();if(stage){stage.camera.position.set(70,45,90);stage.controls.target.set(0,0,0);stage.controls.update();}});
  const motionChange=()=>{if(reducedMotion.matches){$('#rotate').checked=false;if(stage)stage.controls.autoRotate=false;if(software)software.setAutoRotate(false);}};
  reducedMotion.addEventListener('change',motionChange);
  $('#orbital-viewport').addEventListener('keydown',event=>{
    if(software){software.key(event);return;}
    if(!stage)return;const {camera,controls}=stage;
    const upToY=new THREE.Quaternion().setFromUnitVectors(camera.up,new THREE.Vector3(0,1,0));
    const spherical=new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target).applyQuaternion(upToY));
    const changes={ArrowLeft:[-.12,0],ArrowRight:[.12,0],ArrowUp:[0,-.12],ArrowDown:[0,.12]};
    if(changes[event.key]){spherical.theta+=changes[event.key][0];spherical.phi+=changes[event.key][1];spherical.makeSafe();}
    else if(['+','=','-','_'].includes(event.key))spherical.radius=THREE.MathUtils.clamp(spherical.radius*(event.key==='-'||event.key==='_'?1.1:.9),controls.minDistance,controls.maxDistance);
    else return;
    event.preventDefault();camera.position.setFromSpherical(spherical).applyQuaternion(upToY.invert()).add(controls.target);controls.update();
  });
  document.querySelectorAll('[data-challenge]').forEach(button=>button.addEventListener('click',()=>{
    document.querySelectorAll('[data-challenge]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
    $('#cutaway').checked=false;
    let message='';state.z=1;
    if(button.dataset.challenge==='nodes'){
      preset(2,0,0);$('#cutaway').checked=true;cutaway();
      message='You’re looking inside 2s. Find the spherical gap separating opposite signs: its radial node is at r = 2a₀ for hydrogen. Compare with 1s, which has no radial node. Both are s orbitals; raising n introduces a new radial pattern.';
    }else if(button.dataset.challenge==='shape'){
      preset(3,2,-2);message='Start with 3d, then choose s or p without moving the n = 3 shell slider. The shape and split between radial and angular nodes change, but the total stays n − 1 = 2. In this one-electron model, all three have the same energy.';
    }else{
      preset(2,1,0);message='Start with hydrogen 2p, then select He⁺ or Li²⁺. The camera scale stays fixed for this comparison: a stronger nuclear charge pulls the cloud inward. Its characteristic size scales as 1/Z, while the binding energy scales as Z².';
    }
    $('#challenge-text').textContent=message;
    $('#orbital-viewport').scrollIntoView({behavior:reducedMotion.matches?'instant':'smooth',block:'center'});
  }));
  renderCloud();
  const view=stage||software;
  if(view){
    view.start();
    const visibility=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;updateRunning();},{rootMargin:'100px'});visibility.observe($('#orbital-viewport'));
    function updateRunning(){if(document.hidden||!visible)view.stop();else view.start();}
    document.addEventListener('visibilitychange',updateRunning);
    return ()=>{disposed=true;visibility.disconnect();document.removeEventListener('visibilitychange',updateRunning);reducedMotion.removeEventListener('change',motionChange);view.dispose();sprite.dispose();};
  }
  return ()=>{disposed=true;sprite.dispose();reducedMotion.removeEventListener('change',motionChange);};
}
