var heroName = document.getElementById('heroName');
var navLogo = document.getElementById('navLogo');
var nav = document.getElementById('nav');
var aboutSection = document.getElementById('about');

var morph = {startLeft:0, startTop:0, dx:0, dy:0, scaleRatio:1, travel:1, ready:false};

// 이미지가 없거나(404) 로드에 실패하면 라벨이 있는 회색 placeholder로 즉시 교체
// (스크립트가 실행되는 시점엔 이미 실패가 끝나 있는 경우도 있어 complete/naturalWidth로 먼저 확인)
function applyImgFallback(img){
  var placeholder = document.createElement('div');
  placeholder.className = 'img-placeholder';
  placeholder.textContent = img.dataset.fallback;
  img.replaceWith(placeholder);
}
document.querySelectorAll('img[data-fallback]').forEach(function(img){
  if(img.complete && img.naturalWidth === 0){
    applyImgFallback(img);
  } else {
    img.addEventListener('error', function(){ applyImgFallback(img); }, {once:true});
  }
});

// hero-logo-img는 object-fit:contain이라 실제로 그려지는 그림이 박스보다
// 좁을 수 있다(가로 여백). 스케일/이동 계산은 박스가 아니라 이 "실제로
// 그려지는 영역"을 기준으로 해야 목표 크기(예: nav 72px)에 정확히 맞는다.
function containRect(box, natW, natH){
  var boxRatio = box.width / box.height;
  var imgRatio = natW / natH;
  var w, h;
  if(imgRatio > boxRatio){
    w = box.width;
    h = w / imgRatio;
  } else {
    h = box.height;
    w = h * imgRatio;
  }
  return {
    width: w,
    height: h,
    left: box.left + (box.width - w) / 2,
    top: box.top + (box.height - h) / 2
  };
}

// 큰 로고 → 상단 내비 로고 자리까지 이동/축소하는 FLIP 애니메이션 준비
// (position:static 상태에서의 "원래 위치"를 다시 측정한 뒤 position:fixed로 전환)
function measureMorph(){
  if(!heroName || !navLogo) return;

  var scrollY = window.scrollY;

  var startRect = heroName.getBoundingClientRect();
  var targetRect = navLogo.getBoundingClientRect();

  var logoImg = heroName.querySelector('img');
  var natW = logoImg ? logoImg.naturalWidth : 0;
  var natH = logoImg ? logoImg.naturalHeight : 0;
  var paintedStart = (natW && natH) ? containRect(startRect, natW, natH) : startRect;
  var paintedTarget = (natW && natH) ? containRect(targetRect, natW, natH) : targetRect;

  morph.startLeft = startRect.left;
  morph.startTop = startRect.top + scrollY; // scrollY=0 기준 절대 좌표로 역산
  morph.scaleRatio = paintedStart.width > 0 ? (paintedTarget.width / paintedStart.width) : 1;

  // 박스의 좌상단(transform-origin)을 기준으로 스케일이 적용되므로,
  // 실제 그림이 박스 안에서 치우쳐 있는 만큼(offsetX/Y)을 보정해야
  // 스케일 후에도 그림의 좌상단이 목표 위치에 정확히 도착한다.
  var offsetX = paintedStart.left - startRect.left;
  var offsetY = paintedStart.top - startRect.top;
  morph.dx = paintedTarget.left - startRect.left - morph.scaleRatio * offsetX;
  morph.dy = paintedTarget.top - startRect.top - morph.scaleRatio * offsetY;

  // about 섹션의 세로 중앙이 화면 중앙에 오는 시점까지를 애니메이션 구간으로 잡는다
  // (기존엔 로고 자체 이동 거리만큼만 스크롤하면 끝나서 너무 빨리 끝나 보였음)
  if(aboutSection){
    var aboutCenterDoc = aboutSection.offsetTop + aboutSection.offsetHeight / 2;
    morph.travel = Math.max(1, aboutCenterDoc - window.innerHeight / 2);
  } else {
    morph.travel = Math.max(1, -morph.dy);
  }

  heroName.style.position = 'fixed';
  heroName.style.left = morph.startLeft + 'px';
  heroName.style.top = morph.startTop + 'px';
  heroName.style.transformOrigin = '0 0';
  morph.ready = true;

  updateMorph();
}

function easeOutCubic(p){
  return 1 - Math.pow(1 - p, 3);
}

function updateMorph(){
  if(!morph.ready) return;
  var p = Math.min(1, Math.max(0, window.scrollY / morph.travel));
  var eased = easeOutCubic(p);
  var tx = morph.dx * eased;
  var ty = morph.dy * eased;
  var s = 1 + (morph.scaleRatio - 1) * eased;
  heroName.style.transform = 'translate(' + tx + 'px, ' + ty + 'px) scale(' + s + ')';
  nav.classList.toggle('scrolled', window.scrollY > 10);
}

function init(){
  // 이동 전, .hero 안 원래 위치를 기준으로 먼저 측정해야 한다
  // (측정 후 position:fixed로 전환되므로, 그 뒤에 부모를 body로 옮겨도
  //  화면상 좌표는 그대로 유지된다)
  measureMorph();

  // .hero가 만드는 stacking context 밖으로 꺼내야 스크롤 후 about/work/contact
  // 섹션 위로도 로고가 계속 보인다 (안 그러면 .hero 뒤에 가려짐)
  if(heroName.parentElement !== document.body){
    document.body.appendChild(heroName);
  }
}

// 로고 이미지의 실제 크기(가로세로 비율)를 알아야 정확히 측정되므로,
// 그 이미지가 로드(또는 실패) 완료된 뒤 최초 측정을 실행한다
var heroLogoImg = heroName ? heroName.querySelector('img') : null;
if(heroLogoImg){
  if(heroLogoImg.complete){
    init();
  } else {
    heroLogoImg.addEventListener('load', init, {once:true});
    heroLogoImg.addEventListener('error', init, {once:true});
  }
} else {
  init();
}
window.addEventListener('load', init); // 폰트 등 나머지 리소스까지 반영해 한 번 더 보정

var scrollTicking = false;
window.addEventListener('scroll', function(){
  if(!scrollTicking){
    window.requestAnimationFrame(function(){
      updateMorph();
      scrollTicking = false;
    });
    scrollTicking = true;
  }
}, {passive:true});

var resizeTimer;
window.addEventListener('resize', function(){
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(init, 150);
});
