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
/* 多すぎるときは、古い子から なにも言わずに 出ていく */
P.trim=function(keep){
  var live=P.animals.filter(function(b){return !b.leaving&&b!==keep;});
  var extra=live.length+(keep?1:0)-P.MAX;
  for(var i=0;i<extra&&live.length;i++){
    /* 出ていくのは、同じ種類が何ひきもいる子から。同じなら、あそんでいない子・古い子から。
       そうすると 草原に のこるどうぶつの種類が ばらけていく */
    var count={};
    P.animals.forEach(function(b){if(!b.leaving)count[b.sp.key]=(count[b.sp.key]||0)+1;});
    live.sort(function(p,q){
      return (count[q.sp.key]||0)-(count[p.sp.key]||0)||(p.sess?1:0)-(q.sess?1:0)||q.age-p.age;
    });
    var old=live.shift();
    if(old.sess)AD.acts.end(old.sess);
    old.leaving=true;old.tx=old.x<S.W/2?-old.u*3:S.W+old.u*3;old.ty=old.y;old.mult=1.3;
    P.bubbles=P.bubbles.filter(function(b){return b.a!==old;});
  }
};
/* ほかのどうぶつから一番はなれた場所をえらぶ */
P.roomySpot=function(a){
  /* こみあっていると点数がぜんぶマイナスになるので、はじめは とても小さい値にしておく（null をかえさない） */
  var best=null,bd=-1e9,any=null,ad2=-1e9;
  for(var i=0;i<10;i++){
    var p=S.safeSpot(a.u)||S.randomSpot(a.u),m=1e9;
    P.animals.forEach(function(b){if(b!==a)m=Math.min(m,Math.hypot(b.x-p.x,(b.y-p.y)*1.6));});
    m-=Math.hypot(p.x-a.x,p.y-a.y)*.25;
    if(m>ad2){ad2=m;any=p;}
    if(P.inArea(p.x,p.y,a.u,a.sess))continue;   /* あそび場の中は えらばない */
    if(m>bd){bd=m;best=p;}
  }
  /* ぜんぶ あそび場の中だったときは、いちばんよかった場所をつかう（null をかえさない） */
  return best||any||S.randomSpot(a.u);
};
var TOP={foot1:2.6,hand0:2.6,hand3:2.2,hand5:2.2,foot5:2.2};

/* いまいる場所とは ちがう ところを えらぶ（おなじ場所を えらび続けて 止まらないように） */
P.farSpot=function(a){
  var p=P.roomySpot(a);
  for(var i=0;i<8&&Math.hypot(p.x-a.x,p.y-a.y)<a.u*2.5;i++)p=S.randomSpot(a.u)||p;
  return p;
};
P.later=function(sec,fn){P.queue.push({t:P.now+sec,fn:fn});};
P.say=function(a,text,dur){
  if(!a||!text)return;
  /* おなじ ことばが いま ほかの子の ふきだしに 出ているときは、かさねて 出さない
     （おなじ セリフの ふきだしが 2つ ならんで 見えないように）。口だけ うごかす */
  var dup=P.bubbles.some(function(b){return b.a!==a&&b.text===text&&P.now-b.born<Math.min(b.dur,1.8);});
  if(dup){a.talk=.45;return;}
  var same=P.bubbles.some(function(b){return b.a===a&&b.text===text;});
  P.bubbles=P.bubbles.filter(function(b){return b.a!==a;});
  P.bubbles.push({a:a,text:text,born:P.now,dur:dur||1.6,keep:same});
  a.talk=.45;
};
P.note=function(x,y,text,col){P.notes.push({x:x,y:y,text:text,born:P.now,dur:1.3,col:col||AD.INK});};
P.headY=function(a){return a.y-a.z-a.u*(a.sp.top||TOP[a.sp.key]||(a.sp.kind==="hand"?1.95:2.15));};
P.jump=function(a,k){if(a.z===0&&a.vz===0)a.vz=a.u*(k||4);};
/* うまれてすぐ（3秒）は、あそびにさそわない（「〇〇だよ！」の名のりを さいごまで見せる） */
P.free=function(a){return !a.sess&&!a.leaving&&!a.helping&&!a.chat&&a.age>3.2;};

