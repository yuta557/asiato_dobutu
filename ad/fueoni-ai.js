/* ふえおに：にげる子の 頭（おぼえさせた もの）
   ──────────────────────────────────────────────
   ・おには さわらない。にげる子の「行きさき」だけを きめる。
   ・きめた あとは 元コードの go(a,x,y,mult) に わたすので、
     うごき・水・よけ・絵は ぜんぶ これまでどおり。
   ・重みが ないとき／へんな 値が 出たときは、元の X.fleeFrom に もどる。

   つかいかた（index.html）：
     <script src="ad/acts-group.js?v=18"></script>
     <script src="ad/fueoni-weights.js?v=1"></script>
     <script src="ad/fueoni-ai.js?v=1"></script>
   そのうえで ad/acts-group.js を 1か所だけ なおす（PATCH.md）。
*/
(function () {
"use strict";
var AD = window.AD, S = AD.scene, P = AD.play;
var PI = Math.PI, TAU = PI * 2;
var ONI_SEC = 30;          /* acts-group.js と 同じ */
var N_DIR = 16;            /* 行きさきの 向きの かず */
var N_ACT = 33;            /* 行動 ＝ 16方向 × {ふつう, 本気} ＋「その場で 止まる」*/
var STOP_ACT = 32;         /* うろうろ する くらいなら 止まる */
var WANDER_TAU = 0.75;     /* 何びょう ぶんの うごきを 見て「うろうろ」と 数えるか */
var WANDER_MIN = 0.30;     /* これより おそい ときは 止まって いると みなす */
var DASH_MULT = 1.85;      /* 本気の ときの はやさ（ふつう 1.42／おに 1.58）*/
var DASH_R = 10;           /* おにが 体 いくつぶん まで 近い ときに 本気を ゆるすか */
var DASH_MIN = 2.5;        /* これより 近いと 本気は 出せない（突っ込みで 出さない ため）*/
/* かぞえて いる あいだの ちらばり方（sim/env.py の _start_spot と 同じ）*/
var COUNT_SEC = 3.4;       /* acts-group.js の s.count と 同じ */
var START_MULT = 1.9;      /* かぞえて いる あいだの はやさ（元コードは 1.5）*/
var START_FAR = 16;        /* これ以上 はなれても うれしさは 変わらない（体いくつ分）*/
var START_NEAR = 6;        /* これより 近い ところから はじまるのは とくに まずい */
var START_NEAR_W = 1.5;
var START_CORNER_W = 2.0;  /* すみから はじまるのも まずい */
var START_MATE = 0.12;     /* なかまと はなれる ぶん（この 場面では ほとんど 考えない）*/
var CORNER_R = 4;

var AI = AD.fueoniAI = {
  ready: false,   /* 重みが 読めたか */
  on: true,       /* 切りかえ用（AD.fueoniAI.on=false で 元の うごきに もどる） */
  DECIDE: 5,      /* 何フレームごとに 行きさきを きめなおすか */
  temp: 0         /* 0＝いつも いちばん よい手。0.4 くらいに すると すこし ばらつく */
};

var W = null;
function load() {
  var w = window.AD && AD.fueoniW;
  if (!w || !w.W1 || w.obs !== 56 || w.act !== N_ACT) return;
  W = w;
  AI.DECIDE = w.decide_every || 5;
  AI.ready = true;
}

/* ---- 2そう の ちいさな ネット（かけ算だけ。ライブラリは いらない）---- */
function layer(x, Wm, b, act) {
  var n = b.length, out = new Array(n), i, j, s, col;
  for (j = 0; j < n; j++) {
    s = b[j];
    for (i = 0; i < x.length; i++) {
      col = Wm[i];
      s += x[i] * col[j];
    }
    out[j] = act ? Math.tanh(s) : s;
  }
  return out;
}
function policy(obs) {
  var h1 = layer(obs, W.W1, W.b1, true);
  var h2 = layer(h1, W.W2, W.b2, true);
  return layer(h2, W.W3, W.b3, false);
}

function clip(v, a, b) { return v < a ? a : (v > b ? b : v); }

/* ---- 見えている もの を 56この 数に する（学習に つかった sim/env.py と 同じ 順番）---- */
function observe(s, r) {
  var o = new Array(56), k = 0, i;
  var spd = Math.max(r.u * 1.55 * (r.even || 1) * 1.42, 1e-6);
  o[k++] = (r.x / S.W) * 2 - 1;
  o[k++] = ((r.y - S.top) / (S.bottom - S.top)) * 2 - 1;
  o[k++] = clip((r.aivx || 0) / spd, -1, 1);
  o[k++] = clip((r.aivy || 0) / spd, -1, 1);
  var left = ONI_SEC - (s.t - (s.runT0 || 0));
  o[k++] = clip(left / ONI_SEC, 0, 1) * 2 - 1;
  o[k++] = P.inWater(r.x, r.y, 1) ? 1 : -1;
  o[k++] = clip(r.x / (r.u * 6), 0, 1);
  o[k++] = clip((S.W - r.x) / (r.u * 6), 0, 1);
  o[k++] = clip((r.y - S.top) / (r.u * 4), 0, 1);
  o[k++] = clip((S.bottom - r.y) / (r.u * 4), 0, 1);

  var onis = s.onis.slice().sort(function (p, q) { return AD.dist(r, p) - AD.dist(r, q); });
  for (i = 0; i < 3; i++) {
    var c = onis[i];
    if (c) {
      var dx = c.x - r.x, dy = c.y - r.y, d = Math.hypot(dx, dy) || 1e-6;
      o[k++] = dx / d; o[k++] = dy / d;
      o[k++] = clip(1 - d / (r.u * 10), 0, 1);
      o[k++] = clip((c.aivx || 0) / spd, -1, 1);
      o[k++] = clip((c.aivy || 0) / spd, -1, 1);
    } else { o[k++] = 0; o[k++] = 0; o[k++] = 0; o[k++] = 0; o[k++] = 0; }
  }
  var mates = s.rs.filter(function (w) { return w !== r; })
                  .sort(function (p, q) { return AD.dist(r, p) - AD.dist(r, q); });
  for (i = 0; i < 2; i++) {
    var m = mates[i];
    if (m) {
      var mx = m.x - r.x, my = m.y - r.y, md = Math.hypot(mx, my) || 1e-6;
      o[k++] = mx / md; o[k++] = my / md;
      o[k++] = clip(1 - md / (r.u * 10), 0, 1);
    } else { o[k++] = 0; o[k++] = 0; o[k++] = 0; }
  }
  for (i = 0; i < 8; i++) {
    var an = i * PI / 4, ca = Math.cos(an), sa = Math.sin(an);
    o[k++] = S.clear(r.x + ca * r.u * 2, r.y + sa * r.u * 2 * 0.7, r.u) ? 1 : -1;
    o[k++] = S.clear(r.x + ca * r.u * 4, r.y + sa * r.u * 4 * 0.7, r.u) ? 1 : -1;
  }
  var hx = r.tx - r.x, hy = r.ty - r.y, hl = Math.hypot(hx, hy);
  if (hl < 1e-6) { o[k++] = 0; o[k++] = 0; }
  else { o[k++] = hx / hl; o[k++] = hy / hl; }

  /* みんな（ほかの にげる子）の かたまり と、その「うら」 */
  var sx = 0, sy = 0, nm = 0;
  for (i = 0; i < s.rs.length; i++) {
    if (s.rs[i] !== r) { sx += s.rs[i].x; sy += s.rs[i].y; nm++; }
  }
  if (!nm) { o[k++] = 0; o[k++] = 0; o[k++] = 0; o[k++] = 0; }
  else {
    var cx = sx / nm, cy = sy / nm;
    var gx = cx - r.x, gy = cy - r.y, gd = Math.hypot(gx, gy) || 1e-6;
    o[k++] = gx / gd; o[k++] = gy / gd;
    o[k++] = clip(1 - gd / (r.u * 14), 0, 1);
    o[k++] = backness(r, onis[0], cx, cy);
  }
  /* じぶんが いま 行ったり 来たり して いないか */
  o[k++] = wanderness(r) * 2 - 1;
  /* いま 自分が ねらわれて いるか（+1＝自分, -1＝ほかの子）と、
     その おには ねらって いる子に どれだけ 近いか */
  var c0 = onis[0];
  if (!c0 || !c0.aim) { o[k++] = -1; o[k++] = 1; }
  else {
    o[k++] = (c0.aim === r) ? 1 : -1;
    o[k++] = clip(Math.hypot(c0.x - c0.aim.x, c0.y - c0.aim.y) / Math.max(r.u, 1e-6) / 10, 0, 1);
  }
  return o;
}
/* 0＝まっすぐ 走って いる, 1＝同じ ところを 行ったり 来たり して いる */
function wanderness(r) {
  if (!(r.aasp > 0) || r.aasp < r.u * WANDER_MIN) return 0;
  return clip(1 - Math.hypot(r.aavx || 0, r.aavy || 0) / Math.max(r.aasp, 1e-6), 0, 1);
}
/* +1＝みんなと おなじ側（おにの 正面）、-1＝おにの むこう側（うらを とれている） */
function backness(r, c, cx, cy) {
  if (!c) return 0;
  var ax = cx - c.x, ay = cy - c.y, bx = r.x - c.x, by = r.y - c.y;
  var la = Math.hypot(ax, ay), lb = Math.hypot(bx, by);
  if (la < 1e-6 || lb < 1e-6) return 0;
  return clip((ax * bx + ay * by) / (la * lb), -1, 1);
}

/* うごいた はやさを おぼえておく（元コードは もっていないので ここで はかる） */
function measure(s, dt) {
  if (s.aiT === P.now || !(dt > 0)) return;
  s.aiT = P.now;
  s.m.forEach(function (a) {
    if (a.aipx == null) { a.aipx = a.x; a.aipy = a.y; }
    a.aivx = (a.x - a.aipx) / dt;
    a.aivy = (a.y - a.aipy) / dt;
    a.aipx = a.x; a.aipy = a.y;
    /* 「行ったり 来たり」を 見わける ための ならし（sim/env.py と 同じ）。
       むき つきの 平均 と むき なしの 平均を くらべる */
    if (a.aasp == null) { a.aavx = 0; a.aavy = 0; a.aasp = 0; }
    var kk = clip(dt / WANDER_TAU, 0, 1);
    a.aavx += (a.aivx - a.aavx) * kk;
    a.aavy += (a.aivy - a.aavy) * kk;
    a.aasp += (Math.hypot(a.aivx, a.aivy) - a.aasp) * kk;
  });
}

/* ふえおに の update から よばれる。
   行きさき（r.fleeP）を きめたら true、きめなかったら false（＝元の うごきに まかせる）*/
AI.step = function (s, r, c, dt) {
  if (!AI.ready || !AI.on || !W) return false;
  measure(s, dt);
  if (r.aiSess !== s) { r.aiSess = s; r.aiHold = 0; }   /* あそびが 変わったら まっさらに */
  if ((r.aiHold | 0) > 0 && r.fleeP) { r.aiHold--; return true; }
  r.aiDash = false; r.aiMult = 0;
  var obs, z, i;
  try {
    obs = observe(s, r);
    for (i = 0; i < obs.length; i++) if (!isFinite(obs[i])) return false;
    z = policy(obs);
  } catch (e) { return false; }

  var best = 0;
  if (AI.temp > 0) {
    var mx = -Infinity, sum = 0, p = new Array(N_ACT);
    for (i = 0; i < N_ACT; i++) if (z[i] > mx) mx = z[i];
    for (i = 0; i < N_ACT; i++) { p[i] = Math.exp((z[i] - mx) / AI.temp); sum += p[i]; }
    var t = Math.random() * sum;
    for (i = 0; i < N_ACT; i++) { t -= p[i]; if (t <= 0) { best = i; break; } }
  } else {
    for (i = 1; i < N_ACT; i++) if (z[i] > z[best]) best = i;
  }
  if (!isFinite(z[best])) return false;

  if (best === STOP_ACT) {
    /* その場で 止まる。じぶんの 位置を 行きさきに すると 足が 止まる */
    r.fleeP = { x: r.x, y: r.y };
    r.fleeT = 9;
    r.aiAct = best;
    r.aiHold = AI.DECIDE - 1;
    r.aiDash = false;
    r.aiMult = 0;
    return true;
  }
  var d = best % N_DIR, an = d * TAU / N_DIR, far = r.u * 4;
  var qx = r.x + Math.cos(an) * far, qy = r.y + Math.sin(an) * far * 0.7;
  r.fleeP = { x: qx, y: qy };
  r.fleeT = 9;            /* 元コードの えらびなおしは とめる（AI が きめる） */
  r.aiAct = best;
  r.aiHold = AI.DECIDE - 1;
  /* 本気（ダッシュ）は「うらを とる」ときだけ */
  r.aiDash = (best >= N_DIR) && dashOK(s, r, qx, qy);
  r.aiMult = r.aiDash ? DASH_MULT : 0;
  return true;
};

/* その 行きさきが「うらどり」に なって いるか。
   おにが 近く、そこへ ぬけると みんなと 反対がわ（おにの むこう側）に 出る とき だけ。
   sim/env.py の dash_ok と おなじ 計算 */
function dashOK(s, r, qx, qy) {
  var i, c = null, bd = 1e9;
  for (i = 0; i < s.onis.length; i++) {
    var dd = AD.dist(r, s.onis[i]);
    if (dd < bd) { bd = dd; c = s.onis[i]; }
  }
  if (!c) return false;
  var d = bd / r.u;
  if (d > DASH_R || d < DASH_MIN) return false;   /* 近すぎる＝突っ込み。本気は 出さない */
  var sx = 0, sy = 0, nm = 0;
  for (i = 0; i < s.rs.length; i++) {
    if (s.rs[i] !== r) { sx += s.rs[i].x; sy += s.rs[i].y; nm++; }
  }
  if (nm < 1) return false;
  var cx = sx / nm, cy = sy / nm;
  var now = backness(r, c, cx, cy);
  var ax = cx - c.x, ay = cy - c.y;
  var bx = qx - c.x, by = qy - c.y;
  var la = Math.hypot(ax, ay), lb = Math.hypot(bx, by);
  if (la < 1e-6 || lb < 1e-6) return false;
  var nxt = clip((ax * bx + ay * by) / (la * lb), -1, 1);
  return nxt < 0 || nxt < now - 0.05;   /* 「うら」へ 進む 手だけ */
}

/* ---- かぞえて いる あいだに 行く ところ ----
   元コードは きまった 隊形に ならぶ ので、おにの そばに のこる子が できて、
   はじまって 1〜2びょうで さいしょの 1ぴきが つかまって しまう。
   ここでは ひとりずつ「おにから 遠く、なかまとも はなれた ところ」を えらぶ。
   （sim/env.py の _start_spot と 同じ 計算） */
AI.startSpot = function (s, r, c) {
  if (!AI.on) return null;
  /* かぞえて いる あいだは おにが 止まって いる ので、やる ことは ひとつ。
     「いくぞ〜」の 瞬間に おにから いちばん 遠く いられる ところ へ 行く。
     かたまるか どうかは ここでは ほとんど 考えない（そばに いる ほうが まずい）。
     めざす点 では なく「じっさいに たどりつく点」で 点を つけるのが かんじん */
  var reach = r.u * 1.55 * (r.even || 1) * START_MULT * COUNT_SEC * 0.9;
  var best = null, bs = -1e9, i, k;
  for (k = 0; k < 24; k++) {
    var qx = r.u * 1.6 + Math.random() * (S.W - r.u * 3.2);
    var qy = S.top + r.u * 0.4 + Math.random() * ((S.bottom - r.u * 0.3) - (S.top + r.u * 0.4));
    if (!S.clear(qx, qy, r.u)) continue;
    var dq = Math.hypot(qx - r.x, qy - r.y);
    var kk = dq <= reach ? 1 : (dq > 1e-6 ? reach / dq : 0);
    var ex = r.x + (qx - r.x) * kk, ey = r.y + (qy - r.y) * kk;
    var d = Math.hypot(ex - c.x, ey - c.y) / r.u;
    var sc = Math.min(d, START_FAR);
    if (d < START_NEAR) sc -= START_NEAR_W * (START_NEAR - d) * (START_NEAR - d);
    /* すみから はじまるのも まずい */
    var wx = Math.min(ex, S.W - ex) / r.u;
    var wy = Math.min(ey - S.top, S.bottom - ey) * 1.6 / r.u;
    sc -= START_CORNER_W * clip((CORNER_R - wx) / CORNER_R, 0, 1)
                         * clip((CORNER_R - wy) / CORNER_R, 0, 1);
    for (i = 0; i < s.rs.length; i++) {
      var w = s.rs[i];
      if (w !== r) sc += Math.min(Math.hypot(ex - w.x, ey - w.y) / r.u, 4) * START_MATE;
    }
    if (sc > bs) { bs = sc; best = { x: qx, y: qy, mult: START_MULT }; }
  }
  return best;
};

/* ---- 「ふえおに しよう！」と さそう子（＝おに）を えらぶ ----
   はやさは 体の おおきさ（a.u）に ひれいする ので、
   小さい子が おに に なると **いちばん はやい にげ子に 追いつけない**。
   元コードの まま（さそった子が そのまま おに）だと、
   その かたちに なる 試合が 59% も あり、
   さいしょの 1ぴきが つかまるまで 20びょう を こえる ことが あった。
   大きい ほうの 半分から えらぶ と それが 0% に なる。
   （はやさ 1.58 も タッチ判定 0.78 も さわって いない）

   かえり値：m の なかの、さそう子に する ばんごう */
AI.pickOni = function (m) {
  if (!AI.on || !m || m.length < 2) return 0;
  /* a.u には いる場所による 大小（S.depth）も 入って いる ので、それは 割る。
     のこるのは P.U × 種類（て 1.0 / あし 0.92）× grow */
  var key = m.map(function (a, i) {
    var d = S.depth(a.y) || 1;
    return { i: i, v: a.u / d };
  });
  key.sort(function (p, q) { return q.v - p.v; });
  var half = Math.max(1, Math.floor(key.length / 2));
  return key[Math.floor(Math.random() * half)].i;
};

/* たしかめ（web/selftest.html）から よぶ ための 入口 */
AI._observe = observe;
AI._policy = policy;
AI._dashOK = dashOK;

/* 重みは あとから よみこまれる ことも あるので、両方で ためす */
load();
if (!AI.ready) window.addEventListener("load", load);
})();
