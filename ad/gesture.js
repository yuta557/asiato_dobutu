/* なぞった形の判定：まっすぐ・ギザギザ・まる・さんかく・しかく・ぐるぐる
   - ぐるぐる：線がぜんぶで何回まわったか（手ぶれは打ち消しあうので、そのまま数える）
   - まる・さんかく・しかく：線をつつむ凸包の中に、いちばん大きな三角形・四角形がどれだけ入るか
     （まるなら三角41%・四角64%、さんかくなら三角ほぼ100%。つぶれた形でも比率は変わらない） */
(function(){
"use strict";
var AD=window.AD,PI=Math.PI,TAU=PI*2;

function pathLen(p){var L=0;for(var i=1;i<p.length;i++)L+=Math.hypot(p[i].x-p[i-1].x,p[i].y-p[i-1].y);return L;}
function resample(p,n){
  var I=pathLen(p)/(n-1),D=0,out=[{x:p[0].x,y:p[0].y}],pts=p.slice();
  for(var i=1;i<pts.length;i++){
    var d=Math.hypot(pts[i].x-pts[i-1].x,pts[i].y-pts[i-1].y);
    if(D+d>=I&&d>0){
      var k=(I-D)/d,q={x:pts[i-1].x+k*(pts[i].x-pts[i-1].x),y:pts[i-1].y+k*(pts[i].y-pts[i-1].y)};
      out.push(q);pts.splice(i,0,q);D=0;
    }else D+=d;
  }
  while(out.length<n)out.push({x:p[p.length-1].x,y:p[p.length-1].y});
  return out.slice(0,n);
}
function wrap(a){while(a>PI)a-=TAU;while(a<-PI)a+=TAU;return a;}
function smoothPts(R){
  var out=[R[0]];
  for(var i=1;i<R.length-1;i++)out.push({x:(R[i-1].x+2*R[i].x+R[i+1].x)/4,y:(R[i-1].y+2*R[i].y+R[i+1].y)/4});
  out.push(R[R.length-1]);return out;
}
/* 一定間隔ごとに点を残す（こまかすぎる点をまとめる） */
function decimate(p,step){
  var out=[p[0]];
  for(var i=1;i<p.length;i++){var l=out[out.length-1];if(Math.hypot(p[i].x-l.x,p[i].y-l.y)>=step)out.push(p[i]);}
  return out;
}
function loopsOf(p){
  var total=0,prev=null;
  for(var i=1;i<p.length;i++){
    var a=Math.atan2(p[i].y-p[i-1].y,p[i].x-p[i-1].x);
    if(prev!==null)total+=wrap(a-prev);
    prev=a;
  }
  return Math.abs(total)/TAU;
}
function cross(o,a,b){return (a.x-o.x)*(b.y-o.y)-(a.y-o.y)*(b.x-o.x);}
function hull(pts){
  var p=pts.slice().sort(function(a,b){return a.x-b.x||a.y-b.y;});
  if(p.length<3)return p;
  var lo=[],up=[];
  p.forEach(function(q){while(lo.length>=2&&cross(lo[lo.length-2],lo[lo.length-1],q)<=0)lo.pop();lo.push(q);});
  for(var i=p.length-1;i>=0;i--){var q=p[i];while(up.length>=2&&cross(up[up.length-2],up[up.length-1],q)<=0)up.pop();up.push(q);}
  up.pop();lo.pop();return lo.concat(up);
}
function area(poly){var s=0;for(var i=0;i<poly.length;i++){var a=poly[i],b=poly[(i+1)%poly.length];s+=a.x*b.y-b.x*a.y;}return Math.abs(s)/2;}
function tri(a,b,c){return Math.abs(cross(a,b,c))/2;}
function bestFit(H){
  var n=H.length,b3=0,b4=0,i,j,k,l;
  for(i=0;i<n;i++)for(j=i+1;j<n;j++)for(k=j+1;k<n;k++){
    var t=tri(H[i],H[j],H[k]);if(t>b3)b3=t;
    for(l=k+1;l<n;l++){var q=tri(H[i],H[j],H[k])+tri(H[i],H[k],H[l]);if(q>b4)b4=q;}
  }
  return {t:b3,q:b4};
}
/* 角の数（ギザギザ用）：まわりより大きく曲がっているところ */
function openCorners(R){
  R=smoothPts(smoothPts(R));
  var n=R.length,k=3,flag=[];
  for(var i=0;i<n;i++){
    if(i<k||i>=n-k){flag[i]=false;continue;}
    var a=R[i-k],b=R[i],c=R[i+k],v1x=b.x-a.x,v1y=b.y-a.y,v2x=c.x-b.x,v2y=c.y-b.y,l1=Math.hypot(v1x,v1y),l2=Math.hypot(v2x,v2y);
    flag[i]=l1>1e-6&&l2>1e-6&&Math.acos(AD.clamp((v1x*v2x+v1y*v2y)/(l1*l2),-1,1))>1.15;
  }
  var c2=0;for(i=1;i<n;i++)if(flag[i]&&!flag[i-1])c2++;
  return c2;
}

AD.shapeInfo=function(pts){
  if(!pts||pts.length<3)return null;
  var L=pathLen(pts);if(L<40)return null;
  var minX=1e9,maxX=-1e9,minY=1e9,maxY=-1e9;
  pts.forEach(function(q){minX=Math.min(minX,q.x);maxX=Math.max(maxX,q.x);minY=Math.min(minY,q.y);maxY=Math.max(maxY,q.y);});
  var D=Math.hypot(maxX-minX,maxY-minY)||1;
  var dec=decimate(pts,Math.max(3,L/400)),loops=loopsOf(smoothPts(smoothPts(decimate(pts,AD.clamp(L/120,4,10)))));
  var R=resample(pts,64),Rs=smoothPts(smoothPts(R)),Ls=pathLen(Rs);
  var gap=Math.hypot(pts[pts.length-1].x-pts[0].x,pts[pts.length-1].y-pts[0].y);
  var info={loops:loops,gapD:gap/D,straight:gap/Ls};
  if(loops>=1.5){info.shape="spiral";return info;}
  if(info.straight>.8&&loops<.3){info.shape="line";return info;}
  var closed=info.gapD<.28||(info.gapD<.6&&loops>.5);
  if(closed){
    /* 手ぶれで外側にふくらまないよう、ならした線でつつむ */
    var H=hull(smoothPts(smoothPts(resample(pts,96))));
    if(H.length>36){var step=H.length/36,sub=[];for(var i=0;i<36;i++)sub.push(H[Math.floor(i*step)]);H=sub;}
    var A=area(H)||1,f=bestFit(H);
    info.r3=f.t/A;info.r4=f.q/A;
    /* まるは 三角41%・四角64%。角がまるくなった さんかく・しかくも拾えるよう、まるとの間でわける */
    info.shape=info.r3>=.72?"triangle":info.r4>=.8?"square":"circle";
    return info;
  }
  info.shape=openCorners(R)>=2?"zigzag":"line";
  return info;
};
AD.shapeOf=function(pts){var i=AD.shapeInfo(pts);return i?i.shape:null;};
AD.SHAPE_NAME={line:"まっすぐ",zigzag:"ギザギザ",circle:"まる",triangle:"さんかく",square:"しかく",spiral:"ぐるぐる"};
})();
