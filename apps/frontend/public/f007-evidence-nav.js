/** Evidence Lab V17 — ? button next to course footer text */
(function(){'use strict';if(window.__EVIDENCE_Q__)return;window.__EVIDENCE_Q__=true;

var HOME='/ai-evidence-lab/index.html';
var URLS={
  digital:'/ai-evidence-lab/pages/01-digital-human.html',
  quiz:'/ai-evidence-lab/pages/02-quiz.html',
  step:'/ai-evidence-lab/pages/03-adaptive-step.html',
  career:'/ai-evidence-lab/pages/04-career-recommendation.html',
  evidence:'/ai-evidence-lab/pages/05-evidence-chain.html'
};
var T={digital:['查看数字人算法与理论依据','View AI-Mentor theoretical reference'],
  quiz:['查看Quiz评估机制附录','View quiz assessment appendix'],
  career:['查看职业推荐算法附录','View career recommendation appendix'],
  step:['查看分层教学理论证据','View step teaching evidence'],
  evidence:['查看学习画像证据附录','View learning profile evidence'],
  home:['完整查看全部算法证据附录','View complete evidence appendix']};
function lang(){try{var l=localStorage.getItem('i18n-lang')||localStorage.getItem('edu-lang')||localStorage.getItem('aix_platform_lang');return(l==='en'||l==='en-US')?1:0;}catch(e){return 0;}}
function tip(k){var a=T[k];return a?a[lang()]:'';}

(function(){var s=document.createElement('style');s.id='evq-css';
s.textContent='.evq{display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;border-radius:50%;border:1px solid rgb(101 231 242/20%);background:rgb(12 17 31/65%);color:#65e7f2;font-size:12px;font-weight:700;cursor:pointer;transition:all .15s;flex-shrink:0;line-height:1;position:relative;margin-left:6px}.evq:hover{border-color:#c7ff68;color:#c7ff68;background:rgb(199 255 104/10%)}.evq::after{content:attr(data-tip);position:absolute;bottom:24px;left:50%;transform:translateX(-50%);white-space:nowrap;font-size:10px;font-weight:400;color:#f4f7ff;background:rgb(12 17 31/94%);border:1px solid rgb(101 231 242/20%);border-radius:5px;padding:3px 8px;pointer-events:none;opacity:0;transition:opacity .12s}.evq:hover::after{opacity:1}.evq-global{position:fixed;z-index:9999;left:24px;bottom:24px;width:34px;height:34px;border-radius:50%;border:1px solid rgb(101 231 242/22%);background:rgb(12 17 31/82%);color:#65e7f2;font-size:18px;font-weight:700;cursor:pointer;transition:all .2s;display:flex;align-items:center;justify-content:center;box-shadow:0 6px 20px rgb(0 0 0/30%)}.evq-global:hover{border-color:#c7ff68;color:#c7ff68;transform:scale(1.08);box-shadow:0 0 18px rgb(199 255 104/14%),0 6px 20px rgb(0 0 0/30%)}.evq-global::after{content:attr(data-tip);position:absolute;bottom:42px;left:0;white-space:nowrap;font-size:11px;font-weight:400;color:#f4f7ff;background:rgb(12 17 31/94%);border:1px solid rgb(101 231 242/20%);border-radius:6px;padding:4px 10px;pointer-events:none;opacity:0;transition:opacity .12s}.evq-global:hover::after{opacity:1}.evq-modal{display:none;position:fixed;inset:0;z-index:99999;background:rgb(3 6 15/84%);backdrop-filter:blur(10px);align-items:center;justify-content:center;flex-direction:column}.evq-modal--on{display:flex}.evq-modal__bar{display:flex;align-items:center;width:85vw;max-width:1400px;margin-bottom:8px}.evq-modal__title{color:#909bb9;font-size:12px;flex:1}.evq-modal__close{width:30px;height:30px;display:flex;align-items:center;justify-content:center;border-radius:50%;border:1px solid rgb(150 169 211/16%);background:rgb(12 17 31/78%);color:#909bb9;font-size:15px;cursor:pointer;transition:all .18s}.evq-modal__close:hover{border-color:#ff6bb5;color:#ff6bb5}.evq-modal__frame{width:85vw;height:80vh;max-width:1400px;border:1px solid rgb(101 231 242/16%);border-radius:14px;background:#080b16;box-shadow:0 20px 70px rgb(0 0 0/50%)}';document.head.appendChild(s);})();

var modal,iframeEl;
function ensureModal(){if(modal)return;modal=document.createElement('div');modal.className='evq-modal';modal.id='evq-modal';modal.innerHTML='<div class="evq-modal__bar"><span class="evq-modal__title" id="evq-mt"></span><span class="evq-modal__close" id="evq-mx">X</span></div><iframe class="evq-modal__frame" id="evq-mi" src="" sandbox="allow-scripts allow-same-origin"></iframe>';document.body.appendChild(modal);iframeEl=document.getElementById('evq-mi');document.getElementById('evq-mx').addEventListener('click',closeM);modal.addEventListener('click',function(e){if(e.target===modal)closeM();});document.addEventListener('keydown',function(e){if(e.key==='Escape')closeM();});}
function openM(url,title){ensureModal();document.getElementById('evq-mt').textContent=title||'';iframeEl.src=url;modal.classList.add('evq-modal--on');document.body.style.overflow='hidden';}
function closeM(){if(!modal)return;modal.classList.remove('evq-modal--on');iframeEl.src='';document.body.style.overflow='';}
function makeQ(tipKey,url){var q=document.createElement('span');q.className='evq';q.textContent='?';q.setAttribute('data-tip',tip(tipKey));q.addEventListener('click',function(e){e.preventDefault();e.stopPropagation();var u=typeof url==='function'?url():url;openM(u,tip(tipKey));});return q;}
function placeTR(container,tipKey,url){if(!container||container.querySelector('.evq'))return;var cs=window.getComputedStyle(container);if(cs.position==='static')container.style.position='relative';var q=makeQ(tipKey,url);q.style.cssText='position:absolute;top:6px;right:6px;z-index:10';container.appendChild(q);return q;}

var TAB_MAP={};
TAB_MAP['Profile']='evidence'; TAB_MAP['Answer Records']='quiz'; TAB_MAP['Ask Mentor']='digital'; TAB_MAP['Study Plan']='home';
function detectActiveTab(){
  var MAP={'Profile':'evidence','Answer Records':'quiz','Ask Mentor':'digital','Study Plan':'home'};
  var btns=document.querySelectorAll('button');
  for(var i=0;i<btns.length;i++){
    var t=btns[i].textContent.trim();
    if(MAP.hasOwnProperty(t)&&btns[i].offsetWidth>0){
      var c=window.getComputedStyle(btns[i]).color;
      if(c==='rgb(199, 255, 79)'||c.indexOf('199, 255')>=0)return MAP[t];
    }
  }
  return'home';
}

function injectStepQ(){
  if(document.getElementById('evq-step-q'))return;
  // Only inject on course pages — look for mode-gate or executor footer text
  var els=document.querySelectorAll('span,small');
  for(var i=0;i<els.length&&i<500;i++){
    var t=els[i].textContent||'';
    // Exact matches for course footer text (NOT dashboard text)
    if((t==='来自原平台数据库'||t.indexOf('个真实步骤')!==-1||t.indexOf('个原课程步骤')!==-1)&&els[i].offsetWidth>0){
      console.log('[Evidence] Step Q injected:', els[i].tagName, t.substring(0,30));
      var q=makeQ('step',URLS.step);
      q.id='evq-step-q';
      q.style.marginLeft='6px';
      els[i].appendChild(q);
      return;
    }
  }
}

var mentorQ=null;
function injectAll(){
  // 1. Learning Advisor panel
  var panel=null;
  var allDivs=document.querySelectorAll('div,span');
  for(var i=0;i<allDivs.length&&i<500;i++){
    var et=allDivs[i].textContent.trim();
    if(et==='Learning Advisor'||et==='AI Learning Mentor'||et==='学习顾问'||et==='AI学习导师'){
      panel=allDivs[i];while(panel&&panel.offsetWidth<300&&panel.parentElement)panel=panel.parentElement;
      if(panel&&panel.offsetWidth>=300)break;
    }
  }
  if(!panel){var btns=document.querySelectorAll('button');for(var j=0;j<btns.length;j++){var bt=btns[j].textContent.trim();if(bt==='Profile'||bt==='个人资料'||bt==='Ask Mentor'||bt==='向导师提问'){panel=btns[j];while(panel&&panel.offsetWidth<300&&panel.parentElement)panel=panel.parentElement;if(panel&&panel.offsetWidth>=300)break;}}}
  if(panel&&panel.offsetWidth>0&&!panel.querySelector('.evq')){mentorQ=placeTR(panel,'digital',function(){var tab=detectActiveTab();return URLS[tab]||HOME;});}
  if(mentorQ&&document.body.contains(mentorQ)){var tab=detectActiveTab();mentorQ.setAttribute('data-tip',tip(tab));}

  // 2. Career page
  var cPage=document.querySelector('[class*="interest"],[class*="career"],[class*="discover"]');
  if(!cPage){var els=document.querySelectorAll('h1,h2,h3,div,span,p');for(var k=0;k<els.length&&k<400;k++){var et2=(els[k].textContent||'').trim();if(et2==='Step 1'||et2==='步骤 1'||et2==='Choose a future career'||et2==='选择未来职业'){cPage=els[k];while(cPage&&cPage.offsetWidth<500&&cPage.parentElement)cPage=cPage.parentElement;break;}}}
  if(cPage&&cPage.offsetWidth>0&&!cPage.querySelector('.evq'))placeTR(cPage,'career',URLS.career);

  // 3. Step ? button — placed next to "带着学包含 N 个真实步骤 / 来自原平台数据库"
  injectStepQ();
}

function addGlobal(){if(document.getElementById('evq-global'))return;var g=document.createElement('div');g.id='evq-global';g.className='evq-global';g.textContent='?';g.setAttribute('data-tip',tip('home'));g.addEventListener('click',function(){window.open(HOME,'_blank');});document.body.appendChild(g);}

function init(){console.log('[Evidence] V17');try{addGlobal();}catch(e){}try{ensureModal();}catch(e){}injectAll();setInterval(injectAll,3000);}
if(document.readyState==='complete'){setTimeout(init,800);}else{window.addEventListener('load',function(){setTimeout(init,800);});}
})();
