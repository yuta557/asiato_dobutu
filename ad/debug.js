/* 重さの計測（ふだんは何もしない）
   つけかた：URLの末尾に ?debug か #debug をつける／ボード上の「まちであそぶボード」の文字を3回つづけてタップ */
(function(){
"use strict";
var AD=window.AD;
var D=AD.dbg={on:false};
var now=function(){return performance.now();};
var SECTIONS=[["update","うごき・あそびの計算"],["back","草原（背景）の絵"],["strokes","足あとの絵"],["animals","どうぶつの絵"],["overlay","ふきだしなどの絵"]];
var cur=null,t0=0,tLast=0,win=[],gaps=[],worst=[],counts={clear:0,shape:0},shapeMs=0,shapeMax=0,panel=null,lastPaint=0,startT=0;

D.begin=function(){cur={};t0=tLast=now();};
D.mark=function(name){var t=now();cur[name]=(cur[name]||0)+(t-tLast);tLast=t;};
D.end=function(info){
  var t=now(),total=t-t0,f={total:total,at:t,s:cur,info:info};
  win.push(f);
  if(total>20){worst.push(f);worst.sort(function(a,b){return b.total-a.total;});worst=worst.slice(0,5);}
  while(win.length&&t-win[0].at>2000)win.shift();
  if(t-lastPaint>500){lastPaint=t;paint(info);}
};
D.gap=function(ms){gaps.push({ms:ms,at:now()});while(gaps.length&&now()-gaps[0].at>2000)gaps.shift();};

function wrapCounters(){
  var S=AD.scene,clear=S.clear;
  S.clear=function(){counts.clear++;return clear.apply(this,arguments);};
  var shapeOf=AD.shapeOf;
  AD.shapeOf=function(p){var t=now(),r=shapeOf(p),ms=now()-t;counts.shape++;shapeMs=ms;shapeMax=Math.max(shapeMax,ms);return r;};
}
function fmt(n){return n.toFixed(1);}
function paint(info){
  if(!panel)return;
  var n=win.length||1,avg={},mx=0,long=0;
  win.forEach(function(f){mx=Math.max(mx,f.total);if(f.total>33)long++;for(var k in f.s)avg[k]=(avg[k]||0)+f.s[k]/n;});
  var total=win.reduce(function(s,f){return s+f.total;},0)/n;
  var gapAvg=gaps.length?gaps.reduce(function(s,g){return s+g.ms;},0)/gaps.length:0,gapMax=gaps.reduce(function(m,g){return Math.max(m,g.ms);},0);
  var fps=gaps.length/2,sec=(now()-startT)/1000;
  var lines=[
    "【重さの計測】",
    "1秒あたりの画面の書きかえ："+fps.toFixed(0)+"回（60回がなめらか）",
    "書きかえの間かく：ふつう "+fmt(gapAvg)+"ミリ秒／いちばん長い "+fmt(gapMax)+"ミリ秒",
    "1回の書きかえにかかった時間：ふつう "+fmt(total)+"ミリ秒／いちばん長い "+fmt(mx)+"ミリ秒",
    "重かった書きかえ（33ミリ秒より長い）：この2秒で "+long+"回",
    "時間のうちわけ（ふつう）："
  ];
  SECTIONS.forEach(function(s){lines.push("　・"+s[1]+"　"+fmt(avg[s[0]]||0)+"ミリ秒");});
  lines.push("形の見わけ：さいご "+fmt(shapeMs)+"ミリ秒／いちばん長い "+fmt(shapeMax)+"ミリ秒（"+counts.shape+"回）");
  lines.push("あそぶ場所さがし：1秒に "+Math.round(counts.clear/Math.max(1,sec))+"回");
  lines.push("いまの数：どうぶつ "+info.animals+"ひき／足あと "+info.prints+"こ／ふきだし "+info.bubbles+"こ");
  var Q=AD.quality;
  lines.push("絵の大きさ：よこ"+info.w+"・たて"+info.h+"の点（描くこまかさ "+info.dpr+"ばい"+(Q&&Q.i>Q.start?"・重いので下げています":"")+(Q&&Q.probe?"・ためし中":"")+"）");
  if(worst.length){
    lines.push("とくに重かった書きかえ：");
    worst.slice(0,3).forEach(function(f){
      var top=Object.keys(f.s).sort(function(a,b){return f.s[b]-f.s[a];})[0],name=(SECTIONS.find(function(s){return s[0]===top;})||[0,top])[1];
      lines.push("　・"+fmt(f.total)+"ミリ秒（いちばん時間がかかったのは「"+name+"」"+fmt(f.s[top])+"ミリ秒、どうぶつ "+f.info.animals+"ひき）");
    });
  }
  lines.push("※「間かく」が長いのに「かかった時間」が短いときは、ブラウザ側（メモリのかたづけなど）が原因です");
  panel.textContent=lines.join("\n");
}
function turnOn(){
  if(D.on)return;D.on=true;startT=now();wrapCounters();
  panel=document.createElement("pre");
  panel.setAttribute("aria-hidden","true");
  panel.style.cssText="position:absolute;left:8px;top:8px;margin:0;padding:8px 10px;font:11.5px/1.55 'Zen Kaku Gothic New','Hiragino Kaku Gothic ProN','Yu Gothic',Meiryo,sans-serif;font-variant-numeric:tabular-nums;"+
    "background:rgba(18,63,99,.86);color:#fff;border-radius:8px;pointer-events:none;z-index:5;max-width:calc(100% - 16px);white-space:pre-wrap";
  document.getElementById("stage").appendChild(panel);
  panel.textContent="【重さの計測】はかっています…";
}
D.init=function(){
  var q=location.search+location.hash;
  if(/debug/.test(q))turnOn();
  var title=document.querySelector(".board-title"),taps=[];
  if(title)title.addEventListener("click",function(){var t=now();taps=taps.filter(function(x){return t-x<900;});taps.push(t);if(taps.length>=3)turnOn();});
};
})();
