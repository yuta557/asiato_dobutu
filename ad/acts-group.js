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
function lanes(n,x0,x1,u,minK){
  /* いちばん手前は 見ている子が ならぶ場所として あけておく */
  /* いちばん手前は 見ている子の ブルーシート用に あけておく */
  var top=S.top+u*.3,bot=S.bottom-u*2.1,c=[],cNoBush=[];
  for(var i=0;i<=28;i++){
    var y=top+(bot-top)*i/28;if(!S.laneOK(y,x0,x1,u,true))continue;
    c.push(y);
    /* しげみにかくれない高さ（しげみの手前を通る＝しげみより下、または しげみの絵より上） */
    var ok=true,lo=Math.min(x0,x1),hi=Math.max(x0,x1);
    for(var k=0;k<S.bushes.length&&ok;k++){
      var b=S.bushes[k],bl=b.x-b.img.w*.5-u*.3,br=b.x+b.img.w*.5+u*.3;
      if(br<lo||bl>hi)continue;
      if(y>b.y+2||y<b.y-b.img.h-u*.2)continue;
      ok=false;
    }
    if(ok)cNoBush.push(y);
  }
  /* ならぶ間かくは どうぶつの大きさぶん（u*1.05）はあける。
     せますぎて ならべないときは、しげみをよける条件をはずす（あそび中は しげみの手前に描かれるので かくれない） */
  var MIN=u*(minK||1.25);
  function greedy(list){
    if(list.length<n)return null;
    for(var gap=u*1.5;gap>=MIN;gap*=.9){
      var picked=[list[0]],k;
      for(k=1;k<list.length&&picked.length<n;k++)if(list[k]-picked[picked.length-1]>=gap)picked.push(list[k]);
      if(picked.length>=n){
        var span=picked[n-1]-picked[0],room=(list[list.length-1]-list[0])-span,out=picked.slice(0,n).map(function(y){return y+room/2;});
        if(out.every(function(y){return S.laneOK(y,x0,x1,u,true);}))return out;
        return picked.slice(0,n);
      }
    }
    return null;
  }
  /* まず、つかえる 高さいっぱいに 等間かくで ならべてみる（ぎゅうぎゅうに つめない） */
  function spread(){
    if(n<=0)return null;
    if(n===1)return [(top+bot)/2];
    if((bot-top)/(n-1)<MIN)return null;
    var out=[],i,k;
    for(i=0;i<n;i++){
      var y0=top+(bot-top)*i/(n-1),y=y0,found=S.laneOK(y0,x0,x1,u,true);
      for(var d=1;!found&&d<=12;d++){
        if(S.laneOK(y0+d*u*.18,x0,x1,u,true)){y=y0+d*u*.18;found=true;}
        else if(S.laneOK(y0-d*u*.18,x0,x1,u,true)){y=y0-d*u*.18;found=true;}
      }
      if(!found)return null;
      out.push(y);
    }
    out.sort(function(p2,q2){return p2-q2;});
    for(k=1;k<out.length;k++)if(out[k]-out[k-1]<MIN)return null;
    return out;
  }
  var res=spread()||greedy(cNoBush)||greedy(c);
  if(res)return res;
  /* n本とれないときは、とれるだけ かえす（あまった子は 見るがわに まわる） */
  var src=c.length?c:[top,bot],pick2=[src[0]];
  for(var k2=1;k2<src.length;k2++)if(src[k2]-pick2[pick2.length-1]>=MIN)pick2.push(src[k2]);
  return pick2.slice(0,n);
}
/* ならべる ぶんだけ 参加する。ならべない子は 見るがわへ */
function fitLanes(s,list,x0,x1,u,minK){
  var ys=lanes(list.length,x0,x1,u,minK);
  while(ys.length<list.length&&list.length>2){
    var outA=list.pop(),i=s.m.indexOf(outA);
    if(i>=0)s.m.splice(i,1);
    outA.sess=null;outA.hold=false;outA.face=0;outA.faceLock=false;outA.mult=1;outA.lane=null;
    outA.rest=rand(.2,1);outA.cool=rand(3,6);
  }
  while(ys.length<list.length)ys.push(ys.length?ys[ys.length-1]+u*(minK||1.25):(S.top+S.bottom)/2);
  return ys;
}
/* 何レーンまで ゆったり ならべるか（これより多い人数では あそびを始めない） */
X.laneRoom=function(u,minK){return Math.max(2,Math.floor((S.bottom-S.top-u*2.6)/(u*(minK||1.25)))+1);};
/* ならぶのに 間に合わなかった子。線のすぐ近くなら きっちりそろえ、
   とおくて まにあわない子は あそびから ぬけて 見ているがわにまわる（線より前から スタートしないように） */
