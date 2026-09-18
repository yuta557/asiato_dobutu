/* あそび：おいかけっこ・ボールあそび・かくれんぼ・ダンス・ぎょうれつ
   あそんでいる子をタップすると、そのあそびの中だけの反応をする（ときどき、あそびが少しじゃまされる） */
(function(){
"use strict";
var AD=window.AD,S=AD.scene,P=AD.play,PI=Math.PI,clamp=AD.clamp,rand=AD.rand,pick=AD.pick;
var X=AD.acts={};
var schedT=1.2,groupCool=0,bigCool=4;

function go(a,x,y,mult){a.tx=clamp(x,a.u*.8,S.W-a.u*.8);a.ty=clamp(y,S.top,S.bottom);a.mult=mult||1;a.rest=0;}
function arrived(a){return Math.hypot(a.tx-a.x,a.ty-a.y)<a.u*.35;}
function faceTo(a,b){a.face=b.x>a.x?1:-1;a.dir=a.face;}
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
function pickFlee(s,r,c){
  var base=Math.atan2(r.y-c.y,r.x-c.x),prev=s.flee?Math.atan2(s.flee.y-r.y,s.flee.x-r.x):base,best=null,bs=-1e9;
  [0,.5,-.5,1,-1,1.5,-1.5,2.1,-2.1,2.7,-2.7].forEach(function(o){
    var an=base+o,far=r.u*rand(3.2,4.2),q={x:r.x+Math.cos(an)*far,y:r.y+Math.sin(an)*far*.7};
    if(q.x<r.u*1.2||q.x>S.W-r.u*1.2||q.y<S.top||q.y>S.bottom)return;
    if(!S.clear(q.x,q.y,r.u)||!S.segClear(r,q,r.u*.85))return;
    var turn=Math.abs(Math.atan2(Math.sin(an-prev),Math.cos(an-prev)));
    var sc=Math.hypot(q.x-c.x,q.y-c.y)-Math.abs(o)*r.u*.5-turn*r.u*.6;
    if(sc>bs){bs=sc;best=q;}
  });
  return best||S.safeSpot(r.u,{x:r.x,y:r.y},function(q){return Math.hypot(q.x-c.x,q.y-c.y)>Math.hypot(r.x-c.x,r.y-c.y);})||s.flee;
}
/* ボールが ころがっていく。missed＝とりそこねた子（ころがした子） */
function roll(s,missed,far){
  var B=s.ball,best=null;
  if(s.fetch&&s.fetch.by&&s.fetch.a){s.fetch.a.helping=null;s.fetch.a.hold=false;s.fetch.a.rest=rand(.8,1.6);}
  for(var i=0;i<10;i++){
    var an=Math.random()*PI*2,d=P.U*(far?rand(2.6,3.6):rand(2,3)),q={x:B.x+Math.cos(an)*d,y:B.y+Math.sin(an)*d*.5};
    if(q.x>P.U&&q.x<S.W-P.U&&q.y>S.top&&q.y<S.bottom&&S.clear(q.x,q.y,P.U*.6)){best=q;break;}
  }
  best=best||{x:clamp(B.x+(S.W/2-B.x)*.3,P.U,S.W-P.U),y:clamp(B.y,S.top,S.bottom)};
  B.x0=B.x;B.y0=B.y;B.x1=best.x;B.y1=best.y;B.f=0;B.dur=.8;B.h=P.U*.8;B.fly=true;s.recv=null;s.fetch=null;
  B.onLand=function(){if(P.sessions.indexOf(s)>=0)startFetch(s,missed,false);};
}
/* ころがったボールを だれがとりにいくか：いちばん近い子。3びき以上なら、とりそこねた子のかわりに なかまが「とってあげる」。
   あそびに入っていない子が もっと近くにいたら、その子がひろって なげかえしてくれる */
function startFetch(s,missed,noBy){
  var B=s.ball,d=function(a){return Math.hypot(a.x-B.x,a.y-B.y);};
  var mem=s.m.filter(function(a){return alive(s,a)&&(s.m.length<3||a!==missed);}).sort(function(p,q){return d(p)-d(q);})[0]||missed;
  var by=noBy?null:P.animals.filter(function(a){return !a.sess&&!a.leaving&&!a.helping&&!a.hidden&&a.age>3.2;}).sort(function(p,q){return d(p)-d(q);})[0];
  var useBy=!!by&&d(by)<Math.min(P.U*5,d(mem)*.7);
  var f=useBy?by:mem;
  s.fetch={a:f,got:false,t:0,back:false,missed:missed,by:useBy};
  if(useBy){by.helping=s;by.watch=null;by.watchMove=false;}
  P.say(f,f===missed?"まって〜、ボール〜":"とってあげる！",1.2);
}

/* ボールあそびの ならび方：2ひきは向かいあい、3〜4ひきは わになって まわす */
function ringSpots(c,n,R){
  var out=[];
  for(var i=0;i<n;i++){var an=-PI/2+i/n*PI*2+(n===4?PI/4:0);out.push({x:c.x+Math.cos(an)*R,y:c.y+Math.sin(an)*R*.6});}
  return out;
}

var ACT={
  tag:{init:function(s){
      s.m.sort(function(p,q){return (S.clear(q.x,q.y,q.u)?1:0)-(S.clear(p.x,p.y,p.u)?1:0);});
      s.c=s.m[1];s.r=s.m[0];s.dur=rand(9,12);s.swaps=0;s.pause=0;s.stun=0;s.rstun=0;s.minT=3.5;s.runAt=.4;s.talkT=2.4;
      P.say(s.c,"まてまて〜",1.3);},
    update:function(s,dt){var c=s.c,r=s.r;
      if(s.endSoon){c.hold=r.hold=true;c.sleep=false;s.es=(s.es||0)+dt;
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
      var dx=r.x-c.x,dy=r.y-c.y,d=Math.hypot(dx,dy)||1;
      /* 走っている間の向きは 動いた方向だけで決める（止まったときに前の向きへ戻さない） */
      r.face=0;
      /* タッチできるようになるまで（にげる子の はなれる時間）は、おにを少しゆっくりにして 追いつかせない */
      var grace=s.tt<s.minT;
      if(!c.hold){c.face=0;go(c,r.x,r.y,grace?1.15:1.5);}
      else if(Math.abs(dx)>c.u*.5)c.face=dx>0?1:-1;
      /* タッチできないとき（はなれる時間中・数えている間・つかまった直後）は、重ならないようにする。
         おには すこし下がり、にげる子は 前に出る。タッチできるときは はなさない（そうしないと つかまえられない） */
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
      /* にげる先は しばらく決めたままにする（毎フレーム決めなおすと、左右にぶるぶる向きが変わる）
         着いた・時間がたった・おにの方が先に近づいた ときだけ決めなおす */
      s.fleeT=(s.fleeT||0)-dt;
      var F=s.flee,need=!F||s.fleeT<=0||Math.hypot(F.x-r.x,F.y-r.y)<r.u*.6||!S.clear(F.x,F.y,r.u)||
        Math.hypot(F.x-c.x,F.y-c.y)<Math.hypot(F.x-r.x,F.y-r.y)*.9;
      if(need&&P.now-(s.fleePick||-9)>.35){s.flee=pickFlee(s,r,c);s.fleePick=P.now;s.fleeT=rand(.9,1.4);}
      /* おにが目をつぶって数えている間は、しっかり距離をとる */
      if(s.flee)go(r,s.flee.x,s.flee.y,counting?1.8:1.45);
      s.talkT-=dt;
      if(s.talkT<0&&!counting){s.talkT=rand(1.8,2.8);if(Math.random()<.5)P.say(r,pick(["にげろ〜","こっちだよ〜","きゃ〜！"]),1.2);else P.say(c,pick(["まてまて〜","まて〜！","つかまえるぞ〜"]),1.2);}
      if(canCatch&&Math.hypot(dx,dy*1.5)<(c.u+r.u)*.5){
        P.say(c,"タッチ！",1.1);P.jump(c,3.5);
        var caught=r,tagger=c;
        P.later(.5,function(){if(alive(s,caught))P.say(caught,"つかまった〜",1.2);});
        if(s.swaps<1){
          s.swaps++;s.c=caught;s.r=tagger;s.flee=null;s.tt=0;s.flag={};
          /* 新しいおには 目をつぶって数える。にげる子は そのあいだに はなれる */
          s.pause=3.2;s.rstun=1.2;s.minT=3.2+3.5;s.runAt=1.6;s.dur=s.t+rand(10,12);s.talkT=5;
          P.later(1.1,function(){if(alive(s,caught))P.say(caught,"こんどは、おにだぞ〜",1.4);});
        }else s.endSoon=true;
        return;
      }
      if(s.t>s.dur){P.say(c,"はあはあ…",1.2);P.later(.5,function(){if(alive(s,r))P.say(r,"つかれた〜",1.2);});s.endSoon=true;s.es=0;}
    },
    tap:function(s,a){var c=s.c,r=s.r;
      if(s.endSoon){tapLine(a,"tagEnd",["はあはあ…","いっぱい はしった〜"]);return;}
      if(a===c){
        if(s.pause>0){tapLine(a,"tagCount",["いま、かぞえてるの！","め、つぶってるよ〜"]);return;}
        tapLine(a,"tagOni",["わっ、じゃましないで〜！","おっとっと！","もう〜、にげられちゃう！"]);
        if(fx(s,1.2)){s.stun=1;P.jump(a,3);P.later(.4,function(){if(alive(s,r))P.say(r,"いまのうち〜！",1.2);});}
      }else{
        tapLine(a,"tagRun",["わっ、びっくりした！","きゃっ、おさないで〜","あぶない、あぶない！"]);
        if(fx(s,1.2)){s.rstun=.55;P.jump(a,3.6);P.later(.35,function(){if(alive(s,c)&&!(s.pause>0))P.say(c,"チャンス！",1.1);});}
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
        ringSpots(s.c,n,R).forEach(function(p,i){var a=s.m[i];a.spot=p;go(a,p.x,p.y);});
      }
      s.ball={x:s.c.x,y:s.c.y,z:0,r:P.U*.2,spin:0,fly:false,f:0};P.balls.push(s.ball);
      s.h=s.m[0];s.kicks=0;s.goal=6+(n-2)*2;
      },
    update:function(s,dt){var B=s.ball,n=s.m.length,h=s.h;
      function faceAll(to){s.m.forEach(function(a){if(a!==to&&alive(s,a))faceTo(a,to);});}
      if(s.st===0){if(s.m.every(arrived)||s.tt>6){s.m.forEach(function(a){a.hold=true;a.spot={x:a.x,y:a.y};});
          if(!B.fly){B.x=h.x+h.dir*h.u*.55;B.y=h.y;}s.wait=.6;next(s);}return;}
      if(s.st===2){if(once(s,"faceBye"))faceAll(h);return goodbye(s,h,s.m.filter(function(a){return a!==h;})[0],s.tt,.6);}
      if(B.fly)return;
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
            B.onLand=function(){if(!alive(s,to))return;s.h=to;s.wait=.9;P.jump(to,2.2);P.say(to,"ありがとう！",1.1);};
            f.helping=null;f.hold=false;f.face=0;f.rest=rand(1,2);s.fetch=null;
          }
        }else{
          F.t+=dt;
          if(F.t>.6&&!F.back){F.back=true;f.hold=false;go(f,f.spot.x,f.spot.y,1.1);}
          if(F.back){B.x=f.x+f.dir*f.u*.55;B.y=f.y;
            if(arrived(f)){f.hold=true;B.x=f.x+f.dir*f.u*.55;B.y=f.y;s.h=f;s.wait=.5;
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
        else{var nx=s.m[(s.m.indexOf(h)+1)%n];rc=Math.random()<.7&&nx!==h&&alive(s,nx)?nx:pick(others);}
        s.nextRecv=null;
        var strong=s.strong,thanks=s.thanks;s.strong=false;s.thanks=false;faceTo(h,rc);faceTo(rc,h);P.jump(h,strong?3.6:2.6);
        if(thanks)P.say(h,"はい、どうぞ！",1.1);
        else if(!strong&&Math.random()<.6)P.say(h,pick(n>2?["つぎ、"+rc.sp.name+"！","それっ","パス！"]:["それっ","パス！","いくよ〜","えいっ"]),1);
        B.x0=B.x;B.y0=B.y;B.x1=rc.x+rc.dir*rc.u*.55;B.y1=rc.y;B.f=0;B.dur=strong?1.15:.85;B.h=P.U*(strong?2.6:1.4);B.fly=true;s.recv=rc;
        B.onLand=function(){
          if(!alive(s,rc))return;
          if(s.miss){s.miss=false;roll(s,rc,true);return;}
          s.recv=null;P.jump(rc,2.2);
          if(thanks)P.say(rc,"ありがとう！",1);else if(Math.random()<.4)P.say(rc,pick(["とった！","ナイス！","うまいね"]),1);
          s.h=rc;s.kicks++;s.wait=.5;};
      }
    },
    tap:function(s,a){var B=s.ball;
      if(s.st===0){tapLine(a,"ball0",["いまから ボールあそび！","じゅんび、じゅんび"]);return;}
      if(s.st===2){tapLine(a,"ballEnd",["いっぱい パスしたね","ボール、じょうずでしょ"]);return;}
      if(s.fetch){
        if(a===s.fetch.a)tapLine(a,"ballFetch",a===s.fetch.missed?["まって〜、ボール〜","いま、とりにいくの！"]:["とってあげるね〜","まかせて！"]);
        else tapLine(a,"ballWait",a===s.fetch.missed?["ありがとう〜","ごめんね〜"]:["はやく〜！","ここで まってるね"]);
        return;
      }
      if(B.fly&&a===s.recv){tapLine(a,"ballMiss",["わっ、とれなかった〜","あっ、ボールが〜！"]);if(!s.miss){s.miss=true;P.jump(a,3.8);}return;}
      if(B.fly){tapLine(a,"ballGo",["とどけ〜！","いいパス〜"]);return;}
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
      /* かくれる場所：いちばん近い しげみ（最初と同じ） */
      s.b=S.bushes.slice().sort(function(p,q){return AD.dist(h,p)-AD.dist(h,q);})[0];
      s.hp=s.b.hidePoint();s.via=s.b.viaFor(h,h.u);
      var first=s.via||s.hp;
      k.hold=true;k.sleep=true;k.face=s.b.x>k.x?-1:1;P.say(k,"もういいかい？",1.6);go(h,first.x,first.y,1.35);},
    update:function(s){var k=s.m[0],h=s.m[1],b=s.b;
      if(s.st===0){if(s.tt>1.7&&once(s,"m"))P.say(h,"まあだだよ",1.3);
        if(s.via&&!s.viaDone&&(arrived(h)||s.tt>5)){s.viaDone=true;go(h,s.hp.x,s.hp.y,1.35);}
        if(s.tt>.8&&((!s.via||s.viaDone)&&arrived(h)||s.tt>10)){h.hidden=true;h.hold=true;h.x=s.hp.x;h.y=s.hp.y;next(s);}}
      else if(s.st===1){if(s.tt>.4&&once(s,"ok"))P.say(h,"もういいよ",1.4);
        if(s.tt>1.9){k.sleep=false;k.hold=false;k.face=0;var sp=b.seekSpot(k.x,k.u);go(k,sp.x,sp.y);P.say(k,"どこかな〜？",1.3);next(s);}}
      else if(s.st===2&&(arrived(k)||s.tt>9)){faceTo(k,h);k.hold=true;P.say(k,s.revealed?"そこだ〜！ みーつけた！":"みーつけた！",1.1);P.jump(h,5);
        P.later(1.2,function(){if(alive(s,h))P.say(h,"みつかっちゃった〜",1.4);});next(s);}
      else if(s.st===3){if(s.tt>2&&once(s,"faceBye")){faceTo(h,k);}return goodbye(s,k,h,s.tt,2.7);}
    },
    tap:function(s,a){var k=s.m[0],h=s.m[1],b=s.b;
      if(a===k){
        if(s.st<=1)tapLine(a,"hideCount",["いま、かぞえてるの！","のぞいてないよ〜","いーち、にーい…"]);
        else if(s.st===2)tapLine(a,"hideSeek",["どこかな〜？","ヒント、ちょうだい〜"]);
        else tapLine(a,"hideDone",["みーつけた！","かくれるの、じょうずだね"]);
        return;
      }
      if(s.st===0)tapLine(a,"hideGo",["いま、かくれるところ！","しーっ、ないしょね"]);
      else if(s.st===1){tapLine(a,"hideShh",["しーっ！","みつかっちゃうよ〜"]);
        if(fx(s,1.6))P.later(.6,function(){if(alive(s,k))P.say(k,"あれ？ いま、こえがした？",1.4);});}
      else if(s.st===2){tapLine(a,"hideOops",["あっ、こえ でちゃった！","しーっ…！"]);
        if(!s.revealed){s.revealed=true;var sp=b.seekSpot(k.x,k.u);go(k,sp.x,sp.y,1.5);}}
      else tapLine(a,"hideFound",["みつかっちゃった〜","つぎは みつからないぞ〜"]);
    }},

  dance:{init:function(s){pair(s,(s.m[0].u+s.m[1].u)*.7);s.k=0;s.n=0;s.fast=0;s.ext=0;},
    update:function(s,dt){var a=s.m[0],b=s.m[1];
      if(s.st===0&&bothThere(s)){a.hold=b.hold=true;next(s);}
      else if(s.st===1){s.k-=dt;s.fast=Math.max(0,s.fast-dt);
        if(s.k<0){s.k=s.fast>0?.28:.42;s.n++;
          [a,b].forEach(function(d){
            if(s.trip&&s.trip.a===d&&s.trip.n>0){P.jump(d,1.1);return;}
            P.jump(d,s.fast>0?3.2:2.6);
          });
          if(s.trip){s.trip.n--;if(s.trip.n<=0)s.trip=null;}
          if(s.n%2){faceTo(a,b);faceTo(b,a);}else{a.face=-a.face;b.face=-b.face;a.dir=a.face;b.dir=b.face;}
          if(s.n%2)P.note(s.c.x,Math.min(P.headY(a),P.headY(b)),"♪");}
        if(s.n>=8){P.say(a,"じゃーん！",1.1);P.later(.15,function(){if(alive(s,b))P.say(b,"じゃーん！",1.1);});next(s);}}
      else if(s.st===2){if(once(s,"faceBye")){faceTo(a,b);faceTo(b,a);}return goodbye(s,b,a,s.tt,1.3);}
    },
    tap:function(s,a){var o=other(s,a);
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
      s.m.slice(1).forEach(function(f,i){var k=L.u*1.6*(i+1),q=P.unhidePoint(L.tx-dx/dl*k,L.ty-dy/dl*k*.6,f.u);go(f,q.x,q.y,1.6);});
      P.say(L,"ならんで〜！",1.2);},
    update:function(s,dt){var L=s.m[0];
      if(s.st===1)return goodbye(s,s.m[s.m.length-1],L,s.tt,1.4);
      if(!s.lined){
        if(s.leadMove&&arrived(L)){s.leadMove=false;L.hold=true;}
        if((s.m.slice(1).every(arrived)&&!s.leadMove)||s.tt>7){
          s.lined=true;s.tt=0;L.hold=false;
          s.m.slice(1).forEach(function(f){f.face=L.face;f.dir=L.face;});
          /* ならんだ順に 道すじをつくっておくと、うしろの子が そのまま ついていける */
          s.trail=s.m.slice(1).reverse().map(function(f){return {x:f.x,y:f.y};}).concat([{x:L.x,y:L.y}]);
          P.say(L,"しゅっぱーつ！",1.4);go(L,s.wp[0].x,s.wp[0].y,.9);
        }
        return;
      }
      if(s.stop>0){s.stop-=dt;s.m.forEach(function(m){m.hold=true;});if(s.stop<=0)s.m.forEach(function(m){m.hold=false;});return;}
      if(arrived(L)){s.i++;if(s.i>=s.wp.length||s.t>30){P.say(L,"とうちゃく！",1.3);s.m.forEach(function(a){a.hold=true;P.jump(a,3.2);});next(s);return;}
        go(L,s.wp[s.i].x,s.wp[s.i].y,.9);}
      /* うしろの子は、先頭が通った道をそのままたどる（しげみや文字にかぶらない） */
      s.trail=s.trail||[{x:L.x,y:L.y}];
      var lt=s.trail[s.trail.length-1];
      if(Math.hypot(L.x-lt.x,L.y-lt.y)>L.u*.2)s.trail.push({x:L.x,y:L.y});
      if(s.trail.length>400)s.trail.shift();
      for(var i=1;i<s.m.length;i++){
        var f=s.m[i];
        if(f.lag>0){f.lag-=dt;f.hold=true;if(f.lag<=0){f.hold=false;f.catchT=2;P.say(f,"まって〜！",1.1);}continue;}
        f.catchT=Math.max(0,(f.catchT||0)-dt);
        var want=i*L.u*1.6,acc=0,pt=s.trail[0];
        for(var j=s.trail.length-1;j>0;j--){acc+=Math.hypot(s.trail[j].x-s.trail[j-1].x,s.trail[j].y-s.trail[j-1].y);if(acc>=want){pt=s.trail[j-1];break;}}
        var tp=P.unhidePoint(pt.x,pt.y,f.u);
        go(f,tp.x,tp.y,f.catchT>0?1.8:1.05);
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
    var ele=s.m.filter(function(a){return a.sp.key==="foot2";})[0];
    if(ele)P.say(ele,"ぱおーん、いけに いこう！",1.3);
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
  daruma:"だるまさんがころんだ",race:"よーいどん",tug:"つなひき"};
X.PLAY_NAME=PLAY_NAME;
var REPLY=["いいよ〜！","やろう、やろう！","うん、あそぼ！"];
X.start=function(type,m){
  var s={type:type,m:m,t:0,tt:0,st:0,flag:{},prep:{t:0,said:0}};
  m.forEach(function(a){a.sess=s;a.rest=0;a.face=0;a.hold=true;});
  P.sessions.push(s);
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
    a.rest=rand(1.5,3);a.cool=rand(5,9);a.tx=a.x;a.ty=a.y;});
  if(s.ball){var k=P.balls.indexOf(s.ball);if(k>=0)P.balls.splice(k,1);}
  if(s.fetch&&s.fetch.by&&s.fetch.a){s.fetch.a.helping=null;s.fetch.a.hold=false;s.fetch.a.face=0;s.fetch.a.rest=1;}
  (s.props||[]).forEach(function(pr){var j=P.props.indexOf(pr);if(j>=0)P.props.splice(j,1);});
};
/* ほかのファイル（みんなであそぶ あそび）から使う道具 */
X.ACT=ACT;
X.h={go:go,arrived:arrived,faceTo:faceTo,next:next,once:once,alive:alive,tapLine:tapLine,goodbye:goodbye,fx:fx,weighted:weighted};
X.tick=function(s,dt){
  if(P.sessions.indexOf(s)<0)return;
  s.t+=dt;s.tt+=dt;
  if(s.m.some(function(a){return a.leaving||P.animals.indexOf(a)<0;})){X.end(s);return;}
  if(s.prep){tickPrep(s,dt);return;}
  if(ACT[s.type].update(s,dt)===true)X.end(s);
};
/* あそんでいる子がタップされた */
X.onTap=function(a){
  var s=a.sess;if(!s||P.sessions.indexOf(s)<0||!ACT[s.type].tap)return false;
  /* さそっている間：これから なにをするのか を言う */
  if(s.prep){tapLine(a,"prep"+s.type,["これから "+PLAY_NAME[s.type]+" するの！","はやく はじめよう！"]);return true;}
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
tug:["がんばれ〜！","よいしょ〜！"]};
function spectate(dt){
  var s=P.sessions.filter(function(x){return x.m.length>=4;})[0];
  P.animals.forEach(function(a){
    if(a.sess||a.leaving||a.helping)return;
    if(!s||a.age<1.1){if(a.watch){a.watch=null;a.face=0;a.watchMove=false;a.rest=rand(.6,2);}return;}
    a.watch=s;
    var cx=0,cy=0,l=1e9,r=-1e9,t=1e9,b=-1e9;
    s.m.forEach(function(m){var x=m.tx!=null?m.tx:m.x,y=m.ty!=null?m.ty:m.y;cx+=x;cy+=y;l=Math.min(l,x,m.x);r=Math.max(r,x,m.x);t=Math.min(t,y,m.y);b=Math.max(b,y,m.y);});
    cx/=s.m.length;cy/=s.m.length;
    var pad=a.u*1.6,inside=a.x>l-pad&&a.x<r+pad&&a.y>t-pad*1.2&&a.y<b+pad*.8;
    if(a.watchMove){if(Math.hypot(a.tx-a.x,a.ty-a.y)<a.u*.4)a.watchMove=false;return;}
    if(inside){
      var dx=a.x-cx,dy=a.y-cy,dl=Math.hypot(dx,dy*1.6)||1,best=null;
      for(var k=0;k<8&&!best;k++){
        var an=Math.atan2(dy,dx)+(k%2?1:-1)*Math.ceil(k/2)*.6,d=Math.max(r-l,b-t)*.5+pad*1.4,q={x:cx+Math.cos(an)*d,y:cy+Math.sin(an)*d*.6};
        if(S.clear(q.x,q.y,a.u))best=q;
      }
      best=best||S.safeSpot(a.u,{x:a.x,y:a.y},function(q){return !(q.x>l-pad&&q.x<r+pad&&q.y>t-pad&&q.y<b+pad);});
      if(best){a.tx=best.x;a.ty=best.y;a.rest=0;a.mult=1.2;a.watchMove=true;return;}
    }
    a.rest=Math.max(a.rest,.5);a.face=cx>a.x?1:-1;
  });
  if(s){
    s.cheerT=(s.cheerT==null?rand(4,6):s.cheerT)-dt;
    if(s.cheerT<=0){
      s.cheerT=rand(5,8);
      var fans=P.animals.filter(function(a){return a.watch===s&&!a.watchMove;});
      if(fans.length&&CHEER[s.type])P.say(pick(fans),pick(CHEER[s.type]),1.3);
    }
  }
}
/* 見まもっている子がタップされた */
X.onTapWatch=function(a){
  /* ボールをひろってあげている子 */
  if(a.helping&&P.sessions.indexOf(a.helping)>=0){tapLine(a,"helpBall",["ボール、とってあげるの","まかせて！"]);return true;}
  if(!a.watch||P.sessions.indexOf(a.watch)<0)return false;
  tapLine(a,"watch",["いま みんなで あそんでるの","みてるだけ〜","つぎは いっしょに あそびたいな"]);P.jump(a,3);
  return true;
};
X.schedule=function(dt){
  spectate(dt);
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
      if(g.lanes&&X.laneRoom)n=Math.min(n,X.laneRoom(P.U));
      if(g.even)n-=n%2;
      /* ひと休みが終わっている子から先に入れる */
      avail.sort(function(p,q){return (p.cool>0?1:0)-(q.cool>0?1:0)||Math.random()-.5;});
      X.start(type,avail.slice(0,n));return;
    }
  }
  var free=avail.filter(function(a){return a.cool<=0;});
  if(free.length<2)return;
  if(free.length>=3&&Math.random()<.2){X.start("parade",free.sort(function(){return Math.random()-.5;}).slice(0,3));return;}
  var a=pick(free),b=free.filter(function(o){return o!==a;}).sort(function(p,q){return AD.dist(a,p)-AD.dist(a,q);})[0];
  var near=free.filter(function(o){return o!==a;}).sort(function(p,q){return AD.dist(a,p)-AD.dist(a,q);});
  var hasEle=a.sp.key==="foot2"||b.sp.key==="foot2";
  var type=weighted([["tag",3],["ball",2.5],["hide",2.5],["dance",2],["mizu",hasEle?4:2]]);
  var mem=Math.random()<.5?[a,b]:[b,a];
  /* ボールあそびは、近くに ほかの子がいれば 3〜4ひきで まわす */
  if(type==="ball"&&near.length>=2&&Math.random()<.55){mem.push(near[1]);if(near.length>=3&&Math.random()<.35)mem.push(near[2]);}
  X.start(type,mem);
};
})();
