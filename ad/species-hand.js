/* 手形のどうぶつ：指＝4本のあし、てのひら＝胴、親指＝首や顔 */
(function(){
"use strict";
var AD=window.AD,PI=Math.PI;

function drawHand(sp){
  return function(g,a,t){
    var u=a.u,ci=sp.col,da=a.deco==null?1:a.deco;
    var swing=a.moving&&a.z===0?Math.sin(a.ph)*.32:0;
    var h=AD.handPath(u,{thumbAng:sp.thumbAng+(a.nod||0),thumbLen:sp.thumbLen,swing:swing,legAng:a.z>0?.35:0});
    var bob=a.moving&&a.z===0?Math.abs(Math.cos(a.ph))*.03*u:0;
    g.save();g.translate(0,-.74*u-bob);
    if(da>0&&sp.back){g.save();g.globalAlpha*=da;AD.ink(g,u);sp.back(g,u,a,t,ci,h);g.restore();}
    AD.stamp(g,h.path,ci,u);AD.handCreases(g,h,ci,u);
    if(da>0){g.save();g.globalAlpha*=da;AD.ink(g,u);sp.front(g,u,a,t,ci,h);g.restore();}
    g.restore();
  };
}
function along(h,f){var T=h.thumb;return {x:T.bx+(T.x-T.bx)*f,y:T.by+(T.y-T.by)*f};}
function clipDraw(g,path,fn){g.save();g.clip(path);fn();g.restore();}
function horseHead(g,u,ci,h){
  var T=h.thumb,p=new Path2D();
  AD.ellipse(p,T.x+.12*u,T.y+.08*u,.22*u,.12*u,.65);
  p.moveTo(T.x-.10*u,T.y-.02*u);p.lineTo(T.x-.07*u,T.y-.24*u);p.lineTo(T.x+.04*u,T.y-.05*u);p.closePath();
  AD.stamp(g,p,ci,u);return p;
}
function mane(g,u,h,col){
  var T=h.thumb,n=T.ang-PI/2;
  g.save();g.strokeStyle=col;g.lineWidth=Math.max(1.2,u*.045);g.lineCap="round";
  for(var i=0;i<7;i++){
    var q=along(h,.12+i*.13),r=.09*u,l=.12*u;
    AD.line(g,q.x+Math.cos(n)*r*.6,q.y+Math.sin(n)*r*.6,q.x+Math.cos(n-.5)*(r+l),q.y+Math.sin(n-.5)*(r+l));
  }
  g.restore();
}
function tailStrands(g,u,a,t,col){
  var sw=Math.sin(t*2.2+a.seed)*.06;
  g.save();g.strokeStyle=col;g.lineWidth=Math.max(1,u*.035);g.lineCap="round";
  for(var i=0;i<4;i++){g.beginPath();g.moveTo(-.44*u,-.72*u);g.quadraticCurveTo((-.64+sw)*u,(-.60+i*.03)*u,(-.60+sw*1.6+i*.03)*u,(-.22+i*.04)*u);g.stroke();}
  g.restore();
}
function def(sp){sp.kind="hand";sp.draw=sp.draw||drawHand(sp);AD.addSpecies(sp);}

def({key:"hand0",col:0,name:"キリン",motion:"walk",thumbAng:-1.30,thumbLen:1.05,
  born:"のびーっ！",tap:["のびーっ","たかいところ、よくみえる","はっぱ、おいしいよ"],
  hello:["うえから、こんにちは","みんな、みえてるよ〜"],
  back:function(g,u,a,t,ci){
    var sw=Math.sin(t*2+a.seed)*.05;
    AD.line(g,-.44*u,-.70*u,(-.60+sw)*u,-.28*u);
    g.save();g.fillStyle="#7A4A26";AD.blob(g,(-.61+sw)*u,-.24*u,.05*u,"#7A4A26",1);g.restore();
  },
  front:function(g,u,a,t,ci,h){
    clipDraw(g,h.path,function(){
      g.fillStyle="rgba(192,118,52,.8)";
      [[-.25,-.66,.09],[.06,-.78,.08],[.26,-.52,.08],[-.08,-.38,.09],[.16,-.22,.07],[-.31,-.24,.07]].forEach(function(s,i){AD.blob(g,s[0]*u,s[1]*u,s[2]*u,"rgba(192,118,52,.8)",i);});
      [.25,.5,.75].forEach(function(f,i){var q=along(h,f);AD.blob(g,q.x+(i%2?.02:-.02)*u,q.y,.045*u,"rgba(192,118,52,.8)",i+3);});
    });
    var T=h.thumb,hx=T.x+.10*u,hy=T.y+.02*u;
    AD.stampShape(g,ci,u,function(p){AD.ellipse(p,hx,hy,.21*u,.12*u,.35);AD.ellipse(p,hx-.16*u,hy-.07*u,.08*u,.04*u,-.5);});
    AD.ink(g,u);
    AD.line(g,hx-.08*u,hy-.10*u,hx-.10*u,hy-.26*u);AD.line(g,hx+.02*u,hy-.11*u,hx+.03*u,hy-.27*u);
    AD.dot(g,hx-.10*u,hy-.27*u,.035*u);AD.dot(g,hx+.03*u,hy-.28*u,.035*u);
    AD.eye(g,hx+.02*u,hy-.03*u,.035*u,a);AD.dot(g,hx+.17*u,hy+.04*u,.016*u);
    if(a.talk>0)AD.line(g,hx+.08*u,hy+.09*u,hx+.16*u,hy+.10*u);
  }});

/* フラミンゴ：手形をななめにして、指＝はね、親指＝首。足は細い線で片足だち */
def({key:"hand1",col:1,name:"フラミンゴ",motion:"walk",top:2.6,hitY:1.55,
  born:"フラ〜ッ！",tap:["かたあしで、たてるよ","ピンクでしょ？","ぐわっ、ぐわっ"],
  draw:function(g,a,t){
    var u=a.u,col=1,da=a.deco==null?1:a.deco,mv=(a.moving&&a.z===0)||a.z>0;
    var legW=Math.max(1.6,u*.065);
    g.save();
    g.strokeStyle=AD.shade(col,.72,1);g.lineWidth=legW;g.lineCap="round";g.lineJoin="round";
    if(mv){
      var s1=Math.sin(a.ph)*.26*u;
      AD.line(g,-.02*u,-1.2*u,s1*.4-.08*u,-.6*u,s1,0);AD.line(g,s1,0,s1+.12*u,0);
      AD.line(g,.04*u,-1.2*u,-s1*.4-.02*u,-.6*u,-s1,0);AD.line(g,-s1,0,-s1+.12*u,0);
    }else{
      AD.line(g,-.02*u,-1.2*u,-.07*u,-.6*u,0,0);AD.line(g,0,0,.13*u,0);
      AD.line(g,.05*u,-1.2*u,.34*u,-.80*u,.0,-.62*u);
    }
    var th=3*PI/4,c=Math.cos(th),s=Math.sin(th),ox=-.30*u,oy=-1.80*u;
    function tf(x,y){x=-x;return {x:ox+x*c-y*s,y:oy+x*s+y*c};}
    var h=AD.handPath(u,{thumbAng:PI/4,thumbLen:.55,spread:1.15});
    g.save();g.translate(ox,oy);g.rotate(th);g.scale(-1,1);AD.stamp(g,h.path,col,u);AD.handCreases(g,h,col,u);g.restore();
    var T=tf(h.thumb.x,h.thumb.y),hx=T.x+.40*u,hy=T.y-.10*u;
    AD.stampLine(g,col,u,.17*u,function(k){k.moveTo(T.x,T.y+.08*u);k.bezierCurveTo(T.x-.02*u,T.y-.42*u,T.x+.42*u,T.y-.54*u,hx,hy);});
    AD.stampShape(g,col,u,function(p){AD.circle(p,hx,hy,.13*u);});
    if(da>0){
      g.save();g.globalAlpha*=da;
      var open=a.talk>0?.05*u:0;
      g.fillStyle="#F6EBDD";g.beginPath();g.moveTo(hx+.02*u,hy+.03*u);g.lineTo(hx+.15*u,hy-.02*u);g.lineTo(hx+.13*u+open,hy+.30*u);g.closePath();g.fill();
      g.fillStyle="#2E2622";g.beginPath();g.moveTo(hx+.08*u+open*.5,hy+.17*u);g.lineTo(hx+.145*u,hy+.15*u);g.lineTo(hx+.13*u+open,hy+.30*u);g.closePath();g.fill();
      AD.ink(g,u);AD.eye(g,hx-.01*u,hy-.04*u,.03*u,a);
      g.restore();
    }
    g.restore();
  }});

/* きょうりゅう：手形を上下にして、指＝せなかのトゲ、てのひら＝胴、親指＝首 */
var DINO_PLATE="rgba(176,214,92,.78)";
function quad(p0,p1,p2,k){var m=1-k;return {x:m*m*p0[0]+2*m*k*p1[0]+k*k*p2[0],y:m*m*p0[1]+2*m*k*p1[1]+k*k*p2[1]};}
def({key:"hand2",col:2,name:"きょうりゅう",motion:"walk",top:2.2,hitY:.9,
  born:"ぎゃおーっ！",tap:["ぎゃおー！","せなかのトゲ、かっこいい？","ずしーん、ずしーん"],
  draw:function(g,a,t){
    var u=a.u,col=2,da=a.deco==null?1:a.deco,sw=a.moving&&a.z===0?Math.sin(a.ph)*.12*u:0;
    var h=AD.handPath(u,{thumbAng:.55,thumbLen:.5,spread:.75});
    g.save();g.translate(0,-1.26*u);
    AD.stampShape(g,col,u,function(p){AD.capsule(p,-.24*u,.78*u,-.24*u+sw,1.16*u,.10*u);AD.capsule(p,.24*u,.78*u,.24*u-sw,1.16*u,.10*u);});
    var tw=Math.sin(t*2+a.seed)*.06*u,P0=[-.30*u,.70*u],P1=[-.92*u,.88*u],P2=[-1.18*u+tw,.34*u];
    AD.stampLine(g,col,u,.17*u,function(k){k.moveTo(P0[0],P0[1]);k.quadraticCurveTo(P1[0],P1[1],P2[0],P2[1]);});
    g.save();g.scale(1,-1);
    AD.stamp(g,h.path,col,u);
    var fp=new Path2D();h.fingers.forEach(function(f){AD.capsule(fp,f.bx,f.by,f.tx,f.ty,f.r);});
    g.save();g.clip(fp);g.fillStyle=DINO_PLATE;g.fillRect(-u,-.02*u,2*u,1.2*u);g.restore();
    AD.handCreases(g,h,col,u);
    g.restore();
    if(da>0){
      g.save();g.globalAlpha*=da;
      g.fillStyle=DINO_PLATE;
      [.45,.68,.88].forEach(function(k){
        var p=quad(P0,P1,P2,k),q=quad(P0,P1,P2,k+.04),ang=Math.atan2(q.y-p.y,q.x-p.x),nx=Math.sin(ang),ny=-Math.cos(ang);
        if(ny>0){nx=-nx;ny=-ny;}
        var r=.085*u*(1.15-k*.4),bx=p.x+nx*.07*u,by=p.y+ny*.07*u;
        g.beginPath();g.moveTo(bx-Math.cos(ang)*r,by-Math.sin(ang)*r);g.lineTo(bx+Math.cos(ang)*r,by+Math.sin(ang)*r);g.lineTo(bx+nx*r*1.5,by+ny*r*1.5);g.closePath();g.fill();
      });
      g.restore();
    }
    var T={x:h.thumb.x,y:-h.thumb.y},hx=T.x+.14*u,hy=T.y-.04*u;
    AD.stampShape(g,col,u,function(p){AD.ellipse(p,hx,hy,.25*u,.16*u,-.12);});
    if(da>0){
      g.save();g.globalAlpha*=da;AD.ink(g,u);
      AD.eye(g,hx+.02*u,hy-.06*u,.038*u,a);AD.dot(g,hx+.20*u,hy-.05*u,.015*u);
      g.fillStyle="#D24A3A";g.beginPath();g.moveTo(hx+.04*u,hy+.05*u);g.lineTo(hx+.23*u,hy+.01*u);g.lineTo(hx+.10*u,hy+(a.talk>0?.17:.10)*u);g.closePath();g.fill();
      AD.cheek(g,hx-.10*u,hy+.04*u,.045*u);
      g.restore();
    }
    g.restore();
  }});

def({key:"hand3",col:3,name:"ウマ",motion:"walk",thumbAng:-1.0,thumbLen:.70,
  born:"ひひーん！",tap:["ひひーん！","ぱっかぱっか","せなかに、のる？"],
  hello:["ひひん、こんにちは","かけっこしよう！"],
  back:function(g,u,a,t,ci){tailStrands(g,u,a,t,"#5A3B26");},
  front:function(g,u,a,t,ci,h){
    var T=h.thumb;
    mane(g,u,h,"#5A3B26");
    horseHead(g,u,ci,h);
    AD.ink(g,u);
    AD.eye(g,T.x+.04*u,T.y+.02*u,.036*u,a);AD.dot(g,T.x+.25*u,T.y+.20*u,.018*u);
    if(a.talk>0)AD.line(g,T.x+.16*u,T.y+.25*u,T.x+.26*u,T.y+.26*u);
  }});

def({key:"hand4",col:4,name:"トラ",motion:"walk",thumbAng:-.60,thumbLen:.50,
  born:"がおーっ！",tap:["がおーっ！","しましま、かっこいい？","ねこじゃないよ、トラだよ"],
  hello:["がお、こんにちは！","つよいぞ〜"],
  back:function(g,u,a,t,ci){
    var sw=Math.sin(t*2+a.seed)*.08;
    AD.stampLine(g,ci,u,.08*u,function(c){c.moveTo(-.40*u,-.74*u);c.bezierCurveTo(-.70*u,-.78*u,-.72*u,(-1.05+sw)*u,(-.56+sw)*u,-1.10*u);});
    g.save();g.strokeStyle="#6B3A1E";g.lineWidth=Math.max(1,u*.035);
    AD.line(g,-.58*u,-.72*u,-.58*u,-.84*u);AD.line(g,-.68*u,-.90*u,-.58*u,-.94*u);g.restore();
  },
  front:function(g,u,a,t,ci,h){
    clipDraw(g,h.path,function(){
      g.strokeStyle="rgba(107,58,30,.85)";g.lineWidth=Math.max(1.2,u*.05);
      [-.28,-.10,.08,.24].forEach(function(x){g.beginPath();g.moveTo(x*u,-1.0*u);g.quadraticCurveTo((x+.06)*u,-.80*u,(x-.02)*u,-.62*u);g.stroke();});
      h.fingers.forEach(function(f){var y=f.by+(f.ty-f.by)*.45,x=f.bx+(f.tx-f.bx)*.45;AD.line(g,x-f.r,y,x+f.r*.3,y-f.r*.3);});
    });
    var T=h.thumb,hx=T.x+.06*u,hy=T.y-.02*u;
    AD.stampShape(g,ci,u,function(p){AD.circle(p,hx-.16*u,hy-.19*u,.08*u);AD.circle(p,hx+.13*u,hy-.21*u,.08*u);AD.circle(p,hx,hy,.25*u);});
    g.save();g.fillStyle="#FFF6EA";g.beginPath();g.ellipse(hx+.05*u,hy+.09*u,.13*u,.08*u,0,0,PI*2);g.fill();
    g.strokeStyle="#6B3A1E";g.lineWidth=Math.max(1,u*.035);
    AD.line(g,hx-.04*u,hy-.24*u,hx-.02*u,hy-.16*u);AD.line(g,hx+.04*u,hy-.25*u,hx+.04*u,hy-.16*u);
    AD.line(g,hx-.25*u,hy,hx-.16*u,hy+.02*u);AD.line(g,hx+.25*u,hy,hx+.17*u,hy+.02*u);g.restore();
    AD.ink(g,u);
    g.beginPath();g.moveTo(hx+.01*u,hy+.03*u);g.lineTo(hx+.09*u,hy+.03*u);g.lineTo(hx+.05*u,hy+.08*u);g.closePath();g.fill();
    AD.eye(g,hx-.06*u,hy-.07*u,.036*u,a);AD.eye(g,hx+.14*u,hy-.07*u,.036*u,a);
    if(a.talk>0){g.save();g.fillStyle="#A8404F";AD.dot(g,hx+.05*u,hy+.14*u,.035*u);g.restore();}
  }});

def({key:"hand5",col:5,name:"シマウマ",motion:"walk",thumbAng:-1.0,thumbLen:.70,
  born:"ひひん！",tap:["しましま〜","しまもよう、かぞえてみて","ひひん！"],
  hello:["シマウマだよ、こんにちは","いっしょにはしろう"],
  back:function(g,u,a,t,ci){tailStrands(g,u,a,t,"#35343A");},
  front:function(g,u,a,t,ci,h){
    var T=h.thumb,st="rgba(53,52,58,.85)";
    clipDraw(g,h.path,function(){
      g.strokeStyle=st;g.lineWidth=Math.max(1.4,u*.055);
      [-.34,-.18,-.02,.14,.30].forEach(function(x,i){g.beginPath();g.moveTo(x*u,-1.0*u);g.quadraticCurveTo((x+(i%2?.08:-.06))*u,-.62*u,(x+.02)*u,-.10*u);g.stroke();});
      h.fingers.forEach(function(f){[.3,.6].forEach(function(k){var x=f.bx+(f.tx-f.bx)*k,y=f.by+(f.ty-f.by)*k;AD.line(g,x-f.r*1.2,y,x+f.r*1.2,y);});});
      [.25,.5,.75].forEach(function(k){var q=along(h,k),n=T.ang+PI/2;AD.line(g,q.x-Math.cos(n)*.13*u,q.y-Math.sin(n)*.13*u,q.x+Math.cos(n)*.13*u,q.y+Math.sin(n)*.13*u);});
    });
    mane(g,u,h,"#35343A");
    var hp=horseHead(g,u,ci,h);
    clipDraw(g,hp,function(){g.strokeStyle=st;g.lineWidth=Math.max(1.2,u*.045);
      AD.line(g,T.x+.02*u,T.y+.16*u,T.x+.14*u,T.y-.02*u);AD.line(g,T.x+.10*u,T.y+.24*u,T.x+.24*u,T.y+.06*u);});
    AD.ink(g,u);
    AD.eye(g,T.x+.04*u,T.y+.02*u,.036*u,a);AD.dot(g,T.x+.25*u,T.y+.20*u,.018*u);
    if(a.talk>0)AD.line(g,T.x+.16*u,T.y+.25*u,T.x+.26*u,T.y+.26*u);
  }});
})();