function lineUp(s,x,keep){
  s.m.slice().forEach(function(a){
    var gx=(a.startX!=null?a.startX:x);
    if(Math.abs(a.x-gx)<a.u*3.5||a===keep||s.m.length<=2){a.x=gx;if(a.lane!=null)a.y=a.lane;return;}
    var i=s.m.indexOf(a);s.m.splice(i,1);
    if(s.players){var j=s.players.indexOf(a);if(j>=0)s.players.splice(j,1);}
    a.sess=null;a.hold=false;a.face=0;a.faceLock=false;a.mult=1;a.lane=null;a.rest=rand(.3,1);a.cool=rand(4,8);
  });
}
/* ならびがぜんぶ、しげみ・池・文字にかぶらない中心をさがす */
/* maxY＝これより 手前には しない（みんなが 見まもる ブルーシートの ばしょを あけておく） */
function formation(s,u,posFn,maxY){
  var lim=Math.max(S.top+u,Math.min(maxY==null?S.bottom-u:maxY,S.bottom-u));
  var cx=0,cy=0;s.m.forEach(function(a){cx+=a.x;cy+=a.y;});
  var near={x:clamp(cx/s.m.length,S.W*.25,S.W*.75),y:clamp(cy/s.m.length,S.top+u,lim)};
  function ok(c){return c.y<=lim&&posFn(c).every(function(p){return S.clear(p.x,p.y,u);});}
  if(ok(near))return near;
  return S.safeSpot(u,near,ok)||S.safeSpot(u*.8,near,function(c){return c.y<=lim&&posFn(c).every(function(p){return S.clear(p.x,p.y,u*.8);});})||{x:S.W/2,y:Math.min((S.top+S.bottom)/2,lim)};
}

