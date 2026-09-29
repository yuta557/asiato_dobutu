/* 入力（なぞる形・タップの回数）・足あと・自動デモ・図鑑・ループ */
(function(){
"use strict";
var AD=window.AD,S=AD.scene,P=AD.play,X=AD.acts,PI=Math.PI,clamp=AD.clamp,pick=AD.pick;
var board=document.getElementById("board"),stage=document.getElementById("stage"),cv=document.getElementById("zoo");
var curEl=document.getElementById("democursor"),tipText=document.getElementById("tipText");
var ctx=cv.getContext("2d");
var W=0,H=0,pu=10,footP=null;
var strokes=[],met={},demoStopped=P.reduced,lastUser=-1e9,tipIsDemo=false;
var uw={st:null,last:null,t:0},dw={st:null,last:null,t:0};
var SPK={};AD.SPECIES.forEach(function(s){SPK[s.key]=s;});

/* ---- どの動きで、どのどうぶつ ---- */
var BY_SHAPE={line:"foot0",zigzag:"foot1",circle:"foot3",triangle:"foot4",square:"foot2",spiral:"foot5"};
var BY_TAPS={1:"hand3",2:"hand5",3:"hand4",4:"hand0",5:"hand2"},LONG="hand1",MAX_TAPS=5;
var RECIPE={foot0:"まっすぐ",foot1:"ギザギザ",foot3:"まる",foot4:"さんかく",foot2:"しかく",foot5:"ぐるぐる",
  hand3:"1回タップ",hand5:"2回タップ",hand4:"3回タップ",hand0:"4回タップ",hand2:"5回タップ",hand1:"ながおし"};
/* 上の段：ヒヨコ・ネコ・ゾウ・クマ・ウサギ・コアラ */
var ORDER=["foot0","foot4","foot2","foot3","foot1","foot5","hand3","hand5","hand4","hand0","hand2","hand1"];
var TIP0='<span class="tip-pc">ドラッグでなぞる形や、クリックの回数で、うまれるどうぶつが変わるよ</span><span class="tip-sp">指でなぞる形や、タップの回数で、うまれるどうぶつが変わるよ</span>';

/* 背景は うごかないので、どうぶつとは べつの絵（うしろのキャンバス）に一度だけ描く */
var bgCv=document.getElementById("zoo-bg");
if(bgCv){S.bg=bgCv;S.bgIsLayer=true;}

/* ---- 描くこまかさ（自動調整）----
   重さの原因は計算ではなく「絵をぬる量」だったので、ぬる点の数をへらす。
   はじめは 1.5ばい まで（2ばいの画面なら、ぬる点が 約4わり へる）。
   それでも重いときは 1.25 → 1 と下げる。下げても軽くならなければ（ブラウザ側で おそくなっているだけなので）もとにもどす */
var Q={levels:[],i:0,start:0,win:[],evalAt:0,probe:null,blockLower:0,blockRaise:0,smooth:0};
(function(){
  var dev=Math.min(2,window.devicePixelRatio||1);
  Q.levels=[dev];[1.5,1.25,1].forEach(function(v){if(v<dev-.01)Q.levels.push(v);});
  for(var i=0;i<Q.levels.length;i++){if(Q.levels[i]<=1.5+1e-6){Q.i=i;break;}}
  Q.start=Q.i;
})();
function boardDpr(){return Q.levels[Q.i];}
function applyQuality(){sizeAll();updateTextRects();Q.win=[];Q.evalAt=performance.now()+2500;}
function watchQuality(gap){
  var t=performance.now();
  if(gap>400){Q.win=[];Q.evalAt=t+2500;return;}   /* タブを切りかえた など */
  Q.win.push(gap);
  if(t<Q.evalAt||Q.win.length<20)return;
  var s=Q.win.slice().sort(function(a,b){return a-b;}),m=s[Math.floor(s.length/2)];
  Q.win=[];Q.evalAt=t+2500;
  if(Q.probe){
    if(m<Q.probe.m*.8){Q.probe=null;}
    else{Q.i=Q.probe.i;Q.probe=null;Q.blockLower=t+30000;applyQuality();}
    return;
  }
  if(m>24&&Q.i<Q.levels.length-1&&t>Q.blockLower){
    if(Q.raised)Q.blockRaise=t+60000;
    Q.raised=false;Q.probe={i:Q.i,m:m};Q.i++;Q.smooth=0;applyQuality();return;
  }
  if(m<18){Q.smooth+=2.5;if(Q.smooth>=15&&Q.i>Q.start&&t>Q.blockRaise){Q.i--;Q.smooth=0;Q.raised=true;applyQuality();}}
  else Q.smooth=0;
}
AD.quality=Q;

function sizeAll(){
  var r=stage.getBoundingClientRect(),oW=S.W,oH=S.H;
  W=Math.max(300,r.width);H=Math.max(300,r.height);AD.R=boardDpr();
  cv.width=Math.round(W*AD.R);cv.height=Math.round(H*AD.R);ctx.setTransform(AD.R,0,0,AD.R,0,0);ctx.__pats=null;
  S.build(W,H,AD.R);
  P.U=clamp(Math.min(W,H)*.072,24,110);pu=P.U*.34;footP=AD.footPath(pu);
  P.setCapacity();if(P.animals.length)P.trim();
  if(oW&&oH&&(oW!==W||oH!==H))P.animals.forEach(function(a){a.x=a.x/oW*W;a.y=clamp(a.y/oH*H,S.top,S.bottom);a.tx=a.x;a.ty=a.y;});
}
/* 案内の文字の位置（どうぶつがあそぶ場所からよける） */
var tipEl=document.querySelector(".tip"),rectT=0;
/* 案内の ふきだしは、なんども うんで なんども さわったら、もう じゃまなので 消す */
var madeN=0,tapN=0,tipOff=false;
function maybeHideTip(){
  if(tipOff||madeN<3||tapN<3)return;
  tipOff=true;
  tipEl.style.display="none";
  board.classList.remove("hint");
  S.textRects=[];
}
function updateTextRects(){
  if(tipOff){S.textRects=[];return;}
  var s=stage.getBoundingClientRect(),r=tipEl.getBoundingClientRect(),pad=10;
  /* スマホでは案内が草原の下に出るので、よける必要はない */
  if(r.top>=s.bottom-1){S.textRects=[];return;}
  S.textRects=[{l:r.left-s.left-pad,r:r.right-s.left+pad,t:r.top-s.top-pad,b:r.bottom-s.top+pad}];
}
/* kind："base"＝ふつうの案内、"guide"＝動きなし設定での最初の一手、それ以外＝その場のお知らせ */
var tipKind="base";
function setTip(html,isDemo,kind){if(tipOff)return;tipText.innerHTML=html;tipIsDemo=!!isDemo;tipKind=kind||(html===TIP0?"base":"note");}

/* ---- 動きなし設定（自動デモを流さない）ときの、動かない導線 ----
   最初のどうぶつをうむまで、具体的な最初の一手を 数秒おきに差しかえて見せる */
var GUIDES=[
  '<span class="tip-pc">まずは「さんかく」を ドラッグでなぞってみよう</span><span class="tip-sp">まずは「さんかく」を 指でなぞってみよう</span>',
  '<span class="tip-pc">草原を「1回クリック」してみよう</span><span class="tip-sp">草原を「1回タップ」してみよう</span>',
  '<span class="tip-pc">「まる」をなぞったり、「2回クリック」したりしてもいいよ</span><span class="tip-sp">「まる」をなぞったり、「2回タップ」したりしてもいいよ</span>'
];
var userMade=false,guideI=-1,guideT=2.5;
function staticGuide(dt){
  if(userMade)return;
  if(tipKind!=="base"&&tipKind!=="guide")return;
  if(down||P.now-lastUser<4)return;
  guideT-=dt;if(guideT>0)return;
  guideI=(guideI+1)%GUIDES.length;guideT=5;
  setTip(GUIDES[guideI],false,"guide");
}

/* ---- 足あと ---- */
function newStroke(demo){var st={prints:[],pts:[],col:AD.PENDING_COLOR,state:"live",demo:demo,t0:0,born:false};strokes.push(st);return st;}
function addPrint(st,x,y,ang){
  var side=st.prints.length%2?1:-1,perp=ang+PI/2;
  st.prints.push({x:x+Math.cos(perp)*side*pu*.45,y:y+Math.sin(perp)*side*pu*.45,rot:ang+PI/2,mir:side,born:P.now,spin:(Math.random()-.5)*2.4});
}
function walk(w,p,demo){
  w.t=P.now;
  if(!w.st){w.st=newStroke(demo);w.last={x:p.x,y:p.y};w.st.pts.push({x:p.x,y:p.y});return;}
  if(w.st.pts.length<3000)w.st.pts.push({x:p.x,y:p.y});
  var step=pu*2.3,d=AD.dist(p,w.last),guard=0;
  while(d>=step&&guard++<8){
    var ang=Math.atan2(p.y-w.last.y,p.x-w.last.x);
    w.last={x:w.last.x+Math.cos(ang)*step,y:w.last.y+Math.sin(ang)*step};
    if(w.st.prints.length<90)addPrint(w.st,w.last.x,w.last.y,ang);
    d=AD.dist(p,w.last);
  }
  if(guard>=8)w.last={x:p.x,y:p.y};
}
function finish(w){
  var st=w.st;w.st=null;w.last=null;
  if(!st||st.state!=="live")return;
  var n=st.prints.length,shape=n>=4?AD.shapeOf(st.pts):null;
  if(shape){
    var cx=0,cy=0;st.prints.forEach(function(q){cx+=q.x;cy+=q.y;});
    st.cx=cx/n;st.cy=cy/n;st.state="gather";st.t0=P.now+.35;
    st.sp=SPK[BY_SHAPE[shape]];st.col=st.sp.col;st.recolor=P.now;
    P.note(st.cx,st.cy-P.U*.4,AD.SHAPE_NAME[shape],AD.shade(st.col,.62,1));
  }else if(n===0)strokes.splice(strokes.indexOf(st),1);
  else{st.state="fade";st.t0=P.now;if(!st.demo)setTip("もうすこし長くなぞってみよう — まる・さんかく・ギザギザ…形でどうぶつが変わるよ");}
}
function born(a,byUser,how){
  var first=!met[a.sp.key];met[a.sp.key]=true;
  if(first)markCell(a.sp.key);
  if(byUser){demoStopped=true;if(!userMade)madeAt=P.now;userMade=true;madeN++;
    setTip("「"+how+"」で、"+a.sp.name+"がうまれた！ タップするとあいさつします");maybeHideTip();}
}
function stampHand(p,demo,key){
  var sp=SPK[key],a=P.spawn(sp,p.x,p.y+P.U*.7,"stamp",1);
  born(a,!demo,RECIPE[key]);
  if(demo)setTip("「"+RECIPE[key]+"」で、"+sp.name+"！",true);
}
function drawStrokes(g){
  var now=P.now;
  for(var i=strokes.length-1;i>=0;i--){
    var st=strokes[i],e=0,fade=0;
    if(st.state==="gather"){
      e=clamp((now-st.t0)/.7,0,1);
      if(e>=.62&&!st.born){st.born=true;
        /* 長くなぞるほど大きい（足あと4つで小さめ、18こ以上でいちばん大きい） */
        var grow=.88+.42*clamp((st.prints.length-4)/14,0,1),a=P.spawn(st.sp,st.cx,st.cy+P.U*.9,"gather",grow);
        born(a,!st.demo,RECIPE[st.sp.key]);
        if(st.demo)setTip("「"+RECIPE[st.sp.key]+"」をなぞると、"+st.sp.name+"！",true);}
      if(e>=1){strokes.splice(i,1);continue;}
    }
    if(st.state==="fade"){fade=clamp((now-st.t0-.9)/.9,0,1);if(fade>=1){strokes.splice(i,1);continue;}}
    var pop=st.recolor!=null?clamp((now-st.recolor)/.25,0,1):1;
    for(var k=0;k<st.prints.length;k++){
      var pr=st.prints[k],kk=clamp((now-pr.born)/.14,0,1),x=pr.x,y=pr.y,sc=(1+(1-kk)*.25)*(1+.18*Math.sin(pop*PI)),al=kk*(1-fade),ee=0;
      if(e>0){ee=AD.ease(clamp(e*1.15-k*.006,0,1));x+=(st.cx-x)*ee;y+=(st.cy-y)*ee;sc*=1-.5*ee;al*=1-clamp((e-.5)/.3,0,1);}
      if(al<=0)continue;
      g.save();g.globalAlpha=al;g.translate(x,y);g.rotate(pr.rot+ee*pr.spin);g.scale(pr.mir*sc,sc);
      AD.stamp(g,footP,st.col,pu);g.restore();
    }
  }
}

/* ---- タップの回数・ながおし（実際の時間ではかる） ---- */
var pending=null,ripples=[],TAP_GAP=.45;
function clock(){return performance.now()/1000;}
function tapAt(p,demo){
  if(pending&&AD.dist(p,pending)<P.U*2.2&&clock()-pending.lastUp<TAP_GAP)pending.n++;
  else{if(pending)resolveTaps();pending={x:p.x,y:p.y,n:1,demo:demo};}
  pending.lastUp=clock();
  ripples.push({x:p.x,y:p.y,born:P.now,n:pending.n});
  if(pending.n>=MAX_TAPS)resolveTaps();
}
function resolveTaps(){
  var t=pending;pending=null;if(!t)return;
  stampHand(t,t.demo,BY_TAPS[t.n]);
}
function drawTaps(g){
  var now=P.now,fs=Math.round(clamp(P.U*.55,14,20));
  g.save();g.textAlign="center";g.textBaseline="middle";g.font="700 "+fs+"px 'Zen Maru Gothic',sans-serif";
  for(var i=ripples.length-1;i>=0;i--){
    var r=ripples[i],e=(now-r.born)/.55;if(e>=1){ripples.splice(i,1);continue;}
    g.globalAlpha=1-e;g.strokeStyle="rgba(255,212,59,.95)";g.lineWidth=3;
    g.beginPath();g.arc(r.x,r.y,P.U*(.25+e*.6),0,PI*2);g.stroke();
  }
  if(pending){
    g.globalAlpha=1;var bx=pending.x+P.U*.55,by=pending.y-P.U*.55;
    g.fillStyle="#FFD43B";g.beginPath();g.arc(bx,by,fs*.8,0,PI*2);g.fill();
    g.fillStyle="#123F63";g.fillText(String(pending.n),bx,by+1);
  }
  if(down&&!downMoved&&!downUsed&&!longOff&&!downOnAnimal){
    var h=(clock()-downT-.15)/(LONG_T-.15);
    if(h>0){g.globalAlpha=1;g.strokeStyle="rgba(242,163,183,.95)";g.lineWidth=4;g.lineCap="round";
      g.beginPath();g.arc(downPos.x,downPos.y,P.U*.6,-PI/2,-PI/2+PI*2*clamp(h,0,1));g.stroke();}
  }
  g.restore();
}

/* ---- 自動デモ：さんかくをなぞる → 2回タップ ---- */
var demo={phase:"idle",t0:0,flip:false};
function showCursor(x,y){curEl.style.opacity="1";curEl.style.transform="translate("+x+"px,"+y+"px)";}
function tapCursor(){curEl.classList.remove("tap");void curEl.offsetWidth;curEl.classList.add("tap");}
function abortDemo(){if(dw.st)finish(dw);if(pending&&pending.demo)pending=null;demo.phase="idle";curEl.style.opacity="0";if(tipIsDemo)setTip(TIP0);}
function triPoint(u){
  var V=demo.V,seg=Math.min(2,Math.floor(u*3)),f=u*3-seg,a=V[seg],b=V[(seg+1)%3];
  return {x:a.x+(b.x-a.x)*f,y:a.y+(b.y-a.y)*f};
}
function runDemo(dt){
  /* みんなが 帰っていく あいだは、新しい子を うまない */
  /* オープニングの 絵を だしている あいだは、まだ はじめない */
  if(window.__opening){if(demo.phase!=="idle")abortDemo();return;}
  if(P.bye){if(demo.phase!=="idle")abortDemo();return;}
  /* みんなで 見まもる あそび（だるまさんがころんだ・よーいどん・つなひき）の 間も、
     あたらしい子を うまない（とちゅうから 入ってきて ばらばらに ならないように） */
  if(X.watching&&X.watching()){if(demo.phase!=="idle")abortDemo();return;}
  if(P.reduced){staticGuide(dt||0);return;}
  var now=P.now,el=now-demo.t0;
  if(now-lastUser<=1.8||down){if(demo.phase!=="idle")abortDemo();if(petG.phase!=="idle")petStop(now,true);return;}
  /* 「タップすると こたえてくれる」の 案内（うんだあと、まだ タップして いないとき） */
  if(runPetGuide(now))return;
  /* 最後の「〇〇で、〇〇！」は、どうぶつが増えても見せきってから終える */
  if(demo.phase==="rest"){if(el>4.5){curEl.style.opacity="0";demo.phase="idle";if(tipIsDemo)setTip(TIP0);}return;}
  if(demoStopped||P.animals.length>=Math.max(2,P.MAX-1)){if(demo.phase!=="idle")abortDemo();return;}
  if(demo.phase==="idle"){
    demo.flip=!demo.flip;
    var cx=W*(demo.flip?.3:.7),cy=H*.68,r=Math.min(W,H)*.15;
    demo.V=[{x:cx,y:cy-r},{x:cx+r*1.05,y:cy+r*.75},{x:cx-r*1.05,y:cy+r*.75}];
    demo.phase="walk";demo.t0=now;setTip("「さんかく」をなぞると…",true);return;
  }
  if(demo.phase==="walk"){
    var u=clamp(el/3.2,0,1),p=triPoint(Math.min(u,.999));
    if(u>=1)p=demo.V[0];
    showCursor(p.x,p.y);walk(dw,p,true);
    if(u>=1){finish(dw);demo.phase="wait";demo.t0=now;}
  }else if(demo.phase==="wait"&&el>3){
    /* タップの 回数を かえて、シマウマ（2回）と ウマ（1回）を かわりばんこに 見せる */
    demo.taps=demo.flip?1:2;
    demo.tap={x:W*(demo.flip?.72:.28),y:H*AD.rand(.56,.66)};demo.from=demo.V[0];demo.phase="move";demo.t0=now;
    setTip("「"+demo.taps+"回タップ」すると…",true);
  }else if(demo.phase==="move"){
    var v=AD.ease(clamp(el/.8,0,1));showCursor(demo.from.x+(demo.tap.x-demo.from.x)*v,demo.from.y+(demo.tap.y-demo.from.y)*v);
    if(v>=1){tapCursor();tapAt(demo.tap,true);demo.t0=now;demo.phase=demo.taps===1?"rest":"tap1";}
  }else if(demo.phase==="tap1"&&el>.28){tapCursor();tapAt(demo.tap,true);demo.phase="rest";demo.t0=now;}
}

/* どうぶつを タップしたときの こたえ（ゆびでも、案内のカーソルでも おなじ） */
function tapAnimal(a,fromX){
  /* あそんでいる子は、そのあそびの中だけの反応 */
  if(a.sess&&X.onTap(a))return;
  /* あそびがおわってすぐは、ふりかえりのことば */
  if(X.onTapAfter(a))return;
  /* みんなのあそびを 見まもっている子 */
  if(X.onTapWatch(a))return;
  /* おしゃべり中にタップされたら、話をやめて タップにこたえる */
  if(a.chat&&AD.chat)AD.chat.stop();
  if(a.hidden){P.say(a,"しーっ！",1.1);return;}
  /* 続けてタップしている間は同じあいさつ。間があいたら別のあいさつにする */
  if(!a.tapLine||P.now-a.lastTap>1.6){
    var lines=a.sp.tap.filter(function(s){return s!==a.tapLine;});
    a.tapLine=pick(lines.length?lines:a.sp.tap);
  }
  a.lastTap=P.now;
  P.say(a,a.tapLine,1.5);P.jump(a,4.2);a.dir=fromX<a.x?-1:1;if(!a.sess)a.rest=1.2;
}

/* ---- 「どうぶつを タップすると こたえてくれる」の 案内 ----
   じぶんで どうぶつを うんでから 30びょう たっても、まだ どうぶつを タップして
   いないときに、黄色い カーソルで タップして 見せる */
var tappedAnimal=false,madeAt=-1e9,petG={phase:"idle",t0:0,a:null,from:null,twice:false},petGaveT=-1e9;
function petTarget(){
  var best=null,bd=1e9;
  P.animals.forEach(function(a){
    if(a.hidden||a.leaving||a.age<1.5)return;
    var d=Math.hypot(a.x-W*.5,a.y-H*.55)+(a.sess?W*.3:0);
    if(d<bd){bd=d;best=a;}
  });
  return best;
}
function petPoint(a){return {x:a.x,y:AD.clamp(P.headY(a)+a.u*.9,20,H-20)};}
/* 案内の タップ：ゆびで タップしたときと おなじ わっかを 出して、よく わかるようにする */
function petTap(a,tp){
  tapCursor();
  ripples.push({x:tp.x,y:tp.y,born:P.now,n:1});
  P.note(a.x,P.headY(a)-6,"タップ！","#E9A93B");
  tapAnimal(a,tp.x);
}
function petStop(now,wait){
  petG.phase="idle";petG.a=null;petG.twice=false;
  curEl.classList.remove("guide");
  if(wait)petGaveT=now;
  curEl.style.opacity="0";if(tipIsDemo)setTip(TIP0);
}
function runPetGuide(now){
  if(petG.phase==="idle"){
    if(tappedAnimal||!userMade||P.bye||P.reduced)return false;
    if(now-madeAt<30||now-petGaveT<30)return false;
    var a0=petTarget();if(!a0)return false;
    petG.a=a0;petG.phase="move";petG.t0=now;petG.twice=false;
    curEl.classList.add("guide");
    var p0=petPoint(a0);
    petG.from={x:AD.clamp(p0.x+(p0.x<W/2?-1:1)*W*.14,20,W-20),y:AD.clamp(p0.y-H*.12,20,H-20)};
    setTip("どうぶつを タップすると、おへんじ してくれるよ",true);
    return true;
  }
  var a=petG.a,el=now-petG.t0;
  if(!a||P.animals.indexOf(a)<0||a.leaving){petStop(now,true);return false;}
  var tp=petPoint(a);
  if(petG.phase==="move"){
    var v=AD.ease(clamp(el/.9,0,1));
    showCursor(petG.from.x+(tp.x-petG.from.x)*v,petG.from.y+(tp.y-petG.from.y)*v);
    if(v>=1){petG.phase="tap";petG.t0=now;petTap(a,tp);}
    return true;
  }
  showCursor(tp.x,tp.y);
  if(el>1.1&&!petG.twice){petG.twice=true;petTap(a,tp);}
  if(el>2.8)petStop(now,true);
  return true;
}

/* ---- 入力 ---- */
var down=false,downPos=null,downMoved=false,downT=0,downUsed=false,downOnAnimal=false,downOnBall=false,LONG_T=.6;
/* ながおし：指（マウス）が少しでも動いたら、そのおし方では ながおし にしない。
   ゆっくりなぞりはじめた子が、なぞる前に手形のどうぶつになってしまうのをふせぐ。
   なぞり（足あと）がはじまるのは 8px 動いてから。ながおしのキャンセルは それより手前で決まる */
var downMax=0,longOff=false,downSlop=5,LONG_SLOP_TOUCH=3,LONG_SLOP_MOUSE=2;
function pos(e){var r=cv.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top};}
function touched(){lastUser=P.now;board.classList.remove("hint");board.classList.add("touched");if(demo.phase!=="idle")abortDemo();}
cv.addEventListener("pointerdown",function(e){
  touched();if(uw.st)finish(uw);
  down=true;downPos=pos(e);downMoved=false;downT=clock();downUsed=false;
  downMax=0;longOff=false;downSlop=e.pointerType==="mouse"?LONG_SLOP_MOUSE:LONG_SLOP_TOUCH;
  /* ボールと どうぶつが かさなっているときは、近いほうを えらぶ
     （ボールを だいている子が 押せなくならないように） */
  var hb=pending?null:P.hitBall(downPos),ha=pending?null:P.hit(downPos);
  if(hb&&ha){
    var da=Math.hypot(downPos.x-ha.x,downPos.y-(ha.y-ha.z-ha.u*(ha.sp.hitY||.95)))/(ha.u*1.05);
    var db=Math.hypot(downPos.x-hb.x,downPos.y-(hb.y-hb.r-hb.z))/Math.max(hb.r*2.4,22);
    if(da<=db)hb=null;else ha=null;
  }
  downOnBall=!!hb;downOnAnimal=!!ha;
  try{cv.setPointerCapture(e.pointerId);}catch(err){}
  e.preventDefault();
});
cv.addEventListener("pointermove",function(e){
  if(!down||downUsed)return;
  var p=pos(e),dd=AD.dist(p,downPos);
  if(dd>downMax){downMax=dd;if(downMax>=downSlop)longOff=true;}
  if(!downMoved&&dd>8){downMoved=true;if(pending)resolveTaps();walk(uw,downPos,false);}
  if(downMoved){touched();walk(uw,p,false);}
  e.preventDefault();
});
function up(){
  if(!down)return;down=false;
  if(downUsed)return;
  if(downMoved){finish(uw);return;}
  /* 少し動かしながら しばらくおしていた（なぞろうとしてやめた）ときは、タップにもしない */
  if(longOff&&clock()-downT>.45)return;
  if(downOnBall){var B=P.hitBall(downPos);if(B&&X.onTapBall(B))return;}
  if(downOnAnimal){
    var a=P.hit(downPos);
    if(a){tappedAnimal=true;tapN++;tapAnimal(a,downPos.x);maybeHideTip();return;}
  }
  tapAt(downPos,false);
}
cv.addEventListener("pointerup",up);cv.addEventListener("pointercancel",up);
/* ---- ボードを 全画面に する ----
   ブラウザの 全画面が つかえない とき（iPhone や 埋めこみの 画面）は、
   ページの 上に 画面いっぱいに 広げる やり方に 切りかえる（見た目は おなじ） */
var fsBtn=document.getElementById("fsBtn");
var fsGo=board.requestFullscreen||board.webkitRequestFullscreen;
function fsReal(){return (document.fullscreenElement||document.webkitFullscreenElement)===board;}
function fsBig(){return board.classList.contains("bigscreen");}
function bigSet(on){board.classList.toggle("bigscreen",on);document.body.classList.toggle("op-lock",on);}
function fsSync(){
  setTimeout(fitBarTitle,0);
  if(fsReal()&&fsBig())bigSet(false);            /* 本物の 全画面が 効いたら 代わりは やめる */
  if(fsBtn){var t=(fsReal()||fsBig())?"もとの 大きさ":"ぜんがめん";
    fsBtn.title=t;fsBtn.setAttribute("aria-label",t);}
}
function bigOn(on){bigSet(on);fsSync();}
if(fsBtn){
  fsBtn.addEventListener("click",function(){
    if(fsBig()){bigOn(false);return;}
    if(fsReal()){var out=document.exitFullscreen||document.webkitExitFullscreen;if(out)out.call(document);return;}
    if(!fsGo){bigOn(true);return;}
    var p=null,ng=false;
    try{p=fsGo.call(board);}catch(err){ng=true;}
    if(ng){bigOn(true);return;}
    if(p&&p.then)p.then(fsSync,function(){});
    /* 返事が こない・ことわられた ときも 大きくする */
    setTimeout(function(){if(!fsReal()&&!fsBig())bigOn(true);},450);
  });
  document.addEventListener("fullscreenchange",fsSync);
  document.addEventListener("webkitfullscreenchange",fsSync);
  document.addEventListener("keydown",function(e){if(e.key==="Escape"&&fsBig())bigOn(false);});
}

/* ---- 「まっさらにする」：すぐ消さずに、みんなで あいさつしてから 帰っていく ---- */
function wipeNow(){
  P.bye=false;P.clearAll();strokes=[];uw={st:null,last:null,t:0};dw={st:null,last:null,t:0};pending=null;ripples=[];
  abortDemo();lastUser=P.now;setTip(TIP0);
}
var BYEBYE=["えっ？","もう おわり？","また あそぼうね！","またねー！","あそんでくれて ありがとう〜"];
document.getElementById("reset").addEventListener("click",function(){
  abortDemo();lastUser=P.now;
  var live=P.animals.filter(function(a){return !a.leaving;});
  /* もう帰りはじめているとき・だれもいないときは そのまま まっさらに */
  if(P.bye||!live.length){wipeNow();return;}
  P.bye=true;strokes=[];ripples=[];pending=null;
  if(AD.chat)AD.chat.stop();
  P.sessions.slice().forEach(function(s){X.end(s);});
  live.sort(function(p,q){return p.x-q.x;});
  live.forEach(function(a,i){
    a.hold=true;a.rest=9;a.mult=1;a.hidden=false;a.sleep=false;a.cool=99;a.chatCool=99;
    P.later(i*.3,function(){
      if(P.animals.indexOf(a)<0)return;
      a.face=a.x<S.W/2?1:-1;a.dir=a.face;
      P.say(a,i<BYEBYE.length?BYEBYE[i]:pick(BYEBYE),1.7);P.jump(a,3.6);
    });
  });
  var wait=Math.min(1.7+live.length*.3,3.4);
  P.later(wait,function(){
    P.animals.forEach(function(a){a.hold=false;a.sess=null;a.leaving=true;a.tx=a.x<S.W/2?-a.u*3:S.W+a.u*3;a.ty=a.y;a.mult=1.5;});
    setTip("またね〜！");
  });
  P.later(wait+3.4,wipeNow);
});

/* ---- 作品について ---- */
var aboutEl=document.getElementById("about"),aboutBtn=document.getElementById("aboutBtn"),aboutClose=document.getElementById("aboutClose");
function showAbout(on){
  aboutEl.hidden=!on;aboutBtn.setAttribute("aria-expanded",on?"true":"false");
  if(on)fitAbout();
  try{(on?aboutClose:aboutBtn).focus({preventScroll:true});}catch(err){}
}
/* 作品についての 字は、スクロールを 出さずに、あいている ぶんだけ 大きくする。
   はばが せまい ときに 字が でかすぎ ないよう、はばでも かぎりを つける */
function fitAbout(){
  if(aboutEl.hidden)return;
  var card=aboutEl.querySelector(".about-card");if(!card)return;
  var hi=AD.clamp((card.clientWidth||360)/21,12,19),best=9;
  for(var fs=9;fs<=hi;fs+=.5){
    card.style.setProperty("--about-fs",fs+"px");
    if(card.scrollHeight>card.clientHeight)break;
    best=fs;
  }
  card.style.setProperty("--about-fs",best+"px");
}
/* 上のバーの タイトルは、「まちであそぶ」くらいも 出ないなら 出さない */
/* タイトルの 絵を おしたら、はじめから（画面を 読みこみ直す） */
var titleImg=document.getElementById("titleImg");
if(titleImg)titleImg.addEventListener("click",function(){location.reload();});
function fitBarTitle(){
  var t=document.querySelector(".board-title");if(!t)return;
  t.style.display="";
  if(t.clientWidth<96)t.style.display="none";
}
window.addEventListener("resize",function(){fitAbout();fitBarTitle();});
fitBarTitle();
aboutBtn.addEventListener("click",function(){showAbout(aboutEl.hidden);});
aboutClose.addEventListener("click",function(){showAbout(false);});
aboutEl.addEventListener("click",function(e){if(e.target===aboutEl)showAbout(false);});
document.addEventListener("keydown",function(e){if(e.key==="Escape"&&!aboutEl.hidden)showAbout(false);});

/* ---- 図鑑（うまれかたの一覧を兼ねる） ---- */
var cellsEl=document.getElementById("cells"),cellMap={};
ORDER.forEach(function(key){
  var sp=SPK[key],li=document.createElement("li");li.className="cell";
  var cvs=document.createElement("canvas");li.appendChild(cvs);
  var nm=document.createElement("span");nm.textContent="？？？";li.appendChild(nm);
  /* うまれかたは、押したら見える（うまれたどうぶつは自動で見える） */
  var sm=document.createElement("small");sm.className="ask";sm.textContent="ヒントを見る";li.appendChild(sm);
  li.tabIndex=0;li.setAttribute("role","button");li.setAttribute("aria-label",sp.kind==="foot"?"足あとのどうぶつのヒントを見る":"手形のどうぶつのヒントを見る");
  var m={li:li,c:cvs,nm:nm,sm:sm,sp:sp};
  li.addEventListener("click",function(){reveal(m);});
  li.addEventListener("keydown",function(e){if(e.key==="Enter"||e.key===" "){e.preventDefault();reveal(m);}});
  cellsEl.appendChild(li);cellMap[key]=m;
});
function reveal(m){
  if(m.open)return;m.open=true;
  m.sm.className="";m.sm.textContent=(m.sp.kind==="foot"?"なぞる・":"")+RECIPE[m.sp.key];
  m.li.classList.add("open");m.li.removeAttribute("role");m.li.removeAttribute("aria-label");m.li.tabIndex=-1;
}
function drawCell(key){
  var m=cellMap[key],r=AD.dpr(),w=104,h=84;
  m.c.width=w*r;m.c.height=h*r;
  var g=m.c.getContext("2d");g.setTransform(r,0,0,r,0,0);g.__pats=null;
  var tall={foot1:1,hand0:1,hand1:1}[key],u=m.sp.kind==="hand"?(tall?25:28):(tall?27:31);
  var a={sp:m.sp,u:u,z:0,vz:0,moving:false,ph:0,seed:1,dir:1,deco:1,talk:0,sleep:false,blink:0,nod:0};
  /* 図鑑の小さな絵は 画面そのままの こまかさで描く（ボードの こまかさとは べつ） */
  var keepR=AD.R;AD.R=r;
  var tx=m.sp.kind==="hand"?w*.46:w*.5,ty=h-4;
  if(met[key]){
    g.save();g.translate(tx,ty);m.sp.draw(g,a,0);g.restore();
  }else{
    /* まだ 会っていない子は「かげ（シルエット）」で 見せる。
       いちど 絵を かいて、その かたちだけを 一色で ぬりつぶす */
    var off=document.createElement("canvas");off.width=m.c.width;off.height=m.c.height;
    var og=off.getContext("2d");og.setTransform(r,0,0,r,0,0);og.__pats=null;
    og.save();og.translate(tx,ty);m.sp.draw(og,a,0);og.restore();
    og.setTransform(1,0,0,1,0,0);
    og.globalCompositeOperation="source-in";
    og.fillStyle="#AFC5D3";og.fillRect(0,0,off.width,off.height);
    g.save();g.setTransform(1,0,0,1,0,0);g.drawImage(off,0,0);g.restore();
  }
  AD.R=keepR;
  if(met[key]){m.li.classList.add("met");m.nm.textContent=m.sp.name;reveal(m);}
  document.getElementById("count").textContent=Object.keys(met).length+" / 12";
}
function markCell(key){var m=cellMap[key];drawCell(key);m.li.classList.remove("fresh");void m.li.offsetWidth;if(!P.reduced)m.li.classList.add("fresh");}

/* ---- 起動 ---- */
sizeAll();updateTextRects();
Object.keys(cellMap).forEach(drawCell);
/* はじめからいるのは、ネコ・シマウマ・ウマだけ（自動デモでうまれるのもネコとシマウマなので、図鑑は3/12から） */
var cat=P.spawn(SPK.foot4,W*.30,H*.80,"quiet",1.05),zebra=P.spawn(SPK.hand5,W*.58,H*.82,"quiet",1),horse=P.spawn(SPK.hand3,W*.50,H*.56,"quiet",1);
[cat,zebra,horse].forEach(function(a){born(a,false);});
X.start("ball",[cat,zebra]);
cat.x=cat.tx;cat.y=cat.ty;zebra.x=zebra.tx;zebra.y=zebra.ty;cat.dir=1;zebra.dir=-1;
setTip(TIP0);

/* ボードの大きさが本当に変わったときだけ作りなおす（スマホの向きを変えた・アドレスバーが隠れた など） */
var resizeT=0;
function onResize(){
  clearTimeout(resizeT);
  resizeT=setTimeout(function(){
    var r=stage.getBoundingClientRect();
    if(Math.abs(Math.max(300,r.width)-W)<4&&Math.abs(Math.max(300,r.height)-H)<4)return;
    sizeAll();updateTextRects();
  },150);
}
if("ResizeObserver" in window)new ResizeObserver(onResize).observe(stage);
else window.addEventListener("resize",onResize);
if(document.fonts&&document.fonts.load)document.fonts.load("20px Yomogi");

var visible=false,running=false,prev=0,gen=0,beat=Date.now();
/* うごかす ループ。スリープや タブの切りかえで 止まってしまっても かけなおせるよう、
   世代（gen）をつけて、ふるいループは じぶんで 終わるようにする */
function makeLoop(my){
  return function loop(ts){
    if(!visible||my!==gen){if(my===gen)running=false;return;}
    if(D.on&&prev)D.gap(ts-prev);
    if(prev)watchQuality(ts-prev);
    frame(prev?Math.min(.05,(ts-prev)/1000):0);prev=ts;
    beat=Date.now();
    requestAnimationFrame(loop);
  };
}
var D=AD.dbg;
function frame(dt){
  if(D.on)D.begin();
  if((rectT-=dt)<=0){rectT=.4;updateTextRects();}
  if(pending&&!down&&clock()-pending.lastUp>TAP_GAP)resolveTaps();
  if(down&&!downMoved&&!downUsed&&!longOff&&!downOnAnimal&&!downOnBall&&!pending&&clock()-downT>LONG_T){downUsed=true;stampHand(downPos,false,LONG);}
  runDemo(dt);P.update(dt);
  if(D.on)D.mark("update");
  ctx.globalAlpha=1;ctx.globalCompositeOperation="source-over";
  if(S.bgIsLayer)ctx.clearRect(0,0,W,H);
  S.drawBack(ctx,dt);
  if(D.on)D.mark("back");
  drawStrokes(ctx);
  if(D.on)D.mark("strokes");
  var list=[];
  P.animals.forEach(function(a){
    /* あそんでいる子が しげみの中に入ってしまったときは、しげみより手前に描く（体がかくれない）。
       かくれんぼで かくれている子は そのまま しげみのうしろ */
    var y=a.y;
    if(a.sess&&!a.hidden){var b=P.bushHidden(a);if(b)y=b.y+.5;}
    list.push({y:y,a:a});
  });
  S.bushes.forEach(function(b){list.push({y:b.y,b:b});});
  P.balls.forEach(function(b){list.push({y:b.y+.5,ball:b});});
  P.props.forEach(function(pr){list.push({y:typeof pr.y==="function"?pr.y():pr.y,prop:pr});});
  list.sort(function(p,q){return p.y-q.y;});
  list.forEach(function(o){if(o.a)P.drawAnimal(ctx,o.a,P.now);else if(o.b)S.drawBush(ctx,o.b);else if(o.prop){ctx.save();o.prop.draw(ctx);ctx.restore();}else P.drawBall(ctx,o.ball);});
  if(D.on)D.mark("animals");
  drawTaps(ctx);
  P.drawOverlay(ctx);
  if(D.on){D.mark("overlay");
    var np=0;strokes.forEach(function(st){np+=st.prints.length;});
    D.end({animals:P.animals.length,prints:np,bubbles:P.bubbles.length,w:cv.width,h:cv.height,dpr:AD.R});}
}
function start(){
  if(!visible)return;
  running=true;prev=0;beat=Date.now();
  requestAnimationFrame(makeLoop(++gen));
}
/* いま 草原が 画面に 出ているか（見まもりの しくみに たよらず じぶんで しらべる） */
function onScreen(){
  if(document.hidden)return false;
  var h=window.innerHeight||0,w=window.innerWidth||0;
  if(!h||!w)return true;                       /* 大きさが わからないときは 動かしておく */
  var r=stage.getBoundingClientRect();
  return r.bottom>0&&r.top<h&&r.right>0&&r.left<w;
}
/* スリープ・タブ切りかえ・もどってきたとき：止まったままに ならないよう かけなおす */
function wake(){if(onScreen()){visible=true;start();}}
document.addEventListener("visibilitychange",wake);
window.addEventListener("pageshow",wake);
window.addEventListener("focus",wake);
/* 見まわり：2秒いじょう うごいていなければ かけなおす */
setInterval(function(){if(Date.now()-beat>2000)wake();},1500);
if("IntersectionObserver" in window){
  new IntersectionObserver(function(es){visible=es[0].isIntersecting;if(visible)start();},{threshold:.02}).observe(stage);
}else{visible=true;start();}
AD.debug={watchQuality:watchQuality,input:function(){return {down:down,downMoved:downMoved,downUsed:downUsed,longOff:longOff,downOnAnimal:downOnAnimal,downOnBall:downOnBall,pending:!!pending,downMax:downMax,held:clock()-downT};},frame:frame};
D.init();
})();
