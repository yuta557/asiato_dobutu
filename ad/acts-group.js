/* みんなであそぶ あそび（あそべる子が4ひき以上いるときだけ）
   だるまさんがころんだ・よーいどん・つなひき */
(function(){
"use strict";
var AD=window.AD,S=AD.scene,P=AD.play,X=AD.acts,H=X.h,ACT=X.ACT,PI=Math.PI,clamp=AD.clamp,rand=AD.rand,pick=AD.pick;
var go=H.go,arrived=H.arrived,faceTo=H.faceTo,next=H.next,once=H.once,alive=H.alive,tapLine=H.tapLine,goodbye=H.goodbye,fx=H.fx;

function maxU(m){return m.reduce(function(v,a){return Math.max(v,a.u);},0);}
function allThere(s,list,limit){return (list||s.m).every(arrived)||s.tt>(limit||6);}
/* ひとりずつの「じゃま」の間あけ */
function afx(a,cool){if(P.now-(a.gfxT==null?-99:a.gfxT)>cool){a.gfxT=P.now;return true;}return false;}
function addProp(s,pr){s.props=s.props||[];s.props.push(pr);P.props.push(pr);}
/* 横いっぱいに走る・ならぶための高さを n こ えらぶ（池と案内の文字をさける） */
function lanes(n,x0,x1,u){
  var top=S.top+u*.3,bot=S.bottom-u*.2,c=[];
  for(var i=0;i<=28;i++){var y=top+(bot-top)*i/28;if(S.laneOK(y,x0,x1,u))c.push(y);}
  if(c.length<n){var e=[];for(var j=0;j<n;j++)e.push(top+(bot-top)*(n===1?.5:j/(n-1)));return e;}
  for(var gap=u*1.25;gap>u*.4;gap*=.85){
    var picked=[c[0]];
    for(var k=1;k<c.length&&picked.length<n;k++)if(c[k]-picked[picked.length-1]>=gap)picked.push(c[k]);
    if(picked.length>=n){
      /* 上にかたよらないよう、えらんだ高さを 使える範囲のまんなかへ寄せる */
      var span=picked[n-1]-picked[0],room=(c[c.length-1]-c[0])-span,shift=room/2,out=picked.slice(0,n).map(function(y){return y+shift;});
      if(out.every(function(y){return S.laneOK(y,x0,x1,u);}))return out;
      return picked.slice(0,n);
    }
  }
  return c.slice(0,n);
}
/* ならびがぜんぶ、しげみ・池・文字にかぶらない中心をさがす */
function formation(s,u,posFn){
  var cx=0,cy=0;s.m.forEach(function(a){cx+=a.x;cy+=a.y;});
  var near={x:clamp(cx/s.m.length,S.W*.25,S.W*.75),y:clamp(cy/s.m.length,S.top+u,S.bottom-u)};
  function ok(c){return posFn(c).every(function(p){return S.clear(p.x,p.y,u);});}
  if(ok(near))return near;
  return S.safeSpot(u,near,ok)||S.safeSpot(u*.8,near,function(c){return posFn(c).every(function(p){return S.clear(p.x,p.y,u*.8);});})||{x:S.W/2,y:(S.top+S.bottom)/2};
}

/* ---------------- だるまさんがころんだ ---------------- */
ACT.daruma={
  init:function(s){
    var oni=s.m[0],u=maxU(s.m);
    s.side=oni.x<S.W/2?-1:1;
    s.ox=s.side<0?u*1.5:S.W-u*1.5;
    var sx=s.side<0?S.W-u*1.4:u*1.4;
    s.players=s.m.slice(1);s.caught=[];s.round=0;
    var ys=lanes(s.players.length,s.ox,sx,u);
    s.oy=ys.reduce(function(v,y){return v+y;},0)/ys.length;
    go(oni,s.ox,s.oy,1.2);
    s.players.forEach(function(p,i){p.lane=ys[i];go(p,sx,ys[i],1.2);});
    P.say(oni,"わたしが おにね！",1.3);
  },
  update:function(s,dt){
    var oni=s.m[0],u=maxU(s.m),goalX=s.ox-s.side*u*1.1;
    if(s.st===0){
      if(allThere(s)){
        s.m.forEach(function(a){a.hold=true;});
        oni.face=s.side;oni.dir=s.side;
        s.players.forEach(function(p){p.face=-s.side;p.dir=-s.side;});
        P.say(oni,"いくよ〜",1.1);next(s);s.phase="start";s.pt=1.2;
      }
      return;
    }
    if(s.st===2)return goodbye(s,s.winner||oni,s.winner?oni:s.players[0],s.tt,1.6);
    var active=s.players.filter(function(p){return !p.caught;});
    /* おにのところに ついた子は、そこで待つ */
    s.caught.forEach(function(p){if(!p.hold&&arrived(p)){p.hold=true;p.mult=1;p.face=-s.side;p.dir=p.face;}});
    active.forEach(function(p){
      p.dash=Math.max(0,(p.dash||0)-dt);
      p.wob=Math.max(0,(p.wob||0)-dt);
      p.shake=p.wob>0?Math.sin(P.now*45)*p.u*.07:0;
    });
    s.pt-=dt;
    if(s.phase==="call"){
      /* ボードの横はばに合わせて、4〜6回ほどで おにに とどく速さにする */
      var need=Math.abs(S.W-u*2.9)/5.5/2.1,base=clamp(need/(p0Speed(s)||1),.9,2.2);
      active.forEach(function(p){p.hold=false;go(p,goalX,p.lane,p.dash>0?base*1.9:base*rand(.9,1.1));});
      var toucher=active.filter(function(p){return Math.abs(p.x-s.ox)<u*1.6;})[0];
      if(toucher){
        toucher.hold=true;s.winner=toucher;
        s.m.forEach(function(a){a.hold=true;});
        oni.sleep=false;faceTo(oni,toucher);
        P.say(toucher,"タッチ！",1.2);P.jump(oni,4);
        P.later(.6,function(){if(alive(s,oni))P.say(oni,"わっ、タッチされた〜",1.3);});
        next(s);return;
      }
      if(s.pt<=0){
        /* ふりむく */
        s.phase="look";s.pt=1.7;s.checked=false;
        oni.sleep=false;oni.face=-s.side;oni.dir=-s.side;P.say(oni,"ころんだ！",1.1);P.jump(oni,2.4);
        active.forEach(function(p){p.hold=true;});
      }
      return;
    }
    if(s.phase==="look"){
      if(!s.checked&&s.pt<1.3){
        s.checked=true;
        var mover=s.forced&&!s.forced.caught?s.forced:(Math.random()<.35?pick(active):null);
        s.forced=null;
        if(mover)catchOne(s,mover);
      }
      if(s.pt<=0){
        s.round++;
        var left=s.players.filter(function(p){return !p.caught;});
        if(!left.length){P.say(oni,"みんな つかまえた！",1.4);P.jump(oni,4);next(s);return;}
        if(s.round>=9){P.say(oni,"きょうは ここまで〜",1.4);next(s);return;}
        startCall(s);
      }
      return;
    }
    if(s.phase==="start"&&s.pt<=0)startCall(s);
  },
  tap:function(s,a){
    var oni=s.m[0];
    if(s.st===0){tapLine(a,"daru0",["だるまさんが ころんだ、するよ〜","どきどき…"]);return;}
    if(s.st===2){tapLine(a,"daruEnd",s.winner===a?["タッチ できた！","そーっと ちかづいたよ"]:["どきどき したね","つぎも まけないよ"]);return;}
    if(a===oni){
      if(s.phase==="call"){tapLine(a,"daruOniCall",["ちらっ…","はやく ふりむいちゃおう"]);if(fx(s,2.2)&&s.pt>.4)s.pt=.35;}
      else tapLine(a,"daruOniLook",["じーっ…","うごいたら つかまえるよ"]);
      return;
    }
    if(a.caught){tapLine(a,"daruCaught",["つかまっちゃった〜","たすけて〜"]);return;}
    if(s.phase==="call"){
      tapLine(a,"daruDash",["いそげ〜！","そろり、そろり…"]);
      if(a.ptLine==="いそげ〜！"&&afx(a,1))a.dash=.9;
      return;
    }
    tapLine(a,"daruWobble",["おっとっと…！","わっ、うごいちゃった"]);
    if(afx(a,1)){a.wob=.7;if(s.checked)catchOne(s,a);else s.forced=a;}
  }
};
/* ふつうに歩いたときの1秒あたりの速さ（ぴょんと跳ねる子も おおよそ同じとみなす） */
function p0Speed(s){var p=s.players[0];return p?p.u*1.55:40;}
function startCall(s){
  var oni=s.m[0];
  s.phase="call";s.pt=rand(1.6,2.6);
  oni.face=s.side;oni.dir=s.side;oni.sleep=true;
  P.say(oni,"だるまさんが〜",Math.max(1.2,s.pt));
}
function catchOne(s,p){
  var oni=s.m[0],u=maxU(s.m);
  if(p.caught)return;
  p.wob=.5;P.say(oni,p.sp.name+"、いま うごいた！",1.4);
  /* 言われたら すぐに、はやあしで おにのところへ */
  P.later(.4,function(){
    if(!alive(s,p)||p.caught)return;
    p.caught=true;s.caught.push(p);p.shake=0;p.hold=false;
    var k=s.caught.length;
    go(p,s.ox-s.side*u*.2,clamp(s.oy+u*1.2*Math.ceil(k/2)*(k%2?1:-1),S.top,S.bottom),2.4);
    P.say(p,"つかまった〜",1.2);
  });
}

/* ---------------- よーいどん（かけっこ） ---------------- */
ACT.race={
  init:function(s){
    var u=maxU(s.m),cx=0;s.m.forEach(function(a){cx+=a.x;});cx/=s.m.length;
    /* みんながいる側からスタートして、反対側がゴール */
    s.x0=cx<S.W/2?u*1.3:S.W-u*1.3;s.x1=cx<S.W/2?S.W-u*1.3:u*1.3;
    var ys=lanes(s.m.length,s.x0,s.x1,u);
    s.m.forEach(function(a,i){a.lane=ys[i];go(a,s.x0,ys[i],1.2);});
    s.order=[];
    var gx=s.x1+(s.x1>s.x0?1:-1)*u*.5,top=Math.min.apply(null,ys)-u*.4,bot=Math.max.apply(null,ys)+u*.4;
    addProp(s,{y:S.top-5,draw:function(g){
      g.strokeStyle="rgba(255,255,255,.85)";g.lineWidth=Math.max(2,u*.08);g.setLineDash([u*.28,u*.2]);
      g.beginPath();g.moveTo(gx,top);g.lineTo(gx,bot);g.stroke();g.setLineDash([]);
      [top,bot].forEach(function(y){
        g.strokeStyle="#8C6A48";g.lineWidth=Math.max(1.5,u*.05);g.beginPath();g.moveTo(gx,y);g.lineTo(gx,y-u*1.1);g.stroke();
        g.fillStyle="#EF6B5E";g.beginPath();g.moveTo(gx,y-u*1.1);g.lineTo(gx+u*.5,y-u*.92);g.lineTo(gx,y-u*.74);g.closePath();g.fill();
      });
    }});
    P.say(s.m[0],"スタートに ならぼう！",1.3);
  },
  update:function(s,dt){
    var u=maxU(s.m),dirX=s.x1>s.x0?1:-1;
    if(s.st===0){
      if(allThere(s)){s.m.forEach(function(a){a.hold=true;a.face=dirX;a.dir=dirX;});next(s);}
      return;
    }
    if(s.st===1){
      var caller=s.m[0];
      if(s.tt>.4&&once(s,"c1"))P.say(caller,"いちについて…",1);
      if(s.tt>1.5&&once(s,"c2"))P.say(caller,"よーい…",.9);
      if(s.tt>2.5&&once(s,"c3")){
        P.say(caller,"どん！",.9);
        s.m.forEach(function(a){a.hold=false;a.spd=rand(1.2,1.6);});
        next(s);
      }
      return;
    }
    if(s.st===2){
      s.m.forEach(function(a){
        if(a.done)return;
        a.boost=Math.max(0,(a.boost||0)-dt);
        if(a.trip>0){a.trip-=dt;a.hold=true;a.shake=Math.sin(P.now*40)*a.u*.05;if(a.trip<=0){a.hold=false;a.shake=0;}return;}
        go(a,s.x1,a.lane,a.boost>0?2.3:a.spd);
        if(Math.abs(a.x-s.x1)<u*.45){
          a.done=true;a.hold=true;s.order.push(a);
          var place=s.order.length;
          if(place===1){P.say(a,"いちばん！",1.4);P.jump(a,4.6);P.note(a.x,P.headY(a)-8,"★","#E9A93B");}
          else if(place===2)P.say(a,"2ばん！",1.1);
          else P.say(a,pick(["ゴール！","ついた〜"]),1.1);
        }
      });
      if(s.m.every(function(a){return a.done;})||s.tt>14){s.winner=s.order[0]||s.m[0];next(s);}
      return;
    }
    if(s.st===3){
      if(once(s,"face")&&s.order[1])faceTo(s.order[1],s.winner);
      return goodbye(s,s.winner,s.order[1]||s.m[1],s.tt,1.3);
    }
  },
  tap:function(s,a){
    if(s.st===0){tapLine(a,"race0",["よーいどん、するよ〜","まけないぞ〜"]);return;}
    if(s.st===1){tapLine(a,"race1",["ドキドキ…","はやく どん して〜"]);return;}
    if(s.st===3||a.done){tapLine(a,"raceDone",s.order[0]===a?["いちばん だよ！","はやかった でしょ"]:["ゴール したよ","つぎは いちばん！"]);return;}
    var line=tapLine(a,"raceRun",["いそげ〜！","わっ、ころんじゃった〜"]);
    if(!afx(a,1))return;
    if(line==="いそげ〜！")a.boost=1.1;
    else{a.trip=.9;P.jump(a,2);}
  }
};

/* ---------------- つなひき ---------------- */
ACT.tug={
  init:function(s){
    var u=maxU(s.m),n=s.m.length,half=n/2;
    s.L=s.m.slice(0,half);s.R=s.m.slice(half);s.o=0;
    /* つなの長さ（＝ならぶ間かく）は どうぶつの大きさから決める。せまいボードでは 少しつめる */
    var room=S.W*.44/u,inner=1.35;
    s.gap=half>1?clamp((room-inner)/(half-1),1.5,2):2;
    function base(team,i,c){return c.x+(team==="L"?-1:1)*(inner*u+i*s.gap*u);}
    function pos(c){return s.L.map(function(a,i){return {x:base("L",i,c),y:c.y};}).concat(s.R.map(function(a,i){return {x:base("R",i,c),y:c.y};}));}
    s.c=formation(s,u,pos);s.base=base;
    s.L.forEach(function(a,i){a.pow=rand(.9,1.1);go(a,base("L",i,s.c),s.c.y,1.2);});
    s.R.forEach(function(a,i){a.pow=rand(.9,1.1);go(a,base("R",i,s.c),s.c.y,1.2);});
    addProp(s,{y:function(){return s.c.y+2;},draw:function(g){
      if(s.st<1)return;
      var xs=s.m.map(function(a){return a.x;}),x0=Math.min.apply(null,xs)-u*.35,x1=Math.max.apply(null,xs)+u*.35,ry=s.c.y-u*.62;
      g.lineCap="round";
      g.strokeStyle="#A87C4F";g.lineWidth=Math.max(3,u*.13);g.beginPath();g.moveTo(x0,ry);g.lineTo(x1,ry);g.stroke();
      g.strokeStyle="rgba(255,240,210,.55)";g.lineWidth=Math.max(1,u*.04);g.setLineDash([u*.12,u*.16]);
      g.beginPath();g.moveTo(x0,ry-u*.02);g.lineTo(x1,ry-u*.02);g.stroke();g.setLineDash([]);
      var mx=s.c.x+s.o;
      g.fillStyle="#EF6B5E";g.beginPath();g.moveTo(mx,ry);g.lineTo(mx-u*.16,ry+u*.34);g.lineTo(mx+u*.16,ry+u*.34);g.closePath();g.fill();
    }});
    addProp(s,{y:S.top-4,draw:function(g){
      if(s.st<1)return;
      g.strokeStyle="rgba(255,255,255,.8)";g.lineWidth=Math.max(2,u*.08);
      g.beginPath();g.moveTo(s.c.x,s.c.y-u*.3);g.lineTo(s.c.x,s.c.y+u*.35);g.stroke();
    }});
    P.say(s.m[0],"2チームに わかれよう！",1.3);
  },
  update:function(s,dt){
    var u=maxU(s.m),c=s.c;
    function track(mult){
      s.L.forEach(function(a,i){go(a,s.base("L",i,c)+s.o,c.y,mult);});
      s.R.forEach(function(a,i){go(a,s.base("R",i,c)+s.o,c.y,mult);});
    }
    if(s.st===0){
      if(allThere(s)){
        s.L.forEach(function(a){a.face=1;a.dir=1;a.faceLock=true;a.hold=true;});
        s.R.forEach(function(a){a.face=-1;a.dir=-1;a.faceLock=true;a.hold=true;});
        next(s);
      }
      return;
    }
    if(s.st===1){
      if(s.tt>.3&&once(s,"r1"))P.say(s.L[0],"よーい…",.9);
      if(s.tt>1.3&&once(s,"r2")){P.say(s.R[0],"はじめ！",.9);s.m.forEach(function(a){a.hold=false;});s.chantT=.2;s.chantSide=0;next(s);}
      return;
    }
    if(s.st===2){
      function power(team){return team.reduce(function(v,a){a.weak=Math.max(0,(a.weak||0)-dt);return v+a.pow*(a.weak>0?.2:1)*(1+.35*Math.sin(P.now*3.1+a.seed));},0);}
      /* 力くらべ＋ゆっくりした「波」。どちらかに少しずつ かたむいて、10秒くらいで決着がつく */
      if(s.wave==null){s.wave=rand(0,PI*2);s.lean=pick([-1,1])*rand(.25,.45);}
      var force=power(s.R)-power(s.L);
      s.o+=(force*u*.9+(Math.sin(s.t*.8+s.wave)*.6+s.lean)*u*.55)*dt;
      track(2.4);
      s.m.forEach(function(a){a.shake=Math.sin(P.now*18+a.seed)*a.u*.03;});
      s.chantT-=dt;
      if(s.chantT<=0){
        s.chantT=.75;s.chantSide^=1;var team=s.chantSide?s.R:s.L,tx=team.reduce(function(v,a){return v+a.x;},0)/team.length;
        P.note(tx,P.headY(team[0])-6,"よいしょ",AD.INK);
      }
      if(Math.abs(s.o)>u*1.9||s.tt>14){
        s.m.forEach(function(a){a.shake=0;a.hold=true;});
        if(Math.abs(s.o)>u*1.9){
          s.win=s.o>0?s.R:s.L;s.lose=s.o>0?s.L:s.R;var dirW=s.o>0?1:-1;
          s.win.forEach(function(a){P.jump(a,4.2);});P.say(s.win[0],"やったー！",1.3);
          s.lose.forEach(function(a){a.knock=dirW*a.u*4;});P.later(.4,function(){if(alive(s,s.lose[0]))P.say(s.lose[0],"わ〜っ！",1.1);});
        }else{P.say(s.L[0],"ひきわけ〜",1.2);}
        next(s);
      }
      return;
    }
    if(s.st===3){
      if(s.tt>1.4&&once(s,"face")){s.m.forEach(function(a){a.faceLock=false;});}
      var a=s.win?s.win[0]:s.L[0],b=s.lose?s.lose[0]:s.R[0];
      return goodbye(s,a,b,s.tt,2);
    }
  },
  tap:function(s,a){
    if(s.st<=1){tapLine(a,"tug0",["がんばるぞ〜","まけないよ！"]);return;}
    if(s.st===3){
      var won=s.win&&s.win.indexOf(a)>=0;
      tapLine(a,"tugEnd",!s.win?["ひきわけ だったね","つよかった〜"]:won?["かったよ！","ちからもち でしょ"]:["まけちゃった〜","つぎは かつぞ"]);return;
    }
    tapLine(a,"tugTap",["ちからが ぬけちゃう〜","わっ、すべった！"]);
    if(afx(a,.9))a.weak=1.1;
  }
};

/* みんなであそぶ あそびの一覧（4ひき以上いるときに えらばれる） */
X.GROUP={daruma:{max:6,weight:1.2},race:{max:6,weight:1.2},tug:{max:6,weight:1,even:true}};
X.AFTER.daruma=["そーっと うごくの、むずかしい","ころんだ！って ドキッとした","つぎは おにを やりたいな"];
X.AFTER.race=["いっぱい はしった〜","つぎは もっと はやく はしるぞ","あしが まだ はしってる"];
X.AFTER.tug=["うでが つかれた〜","よいしょ、よいしょ、したね","つぎは ぜったい かつぞ"];
})();