/* ---------------- だるまさんがころんだ ---------------- */
ACT.daruma={
  init:function(s){
    var oni=s.m[0],u=maxU(s.m);
    s.side=oni.x<S.W/2?-1:1;
    s.ox=s.side<0?u*1.5:S.W-u*1.5;
    var sx=s.side<0?S.W-u*1.4:u*1.4;
    s.players=s.m.slice(1);s.caught=[];s.round=0;
    /* いまの 上下の ならび順のまま レーンを わりあてる（すれちがわない）。
       ならべない子は 見るがわへ */
    s.players.sort(function(p,q){return p.y-q.y;});
    /* だるまさんがころんだ は ならぶ間かくを つめ、入りきらないぶんは
       2れつ目（すこし うしろ）に ならんで、たくさん あそべるようにする */
    var rowN=Math.max(1,Math.min(s.players.length,X.laneRoom(u,1.02)));
    var ys=lanes(rowN,s.ox,sx,u,1.02);
    if(!ys.length)ys=[(S.top+S.bottom)/2];
    s.oy=ys.reduce(function(v,y){return v+y;},0)/ys.length;
    go(oni,s.ox,s.oy,1.2);
    s.sx=sx;
    var away=s.side<0?1:-1;
    s.players.forEach(function(p,i){
      var row=i%ys.length,rank=Math.floor(i/ys.length);
      p.lane=ys[row];p.rank=rank;
      p.startX=clamp(sx+away*rank*u*1.7,u*1.2,S.W-u*1.2);
      go(p,p.startX,p.lane,1.5);
    });
    P.say(oni,"わたしが おにね！",1.3);
  },
  update:function(s,dt){
    var oni=s.m[0],u=maxU(s.m),goalX=s.ox-s.side*u*1.1;
    if(s.st===0){
      /* ならび終わった子から、おにの ほうを 向いて まつ（うしろ向きのままに しない） */
      (s.players||[]).forEach(function(p){if(arrived(p)){p.face=-s.side;p.dir=-s.side;}});
      if(allThere(s,null,12)){
        lineUp(s,s.sx,oni);oni.x=s.ox;oni.y=s.oy;
        if(s.players.length<1)return true;
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
        else if(active.length&&Math.random()<.7){
          /* だれも うごかなかった回 */
          P.say(oni,pick(["うごいた子、いないね〜","みんな じょうず〜"]),1.4);
          var safe=pick(active);
          P.later(.9,function(){if(alive(s,safe))P.say(safe,pick(["セーフ…！","ふう…","どきどき した〜"]),1.2);});
        }
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
  var oni=s.m[0],quick=Math.random()<.3,slow=!quick&&Math.random()<.35;
  /* ふりむく まで、はやかったり おそかったり。おなじ リズムに ならないように */
  s.phase="call";s.pt=quick?rand(.7,1.1):slow?rand(2.8,3.6):rand(1.6,2.4);
  oni.face=s.side;oni.dir=s.side;oni.sleep=true;
  P.say(oni,quick?"だるまさんがっ":slow?"だるまさんが〜〜〜":"だるまさんが〜",Math.max(1.2,s.pt));
}
function catchOne(s,p){
  var oni=s.m[0],u=maxU(s.m);
  if(p.caught)return;
  p.wob=.5;P.say(oni,p.sp.name+"、いま うごいた！",1.4);
  /* 言われたら、そのまま おにの よこへ（草原を よこぎって 歩くと 長いので ぱっと 行く） */
  P.later(.4,function(){
    if(!alive(s,p)||p.caught)return;
    p.caught=true;s.caught.push(p);p.shake=0;
    var k=s.caught.length;
    var qx=clamp(s.ox-s.side*u*.2,p.u,S.W-p.u),qy=clamp(s.oy+u*1.2*Math.ceil(k/2)*(k%2?1:-1),S.top,S.bottom);
    p.x=qx;p.y=qy;p.tx=qx;p.ty=qy;p.z=0;p.vz=0;p.mult=1;p.moving=false;p.hold=true;
    p.face=-s.side;p.dir=p.face;
    P.say(p,"つかまった〜",1.2);P.jump(p,2.6);
  });
}

/* ---------------- よーいどん（かけっこ） ---------------- */
ACT.race={
  init:function(s){
    var u=maxU(s.m),cx=0;s.m.forEach(function(a){cx+=a.x;});cx/=s.m.length;
    /* みんながいる側からスタートして、反対側がゴール */
    s.x0=cx<S.W/2?u*1.3:S.W-u*1.3;s.x1=cx<S.W/2?S.W-u*1.3:u*1.3;
    var order=s.m.slice().sort(function(p,q){return p.y-q.y;});
    var ys=fitLanes(s,order,s.x0,s.x1,u);
    order.forEach(function(a,i){a.lane=ys[i];go(a,s.x0,ys[i],1.5);});
    s.order=[];
    var gx=s.x1,top=Math.min.apply(null,ys)-u*.4,bot=Math.max.apply(null,ys)+u*.4;
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
      /* スタートに ついた子から、ゴールの ほうを 向いて まつ（うしろ向きのままに しない） */
      s.m.forEach(function(a){if(arrived(a)){a.face=dirX;a.dir=dirX;}});
      if(allThere(s,null,12)){
        lineUp(s,s.x0);
        if(s.m.length<2)return true;
        s.m.forEach(function(a){a.hold=true;a.face=dirX;a.dir=dirX;});next(s);}
      return;
    }
    if(s.st===1){
      var caller=s.m[0];
      if(s.tt>.4&&once(s,"c1"))P.say(caller,"いちについて…",1);
      if(s.tt>1.5&&once(s,"c2"))P.say(caller,"よーい…",.9);
      if(s.tt>2.5&&once(s,"c3")){
        P.say(caller,"どん！",.9);
        /* どうぶつによる はやさの ちがいは なくし、その回の「ちから」だけで きまる */
        /* 体の大きさで はやさが 変わらないように そろえる（その回の「ちから」だけで きまる） */
        var bu=maxU(s.m);
        s.m.forEach(function(a){
          /* ぴょんぴょん とぶ子は とんでいる あいだしか すすまないので、そのぶん 足す */
          var hop=a.sp.motion==="hop"?1.34:1;
          a.hold=false;a.even=rand(.97,1.05);a.spd=1.9*(bu/a.u)*hop;a.dash=0;
        });
        /* 「本気！」は 毎回では ない（半分くらいの レース）。出るときは ビリの子だけ */
        s.spurtAt=rand(2.5,5);s.spurted=Math.random()<.45;
        /* とちゅうの ドラマ：先頭が つかれる／ころぶ */
        s.tiredAt=rand(1.8,3.4);s.tired=false;
        s.tripAt=rand(2.2,4.2);s.tripped=Math.random()<.65;   /* true＝ころばない */
        next(s);
      }
      return;
    }
    if(s.st===2){
      /* とちゅうから 本気を出す子が いる */
      if(!s.spurted&&s.tt>s.spurtAt){
        s.spurted=true;
        /* 本気を出すのは、いちばん おくれている子だけ */
        var run=s.m.filter(function(a){return !a.done;});
        var who=run.slice().sort(function(p2,q2){return (p2.x-s.x0)*dirX-(q2.x-s.x0)*dirX;})[0];
        if(who){who.dash=rand(.9,1.3);P.say(who,pick(["ここからが 本気！","ラストスパート！"]),1.4);P.note(who.x,P.headY(who)-6,"ビューン","#E9A93B");}
      }
      /* いちばん前の子と、コースの どのあたりかを 見る */
      var lead=-1e9,leadA=null;
      s.m.forEach(function(a){if(!a.done){var pr=(a.x-s.x0)*dirX;if(pr>lead){lead=pr;leadA=a;}}});
      var total=Math.abs(s.x1-s.x0)||1,frac=lead/total;
      /* 先頭が つかれて ペースダウン（ぬかれる きっかけ） */
      if(!s.tired&&s.tt>s.tiredAt&&frac<.62&&leadA){
        s.tired=true;leadA.slow=rand(1.1,1.6);
        P.say(leadA,pick(["はあ、つかれた〜","ちょっと ペースダウン…"]),1.4);
      }
      /* たまに 先頭が ころぶ */
      if(!s.tripped&&s.tt>s.tripAt&&frac<.72&&leadA){
        s.tripped=true;leadA.trip=.8;P.say(leadA,"わっ、ころんじゃった〜",1.4);P.jump(leadA,1.6);
      }
      s.m.forEach(function(a){
        if(a.done)return;
        a.boost=Math.max(0,(a.boost||0)-dt);
        a.slow=Math.max(0,(a.slow||0)-dt);
        if(a.trip>0){a.trip-=dt;a.hold=true;a.shake=Math.sin(P.now*40)*a.u*.05;if(a.trip<=0){a.hold=false;a.shake=0;}return;}
        /* 前半は 大きく はなれない。おわりの ほうは 追いつく力を ゆるめて、
           1着が はっきり わかる ように 差を つける */
        var near=frac<.68?1:.04;
        var chase=1+Math.min(.22,Math.max(0,(lead-(a.x-s.x0)*dirX)/a.u)*.06)*near;
        var kick=(a===leadA&&frac>=.68)?1.2:1;
        go(a,s.x1+dirX*a.u*.6,a.lane,a.spd*chase*kick*(a.boost>0?1.5:1)*(a.slow>0?.72:1));
        if((a.x-s.x1)*dirX>-a.u*.06){
          a.done=true;a.hold=true;s.order.push(a);
          var place=s.order.length;
          if(place===1){P.say(a,"いちばん！",1.4);P.jump(a,4.6);P.note(a.x,P.headY(a)-8,"★","#E9A93B");}
          else if(place===2)P.say(a,"2ばん！",1.1);
          else P.say(a,pick(["ゴール！","ついた〜"]),1.1);
        }
      });
      if(s.m.every(function(a){return a.done;})||s.tt>20){
        s.m.forEach(function(a){a.hold=true;});
        s.winner=s.order[0]||s.m[0];next(s);}
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
    /* いま 左にいる子は 左チーム。まん中に近い子から ならぶ（すれちがわない） */
    var byX=s.m.slice().sort(function(p,q){return p.x-q.x;});
    s.L=byX.slice(0,half).reverse();s.R=byX.slice(half);s.o=0;
    /* つなの長さ（＝ならぶ間かく）は どうぶつの大きさから決める。せまいボードでは 少しつめる */
    var room=S.W*.44/u,inner=1.35;
    s.gap=half>1?clamp((room-inner)/(half-1),1.5,2):2;
    function base(team,i,c){return c.x+(team==="L"?-1:1)*(inner*u+i*s.gap*u);}
    function pos(c){return s.L.map(function(a,i){return {x:base("L",i,c),y:c.y};}).concat(s.R.map(function(a,i){return {x:base("R",i,c),y:c.y};}));}
    /* つなひきは 見まもる子の ブルーシートの 手前の帯を あけて、すこし おくで する */
    s.c=formation(s,u,pos,S.bottom-u*3.2);s.base=base;
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
    /* ほとんど その場のときは ゆっくり（あしが 高速で うごいて見えないように）。
       つなに 引っぱられて はなれたときだけ、はやく ついていく */
    function track(mult){
      function one(team,i,a){var x=s.base(team,i,c)+s.o;go(a,x,c.y,Math.abs(x-a.x)>a.u*.7?2.2:mult);}
      s.L.forEach(function(a,i){one("L",i,a);});
      s.R.forEach(function(a,i){one("R",i,a);});
    }
    if(s.st===0){
      if(allThere(s,null,9)){
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
      /* 4〜5回に1回くらいは ひきわけ。ひきわけの回は つなの目じるしを 白いせんまで もどしてから 決める */
      if(s.wave==null){s.wave=rand(0,PI*2);s.lean=pick([-1,1])*rand(.25,.45);s.tie=Math.random()<.22;s.tieAt=rand(6.5,9.5);}
      var force=power(s.R)-power(s.L);
      var settling=(s.tie&&s.tt>s.tieAt)||s.tt>16;
      /* 逆転：おされている チームが 本気を出して ぐいっと 引きもどす */
      if(!settling){
        s.rallyT=(s.rallyT==null?rand(5,8):s.rallyT)-dt;
        if(s.rallyT<=0){
          s.rallyT=rand(6,9);
          var losing=s.o>0?s.L:s.R;
          if(Math.abs(s.o)>u*.7&&!s.rally&&(s.rallies||0)<1&&Math.random()<.6){
            s.rallies=(s.rallies||0)+1;
            s.rally={team:losing,t:rand(2.2,3)};
            P.say(losing[0],pick(["ここからだ〜！","まだまだ〜！","いっせーの、それ！"]),1.5);
            P.note(losing[0].x,P.headY(losing[0])-8,"ぐぐぐ…","#E9A93B");
            var other=losing===s.L?s.R:s.L;
            P.later(.9,function(){if(alive(s,other[0]))P.say(other[0],pick(["おっとっと！","まけないぞ〜！","うわ、つよい！"]),1.3);});
          }
        }
        if(s.rally){
          s.rally.t-=dt;
          s.o+=(s.rally.team===s.L?-1:1)*u*1.2*dt;
          s.m.forEach(function(a){a.shake=Math.sin(P.now*26+a.seed)*a.u*.05;});
          if(s.rally.t<=0)s.rally=null;
        }
      }
      if(settling){
        s.o+=(-s.o*2+force*u*.1)*dt;
        if(once(s,"even"))P.note(s.c.x,s.c.y-u*1.15,"まんなか！",AD.INK);
      }else{
        /* なかなか決まらないときは だんだん かたむきを強くして 決着をつける */
        var push=s.tt>9?(s.tt-9)*.8:0;
        s.o+=(force*u*.9+(Math.sin(s.t*.8+s.wave)*.42+s.lean*(1+push))*u*.55)*dt;
      }
      /* つなを 引いている間は ほとんど その場なので、あしが 高速で うごいて見えないよう ゆっくりめに */
      track(1.25);
      s.m.forEach(function(a){a.shake=Math.sin(P.now*18+a.seed)*a.u*.03;});
      s.chantT-=dt;
      if(s.chantT<=0){
        s.chantT=.75;s.chantSide^=1;var team=s.chantSide?s.R:s.L,tx=team.reduce(function(v,a){return v+a.x;},0)/team.length;
        P.note(tx,P.headY(team[0])-6,"よいしょ",AD.INK);
      }
      var tieNow=settling&&(Math.abs(s.o)<u*.06||s.tt>18);
      if((!settling&&Math.abs(s.o)>u*1.9)||tieNow){
        if(tieNow)s.o=0;
        s.m.forEach(function(a){a.shake=0;a.hold=true;});
        if(!tieNow){
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

/* ---------------- ふえおに（つかまった子も おにに なる） ---------------- */
/* ふえおに：おにが まだ とおいときに、広くて ほかの子も いない ばしょを さがす */
var ONI_SEC=30;   /* ふえおに の じかん */
function openSpot(r,rs,c){
  var best=null,bs=-1e9;
  for(var i=0;i<14;i++){
    var q={x:rand(r.u*1.6,S.W-r.u*1.6),y:rand(S.top+r.u*.4,S.bottom-r.u*.3)};
    if(!S.clear(q.x,q.y,r.u))continue;
    var sc=Math.min(AD.dist(q,c),r.u*9)*.8;
    rs.forEach(function(w){if(w!==r)sc+=Math.min(AD.dist(q,w),r.u*5)*.55;});
    sc-=Math.abs(q.x-S.W/2)*.28;
    sc-=AD.dist(q,r)*.35;
    if(sc>bs){bs=sc;best=q;}
  }
  return best||P.roomySpot(r);
}
ACT.oni={
  init:function(s){
    var oni=s.m[0];
    s.onis=[oni];s.rs=s.m.slice(1);
    /* どうぶつごとの はやさの ちがいは なくして、その回の「ちから」で きまる */
    s.m.forEach(function(a){a.even=rand(.92,1.1);});
    s.spurtT=rand(6,10);
    oni.hold=true;oni.sleep=true;
    /* にげる子は 草原じゅうに ちらばる（みんなで はしっこに かたまらない） */
    var away=oni.x<S.W/2?1:-1,nrs=s.rs.length;
    s.rs.forEach(function(r,i){
      var fx=clamp(S.W*.5+away*S.W*.22+(i-(nrs-1)/2)*r.u*2.6,r.u*1.6,S.W-r.u*1.6);
      var fy=clamp(S.top+(S.bottom-S.top)*((i%3)+.5)/3,S.top+r.u*.4,S.bottom-r.u*.3);
      var q=S.clear(fx,fy,r.u)?{x:fx,y:fy}:(S.safeSpot(r.u,{x:fx,y:fy})||P.roomySpot(r));
      go(r,q.x,q.y,1.5);
    });
    P.say(oni,"わたしが おにね！ かぞえるよ〜",1.6);
    s.count=3.4;
    /* どの子が おに なのか わかるように、あたまの上に しるしを出す */
    addProp(s,{y:1e9,draw:function(g){if(P.sessions.indexOf(s)>=0)s.onis.forEach(function(c){X.oniMark(g,c);});}});
    /* のこり時間を 草原の上に 出す */
    addProp(s,{y:1e9,draw:function(g){
      if(P.sessions.indexOf(s)<0||s.st>1)return;
      var left=Math.max(0,Math.ceil(ONI_SEC-s.t));
      var fs=Math.round(clamp(P.U*.55,13,22)),txt="のこり "+left+"びょう";
      g.save();
      g.font="700 "+fs+"px 'Zen Maru Gothic',sans-serif";g.textAlign="center";g.textBaseline="middle";
      var bw=g.measureText(txt).width+fs*1.3,bh=fs*1.8,x=S.W/2,y=S.top+bh*.72,hot=left<=10;
      g.fillStyle=hot?"rgba(239,107,94,.94)":"rgba(255,255,255,.92)";
      g.strokeStyle="rgba(58,44,36,.25)";g.lineWidth=1.2;
      var rx=x-bw/2,ry=y-bh/2,r=bh/2;
      g.beginPath();
      g.moveTo(rx+r,ry);g.lineTo(rx+bw-r,ry);g.arc(rx+bw-r,ry+r,r,-PI/2,PI/2);
      g.lineTo(rx+r,ry+bh);g.arc(rx+r,ry+r,r,PI/2,PI*1.5);g.closePath();
      g.fill();g.stroke();
      g.fillStyle=hot?"#FFFFFF":"#123F63";g.fillText(txt,x,y+fs*.05);
      g.restore();
    }});
  },
  update:function(s,dt){
    var oni0=s.onis[0];
    s.rs=s.rs.filter(function(a){return alive(s,a);});
    s.onis=s.onis.filter(function(a){return alive(s,a);});
    if(!s.onis.length||!s.rs.length&&s.st<2){if(!s.onis.length)return true;}
    if(s.st===0){
      s.count-=dt;
      if(s.count<2.2&&once(s,"c1"))P.say(oni0,"いーち、にーい…",1.4);
      if(s.count<=0){
        oni0.sleep=false;oni0.hold=false;oni0.face=0;
        P.say(oni0,"いくぞ〜！",1.2);
        var r0=pick(s.rs);if(r0)P.later(.4,function(){if(alive(s,r0))P.say(r0,"にげろ〜！",1.3);});
        s.talkT=2.5;next(s);
      }
      return;
    }
    if(s.st===1){
      /* おには できるだけ ちがう子を おいかける（だんごに ならないように） */
      if(!s.aimT||P.now>s.aimT||s.onis.some(function(c){return !c.aim||s.rs.indexOf(c.aim)<0;})){
        s.aimT=P.now+rand(1.4,2.4);
        var free=s.rs.slice();
        s.onis.slice().sort(function(p,q){
          var dp=Math.min.apply(null,s.rs.map(function(r){return AD.dist(p,r);}).concat([1e9]));
          var dq=Math.min.apply(null,s.rs.map(function(r){return AD.dist(q,r);}).concat([1e9]));
          return dp-dq;
        }).forEach(function(c){
          var pool=free.length?free:s.rs;
          var t=pool.slice().sort(function(p,q){return AD.dist(c,p)-AD.dist(c,q);})[0];
          c.aim=t||null;
          var i=free.indexOf(t);if(i>=0)free.splice(i,1);
        });
        /* おいつめている おにが いたら、いちばん ひまな おにが その子の うらに まわりこむ */
        if(s.onis.length>=2&&s.rs.length>=1){
          var hot=s.onis.filter(function(c){return c.aim;})
            .sort(function(p,q){return AD.dist(p,p.aim)-AD.dist(q,q.aim);})[0];
          var idle=s.onis.filter(function(c){return c!==hot;})
            .sort(function(p,q){return (q.aim?AD.dist(q,q.aim):1e9)-(p.aim?AD.dist(p,p.aim):1e9);})[0];
          if(hot&&idle&&AD.dist(hot,hot.aim)<hot.u*8&&
             (!idle.aim||AD.dist(idle,idle.aim)>AD.dist(hot,hot.aim)*1.3))idle.aim=hot.aim;
        }
      }
      /* おには 自分の あいてを おいかける。つかまった子も おにに なる */
      s.onis.forEach(function(c){
        c.hold=(c.freeze||0)>0;c.freeze=Math.max(0,(c.freeze||0)-dt);
        if(c.hold)return;
        /* わりあては 下でまとめて きめる */
        var t=c.aim;
        if(t){
          c.face=0;
          /* おに同士が かたまらないよう、ほかの おにから はなれる ぶんを 足す */
          var px=0,py=0;
          s.onis.forEach(function(o){
            if(o===c)return;
            var ox=c.x-o.x,oy=(c.y-o.y)*1.4,od=Math.hypot(ox,oy)||1,R=(c.u+o.u)*1.5;
            if(od<R){px+=ox/od*(R-od)*.9;py+=oy/od*(R-od)*.45;}
          });
          /* おなじ子を おいかける ときは、ひとりは まっすぐ、ほかは 先まわり（うらを かく） */
          var same=s.onis.filter(function(o){return o.aim===t;}),k=same.indexOf(c),gx=t.x,gy=t.y;
          var hx2=(t.tx==null?0:t.tx-t.x),hy2=(t.ty==null?0:t.ty-t.y),hl2=Math.hypot(hx2,hy2);
          if(hl2>1){hx2/=hl2;hy2/=hl2;}else{hx2=0;hy2=0;}
          if(k>0){
            var wall=Math.min(t.x,S.W-t.x);
            if(wall<t.u*3.6){
              /* はしに おいつめられている子の 「もどり道」を ふさぐ（うらを とる） */
              var into=t.x<S.W/2?1:-1;
              gx=clamp(t.x+into*t.u*(2+k*.8),c.u,S.W-c.u);
              gy=clamp(t.y+(c.y>t.y?1:-1)*t.u*.5,S.top,S.bottom);
            }else{
              /* にげる先に まわりこむ */
              var lead=t.u*(1.6+k*1.2);
              gx=clamp(t.x+hx2*lead,c.u,S.W-c.u);gy=clamp(t.y+hy2*lead*.6,S.top,S.bottom);
            }
          }else if(hl2>1&&AD.dist(c,t)>(c.u+t.u)*1.6){
            /* ひとりのときも すこしだけ 先を よむ */
            gx=clamp(t.x+hx2*t.u*.9,c.u,S.W-c.u);gy=clamp(t.y+hy2*t.u*.5,S.top,S.bottom);
          }
          /* すぐ となりに ほかの おにが いるときは、まず はなれる */
          var nearO=null,nd=1e9;
          s.onis.forEach(function(o){if(o===c)return;var d2=AD.dist(c,o);if(d2<nd){nd=d2;nearO=o;}});
          if(nearO&&nd<(c.u+nearO.u)*.95){
            var ax2=c.x-nearO.x,ay2=(c.y-nearO.y)*1.3,al=Math.hypot(ax2,ay2)||1;
            go(c,c.x+ax2/al*c.u*2.2,c.y+ay2/al*c.u*1.1,1.5);
          }else go(c,gx+px,gy+py,1.58);
        }
        /* おいかけている子だけでなく、すぐそばに 来た子は だれでも タッチ
           （体が かさなるほど 近づいたら、まだ はやくても タッチしたことにする） */
        s.rs.slice().forEach(function(r){
          /* 体が ふれるくらい 近づいたら タッチ */
          var reach=Math.hypot(c.x-r.x,(c.y-r.y)*1.5);
          if(reach<(c.u+r.u)*.78&&(s.tt>1.2||reach<(c.u+r.u)*.6))catchIt(s,c,r);
        });
      });
      /* にげる子は いちばん近い おにから はなれる */
      s.rs.forEach(function(r){
        var c=s.onis.slice().sort(function(p,q){return AD.dist(r,p)-AD.dist(r,q);})[0];
        if(!c)return;
        r.hold=false;r.face=0;
        /* おにが まだ とおいうちは、にげずに 広いところへ 歩いて ようすを見る
           （みんなで 遠くの はしっこに かたまらない） */
        if(AD.dist(r,c)>r.u*7.5){
          r.watchT=(r.watchT||0)-dt;
          if(!r.watchP||r.watchT<=0||Math.hypot(r.watchP.x-r.x,r.watchP.y-r.y)<r.u*.7){
            r.watchP=openSpot(r,s.rs,c);r.watchT=rand(1.8,2.8);
          }
          r.fleeP=null;go(r,r.watchP.x,r.watchP.y,1.06);
          return;
        }
        r.watchP=null;
        r.fleeT=(r.fleeT||0)-dt;
        var G=r.fleeP;
        if(!G||r.fleeT<=0||Math.hypot(G.x-r.x,G.y-r.y)<r.u*.6||!S.clear(G.x,G.y,r.u)||
           Math.hypot(G.x-c.x,G.y-c.y)<Math.hypot(G.x-r.x,G.y-r.y)*.9){
          r.fleeP=X.fleeFrom(r,c,s.rs)||r.fleeP;r.fleeT=rand(.9,1.4);
        }
        /* さいごのほうは にげる子が つかれてくる */
        if(r.fleeP)go(r,r.fleeP.x,r.fleeP.y,s.t>26?1.36:1.42);
      });
      /* ときどき だれかが きゅうに 本気を出す */
      s.spurtT-=dt;
      if(s.spurtT<=0){
        s.spurtT=rand(7,12);
        var pool=(Math.random()<.5?s.rs:s.onis).filter(function(a){return !(a.freeze>0);});
        var who2=pick(pool);
        if(who2){
          who2.burst=rand(2.4,3.6);
          P.say(who2,s.rs.indexOf(who2)>=0?pick(["本気で にげる〜！","まだ つかまらないよ！"]):pick(["ここからが 本気！","スピード アップ！"]),1.4);
          P.note(who2.x,P.headY(who2)-6,"ビューン","#E9A93B");
        }
      }
      /* のこり時間を にげる子が 知らせる */
      var left2=Math.ceil(ONI_SEC-s.t);
      if(left2<=10&&s.rs.length&&once(s,"left10")){P.say(pick(s.rs),"のこり 10びょう！",1.5);s.talkT=Math.max(s.talkT,1.6);}
      if(left2<=5&&s.rs.length&&once(s,"left5")){P.say(pick(s.rs),"あと 5びょう、にげきるぞ〜！",1.5);s.talkT=Math.max(s.talkT,1.6);}
      s.talkT-=dt;
      if(s.talkT<0){
        s.talkT=rand(2,3.2);
        if(Math.random()<.5&&s.rs.length)P.say(pick(s.rs),pick(["にげろ〜","こっちだよ〜","つかまらないぞ〜"]),1.2);
        else P.say(pick(s.onis),pick(["まてまて〜","つかまえるぞ〜","そっちに いった！"]),1.2);
      }
      if(s.rs.length<=1||s.t>ONI_SEC){
        s.m.forEach(function(a){a.hold=true;a.aim=null;});
        var last=s.rs[0];
        if(last){P.say(last,"さいごまで にげきった〜！",1.6);P.jump(last,4.6);
          P.later(.7,function(){if(alive(s,oni0))P.say(oni0,"つよいなあ〜",1.3);});}
        else{P.say(oni0,"みんな つかまえた！",1.5);s.onis.forEach(function(c){P.jump(c,3.4);});}
        s.win=last;next(s);
      }
      return;
    }
    if(s.st===2){
      if(s.tt>1.4&&once(s,"face"))s.m.forEach(function(a){a.hold=false;a.rest=rand(.3,1);});
      return goodbye(s,s.win||oni0,s.win?oni0:(s.rs[0]||s.m[1]),s.tt,2.2);
    }
  },
  tap:function(s,a){
    if(s.st===0){tapLine(a,"oni0",["ふえおに するよ〜","どこに にげよう…"]);return;}
    if(s.st===2){tapLine(a,"oniEnd",s.win===a?["にげきった〜！","はやいでしょ？"]:["いっぱい はしった〜","つぎは つかまらないぞ"]);return;}
    if(s.onis.indexOf(a)>=0){
      tapLine(a,"oniC",["まてまて〜！","じゃましないで〜","つかまえるぞ〜"]);
      if(fx(s,1.4)){a.freeze=.9;P.jump(a,3);}
      return;
    }
    tapLine(a,"oniR",["わっ、びっくりした！","あぶない、あぶない！","いまのうち〜"]);
    P.jump(a,3.4);
  }
};

/* ふえおに：つかまえた子を おにに する */
function catchIt(s,c,t){
  var i=s.rs.indexOf(t);if(i<0)return;
  s.rs.splice(i,1);s.onis.push(t);
  s.aimT=0;                       /* つかまえたら すぐ おいかける あいてを 決めなおす */
  t.freeze=1.2;t.hold=true;t.aim=null;t.fleeP=null;
  faceTo(c,t);P.say(c,"タッチ！",1.1);P.jump(c,3.4);
  P.later(.5,function(){if(alive(s,t))P.say(t,pick(["つかまった〜、おにに なっちゃった","いっしょに おにだ〜"]),1.5);});
}
/* みんなであそぶ あそびの一覧（4ひき以上いるときに えらばれる） */
X.GROUP={daruma:{max:9,weight:1.2,lanes:true,minK:1.02,ranks:2},race:{max:7,weight:1.2,lanes:true},tug:{max:8,weight:1,even:true},oni:{max:8,weight:1.4}};
X.AFTER.daruma=["そーっと うごくの、むずかしい","ころんだ！って ドキッとした","つぎは おにを やりたいな"];
X.AFTER.race=["いっぱい はしった〜","つぎは もっと はやく はしるぞ","あしが まだ はしってる"];
X.AFTER.tug=["うでが つかれた〜","よいしょ、よいしょ、したね","つぎは ぜったい かつぞ"];
X.AFTER.oni=["おにが どんどん ふえた〜","にげるの、どきどきした","つぎは さいごまで にげきるぞ"];
})();
