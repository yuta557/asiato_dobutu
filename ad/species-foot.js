/* 足あとのどうぶつ：足あとを逆さにして、かかと＝顔、指＝あし */
(function(){
"use strict";
var AD=window.AD,PI=Math.PI;

function drawFoot(sp){
  return function(g,a,t){
    var u=a.u,ci=sp.col,da=a.deco==null?1:a.deco;
    g.save();g.translate(0,-.97*u);
    if(da>0&&sp.back){g.save();g.globalAlpha*=da;sp.back(g,u,a,t,ci);g.restore();}
    g.save();g.rotate(PI);AD.stamp(g,AD.footPath(u),ci,u);AD.footCreases(g,ci,u);g.restore();
    if(da>0){g.save();g.globalAlpha*=da;AD.ink(g,u);sp.front(g,u,a,t,ci);g.restore();}
    g.restore();
  };
}
function whiskers(g,x,y,u,dir){
  g.save();g.lineWidth=Math.max(.8,u*.02);g.strokeStyle="rgba(58,44,36,.75)";
  AD.line(g,x,y,x+.26*u*dir,y-.04*u);AD.line(g,x,y+.04*u,x+.26*u*dir,y+.07*u);
  g.restore();
}
function mouthW(g,x,y,u,open){
  if(open){g.save();g.fillStyle="#B8485A";g.beginPath();g.ellipse(x,y+.03*u,.04*u,.035*u,0,0,PI*2);g.fill();g.restore();return;}
  g.beginPath();g.arc(x-.035*u,y,.035*u,.1*PI,.9*PI);g.stroke();
  g.beginPath();g.arc(x+.035*u,y,.035*u,.1*PI,.9*PI);g.stroke();
}
function def(sp){sp.kind="foot";sp.draw=drawFoot(sp);AD.addSpecies(sp);}

def({key:"foot0",col:0,name:"ヒヨコ",motion:"hop",
  born:"ぴよっ！",tap:["ぴよぴよ！","ぴよっ","おなかすいた〜","ママどこ〜？"],
  hello:["ぴよっ、こんにちは！","あそぼ、ぴよ！"],
  front:function(g,u,a,t,ci){
    g.save();g.strokeStyle=AD.shade(ci,.72,1);g.lineWidth=Math.max(1,u*.035);
    [[-.04,-.92,-.14,-1.02,-.10,-1.08],[.02,-.93,.0,-1.04,.05,-1.10],[.08,-.92,.16,-.98,.16,-1.05]].forEach(function(c){
      g.beginPath();g.moveTo(c[0]*u,c[1]*u);g.quadraticCurveTo(c[2]*u,c[3]*u,c[4]*u,c[5]*u);g.stroke();});
    var fl=a.moving||a.z>0?Math.sin(t*18)*.25:0;
    g.translate(-.14*u,.10*u);g.rotate(.3+fl);g.beginPath();g.ellipse(0,0,.12*u,.20*u,0,-.35*PI,.95*PI);g.stroke();
    g.restore();
    AD.eye(g,-.06*u,-.70*u,.042*u,a);AD.eye(g,.15*u,-.70*u,.042*u,a);
    g.save();g.fillStyle="#EE8A2C";var o=a.talk>0?.035*u:0;
    g.beginPath();g.moveTo(.0,-.60*u-o);g.lineTo(.09*u,-.66*u-o);g.lineTo(.20*u,-.60*u-o);g.closePath();g.fill();
    g.beginPath();g.moveTo(.0,-.60*u+o);g.lineTo(.20*u,-.60*u+o);g.lineTo(.09*u,-.55*u+o);g.closePath();g.fill();
    g.restore();
    AD.cheek(g,-.15*u,-.60*u,.045*u);AD.cheek(g,.26*u,-.61*u,.045*u);
  }});

def({key:"foot1",col:1,name:"ウサギ",motion:"hop",
  born:"ぴょん！",tap:["ぴょんぴょん！","にんじん、ないかな〜","おみみ、ながいでしょ"],
  hello:["こんにちは、ぴょん","いっしょにはねよう！"],
  back:function(g,u,a,t,ci){
    g.save();g.fillStyle="#FFF9F4";g.strokeStyle="rgba(200,160,170,.7)";g.lineWidth=Math.max(1,u*.03);
    g.beginPath();g.arc(-.37*u,.46*u,.11*u,0,PI*2);g.fill();g.stroke();g.restore();
    var fl=Math.min(.25,a.z/u*.4)+(a.sleep?.3:0);
    var E=[[-.10,-.80,-.22-fl,-1.52+fl*.6],[.08,-.82,.16-fl*.5,-1.56+fl*.5]];
    AD.stampShape(g,ci,u,function(p){E.forEach(function(e){AD.capsule(p,e[0]*u,e[1]*u,e[2]*u,e[3]*u,.10*u);});});
    g.save();g.strokeStyle="rgba(255,226,234,.95)";g.lineCap="round";g.lineWidth=.07*u;
    E.forEach(function(e){AD.line(g,(e[0]+(e[2]-e[0])*.25)*u,(e[1]+(e[3]-e[1])*.25)*u,(e[0]+(e[2]-e[0])*.9)*u,(e[1]+(e[3]-e[1])*.9)*u);});
    g.restore();
  },
  front:function(g,u,a,t,ci){
    AD.eye(g,-.06*u,-.68*u,.042*u,a);AD.eye(g,.15*u,-.68*u,.042*u,a);
    g.save();g.fillStyle="#C4506A";g.beginPath();g.moveTo(.01*u,-.60*u);g.lineTo(.09*u,-.60*u);g.lineTo(.05*u,-.555*u);g.closePath();g.fill();g.restore();
    mouthW(g,.05*u,-.54*u,u,a.talk>0);
    whiskers(g,.20*u,-.57*u,u,1);whiskers(g,-.10*u,-.57*u,u,-1);
    AD.cheek(g,-.15*u,-.58*u,.045*u);AD.cheek(g,.25*u,-.58*u,.045*u);
  }});

def({key:"foot2",col:2,name:"ゾウ",motion:"waddle",
  born:"ぱおーん！",tap:["ぱおーん！","みずあび、したいな","おはな、ながーいでしょ"],
  hello:["ぱおん、こんにちは","なかよくしてね"],
  back:function(g,u,a,t,ci){
    var k=1+.07*Math.sin(t*3+a.seed);
    AD.stampShape(g,ci,u,function(p){AD.ellipse(p,-.31*u,-.60*u,.21*u*k,.26*u,.2);AD.ellipse(p,.31*u,-.60*u,.21*u*k,.26*u,-.2);});
    g.save();g.fillStyle=AD.shade(ci,.82,.35);
    g.beginPath();g.ellipse(-.33*u,-.58*u,.12*u*k,.16*u,.2,0,PI*2);g.fill();
    g.beginPath();g.ellipse(.33*u,-.58*u,.12*u*k,.16*u,-.2,0,PI*2);g.fill();g.restore();
  },
  front:function(g,u,a,t,ci){
    var lift=a.talk>0?.26:0,sw=Math.sin(t*2.4+a.seed)*.04;
    AD.stampLine(g,ci,u,.12*u,function(c){c.moveTo(.03*u,-.58*u);c.bezierCurveTo(.07*u,-.36*u,-.02*u,-.16*u,.08*u,(-.02-lift*.4)*u);c.quadraticCurveTo((.18+sw)*u,(.04-lift)*u,(.26+sw)*u,(-.08-lift)*u);});
    g.save();g.strokeStyle="#FFFDF5";g.lineWidth=Math.max(1.2,u*.04);
    AD.line(g,-.05*u,-.52*u,-.11*u,-.43*u);AD.line(g,.13*u,-.52*u,.19*u,-.43*u);g.restore();
    AD.eye(g,-.09*u,-.72*u,.038*u,a);AD.eye(g,.16*u,-.72*u,.038*u,a);
    AD.cheek(g,-.17*u,-.62*u,.045*u);AD.cheek(g,.25*u,-.62*u,.045*u);
  }});

def({key:"foot3",col:3,name:"クマ",motion:"waddle",
  born:"くまっ！",tap:["くま〜","はちみつ、だいすき","ぎゅーってしよう"],
  hello:["やあ、こんにちは","あそぼうよ〜"],
  back:function(g,u,a,t,ci){
    AD.stampShape(g,ci,u,function(p){AD.circle(p,-.21*u,-.90*u,.10*u);AD.circle(p,.21*u,-.90*u,.10*u);});
    g.save();g.fillStyle=AD.shade(ci,.62,.5);AD.dot(g,-.21*u,-.90*u,.05*u);AD.dot(g,.21*u,-.90*u,.05*u);g.restore();
  },
  front:function(g,u,a,t,ci){
    g.save();g.fillStyle="rgba(241,222,196,.9)";g.beginPath();g.ellipse(0,.26*u,.20*u,.22*u,0,0,PI*2);g.globalAlpha*=.55;g.fill();g.restore();
    g.save();g.fillStyle="#EFD9BC";g.beginPath();g.ellipse(.03*u,-.58*u,.125*u,.09*u,0,0,PI*2);g.fill();g.restore();
    g.beginPath();g.ellipse(.03*u,-.62*u,.045*u,.03*u,0,0,PI*2);g.fill();
    if(a.talk>0){g.save();g.fillStyle="#9C3E3E";AD.dot(g,.03*u,-.54*u,.03*u);g.restore();}
    else AD.line(g,.03*u,-.60*u,.03*u,-.55*u);
    AD.eye(g,-.08*u,-.72*u,.04*u,a);AD.eye(g,.14*u,-.72*u,.04*u,a);
  }});

def({key:"foot4",col:4,name:"ネコ",motion:"hop",
  born:"にゃーん！",tap:["にゃーん","ごろごろ…","ねこじゃらし、ある？"],
  hello:["にゃっ、こんにちは","いっしょにあそぶにゃ"],
  back:function(g,u,a,t,ci){
    var sw=Math.sin(t*2+a.seed)*.10;
    AD.stampLine(g,ci,u,.09*u,function(c){c.moveTo(-.24*u,.60*u);c.bezierCurveTo(-.62*u,.56*u,-.72*u,(.12+sw)*u,(-.50+sw)*u,-.16*u);});
    AD.stampShape(g,ci,u,function(p){
      p.moveTo(-.26*u,-.76*u);p.lineTo(-.23*u,-1.07*u);p.lineTo(-.02*u,-.90*u);p.closePath();
      p.moveTo(.26*u,-.76*u);p.lineTo(.23*u,-1.07*u);p.lineTo(.02*u,-.90*u);p.closePath();});
  },
  front:function(g,u,a,t,ci){
    g.save();g.strokeStyle=AD.shade(ci,.6,.85);g.lineWidth=Math.max(1,u*.035);
    AD.line(g,-.06*u,-.92*u,-.06*u,-.83*u);AD.line(g,.03*u,-.94*u,.03*u,-.84*u);AD.line(g,.12*u,-.92*u,.12*u,-.83*u);
    AD.line(g,-.40*u,.24*u,-.30*u,.26*u);AD.line(g,-.41*u,.36*u,-.31*u,.37*u);g.restore();
    AD.eye(g,-.07*u,-.68*u,.042*u,a);AD.eye(g,.15*u,-.68*u,.042*u,a);
    g.save();g.fillStyle="#D9607A";g.beginPath();g.moveTo(.0,-.60*u);g.lineTo(.08*u,-.60*u);g.lineTo(.04*u,-.555*u);g.closePath();g.fill();g.restore();
    mouthW(g,.04*u,-.54*u,u,a.talk>0);
    whiskers(g,.20*u,-.57*u,u,1);whiskers(g,-.12*u,-.57*u,u,-1);
  }});

def({key:"foot5",col:5,name:"コアラ",motion:"waddle",sleepy:true,
  born:"こあっ！",tap:["ねむいなあ…","ユーカリ、たべたい","だっこして〜"],
  hello:["こんにちは〜…","ゆっくりあそぼ"],
  back:function(g,u,a,t,ci){
    AD.stampShape(g,ci,u,function(p){AD.circle(p,-.30*u,-.80*u,.16*u);AD.circle(p,.30*u,-.80*u,.16*u);});
    g.save();g.fillStyle="rgba(255,255,255,.75)";AD.blob(g,-.31*u,-.79*u,.085*u,"rgba(255,255,255,.75)",1);AD.blob(g,.31*u,-.79*u,.085*u,"rgba(255,255,255,.75)",2);g.restore();
  },
  front:function(g,u,a,t,ci){
    g.save();g.globalAlpha*=.5;g.fillStyle="#FFFFFF";g.beginPath();g.ellipse(0,.28*u,.19*u,.23*u,0,0,PI*2);g.fill();g.restore();
    g.save();g.fillStyle="#4B4A52";g.beginPath();g.ellipse(.03*u,-.60*u,.065*u,.095*u,0,0,PI*2);g.fill();g.restore();
    if(a.talk>0){g.save();g.fillStyle="#9C3E3E";AD.dot(g,.03*u,-.47*u,.028*u);g.restore();}
    AD.eye(g,-.10*u,-.70*u,.036*u,a);AD.eye(g,.16*u,-.70*u,.036*u,a);
    AD.cheek(g,-.17*u,-.58*u,.045*u);AD.cheek(g,.23*u,-.58*u,.045*u);
  }});
})();
