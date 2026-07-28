var heroName = document.getElementById('heroName');
var navLogo = document.getElementById('navLogo');
var aboutSection = document.getElementById('about');
var heroSection = document.getElementById('hero');

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
// 그려지는 영역"을 기준으로 해야 목표 크기(nav-logo-img의 실제 높이)에 정확히 맞는다.
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
  if(!heroName || !navLogo || !heroSection) return;

  var scrollY = window.scrollY;

  // heroName은 최초 측정 후 body로 옮겨져 position:fixed + transform이 걸린
  // 상태로 남아있다. resize 등으로 measureMorph가 다시 호출될 때 heroName
  // 자신의 getBoundingClientRect()를 읽으면 이미 축소/이동된 값을 "원래 위치"로
  // 착각해 계산이 완전히 틀어진다. 절대 변형되지 않는 .hero 컨테이너를 기준으로
  // "원래 있었어야 할 위치/크기"를 매번 새로 계산한다.
  var heroRect = heroSection.getBoundingClientRect();
  var heroStyle = getComputedStyle(heroSection);
  var padLeft = parseFloat(heroStyle.paddingLeft) || 0;
  var padRight = parseFloat(heroStyle.paddingRight) || 0;
  var padBottom = parseFloat(heroStyle.paddingBottom) || 0;
  var contentWidth = heroRect.width - padLeft - padRight;

  var logoImg = heroName.querySelector('img');
  var natW = logoImg ? logoImg.naturalWidth : 0;
  var natH = logoImg ? logoImg.naturalHeight : 0;
  var ratio = (natW && natH) ? (natW / natH) : 1;
  var maxHeightPx = window.innerHeight * 0.6; // CSS .hero-logo-img{max-height:60vh}와 동일 기준
  var boxWidth = contentWidth;
  var boxHeight = Math.min(contentWidth / ratio, maxHeightPx);
  var boxLeft = heroRect.left + padLeft;
  var boxTop = heroRect.bottom - padBottom - boxHeight; // align-items:flex-end로 바닥에 붙는 위치

  var startRect = {left: boxLeft, top: boxTop, width: boxWidth, height: boxHeight};
  var targetRect = navLogo.getBoundingClientRect();

  var paintedStart = (natW && natH) ? containRect(startRect, natW, natH) : startRect;
  var paintedTarget = (natW && natH) ? containRect(targetRect, natW, natH) : targetRect;

  morph.startLeft = startRect.left;
  morph.startTop = startRect.top + scrollY; // scrollY=0 기준 절대 좌표로 역산
  morph.boxWidth = boxWidth;
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
  // position:fixed로 전환되면 CSS의 width:100%가 .hero가 아니라 뷰포트
  // 전체 폭 기준으로 계산되어 오른쪽으로 삐져나가며 중심이 쏠린다.
  // 측정한 hero 콘텐츠 폭으로 고정해 항상 화면 중앙에 오도록 한다.
  heroName.style.width = morph.boxWidth + 'px';
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
var lastInnerWidth = window.innerWidth;
window.addEventListener('resize', function(){
  // 모바일 브라우저는 스크롤 중 주소창이 접히고 펼쳐지면서 innerHeight만
  // 바뀌어도 resize 이벤트를 쏜다. 그때마다 재측정하면 스크롤 도중 로고
  // 위치가 다시 계산되며 어긋나 보이므로, 실제로 폭이 바뀐 경우(회전,
  // 창 크기 변경)에만 재측정한다.
  var newInnerWidth = window.innerWidth;
  if(newInnerWidth === lastInnerWidth) return;
  lastInnerWidth = newInnerWidth;

  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(init, 150);
});

// ---------- 모바일 메뉴 (점 세개 아이콘 → 전체화면 오버레이) ----------
var menuToggle = document.getElementById('menuToggle');
var mobileMenu = document.getElementById('mobileMenu');

function closeMobileMenu(){
  if(!mobileMenu) return;
  mobileMenu.classList.remove('open');
  mobileMenu.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('menu-open');
  if(menuToggle) menuToggle.setAttribute('aria-expanded', 'false');
}

function openMobileMenu(){
  if(!mobileMenu) return;
  mobileMenu.classList.add('open');
  mobileMenu.setAttribute('aria-hidden', 'false');
  document.body.classList.add('menu-open');
  if(menuToggle) menuToggle.setAttribute('aria-expanded', 'true');
}

if(menuToggle && mobileMenu){
  menuToggle.addEventListener('click', function(){
    if(mobileMenu.classList.contains('open')){
      closeMobileMenu();
    } else {
      openMobileMenu();
    }
  });
  // 링크 자체의 기본 동작(#about 등으로 스크롤)은 그대로 두고, 메뉴만 닫는다.
  mobileMenu.querySelectorAll('a').forEach(function(a){
    a.addEventListener('click', closeMobileMenu);
  });
}

