/* あそび：おいかけっこ・ボールあそび・かくれんぼ・ダンス・ぎょうれつ
   あそんでいる子をタップすると、そのあそびの中だけの反応をする（ときどき、あそびが少しじゃまされる） */
(function(){
"use strict";
var AD=window.AD,S=AD.scene,P=AD.play,PI=Math.PI,clamp=AD.clamp,rand=AD.rand,pick=AD.pick;
var X=AD.acts={};
var schedT=1.2,groupCool=0,bigCool=4;

function go(a,x,y,mult){a.tx=clamp(x,a.u*.8,S.W-a.u*.8);a.ty=clamp(y,S.top,S.bottom);a.mult=mult||1;a.rest=0;}
function arrived(a){return Math.hypot(a.tx-a.x,a.ty-a.y)<a.u*.35;}
/* あいてが ほぼ 正面（おなじ よこ位置）のときは 向きを かえない。
   でないと 右・左 に ぱたぱた 向きなおして見える */
function faceTo(a,b){
  var d=b.x-a.x;
  if(Math.abs(d)<a.u*.45&&a.dir)a.face=a.dir;
  else a.face=d>0?1:-1;
  a.dir=a.face;
}
function next(s){s.st++;s.tt=0;s.flag={};}
function once(s,k){if(s.flag[k])return false;s.flag[k]=true;return true;}
function mid(a,b){return {x:clamp((a.x+b.x)/2,S.W*.18,S.W*.82),y:clamp((a.y+b.y)/2,S.top+10,S.bottom-10)};}
function other(s,a){return s.m[0]===a?s.m[1]:s.m[0];}
function alive(s,a){return a&&a.sess===s;}
/* ふたりの位置と、そのあいだが しげみ・文字にかぶらない場所をえらぶ */
function pair(s,gap){
  var a=s.m[0],b=s.m[1],u=Math.max(a.u,b.u),m=mid(a,b);
  function ok(c){return S.clear(c.x-gap,c.y,u)&&S.clear(c.x+gap,c.y,u)&&S.clear(c.x,c.y,u*.6);}
  var c=ok(m)?m:(S.safeSpot(u,m,ok)||m),L=a.x<b.x?a:b,R=L===a?b:a;
  go(L,c.x-gap,c.y);go(R,c.x+gap,c.y);s.c=c;s.L=L;s.R=R;
}
function bothThere(s){return (arrived(s.m[0])&&arrived(s.m[1]))||s.tt>6;}
/* おにの しるし：あたまの上に 赤い おにの顔（つのつき） */
function oniMark(g,a){
  if(!a||a.hidden||P.animals.indexOf(a)<0)return;
  var u=a.u*.42,x=a.x,y=P.headY(a)-u*1.5;
  g.save();
  g.fillStyle="#F2C230";
  [-1,1].forEach(function(s2){
    g.beginPath();g.moveTo(x+s2*u*.5,y-u*.6);g.lineTo(x+s2*u*.18,y-u*1.45);g.lineTo(x+s2*u*.88,y-u*.86);g.closePath();g.fill();
  });
  g.fillStyle="#E4463C";g.beginPath();g.arc(x,y,u,0,PI*2);g.fill();
  g.fillStyle="#2B2A28";g.beginPath();g.arc(x,y-u*.18,u*.99,PI*1.02,PI*1.98);g.fill();
  g.beginPath();g.arc(x-u*.3,y+u*.1,u*.12,0,PI*2);g.fill();
  g.beginPath();g.arc(x+u*.3,y+u*.1,u*.12,0,PI*2);g.fill();
  g.fillStyle="#FBD4B4";g.beginPath();g.arc(x,y+u*.36,u*.3,0,PI,false);g.fill();
  g.restore();
}
X.oniMark=oniMark;
function weighted(list){var sum=0;list.forEach(function(x){sum+=x[1];});var r=Math.random()*sum;for(var i=0;i<list.length;i++){r-=list[i][1];if(r<=0)return list[i][0];}return list[0][0];}
/* タップの反応：続けてタップしている間は同じことば */
function tapLine(a,key,lines,dur){
  if(!(a.ptKey===key&&P.now-a.ptT<1.6)){
    var c=lines.filter(function(l){return l!==a.ptLine;});
    a.ptLine=pick(c.length?c:lines);
  }
  a.ptKey=key;a.ptT=P.now;P.say(a,a.ptLine,dur||1.4);
  return a.ptLine;
}
/* あそびのおわりのあいさつ：ひとりが1回だけ言う（くり返さない）。el はおわりはじめてからの時間。
   言いおわってから true をかえす */
var BYE=["たのしかった！","たのしかったね〜","またあそぼうね！"];
function goodbye(s,a,b,el,start){
  start=start||0;
  if(el>start&&once(s,"bye")&&alive(s,a)){P.say(a,pick(BYE),1.6);if(alive(s,b))P.jump(b,2.6);}
  return el>start+1.7;
}
/* じゃまな効果は、少し間をあけてから次をうける */
function fx(s,cool){if(P.now-(s.fxT==null?-99:s.fxT)>cool){s.fxT=P.now;return true;}return false;}

/* おにから遠く、しげみ・文字にかぶらず、今の進む向きに近い場所をえらぶ */
/* にげる先をえらぶ。others＝ほかの にげる子（おなじ すみに かたまらないように はなれる） */
/* ぎょうれつの ならぶ場所。よこに まっすぐ ならべない（はしに ついた）ときは、
   そこから 上か下に つづけて ならぶ */
/* ぎょうれつの 先頭が「もと来た ほう」へ もどろうとする ときは、
   そのまま 折り返すと じぶんの 列に つっこむので、まず 上か下へ 曲がる */
function paradeTurn(s,L,p){
  var hx=0,hy=0,tl=s.trail;
  if(tl&&tl.length>=2){hx=tl[tl.length-1].x-tl[tl.length-2].x;hy=tl[tl.length-1].y-tl[tl.length-2].y;}
  if(!hx&&!hy){hx=L.tx-L.x;hy=L.ty-L.y;}
  var hl=Math.hypot(hx,hy)||1;hx/=hl;hy/=hl;
  var vx=p.x-L.x,vy=p.y-L.y,vl=Math.hypot(vx,vy)||1;
  if((vx*hx+vy*hy)/vl>-.2)return null;             /* 折り返しでは ない */
  var up=L.y-(S.top+L.u*.9),dn=(S.bottom-L.u*.7)-L.y,d=dn>up?1:-1;
  var step=Math.max(L.u*3,Math.min(Math.max(up,dn),L.u*4.5));
  return {x:clamp(L.x+hx*L.u*.8,L.u*1.2,S.W-L.u*1.2),
          y:clamp(L.y+d*step,S.top+L.u*.9,S.bottom-L.u*.7)};
}
function queueSpots(s,L,ax,ay){
  var list=s.m.slice(1),pts=[],px=ax,py=ay;
  var mx=L.u*1.15,my0=S.top+L.u*.25,my1=S.bottom-L.u*.15,vy=0,vx2=0;
  for(var i=0;i<list.length;i++){
    var f=list[i],gap=((i?list[i-1].u:L.u)+f.u)*1.05;
    /* うしろへ 一歩。たては 見た目が つまって 見えるので、
       たて・よこ どちらでも おなじ あきに なるように そろえる */
    var dxs=-s.hx,dys=-s.hy*.6,dl2=Math.hypot(dxs,dys*1.3)||1;
    var nx=px+dxs/dl2*gap,ny=py+dys/dl2*gap;
    if(nx<mx||nx>S.W-mx){
      /* よこの はしに ついた：そこから 上か下に つづける */
      if(!vy)vy=py<(my0+my1)/2?1:-1;
      nx=px;ny=py+vy*gap*.95;
      if(ny<my0||ny>my1){vy=-vy;ny=py+vy*gap*.95;nx=clamp(px+(px<S.W/2?1:-1)*gap*.9,mx,S.W-mx);}
    }else if(ny<my0||ny>my1){
      /* たての はしに ついた：そこから 左か右に つづける */
      if(!vx2)vx2=px<S.W/2?1:-1;
      ny=py;nx=px+vx2*gap*.9;
      if(nx<mx||nx>S.W-mx){vx2=-vx2;nx=px+vx2*gap*.9;}
    }
    nx=clamp(nx,mx,S.W-mx);ny=clamp(ny,my0,my1);
    pts.push({x:nx,y:ny});px=nx;py=ny;
  }
  return pts;
}
function pickFlee(s,r,c,others){
  var base=Math.atan2(r.y-c.y,r.x-c.x),prev=s.flee?Math.atan2(s.flee.y-r.y,s.flee.x-r.x):base,best=null,bs=-1e9;
  [0,.5,-.5,1,-1,1.5,-1.5,2.1,-2.1,2.7,-2.7].forEach(function(o){
    var an=base+o,far=r.u*rand(3.2,4.2),q={x:r.x+Math.cos(an)*far,y:r.y+Math.sin(an)*far*.7};
    if(q.x<r.u*1.2||q.x>S.W-r.u*1.2||q.y<S.top||q.y>S.bottom)return;
    if(!S.clear(q.x,q.y,r.u)||!S.segClear(r,q,r.u*.85))return;
    var turn=Math.abs(Math.atan2(Math.sin(an-prev),Math.cos(an-prev)));
    var sc=Math.hypot(q.x-c.x,q.y-c.y)-Math.abs(o)*r.u*.5-turn*r.u*.6;
    /* ほかの にげる子の ちかくは えらばない（みんなで 同じ はしっこに 行かない） */
    if(others)others.forEach(function(w){
      if(w===r)return;
      var dw=Math.hypot(q.x-w.x,(q.y-w.y)*1.3),R=(r.u+w.u)*2.2;
      if(dw<R)sc-=(R-dw)*1.4;
    });
    /* かべに はりつかない */
    var wall=Math.min(q.x,S.W-q.x,(q.y-S.top)*1.6,(S.bottom-q.y)*1.6);
    if(wall<r.u*2)sc-=(r.u*2-wall)*1.2;
    if(sc>bs){bs=sc;best=q;}
  });
  return best||S.safeSpot(r.u,{x:r.x,y:r.y},function(q){return Math.hypot(q.x-c.x,q.y-c.y)>Math.hypot(r.x-c.x,r.y-c.y);})||s.flee;
}
/* ボールが ころがっていく。missed＝とりそこねた子（ころがした子） */
function roll(s,missed,far){
  var B=s.ball,best=null;
  if(s.fetch&&s.fetch.by&&s.fetch.a){s.fetch.a.helping=null;s.fetch.a.hold=false;s.fetch.a.rest=rand(.8,1.6);}
  /* とりそこねたときは、ときどき うんと とおくまで ころがる（入らないときだけ 少しずつ ちぢめる） */
  var want=P.U*(far?(Math.random()<.6?rand(5.5,7.5):rand(2.6,3.6)):rand(2,3));
  for(var i=0;i<16&&!best;i++){
    var d=want*(1-i*.05),an=Math.random()*PI*2,q={x:B.x+Math.cos(an)*d,y:B.y+Math.sin(an)*d*.62};
    if(q.x>P.U&&q.x<S.W-P.U&&q.y>S.top&&q.y<S.bottom&&S.clear(q.x,q.y,P.U*.6))best=q;
  }
  best=best||{x:clamp(B.x+(S.W/2-B.x)*.3,P.U,S.W-P.U),y:clamp(B.y,S.top,S.bottom)};
  var roll2=Math.hypot(best.x-B.x,best.y-B.y);
  B.x0=B.x;B.y0=B.y;B.x1=best.x;B.y1=best.y;B.f=0;B.dur=clamp(roll2/(P.U*3.2),.7,1.8);B.h=P.U*.8;B.fly=true;s.recv=null;s.fetch=null;
  /* ころがっている あいだは パスでは ないので、「いいパス〜」とは 言わない */
  s.loose=true;s.lastMissed=missed;s.backPass=false;
  B.onLand=function(){
    s.loose=false;
    if(P.sessions.indexOf(s)<0)return;
    /* うんと とおくまで いってしまったときだけ、あそんでいる みんなで とりに行く かけっこ */
    var nearD=1e9;s.m.forEach(function(a){if(alive(s,a))nearD=Math.min(nearD,Math.hypot(a.x-B.x,a.y-B.y));});
    /* ころがった先に ただ歩いている子がいたら、その子が ひろってくれる */
    var passer=P.animals.filter(function(a){return !a.sess&&!a.leaving&&!a.helping&&!a.hidden&&!a.chat&&a.age>3.2&&Math.hypot(a.x-B.x,a.y-B.y)<P.U*2.8;})[0];
    if(s.m.length>=2&&nearD>P.U*3.4&&!passer){
      s.raced=true;s.fetch={a:null,race:true,got:false,t:0,back:false,missed:missed,by:false};
      P.say(missed,"まって〜、ボール〜！",1.3);
      var o2=s.m.filter(function(a){return a!==missed&&alive(s,a);})[0];
      P.later(.6,function(){if(alive(s,o2))P.say(o2,"だれが さきに とるかな？",1.4);});
      return;
    }
    startFetch(s,missed,false);
  };
}
/* ころがったボールを だれがとりにいくか：いちばん近い子。3びき以上なら、とりそこねた子のかわりに なかまが「とってあげる」。
   あそびに入っていない子が もっと近くにいたら、その子がひろって なげかえしてくれる */
function startFetch(s,missed,noBy){
  var B=s.ball,d=function(a){return Math.hypot(a.x-B.x,a.y-B.y);};
  var mem=s.m.filter(function(a){return alive(s,a)&&(s.m.length<3||a!==missed);}).sort(function(p,q){return d(p)-d(q);})[0]||missed;
  var by=noBy?null:P.animals.filter(function(a){return !a.sess&&!a.leaving&&!a.helping&&!a.hidden&&a.age>3.2;}).sort(function(p,q){return d(p)-d(q);})[0];
  /* すぐそばを 歩いていた子がいたら、その子が ひろって なげかえす */
  var useBy=!!by&&(d(by)<P.U*2.8||d(by)<Math.min(P.U*5,d(mem)*.7));
  var f=useBy?by:mem;
  s.fetch={a:f,got:false,t:0,back:false,missed:missed,by:useBy};
  if(useBy){by.helping=s;by.watch=null;by.watchMove=false;}
  P.say(f,f===missed?"まって〜、ボール〜":"とってあげる！",1.2);
}

/* ボールを ひろったあと、どこで つづけるか（もとの場所に きっちり もどると わざとらしい） */
function reform(s,c,R){
  var u=s.m.reduce(function(v,a){return Math.max(v,a.u);},0),n=s.m.length;
  if(n===2){
    var ok=function(q){return S.clear(q.x-R,q.y,u)&&S.clear(q.x+R,q.y,u);};
    var cc=ok(c)?c:(S.safeSpot(u,c,ok)||c);s.c=cc;
    var L=s.m[0].x<=s.m[1].x?s.m[0]:s.m[1],Rt=L===s.m[0]?s.m[1]:s.m[0];
    L.spot={x:cc.x-R,y:cc.y};Rt.spot={x:cc.x+R,y:cc.y};
  }else{
    var ok2=function(q){return ringSpots(q,n,R).every(function(p){return S.clear(p.x,p.y,u);});};
    var cc2=ok2(c)?c:(S.safeSpot(u,c,ok2)||c);s.c=cc2;
    var order=byAngle(s.m,cc2);
    ringSpots(cc2,n,R).forEach(function(p,i){order[i].spot=p;});
  }
  s.m.forEach(function(a){if(alive(s,a)){a.hold=false;go(a,a.spot.x,a.spot.y,1.6);}});
}
/* ひろった子が「ここで つづけよう」「ちょっと とおくから」などを きめる */
function afterFetch(s,f,F){
  var n=s.m.length,R=P.U*(n===2?2.3:n===3?2.2:2.5),r=Math.random();
  if(r<.42){
    P.say(f,pick(["ここで つづけよう！","このへんで やろう〜"]),1.4);
    reform(s,{x:f.x,y:f.y},R);F.back="here";
  }else if(r<.72){
    P.say(f,pick(["ちょっと とおくから やってみよう！","もっと はなれて やろう〜"]),1.5);
    var cx=0,cy=0;s.m.forEach(function(a){cx+=a.x;cy+=a.y;});
    reform(s,{x:(cx/n+f.x)/2,y:(cy/n+f.y)/2},R*1.5);F.back="far";
  }else{
    F.back=true;f.hold=false;go(f,f.spot.x,f.spot.y,1.1);
  }
}
/* ボールあそびの ならび方：2ひきは向かいあい、3〜4ひきは わになって まわす */
function ringSpots(c,n,R){
  var out=[];
  for(var i=0;i<n;i++){var an=-PI/2+i/n*PI*2+(n===4?PI/4:0);out.push({x:c.x+Math.cos(an)*R,y:c.y+Math.sin(an)*R*.6});}
  return out;
}
/* いまの ならび順のまま 場所をわりあてる（すれちがって 重ならないように） */
function byAngle(m,c){
  return m.slice().sort(function(p,q){return Math.atan2(p.y-c.y,p.x-c.x)-Math.atan2(q.y-c.y,q.x-c.x);});
}

/* ---- かくれんぼの てつだい ---- */
function alive2(a){return a&&P.animals.indexOf(a)>=0&&!a.leaving;}
function hideNow(s){
  [s.m[1],s.g].forEach(function(a,i){
    if(!a||!alive(s,a))return;
    a.hidden=true;a.hold=true;
    if(i===0){a.x=s.hp.x;a.y=s.hp.y;}
  });
}
/* おには 本当の しげみへ */
function goSeek(s,k){
  var stop=s.route&&s.route.length?s.route[0]:null,sp=stop?stop.p:s.b.seekSpot(k.x,k.u);
  if(stop&&stop.rustle)P.note(stop.rustle.x,stop.rustle.y-stop.rustle.img.h*.7,"ガサッ","#5E9B4A");
  go(k,sp.x,sp.y);
}
/* 2回に1回くらいは、ちがう場所を さきに さがす（すぐ一直線に行かない） */
function seekRoute(s,k,h){
  if(Math.random()<.45)return [];
  var other=S.bushes.filter(function(b){return b!==s.b;})[0],kinds=[],u=k.u;
  if(other){
    kinds.push({p:other.seekSpot(k.x,u),go:"こっちの しげみかな？",at:"あれ、いないや"});
    kinds.push({p:other.seekSpot(k.x,u),go:"いま、しげみが ゆれた！",at:"きのせい か〜",rustle:other});
  }
  var by=P.animals.filter(function(a){return !a.sess&&!a.leaving&&!a.hidden&&a!==k&&a!==h&&a.age>3.2;})
    .sort(function(p,q){return AD.dist(k,p)-AD.dist(k,q);})[0];
  if(by)kinds.push({p:{x:by.x+(by.x>k.x?-1:1)*(u+by.u)*.9,y:by.y},go:"あっ、"+by.sp.name+"！",at:"そこに かくれてた？",by:by,byLine:"わたし、かくれてないよ〜"});
  var far=S.safeSpot(u,{x:S.W-s.b.x,y:s.b.y});
  if(far)kinds.push({p:far,go:"こっちから おとが した！",at:"だれも いない…"});
  if(!kinds.length)return [];
  var out=[pick(kinds)];
  if(Math.random()<.25){var more=kinds.filter(function(c){return c!==out[0];});if(more.length)out.push(pick(more));}
  out.forEach(function(c){c.limit=4.5;});
  return out;
}

var ACT={
  tag:{init:function(s){
      s.m.sort(function(p,q){return (S.clear(q.x,q.y,q.u)?1:0)-(S.clear(p.x,p.y,p.u)?1:0);});
      s.c=s.m[1];s.r=s.m[0];s.rs=[s.m[0]];
      /* はじめに おには すこし かぞえて、にげる子に 間をあげる */
      s.pause=rand(2.4,3.2);
      /* どうぶつごとの はやさの ちがいは なくして、その回の「ちから」で きまる */
      s.m.forEach(function(a){a.even=rand(.92,1.1);});
      s.spurtAt=s.pause+rand(4,7);
      /* どの子が おに なのか わかるように、あたまの上に しるしを出す */
      s.props=s.props||[];
      var mk={y:1e9,draw:function(g){if(P.sessions.indexOf(s)>=0&&!s.endSoon)oniMark(g,s.c);}};
      s.props.push(mk);P.props.push(mk);
      s.dur=rand(9,12)+s.pause;s.swaps=0;s.stun=0;s.rstun=0;s.minT=s.pause+2;s.runAt=.5;s.talkT=s.pause+2.4;s.joinT=rand(4,6)+s.pause;
      P.say(s.c,pick(["かぞえるから にげて〜","いーち、にーい…"]),1.6);},
    update:function(s,dt){
      var c=s.c;
      s.rs=s.rs.filter(function(a){return alive(s,a);});
      if(!s.rs.length)return true;
      /* にげる子が 2ひきいるときは、近いほうを おいかける */
      if(s.rs.indexOf(s.r)<0){s.r=s.rs[0];s.flee=null;}
      /* おいかける あいては、すぐには かえない（あとから入った子ばかり 追わないように） */
      if(s.rs.length>1&&P.now>(s.swapT||0)){
        var bd=AD.dist(c,s.r),bt=s.r;
        s.rs.forEach(function(a){var d=AD.dist(c,a);if(d<bd*.8){bd=d;bt=a;}});
        if(bt!==s.r){s.r=bt;s.flee=null;s.swapT=P.now+rand(3.5,5);P.say(c,pick(["つぎは そっちだ〜！","まてまて〜"]),1.2);}
      }
      var r=s.r,others=s.rs.filter(function(a){return a!==r;});
      if(s.endSoon){s.m.forEach(function(a){a.hold=true;});c.sleep=false;s.es=(s.es||0)+dt;
        /* おわりのあいさつは、重なったままにならないよう すこし間をあけて向かいあう */
        var ex=r.x-c.x,ey=r.y-c.y,ed=Math.hypot(ex,ey)||1,eg=(c.u+r.u)*.72;
        if(ed<eg){var ep=(eg-ed)*.35;c.x-=ex/ed*ep;c.y-=ey/ed*ep*.5;r.x+=ex/ed*ep;r.y+=ey/ed*ep*.5;}
        if(s.es>.8&&once(s,"faceBye")){faceTo(c,r);faceTo(r,c);}
        return goodbye(s,c,r,s.es,1.8);}
      s.stun=Math.max(0,s.stun-dt);s.rstun=Math.max(0,s.rstun-dt);
      var counting=s.pause>0;
      if(counting){s.pause-=dt;if(s.pause<=0){counting=false;P.say(c,"いくぞ〜！",1.1);}}
      c.hold=counting||s.stun>0;c.sleep=counting;r.hold=s.rstun>0;
      if(s.tt>s.runAt&&once(s,"run"))P.say(r,"にげろ〜",1.3);
      /* ---- とちゅうで きゅうに 本気を出す ---- */
      if(!s.spurted&&s.t>s.spurtAt&&!counting){
        s.spurted=true;
        var who=Math.random()<.5?c:r;
        who.burst=rand(2.6,4);who.dash=rand(.6,.9);
        P.say(who,who===c?pick(["ここからが 本気！","スピード アップ！"]):pick(["まだまだ〜！","本気で にげるぞ〜"]),1.4);
        P.note(who.x,P.headY(who)-6,"ビューン","#E9A93B");
        var o3=who===c?r:c;
        P.later(.7,function(){if(alive(s,o3))P.say(o3,pick(["えっ、はやい！","まけないぞ〜！"]),1.3);});
      }
      /* ---- ほかの子が 見にくる（おいかけっこは ふたりの あそびなので、入らずに おうえんする）---- */
      if(!s.join&&!s.joined&&!s.noJoin&&!counting&&s.m.length<3&&s.t>s.joinT){
        /* 入ってくるのは たまに（3回に1回くらい）。1回きめたら もう さそわない */
        if(Math.random()<.35){
          var g=P.animals.filter(function(a){return P.free(a)&&!a.chat&&!a.watch&&AD.dist(a,c)<P.U*9;})
            .sort(function(p,q){return AD.dist(c,p)-AD.dist(c,q);})[0];
          if(g)s.join={g:g,t:0,step:0};else s.noJoin=true;
        }else s.noJoin=true;
      }
      if(s.join){
        var J=s.join,jg=J.g;
        if(!jg||jg.sess||jg.chat||jg.leaving||P.animals.indexOf(jg)<0)s.join=null;
        else{
          J.t+=dt;
          if(J.step===0){J.step=1;P.say(jg,"なにしてるの〜？",1.4);}
          else if(J.t>1.1&&J.step===1){J.step=2;faceTo(c,jg);P.say(c,"おいかけっこ！",1.2);}
          else if(J.t>2.3&&J.step===2){J.step=3;P.say(jg,pick(["いいな〜、たのしそう！","ぼくも やりたいな〜"]),1.4);P.jump(jg,3.4);}
          else if(J.t>3.6&&J.step===3){J.step=4;P.say(r,pick(["つぎは いっしょに あそぼ！","おうえん してて〜！"]),1.4);}
          else if(J.t>5&&J.step===4){
            /* おいかけっこは ふたりの あそび。入らずに 「がんばれ〜」と 言って もどる */
            P.say(jg,pick(["がんばれ〜！","はやいね〜！"]),1.4);
            s.join=null;s.joined=true;
            var jp=P.farSpot?P.farSpot(jg):P.roomySpot(jg);
            if(jp)go(jg,jp.x,jp.y,1);
          }
          /* そばまで 走ってくる（おにに ぶつかる ほど 近づかない） */
          if(s.join&&J.step<4){
            var jd=Math.hypot(jg.x-c.x,jg.y-c.y)||1,jr=(jg.u+c.u)*2.2;
            go(jg,c.x+(jg.x-c.x)/jd*jr,c.y+(jg.y-c.y)/jd*jr,1.2);
          }else if(s.join){jg.tx=jg.x;jg.ty=jg.y;jg.moving=false;}
        }
      }
      /* ---- にげる子が しげみに とびこんで やりすごす ---- */
      if(!s.duck&&!s.ducked&&!s.noDuck&&!counting&&s.t>4.5&&!s.join){
        var bb=S.bushes.slice().sort(function(p,q){return AD.dist(r,p)-AD.dist(r,q);})[0];
        /* しげみの近くを通ったときだけ、たまに とびこむ */
        if(bb&&AD.dist(r,bb)<P.U*5.5&&AD.dist(c,bb)>P.U*2.5){
          if(Math.random()<.35){s.duck={b:bb,st:0,t:0,last:{x:r.x,y:r.y}};s.dur+=rand(2,4);}
          else s.noDuck=true;
        }
      }
      if(s.duck){
        var D=s.duck,hp=D.b.hidePoint();D.t+=dt;
        if(D.st===0){
          go(r,hp.x,hp.y,1.7);go(c,D.last.x,D.last.y,1.4);c.face=0;
          if(Math.hypot(r.x-hp.x,r.y-hp.y)<r.u*.5||D.t>3.5){D.st=1;D.t=0;r.hidden=true;r.hold=true;r.x=hp.x;r.y=hp.y;}
          return;
        }
        if(D.st===1){
          if(D.t>1.1&&once(s,"lost")){P.say(c,"あれ？ どこ いった〜？",1.5);var q=S.safeSpot(c.u,{x:c.x+(c.x<S.W/2?1:-1)*P.U*3,y:c.y})||P.roomySpot(c);go(c,q.x,q.y,1.1);}
          if(D.t>3.2){
            D.st=2;D.t=0;r.hidden=false;r.hold=false;r.rest=0;
            P.say(r,"ここだよ〜！",1.3);P.jump(r,4.4);
            P.later(.6,function(){if(alive(s,c))P.say(c,"あっ、そこか〜！",1.3);});
            s.duck=null;s.ducked=true;s.flee=null;s.minT=s.tt+1.3;s.nearT=P.now;
          }
          return;
        }
      }
      var dx=r.x-c.x,dy=r.y-c.y,d=Math.hypot(dx,dy)||1;
      /* 走っている間の向きは 動いた方向だけで決める（止まったときに前の向きへ戻さない） */
      r.face=0;
      /* タッチできるようになるまで（にげる子の はなれる時間）は、おにを少しゆっくりにして 追いつかせない */
      var grace=s.tt<s.minT;
      /* おには にげる子より すこし はやい。おわりに近づくと にげる子は つかれてくる */
      var tired=s.t>s.dur*.6?.92:1;
      s.rs.forEach(function(a){a.mult=1;});
      if(!c.hold){
        c.face=0;
        /* にげる先を すこし よんで 先まわりする */
        var rhx=(r.tx==null?0:r.tx-r.x),rhy=(r.ty==null?0:r.ty-r.y),rhl=Math.hypot(rhx,rhy);
        var lead2=(rhl>1&&d>(c.u+r.u)*1.6)?r.u*.9:0;
        go(c,r.x+(rhl>1?rhx/rhl:0)*lead2,r.y+(rhl>1?rhy/rhl:0)*lead2*.6,grace?1.15:1.62);
      }
      else if(Math.abs(dx)>c.u*.5)c.face=dx>0?1:-1;
      /* タッチできないとき（はなれる時間中・数えている間・つかまった直後）は、重ならないようにする */
      var canCatch=!c.hold&&s.tt>s.minT&&!s.endSoon,minGap=(c.u+r.u)*.6;
      if(!canCatch&&d<minGap){
        var push=(minGap-d)*(grace?.6:.45);
        c.x-=dx/d*push;c.y-=dy/d*push*.5;
        r.x+=dx/d*push*.5;r.y+=dy/d*push*.25;
        if(grace&&!counting){
          c.hold=true;
          if(P.now-(s.nearT==null?-9:s.nearT)>1.8){s.nearT=P.now;P.say(c,pick(["あとちょっと…","まてまて〜！"]),1.1);}
        }
      }
      /* にげる先は しばらく決めたままにする（毎フレーム決めなおすと、左右にぶるぶる向きが変わる） */
      s.fleeT=(s.fleeT||0)-dt;
      var F=s.flee,need=!F||s.fleeT<=0||Math.hypot(F.x-r.x,F.y-r.y)<r.u*.6||!S.clear(F.x,F.y,r.u)||
        Math.hypot(F.x-c.x,F.y-c.y)<Math.hypot(F.x-r.x,F.y-r.y)*.9;
      if(need&&P.now-(s.fleePick||-9)>.35){s.flee=pickFlee(s,r,c);s.fleePick=P.now;s.fleeT=rand(.9,1.4);}
      /* おにが目をつぶって数えている間は、しっかり距離をとる */
      if(s.flee)go(r,s.flee.x,s.flee.y,counting?1.8:1.42*tired);
      /* おいかけられていない子も、おにから はなれて にげまわる */
      others.forEach(function(a){
        a.hold=false;a.face=0;a.mult=1;
        a.fleeT=(a.fleeT||0)-dt;
        var G=a.fleeP;
        if(!G||a.fleeT<=0||Math.hypot(G.x-a.x,G.y-a.y)<a.u*.6||!S.clear(G.x,G.y,a.u)){
          a.fleeP=pickFlee({flee:a.fleeP},a,c)||a.fleeP;a.fleeT=rand(1,1.6);
        }
        if(a.fleeP)go(a,a.fleeP.x,a.fleeP.y,1.32*tired);
      });
      s.talkT-=dt;
      if(s.talkT<0&&!counting){s.talkT=rand(1.8,2.8);if(Math.random()<.5)P.say(pick(s.rs),pick(["にげろ〜","こっちだよ〜","きゃ〜！"]),1.2);else P.say(c,pick(["まてまて〜","まて〜！","つかまえるぞ〜"]),1.2);}
      /* 体が かさなるほど 近づいたら、まだ はやくても タッチしたことにする */
      var reach=Math.hypot(dx,dy*1.5),deep=reach<(c.u+r.u)*.6;
      /* ずっと おなじ きょりで にらみあいに なったら、おにが ぐっと 出る */
      if(canCatch&&reach<(c.u+r.u)*1.3){
        s.closeT=(s.closeT||0)+dt;
        if(s.closeT>3.5&&!(c.burst>0)){c.burst=rand(1.6,2.4);s.closeT=0;P.say(c,pick(["いまだ〜！","つかまえた〜！"]),1.2);P.note(c.x,P.headY(c)-6,"ビューン","#E9A93B");}
      }else s.closeT=0;
      if((canCatch||(deep&&!counting&&!s.endSoon&&s.tt>.6))&&reach<(c.u+r.u)*.78){
        P.say(c,"タッチ！",1.1);P.jump(c,3.5);
        var caught=r,tagger=c;
        P.later(.5,function(){if(alive(s,caught))P.say(caught,"つかまった〜",1.2);});
        if(s.swaps<1){
          s.swaps++;s.c=caught;s.rs=s.rs.filter(function(a){return a!==caught;});s.rs.push(tagger);
          s.r=tagger;s.flee=null;s.tt=0;s.flag={};
          /* 新しいおには 目をつぶって数える。にげる子は そのあいだに はなれる */
          s.pause=3.2;s.rstun=1.2;s.minT=3.2+3.5;s.runAt=1.6;s.dur=s.t+rand(10,12);s.talkT=5;
          P.later(1.1,function(){if(alive(s,caught))P.say(caught,"こんどは、おにだぞ〜",1.4);});
        }else s.endSoon=true;
        return;
      }
      if(s.t>s.dur){
        /* 決着が つくまでは おわらない：おにが 本気を出して もうひと押し */
        if(s.t<46&&!(s.lastPush&&P.now-s.lastPush<5.5)){
          s.lastPush=P.now;s.dur=s.t+5;c.burst=rand(2.6,4);
          P.say(c,pick(["つかまえるぞ〜！","ここで つかまえる！"]),1.3);
          P.note(c.x,P.headY(c)-6,"ビューン","#E9A93B");
        }else{
          P.say(c,"はあはあ…",1.2);
          P.later(.5,function(){if(alive(s,r))P.say(r,"つかれた〜",1.2);});
          s.endSoon=true;s.es=0;
        }
      }
    },
    tap:function(s,a){var c=s.c,r=s.r;
      if(s.endSoon){tapLine(a,"tagEnd",["はあはあ…","いっぱい はしった〜"]);return;}
      if(s.duck&&a===r){tapLine(a,"tagDuck",["しーっ、かくれてるの","ここなら みつからない〜"]);return;}
      if(a===c){
        if(s.pause>0){tapLine(a,"tagCount",["いま、かぞえてるの！","め、つぶってるよ〜"]);return;}
        tapLine(a,"tagOni",["わっ、じゃましないで〜！","おっとっと！","もう〜、にげられちゃう！"]);
        if(fx(s,1.2)){s.stun=1;P.jump(a,3);P.later(.4,function(){if(alive(s,r))P.say(r,"いまのうち〜！",1.2);});}
      }else{
        tapLine(a,"tagRun",["わっ、びっくりした！","きゃっ、おさないで〜","あぶない、あぶない！"]);
        if(fx(s,1.2)){if(a===r)s.rstun=.55;P.jump(a,3.6);P.later(.35,function(){if(alive(s,c)&&!(s.pause>0))P.say(c,"チャンス！",1.1);});}
      }
    }},

  ball:{init:function(s){
      var n=s.m.length,u=s.m.reduce(function(v,a){return Math.max(v,a.u);},0);
      if(n===2){pair(s,P.U*2.3);s.m.forEach(function(a){a.spot={x:a.tx,y:a.ty};});}
      else{
        var R=P.U*(n===3?2.2:2.5),cx=0,cy=0;s.m.forEach(function(a){cx+=a.x;cy+=a.y;});
        var near={x:clamp(cx/n,S.W*.2,S.W*.8),y:clamp(cy/n,S.top+R*.6,S.bottom-R*.6)};
        var ok=function(c){return ringSpots(c,n,R).every(function(p){return S.clear(p.x,p.y,u);});};
        s.c=ok(near)?near:(S.safeSpot(u,near,ok)||near);
        var order=byAngle(s.m,s.c);
        ringSpots(s.c,n,R).forEach(function(p,i){var a=order[i];a.spot=p;go(a,p.x,p.y);});
      }
      s.ball={x:s.c.x,y:s.c.y,z:0,r:P.U*.2,spin:0,fly:false,f:0};P.balls.push(s.ball);
      s.h=s.m[0];s.kicks=0;s.goal=6+(n-2)*2;
      s.m.forEach(function(a){a.gotBall=0;});s.h.gotBall=1;
      },
    update:function(s,dt){var B=s.ball,n=s.m.length,h=s.h;
      function faceAll(to){s.m.forEach(function(a){if(a!==to&&alive(s,a))faceTo(a,to);});}
      if(s.st===0){if(s.m.every(arrived)||s.tt>6){s.m.forEach(function(a){a.hold=true;a.spot={x:a.x,y:a.y};});
          if(!B.fly){B.x=h.x+h.dir*h.u*.55;B.y=h.y;}s.wait=.6;next(s);}return;}
      if(s.st===2){if(once(s,"faceBye"))faceAll(h);return goodbye(s,h,s.m.filter(function(a){return a!==h;})[0],s.tt,.6);}
      if(B.fly)return;
      if(s.fetch&&s.fetch.race){
        var R=s.fetch;R.t+=dt;
        if(!R.got){
          /* めいめい ちがう むきから ボールへ（ぶつかって 止まらないように） */
          s.m.forEach(function(a){
            if(!alive(s,a))return;
            a.hold=false;
            var vx=a.x-B.x,vy=(a.y-B.y)||.01,vd=Math.hypot(vx,vy)||1;
            go(a,B.x+vx/vd*a.u*.5,B.y+vy/vd*a.u*.3,1.5);
          });
          /* さきに ついた子（いちばん 近い子）が とる */
          var reach=s.m.filter(function(a){return alive(s,a)&&Math.hypot(a.x-B.x,a.y-B.y)<a.u*.85;});
          var win=reach.sort(function(p,q){return Math.hypot(p.x-B.x,p.y-B.y)/p.u-Math.hypot(q.x-B.x,q.y-B.y)/q.u;})[0];
          if(win||R.t>8){
            R.got=true;R.t=0;R.a=win||s.m.filter(function(a){return alive(s,a);})[0];
            R.a.hold=true;R.a.face=B.x>R.a.x?1:-1;R.a.dir=R.a.face;
            P.say(R.a,"とってきたよ〜！",1.4);P.jump(R.a,3.8);
            s.m.forEach(function(a){if(a!==R.a&&alive(s,a)){a.hold=false;go(a,a.spot.x,a.spot.y,1.2);
              if(Math.random()<.5)P.later(.5,function(){if(alive(s,a))P.say(a,pick(["はやい〜","あ〜、まけた〜"]),1.2);});}});
          }
          return;
        }
        if(!R.back&&R.t>.45)afterFetch(s,R.a,R);
        if(R.back){
          B.x=R.a.x+R.a.dir*R.a.u*.55;B.y=R.a.y;
          var done2=arrived(R.a);
          if(done2||R.t>3.5){
            s.m.forEach(function(a){if(alive(s,a))a.hold=true;});
            s.h=R.a;s.wait=.6;s.fetch=null;
            if(R.a!==R.missed&&alive(s,R.missed))s.nextRecv=R.missed;}
        }
        return;
      }
      if(s.fetch){
        var F=s.fetch,f=F.a;
        /* ひろいに来てくれた子が いなくなったら、なかまが かわりに */
        if(F.by&&(P.animals.indexOf(f)<0||f.leaving||f.sess)){f.helping=null;s.fetch=null;startFetch(s,F.missed,true);return;}
        s.m.forEach(function(a){if(a!==f&&alive(s,a)){a.hold=true;faceTo(a,f);}});
        if(!F.got){
          f.hold=false;go(f,B.x-(B.x>f.x?1:-1)*f.u*.55,B.y,1.35);
          if(arrived(f)||Math.hypot(f.x-B.x,f.y-B.y)<f.u*.7){F.got=true;f.hold=true;f.rest=9;f.face=B.x>f.x?1:-1;f.dir=f.face;P.say(f,"あった！",1);F.t=0;}
        }else if(F.by){
          /* あそびに入っていない子：その場から、とりそこねた子へ なげかえす */
          F.t+=dt;
          if(F.t>.6){
            var to=alive(s,F.missed)?F.missed:s.m.filter(function(a){return alive(s,a);})[0];
            faceTo(f,to);P.jump(f,2.6);P.say(f,"はい、どうぞ！",1.2);
            B.x0=B.x;B.y0=B.y;B.x1=to.x+to.dir*to.u*.55;B.y1=to.y;B.f=0;B.dur=.95;B.h=P.U*1.6;B.fly=true;
            s.backPass=true;s.recv=to;
            B.onLand=function(){s.backPass=false;s.recv=null;if(!alive(s,to))return;s.h=to;s.wait=.9;P.jump(to,2.2);P.say(to,"ありがとう！",1.1);};
            f.helping=null;f.hold=false;f.face=0;f.rest=rand(1,2);s.fetch=null;
          }
        }else{
          F.t+=dt;
          if(F.t>.4&&!F.back)afterFetch(s,f,F);
          if(F.back){B.x=f.x+f.dir*f.u*.55;B.y=f.y;
            var done3=arrived(f);
            if(done3||F.t>3.5){s.m.forEach(function(a){if(alive(s,a))a.hold=true;});B.x=f.x+f.dir*f.u*.55;B.y=f.y;s.h=f;s.wait=.5;
              /* なかまが とってあげたときは、まず とりそこねた子へ パス */
              if(f!==F.missed&&alive(s,F.missed))s.nextRecv=F.missed;
              s.fetch=null;}}
        }
        return;
      }
      if(s.kicks>=s.goal){next(s);return;}
      faceAll(h);
      s.wait-=dt;
      if(s.wait<0){
        var others=s.m.filter(function(a){return a!==h&&alive(s,a);});if(!others.length)return true;
        var rc;
        if(s.nextRecv&&alive(s,s.nextRecv)&&s.nextRecv!==h){rc=s.nextRecv;s.thanks=true;}
        else if(n===2)rc=others[0];
        else{
          /* まだ あまり もらっていない子に まわす（ひとりだけ 仲間はずれに ならないように） */
          var mn=1e9;others.forEach(function(o){mn=Math.min(mn,o.gotBall||0);});
          var least=others.filter(function(o){return (o.gotBall||0)<=mn;});
          rc=Math.random()<.85?pick(least):pick(others);
        }
        s.nextRecv=null;
        var strong=s.strong,thanks=s.thanks;s.strong=false;s.thanks=false;faceTo(h,rc);faceTo(rc,h);P.jump(h,strong?3.6:2.6);
        if(thanks)P.say(h,"はい、どうぞ！",1.1);
        else if(!strong&&Math.random()<.6)P.say(h,pick(n>2?["つぎ、"+rc.sp.name+"！","それっ","パス！"]:["それっ","パス！","いくよ〜","えいっ"]),1);
        B.x0=B.x;B.y0=B.y;B.x1=rc.x+rc.dir*rc.u*.55;B.y1=rc.y;B.f=0;B.dur=strong?1.15:.85;B.h=P.U*(strong?2.6:1.4);B.fly=true;s.recv=rc;
        /* ときどき とりそこねて、ボールが ころがっていく */
        /* ボールを とりそこねるのは、2あそびに 1回くらい */
        if(!s.miss&&s.kicks>1&&Math.random()<.06){s.miss=true;P.later(B.dur*.9,function(){if(alive(s,rc))P.say(rc,pick(["わっ、とれなかった〜","あっ、ボールが〜！"]),1.2);});}
        B.onLand=function(){
          if(!alive(s,rc))return;
          if(s.miss){s.miss=false;roll(s,rc,true);return;}
          s.recv=null;P.jump(rc,2.2);
          if(thanks)P.say(rc,"ありがとう！",1);else if(Math.random()<.4)P.say(rc,pick(["とった！","ナイス！","じょうず〜！"]),1);
          rc.gotBall=(rc.gotBall||0)+1;
          s.h=rc;s.kicks++;s.wait=.5;};
      }
    },
    tap:function(s,a){var B=s.ball;
      if(s.st===0){tapLine(a,"ball0",["いまから ボールあそび！","じゅんび、じゅんび"]);return;}
      if(s.st===2){tapLine(a,"ballEnd",["いっぱい パスしたね","ボール、じょうずでしょ"]);return;}
      if(s.fetch&&s.fetch.race){
        tapLine(a,"ballRace",s.fetch.got?["とれた〜！","もうすこし だったのに〜"]:["まって〜、ボール〜！","だれが さきに とるかな？","まけないぞ〜"]);
        return;
      }
      if(s.fetch){
        if(a===s.fetch.a)tapLine(a,"ballFetch",a===s.fetch.missed?["まって〜、ボール〜","いま、とりにいくの！"]:["とってあげるね〜","まかせて！"]);
        else tapLine(a,"ballWait",a===s.fetch.missed?["ありがとう〜","ごめんね〜"]:["はやく〜！","ここで まってるね"]);
        return;
      }
      if(B.fly&&a===s.recv){tapLine(a,"ballMiss",["わっ、とれなかった〜","あっ、ボールが〜！"]);if(!s.miss){s.miss=true;P.jump(a,3.8);}return;}
      /* ころがっている／なげかえして もらっている／とりそこねる パス のときは
         「いいパス〜」とは 言わない */
      if(B.fly&&s.loose){
        tapLine(a,"ballLoose",a===s.lastMissed?["あっ、ボールが〜！","ごめん、とれなかった〜"]:["ボール、ころがってる〜","だれか とって〜！"]);
        return;
      }
      if(B.fly&&s.backPass){
        tapLine(a,"ballBack",a===s.recv?["キャッチ するよ〜","ありがとう〜！"]:["よかった、もどってきた〜","はやく つづきしよ〜"]);
        return;
      }
      if(B.fly){
        if(s.miss)tapLine(a,"ballGoMiss",["あーっ、とれるかな…？","がんばって〜！"]);
        else tapLine(a,"ballGo",["とどけ〜！","いいパス〜"]);
        return;
      }
      if(a===s.h){tapLine(a,"ballKick",["いくよ〜、それっ！","つよく けっちゃえ！"]);if(fx(s,1)){s.wait=0;s.strong=true;}return;}
      tapLine(a,"ballReady",["こっち、こっち〜！","パスして〜！"]);
    },
    tapBall:function(s){var B=s.ball;
      if(B.fly)return;
      if(s.st===2){P.note(B.x,B.y-P.U*.6,"ころん");return;}
      /* じゅんび中は、その場でぽーんとはねるだけ */
      if(s.st===0){B.x0=B.x;B.y0=B.y;B.x1=B.x;B.y1=B.y;B.f=0;B.dur=.7;B.h=P.U*1.6;B.fly=true;B.onLand=null;P.note(B.x,B.y-P.U,"ぽーん");return;}
      /* あそんでいる間は ころがる。だれかが とりにいく */
      var missed=s.fetch?s.fetch.missed:s.h;
      if(s.fetch&&!s.fetch.by)s.fetch.a.hold=true;
      roll(s,missed,false);P.note(B.x,B.y-P.U*.6,"ころころ");
      var o=s.m.filter(function(a){return a!==missed&&alive(s,a);})[0];
      P.later(.25,function(){if(alive(s,o))P.say(o,pick(["あっ、ボールが〜！","ころがっちゃった〜"]),1.2);});
    }},

  hide:{init:function(s){var k=s.m[0],h=s.m[1];
      /* かくれる場所：いちばん近い しげみ */
      s.b=S.bushes.slice().sort(function(p,q){return AD.dist(h,p)-AD.dist(h,q);})[0];
      s.hp=s.b.hidePoint();s.via=s.b.viaFor(h,h.u);
      /* ときどき、その しげみには 先に だれかが いる（2ひきで いっしょに かくれる） */
      if(Math.random()<.4){
        var g=P.animals.filter(function(a){return P.free(a)&&!a.chat&&!a.watch&&a!==k&&a!==h;})
          .sort(function(p,q){return AD.dist(s.b,p)-AD.dist(s.b,q);})[0];
        if(g&&AD.dist(s.b,g)<P.U*16){
          s.g=g;g.sess=s;g.rest=0;g.face=0;g.hold=false;s.m.push(g);
          go(g,s.hp.x+(s.b.x>s.hp.x?.9:-.9)*g.u,s.hp.y+3,1.7);
        }
      }
      k.hold=true;k.sleep=true;k.face=s.b.x>k.x?-1:1;P.say(k,"もういいかい？",1.6);go(h,(s.via||s.hp).x,(s.via||s.hp).y,1.35);},
    update:function(s,dt){var k=s.m[0],h=s.m[1],b=s.b,g=s.g;
      if(s.st===0){
        if(s.tt>1.7&&once(s,"m"))P.say(h,"まあだだよ",1.3);
        if(s.via&&!s.viaDone&&(arrived(h)||s.tt>5)){s.viaDone=true;go(h,s.hp.x,s.hp.y,1.35);}
        /* 先客との かけあい */
        if(s.met){
          s.mt+=dt;
          if(s.mt>1.3&&once(s,"g1")){faceTo(g,h);P.say(g,"……。",1.1);}
          if(s.mt>2.5&&once(s,"g2")){faceTo(h,g);P.say(h,"あれ？ もう だれか いる？",1.5);}
          if(s.mt>4&&once(s,"g3"))P.say(g,"しーっ…",1.3);
          if(s.mt>5.3){hideNow(s);next(s);}
          return;
        }
        if(s.tt>.8&&(((!s.via||s.viaDone)&&arrived(h))||s.tt>10)){
          if(g&&alive(s,g)&&(arrived(g)||s.tt>7)){
            s.met=true;s.mt=0;h.hold=true;g.hold=true;h.x=s.hp.x;h.y=s.hp.y;
            P.say(h,"ここなら みつからないかな？",1.6);return;
          }
          hideNow(s);next(s);
        }
      }
      else if(s.st===1){
        if(s.tt>.4&&once(s,"ok"))P.say(h,"もういいよ",1.4);
        if(s.tt>1.9){
          k.sleep=false;k.hold=false;k.face=0;
          /* からだが しげみから はみ出ている子は すぐ見つかる */
          /* あたまが しげみより はっきり 上に出ているときだけ「みえてるよ」と言う */
          s.big=P.headY(h)<b.y-b.img.h-h.u*.3;
          s.route=s.big?[]:seekRoute(s,k,h);
          if(s.big)P.say(k,"あれっ、からだ みえてるよ〜",1.5);
          else P.say(k,s.route.length?s.route[0].go:"どこかな〜？",1.4);
          goSeek(s,k);next(s);
        }
      }
      else if(s.st===2){
        s.wait=(s.wait||0)-dt;
        var stop=s.route&&s.route.length?s.route[0]:null;
        if(stop){
          /* まちがえた場所：ついたら ひとこと 言って、つぎへ */
          if(!stop.done&&(arrived(k)||s.tt>stop.limit)){
            stop.done=true;k.hold=true;s.wait=1.3;
            if(stop.by&&alive2(stop.by)){faceTo(k,stop.by);faceTo(stop.by,k);
              P.say(k,stop.at,1.4);
              P.later(1.1,function(){if(alive2(stop.by))P.say(stop.by,stop.byLine,1.4);});
            }else P.say(k,stop.at,1.4);
          }
          if(stop.done&&s.wait<=0){s.route.shift();k.hold=false;s.tt=0;
            if(s.route.length)P.say(k,s.route[0].go,1.4);
            goSeek(s,k);}
          return;
        }
        if(arrived(k)||s.tt>9){
          faceTo(k,h);k.hold=true;
          P.say(k,s.big?"やっぱり、ここだ〜！":s.revealed?"そこだ〜！ みーつけた！":"みーつけた！",1.2);P.jump(h,5);
          h.hidden=false;h.hold=false;h.rest=.5;
          P.later(1.2,function(){if(alive(s,h))P.say(h,s.big?"あっ、はみでてた〜":"みつかっちゃった〜",1.4);});
          /* 先客が いるときは、気づくか、気づかないで さがしつづけるか */
          s.two=g&&alive(s,g)?(Math.random()<.5?"now":"later"):null;
          next(s);
        }
      }
      else if(s.st===3){
        if(s.two==="now"&&s.tt>2&&once(s,"g4")){
          P.say(k,"あれ、ふたりも いる〜！",1.5);g.hidden=false;g.hold=false;g.rest=.5;P.jump(g,4);
          P.later(1.2,function(){if(alive(s,g))P.say(g,"みつかっちゃった〜",1.3);});
        }
        if(s.two==="later"){
          if(s.tt>2&&once(s,"g5"))P.say(k,"…まだ、だれか いる きがする",1.6);
          if(s.tt>3.6&&once(s,"g6")){P.say(g,"ここだよ〜！",1.4);g.hidden=false;g.hold=false;g.rest=.5;P.jump(g,4.6);}
          if(s.tt>4.9&&once(s,"g7"))P.say(k,"そこに いたの〜！",1.4);
        }
        if(s.tt>2&&once(s,"faceBye"))faceTo(h,k);
        return goodbye(s,k,h,s.tt,s.two==="later"?6:s.two?4:2.7);
      }
    },
    tap:function(s,a){var k=s.m[0],h=s.m[1],b=s.b;
      if(a===k){
        if(s.st<=1)tapLine(a,"hideCount",["いま、かぞえてるの！","のぞいてないよ〜","いーち、にーい…"]);
        else if(s.st===2)tapLine(a,"hideSeek",["どこかな〜？","ヒント、ちょうだい〜"]);
        else tapLine(a,"hideDone",["みーつけた！","かくれるの、じょうずだね"]);
        return;
      }
      if(a===s.g){tapLine(a,"hideGuest",["しーっ…","いっしょに かくれてるの","さきに かくれてたんだ"]);return;}
      if(s.st===0)tapLine(a,"hideGo",["いま、かくれるところ！","しーっ、ないしょね"]);
      else if(s.st===1){tapLine(a,"hideShh",["しーっ！","みつかっちゃうよ〜"]);
        if(fx(s,1.6))P.later(.6,function(){if(alive(s,k))P.say(k,"あれ？ いま、こえがした？",1.4);});}
      else if(s.st===2){tapLine(a,"hideOops",["あっ、こえ でちゃった！","しーっ…！"]);
        /* こえが したら、おにも 気づいて そっちを むく */
        if(fx(s,1.4))P.later(.45,function(){
          if(!alive(s,k))return;
          faceTo(k,a);
          P.say(k,pick(["あれっ、なにか きこえたぞ","いま、こえが したぞ〜","そっちかな…？"]),1.5);
        });
        if(!s.revealed){s.revealed=true;s.route=[];k.hold=false;goSeek(s,k);}}
      else tapLine(a,"hideFound",["みつかっちゃった〜","つぎは みつからないぞ〜"]);
    }},

  dance:{init:function(s){
      var n=s.m.length;
      if(n===2)pair(s,(s.m[0].u+s.m[1].u)*.7);
      else{
        /* 3ひき以上は わになって おどる */
        var u=s.m.reduce(function(v,a){return Math.max(v,a.u);},0),R=P.U*(n===3?1.9:2.3),cx=0,cy=0;
        s.m.forEach(function(a){cx+=a.x;cy+=a.y;});
        var near={x:clamp(cx/n,S.W*.2,S.W*.8),y:clamp(cy/n,S.top+R*.8,S.bottom-R*.7)};
        var ok=function(c){return ringSpots(c,n,R).every(function(p){return S.clear(p.x,p.y,u);});};
        s.c=ok(near)?near:(S.safeSpot(u,near,ok)||near);
        var dorder=byAngle(s.m,s.c);
        ringSpots(s.c,n,R).forEach(function(p,i){go(dorder[i],p.x,p.y);});
      }
      s.k=0;s.n=0;s.fast=0;s.ext=0;},
    update:function(s,dt){var a=s.m[0],b=s.m[1];
      if(s.st===0&&(s.m.every(arrived)||s.tt>6)){s.m.forEach(function(d){d.hold=true;});next(s);}
      else if(s.st===1){s.k-=dt;s.fast=Math.max(0,s.fast-dt);
        if(s.k<0){s.k=s.fast>0?.28:.42;s.n++;
          s.m.forEach(function(d){
            if(s.trip&&s.trip.a===d&&s.trip.n>0){P.jump(d,1.1);return;}
            P.jump(d,s.fast>0?3.2:2.6);
          });
          if(s.trip){s.trip.n--;if(s.trip.n<=0)s.trip=null;}
          /* うちむき → そとむき を くりかえす */
          s.m.forEach(function(d){var inw=s.c.x>d.x?1:-1;d.face=s.n%2?inw:-inw;d.dir=d.face;});
          if(s.n%2){
            var hy=1e9;s.m.forEach(function(d){hy=Math.min(hy,P.headY(d));});
            P.note(s.c.x,hy,"♪");
          }}
        if(s.n>=8){
          /* おどっている みんなで きめる */
          s.m.forEach(function(d,i){
            if(!i){P.say(d,"じゃーん！",1.1,true);return;}
            P.later(.15*i,function(){if(alive(s,d))P.say(d,"じゃーん！",1.1,true);});
          });
          next(s);}}
      else if(s.st===2){if(once(s,"faceBye")){faceTo(a,b);faceTo(b,a);}return goodbye(s,b,a,s.tt,1.3);}
    },
    tap:function(s,a){var o=s.m.filter(function(x){return x!==a&&alive(s,x);})[0];
      if(s.st===0){tapLine(a,"dance0",["いまから おどるの！","じゅんび、じゅんび"]);return;}
      if(s.st===2){tapLine(a,"danceEnd",["じゃーん！","きまった！"]);return;}
      var line=tapLine(a,"danceTap",["くるっ！","ノッてきた〜！","おっとっと！"]);
      if(!fx(s,.8))return;
      if(line==="くるっ！"){P.jump(a,4.8);a.face=-(a.face||a.dir);a.dir=a.face;if(s.ext<6){s.n=Math.max(0,s.n-2);s.ext+=2;}
        P.later(.45,function(){if(alive(s,o))P.say(o,"じょうず〜！",1.1);});}
      else if(line==="ノッてきた〜！"){s.fast=2.6;P.later(.45,function(){if(alive(s,o))P.say(o,"はやい、はやい〜！",1.1);});}
      else{s.trip={a:a,n:2};P.later(.5,function(){if(alive(s,o))P.say(o,"だいじょうぶ？",1.1);});}
    }},

  parade:{init:function(s){
      /* 先頭は さそった子。まず先頭のうしろに 一列にならんでから「しゅっぱーつ！」 */
      var L=s.m[0],prev={x:L.x,y:L.y};
      /* 草原を6つに分けて、先頭のいる場所から ぐるっと まわるように 4か所をえらぶ（同じところを行ったり来たりしない） */
      var cx=S.W/2,cy=(S.top+S.bottom)/2,zones=[];
      for(var col=0;col<3;col++)for(var row=0;row<2;row++){
        var zx=S.W*(.16+col*.34),zy=S.top+(S.bottom-S.top)*(row?.75:.28);
        if(Math.abs(zx-L.x)<L.u*2.5&&Math.abs(zy-L.y)<L.u*2)continue;
        zones.push({x:zx,y:zy,an:Math.atan2(zy-cy,zx-cx)});
      }
      var start=Math.atan2(L.y-cy,L.x-cx),turn=Math.random()<.5?1:-1;
      zones.forEach(function(z){var d=(z.an-start)*turn;while(d<0)d+=Math.PI*2;z.order=d;});
      zones.sort(function(p,q){return p.order-q.order;});
      s.wp=[];
      zones.slice(0,4).forEach(function(z){
        var got=null;
        for(var t=0;t<14&&!got;t++){
          var q={x:clamp(z.x+rand(-1,1)*S.W*.1,L.u*1.4,S.W-L.u*1.4),y:clamp(z.y+rand(-1,1)*(S.bottom-S.top)*.12,S.top,S.bottom)};
          if(S.clear(q.x,q.y,L.u*1.3)&&AD.dist(prev,q)>L.u*3&&S.segClear(prev,q,L.u))got=q;
        }
        got=got||S.safeSpot(L.u*1.3,z)||S.randomSpot(L.u*2);
        s.wp.push(got);prev=got;
      });
      if(!s.wp.length)s.wp.push(S.randomSpot(L.u*2));
      s.i=0;s.talkT=2;s.stop=0;s.lined=false;
      var dx=s.wp[0].x-L.x,dy=s.wp[0].y-L.y,dl=Math.hypot(dx,dy)||1;
      L.hold=true;L.face=dx>0?1:-1;L.dir=L.face;
      /* 先頭のうしろ（進む向きの反対）に1列。ボードの外になるときは、先頭を少し前に出して場所をつくる */
      var back=L.u*1.6*(s.m.length-1),bx=L.x-dx/dl*back,by=L.y-dy/dl*back*.6;
      if(bx<L.u||bx>S.W-L.u||by<S.top||by>S.bottom){
        var sx=clamp(bx,L.u,S.W-L.u)-bx,sy=clamp(by,S.top,S.bottom)-by;
        go(L,L.x+sx,L.y+sy,1.2);L.hold=false;s.leadMove=true;
      }
      s.hx=dx/dl;s.hy=dy/dl;
      queueSpots(s,L,L.tx,L.ty).forEach(function(q,i){
        var f=s.m[i+1],p2=P.unhidePoint(q.x,q.y,f.u);go(f,p2.x,p2.y,1.6);
      });
      P.say(L,"ならんで〜！",1.2);},
    update:function(s,dt){var L=s.m[0];
      if(s.st===1)return goodbye(s,s.m[s.m.length-1],L,s.tt,1.4);
      if(!s.lined){
        if(s.leadMove&&arrived(L)){s.leadMove=false;L.hold=true;}
        /* 「うん」と こたえた子が ぜんぶ 先頭の すぐうしろに ならぶまで 出発しない。
           席は 先頭の いまの ばしょから 計算しなおす（先頭が うごいても ずれない） */
        queueSpots(s,L,L.x,L.y).forEach(function(q,i){
          var f=s.m[i+1];if(!f)return;
          var p2=P.unhidePoint(q.x,q.y,f.u);
          if(Math.hypot(p2.x-f.tx,p2.y-f.ty)>f.u*.2)go(f,p2.x,p2.y,1.6);
        });
        function atSlot(f,k){return Math.hypot(f.tx-f.x,f.ty-f.y)<f.u*(k||.42);}
        var ready=!s.leadMove&&s.m.slice(1).every(function(f){return atSlot(f);});
        if(!ready&&s.tt>15){
          /* どうしても ならべない子だけ、今回は いっしょに行かない（歩きだしてから さそう）。
             のこった子は そのまま ならぶまで まつ */
          var far=s.m.slice(1).filter(function(f){return !atSlot(f,1.1);});
          far.forEach(function(f){
            var i=s.m.indexOf(f);if(i<0)return;s.m.splice(i,1);
            f.sess=null;f.hold=false;f.face=0;f.mult=1;f.rest=rand(.3,1);f.cool=rand(1,3);
          });
          if(s.m.length<2)return true;
          if(far.length)s.tt=0;else ready=true;
        }
        if(ready){
          s.lined=true;s.tt=0;L.hold=false;
          s.m.slice(1).forEach(function(f){f.face=L.face;f.dir=L.face;});
          /* ならんだ順に 道すじをつくっておくと、うしろの子が そのまま ついていける */
          s.trail=s.m.slice(1).reverse().map(function(f){return {x:f.x,y:f.y};}).concat([{x:L.x,y:L.y}]);
          P.say(L,"しゅっぱーつ！",1.4);go(L,s.wp[0].x,s.wp[0].y,.9);
        }
        return;
      }
      if(s.stop>0){s.stop-=dt;s.m.forEach(function(m){m.hold=true;});if(s.stop<=0)s.m.forEach(function(m){m.hold=false;});return;}
      /* 時間が きたら（先頭が つけなくても）おしまい */
      if(s.t>34){P.say(L,"とうちゃく！",1.3);s.m.forEach(function(a){a.hold=true;P.jump(a,3.2);});next(s);return;}
      if(arrived(L)){s.i++;if(s.i>=s.wp.length){P.say(L,"とうちゃく！",1.3);s.m.forEach(function(a){a.hold=true;P.jump(a,3.2);});next(s);return;}
        /* もどる かたちに なるときは、まず 上か下へ 曲がってから */
        var turn=paradeTurn(s,L,s.wp[s.i]);
        if(turn)s.wp.splice(s.i,0,turn);
        go(L,s.wp[s.i].x,s.wp[s.i].y,.9);}
      /* 先頭が すすめなくなったら、つぎの ばしょへ */
      if(Math.hypot(L.x-(s.lx==null?L.x-99:s.lx),L.y-(s.ly==null?L.y:s.ly))<L.u*.05){
        s.lt=(s.lt||0)+dt;
        if(s.lt>2.5){
          s.lt=0;s.i++;if(s.i>=s.wp.length)s.i=0;
          var nx2=S.safeSpot(L.u*1.2,s.wp[s.i])||S.randomSpot(L.u*2);
          var turn2=paradeTurn(s,L,nx2);
          s.wp[s.i]=nx2;go(L,(turn2||nx2).x,(turn2||nx2).y,.95);
          if(turn2)s.wp.splice(s.i,0,turn2);
        }
      }else{s.lt=0;s.lx=L.x;s.ly=L.y;}
      /* うしろの子は、先頭が通った道をそのままたどる（しげみや文字にかぶらない） */
      s.trail=s.trail||[{x:L.x,y:L.y,c:0}];
      /* 道すじに「はじめから何歩ぶんか」を おぼえさせる */
      if(s.trail[0].c==null)s.trail.forEach(function(q,i){q.c=i?s.trail[i-1].c+Math.hypot(q.x-s.trail[i-1].x,q.y-s.trail[i-1].y):0;});
      var lt=s.trail[s.trail.length-1],seg=Math.hypot(L.x-lt.x,L.y-lt.y);
      if(seg>L.u*.2){s.trail.push({x:L.x,y:L.y,c:lt.c+seg});lt=s.trail[s.trail.length-1];}
      if(s.trail.length>400)s.trail.shift();
      /* 先頭が ぴょんぴょん とぶ子だと 道が とびとびに のびて、うしろの子が
         「走っては 止まる」の こきざみ歩きに なってしまう。
         なめらかに すすむ「見えない先頭」を つくり、その はやさに 合わせて ついていく */
      var tlen=lt.c;
      if(s.vpos==null)s.vpos=tlen;
      var vp0=s.vpos;
      s.vpos+=(tlen-s.vpos)*Math.min(1,dt*2.4);
      var vsp=(s.vpos-vp0)/Math.max(dt,.001);
      s.vspd=(s.vspd==null?vsp:s.vspd+(vsp-s.vspd)*Math.min(1,dt*2.5));
      /* 先頭が すすんでいる むき（あとから入る子が うしろに つくのに つかう） */
      var tl=s.trail.length,hx=0,hy=0;
      if(tl>=2){hx=s.trail[tl-1].x-s.trail[tl-2].x;hy=s.trail[tl-1].y-s.trail[tl-2].y;}
      if(!hx&&!hy){hx=L.tx-L.x;hy=L.ty-L.y;}
      var hl=Math.hypot(hx,hy)||1;hx/=hl;hy/=hl;
      var want=0;
      for(var i=1;i<s.m.length;i++){
        var f=s.m[i];
        want+=(s.m[i-1].u+f.u)*1.05;
        if(f.lag>0){f.lag-=dt;f.hold=true;if(f.lag<=0){f.hold=false;f.catchT=2;P.say(f,"まって〜！",1.1);}continue;}
        f.catchT=Math.max(0,(f.catchT||0)-dt);
        var pt=null,at=s.vpos-want,lhx=hx,lhy=hy;
        for(var j=s.trail.length-1;j>=0;j--){
          if(s.trail[j].c<=at){
            var q0=s.trail[j],q1=s.trail[Math.min(j+1,s.trail.length-1)],span=(q1.c-q0.c)||1,r0=clamp((at-q0.c)/span,0,1);
            pt={x:q0.x+(q1.x-q0.x)*r0,y:q0.y+(q1.y-q0.y)*r0};
            /* その ばしょでの 道の むき（先頭の いまの むきとは ちがう。
               曲がった あとでも なめらかに ついていけるように） */
            var lx=q1.x-q0.x,ly=q1.y-q0.y,ll=Math.hypot(lx,ly);
            if(ll>.001){lhx=lx/ll;lhy=ly/ll;}
            break;
          }
        }
        /* 道すじが まだ みじかいときは、いま いちばん うしろの子の さらに うしろへ（横入りしない） */
        var pv=s.m[i-1],gp=(pv.u+f.u)*1.05;
        if(!pt)pt={x:pv.x-lhx*gp,y:pv.y-lhy*gp*.6};
        /* 道すじが カーブしていると 前の子と ならんでしまうので、前の子から すこし はなす
           （たては 見た目が つまって 見えるので、すこし きつめに みる） */
        var vx=pt.x-pv.x,vy=pt.y-pv.y,vd=Math.hypot(vx,vy*1.25)||1;
        if(vd<gp*.92){var kk=gp*.92/vd;pt={x:pv.x+vx*kk,y:pv.y+vy*kk};}
        /* しげみ よけで 道から はずれると 列が くずれるので、道すじの点を そのまま つかう */
        var tp=pt;
        /* ちょうど ついていける はやさ：先頭と おなじ はやさ＋おくれたぶん だけ すこし足す。
           ねらう点は すこし前に おいて、止まったり 走ったり しないようにする */
        var fm=f.sp.motion,fbase=f.u*(fm==="hop"?2.0:fm==="waddle"?1.25:1.55);
        var along=(tp.x-f.x)*lhx+(tp.y-f.y)*lhy;
        var v=(s.vspd||0)+clamp(along*1.2,-f.u*.9,f.u*1.5)+(f.catchT>0?f.u*1.2:0);
        go(f,tp.x+lhx*f.u*.7,tp.y+lhy*f.u*.7,clamp(v/fbase,.05,2.4));
      }
      /* 歩いていくうちに、とちゅうの子が どんどん くわわる */
      s.joinT=(s.joinT==null?rand(1.5,3):s.joinT)-dt;
      if(s.joinT<=0&&s.m.length<9){
        s.joinT=rand(2.5,4.5);
        var tail=s.m[s.m.length-1];
        /* さそうのは、行列の うしろがわ にいる子だけ。
           横から入ると 列を横切ってしまうので、うしろから ついてくる子に かぎる */
        var g=P.animals.filter(function(a){
          if(!P.free(a)||a.chat)return false;
          var vx=a.x-tail.x,vy=(a.y-tail.y)*1.2,d=Math.hypot(vx,vy);
          if(d>P.U*7||d<P.U*.6)return false;
          /* うしろに いて（前に まわりこまない）、よこにも ずれすぎていない子だけ。
             列を よこぎって 入ってくると じゃまに なる */
          var back=vx*-hx+vy*-hy,side=Math.abs(vx*-hy+vy*hx);
          return back>P.U*.8&&back/d>.62&&side<P.U*2.2;
        }).sort(function(p,q){return AD.dist(tail,p)-AD.dist(tail,q);})[0];
        if(g){
          g.sess=s;g.rest=0;g.hold=false;g.face=0;g.catchT=3;g.watch=null;g.watchMove=false;g.galI=null;
          s.m.push(g);
          P.say(g,pick(["いれて〜！","ぼくも いく〜！","わたしも いれて〜"]),1.4);P.jump(g,3.2);
          P.later(.7,function(){if(alive(s,L))P.say(L,pick(["いいよ〜！","うしろに ついて〜","どんどん ふえるね〜"]),1.3);});
        }
      }
      s.talkT-=dt;if(s.talkT<0){s.talkT=rand(2,3);P.say(pick(s.m.slice(1)),pick(["いちに、いちに","まって〜","たのしいね"]),1.2);}
    },
    tap:function(s,a){var L=s.m[0];
      if(s.st===1){tapLine(a,"parEnd",["とうちゃく〜！","ついたね"]);return;}
      if(a===L){tapLine(a,"parLead",["ぜんたーい、とまれ！","ちょっと、きゅうけい！"]);
        if(fx(s,2.4)){s.stop=1.6;var f=s.m[1];
          P.later(.45,function(){if(alive(s,f))P.say(f,"わわっ、きゅうに とまった！",1.2);});
          P.later(1.5,function(){if(alive(s,L))P.say(L,"しゅっぱつ しんこう！",1.2);});}
        return;}
      tapLine(a,"parFollow",["あっ、よそみしちゃった","まって〜、おいていかないで〜"]);
      if(!(a.lag>0)&&!(a.catchT>0))a.lag=1.2;
    }}
};

/* ---- みずあび：池のほとりで、水をかけあう（ゾウは はなで シャワー） ---- */
function splash(x,y,u,big){
  var n=big?16:10;
  for(var i=0;i<n;i++)P.sparks.push({x:x,y:y,a:-PI*(.1+.8*i/(n-1)),born:P.now,col:2,u:u*(big?1.3:1)});
  P.note(x,y-u*.8,big?"ばしゃーん":"ぱしゃ","#4A92C6");
}
ACT.mizu={
  init:function(s){
    var p=S.pond,u=s.m.reduce(function(v,a){return Math.max(v,a.u);},0);
    var side=p.rx*1.35+u*.4,L={x:p.x-side,y:p.y+p.ry*.3},R={x:p.x+side,y:p.y+p.ry*.3},Fr={x:p.x,y:p.y+p.ry*2.3+u*.3};
    var spots=[L,R,Fr].filter(function(q){return q.x>u*1.1&&q.x<S.W-u*1.1&&q.y<=S.bottom;});
    if(spots.length<s.m.length)spots.push({x:p.x+(Math.random()<.5?-1:1)*p.rx*.6,y:Math.min(S.bottom,p.y+p.ry*2.4+u*.3)});
    /* 近い子から近い岸へ */
    var used=[];
    s.m.forEach(function(a){
      var best=spots.filter(function(q){return used.indexOf(q)<0;}).sort(function(q1,q2){return Math.hypot(a.x-q1.x,a.y-q1.y)-Math.hypot(a.x-q2.x,a.y-q2.y);})[0]||spots[0];
      used.push(best);a.spot=best;go(a,best.x,best.y,1.2);
    });
    /* 「ぱおーん」は ゾウだけ。ゾウがいないときは ほかの子が さそう */
    var ele=s.m.filter(function(a){return a.sp.key==="foot2";})[0];
    if(ele)P.say(ele,"ぱおーん、いけに いこう！",1.3);
    else P.say(s.m[0],pick(["いけに いこう！","みずあび しよう！"]),1.3);
    s.turn=0;s.k=0;s.goal=6+(s.m.length-2)*2;s.n=0;
  },
  update:function(s,dt){
    var p=S.pond;
    s.m.forEach(function(a){a.wet=Math.max(0,(a.wet||0)-dt);a.shake=a.wet>0?Math.sin(P.now*42)*a.u*.05:0;});
    if(s.st===0){
      if(s.m.every(arrived)||s.tt>7){
        s.m.forEach(function(a){a.hold=true;a.face=p.x>a.x+2?1:p.x<a.x-2?-1:(a.dir||1);a.dir=a.face;});
        next(s);s.k=.5;
      }
      return;
    }
    if(s.st===2)return goodbye(s,s.m[0],s.m[1],s.tt,1.2);
    s.k-=dt;
    if(s.k<=0){
      s.k=rand(.8,1.1);
      var who=s.m[s.turn%s.m.length],others=s.m.filter(function(a){return a!==who;}),to=pick(others);
      s.turn++;s.n++;
      P.jump(who,2.8);
      var sx=who.x+(p.x-who.x)*.3,sy=who.y-who.u*.1;
      if(who.sp.key==="foot2"&&Math.random()<.6){
        /* ゾウは はなから シャワー */
        if(Math.random()<.5)P.say(who,"ぱおーん、シャワー！",1.2);
        splash(to.x,to.y-to.u*1.9,who.u,true);
      }else splash(sx,sy,who.u,false);
      P.later(.35,function(){if(!alive(s,to))return;to.wet=.5;if(Math.random()<.55)P.say(to,pick(["つめたーい！","きゃっ！","えいっ、おかえし！"]),1);});
      if(s.n>=s.goal)next(s);
    }
  },
  tap:function(s,a){
    if(s.st===0){tapLine(a,"mizu0",["みずあび、するんだ〜","いけに いこう！"]);return;}
    if(s.st===2){tapLine(a,"mizuEnd",["びしょびしょ〜","きもちよかった"]);return;}
    var line=tapLine(a,"mizuTap",["ばしゃーん！","つめたくて きもちいい〜"]);
    if(line==="ばしゃーん！"&&fx(s,.8)){
      P.jump(a,3.6);
      s.m.forEach(function(o){if(o===a)return;splash(o.x,o.y-o.u*1.7,a.u,true);o.wet=.8;});
      var o=s.m.filter(function(x){return x!==a;})[0];
      P.later(.4,function(){if(alive(s,o))P.say(o,"わっ、びしょびしょ〜",1.2);});
    }else{a.wet=.6;}
  }
};
/* ---- あそびを始める前の「さそい」----
   なにが始まるのか分かるように、動き出す前に かならず
   ① さそう子が「〇〇、しよう！」 ② なかまが こたえる ③ それから場所へ行って はじめる */
var PLAY_NAME={tag:"おいかけっこ",ball:"ボールあそび",hide:"かくれんぼ",dance:"ダンス",mizu:"みずあび",parade:"ぎょうれつ",
  daruma:"だるまさんがころんだ",race:"よーいどん",tug:"つなひき",oni:"ふえおに"};
X.PLAY_NAME=PLAY_NAME;
var REPLY=["いいよ〜！","やろう、やろう！","うん、あそぼ！"];
X.start=function(type,m,quiet){
  var s={type:type,m:m,t:0,tt:0,st:0,flag:{},prep:{t:0,said:0}};
  m.forEach(function(a){a.sess=s;a.rest=0;a.face=0;a.hold=true;});
  P.sessions.push(s);
  /* おしゃべりから はじまるときは、もう さそいあったあとなので すぐ はじめる */
  if(quiet){s.prep=null;m.forEach(function(a){a.hold=false;a.face=0;});ACT[type].init(s);return s;}
  var inv=m[0],name=PLAY_NAME[type]||"あそび";
  P.say(inv,(m.length>=3?"みんなで "+name:name)+"、しよう！",1.6);P.jump(inv,3.2);
  m.forEach(function(a){if(a!==inv)faceTo(a,inv);});
  /* こたえるのは2ひきまで（ふきだしが多くなりすぎないように）。ほかの子は ぴょんと跳ねて こたえる */
  s.prep.replies=m.slice(1,3);s.prep.hops=m.slice(3);
  s.prep.dur=1.1+s.prep.replies.length*.5+.4;
  return s;
};
function tickPrep(s,dt){
  var pr=s.prep;pr.t+=dt;
  pr.replies.forEach(function(a,i){
    if(pr.t>1+i*.5&&once(s,"reply"+i)&&alive(s,a)){P.say(a,pick(REPLY),1.1);P.jump(a,2.6);}
  });
  if(pr.t>1.1&&once(s,"hops"))pr.hops.forEach(function(a,i){P.later(i*.12,function(){if(alive(s,a))P.jump(a,2.6);});});
  if(pr.t>=pr.dur){
    s.prep=null;s.flag={};s.t=0;s.tt=0;
    s.m.forEach(function(a){a.hold=false;a.face=0;});
    ACT[s.type].init(s);
  }
}
X.end=function(s){
  var i=P.sessions.indexOf(s);if(i>=0)P.sessions.splice(i,1);
  groupCool=rand(3,5);
  if(X.GROUP&&X.GROUP[s.type])bigCool=rand(12,16);
  s.m.forEach(function(a){if(a.sess!==s)return;a.afterPlay={type:s.type,t:P.now};a.sess=null;a.mult=1;a.face=0;a.hold=false;a.sleep=false;a.hidden=false;a.nod=0;a.shake=0;a.lag=0;a.catchT=0;
    a.faceLock=false;a.caught=false;a.wet=0;a.done=false;a.trip=0;a.boost=0;a.weak=0;a.wob=0;a.dash=0;
    a.even=null;a.burst=0;a.aim=null;a.rank=0;a.startX=null;
    a.rest=rand(1.5,3);a.cool=rand(5,9);a.tx=a.x;a.ty=a.y;});
  if(s.ball){var k=P.balls.indexOf(s.ball);if(k>=0)P.balls.splice(k,1);}
  if(s.fetch&&s.fetch.by&&s.fetch.a){s.fetch.a.helping=null;s.fetch.a.hold=false;s.fetch.a.face=0;s.fetch.a.rest=1;}
  (s.props||[]).forEach(function(pr){var j=P.props.indexOf(pr);if(j>=0)P.props.splice(j,1);});
};
/* ほかのファイル（みんなであそぶ あそび）から使う道具 */
X.ACT=ACT;
X.h={go:go,arrived:arrived,faceTo:faceTo,next:next,once:once,alive:alive,tapLine:tapLine,goodbye:goodbye,fx:fx,weighted:weighted};
/* にげる先をさがす（ふえおに からも つかう） */
/* いま、ブルーシートで みんなが 見まもる あそび（だるまさんがころんだ・よーいどん・つなひき）を
   している／これから する ところか */
X.watching=function(){
  return P.sessions.some(function(s){return WATCHABLE[s.type];});
};
X.fleeFrom=function(r,c,others){return pickFlee({flee:r.fleeP},r,c,others);};
/* その子が x のところまで 何秒で 行けるか（ならぶのに 間に合うかの 見つもり） */
X.canReach=function(a,x,secs){
  var m=a.sp.motion,base=a.u*(m==="hop"?2.0:m==="waddle"?1.25:1.55)*1.5;
  return Math.abs(x-a.x)/Math.max(1,base)<secs;
};
X.tick=function(s,dt){
  if(P.sessions.indexOf(s)<0)return;
  s.t+=dt;s.tt+=dt;
  /* 念のため：どんなあそびも いつかは おわる */
  if(s.t>95){X.end(s);return;}
  if(s.m.some(function(a){return a.leaving||P.animals.indexOf(a)<0;})){X.end(s);return;}
  if(s.prep){tickPrep(s,dt);return;}
  if(ACT[s.type].update(s,dt)===true)X.end(s);
};
/* あそんでいる子がタップされた */
X.onTap=function(a){
  var s=a.sess;if(!s||P.sessions.indexOf(s)<0||!ACT[s.type].tap)return false;
  /* さそっている間：これから なにをするのか を言う */
  if(s.prep){tapLine(a,"prep"+s.type,["これから "+(PLAY_NAME[s.type]||"あそび")+" するの！","はやく はじめよう！"]);return true;}
  ACT[s.type].tap(s,a);s.talkT=Math.max(s.talkT||0,1.8);
  return true;
};
/* あそびがおわってすぐ（1.5秒ほど）にタップされたら、いまのあそびをふりかえる。
   そのまま続けてタップしている間も、同じふりかえりのことばを言う */
/* おわりのあいさつ（たのしかった！）とかさならないよう、あそびの中身をふりかえることばにする */
var AFTER={
  tag:["いっぱい はしったね！","つぎは つかまらないぞ〜","はあ、どきどきした〜"],
  ball:["いっぱい パスできたね","ボール、うまくとれたよ","つぎは もっと とおくまで けるぞ"],
  hide:["つぎは どこに かくれようかな","みつけるの、どきどきしたね","しげみの中、ひみつの ばしょ"],
  dance:["くるくる、目がまわった〜","つぎは どんなダンスにしよう♪","あしが まだ おどってる〜"],
  parade:["いちに、いちに〜♪","ながい ぎょうれつ だったね","つぎは どこまで あるこうかな"]
};
AFTER.mizu=["つめたくて きもちよかった","まだ ぽたぽた してる〜","つぎは もっと とおくまで とばすぞ"];
X.AFTER=AFTER;
X.onTapAfter=function(a){
  var ap=a.afterPlay;if(!ap||a.sess||!AFTER[ap.type])return false;
  var key="after"+ap.type;
  if(!(P.now-ap.t<1.5||(a.ptKey===key&&P.now-a.ptT<1.6)))return false;
  tapLine(a,key,AFTER[ap.type],1.5);P.jump(a,3.4);
  return true;
};
/* 落ちているボールがタップされた */
X.onTapBall=function(B){
  for(var i=0;i<P.sessions.length;i++){var s=P.sessions[i];if(s.ball===B){ACT.ball.tapBall(s);return true;}}
  return false;
};
X.wake=function(){return false;};
/* あそびは同時に1つだけ。終わったらひと休み */
/* みんなであそんでいる間、入っていない子は そのあそびを見まもる（べつのことを始めない）。
   あそびの場所にかぶっていたら少しはなれて、あそびの方を向いて、ときどき おうえんする */
var CHEER={daruma:["そーっと、そーっと…","うごいちゃ だめだよ〜"],race:["がんばれ〜！","いけいけ〜！"],
tug:["がんばれ〜！","よいしょ〜！"],oni:["にげて〜！","うしろ、うしろ〜！"]};
/* シートで 見ている子の ひとりごと */
/* ブルーシートへ むかう とちゅうの ひとこと。
   「なにを しに いくのか」が わかる ことばにする */
var WATCH=["おうえん しに いくね！","きょうは かんせん〜","いい せきで みるぞ〜",
  "すわって おうえん するぞ〜","かんせん、かんせん〜"];
/* ---- 見まもる子の ブルーシート（絵をそのまま つかう） ---- */
var MAT=new Image();MAT.src="img/sheet.png";
var CUSH=[0,1,2].map(function(i){var im=new Image();im.src="img/cushion"+i+".png";return im;});
function drawMat(g,s){
  var G=s.gal;if(!G||!s.galN)return;
  var u=s.matU||P.U,rows=(s.seats&&s.seats.length>G.n)?2:1;
  var w=(G.n-1)*G.gap+u*(rows>1?3.8:3.2);
  /* たてよこの ひりつは のばしてよい（ならぶ列が 2つのときは たてに のばす） */
  /* たては これくらいで じゅうぶん（まえは 2ばい ちかく あった） */
  var h=Math.max(w*(159/426)*.62,u*(rows>1?1.95:1.25));
  var cx=G.x0+G.gap*(G.n-1)/2+(rows>1?G.gap*.25:0),by=G.y+u*.55;
  if(MAT.complete&&MAT.naturalWidth)g.drawImage(MAT,cx-w/2,by-h,w,h);
  /* ざぶとん（ひとり1まいでは なく、シートに 2〜4まい） */
  var nc=Math.max(2,Math.min(4,Math.round(G.n*rows/2)));
  for(var i=0;i<nc;i++){
    var im=CUSH[i%CUSH.length];if(!im.complete||!im.naturalWidth)continue;
    var cw=u*1.35,ch=cw*(im.naturalHeight/im.naturalWidth);
    var rowI=rows>1&&i%2?1:0;
    var fx=cx+(nc===1?0:(i/(nc-1)-.5)*(w*.56))+(rowI?u*.4:0);
    var fy=G.y+u*.38-rowI*u*.9;
    g.drawImage(im,fx-cw/2,fy-ch*.55,cw,ch);
  }
}
/* 見まもる子の ならぶ場所。あそびが はじまったときに 一度だけ きめて、あとは 動かさない */
function gallery(n,u,near,fy){
  var A=P.area;if(!A)return null;
  var gap=u*1.55,w=gap*(n-1);
  if(w>S.W-u*3)return null;
  /* よーいどん・だるまさんがころんだ は 手前の帯を あけてあるので、そこを 特等席にする。
     手前が 案内の文字などで ふさがっている ときのために、うしろの席も 用意しておく
     （front＝あそび場に かかってもよい席） */
  var lane=P.sessions[0]&&(P.sessions[0].type==="race"||P.sessions[0].type==="daruma");
  /* 席は かならず あそび場より 手前（下がわ）に つくる。
     おくに つくると、あそび場が じゃまで ぐるっと まわっても たどりつけないことがある。
     手前に 場所が ないときは シートは なし（みんな その場で 見る） */
  var rows=lane?[[S.bottom-u*.35,1],[S.bottom-u*1.25,1]]
               :[[A.b+u*1.7,0],[S.bottom-u*1.25,1],[S.bottom-u*.35,1]];
  /* みんなで かこむ あそび（つなひきなど）では、見る子が いる がわを 先に さがす
     （あそび場の むこうがわに 席を つくると、まわりこめずに ゆれてしまう） */
  if(!lane&&fy!=null)rows=rows.slice().sort(function(p,q){return Math.abs(p[0]-fy)-Math.abs(q[0]-fy);});
  var lo=u*1.5+w/2,hi=S.W-u*1.5-w/2;
  var mid=clamp((A.l+A.r)/2,lo,hi);
  /* 草原の はしからはしまで さがす（まん中に 案内の文字が あっても 見つかるように） */
  var steps=Math.min(120,Math.ceil((hi-lo)/(u*.5))*2+2);
  for(var i=0;i<rows.length;i++){
    /* よーいどん・だるまさんがころんだ は、まず 手前の 特等席だけで さがす */
    if(near&&lane&&!rows[i][1])continue;
    var y=clamp(rows[i][0],S.top+u*.6,S.bottom-u*.15),front=rows[i][1];
    /* まん中から 左右に ずらしながら、ぜんいんが ならべる 場所を さがす */
    for(var step=0;step<=steps;step++){
      var cx=mid+(step?(step%2?1:-1)*Math.ceil(step/2)*u*.5:0);
      if(cx<lo||cx>hi)continue;
      var ok=true;
      for(var k=0;k<n&&ok;k++){
        var x=cx-w/2+gap*k;
        if(!S.clear(x,y,u)||(!front&&P.inArea(x,y,u,null)))ok=false;
      }
      if(ok)return {y:y,x0:cx-w/2,gap:gap,n:n};
    }
  }
  return null;
}
/* みんなで 見まもる（ブルーシートを しく）のは、この3つの あそびだけ。
   ほかの あそびの ときは、まわりの子は ふだんどおり すごす */
var WATCHABLE={daruma:1,race:1,tug:1};
function spectate(dt){
  var s=P.sessions.filter(function(x){return x.m.length>=4&&WATCHABLE[x.type];})[0];
  var fans=P.animals.filter(function(a){return !a.sess&&!a.leaving&&!a.helping&&!a.chat&&a.age>=1.1;});
  if(!s){
    P.animals.forEach(function(a){if(a.watch){a.watch=null;a.face=0;a.watchMove=false;a.galI=null;a.galSet=false;a.hold=false;a.galGave=false;a.seatT=0;a.seatAll=0;a.seatP=null;a.galSide=null;a.rest=rand(.6,2);}});
    return;
  }
  /* あそびが はじまった ときに すぐ、何人 見るかを きめて シートを しく。そのあとは 動かさない */
  if(fans.length&&!s.gal&&!s.noGal&&(s.galT||0)<P.now){
    var u0=fans.reduce(function(v,a){return Math.max(v,a.u);},P.U);
    var n0=Math.min(Math.max(fans.length,2),8),g=null;
    /* 手前の 特等席を 先に さがし、どうしても なければ うしろの席にする */
    var fy0=0;fans.forEach(function(a){fy0+=a.y;});fy0/=fans.length;
    for(var pass=1;pass>=0&&!g;pass--)
      for(var tryN=n0;tryN>=2&&!g;tryN--)g=gallery(tryN,u0,pass,fy0);
    if(g){
      s.gal=g;s.galN=g.n;s.matU=u0;s.seats=[];
      fans.slice().sort(function(p,q){return p.x-q.x;}).forEach(function(a,i){
        if(i<g.n*2){a.galI=i;s.seats.push(a);}   /* うしろの列にも ならぶ */
        else if(P.animals.length>=P.MAX){ /* こみあっているときだけ、そのまま 帰る */
          a.watch=null;a.watchMove=false;a.galSet=false;a.hold=false;a.rest=0;a.mult=1.3;
          a.leaving=true;a.tx=a.x<S.W/2?-a.u*3:S.W+a.u*3;a.ty=a.y;
        }else a.galI=null;   /* シートに 入れない子は その場で 見る */
      });
    }else s.galT=P.now+.25;
  }
  /* あとから 見にきた子（あそびから ぬけた子など）にも 席をわりあてる */
  if(s.gal&&s.seats){
    fans.forEach(function(a){
      if(a.galGave)return;
      if(a.galI!=null&&s.seats.indexOf(a)>=0)return;
      if(s.seats.length<s.gal.n*2){a.galI=s.seats.length;s.seats.push(a);}
      else if(!a.leaving&&P.animals.length>=P.MAX){
        a.watch=null;a.watchMove=false;a.galSet=false;a.hold=false;a.rest=0;a.mult=1.3;
        a.leaving=true;a.tx=a.x<S.W/2?-a.u*3:S.W+a.u*3;a.ty=a.y;}
      else a.galI=null;
    });
    s.galN=s.seats.length;
  }
  /* シートは、だれかが ちゃんと 席に たどりつけた ときだけ しく。
     だれも 行けない（とおい・あそび場が じゃま）ときは、そもそも 出さない */
  if(s.gal&&s.seats){
    var comingN=0,nearN=0;
    s.seats.forEach(function(a){
      if(a.galGave||a.galI==null||fans.indexOf(a)<0)return;
      var gi=clamp(a.galI,0,s.gal.n*2-1),col=gi%s.gal.n,row=Math.floor(gi/s.gal.n);
      var qx=s.gal.x0+s.gal.gap*col+(row?s.gal.gap*.5:0),qy=s.gal.y+a.u*.55-row*a.u*.9;
      comingN++;
      if(Math.hypot(a.x-qx,(a.y-qy)*1.3)<a.u*3)nearN++;
    });
    if(nearN)s.matOK=true;
    /* だれも 向かっていない（みんな あきらめた）ときは、シートを かたづけて さがしなおす */
    if(!comingN&&!s.matOK){
      s.gal=null;s.seats=null;s.galN=0;s.galT=P.now+2.5;
      s.galTries=(s.galTries||0)+1;
      /* なんど さがしても だれも 行けないときは、シートは なしにする（みんな その場で 見る） */
      if(s.galTries>=3)s.noGal=true;
      fans.forEach(function(a){a.galGave=false;a.galI=null;});
    }
  }
  if(s.gal&&s.matOK&&fans.length){
    if(!s.mat){
      s.mat={y:0,draw:function(g){drawMat(g,s);}};
      s.props=s.props||[];s.props.push(s.mat);P.props.push(s.mat);
    }
    s.mat.y=s.gal.y-(s.matU||P.U)*1;
  }
  var cx=0;s.m.forEach(function(m){cx+=m.x;});cx/=s.m.length;
  fans.forEach(function(a){
    a.watch=s;
    var G=(a.galI==null?null:s.gal);
    if(G){
      var gi=clamp(a.galI==null?0:a.galI,0,G.n*2-1),col=gi%G.n,row=Math.floor(gi/G.n);
      /* ざぶとんの 上に すわって 見えるよう、すこし 下に */
      var sx=G.x0+G.gap*col+(row?G.gap*.5:0),sy=G.y+a.u*.55-row*a.u*.9;
      var sd=Math.hypot(a.x-sx,(a.y-sy)*1.3);
      if(sd>a.u*.45){
        /* ちゃんと すすめているか 見ておく。ふさがれて 進めないまま だと
           その場で 小きざみに ゆれて 見えるので、あきらめて そこから 見る */
        if(!a.seatP||Math.hypot(a.x-a.seatP.x,a.y-a.seatP.y)>a.u*.5){a.seatP={x:a.x,y:a.y};a.seatT=0;}
        else a.seatT=(a.seatT||0)+dt;
        a.seatAll=(a.seatAll||0)+dt;
        /* 席が あそび場の 中に なってしまった（歩いて 入れない）／
           ずっと すすめない／いつまでも つけない ときは、あきらめて その場で 見る */
        /* 席が あそび場の まん中に なってしまったとき（歩いて 入れない）だけ あきらめる。
           手前の ふちは すわってよい */
        var A0=P.area,deep=A0&&sx>A0.l-a.u*.4&&sx<A0.r+a.u*.4&&sy>A0.t-a.u*.4&&sy<A0.b-a.u*.25;
        if(deep||a.seatT>2.5||a.seatAll>12){
          a.galI=null;a.galGave=true;a.seatT=0;a.seatAll=0;a.seatP=null;a.galSide=null;a.watchMove=false;a.galSet=false;
        }
        else{
          /* シートへ むかう とちゅうに ひとこと */
          if(!a.watchMove&&P.now-(a.watchSaid==null?-99:a.watchSaid)>12&&Math.random()<.6){
            a.watchSaid=P.now;P.say(a,pick(WATCH),1.4);
          }
          /* 席が あそび場の むこうがわ なら、あそび場の よこを まわって いく
             （まっすぐ 行こうとして 入れず、その場で ゆれてしまうのを ふせぐ） */
          var gx2=sx,gy2=sy,A=P.area;
          if(A){
            var padA=a.u*1.7,wl=A.l-padA,wr=A.r+padA;
            /* あそび場が よこいっぱいの ときは まわりこめないので、まっすぐ 行く */
            if(A.r-A.l>S.W*.72)a.galSide=null;
            else if(a.galSide==null){
              for(var q=1;q<8;q++){
                var qx=a.x+(sx-a.x)*q/8,qy=a.y+(sy-a.y)*q/8;
                if(P.inArea(qx,qy,a.u,null)){
                  a.galSide=(Math.abs(a.x-wl)+Math.abs(sx-wl)<Math.abs(a.x-wr)+Math.abs(sx-wr))?-1:1;break;
                }
              }
            }
            if(a.galSide!=null){
              /* あそび場の たてはばを 通りぬけるまでは、きめた がわを まわりつづける */
              var done=(sy<=A.t&&a.y<A.t-a.u*.2)||(sy>=A.b&&a.y>A.b+a.u*.2)||
                       (a.x<A.l-a.u*.6&&sx<A.l)||(a.x>A.r+a.u*.6&&sx>A.r);
              var wx=clamp(a.galSide<0?wl:wr,a.u,S.W-a.u);
              if(done)a.galSide=null;
              else if(Math.abs(a.x-wx)>a.u*.5){gx2=wx;gy2=a.y;}
              else{gx2=wx;gy2=sy;}
            }
          }
          a.watchMove=true;a.galSet=false;a.hold=false;go(a,gx2,gy2,1.75);return;
        }
      }
      if(a.galI!=null){
      /* すわったら うごかない（あしも 向きも そのまま）。することは おうえんの ことばだけ */
      a.seatT=0;a.seatAll=0;a.seatP=null;a.galSide=null;
      if(!a.galSet){a.galSet=true;a.face=cx>a.x?1:-1;a.dir=a.face;}
      a.hold=true;a.moving=false;a.tx=a.x;a.ty=a.y;a.rest=1;a.mult=1;a.z=0;a.vz=0;
      return;
      }
    }else if(a.keepOut){a.watchMove=true;a.galSet=false;return;}
    /* シートが まだ できていない あいだは、ふだんどおり 歩いていてよい
       （その場で きょろきょろ しない） */
    if(!s.gal){a.watchMove=true;a.galSet=false;a.hold=false;return;}
    /* 席が ないときは、その場に立って あそびの方を見る（うごかない） */
    a.watchMove=false;a.tx=a.x;a.ty=a.y;a.rest=Math.max(a.rest,.6);a.mult=1;a.hold=true;a.moving=false;
    if(!a.galSet){a.galSet=true;if(Math.abs(cx-a.x)>a.u*.5){a.face=cx>a.x?1:-1;a.dir=a.face;}}
  });
  s.cheerT=(s.cheerT==null?rand(4,6):s.cheerT)-dt;
  if(s.cheerT<=0){
    s.cheerT=rand(5,8);
    /* すわっている子は おうえん、むかっている子は 「かんせん！！」など */
    var seated=fans.filter(function(a){return !a.watchMove;}),walking=fans.filter(function(a){return a.watchMove;});
    if(walking.length&&Math.random()<.5)P.say(pick(walking),pick(WATCH),1.4);
    else if(seated.length&&CHEER[s.type])P.say(pick(seated),pick(CHEER[s.type]),1.3);
  }
}
/* 見まもっている子がタップされた */
X.onTapWatch=function(a){
  /* ボールをひろってあげている子 */
  if(a.helping&&P.sessions.indexOf(a.helping)>=0){tapLine(a,"helpBall",["ボール、とってあげるの","まかせて！"]);return true;}
  if(!a.watch||P.sessions.indexOf(a.watch)<0)return false;
  tapLine(a,"watch",["みんなを おうえん してるの","ここから みてるね","どっちが かつかな〜","つぎは いっしょに あそびたいな"]);
  /* すわって 見ている子は はねない（ざぶとんから うごかない） */
  if(!a.galSet)P.jump(a,3);
  return true;
};
X.schedule=function(dt){
  /* 「まっさらにする」で みんなが 帰るところは、あそびを はじめない */
  if(P.bye)return;
  spectate(dt);
  /* だれかが おしゃべりしている間は、新しい あそびを はじめない */
  if(AD.chat){AD.chat.tick(dt);if(AD.chat.holdPlay())return;}
  groupCool-=dt;bigCool-=dt;schedT-=dt;if(schedT>0)return;schedT=rand(1,2);
  /* あそびは いつも1つだけ（2ひきのあそびと みんなのあそびが 同時に起きない） */
  if(P.sessions.length||groupCool>0)return;
  /* みんなであそぶ あそびは、あそべる子が4ひき以上いるときだけ。
     まえは「ひと休み中(cool)の子」を数えていなかったので、2ひきのあそびが続くと 4ひきそろわず、ほとんど始まらなかった。
     みんなのあそびは ひと休み中の子も さそう。前のみんなのあそびから時間がたつほど 始まりやすくし、
     35秒たったら かならず始める。なるべく たくさんの子を入れる（見ている子が少なくなる） */
  var avail=P.animals.filter(function(a){return P.free(a);});
  if(X.GROUP&&avail.length>=4&&bigCool<=0){
    var many=P.animals.filter(function(a){return !a.leaving;}).length;
    /* 4ひきそろえば ほぼ始める。どうしても始まらないことがないよう、ひと休みのあと8秒たったら かならず */
    var chance=bigCool<-8?1:(many>=6?.95:.85);
    if(Math.random()<chance){
      var list=Object.keys(X.GROUP).map(function(k){return [k,X.GROUP[k].weight||1];});
      var type=weighted(list),g=X.GROUP[type],n=Math.min(avail.length,g.max||5);
      /* 横一列にならぶあそびは、ならべる本数までにする（ぎゅうぎゅうにならない） */
      /* 一列にならぶ あそびは、ならべる本数まで（大きい子がいるほど 少なくなる） */
      if(g.lanes&&X.laneRoom){
        var bigU=avail.slice(0,n).reduce(function(v,a){return Math.max(v,a.u);},P.U);
        n=Math.min(n,X.laneRoom(bigU,g.minK)*(g.ranks||1)+(g.ranks>1?1:0));
        /* スタート位置まで 間に合う子だけを さそう（とちゅうで 見るがわに ならないように） */
        var lead=avail[0],cx0=0;avail.forEach(function(a){cx0+=a.x;});cx0/=avail.length;
        var startX=type==="daruma"?(lead.x<S.W/2?S.W-bigU*1.4:bigU*1.4)
                                  :(cx0<S.W/2?bigU*1.3:S.W-bigU*1.3);
        var able=avail.filter(function(a){return a===lead||X.canReach(a,startX,13);});
        if(able.length>=4)avail=able;else return;
      }
      if(g.even)n-=n%2;
      /* ひと休みが終わっている子から先に入れる */
      avail.sort(function(p,q){return (p.cool>0?1:0)-(q.cool>0?1:0)||Math.random()-.5;});
      X.start(type,avail.slice(0,n));return;
    }
  }
  var free=avail.filter(function(a){return a.cool<=0;});
  if(free.length<2)return;
  /* ぎょうれつは 3〜4ひきで 出発して、歩きながら どんどん ふえていく */
  if(free.length>=3&&Math.random()<.24){X.start("parade",free.sort(function(){return Math.random()-.5;}).slice(0,Math.min(free.length,4)));return;}
  var a=pick(free),b=free.filter(function(o){return o!==a;}).sort(function(p,q){return AD.dist(a,p)-AD.dist(a,q);})[0];
  var near=free.filter(function(o){return o!==a;}).sort(function(p,q){return AD.dist(a,p)-AD.dist(a,q);});
  var hasEle=a.sp.key==="foot2"||b.sp.key==="foot2";
  var type=weighted([["tag",3],["ball",2.5],["hide",2.5],["dance",2],["mizu",hasEle?4:2]]);
  var mem=Math.random()<.5?[a,b]:[b,a];
  /* ボールあそび・ダンス・みずあびは、近くに ほかの子がいれば 3〜4ひきで */
  if(type==="ball"&&near.length>=2&&Math.random()<.65){mem.push(near[1]);if(near.length>=3&&Math.random()<.45)mem.push(near[2]);}
  if(type==="dance"&&near.length>=2&&Math.random()<.55){mem.push(near[1]);if(near.length>=3&&Math.random()<.4)mem.push(near[2]);}
  if(type==="mizu"&&near.length>=2&&Math.random()<.5){mem.push(near[1]);if(near.length>=3&&Math.random()<.3)mem.push(near[2]);}
  X.start(type,mem);
};
})();
