import test from 'node:test';
import assert from 'node:assert/strict';
import { radialFunction, radialSummary, radialZeros, sampleCloud, angularShape } from '../src/physics/orbitals.js';
const close=(a,b,tolerance=1e-3)=>assert.ok(Math.abs(a-b)<tolerance,`${a} should be within ${tolerance} of ${b}`);
test('Coulomb radial functions are normalized for all UI shells and subshells',()=>{
  for(let n=1;n<=4;n++)for(let l=0;l<n;l++){
    let integral=0;const dr=.01;
    for(let r=dr/2;r<180;r+=dr)integral+=r*r*radialFunction(n,l,1,r)**2*dr;
    close(integral,1,2e-4);
    close(radialSummary(n,l,1).mean,(3*n*n-l*(l+1))/2,.003);
  }
});
test('radial node count excludes the origin for non-s states',()=>{
  for(let n=1;n<=4;n++)for(let l=0;l<n;l++)assert.equal(radialZeros(n,l,1).length,n-l-1,`n=${n}, l=${l}`);
  close(radialZeros(2,0,1)[0],2,.002);
});
test('nuclear charge contracts every coordinate by 1/Z',()=>{
  const args={n:3,l:2,m:-2,count:2000,seed:18};
  const h=sampleCloud({...args,zEff:1}),he=sampleCloud({...args,zEff:2});
  h.positions.forEach((x,i)=>close(x/2,he.positions[i],1e-5));
  close(h.extent95/2,he.extent95,1e-8);
  assert.deepEqual(h.signs,he.signs);
});
test('seeded s cloud is isotropic and p-z cloud has the expected angular moment',()=>{
  for(const [l,expected] of [[0,1/3],[1,3/5]]){
    const c=sampleCloud({n:2,l,m:0,count:45000,seed:56});let moment=0;
    for(let i=0;i<c.signs.length;i++){
      const [x,y,z]=c.positions.subarray(i*3,i*3+3);moment+=z*z/(x*x+y*y+z*z);
    }
    close(moment/c.signs.length,expected,.008);
  }
});
test('real orbital signs change across angular and radial nodes',()=>{
  assert.ok(angularShape(1,0,.8,.6,1,0)>0);
  assert.ok(angularShape(1,0,-.8,.6,1,0)<0);
  assert.ok(radialFunction(2,0,1,1)>0);
  assert.ok(radialFunction(2,0,1,3)<0);
});
test('all available real orbitals sample finite points with both signs where expected',()=>{
  for(let n=1;n<=4;n++)for(let l=0;l<n;l++)for(let m=-l;m<=l;m++){
    const cloud=sampleCloud({n,l,m,count:400,seed:28});
    assert.ok(cloud.positions.every(Number.isFinite));
    assert.ok(cloud.extent95>0);
    if(n>1)assert.equal(new Set(cloud.signs).size,2,`${n}, ${l}, ${m}`);
  }
});
test('invalid quantum numbers and charges are rejected before sampling',()=>{
  for(const args of [{n:0,l:0},{n:2,l:2},{n:2,l:1,m:2},{n:1,l:0,zEff:0},{n:1,l:0,count:-1}]){
    assert.throws(()=>sampleCloud(args),RangeError);
  }
});