P.spawn=function(sp,x,y,mode,grow){
  var a={sp:sp,x:x,y:clamp(y,S.top,S.bottom),z:0,vz:0,dir:Math.random()<.5?1:-1,ph:0,moving:false,land:0,
    age:mode==="quiet"?3:0,deco:mode==="quiet"?1:0,mode:mode,grow:grow||1,seed:Math.random()*10,
    rest:rand(.6,2),tx:x,ty:y,mult:1,sess:null,sleep:false,blink:0,blinkT:rand(1.5,5),talk:0,nod:0,
    leaving:false,alpha:1,cool:mode==="quiet"?rand(1,3):2.2,u:0,shake:0,face:0,hold:false,said:mode==="quiet",sparked:mode==="quiet"};
  a.u=P.unit(a);a.scatter=1.8;
  P.animals.push(a);
  P.trim(a);
  return a;
};
P.unit=function(a){return P.U*(a.sp.kind==="hand"?1:.92)*a.grow*S.depth(a.y);};
/* あそび道具（つな・ゴールの線など）。{y:ならべる順, draw(g)} */
P.props=[];
P.clearAll=function(){P.animals=[];P.sessions=[];P.bubbles=[];P.notes=[];P.balls=[];P.sparks=[];P.queue=[];P.props=[];};

/* ---- あそんでいる場所（ほかの子は近づかない・あいだを横切らない）----
   あそびは同時に1つなので、そのあそびのメンバー（とボール）をかこむ四角を「あそび場」とする */
P.area=null;
P.updateArea=function(){
  var s=P.sessions[0];
  if(!s||s.m.length<2){P.area=null;return;}
  var l=1e9,r=-1e9,t=1e9,b=-1e9,u=0;
  s.m.forEach(function(a){
    u=Math.max(u,a.u);
    var x=a.tx!=null&&!a.hold?(a.tx+a.x)/2:a.x,y=a.ty!=null&&!a.hold?(a.ty+a.y)/2:a.y;
    l=Math.min(l,a.x,x);r=Math.max(r,a.x,x);t=Math.min(t,a.y,y);b=Math.max(b,a.y,y);
  });
  if(s.ball){l=Math.min(l,s.ball.x);r=Math.max(r,s.ball.x);t=Math.min(t,s.ball.y);b=Math.max(b,s.ball.y);}
  P.area={l:l-u*.7,r:r+u*.7,t:t-u*1.1,b:b+u*.35,sess:s};
};
/* その場所（どうぶつの大きさぶんの余裕こみ）が あそび場にかかるか */
P.inArea=function(x,y,u,sess){
  var A=P.area;if(!A||(sess&&sess===A.sess))return false;
  var pad=u*1.2;
  return x>A.l-pad&&x<A.r+pad&&y>A.t-pad&&y<A.b+pad*.7;
};
/* あそび場の中にいる子を、いちばん近い外がわへ */
function stepOut(a){
  var A=P.area,pad=a.u*1.6;
  var outs=[{x:A.l-pad,y:a.y},{x:A.r+pad,y:a.y},{x:a.x,y:A.t-pad},{x:a.x,y:A.b+pad*.8}];
  var best=null,bd=1e9;
  outs.forEach(function(q){
    q.x=clamp(q.x,a.u,S.W-a.u);q.y=clamp(q.y,S.top,S.bottom);
    if(P.inArea(q.x,q.y,a.u,a.sess))return;
    var d=Math.hypot(q.x-a.x,(q.y-a.y)*1.4);if(d<bd){bd=d;best=q;}
  });
  return best||P.roomySpot(a);
}
/* ---- かさなりの きまり ----
   ・よこ（おなじ おくゆき）で 体の6わり いじょう かさなるのは だめ
   ・手前と おくの かさなりは よい。ただし うしろの子の 顔が かくれるのは だめ
   どれくらい やぶっているかを かえす（0いか なら だいじょうぶ） */
