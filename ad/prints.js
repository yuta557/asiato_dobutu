/* 足あと・手形の形と、スタンプの質感 */
(function(){
"use strict";
var AD=window.AD=window.AD||{};
var PI=Math.PI,TAU=PI*2;
AD.PI=PI;AD.TAU=TAU;
AD.clamp=function(v,a,b){return v<a?a:v>b?b:v;};
AD.ease=function(e){return e*e*(3-2*e);};
AD.rand=function(a,b){return a+Math.random()*(b-a);};
AD.pick=function(arr){return arr[Math.floor(Math.random()*arr.length)];};
AD.dist=function(a,b){return Math.hypot(a.x-b.x,a.y-b.y);};
AD.dpr=function(){return Math.min(2,window.devicePixelRatio||1);};
AD.R=AD.dpr();
AD.INK="#3A2C24";

AD.COLORS=[
  {name:"きいろ",  hex:"#F5CE48",rgb:[245,206,72]},
  {name:"ピンク",  hex:"#F2A3B7",rgb:[242,163,183]},
  {name:"みずいろ",hex:"#80C2E8",rgb:[128,194,232]},
  {name:"ちゃいろ",hex:"#B9865C",rgb:[185,134,92]},
  {name:"オレンジ",hex:"#F2A13C",rgb:[242,161,60]},
  {name:"はいいろ",hex:"#C4C7CA",rgb:[196,199,202]},
  {name:"えんぴつ",hex:"#C9BCAB",rgb:[201,188,171]}  /* 形がきまる前の足あと */
];
AD.PENDING_COLOR=6;
function shade(rgb,k,a){
  function ch(v){return Math.max(0,Math.min(255,Math.round(k>1?v+(255-v)*(k-1):v*k)));}
  return "rgba("+ch(rgb[0])+","+ch(rgb[1])+","+ch(rgb[2])+","+a+")";
}
AD.shade=function(ci,k,a){return shade(AD.COLORS[ci].rgb,k,a==null?1:a);};

/* スタンプの絵の具ムラ（タイル） */
function makeTile(rgb,R){
  var T=96,c=document.createElement("canvas");c.width=c.height=T*R;
  var g=c.getContext("2d");g.scale(R,R);
  g.fillStyle="rgb("+rgb.join(",")+")";g.fillRect(0,0,T,T);
  g.lineCap="round";
  for(var i=0;i<760;i++){
    var x=Math.random()*T,y=Math.random()*T,a=-.9+(Math.random()-.5)*.6,l=3+Math.random()*10;
    var light=Math.random()<.5;
    g.strokeStyle=light?"rgba(255,255,255,"+(.08+Math.random()*.22).toFixed(3)+")":shade(rgb,.8,(.06+Math.random()*.16).toFixed(3));
    g.lineWidth=.6+Math.random()*1.1;
    var dx=Math.cos(a)*l/2,dy=Math.sin(a)*l/2;
    for(var ox=-1;ox<=1;ox++)for(var oy=-1;oy<=1;oy++){
      var X=x+ox*T,Y=y+oy*T;
      if(X+l<0||X-l>T||Y+l<0||Y-l>T)continue;
      g.beginPath();g.moveTo(X-dx,Y-dy);g.lineTo(X+dx,Y+dy);g.stroke();
    }
  }
  for(var j=0;j<150;j++){
    g.fillStyle="rgba(255,255,255,"+(.12+Math.random()*.28).toFixed(3)+")";
    g.beginPath();g.arc(4+Math.random()*(T-8),4+Math.random()*(T-8),.4+Math.random()*1.2,0,TAU);g.fill();
  }
  return c;
}
var tiles=null,tileR=0;
AD.pats=function(g){
  var R=AD.R;
  if(g.__patR===R&&g.__pats)return g.__pats;
  if(!tiles||tileR!==R){tileR=R;tiles=AD.COLORS.map(function(c){return makeTile(c.rgb,R);});}
  g.__pats=tiles.map(function(t){
    var p=g.createPattern(t,"repeat");
    try{p.setTransform(new DOMMatrix([1/R,0,0,1/R,0,0]));}catch(e){}
    return p;
  });
  g.__patR=R;return g.__pats;
};

/* パーツ */
AD.capsule=function(p,x1,y1,x2,y2,r){
  var a=Math.atan2(y2-y1,x2-x1),h=PI/2;
  p.moveTo(x1+Math.cos(a+h)*r,y1+Math.sin(a+h)*r);
  p.arc(x1,y1,r,a+h,a+3*h);p.arc(x2,y2,r,a-h,a+h);p.closePath();
};
AD.ellipse=function(p,x,y,rx,ry,rot){rot=rot||0;p.moveTo(x+Math.cos(rot)*rx,y+Math.sin(rot)*rx);p.ellipse(x,y,rx,ry,rot,0,TAU);};
AD.circle=function(p,x,y,r){p.moveTo(x+r,y);p.arc(x,y,r,0,TAU);};

/* 足あと：指が上(-y)、かかとが下。親指は -x 側（右足） */
AD.footPath=function(u){
  var p=new Path2D();
  p.moveTo(-.30*u,-.50*u);
  p.bezierCurveTo(-.10*u,-.66*u,.26*u,-.62*u,.36*u,-.42*u);
  p.bezierCurveTo(.44*u,-.22*u,.36*u,.10*u,.30*u,.36*u);
  p.bezierCurveTo(.27*u,.62*u,.22*u,.94*u,0,.94*u);
  p.bezierCurveTo(-.24*u,.94*u,-.29*u,.66*u,-.22*u,.46*u);
  p.bezierCurveTo(-.10*u,.24*u,-.04*u,0,-.18*u,-.20*u);
  p.bezierCurveTo(-.30*u,-.34*u,-.42*u,-.40*u,-.30*u,-.50*u);
  p.closePath();
  var T=[[-.23,-.80,.13,.155],[-.01,-.845,.085,.095],[.14,-.805,.075,.085],[.26,-.73,.065,.072],[.35,-.615,.055,.06]];
  for(var i=0;i<5;i++)AD.ellipse(p,T[i][0]*u,T[i][1]*u,T[i][2]*u,T[i][3]*u,0);
  return p;
};

/* 手形：どうぶつの向き（指が下 +y、親指は +x 側で前へ） */
AD.handPath=function(u,o){
  o=o||{};
  var p=new Path2D();
  p.moveTo(-.42*u,0);
  p.bezierCurveTo(-.46*u,-.35*u,-.44*u,-.70*u,-.28*u,-.86*u);
  p.bezierCurveTo(-.10*u,-.98*u,.20*u,-.98*u,.34*u,-.84*u);
  p.bezierCurveTo(.46*u,-.70*u,.48*u,-.35*u,.44*u,-.02*u);
  p.bezierCurveTo(.20*u,.10*u,-.20*u,.10*u,-.42*u,0);
  p.closePath();
  var FX=[-.33,-.11,.11,.32],FL=[.50,.64,.70,.62],FR=[.085,.095,.10,.095],FA=[-.20,-.07,.06,.20];
  var fingers=[];
  for(var i=0;i<4;i++){
    var a=FA[i]*(o.spread||1)+(o.swing?(i%2?o.swing:-o.swing):0)+(o.legAng?(i<2?-o.legAng:o.legAng):0);
    var bx=FX[i]*u,by=-.06*u,tx=bx+Math.sin(a)*FL[i]*u,ty=by+Math.cos(a)*FL[i]*u;
    AD.capsule(p,bx,by,tx,ty,FR[i]*u);
    fingers.push({bx:bx,by:by,tx:tx,ty:ty,r:FR[i]*u});
  }
  var ta=o.thumbAng==null?-.55:o.thumbAng,tl=(o.thumbLen||.62)*u;
  var tbx=.34*u,tby=-.50*u,ttx=tbx+Math.cos(ta)*tl,tty=tby+Math.sin(ta)*tl;
  AD.capsule(p,tbx,tby,ttx,tty,.105*u);
  return {path:p,fingers:fingers,thumb:{bx:tbx,by:tby,x:ttx,y:tty,ang:ta,r:.105*u}};
};

/* スタンプとして塗る：外側に少し濃い縁、内側にムラ */
AD.stamp=function(g,path,ci,u){
  g.save();
  g.globalCompositeOperation="source-over";
  g.lineJoin="round";
  g.strokeStyle=AD.shade(ci,.78,.55);
  g.lineWidth=Math.max(1.2,u*.05);
  g.stroke(path);
  g.fillStyle=AD.pats(g)[ci];
  g.fill(path);
  g.restore();
};
/* 同じ色で塗り足すパーツ（耳・頭など） */
AD.stampShape=function(g,ci,u,build){var p=new Path2D();build(p);AD.stamp(g,p,ci,u);return p;};
/* 同じ質感の太い線（しっぽ・鼻） */
AD.stampLine=function(g,ci,u,w,build){
  g.save();g.lineCap="round";g.lineJoin="round";
  g.beginPath();build(g);
  g.strokeStyle=AD.shade(ci,.78,.55);g.lineWidth=w+Math.max(1.2,u*.05);g.stroke();
  g.strokeStyle=AD.pats(g)[ci];g.lineWidth=w;g.stroke();
  g.restore();
};

/* 手のしわ・指の関節（手形だとわかる手がかり） */
AD.handCreases=function(g,h,ci,u){
  g.save();g.strokeStyle=AD.shade(ci,.68,.32);g.lineWidth=Math.max(.8,u*.02);g.lineCap="round";
  h.fingers.forEach(function(f){
    var mx=f.bx+(f.tx-f.bx)*.55,my=f.by+(f.ty-f.by)*.55,a=Math.atan2(f.ty-f.by,f.tx-f.bx)+PI/2;
    g.beginPath();g.moveTo(mx-Math.cos(a)*f.r*.55,my-Math.sin(a)*f.r*.55);g.lineTo(mx+Math.cos(a)*f.r*.55,my+Math.sin(a)*f.r*.55);g.stroke();
  });
  g.beginPath();g.moveTo(-.30*u,-.30*u);g.quadraticCurveTo(0,-.42*u,.26*u,-.62*u);g.stroke();
  g.beginPath();g.moveTo(-.34*u,-.16*u);g.quadraticCurveTo(0,-.22*u,.30*u,-.30*u);g.stroke();
  g.restore();
};
AD.footCreases=function(g,ci,u){
  g.save();g.strokeStyle=AD.shade(ci,.7,.26);g.lineWidth=Math.max(.8,u*.02);g.lineCap="round";
  g.beginPath();g.moveTo(-.22*u,-.36*u);g.quadraticCurveTo(.04*u,-.28*u,.28*u,-.38*u);g.stroke();
  g.beginPath();g.moveTo(-.12*u,-.14*u);g.quadraticCurveTo(.06*u,-.08*u,.26*u,-.16*u);g.stroke();
  g.restore();
};

/* 描き込み用の小道具 */
AD.ink=function(g,u,w){g.strokeStyle=AD.INK;g.fillStyle=AD.INK;g.lineWidth=Math.max(1.1,u*(w||.04));g.lineCap="round";g.lineJoin="round";};
AD.dot=function(g,x,y,r){g.beginPath();g.arc(x,y,r,0,TAU);g.fill();};
AD.line=function(g){g.beginPath();g.moveTo(arguments[1],arguments[2]);for(var i=3;i<arguments.length;i+=2)g.lineTo(arguments[i],arguments[i+1]);g.stroke();};
AD.eye=function(g,x,y,r,a){
  if(a&&a.sleep){g.beginPath();g.arc(x,y-r*.3,r*1.1,.2*PI,.8*PI);g.stroke();return;}
  if(a&&a.blink>0){AD.line(g,x-r,y,x+r,y);return;}
  AD.dot(g,x,y,r);
  g.save();g.fillStyle="#fff";AD.dot(g,x+r*.35,y-r*.35,r*.35);g.restore();
};
AD.cheek=function(g,x,y,r){g.save();g.fillStyle="rgba(236,110,130,.35)";AD.dot(g,x,y,r);g.restore();};
AD.blob=function(g,x,y,r,col,seed){
  g.save();g.fillStyle=col;g.beginPath();
  for(var i=0;i<=8;i++){var a=i/8*TAU,k=1+.18*Math.sin(a*3+seed);var X=x+Math.cos(a)*r*k,Y=y+Math.sin(a)*r*k*.85;if(i)g.lineTo(X,Y);else g.moveTo(X,Y);}
  g.closePath();g.fill();g.restore();
};

AD.SPECIES=[];
AD.addSpecies=function(s){AD.SPECIES.push(s);};
})();