// ---------- hero(첫번째 메인) 영역 마우스 커서 이미지 트레일 ----------
// pacofernandez.me의 커서 트레일 방식(마우스가 일정 거리 이상 움직일 때마다
// 그 자리에 이미지를 하나씩 "찍고" 잠시 후 사라지는 방식)을 그대로 따라했다.
var cursorFollow = document.getElementById('cursorFollow');

if(heroSection && cursorFollow){
  // work 폴더에 실제로 넣어둔 사진 10장을 그대로 사용한다.
  // (커서 트레일용 100px 미리보기는 sips로 미리 축소해둔 썸네일)
  var trailImages = [
    'images/work/trail-thumbs/c-babo-1.jpg',
    'images/work/trail-thumbs/c-bookf.jpg',
    'images/work/trail-thumbs/c-kuy-1.jpg',
    'images/work/trail-thumbs/c-library-1.jpg',
    'images/work/trail-thumbs/c-mokpo1.jpg',
    'images/work/trail-thumbs/c-poster1.jpg',
    'images/work/trail-thumbs/c-woman-1.jpg',
    'images/work/trail-thumbs/p-carp_1.jpg',
    'images/work/trail-thumbs/p-gwangin1.jpg',
    'images/work/trail-thumbs/p-mun-1jpeg.jpg'
  ];

  var SPAWN_DISTANCE = 80;   // 마지막으로 찍은 자리에서 이만큼 움직여야 다음 이미지를 찍는다
  var MAX_VISIBLE = 10;      // 동시에 화면에 떠 있을 수 있는 최대 개수
  var VISIBLE_MS = 550;      // 찍힌 뒤 사라지기 시작하기까지의 시간
  var FADE_MS = 200;         // 사라지는 데 걸리는 시간

  var lastSpawnX = null, lastSpawnY = null;
  var cycleIndex = 0;
  var activeStamps = [];

  function expireStamp(stamp){
    if(stamp.expired) return;
    stamp.expired = true;
    clearTimeout(stamp.timer);
    // activeStamps 배열에서는 즉시(동기적으로) 빼야 한다. 그렇지 않으면
    // 개수 초과 시 아래 while 루프가 배열이 줄지 않아 무한 루프에 빠진다.
    var idx = activeStamps.indexOf(stamp);
    if(idx !== -1) activeStamps.splice(idx, 1);
    stamp.el.style.opacity = '0';
    setTimeout(function(){
      if(stamp.el.parentNode) stamp.el.parentNode.removeChild(stamp.el);
    }, FADE_MS);
  }

  function spawnStamp(x, y){
    var el = document.createElement('div');
    el.className = 'cursor-follow-item';
    el.style.backgroundImage = 'url(' + trailImages[cycleIndex] + ')';
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    cursorFollow.appendChild(el);
    cycleIndex = (cycleIndex + 1) % trailImages.length;

    var stamp = {el: el, expired: false, timer: null};
    stamp.timer = setTimeout(function(){ expireStamp(stamp); }, VISIBLE_MS);
    activeStamps.push(stamp);

    // 너무 많이 쌓이지 않도록, 넘치면 가장 오래된 것부터 바로 사라지게 한다.
    while(activeStamps.length > MAX_VISIBLE){
      expireStamp(activeStamps[0]);
    }
  }

  function clearAllStamps(){
    activeStamps.slice().forEach(function(stamp){
      clearTimeout(stamp.timer);
      if(stamp.el.parentNode) stamp.el.parentNode.removeChild(stamp.el);
    });
    activeStamps.length = 0;
    lastSpawnX = lastSpawnY = null;
  }

  var lastMouseX = 0, lastMouseY = 0, insideHero = false;

  function handleMouseAt(x, y){
    var rect = heroSection.getBoundingClientRect();
    var inside = x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;

    if(!inside){
      if(insideHero) clearAllStamps();
      insideHero = false;
      return;
    }
    insideHero = true;

    if(lastSpawnX === null){
      spawnStamp(x, y);
      lastSpawnX = x;
      lastSpawnY = y;
      return;
    }
    var dx = x - lastSpawnX, dy = y - lastSpawnY;
    if(Math.sqrt(dx * dx + dy * dy) >= SPAWN_DISTANCE){
      spawnStamp(x, y);
      lastSpawnX = x;
      lastSpawnY = y;
    }
  }

  window.addEventListener('mousemove', function(e){
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
    handleMouseAt(lastMouseX, lastMouseY);
  });

  // 스크롤 휠만으로 hero 영역을 벗어나는 경우(마우스는 가만히 있어도)까지
  // 대응하기 위해, 스크롤할 때도 마지막 마우스 위치 기준으로 안/밖을 다시 확인한다.
  var followScrollTicking = false;
  window.addEventListener('scroll', function(){
    if(!followScrollTicking){
      window.requestAnimationFrame(function(){
        handleMouseAt(lastMouseX, lastMouseY);
        followScrollTicking = false;
      });
      followScrollTicking = true;
    }
  }, {passive:true});
}