function headAt(a,y){return y-a.u*(a.sp.top||TOP[a.sp.key]||(a.sp.kind==="hand"?1.95:2.15));}
function stackBad(a,ax,ay,b){
  if(b===a||b.hidden||b.leaving||a.hidden||a.leaving)return -1;
  if((a.scatter||0)>0||(b.scatter||0)>0)return -1;
  /* おなじ あそびの なかまどうしは、おし合わずに すりぬける
     （正面衝突で 身動きが とれなくなるより、通りぬけたほうが よい） */
  if(a.sess&&a.sess===b.sess)return -1;
  var dx=Math.abs(ax-b.x),dy=Math.abs(ay-b.y),near=(a.u+b.u)*.38;
  if(dy<=near)return ((a.u+b.u)-1.2*Math.min(a.u,b.u))-dx;
  var backIsA=ay<b.y,bu=backIsA?a.u:b.u;
  var hb=backIsA?headAt(a,ay):headAt(b,b.y),hf=backIsA?headAt(b,b.y):headAt(a,ay);
  if(hb+bu*.62<=hf)return -1;               /* うしろの子の 顔が 見えている */
  return (a.u+b.u)*.5-dx;
}
/* まっこうから ぶつかりに いっているか（そのときは すりぬける） */
function headOn(a,b){
  var ax=a.tx-a.x,ay=a.ty-a.y,al=Math.hypot(ax,ay);
  var bx=b.tx-b.x,by=b.ty-b.y,bl=Math.hypot(bx,by);
  if(al<2||bl<2)return false;
  return (ax*bx+ay*by)/(al*bl)<-.45;
}
/* その場所へ 動いたら かさなってしまうか（いま より わるくなるときだけ とめる） */
function blockedAt(a,x,y){
  var L=P.animals,worst=null,wv=0;
  for(var i=0;i<L.length;i++){
    var b=L[i];
    /* あそんでいる子は、あそんでいない子に 道を ふさがれない（外の子が よける） */
    if(a.sess&&!b.sess)continue;
    /* 正面から ぶつかる ときは、おし合わずに すりぬける */
    if(headOn(a,b))continue;
    var nv=stackBad(a,x,y,b);
    if(nv<=0)continue;
    var cv=stackBad(a,a.x,a.y,b);
    if(nv<=cv+.01)continue;                 /* もう かさなっている ぶんには 動ける */
    if(nv>wv){wv=nv;worst=b;}
  }
  return worst;
}
/* 池の上は 歩かない（入ってしまっているときは 出られるように、入る一歩だけ とめる）
   ※ S.inPond は まわりの あきも 入るので、ここでは 水そのものの かたちを つかう */
function inWater(x,y,k){
  var p=S.pond;if(!p)return false;k=k||1;
  return Math.pow((x-p.x)/(p.rx*k),2)+Math.pow((y-p.y)/(p.ry*k),2)<1;
}
P.inWater=inWater;
/* ふだんの おさんぽでは 水の上を 歩かない。
   あそんでいる さいちゅうは、どうしても 通るときは 通る（そのかわり ぱしゃぱしゃ する） */
function pondBlock(a,x,y){return !a.sess&&inWater(x,y,1.04)&&!inWater(a.x,a.y,1.04);}
function canStep(a,x,y){return !blockedAt(a,x,y)&&!pondBlock(a,x,y);}
/* 前にほかの子がいたら、横によけながら進む（同じあそびの なかまどうしは よけない） */
function avoid(a,ux,uy){
  var sx=0,sy=0;
  if(a.hidden)return {x:ux,y:uy};
  P.animals.forEach(function(b){
    if(b===a||b.leaving||b.hidden)return;
    var team=a.sess&&a.sess===b.sess;
    var ex=b.x-a.x,ey=(b.y-a.y)*1.6,dist=Math.hypot(ex,ey),R=(a.u+b.u)*(team?.8:1.05);
    if(dist>R||dist<.01)return;
    var ahead=(ex*ux+ey*uy)/dist;if(ahead<.05)return;
    var side=(ux*ey-uy*ex)>0?-1:1,w=(1-dist/R)*ahead*(team?.7:1.8);
    sx+=-uy*side*w-ex/dist*w*.35;sy+=ux*side*w-ey/dist*w*.35;
  });
  /* あそび場の手前では、中に入らないよう まわりこむ */
  var A=P.area;
  if(A&&!a.sess&&!a.helping){
    var pad=a.u*1.3,ax=(A.l+A.r)/2,ay=(A.t+A.b)/2,hw=(A.r-A.l)/2+pad,hh=(A.b-A.t)/2+pad;
    var ex2=ax-a.x,ey2=ay-a.y,near=Math.abs(ex2)<hw+a.u*1.6&&Math.abs(ey2)<hh+a.u*1.6;
    if(near){
      var dist2=Math.hypot(ex2,ey2)||1,ahead2=(ex2*ux+ey2*uy)/dist2;
      if(ahead2>0){
        var side2=(ux*ey2-uy*ex2)>0?-1:1,w2=ahead2*1.6;
        sx+=-uy*side2*w2-ex2/dist2*w2*.8;sy+=ux*side2*w2-ey2/dist2*w2*.8;
      }
    }
  }
  var nx=ux+sx,ny=uy+sy,n=Math.hypot(nx,ny)||1;
  return {x:nx/n,y:ny/n};
}
/* ---- しげみに かくれてしまわないように ----
   しげみは どうぶつより手前に描かれるので、しげみの絵の中に入ると 体が見えなくなる。
   かくれんぼ以外では、見えなくなる場所から すこしずつ ずれていく */
