/* どうぶつの動き・ことば・描画 */
(function(){
"use strict";
var AD=window.AD,S=AD.scene,PI=Math.PI,TAU=PI*2,clamp=AD.clamp,rand=AD.rand;
var P=AD.play={animals:[],sessions:[],bubbles:[],notes:[],balls:[],sparks:[],queue:[],now:0,U:30,
  reduced:!!(window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches)};
P.MAX=6;
/* 草原の広さから、いっしょにいられる数を決める（1ぴきあたり どうぶつの大きさ×約4.7 四方）
   パソコンの広いボードで10ぴき、スマホのたて長ボードで6ぴきくらい */
P.setCapacity=function(){
  var area=S.W*(S.bottom-S.top),per=22*P.U*P.U;
  P.MAX=AD.clamp(Math.round(area/per),5,12);
};
/* 多すぎるときは、古い子から「またね〜」と帰っていく */
P.trim=function(keep){
  var live=P.animals.filter(function(b){return !b.leaving&&b!==keep;});
  var extra=live.length+(keep?1:0)-P.MAX;
  live.sort(function(p,q){return (p.sess?1:0)-(q.sess?1:0);});
  for(var i=0;i<extra&&i<live.length;i++){
    var old=live[i];
    if(old.sess)AD.acts.end(old.sess);
    old.leaving=true;old.tx=old.x<S.W/2?-old.u*3:S.W+old.u*3;old.ty=old.y;old.mult=1.3;P.say(old,"またね〜",1.4);
  }
};
/* ほかのどうぶつから一番はなれた場所をえらぶ */
P.roomySpot=function(a){
  /* こみあっていると点数がぜんぶマイナスになるので、はじめは とても小さい値にしておく（null をかえさない） */
  var best=null,bd=-1e9;
  for(var i=0;i<6;i++){
    var p=S.safeSpot(a.u)||S.randomSpot(a.u),m=1e9;
    P.animals.forEach(function(b){if(b!==a)m=Math.min(m,Math.hypot(b.x-p.x,(b.y-p.y)*1.6));});
    m-=Math.hypot(p.x-a.x,p.y-a.y)*.25;
    if(m>bd){bd=m;best=p;}
  }
  return best;
};
var TOP={foot1:2.6,hand0:2.6,hand3:2.2,hand5:2.2,foot5:2.2};

P.later=function(sec,fn){P.queue.push({t:P.now+sec,fn:fn});};
P.say=function(a,text,dur){
  if(!a||!text)return;
  var same=P.bubbles.some(function(b){return b.a===a&&b.text===text;});
  P.bubbles=P.bubbles.filter(function(b){return b.a!==a;});
  P.bubbles.push({a:a,text:text,born:P.now,dur:dur||1.6,keep:same});
  a.talk=.45;
};
P.note=function(x,y,text,col){P.notes.push({x:x,y:y,text:text,born:P.now,dur:1.3,col:col||AD.INK});};
P.headY=function(a){return a.y-a.z-a.u*(a.sp.top||TOP[a.sp.key]||(a.sp.kind==="hand"?1.95:2.15));};
P.jump=function(a,k){if(a.z===0&&a.vz===0)a.vz=a.u*(k||4);};
/* うまれてすぐ（3秒）は、あそびにさそわない（「〇〇だよ！」の名のりを さいごまで見せる） */
P.free=function(a){return !a.sess&&!a.leaving&&!a.helping&&a.age>3.2;};

P.spawn=function(sp,x,y,mode,grow){
  var a={sp:sp,x:x,y:clamp(y,S.top,S.bottom),z:0,vz:0,dir:Math.random()<.5?1:-1,ph:0,moving:false,land:0,
    age:mode==="quiet"?3:0,deco:mode==="quiet"?1:0,mode:mode,grow:grow||1,seed:Math.random()*10,
    rest:rand(.6,2),tx:x,ty:y,mult:1,sess:null,sleep:false,blink:0,blinkT:rand(1.5,5),talk:0,nod:0,
    leaving:false,alpha:1,cool:mode==="quiet"?rand(1,3):2.2,u:0,shake:0,face:0,hold:false,said:mode==="quiet",sparked:mode==="quiet"};
  a.u=P.unit(a);
  P.animals.push(a);
  P.trim(a);
  return a;
};
P.unit=function(a){return P.U*(a.sp.kind==="hand"?1:.92)*a.grow*S.depth(a.y);};
/* あそび道具（つな・ゴールの線など）。{y:ならべる順, draw(g)} */
P.props=[];
P.clearAll=function(){P.animals=[];P.sessions=[];P.bubbles=[];P.notes=[];P.balls=[];P.sparks=[];P.queue=[];P.props=[];};

/* 前にほかの子がいたら、横によけながら進む（同じあそびの なかまどうしは よけない） */
function avoid(a,ux,uy){
  var sx=0,sy=0;
  if(a.hidden)return {x:ux,y:uy};
  P.animals.forEach(function(b){
    if(b===a||b.leaving||b.hidden||(a.sess&&a.sess===b.sess))return;
    var ex=b.x-a.x,ey=(b.y-a.y)*1.6,dist=Math.hypot(ex,ey),R=(a.u+b.u)*1.05;
    if(dist>R||dist<.01)return;
    var ahead=(ex*ux+ey*uy)/dist;if(ahead<.05)return;
    var side=(ux*ey-uy*ex)>0?-1:1,w=(1-dist/R)*ahead*1.8;
    sx+=-uy*side*w-ex/dist*w*.35;sy+=ux*side*w-ey/dist*w*.35;
  });
  var nx=ux+sx,ny=uy+sy,n=Math.hypot(nx,ny)||1;
  return {x:nx/n,y:ny/n};
}
function stepAnimal(a,dt){
  a.age+=dt;a.cool-=dt;a.talk=Math.max(0,a.talk-dt);
  /* ぶつかったままの子は、少しはなれた場所へ移る */
  a.bump=Math.max(0,(a.bump||0)-dt*.6);
  if(a.bump>.7&&!a.sess&&!a.leaving&&a.bumpBy){
    var bx=a.x-a.bumpBy.x,by=a.y-a.bumpBy.y,bl=Math.hypot(bx,by)||1,away={x:a.x+bx/bl*a.u*2.2,y:a.y+by/bl*a.u*1.2};
    if(!S.clear(away.x,away.y,a.u))away=P.roomySpot(a);
    a.tx=clamp(away.x,a.u,S.W-a.u);a.ty=clamp(away.y,S.top,S.bottom);a.rest=0;a.bump=0;a.bumpBy=null;
  }
  a.u=P.unit(a);
  if(a.mode!=="quiet")a.deco=clamp((a.age-.45)/.45,0,1);
  if(!a.sparked&&a.age>.45){a.sparked=true;for(var i=0;i<12;i++)P.sparks.push({x:a.x,y:a.y-a.u*.9,a:i/12*TAU,born:P.now,col:a.sp.col,u:a.u});}
  /* うまれたら、なんのどうぶつか名のる */
  if(!a.said&&a.age>.95){a.said=true;P.say(a,a.sp.born.replace(/[！!]$/,"")+"、"+a.sp.name+"だよ！",2.2);}
  a.blinkT-=dt;if(a.blinkT<0){a.blink=.12;a.blinkT=rand(2,5);}a.blink=Math.max(0,a.blink-dt);
  if(a.land>0)a.land=Math.max(0,a.land-dt/.16);
  if(a.age<1.1)return;
  if(!a.sess&&!a.leaving){
    if(a.rest>0)a.rest-=dt;
    else if(Math.hypot(a.tx-a.x,a.ty-a.y)<a.u*.3){a.rest=rand(1.6,4);var p=P.roomySpot(a);a.tx=p.x;a.ty=p.y;}
  }
  var dx=a.tx-a.x,dy=a.ty-a.y,d=Math.hypot(dx,dy);
  var wants=d>a.u*.25&&(a.rest<=0||a.sess||a.leaving)&&!a.hold&&!a.sleep;
  var m=a.sp.motion,speed=a.u*(m==="hop"?2.0:m==="waddle"?1.25:1.55)*a.mult*(P.reduced?.6:1);
  a.moving=wants;
  /* 向きは、はっきり左右に動いたときだけ、少し間をあけて変える（ぶるぶる向きが変わらないように） */
  function move(){var v=avoid(a,dx/d,dy/d),s=Math.min(d,speed*dt),nd=v.x>0?1:-1;a.x+=v.x*s;a.y+=v.y*s;
    /* つなひきのように、うしろに下がっても向きを変えない */
    if(a.faceLock){a.dir=a.face||a.dir;return;}
    if(nd!==a.dir&&Math.abs(v.x)>.3&&P.now-(a.dirT||-9)>.35){a.dir=nd;a.dirT=P.now;}}
  if(m==="hop"){
    if(wants&&a.z===0&&a.vz===0&&a.land===0)a.vz=a.u*(a.mult>1.2?4:3.4);
    if((a.z>0||a.vz>0)&&d>1)move();
  }else if(wants){move();a.ph+=dt*(m==="waddle"?9:speed/a.u*4.6);}
  if(!wants&&a.face&&a.face!==a.dir&&P.now-(a.dirT||-9)>.35){a.dir=a.face;a.dirT=P.now;}
  if(a.knock){a.x+=a.knock*dt;a.knock*=Math.pow(.02,dt);if(Math.abs(a.knock)<2)a.knock=0;}
  if(a.z>0||a.vz>0){a.vz-=a.u*15*dt;a.z+=a.vz*dt;if(a.z<=0){a.z=0;a.vz=0;a.land=1;}}
  if(!a.leaving){a.x=clamp(a.x,a.u*.8,S.W-a.u*.8);a.y=clamp(a.y,S.top,S.bottom);}
  else a.alpha=clamp(Math.min(a.x+a.u*2,S.W+a.u*2-a.x)/(a.u*2),0,1);
}

P.update=function(dt){
  P.now+=dt;
  for(var q=P.queue.length-1;q>=0;q--)if(P.queue[q].t<=P.now){var job=P.queue.splice(q,1)[0];job.fn();}
  AD.acts.schedule(dt);
  P.sessions.slice().forEach(function(s){AD.acts.tick(s,dt);});
  P.animals.forEach(function(a){stepAnimal(a,dt);});
  var L=P.animals;
  for(var i=0;i<L.length;i++)for(var j=i+1;j<L.length;j++){
    var a=L[i],b=L[j];
    if(a.leaving||b.leaving||(a.sess&&a.sess===b.sess)||a.hidden||b.hidden)continue;
    var dx=a.x-b.x,dy=(a.y-b.y)*2,d=Math.hypot(dx,dy),min=(a.u+b.u)*.8;
    if(d<min&&d>.01){
      var k=(min-d)/d*.5*Math.min(1,dt*5);a.x+=dx*k;b.x-=dx*k;a.y+=dy*k*.2;b.y-=dy*k*.2;
      a.bump=(a.bump||0)+dt*1.6;a.bumpBy=b;b.bump=(b.bump||0)+dt*1.6;b.bumpBy=a;
    }
  }
  P.animals=L.filter(function(a){return !(a.leaving&&(a.x<-a.u*2.5||a.x>S.W+a.u*2.5));});
  P.balls.forEach(function(b){if(b.fly){b.f=Math.min(1,b.f+dt/b.dur);var e=b.f;b.x=b.x0+(b.x1-b.x0)*e;b.y=b.y0+(b.y1-b.y0)*e;b.z=Math.sin(PI*e)*b.h;b.spin+=dt*10;if(e>=1){b.fly=false;b.z=0;if(b.onLand)b.onLand();}}});
};

P.hitBall=function(p){
  for(var i=0;i<P.balls.length;i++){var b=P.balls[i];if(Math.hypot(p.x-b.x,p.y-(b.y-b.r-b.z))<Math.max(b.r*2.4,22))return b;}
  return null;
};
P.hit=function(p){
  var best=null,bd=1e9;
  P.animals.forEach(function(a){
    if(a.leaving)return;
    var cy=a.y-a.z-a.u*(a.sp.hitY||.95),d=Math.hypot((p.x-a.x)/1.1,p.y-cy);
    if(d<a.u*1.05&&d<bd){bd=d;best=a;}
  });
  return best;
};

/* ---- 描画 ---- */
P.drawAnimal=function(g,a,t){
  var u=a.u,pop=1,age=a.age;
  if(a.mode==="gather")pop=age>1.2?1:clamp(1+Math.exp(-age*6)*Math.sin(age*13-PI/2),0,1.3);
  if(a.mode==="stamp")pop=age<.2?1.14-.14*(age/.2):1;
  if(pop<=.01)return;
  g.save();g.globalAlpha=a.alpha;
  var zk=1-Math.min(.6,a.z/(u*1.4));
  g.fillStyle="rgba(58,90,40,.16)";g.beginPath();
  g.ellipse(a.x+a.shake,a.y+1,u*(a.sp.kind==="hand"?.66:.38)*zk*pop,u*.09*zk*pop,0,0,TAU);g.fill();
  g.translate(a.x+a.shake,a.y-a.z);
  if(a.sp.motion==="waddle"&&a.moving)g.rotate(Math.sin(a.ph)*.08);
  var sx=1+.14*a.land,sy=1-.18*a.land;
  if(a.z>0){sx=.95;sy=1.06;}
  if(a.sleep&&a.sess&&a.sess.type==="nap"){sx*=1.04;sy*=.94;}
  g.scale(a.dir*pop*sx,pop*sy);
  a.sp.draw(g,a,t);
  g.restore();
};
P.drawBall=function(g,b){
  var r=b.r;
  g.save();g.fillStyle="rgba(58,90,40,.16)";g.beginPath();g.ellipse(b.x,b.y+1,r*1.1*(1-Math.min(.5,b.z/(r*8))),r*.3,0,0,TAU);g.fill();
  g.translate(b.x,b.y-r-b.z);g.rotate(b.spin);
  g.fillStyle="#FFFDF7";g.beginPath();g.arc(0,0,r,0,TAU);g.fill();
  g.save();g.clip();g.fillStyle="#EF6B5E";g.fillRect(-r,-r*.35,r*2,r*.7);g.restore();
  g.strokeStyle="rgba(58,44,36,.5)";g.lineWidth=1.2;g.beginPath();g.arc(0,0,r,0,TAU);g.stroke();
  g.restore();
};
function rr(g,x,y,w,h,r){g.beginPath();g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);g.arcTo(x+w,y+h,x,y+h,r);g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath();}
P.drawOverlay=function(g){
  var now=P.now;
  for(var i=P.sparks.length-1;i>=0;i--){
    var s=P.sparks[i],e=(now-s.born)/.6;if(e>=1){P.sparks.splice(i,1);continue;}
    var r0=s.u*(.6+e*1.1),r1=r0+s.u*.3*(1-e);
    g.save();g.globalAlpha=1-e;g.strokeStyle=AD.COLORS[s.col].hex;g.lineWidth=Math.max(1.6,s.u*.07);g.lineCap="round";
    g.beginPath();g.moveTo(s.x+Math.cos(s.a)*r0,s.y+Math.sin(s.a)*r0);g.lineTo(s.x+Math.cos(s.a)*r1,s.y+Math.sin(s.a)*r1);g.stroke();g.restore();
  }
  g.textAlign="center";g.textBaseline="middle";
  for(var n=P.notes.length-1;n>=0;n--){
    var o=P.notes[n],v=(now-o.born)/o.dur;if(v>=1){P.notes.splice(n,1);continue;}
    g.save();g.globalAlpha=Math.min(1,v*5)*(1-clamp((v-.6)/.4,0,1));
    g.font=Math.round(P.U*.6)+"px Yomogi,'Zen Maru Gothic',sans-serif";g.fillStyle=o.col;
    g.fillText(o.text,o.x+Math.sin(v*6)*4,o.y-v*P.U*1.2);g.restore();
  }
  /* ふきだしどうしが重ならないように、あとから出たものを横か上にずらす */
  for(var k=P.bubbles.length-1;k>=0;k--){var bb=P.bubbles[k];if((now-bb.born)/bb.dur>=1||P.animals.indexOf(bb.a)<0)P.bubbles.splice(k,1);}
  P.bubbles.sort(function(p,q){return p.born-q.born;});
  var placed=[],fs=Math.round(clamp(P.U*.5,13,19));
  g.font=fs+"px Yomogi,'Zen Maru Gothic',sans-serif";
  function hitPlaced(x,y,w2,h2){for(var i=0;i<placed.length;i++){var o=placed[i];if(x<o.x+o.w+6&&x+w2+6>o.x&&y<o.y+o.h+4&&y+h2+4>o.y)return o;}return null;}
  for(k=0;k<P.bubbles.length;k++){
    var b=P.bubbles[k],w=(now-b.born)/b.dur,a=b.a;
    var tw=g.measureText(b.text).width,bw=tw+fs*1.1,bh=fs*1.75;
    var ax=a.x+a.dir*(a.sp.kind==="hand"?a.u*.3:0),ay=P.headY(a)-8-w*4;
    var bx=clamp(ax-bw/2,4,S.W-bw-4),by=Math.max(4,ay-bh),o0=hitPlaced(bx,by,bw,bh);
    if(o0){
      var sx=ax<o0.x+o0.w/2?o0.x-bw-8:o0.x+o0.w+8;
      if(sx>=4&&sx+bw<=S.W-4&&!hitPlaced(sx,by,bw,bh))bx=sx;
      else{for(var tries=0;tries<4;tries++){var o1=hitPlaced(bx,by,bw,bh);if(!o1)break;by=o1.y-bh-6;}by=Math.max(4,by);}
    }
    placed.push({x:bx,y:by,w:bw,h:bh});
    g.save();g.globalAlpha=(b.keep?1:Math.min(1,w*8))*(1-clamp((w-.8)/.2,0,1))*a.alpha;
    g.fillStyle="rgba(255,255,255,.95)";g.strokeStyle="rgba(58,44,36,.28)";g.lineWidth=1.2;
    rr(g,bx,by,bw,bh,bh/2);g.fill();g.stroke();
    var tx=clamp(ax,bx+bh*.5,bx+bw-bh*.5);
    g.beginPath();g.moveTo(tx-5,by+bh-.5);g.lineTo(clamp(ax,tx-10,tx+10),by+bh+6);g.lineTo(tx+5,by+bh-.5);g.closePath();g.fill();
    g.fillStyle=AD.INK;g.fillText(b.text,bx+bw/2,by+bh/2+1);
    g.restore();
  }
};
})();
