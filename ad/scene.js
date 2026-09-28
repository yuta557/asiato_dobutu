/* 草原：空・丘・花・池・木・しげみ・雲 */
(function(){
"use strict";
var AD=window.AD,PI=Math.PI,TAU=PI*2;
var S=AD.scene={bg:null,W:0,H:0,horizon:0,top:0,bottom:0,flowers:[],bushes:[],pond:null,clouds:[]};
function rng(seed){return function(){seed=(seed*16807)%2147483647;return (seed-1)/2147483646;};}
function sprite(w,h,R,fn){var c=document.createElement("canvas");c.width=Math.ceil(w*R);c.height=Math.ceil(h*R);var g=c.getContext("2d");g.scale(R,R);fn(g);c.w=w;c.h=h;return c;}

function band(g,W,H,y0,amp,col,r,waves){
  var ph=r()*TAU;g.fillStyle=col;g.beginPath();g.moveTo(0,H);
  for(var x=0;x<=W+10;x+=10)g.lineTo(x,y0-amp*(.5+.5*Math.sin(x/W*waves*PI+ph)));
  g.lineTo(W,H);g.closePath();g.fill();
}
function hatch(g,x0,y0,w,h,n,cols,r){
  g.lineCap="round";
  for(var i=0;i<n;i++){
    var x=x0+r()*w,y=y0+r()*h,l=4+r()*9,a=-.95+(r()-.5)*.4;
    g.strokeStyle=cols[i%cols.length];g.lineWidth=.8+r()*.8;
    g.beginPath();g.moveTo(x,y);g.lineTo(x+Math.cos(a)*l,y+Math.sin(a)*l);g.stroke();
  }
}
S.depth=function(y){return .70+.30*AD.clamp((y-S.top)/(S.bottom-S.top),0,1);};
S.inPond=function(x,y,pad){var p=S.pond;if(!p)return false;var k=pad||1.25;return Math.pow((x-p.x)/(p.rx*k),2)+Math.pow((y-p.y)/(p.ry*k*1.6),2)<1;};
S.randomSpot=function(margin){
  margin=margin||30;
  for(var i=0;i<20;i++){
    var x=margin+Math.random()*(S.W-margin*2),y=S.top+Math.random()*(S.bottom-S.top);
    if(!S.inPond(x,y))return {x:x,y:y};
  }
  return {x:S.W/2,y:(S.top+S.bottom)/2};
};
/* あそぶ場所：しげみ・案内の文字・池にかぶらないか */
S.textRects=[];
function overlap(a,b){return a.l<b.r&&a.r>b.l&&a.t<b.b&&a.b>b.t;}
S.clear=function(x,y,u){
  if(x<1.1*u||x>S.W-1.1*u||y<S.top||y>S.bottom)return false;
  if(S.inPond(x,y,1.3))return false;
  var o={l:x-1.1*u,r:x+1.1*u,t:y-2.6*u,b:y+.25*u};
  for(var i=0;i<S.bushes.length;i++){var b=S.bushes[i];if(overlap(o,{l:b.x-b.img.w/2,r:b.x+b.img.w/2,t:b.y-b.img.h,b:b.y+6}))return false;}
  for(var j=0;j<S.textRects.length;j++)if(overlap(o,S.textRects[j]))return false;
  return true;
};
/* みんなで横にならぶ あそび用：その高さの横一線が、池や案内の文字にかからないか（しげみは前後に重なるだけなのでよい） */
S.laneOK=function(y,x0,x1,u,wet){
  var a=Math.min(x0,x1),b=Math.max(x0,x1);
  for(var x=a;x<=b;x+=u*.6){
    /* あそび中は 水の中も 走れる（ぱしゃぱしゃ して おそくなるだけ）ので、
       コースを とるときは 池を よけなくてよい */
    if(!wet&&S.inPond(x,y,1.25))return false;
    var o={l:x-1.1*u,r:x+1.1*u,t:y-2.6*u,b:y+.25*u};
    for(var j=0;j<S.textRects.length;j++)if(overlap(o,S.textRects[j]))return false;
  }
  return true;
};
S.segClear=function(a,b,u){for(var i=0;i<=6;i++){var k=i/6;if(!S.clear(a.x+(b.x-a.x)*k,a.y+(b.y-a.y)*k,u))return false;}return true;};
S.safeSpot=function(u,near,test){
  var best=null,bd=1e9;
  for(var i=0;i<40;i++){
    var p={x:1.1*u+Math.random()*(S.W-2.2*u),y:S.top+Math.random()*(S.bottom-S.top)};
    if(!S.clear(p.x,p.y,u)||(test&&!test(p)))continue;
    var d=near?Math.hypot(p.x-near.x,p.y-near.y):Math.random();
    if(d<bd){bd=d;best=p;}
  }
  return best;
};
S.pondSpot=function(fromX){var p=S.pond,side=fromX<p.x?-1:1;return {x:p.x+side*(p.rx+18),y:p.y+p.ry*.2,face:-side};};

/* ---- かくれんぼの しげみ（最初と同じ 2つ・位置も固定）----
   どうぶつと前後が入れかわる */
function buildCovers(W,H,R){
  var br=AD.clamp(Math.min(W,H)*.085,32,130);
  /* 右の しげみは、よーいどんの ゴールの はた（はしから 体1.3個ぶん）に かぶらない ように 左へ。
     ちいさい ボードでも かぶらないよう、はたの 手前で 止める */
  var uu=AD.clamp(Math.min(W,H)*.072,24,110),bw=br*.9*1.6;
  var bx=Math.min(W*.79,W-uu*1.9-bw);
  var covers=[{kind:"bush",x:W*.22,y:H*.58,r:br},{kind:"bush",x:bx,y:H*.86,r:br*.9}];
  covers.forEach(function(b,bi){
    b.img=sprite(b.r*3.2,b.r*2.1,R,function(bg){
      var cx=b.r*1.6,cy=b.r*2.05,bp=new Path2D();
      [[-.95,-.45,.55],[-.45,-.95,.68],[.25,-1.05,.7],[.85,-.55,.6],[0,-.5,.8]].forEach(function(o){AD.circle(bp,cx+o[0]*b.r,cy+o[1]*b.r,o[2]*b.r);});
      bp.rect(cx-1.4*b.r,cy-.5*b.r,2.8*b.r,.5*b.r);
      bg.fillStyle="#8CC269";bg.fill(bp);
      bg.save();bg.clip(bp);hatch(bg,cx-1.6*b.r,cy-2*b.r,3.2*b.r,2.1*b.r,160,["rgba(88,146,62,.45)","rgba(255,255,255,.28)"],rng(20+bi));bg.restore();
      bg.fillStyle="#E8697A";[[-.6,-.9],[.3,-1.3],[.8,-.6],[-.1,-.45]].forEach(function(o){bg.beginPath();bg.arc(cx+o[0]*b.r,cy+o[1]*b.r,2.6,0,TAU);bg.fill();});
    });
    b.hide={x:b.x+(bi?-.2:.1)*b.r,y:b.y-3};
    b.hidePoint=function(){return {x:b.hide.x,y:b.hide.y};};
    b.seekSpot=function(fromX){var side=fromX<b.x?-1:1;return {x:b.x+side*b.r*1.6,y:b.y+8};};
    b.viaFor=function(){return null;};
  });
  S.bushes=covers;
}
S.build=function(W,H,R){
  S.W=W;S.H=H;S.horizon=Math.round(H*.25);S.top=H*.40;S.bottom=H-10;
  var c=S.bg||document.createElement("canvas");S.bg=c;
  c.width=Math.round(W*R);c.height=Math.round(H*R);
  var g=c.getContext("2d");g.setTransform(R,0,0,R,0,0);
  var r=rng(11),hz=S.horizon;
  var sky=g.createLinearGradient(0,0,0,hz+30);sky.addColorStop(0,"#CBE6F3");sky.addColorStop(1,"#EFF7E8");
  g.fillStyle=sky;g.fillRect(0,0,W,hz+40);
  band(g,W,H,hz+8,H*.07,"#D2E6B4",r,2.4);
  /* 木（丘の上） */
  var tx=W*.09,ty=hz+10,ts=AD.clamp(Math.min(W,H)*.09,34,140);
  g.fillStyle="#9C7352";g.fillRect(tx-ts*.07,ty-ts*.9,ts*.14,ts*.95);
  var can=new Path2D();
  [[-.35,-1.1,.42],[.3,-1.15,.45],[0,-1.5,.5],[-.05,-1.05,.45]].forEach(function(b){AD.circle(can,tx+b[0]*ts,ty+b[1]*ts,b[2]*ts);});
  g.fillStyle="#98C878";g.fill(can);
  g.save();g.clip(can);hatch(g,tx-ts*.9,ty-ts*2.1,ts*1.8,ts*1.6,110,["rgba(96,150,70,.35)","rgba(255,255,255,.25)"],r);g.restore();
  band(g,W,H,hz+22,H*.05,"#C3DD9F",r,3.3);
  var m=g.createLinearGradient(0,hz+20,0,H);m.addColorStop(0,"#D3E8AF");m.addColorStop(1,"#E6F1CF");
  band(g,W,H,hz+34,H*.02,m,r,5.1);
  hatch(g,0,hz,W,H-hz,Math.round(W*H/700),["rgba(118,168,86,.06)","rgba(255,255,255,.12)","rgba(150,190,110,.06)"],r);
  /* 池 */
  var prx=AD.clamp(W*.085,48,240),p=S.pond={x:W*.80,y:H*.52,rx:prx,ry:prx*.30};
  g.fillStyle="#B5DDEF";g.strokeStyle="#92C6DC";g.lineWidth=2;
  g.beginPath();g.ellipse(p.x,p.y,p.rx,p.ry,0,0,TAU);g.fill();g.stroke();
  g.strokeStyle="rgba(255,255,255,.75)";g.lineWidth=1.4;
  [[-.35,-.2,.25],[.2,.15,.3],[.3,-.35,.15]].forEach(function(w){g.beginPath();g.ellipse(p.x+w[0]*p.rx,p.y+w[1]*p.ry,w[2]*p.rx,w[2]*p.ry*.5,0,PI*1.1,PI*1.9);g.stroke();});
  g.strokeStyle="#7FAF5E";g.lineWidth=1.6;
  [-1,-.92,.9,.97].forEach(function(k,i){var x=p.x+k*p.rx,y=p.y+(i%2?.1:-.2)*p.ry;AD.line(g,x,y,x+(k<0?-3:3),y-16-i*3);});
  /* 草・花 */
  S.flowers=[];
  /* 画面が 大きい ときは、草や 花も おなじ わりあいで 大きくする */
  var sc=AD.clamp(Math.min(W,H)/560,.8,3);
  for(var i=0;i<150;i++){
    var gx=r()*W,gy=hz+30+r()*(H-hz-30),k=S.depth(gy)*sc;
    if(S.inPond(gx,gy,1.05))continue;
    g.strokeStyle="rgba(118,172,86,"+(.45+r()*.35).toFixed(2)+")";g.lineWidth=1.3*k;
    var s=7*k;AD.line(g,gx-s*.5,gy-s,gx,gy);AD.line(g,gx,gy-s*1.3,gx,gy);AD.line(g,gx+s*.6,gy-s*.9,gx,gy);
  }
  var FC=["#FFFFFF","#FFE07A","#F6A8BF","#C9B8F0"];
  for(var j=0;j<30;j++){
    var fx=20+r()*(W-40),fy=S.top-10+r()*(S.bottom-S.top),fk=S.depth(fy)*sc;
    if(S.inPond(fx,fy,1.3))continue;
    g.strokeStyle="#7FB05E";g.lineWidth=1.2*sc;AD.line(g,fx,fy,fx,fy-7*fk);
    g.fillStyle=FC[j%4];
    for(var q=0;q<5;q++){var a=q/5*TAU;g.beginPath();g.arc(fx+Math.cos(a)*3*fk,fy-9*fk+Math.sin(a)*3*fk,2.4*fk,0,TAU);g.fill();}
    g.fillStyle="#F2A33C";g.beginPath();g.arc(fx,fy-9*fk,1.7*fk,0,TAU);g.fill();
    S.flowers.push({x:fx,y:fy});
  }
  buildCovers(W,H,R);
  /* 雲 */
  if(!S.clouds.length)for(var n=0;n<3;n++)S.clouds.push({x:Math.random(),y:.02+n*.045,s:.8+Math.random()*.5,v:.004+Math.random()*.004});
  S.cloudImg=sprite(120,46,R,function(cg){cg.fillStyle="rgba(255,255,255,.9)";[[30,30,16],[52,22,20],[76,26,17],[94,32,12],[60,34,16]].forEach(function(o){cg.beginPath();cg.arc(o[0],o[1],o[2],0,TAU);cg.fill();});});
};
/* 背景は うしろの絵（#zoo-bg）に一度だけ描いてあるので、ここでは雲だけを描く */
S.drawBack=function(g,dt){
  if(!S.bgIsLayer)g.drawImage(S.bg,0,0,S.W,S.H);
  var ci=S.cloudImg;
  S.clouds.forEach(function(cl){
    cl.x+=cl.v*dt;if(cl.x>1.15)cl.x=-.15;
    var w=ci.w*cl.s*AD.clamp(S.W/900,.6,3),h=ci.h*cl.s*AD.clamp(S.W/900,.6,3);
    g.drawImage(ci,cl.x*S.W-w/2,Math.min(cl.y*S.H,S.horizon-h),w,h);
  });
};
S.drawBush=function(g,b){g.drawImage(b.img,b.x-b.img.w/2,b.y-b.img.h,b.img.w,b.img.h);};
})();