P.bushHidden=function(a){
  if(a.hidden)return null;
  for(var i=0;i<S.bushes.length;i++){
    var b=S.bushes[i],hw=b.img.w*.5-a.u*.2;
    if(Math.abs(a.x-b.x)>hw)continue;
    if(a.y>b.y-2||a.y<b.y-b.img.h)continue;
    return b;
  }
  return null;
};
/* その場所が しげみにかくれるなら、しげみの手前（すぐ下）へずらした場所をかえす */
P.unhidePoint=function(x,y,u){
  for(var i=0;i<S.bushes.length;i++){
    var b=S.bushes[i];
    if(Math.abs(x-b.x)>b.img.w*.5+u*.2)continue;
    if(y>b.y+2||y<b.y-b.img.h)continue;
    return {x:x,y:clamp(b.y+u*.35,S.top,S.bottom)};
  }
  return {x:x,y:y};
};
function bushStepOut(a,dt){
  /* あそんでいる子は しげみより手前に えがかれるので、おし出さなくてよい。
     おし出すと よーいどんの コースから はずれて 止まってしまう */
  if(a.sess)return;
  var b=P.bushHidden(a);if(!b)return;
  var hw=b.img.w*.5+a.u*.25,dx=a.x-b.x;
  var left=-hw-dx,right=hw-dx,down=(b.y+4)-a.y;
  var mv=Math.abs(left)<Math.abs(right)?left:right;
  var useDown=Math.abs(down)<Math.abs(mv)*1.2;
  var sp=a.u*2.2*dt;
  if(useDown)a.y+=Math.min(down,sp);
  else a.x+=mv>0?Math.min(mv,sp):Math.max(mv,-sp);
  a.y=clamp(a.y,S.top,S.bottom);a.x=clamp(a.x,a.u*.8,S.W-a.u*.8);
}
function stepAnimal(a,dt){
  a.age+=dt;a.cool-=dt;a.talk=Math.max(0,a.talk-dt);
  /* ぶつかったままの子は、少しはなれた場所へ移る */
  a.bump=Math.max(0,(a.bump||0)-dt*.6);
  a.scatter=Math.max(0,(a.scatter||0)-dt);
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
  if(!a.sess&&!a.leaving&&!a.helping){
    /* あそんでいる場所には入らない。中にいたら すぐ外へ出る。行き先が中なら えらびなおす */
    /* 見ている子が ならんでいる ところは そのままにする */
    if(a.galSet)a.keepOut=false;
    else if(P.area&&P.inArea(a.x,a.y,a.u,a.sess)){
      /* みんなであそぶときは あそび場が とても広くなることがある。
         いつまでも 外へ出られないと ずっと歩きつづけてしまうので、しばらくしたら あきらめて その場で見る */
      if(a.outGave>0)a.outGave-=dt;
      else if(!a.keepOut){a.keepOut=true;a.outT=0;var e=stepOut(a);a.tx=e.x;a.ty=e.y;a.rest=0;a.mult=1.25;}
      else{
        a.outT=(a.outT||0)+dt;
        if(a.outT>3.5){a.keepOut=false;a.mult=1;a.outGave=7;a.tx=a.x;a.ty=a.y;a.rest=rand(1,2);}
      }
    }else{
      if(a.keepOut){a.keepOut=false;a.mult=1;a.rest=rand(.3,1.2);}
      a.outT=0;a.outGave=0;
      if(P.inArea(a.tx,a.ty,a.u,a.sess)){var q=P.roomySpot(a);a.tx=q.x;a.ty=q.y;}
    }
    if(a.rest>0)a.rest-=dt;
    else if(Math.hypot(a.tx-a.x,a.ty-a.y)<a.u*.3){a.rest=rand(1.6,4);var p=P.farSpot(a);a.tx=p.x;a.ty=p.y;}
    /* 池のまえで 立ち往生したら、べつの場所へ */
    if(a.stuckT>.8){a.stuckT=0;var q2=P.roomySpot(a);a.tx=q2.x;a.ty=q2.y;a.rest=0;}
  }
  /* 池の中に いるときは、あそび中でも いちばん近い きしへ 上がる。
     みんな おなじ場所を めざすと つまるので、すこしずつ ずらす */
  if(!a.leaving&&!a.sess&&inWater(a.x,a.y,1.04)){
    if(!a.bank||(a.bankT||0)<P.now){
      var bk=S.pondSpot(a.x),out2=bk.x>S.pond.x?1:-1;
      a.bank={x:clamp(bk.x+out2*a.u*(.8+Math.random()*.8),a.u,S.W-a.u),y:clamp(bk.y+rand(-1.1,1.1)*a.u,S.top,S.bottom)};
      a.bankT=P.now+2.2;
    }
    a.tx=a.bank.x;a.ty=a.bank.y;a.hold=false;a.rest=0;a.sleep=false;
  }else a.bank=null;
  /* 水ぎわで つまったら、池の うえか したを まわって 行く */
  if(a.detourT>0){
    a.detourT-=dt;a.tx=a.detour.x;a.ty=a.detour.y;a.rest=0;a.hold=false;
    if(Math.hypot(a.tx-a.x,a.ty-a.y)<a.u*.4)a.detourT=0;
  }else if(!a.sess&&P.now-(a.pondHit==null?-99:a.pondHit)<.25){
    var pw=S.pond;
    if(pw){
      var upSide=Math.abs(a.y-(pw.y-pw.ry*2-a.u*.7))<Math.abs(a.y-(pw.y+pw.ry*2+a.u*.7));
      var oy=upSide?-(pw.ry*2+a.u*.7):(pw.ry*2+a.u*.7);
      a.detour={x:clamp(a.x+(a.tx>a.x?1:-1)*a.u*1.8,a.u*1.3,S.W-a.u*1.3),
                y:clamp(pw.y+oy,S.top+a.u*.5,S.bottom-a.u*.3)};
      a.detourT=2.4;a.rest=0;a.pondHit=null;
    }
  }
  /* はしっこで 外へ 行こうとして つまらないように。
     むきを かえるか、そのまま 出ていく */
  var edge=a.x<=a.u*.9?-1:(a.x>=S.W-a.u*.9?1:0);
  if(edge&&(a.tx-a.x)*edge>0&&!a.leaving)a.edgeT=(a.edgeT||0)+dt;else a.edgeT=0;
  if(a.edgeT>.6){
    a.edgeT=0;
    if(a.sess||a.chat||a.watch||a.helping)a.tx=clamp(a.tx,a.u*1.5,S.W-a.u*1.5);
    else if(P.animals.length>6&&Math.random()<.12){
      a.leaving=true;a.hold=false;a.rest=0;a.mult=1.3;a.tx=edge>0?S.W+a.u*3:-a.u*3;a.ty=a.y;
    }else{var qe=P.farSpot(a);a.tx=qe.x;a.ty=qe.y;a.rest=0;}
  }
  /* それでも はしっこに 居つづけるときは、まん中のほうへ 行き先を かえる */
  if(edge&&!a.leaving&&!a.sess&&!a.chat&&!a.watch&&!a.helping){
    a.edgeS=(a.edgeS||0)+dt;
    if(a.edgeS>2.5){
      a.edgeS=0;a.rest=0;a.hold=false;
      a.tx=clamp(S.W*(a.x<S.W/2?.42:.58)+rand(-1,1)*S.W*.12,a.u*1.5,S.W-a.u*1.5);
      a.ty=clamp(a.y+rand(-1,1)*a.u*2,S.top+a.u*.6,S.bottom-a.u*.4);
    }
  }else a.edgeS=0;
  /* うえ・したの はしも おなじ */
  var edgeY=a.y<=S.top+a.u*.2?-1:(a.y>=S.bottom-a.u*.1?1:0);
  if(edgeY&&(a.ty-a.y)*edgeY>0&&!a.leaving&&!a.sess){a.ty=clamp(a.ty,S.top+a.u*.6,S.bottom-a.u*.4);}
  var dx=a.tx-a.x,dy=a.ty-a.y,d=Math.hypot(dx,dy);
  if(a.bumpStun>0){a.bumpStun-=dt;a.shake=a.bumpStun>0?Math.sin(P.now*26)*a.u*.05:0;}
  var wants=d>a.u*.25&&(a.rest<=0||a.sess||a.leaving)&&!a.hold&&!a.sleep&&!(a.bumpStun>0);
  var m=a.sp.motion,base=a.u*(m==="hop"?2.0:m==="waddle"?1.25:1.55);
  /* かけっこの あそびでは どうぶつによる はやさの ちがいを なくし、
     その回の「ちから」だけで きまるようにする */
  if(a.even)base=a.u*1.55*a.even;
  var speed=base*a.mult*(P.reduced?.6:1);
  /* 本気モード／水の中は おそくなる */
  if(a.burst>0){a.burst-=dt;speed*=1.3;}
  /* 「本気！」と 言ったときの、一瞬だけ ほんとうに はやくなる ダッシュ */
  if(a.dash>0){a.dash-=dt;speed*=1.8;}
  if(inWater(a.x,a.y,1))speed*=.55;
  a.moving=wants;
  /* 向きは、はっきり左右に動いたときだけ、少し間をあけて変える（ぶるぶる向きが変わらないように） */
  function move(){
    var v=avoid(a,dx/d,dy/d),s=Math.min(d,speed*dt),nd=v.x>0?1:-1;
    var nx=a.x+v.x*s,ny=a.y+v.y*s,hit=canStep(a,nx,ny)?null:(blockedAt(a,nx,ny)||"pond");
    if(hit){
      /* おしのけるのではなく、かさなる ほうへ（また 池の上へ）は そもそも 進まない。
         たてだけ・よこだけ なら 進めるときは すべるように よける */
      if(canStep(a,a.x,ny)){nx=a.x;}
      else if(canStep(a,nx,a.y)){ny=a.y;}
      else{
        nx=a.x;ny=a.y;a.stuckT=(a.stuckT||0)+dt;
        if(hit==="pond")a.pondHit=P.now;
        /* まっこうから ぶつかる ときは、たまに こける */
        var hv=hit==="pond"?1:(Math.hypot(hit.tx-hit.x,hit.ty-hit.y)||1);
        var hd=hit==="pond"?0:(v.x*(hit.tx-hit.x)+v.y*(hit.ty-hit.y))/hv;
        if(hit!=="pond"&&hd<-.5&&a.moving&&hit.moving&&!a.hold&&!hit.hold&&
           P.now-(a.bumpT||-9)>8&&P.now-(hit.bumpT||-9)>8&&Math.random()<dt*.8)stumble(a,hit);
      }
    }
    if(nx!==a.x||ny!==a.y)a.stuckT=0;
    a.x=nx;a.y=ny;
    /* もし 池の中に いるときは ぱしゃぱしゃ する */
    if(inWater(a.x,a.y,1)&&a.z<=0){
      a.wet=Math.max(a.wet||0,.4);
      a.splashT=(a.splashT||0)-dt;
      if(a.splashT<=0){
        a.splashT=rand(.45,.8);
        P.note(a.x,a.y-a.u*.25,"ぱしゃ","#4A92C6");
        for(var sp2=0;sp2<7;sp2++)P.sparks.push({x:a.x,y:a.y,a:-PI*(.15+.7*sp2/6),born:P.now,col:2,u:a.u*.8});
      }
      /* 入ったときに ひとこと（おなじ子は しばらく 言わない） */
      if(!a.inWet){a.inWet=true;
        if(P.now-(a.wetT==null?-99:a.wetT)>7){a.wetT=P.now;P.say(a,AD.pick(["みずに 入っちゃった〜","つめたーい！","ばしゃばしゃ！"]),1.4);}
      }
    }else a.inWet=false;
    /* つなひきのように、うしろに下がっても向きを変えない */
    if(a.faceLock){a.dir=a.face||a.dir;return;}
    /* 向きは ならした よこの うごきで きめる。
       ちいさく ゆれるたびに 右・左 と ぱたぱた しないように */
    a.vxs=(a.vxs||0)*.88+v.x*.12;
    if((a.vxs>0?1:-1)!==a.dir&&Math.abs(a.vxs)>.34&&P.now-(a.dirT||-9)>.8){a.dir=a.vxs>0?1:-1;a.dirT=P.now;}}
  if(m==="hop"){
    /* 進めないとき（前に だれかいる・水ぎわ など）は、その場で ぴょんぴょん しない。
       ただし ずっと とまったままに ならないよう、すこしずつ わすれて また ためす */
    if(wants&&a.z===0&&a.vz===0&&a.land===0){
      if((a.stuckT||0)>.2)a.stuckT=Math.max(0,a.stuckT-dt*.8);
      else a.vz=a.u*(a.mult>1.2?4:3.4);
    }
    if(!(a.z>0||a.vz>0))a.moving=false;      /* 地面にいるときは 止まって見える */
    if((a.z>0||a.vz>0)&&d>1)move();
  }else if(wants){
    /* じっさいに 進んだときだけ あしを うごかす（その場で 足ぶみ しない） */
    var px0=a.x,py0=a.y;
    move();
    var moved0=Math.hypot(a.x-px0,a.y-py0);
    if(moved0>a.u*.004)a.ph+=dt*(m==="waddle"?5:Math.min(speed/a.u,2.4)*2.6);
    else a.moving=false;
  }
  if(!wants&&a.face&&a.face!==a.dir&&P.now-(a.dirT||-9)>.6){a.dir=a.face;a.dirT=P.now;}
  if(a.knock){a.x+=a.knock*dt;a.knock*=Math.pow(.02,dt);if(Math.abs(a.knock)<2)a.knock=0;}
  if(a.z>0||a.vz>0){a.vz-=a.u*15*dt;a.z+=a.vz*dt;if(a.z<=0){a.z=0;a.vz=0;a.land=1;}}
  /* 見まもり：ずっと 止まったままなら、行き先を 変えて やりなおす
     （あそび中・おしゃべり中・見まもり中・かくれんぼで かくれている子は のぞく） */
  if(Math.hypot(a.x-(a.frzX==null?a.x-99:a.frzX),a.y-(a.frzY==null?a.y:a.frzY))<a.u*.05){
    a.frozT=(a.frozT||0)+dt;
    var busyNow=a.sess||a.chat||a.watch||a.helping||a.hidden||a.leaving;
    if(a.frozT>(a.moving?3:6)&&!busyNow){
      a.frozT=0;a.stuckT=0;a.rest=0;a.z=0;a.vz=0;a.land=0;a.hold=false;
      var qz=P.farSpot(a);a.tx=qz.x;a.ty=qz.y;
    }else if(a.frozT>12&&busyNow&&!a.sess&&!a.hidden&&!a.galSet){
      /* 見まもりなどで ながく 止まっていたら、いちど ときはなつ */
      a.frozT=0;a.watch=null;a.watchMove=false;a.galSet=false;a.helping=null;a.hold=false;a.rest=rand(.2,.8);
    }
  }else{a.frozT=0;a.frzX=a.x;a.frzY=a.y;}
  if(!a.leaving){a.x=clamp(a.x,a.u*.8,S.W-a.u*.8);a.y=clamp(a.y,S.top,S.bottom);bushStepOut(a,dt);}
  else a.alpha=clamp(Math.min(a.x+a.u*2,S.W+a.u*2-a.x)/(a.u*2),0,1);
}

