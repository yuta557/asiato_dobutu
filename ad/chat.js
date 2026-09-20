/* すれちがったときの おしゃべり（あそびが はじまっていないとき）
   ・近くに来た2ひきが 立ちどまって ひとこと ふたこと
   ・どうぶつの組み合わせだけの かけあいも ある
   ・10回に1回くらい、その話から ほんとうに あそびが はじまる */
(function(){
"use strict";
var AD=window.AD,S=AD.scene,P=AD.play,X=AD.acts,H=X.h,pick=AD.pick,rand=AD.rand;
var C=AD.chat={},go=H.go,faceTo=H.faceTo,weighted=H.weighted;

/* ふつうの おしゃべり。[はなす子(0か1)、ことば] のじゅんばん。
   together は、はなしたあと ふたりで おなじ ほうへ あるいていく */
var TALK=[
  {w:1.4,l:[[0,"あ、こんにちは〜"],[1,"こんにちは〜！"]]},
  {w:1.1,l:[[0,"なにして るの？"],[1,"おさんぽ してるの"],[0,"いいね〜"]]},
  {w:1.1,l:[[0,"どこ いくの〜？"],[1,"あっちの ほう！"],[0,"ついて いっていい？"],[1,"いいよ〜"]],together:true},
  {w:1,l:[[0,"いっしょに いく？"],[1,"うん、いく！"]],together:true},
  {w:.9,l:[[0,"おんなじ ほうに いこう！"],[1,"そうしよう！"]],together:true},
  {w:.9,l:[[0,"こっちも おいで〜"],[1,"いま いくよ〜"]],together:true},
  {w:.8,l:[[0,"あそぶ？"],[1,"ううん"],[1,"あとで あそぼ〜"]]},
  {w:.8,l:[[0,"げんき？"],[1,"げんき！"],[0,"よかった〜"]]},
  {w:.7,l:[[0,"おはな、みつけたよ"],[1,"わあ、きれい〜"]]},
  {w:.7,l:[[0,"くさが ふわふわ〜"],[1,"ほんとだ〜"]]}
];
/* この2ひきが そろったときだけの かけあい（k の じゅんばんで 0・1 が きまる） */
var PAIR=[
  {k:["foot4","hand4"],w:2,l:[[0,"にゃーん"],[1,"がおーっ"],[0,"……にゃ？"],[1,"ねこじゃないよ！"]]},
  {k:["foot0","foot2"],w:1.4,l:[[0,"おはな、なが〜い！"],[1,"ぱおーん、さわってみる？"],[0,"ぴよっ！"]]},
  {k:["foot1","foot3"],w:1.4,l:[[0,"にんじん、ない？"],[1,"はちみつ なら あるよ"],[0,"……ちがうの〜"]]},
  {k:["hand0","foot5"],w:1.4,l:[[0,"たかいとこ、どう？"],[1,"ユーカリ、みえる？"],[0,"はっぱなら いっぱい！"]]},
  {k:["hand3","hand5"],w:1.6,l:[[0,"ひひーん！"],[1,"ひひん！"],[0,"しましま、いいなあ"],[1,"かして あげられないの〜"]]},
  {k:["foot0","hand2"],w:1.6,l:[[0,"おおきい〜！"],[1,"ぎゃおー！"],[0,"ぴよっ！？"],[1,"あっ、ごめん…"]]},
  {k:["hand1","foot1"],w:1.4,l:[[0,"かたあし、できる？"],[1,"ぴょん！……むずかしい〜"]]},
  {k:["foot5","foot4"],w:1.4,l:[[0,"ねむいなあ…"],[1,"ごろごろ…"],[0,"いっしょに おひるね…"]]},
  {k:["foot2","hand2"],w:1.4,l:[[0,"ずしーん、って きこえた"],[1,"ぼくの あしおと！"]]},
  {k:["foot3","foot0"],w:1.4,l:[[0,"ぎゅーって しよう"],[1,"やさしく してね〜"]]},
  {k:["hand0","foot0"],w:1.2,l:[[0,"うえから こんにちは〜"],[1,"ぴよ〜、とどかない！"]]},
  {k:["hand4","hand5"],w:1.2,l:[[0,"しましま なかま！"],[1,"もようが ちがうよ〜"]]}
];
/* ひま〜 から あそびが はじまる話（ときどきだけ） */
var BORED=[[0,"ひま〜"],[1,"あそぶ？"],[0,"なにして あそぶ？"],[1,"うーん……"],[1,"PLAY！"],[0,"いいよ！"]];

var cool=rand(3,6);
C.s=null;

function busy(a){return !!(a.sess||a.chat||a.watch||a.helping||a.hidden||a.leaving);}
/* おしゃべりできる子：あそんでいない・見まもっていない・あそび場の中にいない */
function ready(a){
  return P.free(a)&&!busy(a)&&a.age>4&&(a.chatCool||0)<=0&&!(P.area&&P.inArea(a.x,a.y,a.u,null));
}
function stillOK(a){return a&&P.animals.indexOf(a)>=0&&!a.leaving&&!a.sess&&!a.watch&&!(P.area&&P.inArea(a.x,a.y,a.u,null));}

function begin(a,b,sc){
  var s={m:[a,b],l:sc.l,gap:1.35,t:0,i:0,together:sc.together,play:sc.play,ready:false};
  C.s=s;
  [a,b].forEach(function(x){x.chat=s;x.chatSeek=null;x.mult=1;x.rest=0;x.hold=false;});
  /* かさなったまま 話さないよう、まず きちんと はなれて 向かいあう */
  var mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2},gap=(P.halfW(a)+P.halfW(b))*1.08;
  var L=a.x<=b.x?a:b,R=L===a?b:a;
  /* 立つ場所が しげみ などで だめなときは、もう少し はなれた ところを さがす */
  function spot(who,dir){
    for(var k=0;k<6;k++){
      var g2=gap*(1+k*.14);
      var x=AD.clamp(mid.x+dir*g2/2,who.u*1.2,S.W-who.u*1.2);
      var y=AD.clamp(mid.y+dir*2,S.top+who.u*.4,S.bottom-who.u*.2);
      if(S.clear(x,y,who.u))return {x:x,y:y};
    }
    return null;
  }
  var pL=spot(L,-1),pR=spot(R,1);
  var lx=pL?pL.x:L.x,ly=pL?pL.y:L.y,rx=pR?pR.x:R.x,ry=pR?pR.y:R.y;
  go(L,lx,ly,1.35);go(R,rx,ry,1.35);
  faceTo(L,R);faceTo(R,L);
  return s;
}
/* おしゃべりの とちゅうは、あそびを はじめない（話の じゃまを しない） */
C.holdPlay=function(){return !!C.s;};
/* おしゃべりを やめる（タップされたとき・あそびが始まったときなど） */
C.stop=function(){
  var s=C.s;if(!s)return;
  s.m.forEach(function(a){if(a.chat===s){a.chat=null;a.hold=false;a.face=0;a.rest=rand(.2,.8);a.chatCool=rand(12,22);}});
  C.s=null;cool=rand(4,8);
};
function finish(s){
  var a=s.m[0],b=s.m[1];
  s.m.forEach(function(x){if(x.chat===s){x.chat=null;x.hold=false;x.face=0;x.chatCool=rand(12,22);}});
  C.s=null;cool=rand(5,10);
  if(s.play&&stillOK(a)&&stillOK(b)&&!P.sessions.length){X.start(s.play,[a,b],true);return;}
  if(s.together&&stillOK(a)&&stillOK(b)){
    /* ふたりで おなじほうへ。ならんで あるけるよう、すこしずらす。
       そのあとも しばらくは、行き先を そろえて いっしょに あるく */
    var p=P.roomySpot(a),d=(a.u+b.u)*.7;
    go(a,p.x-d*.5,p.y);go(b,p.x+d*.5,p.y+2);
    a.rest=0;b.rest=0;
    C.walk.push({a:a,b:b,off:d,until:P.now+rand(7,11)});
  }else{a.rest=rand(.2,1);b.rest=rand(.2,1);}
}
function step(s,dt){
  var a=s.m[0],b=s.m[1];
  if(!stillOK(a)||!stillOK(b)){C.stop();return;}
  /* はなれて 向かいあうまでは 話しださない */
  if(!s.ready){
    s.t+=dt;
    /* 向かいあって あいさつ するので、体（絵の はば）が かさならない ところまで はなれる */
    var apart=Math.abs(a.x-b.x)>(P.halfW(a)+P.halfW(b))*.98;
    var placed=(Math.hypot(a.tx-a.x,a.ty-a.y)<a.u*.35&&Math.hypot(b.tx-b.x,b.ty-b.y)<b.u*.35);
    /* かさなったままでは 話しださない。どうしても はなれられない ときは やめる */
    if(s.t>4&&!apart){C.stop();return;}
    if(apart&&(placed||s.t>1.6)){
      s.ready=true;s.t=0;
      a.hold=true;b.hold=true;a.rest=1;b.rest=1;
      faceTo(a,b);faceTo(b,a);
    }
    return;
  }
  s.t+=dt;
  while(s.i<s.l.length&&s.t>=s.i*s.gap){
    var ln=s.l[s.i],who=ln[0]?b:a,to=ln[0]?a:b;
    faceTo(who,to);faceTo(to,who);
    P.say(who,ln[1],1.5);
    if(s.i===0)P.jump(who,2.2);
    s.i++;
  }
  if(s.i>=s.l.length&&s.t>s.l.length*s.gap+.4)finish(s);
}
/* この2ひきだけの かけあいを さがす */
function pairTalk(a,b){
  var out=[];
  PAIR.forEach(function(sc){
    if(a.sp.key===sc.k[0]&&b.sp.key===sc.k[1])out.push([sc,false]);
    else if(b.sp.key===sc.k[0]&&a.sp.key===sc.k[1])out.push([sc,true]);
  });
  return out.length?pick(out):null;
}
function playType(a,b){
  var ele=a.sp.key==="foot2"||b.sp.key==="foot2";
  return weighted([["tag",3],["ball",2],["hide",2],["dance",2],["mizu",ele?3:1]]);
}
/* どの話をするか えらぶ */
function scriptFor(a,b){
  var pt=pairTalk(a,b);
  if(pt&&Math.random()<.55)return {l:pt[1]?pt[0].l.map(function(ln){return [ln[0]?0:1,ln[1]];}):pt[0].l};
  /* 「ひま〜」から あそびが はじまる話は、おしゃべり 10回に1回くらい */
  if(!P.sessions.length&&a.cool<=0&&b.cool<=0&&Math.random()<.15){
    var type=playType(a,b),name=X.PLAY_NAME[type]||"あそび";
    return {play:type,l:BORED.map(function(ln){return [ln[0],ln[1].replace("PLAY",name)];})};
  }
  return weighted(TALK.map(function(sc){return [sc,sc.w];}));
}
/* おしゃべりの あと「いっしょに いこう」と なった ふたり。
   しばらくは 行き先を そろえて、ならんで あるく */
C.walk=[];
function stepWalk(){
  for(var i=C.walk.length-1;i>=0;i--){
    var w=C.walk[i],A=w.a,B=w.b;
    if(P.now>w.until||!stillOK(A)||!stillOK(B)||A.chat||B.chat||A.sess||B.sess){B.mult=1;C.walk.splice(i,1);continue;}
    /* ついていく子は、あいての となりを めざす。
       はなれて しまったら まず あいてに 追いつき、ならんだら おなじ 行き先へ */
    var far=Math.hypot(A.x-B.x,(A.y-B.y)*1.3)>(A.u+B.u)*.8;
    var gx=far?A.x:A.tx,gy=far?A.y:A.ty;
    B.tx=AD.clamp(gx+w.off,B.u,S.W-B.u);
    B.ty=AD.clamp(gy+2,S.top,S.bottom);
    B.mult=far?1.2:1;
    if(B.rest>0)B.rest=0;
    if(A.rest>0)A.rest=0;
    B.hold=false;A.hold=false;
  }
}
C.tick=function(dt){
  if(P.bye){C.walk.length=0;if(C.s)C.stop();return;}
  stepWalk();
  P.animals.forEach(function(a){if(a.chatCool>0)a.chatCool-=dt;});
  if(C.s){step(C.s,dt);return;}
  /* どこかで あそびが はじまっているときは、ほかの子は おしゃべりしない（あそびの じゃまをしない） */
  if(P.sessions.length){
    P.animals.forEach(function(a){if(a.chatSeek){a.chatSeek=null;a.mult=1;}});
    cool=Math.max(cool,rand(2,4));return;
  }
  cool-=dt;
  /* 近づいた子どうしを さがす。少しはなれていても、ときどき じぶんから 近よっていく */
  var list=P.animals.filter(ready);
  for(var i=0;i<list.length;i++){
    var a=list[i];
    if(a.chatSeek){
      var b=a.chatSeek.b;
      a.chatSeek.t-=dt;
      if(!ready(b)||a.chatSeek.t<=0||!stillOK(a)){a.chatSeek=null;a.mult=1;continue;}
      var dd=AD.dist(a,b),near=(a.u+b.u)*1.15;
      if(dd<near*1.25){a.chatSeek=null;a.mult=1;if(cool<=0)begin(a,b,scriptFor(a,b));return;}
      var k=(dd-near)/dd;go(a,a.x+(b.x-a.x)*k,a.y+(b.y-a.y)*k,1.1);
    }
  }
  if(cool>0)return;
  var best=null,bd=1e9;
  for(var p=0;p<list.length;p++)for(var q=p+1;q<list.length;q++){
    var m=list[p],n=list[q],d=AD.dist(m,n);
    if(d<(m.u+n.u)*1.6&&d<bd){bd=d;best=[m,n];}
  }
  if(best){begin(best[0],best[1],scriptFor(best[0],best[1]));return;}
  /* 近くに だれもいなければ、1ぴきが 話しかけに 歩いていく */
  if(list.length>=2&&Math.random()<.5){
    var who=pick(list),mate=list.filter(function(o){return o!==who;}).sort(function(u,v){return AD.dist(who,u)-AD.dist(who,v);})[0];
    if(mate&&AD.dist(who,mate)<P.U*9)who.chatSeek={b:mate,t:6};
  }
  cool=rand(1.5,3);
};
})();