/* ---- かさなりすぎを なくす ----
   ・よこ（おなじ おくゆき）で 体の6わり いじょう かさなるのは だめ
   ・手前と おくの かさなりは よいが、うしろの子の 顔まで かくれるのは だめ
   ・うまれたては のぞく（すぐ 散らばる）
   ときどき ぶつかって こける */
function stumble(a,b){
  a.bumpT=b.bumpT=P.now;
  [a,b].forEach(function(z){
    var o=z===a?b:a,s=z.x-o.x>=0?1:-1;
    z.knock=s*z.u*3.4;z.bumpStun=.75;P.jump(z,1.5);
  });
  P.note((a.x+b.x)/2,Math.min(P.headY(a),P.headY(b))-4,"ドン！",AD.INK);
  P.say(a,AD.pick(["わっ！","おっとっと〜","いたた…"]),1.2);
  P.later(.55,function(){if(P.animals.indexOf(b)>=0)P.say(b,AD.pick(["ごめん〜","びっくりした〜","だいじょうぶ？"]),1.2);});
}
function unstack(a,b,dt){
  if(a.hidden||b.hidden||a.leaving||b.leaving)return;
  if(a.sess&&a.sess===b.sess)return;          /* なかまどうしは すりぬける */
  if(headOn(a,b)){
    /* 正面から ぶつかる ときは すりぬける。ごくまれに こける */
    if(a.moving&&b.moving&&!a.sess&&!b.sess&&!a.chat&&!b.chat&&
       Math.hypot(a.x-b.x,(a.y-b.y)*1.5)<(a.u+b.u)*.5&&
       P.now-(a.bumpT||-9)>10&&P.now-(b.bumpT||-9)>10&&Math.random()<dt*.5)stumble(a,b);
    return;
  }
  if((a.scatter||0)>0||(b.scatter||0)>0)return;
  var dx=a.x-b.x,ax=Math.abs(dx),dy=Math.abs(a.y-b.y),near=(a.u+b.u)*.38,need;
  if(dy<=near)need=(a.u+b.u)-1.2*Math.min(a.u,b.u);          /* よこならび */
  else{
    var back=a.y<b.y?a:b,front=back===a?b:a;
    if(P.headY(back)+back.u*.62<=P.headY(front))return;       /* うしろの子の 顔が 見えている */
    need=(a.u+b.u)*.5;
  }
  if(ax>=need)return;
  var s=dx>=0?1:-1;if(!dx)s=Math.random()<.5?1:-1;
  /* あそんでいる子より、外の子のほうが よける */
  var wa=a.sess&&!b.sess?0:(!a.sess&&b.sess?2:1),wb=2-wa;
  var move=Math.min(need-ax,Math.max(a.u,b.u)*9*dt);
  var axn=a.x+s*move*.5*wa,bxn=b.x-s*move*.5*wb;
  if(!pondBlock(a,axn,a.y))a.x=axn;
  if(!pondBlock(b,bxn,b.y))b.x=bxn;

}

P.update=function(dt){
  P.now+=dt;
  P.updateArea();
  for(var q=P.queue.length-1;q>=0;q--)if(P.queue[q].t<=P.now){var job=P.queue.splice(q,1)[0];job.fn();}
  AD.acts.schedule(dt);
  P.sessions.slice().forEach(function(s){AD.acts.tick(s,dt);});
  P.animals.forEach(function(a){stepAnimal(a,dt);});
  var L=P.animals;
  for(var i=0;i<L.length;i++)for(var j=i+1;j<L.length;j++){
    var a=L[i],b=L[j];
    if(a.leaving||b.leaving||a.hidden||b.hidden)continue;
    unstack(a,b,dt);
    if(a.sess&&a.sess===b.sess)continue;
    var dx=a.x-b.x,dy=(a.y-b.y)*2,d=Math.hypot(dx,dy),min=(a.u+b.u)*.8;
    /* ぴったり同じ場所（同時にうまれたときなど）は、むきを決められないので すこしずらす */
    if(d<.01){var an=Math.random()*TAU;dx=Math.cos(an)*.5;dy=Math.sin(an)*.5;d=.5;}
    if(d<min&&d>.01){
      /* うまれたばかりで重なっているときは、はやく はなれる */
      var fast=(a.scatter>0||b.scatter>0)?3.2:1;
      var k=(min-d)/d*.5*Math.min(1,dt*5*fast);
      /* あそんでいる子は おされない（ゴールの線から 下がるなど、あそびが くずれるので）。外の子が よける */
      var wa=a.sess&&!b.sess?0:(!a.sess&&b.sess?2:1),wb=2-wa;
      a.x+=dx*k*wa;b.x-=dx*k*wb;a.y+=dy*k*.2*wa;b.y-=dy*k*.2*wb;
      a.bump=(a.bump||0)+dt*1.6*fast;a.bumpBy=b;b.bump=(b.bump||0)+dt*1.6*fast;b.bumpBy=a;
      if(fast>1)[a,b].forEach(function(z){
        if(z.sess||z.leaving||z.helping||z.age<1.1||P.now-(z.scatterT||-9)<1.5)return;
        z.scatterT=P.now;z.rest=0;var q=P.roomySpot(z);z.tx=q.x;z.ty=q.y;
      });
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
