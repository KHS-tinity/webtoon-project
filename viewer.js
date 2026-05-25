// =========================================================================
// 🎬 웹툰 시네마틱 뷰어 공통 연출 및 사운드 핵심 엔진 모듈 (viewer.js)
// =========================================================================

// 전역 상태 캐시 및 재생 엔진 변수 정의 (이중 선언 방지 및 전역 스코프 참조 ReferenceError 완전 차단)
// var 선언을 통해 스크립트 전역 범위에 변수를 정의하여 window. 없이 호출해도 참조가 터지지 않게 보호하며,
// 이미 window 객체에 할당되어 있을 경우 그 참조를 가져오고 그렇지 않으면 초깃값으로 세팅합니다.
var cuts = window.cuts = window.cuts || [];
var currentCutId = window.currentCutId = window.currentCutId || null;
var isSyncScrolling = window.isSyncScrolling = window.isSyncScrolling || false;
var programmaticScrollAnimId = window.programmaticScrollAnimId = window.programmaticScrollAnimId || null;
var isTimeBasedAutoplay = window.isTimeBasedAutoplay = window.isTimeBasedAutoplay || false;
var lastSettledCutId = window.lastSettledCutId = window.lastSettledCutId || null;
var lastFrameTime = window.lastFrameTime = window.lastFrameTime || 0;
var isProgrammaticPlaying = window.isProgrammaticPlaying = window.isProgrammaticPlaying || false;
var accumulatedTime = window.accumulatedTime = window.accumulatedTime || 0.0;

// 빨리감기 및 재생 가속 배율 관련 변수들
var isFastForwarding = window.isFastForwarding = window.isFastForwarding || false;
var speedMultiplier = window.speedMultiplier = window.speedMultiplier || 1.0;
var playItemsQueue = window.playItemsQueue = window.playItemsQueue || [];
var playingAudios = window.playingAudios = window.playingAudios || [];
var playAnimationId = window.playAnimationId = window.playAnimationId || null;
var activeSessionId = window.activeSessionId = window.activeSessionId || null;
var isPlayMode = window.isPlayMode = window.isPlayMode || false;
var maxCutDuration = window.maxCutDuration = window.maxCutDuration || 10.0;
var isScrollDirectionDown = window.isScrollDirectionDown = window.isScrollDirectionDown || true;
var viewerScrollContainer = window.viewerScrollContainer = window.viewerScrollContainer || null;

// 미디어 경로 정규화 (Path Normalization) 유틸리티 함수
function normalizeMediaPath(url) {
    if (!url) return "";
    if (url.startsWith('blob:') || url.startsWith('http:') || url.startsWith('https:') || url.startsWith('/') || url.includes('/') || url.includes('\\')) {
        return url;
    }
    return '자료/' + url;
}
window.normalizeMediaPath = normalizeMediaPath; // 전역 스코프 바인딩

// ================= Web Audio API 자동 음압 정규화(Auto-Normalization) 시스템 =================
class WebAudioPipeManager {
    constructor() {
        this.ctx = null;
        this.voiceMasterGain = null;
        this.bgmMasterGain = null;
        this.voiceMasterAnalyser = null;
        this.bgmMasterAnalyser = null;
        
        this.sourceCache = new Map();
        this.nodesCache = new Map();
    }

    init() {
        if (this.ctx) return;
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        
        // 1. 보이스 및 SFX 마스터 채널 셋업
        this.voiceMasterGain = this.ctx.createGain();
        this.voiceMasterAnalyser = this.ctx.createAnalyser();
        this.voiceMasterAnalyser.fftSize = 512;
        this.voiceMasterGain.connect(this.voiceMasterAnalyser);
        this.voiceMasterAnalyser.connect(this.ctx.destination);
        
        // 2. BGM 마스터 채널 셋업
        this.bgmMasterGain = this.ctx.createGain();
        this.bgmMasterAnalyser = this.ctx.createAnalyser();
        this.bgmMasterAnalyser.fftSize = 512;
        this.bgmMasterGain.connect(this.bgmMasterAnalyser);
        this.bgmMasterAnalyser.connect(this.ctx.destination);
    }

    connectAudio(audioElement, type = 'voice') {
        // [CORS 보안 예외 차단 가드] 로컬 file:/// 프로토콜 환경에서는 브라우저의 강력한 CORS 제약으로 
        // MediaElementAudioSourceNode 생성 시 무조건 SecurityError가 유발되므로, 단순 바이패스 처리합니다.
        if (window.location.protocol === 'file:') {
            console.log("CORS 제한 모드 감지: Web Audio API 마스터 믹서 연결을 바이패스합니다.");
            return null;
        }

        this.init();
        if (this.ctx.state === 'suspended') {
            this.ctx.resume().catch(() => {});
        }

        if (this.sourceCache.has(audioElement)) {
            return this.nodesCache.get(audioElement);
        }

        try {
            const source = this.ctx.createMediaElementSource(audioElement);
            const gainNode = this.ctx.createGain();
            const analyserNode = this.ctx.createAnalyser();
            analyserNode.fftSize = 512;

            source.connect(gainNode);
            gainNode.connect(analyserNode);

            // 해당 카테고리 마스터 믹서에 병합 연결
            const targetMaster = (type === 'bgm') ? this.bgmMasterGain : this.voiceMasterGain;
            analyserNode.connect(targetMaster);

            const nodePair = { gainNode, analyserNode, type };
            this.sourceCache.set(audioElement, source);
            this.nodesCache.set(audioElement, nodePair);

            return nodePair;
        } catch (e) {
            console.error("Web Audio API 연결 실패:", e);
            return null;
        }
    }
}
var audioPipeManager = window.audioPipeManager = window.audioPipeManager || new WebAudioPipeManager();

// 실시간 RMS 분석 및 오토 게인 피드백 루프
function runRealtimeNormalization() {
    if (!audioPipeManager.ctx) return;
    
    const now = audioPipeManager.ctx.currentTime;
    
    audioPipeManager.nodesCache.forEach((nodes, audioElement) => {
        if (audioElement.paused || audioElement.ended) return;
        
        const analyser = nodes.analyserNode;
        const gainNode = nodes.gainNode;
        const type = nodes.type;
        
        const bufferLength = analyser.fftSize;
        const dataArray = new Float32Array(bufferLength);
        
        if (analyser.getFloatTimeDomainData) {
            analyser.getFloatTimeDomainData(dataArray);
        } else {
            const byteData = new Uint8Array(bufferLength);
            analyser.getByteTimeDomainData(byteData);
            for (let i = 0; i < bufferLength; i++) {
                dataArray[i] = (byteData[i] - 128) / 128;
            }
        }
        
        let sumSquares = 0;
        for (let i = 0; i < bufferLength; i++) {
            sumSquares += dataArray[i] * dataArray[i];
        }
        const rms = Math.sqrt(sumSquares / bufferLength);
        
        let db = -100;
        if (rms > 0.00001) {
            db = 20 * Math.log10(rms);
        }
        
        // 보이스 타겟 -14dB, BGM 타겟 -26dB
        const targetDb = (type === 'bgm') ? -26.0 : -14.0;
        let targetGain = 1.0;
        
        if (db < -45.0) {
            // 노이즈 게이트 작동: 무음/잡음 플로어 구간에서는 게인을 1.0으로 강제 환원하여 노이즈 펌핑 방지
            targetGain = 1.0;
        } else {
            const diffDb = targetDb - db;
            
            if (type === 'voice') {
                if (diffDb > 0) {
                    // 대사가 낮은 경우에만 자동 증폭
                    targetGain = Math.pow(10, diffDb / 20);
                    targetGain = Math.min(4.0, targetGain); // 최대 4배 증폭 제한
                } else {
                    targetGain = 1.0;
                }
            } else if (type === 'bgm') {
                if (diffDb < 0) {
                    // BGM이 너무 높은 경우에만 자동 감쇄
                    targetGain = Math.pow(10, diffDb / 20);
                    targetGain = Math.max(0.05, targetGain); // 최소 0.05 감쇄 제한
                } else {
                    targetGain = 1.0;
                }
            }
        }
        
        // setTargetAtTime을 이용해 청각적 거부감 없이 100ms 지연 수렴
        gainNode.gain.setTargetAtTime(targetGain, now, 0.1);
    });
}

// 보이스와 BGM의 우선순위 가중치 6dB 격차 실시간 크로스오버 조절
function runPriorityCrossoverMonitoring() {
    if (!audioPipeManager.ctx || !audioPipeManager.voiceMasterAnalyser || !audioPipeManager.bgmMasterAnalyser) return;
    
    const now = audioPipeManager.ctx.currentTime;
    
    // 만약 배경음악이 음소거 상태라면 게인을 0.0으로 강제 고정 후 바이패스
    if (window.isBgmVolumeMuted) {
        audioPipeManager.bgmMasterGain.gain.setTargetAtTime(0.0, now, 0.08);
        return;
    }
    
    // 1. 보이스 마스터 RMS 계산
    const voiceBuffer = new Float32Array(audioPipeManager.voiceMasterAnalyser.fftSize);
    audioPipeManager.voiceMasterAnalyser.getFloatTimeDomainData(voiceBuffer);
    let voiceSum = 0;
    for (let i = 0; i < voiceBuffer.length; i++) voiceSum += voiceBuffer[i] * voiceBuffer[i];
    const voiceRms = Math.sqrt(voiceSum / voiceBuffer.length);
    let voiceDb = -100;
    if (voiceRms > 0.00001) voiceDb = 20 * Math.log10(voiceRms);
    
    // 2. BGM 마스터 RMS 계산
    const bgmBuffer = new Float32Array(audioPipeManager.bgmMasterAnalyser.fftSize);
    audioPipeManager.bgmMasterAnalyser.getFloatTimeDomainData(bgmBuffer);
    let bgmSum = 0;
    for (let i = 0; i < bgmBuffer.length; i++) bgmSum += bgmBuffer[i] * bgmBuffer[i];
    const bgmRms = Math.sqrt(bgmSum / bgmBuffer.length);
    let bgmDb = -100;
    if (bgmRms > 0.00001) bgmDb = 20 * Math.log10(bgmRms);

    // 3. 보이스 재생 감지 및 BGM 상대 음압 6dB 이상 벌림 크로스오버 작동
    if (voiceDb > -40.0) {
        // 보이스가 실제로 유의미하게 출력되는 구간!
        const currentDiff = voiceDb - bgmDb;
        if (currentDiff < 6.0) {
            // 격차가 6dB 미만이어서 대사가 묻힐 우려가 있을 때 BGM 마스터를 감쇄
            const shortfallDb = 6.0 - currentDiff; // 채워야 할 데시벨 차이
            const targetBgmMasterGain = Math.pow(10, -shortfallDb / 20);
            
            // BGM 마스터 게인을 부드럽게 감쇄 (80ms 빠른 반응 수렴)
            audioPipeManager.bgmMasterGain.gain.setTargetAtTime(Math.min(1.0, Math.max(0.15, targetBgmMasterGain)), now, 0.08);
        } else {
            // 이미 충분한 차이가 나는 경우 원래 볼륨으로 복원
            audioPipeManager.bgmMasterGain.gain.setTargetAtTime(1.0, now, 0.1);
        }
    } else {
        // 보이스 무음 구간: BGM 마스터를 원래 볼륨으로 부드럽게 복구
        audioPipeManager.bgmMasterGain.gain.setTargetAtTime(1.0, now, 0.15);
    }
}

// premium easeInOutQuad programmatic scroll helper
function animateScrollTo(targetScrollTop, durationMs, callback) {
    if (!viewerScrollContainer) {
        viewerScrollContainer = window.viewerScrollContainer = document.getElementById('viewerScrollContainer');
    }
    if (programmaticScrollAnimId) {
        cancelAnimationFrame(programmaticScrollAnimId);
    }
    
    const startScrollTop = viewerScrollContainer.scrollTop;
    const distance = targetScrollTop - startScrollTop;
    const startTime = performance.now();
    
    isSyncScrolling = true; // 스크롤 정지 타이머 및 편집 복구 락킹
    isPlayMode = true;
    
    function step(now) {
        const elapsed = now - startTime;
        const pct = Math.min(1.0, elapsed / durationMs);
        
        // easeInOutQuad
        const easePct = pct < 0.5 ? 2 * pct * pct : 1 - Math.pow(-2 * pct + 2, 2) / 2;
        
        viewerScrollContainer.scrollTop = startScrollTop + distance * easePct;
        
        if (pct < 1.0) {
            programmaticScrollAnimId = requestAnimationFrame(step);
        } else {
            viewerScrollContainer.scrollTop = targetScrollTop;
            programmaticScrollAnimId = null;
            isSyncScrolling = false;
            if (callback) callback();
        }
    }
    programmaticScrollAnimId = requestAnimationFrame(step);
}

// 실시간 Scene Sandboxing (현재 컷이 아닌 다른 모든 컷의 요소 및 사운드 격리)
function sandboxOtherCuts(activeCutId) {
    cuts.forEach(c => {
        if (c.id !== activeCutId) {
            const bubbleContainer = document.getElementById(`bubbleContainer_${c.id}`);
            if (bubbleContainer) {
                bubbleContainer.querySelectorAll('.speech-bubble').forEach(bubble => {
                    const computedStyle = window.getComputedStyle(bubble);
                    if (bubble.style.transition !== 'none' || computedStyle.transitionDuration !== '0s') {
                        bubble.style.transition = 'none';
                    }
                    
                    const tailSvg = bubble.querySelector('.tail-svg');
                    const paths = bubble.querySelectorAll('.bubble-path');
                    if (tailSvg) {
                        const tailComputed = window.getComputedStyle(tailSvg);
                        if (tailSvg.style.transition !== 'none' || tailComputed.transitionDuration !== '0s') {
                            tailSvg.style.transition = 'none';
                        }
                    }
                    if (paths.length > 0) {
                        paths.forEach(p => {
                            const pathComputed = window.getComputedStyle(p);
                            if (p.style.transition !== 'none' || pathComputed.transitionDuration !== '0s') {
                                p.style.transition = 'none';
                            }
                        });
                    }

                    bubble.classList.remove('show');
                    bubble.classList.add('animate');
                    bubble.style.opacity = '0';
                    
                    if (tailSvg) tailSvg.style.opacity = '0';
                    if (paths.length > 0) {
                        paths.forEach(p => p.style.opacity = '0');
                    }
                    
                    const spans = bubble.querySelectorAll('.typing-wrapper span');
                    spans.forEach(s => s.style.opacity = '0');
                    
                    if (bubble.style.transition === 'none' && (!tailSvg || tailSvg.style.transition === 'none')) {
                        void bubble.offsetWidth;
                    }
                    
                    bubble.style.transition = '';
                    if (tailSvg) tailSvg.style.transition = '';
                    if (paths.length > 0) paths.forEach(p => p.style.transition = '');
                });
            }
            
            // 비활성 컷들의 진행 중인 개별 오디오 강제 중단
            const inactiveSceneList = document.getElementById(`sceneList_${c.id}`);
            if (inactiveSceneList) {
                const allCards = [...inactiveSceneList.querySelectorAll('.dialogue-item'), ...inactiveSceneList.querySelectorAll('.sfx-item')];
                allCards.forEach(card => {
                    if (card.audioObj) {
                        card.audioObj.pause();
                        card.audioObj.currentTime = 0;
                    }
                });
            } else {
                // 런타임 뷰어 모드일 때: playItemsQueue 에 등록되어 있던 다른 컷의 오디오들 정지
                playItemsQueue.forEach(item => {
                    if (item.audioObj && !cuts.find(cx => cx.id === activeCutId).items?.some(ix => ix.audioUrl === item.audioUrl)) {
                        item.audioObj.pause();
                        item.audioObj.currentTime = 0;
                    }
                });
            }
        }
    });
}

// 100% 스크롤 진행률 기반 타임라인 스크러빙 제어 코어 함수
function handleScrollUpdate() {
    if (!viewerScrollContainer) {
        viewerScrollContainer = window.viewerScrollContainer = document.getElementById('viewerScrollContainer');
    }
    if (cuts.length === 0) return;

    const scrollTop = viewerScrollContainer.scrollTop;
    const containerHeight = viewerScrollContainer.clientHeight || 640;

    let activeCutIdx;
    if (isProgrammaticPlaying) {
        activeCutIdx = cuts.findIndex(c => c.id === currentCutId);
        if (activeCutIdx === -1) activeCutIdx = 0;
    } else {
        activeCutIdx = Math.round(scrollTop / containerHeight);
        if (activeCutIdx >= cuts.length) activeCutIdx = cuts.length - 1;
        if (activeCutIdx < 0) activeCutIdx = 0;
    }

    const activeCut = cuts[activeCutIdx];
    if (!activeCut) return;
    const bestCutId = activeCut.id;

    let progress = 0;
    if (isProgrammaticPlaying) {
        progress = Math.max(0.0, Math.min(1.0, accumulatedTime / maxCutDuration));
    } else {
        const targetScrollTop = activeCutIdx * containerHeight;
        if (scrollTop < targetScrollTop) {
            if (activeCutIdx === 0) {
                progress = 1.0 - (scrollTop / containerHeight);
            } else {
                const prevStop = (activeCutIdx - 1) * containerHeight;
                progress = (scrollTop - prevStop) / containerHeight;
            }
        } else {
            progress = 1.0;
        }
    }
    progress = Math.max(0.0, Math.min(1.0, progress));

    if (bestCutId !== currentCutId) {
        currentCutId = bestCutId;

        // [편집기 돔 싱크 가드]
        const tabBtn = document.querySelector(`.cut-tab[data-cut-id="${bestCutId}"]`);
        if (tabBtn) {
            document.querySelectorAll('.cut-tab').forEach(btn => btn.classList.remove('active'));
            tabBtn.classList.add('active');
        }

        const sceneList = document.getElementById(`sceneList_${bestCutId}`);
        if (sceneList) {
            document.querySelectorAll('.cut-scene-list').forEach(list => list.classList.remove('active'));
            sceneList.classList.add('active');
        }

        if (typeof syncCutActiveClasses === 'function') {
            syncCutActiveClasses(bestCutId);
        } else {
            // viewer.html 전용 액티브 클래스 직접 싱크
            cuts.forEach(c => {
                const cutItem = document.getElementById(`viewerCut_${c.id}`);
                if (cutItem) {
                    const layers = cutItem.querySelectorAll('.cut-layer, .cut-bg-image');
                    const isActive = c.id === bestCutId;
                    
                    cutItem.className = 'viewer-cut-item';
                    
                    layers.forEach(layer => {
                        layer.className = layer.classList.contains('cut-layer') ? 'cut-layer' : 'cut-bg-image';
                        if (c.effectType !== 'none') {
                            if (c.effectType !== 'shake') {
                                layer.classList.add(`effect-${c.effectType}`);
                            }
                        }
                        if (isActive) {
                            layer.classList.add('active');
                        }
                    });

                    if (c.effectType === 'shake') {
                        cutItem.classList.add('effect-shake');
                    }

                    if (isActive) {
                        void cutItem.offsetWidth;
                        cutItem.classList.add('active');
                    }
                }
            });
        }

        const cutEffectSelect = document.getElementById('cutEffectSelect');
        if (cutEffectSelect) {
            cutEffectSelect.value = activeCut.effectType || 'none';
        }
        
        if (typeof syncGlobalBgms === 'function') {
            syncGlobalBgms(activeCut.index);
        } else if (typeof syncGlobalBgmsRuntime === 'function') {
            syncGlobalBgmsRuntime(activeCut.index);
        }
        
        const cutImageName = document.getElementById('cutImageName');
        if (cutImageName) {
            cutImageName.textContent = activeCut.bgImageName || '선택된 파일 없음';
        }

        buildPlayItemsQueue(bestCutId);

        // [성능 개선 1 - Lazy Rendering Swap 기동]
        if (typeof swapActiveCutsDOM === 'function') {
            swapActiveCutsDOM(bestCutId);
        }
    }

    sandboxOtherCuts(bestCutId);

    isPlayMode = true;
    if (!isProgrammaticPlaying && !isTimeBasedAutoplay) {
        accumulatedTime = progress * maxCutDuration;
    }

    cuts.forEach((c, idx) => {
        if (c.id === bestCutId) {
            renderCutVisualEffects(c.id, progress, true);
            
            if (bestCutId !== lastSettledCutId) {
                syncCutBubblesState(c.id, 'hide');
            }
        } else if (idx < activeCutIdx) {
            renderCutVisualEffects(c.id, 1.0, true);
            
            const settledIdx = cuts.findIndex(x => x.id === lastSettledCutId);
            const isMovingFromSettled = settledIdx !== -1 && Math.abs(scrollTop - settledIdx * containerHeight) > 3;
            
            if (
                (settledIdx !== -1 && idx <= settledIdx && isMovingFromSettled) ||
                c.id === lastSettledCutId || 
                (bestCutId !== lastSettledCutId && c.id === bestCutId)
            ) {
                syncCutBubblesState(c.id, 'hide');
            } else {
                syncCutBubblesState(c.id, 'show');
            }
        } else {
            renderCutVisualEffects(c.id, 0.0, true);
            syncCutBubblesState(c.id, 'hide');
        }
    });

    if (!playAnimationId) {
        renderItemsFrame();
    }
}

// GPU 가속 비주얼 연출 실시간 스크러빙 주입
function renderCutVisualEffects(cutId, progress, isScrolled) {
    const cutItem = document.getElementById(`viewerCut_${cutId}`);
    if (!cutItem) return;
    const layers = cutItem.querySelectorAll('.cut-layer, .cut-bg-image');
    const cut = cuts.find(c => c.id === cutId);
    if (!cut) return;
    
    const effect = cut.effectType || 'none';
    
    if (isScrolled) {
        layers.forEach(layer => {
            layer.style.transition = 'none';
        });
        cutItem.style.transition = 'none';
        
        if (effect !== 'shake') {
            cutItem.style.transform = '';
        }
        
        if (effect === 'none') {
            layers.forEach(layer => {
                layer.style.opacity = '1';
                layer.style.transform = '';
            });
        } else if (effect === 'fade') {
            layers.forEach(layer => {
                layer.style.opacity = progress;
                layer.style.transform = '';
            });
        } else if (effect === 'slide-up') {
            layers.forEach(layer => {
                layer.style.opacity = progress;
                layer.style.transform = `translateY(${(1 - progress) * 120}px)`;
            });
        } else if (effect === 'zoom') {
            layers.forEach(layer => {
                layer.style.opacity = progress;
                layer.style.transform = `scale(${1.35 - 0.35 * progress})`;
            });
        } else if (effect === 'shake') {
            layers.forEach(layer => {
                layer.style.opacity = '1';
                layer.style.transform = '';
            });
            if (progress > 0 && progress < 0.6) {
                const frequency = 40; 
                const amplitude = 8 * (1 - progress / 0.6); 
                const shakeX = Math.sin(progress * frequency * Math.PI) * amplitude;
                const shakeY = Math.cos(progress * frequency * Math.PI) * (amplitude * 0.6);
                cutItem.style.transform = `translate3d(${shakeX}px, ${shakeY}px, 0)`;
            } else {
                cutItem.style.transform = '';
            }
        }
    } else {
        layers.forEach(layer => {
            layer.style.transition = '';
            layer.style.opacity = '';
            layer.style.transform = '';
        });
        cutItem.style.transition = '';
        cutItem.style.transform = '';
    }
}

function syncCutBubblesState(cutId, state) {
    // 편집기 카드 돔과 런타임 뷰어 돔 호환성 확보
    const cards = [];
    const activeSceneList = document.getElementById(`sceneList_${cutId}`);
    if (activeSceneList) {
        activeSceneList.querySelectorAll('.dialogue-item').forEach(c => cards.push({ bubbleDOM: c.bubbleDOM }));
    } else {
        // 런타임 뷰어 모드: cuts 배열에서 dialogue 아이템들을 찾아 직접 bubble DOM 수집
        const cut = cuts.find(cx => cx.id === cutId);
        if (cut && cut.items) {
            cut.items.forEach(item => {
                if (item.type === 'dialogue') {
                    const bubble = document.getElementById(`bubble_${item.id}`);
                    if (bubble) cards.push({ bubbleDOM: bubble });
                }
            });
        }
    }

    cards.forEach(card => {
        const bubble = card.bubbleDOM;
        if (bubble) {
            const tailSvg = bubble.querySelector('.tail-svg');
            const paths = bubble.querySelectorAll('.bubble-path');
            
            if (state === 'show') {
                if (!bubble.classList.contains('show') || bubble.style.opacity !== '1') {
                    bubble.style.transition = 'none';
                    if (tailSvg) tailSvg.style.transition = 'none';
                    if (paths.length > 0) {
                        paths.forEach(path => {
                            path.style.transition = 'none';
                        });
                    }
                    
                    bubble.classList.remove('animate');
                    bubble.style.opacity = '1';
                    if (tailSvg) tailSvg.style.opacity = '1';
                    if (paths.length > 0) {
                        paths.forEach(path => {
                            path.style.opacity = '1';
                        });
                    }
                    
                    void bubble.offsetWidth; // Reflow
                    
                    bubble.style.transition = '';
                    if (tailSvg) tailSvg.style.transition = '';
                    if (paths.length > 0) {
                        paths.forEach(path => {
                            path.style.transition = '';
                        });
                    }
                    
                    bubble.classList.add('show');
                }
                
                // [교정] 말풍선이 이미 노출 상태여도, 다른 연출에 의해 가려졌던 말꼬리 패스들과 자막 스팬들의 투명도는 강제로 원복시킵니다.
                if (tailSvg) tailSvg.style.opacity = '1';
                if (paths.length > 0) {
                    paths.forEach(path => {
                        path.style.opacity = '1';
                    });
                }
                const spans = bubble.querySelectorAll('.typing-wrapper span');
                spans.forEach(s => s.style.opacity = '1');
            } else {
                if (bubble.classList.contains('show') || bubble.style.opacity !== '0') {
                    bubble.style.transition = 'none';
                    if (tailSvg) tailSvg.style.transition = 'none';
                    if (paths.length > 0) {
                        paths.forEach(path => {
                            path.style.transition = 'none';
                        });
                    }
                    
                    bubble.classList.remove('show');
                    bubble.classList.add('animate');
                    bubble.style.opacity = '0';
                    if (tailSvg) tailSvg.style.opacity = '0';
                    if (paths.length > 0) {
                        paths.forEach(path => {
                            path.style.opacity = '0';
                        });
                    }
                    
                    void bubble.offsetWidth; // Reflow
                    
                    bubble.style.transition = '';
                    if (tailSvg) tailSvg.style.transition = '';
                    if (paths.length > 0) {
                        paths.forEach(path => {
                            path.style.transition = '';
                        });
                    }
                }
                const spans = bubble.querySelectorAll('.typing-wrapper span');
                spans.forEach(s => s.style.opacity = '0');
            }
        }
    });
}

// 1단계 렌더링 프레임 함수 독립화 및 [성능 개선 4 - 타이핑 렌더링 캐싱] 적용
function renderItemsFrame() {
    if (!audioPipeManager.ctx) {
        audioPipeManager.init();
    }
    const audioCtx = audioPipeManager.ctx;
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
    }
    
    playItemsQueue.forEach(item => {
        const bubble = item.bubbleDOM;
        
        let elapsed = accumulatedTime - item.startSec;
        if (currentCutId !== lastSettledCutId) {
            elapsed = -1;
        }
        
        if (elapsed < 0) {
            item.triggered = false;
            if (bubble) {
                const tailSvg = bubble.querySelector('.tail-svg');
                const paths = bubble.querySelectorAll('.bubble-path');
                
                if (bubble.classList.contains('show') || bubble.style.opacity !== '0') {
                    bubble.style.transition = 'none';
                    if (tailSvg) tailSvg.style.transition = 'none';
                    if (paths.length > 0) {
                        paths.forEach(p => p.style.transition = 'none');
                    }
                    
                    bubble.classList.remove('show');
                    bubble.style.opacity = '0';
                    if (tailSvg) tailSvg.style.opacity = '0';
                    if (paths.length > 0) {
                        paths.forEach(p => p.style.opacity = '0');
                    }
                    
                    void bubble.offsetWidth;
                    
                    bubble.style.transition = '';
                    if (tailSvg) tailSvg.style.transition = '';
                    if (paths.length > 0) {
                        paths.forEach(p => p.style.transition = '');
                    }
                    
                    bubble.classList.add('animate');
                }
                const spans = bubble.querySelectorAll('.typing-wrapper span');
                spans.forEach(s => s.style.opacity = '0');
            }
            if (item.audioObj) {
                item.audioObj.pause();
                item.audioObj.currentTime = 0;
            }
        } 
        else {
            item.triggered = true;
            
            if (bubble) {
                const tailSvg = bubble.querySelector('.tail-svg');
                const paths = bubble.querySelectorAll('.bubble-path');
                
                if (!bubble.classList.contains('show') || bubble.style.opacity === '0') {
                    bubble.style.transition = 'none';
                    if (tailSvg) tailSvg.style.transition = 'none';
                    if (paths.length > 0) {
                        paths.forEach(p => p.style.transition = 'none');
                    }
                    
                    bubble.classList.remove('animate');
                    bubble.style.opacity = '1';
                    if (tailSvg) tailSvg.style.opacity = '1';
                    if (paths.length > 0) {
                        paths.forEach(p => p.style.opacity = '1');
                    }
                    
                    void bubble.offsetWidth;
                    
                    bubble.style.transition = '';
                    bubble.style.opacity = '';
                    if (tailSvg) {
                        tailSvg.style.transition = '';
                        tailSvg.style.opacity = '';
                    }
                    if (paths.length > 0) {
                        paths.forEach(p => {
                            p.style.transition = '';
                            p.style.opacity = '';
                        });
                    }
                    
                    bubble.classList.add('show');
                }
                
                // [성능 개선 4 - 타이핑 렌더링 캐싱 필터]
                const spans = bubble.querySelectorAll('.typing-wrapper span');
                if (spans.length > 0) {
                    const progressPct = Math.min(1.0, elapsed / item.duration);
                    const spansToShow = Math.floor(spans.length * progressPct);
                    
                    // 캐싱 적용: 이전 프레임과 동일한 개수라면 DOM 갱신 차단
                    if (item.lastSpansToShow !== spansToShow) {
                        item.lastSpansToShow = spansToShow;
                        for (let i = 0; i < spans.length; i++) {
                            spans[i].style.opacity = (i < spansToShow) ? '1' : '0';
                        }
                    }
                }
            }
            
            if (item.audioUrl) {
                if (!item.audioObj) {
                    const audio = new Audio(normalizeMediaPath(item.audioUrl));
                    audio.autoplay = false;
                    audio.load();
                    audioPipeManager.connectAudio(audio, 'voice');
                    item.audioObj = audio;
                    if (isFastForwarding) {
                        audio.playbackRate = 4.0;
                    } else {
                        audio.playbackRate = speedMultiplier;
                    }
                    playingAudios.push(item.audioObj);
                }
                
                const targetAudioTime = elapsed;
                const durationLimit = item.audioObj.duration || item.duration;
                
                if (targetAudioTime < durationLimit) {
                    if (isScrollDirectionDown || isTimeBasedAutoplay) {
                        if (item.audioObj.paused) {
                            item.audioObj.play().catch(e => console.log("오디오 play 지연:", e));
                        }
                        if (Math.abs(item.audioObj.currentTime - targetAudioTime) > 0.2) {
                            item.audioObj.currentTime = targetAudioTime;
                        }
                        item.audioObj.volume = 1.0;
                    } else {
                        item.audioObj.pause();
                        item.audioObj.currentTime = targetAudioTime;
                    }
                } else {
                    item.audioObj.pause();
                }
            }
        }
    });
    
    // 현재 활성화된 컷 내의 이중 타임라인 플레이헤드 갱신 (편집기 모드에서만 실행)
    const activeSceneList = document.getElementById(`sceneList_${currentCutId}`);
    if (activeSceneList) {
        activeSceneList.querySelectorAll('.timeline-container').forEach(container => {
            const playhead = container.querySelector('.timeline-playhead');
            if (playhead) {
                playhead.style.opacity = '1';
                let pct = (accumulatedTime / 10.0) * 100;
                if (pct > 100) pct = 100;
                playhead.style.left = `${pct}%`;
            }
        });
    }
}
window.renderItemsFrame = renderItemsFrame;

// 60fps 마스터 프레임 스케줄러 (재생 상태일 때만 무한 루프 가동)
function updateRealtimeTimeline(mySessionId) {
    if (mySessionId !== activeSessionId) {
        return;
    }

    if (!isPlayMode) {
        document.querySelectorAll('.timeline-playhead').forEach(ph => ph.style.opacity = '0');
        playAnimationId = null; // 루프 플래그 리셋 후 탈출
        return;
    }
    
    const now = performance.now();
    
    if (isTimeBasedAutoplay) {
        const dt = ((now - lastFrameTime) / 1000.0) * speedMultiplier;
        accumulatedTime += dt;
        
        const cut = cuts.find(c => c.id === currentCutId);
        const effect = cut ? (cut.effectType || 'none') : 'none';
        const effectDurationMap = {
            none: 0,
            fade: 1.2,
            'slide-up': 0.9,
            zoom: 1.6,
            shake: 0.6
        };
        const effectDuration = effectDurationMap[effect] || 0;
        const actualMaxDuration = Math.max(maxCutDuration, effectDuration);
        
        if (accumulatedTime >= actualMaxDuration) {
            accumulatedTime = actualMaxDuration;
            renderItemsFrame();
            
            renderCutVisualEffects(currentCutId, 1.0, false);
            
            restoreEditMode();
            if (typeof showStatus === 'function') {
                showStatus("연출 완료!");
            }
            return;
        }
    }
    lastFrameTime = now;

    renderItemsFrame();

    // [소프트웨어 다이내믹 BGM 더킹] Web Audio API 바이패스 모드 (CORS 제한 file:// 프로토콜 등) 대응을 위한 
    // 하이브리드 타임라인 연동형 BGM 자동 음압 보정 시스템
    const isLocalFileMode = window.location.protocol === 'file:';
    if (isLocalFileMode && window.activeBgms) {
        // 현재 타임라인상 활성화(재생) 중인 대사(Dialogue) 보이스가 있는지 감지
        const isVoicePlaying = playItemsQueue.some(item => {
            if (!item.isDialogue) return false;
            const elapsed = accumulatedTime - item.startSec;
            return elapsed >= 0 && elapsed < item.duration;
        });

        // 보이스 재생 중일 때는 BGM을 0.06(매우 낮춤), 그 외에는 0.25(표준 배경음)로 설정 (단, 음소거 시에는 강제 0.0)
        const targetBgmVol = window.isBgmVolumeMuted ? 0.0 : (isVoicePlaying ? 0.06 : 0.25);

        // activeBgms 객체 순회하여 각 BGM 트랙의 오디오 엘리먼트 볼륨을 60fps로 매끄럽게 피드백 조절 (100ms 이내 수렴)
        Object.values(window.activeBgms).forEach(track => {
            if (track.isPlaying && track.audio && !track.audio.fadeTimer) {
                const currentVol = track.audio.volume;
                // 매끄러운 선형 보간 감쇄/복구 (lerp)
                track.audio.volume = currentVol + (targetBgmVol - currentVol) * 0.1;
            }
        });
    }

    if (isTimeBasedAutoplay && currentCutId) {
        const cut = cuts.find(c => c.id === currentCutId);
        const effect = cut ? (cut.effectType || 'none') : 'none';
        const effectDurationMap = {
            none: 0,
            fade: 1.2,
            'slide-up': 0.9,
            zoom: 1.6,
            shake: 0.6
        };
        const effectDuration = effectDurationMap[effect] || 0;
        
        let playProgress = 1.0;
        if (effectDuration > 0) {
            playProgress = Math.max(0.0, Math.min(1.0, accumulatedTime / effectDuration));
        }
        
        renderCutVisualEffects(currentCutId, playProgress, true);
    }
    
    if (typeof runRealtimeNormalization === 'function') {
        runRealtimeNormalization();
    }
    if (typeof runPriorityCrossoverMonitoring === 'function') {
        runPriorityCrossoverMonitoring();
    }

    playAnimationId = requestAnimationFrame(() => updateRealtimeTimeline(mySessionId));
}

// 0.0초 시점부터 시네마틱 자동 연출을 완전히 깨끗하게 오토플레이 기동
function triggerAutoplayForCurrentCut() {
    isTimeBasedAutoplay = true; 
    accumulatedTime = 0.0;     
    lastFrameTime = performance.now(); 
    isProgrammaticPlaying = false; 
    window.autoplayStartTime = performance.now(); // 오토플레이 시작 타임스탬프 기록 (미세 관성 가드용)

    // 빨리감기 상태가 아니면 배율을 1.0으로 리셋
    if (!isFastForwarding) {
        speedMultiplier = 1.0; 
    }
    updatePlayingAudiosPlaybackRate(); 

    // 해당 컷 연출 효과를 0% 상태로 선제 락킹하여 1프레임 튀는 결함을 완전히 차단합니다.
    renderCutVisualEffects(currentCutId, 0, true);

    buildPlayItemsQueue(currentCutId);

    const mySessionId = Math.random();
    activeSessionId = mySessionId;
    isPlayMode = true;

    // 만약 오디오 컨텍스트가 존재하면 resume 보장
    if (audioPipeManager.ctx) {
        audioPipeManager.ctx.resume().catch(() => {});
    }

    updateRealtimeTimeline(mySessionId);
}

// 자동 연출 완료 또는 중단 시 일반 수동 모드로 부드럽게 원복시키는 복구용 헬퍼 함수
function restoreEditMode() {
    isTimeBasedAutoplay = false; 
    isPlayMode = false;          
    isProgrammaticPlaying = false;

    // 빨리감기가 아닐 때 배율 리셋
    if (!isFastForwarding) {
        speedMultiplier = 1.0;
    }
    updatePlayingAudiosPlaybackRate();

    stopAllAudios();

    if (playAnimationId) {
        cancelAnimationFrame(playAnimationId);
        playAnimationId = null;
    }

    // 컷 비주얼 효과 최종 상태(1.0) 복원
    if (currentCutId) {
        renderCutVisualEffects(currentCutId, 1.0, false);
    }

    // 말풍선들의 인라인 opacity 리셋하여 CSS 트랜지션 클래스(show) 본연 상태로 원복
    cuts.forEach(c => {
        const belongsToCurrentCut = c.id === currentCutId;
        const state = belongsToCurrentCut ? 'show' : 'hide';
        
        syncCutBubblesState(c.id, state);
        
        // 런타임 뷰어 및 편집기 복구 연계
        const activeSceneList = document.getElementById(`sceneList_${c.id}`);
        if (activeSceneList) {
            activeSceneList.querySelectorAll('.dialogue-item').forEach(card => {
                const bubble = card.bubbleDOM;
                if (bubble) {
                    bubble.style.transition = 'none';
                    const tailSvg = bubble.querySelector('.tail-svg');
                    const paths = bubble.querySelectorAll('.bubble-path');
                    if (tailSvg) tailSvg.style.transition = 'none';
                    if (paths.length > 0) {
                        paths.forEach(p => p.style.transition = 'none');
                    }

                    if (belongsToCurrentCut) {
                        bubble.style.opacity = '1';
                        if (tailSvg) tailSvg.style.opacity = '1';
                        if (paths.length > 0) {
                            paths.forEach(p => p.style.opacity = '1');
                        }
                    } else {
                        bubble.style.opacity = '0';
                        if (tailSvg) tailSvg.style.opacity = '0';
                        if (paths.length > 0) {
                            paths.forEach(p => p.style.opacity = '0');
                        }
                    }

                    void bubble.offsetWidth; // 리플로우

                    bubble.style.transition = '';
                    bubble.style.opacity = '';
                    if (tailSvg) {
                        tailSvg.style.transition = '';
                        tailSvg.style.opacity = '';
                    }
                    if (paths.length > 0) {
                        paths.forEach(p => {
                            p.style.transition = '';
                            p.style.opacity = '';
                        });
                    }
                }
            });
        }
    });

    // [편집기 전용 로직 복구 가드]
    const playBtn = document.getElementById('playBtn');
    if (playBtn) {
        playBtn.innerHTML = '▶ 현재 컷 연출 재생';
        playBtn.className = 'play-btn';
    }

    // 현재 편집 모드로 복구된 컷의 배경파일명 및 효과 셀렉터 리로드
    const activeCut = cuts.find(c => c.id === currentCutId);
    if (activeCut) {
        const cutImageName = document.getElementById('cutImageName');
        if (cutImageName) {
            cutImageName.textContent = activeCut.bgImageName || '선택된 파일 없음';
        }
        const cutEffectSelect = document.getElementById('cutEffectSelect');
        if (cutEffectSelect) {
            cutEffectSelect.value = activeCut.effectType || 'none';
        }
        
        // 타임라인 플레이헤드 초기화
        const activeSceneList = document.getElementById(`sceneList_${currentCutId}`);
        if (activeSceneList) {
            activeSceneList.querySelectorAll('.timeline-playhead').forEach(ph => {
                ph.style.opacity = '0';
                ph.style.left = '0%';
            });
        }
    }
}

// 오디오 사운드 전체 소멸
function stopAllAudios() {
    playingAudios.forEach(audio => {
        try {
            audio.pause();
            audio.currentTime = 0;
        } catch (e) {}
    });
    playingAudios = [];
}

// 재생 중인 오디오 배속 변동 적용
function updatePlayingAudiosPlaybackRate() {
    playingAudios.forEach(audio => {
        try {
            audio.playbackRate = speedMultiplier;
        } catch (e) {}
    });
}

// 단일화된 연출 프레임 큐 빌더 (편집기 카드 및 런타임 뷰어 데이터 이중 구조 지원)
function buildPlayItemsQueue(cutId) {
    playItemsQueue = [];
    stopAllAudios();

    const cut = cuts.find(c => c.id === cutId);
    if (!cut) return 0;

    let maxDuration = 2.0; // 최소 재생 보장 시간
    const activeSceneList = document.getElementById(`sceneList_${cutId}`);

    if (activeSceneList) {
        // [1] 편집기 모드: DOM 카드를 직접 긁어서 실시간 연출 큐 구축
        const dialogueCards = activeSceneList.querySelectorAll('.dialogue-item');
        dialogueCards.forEach(card => {
            const id = card.dataset.id;
            const charName = card.querySelector('.diag-char-name').value;
            const text = card.querySelector('.diag-text').value;
            const startSec = parseFloat(card.querySelector('.diag-start').value) || 0;
            const duration = parseFloat(card.querySelector('.diag-duration').value) || 2.0;
            
            // 오디오 URL
            const audioUrl = card.audioUrl || null;
            
            // 캔버스 말풍선 매칭
            const bubble = card.bubbleDOM || document.querySelector(`.speech-bubble[data-card-id="${id}"]`);
            if (bubble) {
                card.bubbleDOM = bubble;
                // 1글자 단위 타이핑 래퍼 빌드
                prepareBubbleTyping(bubble, text);
            }

            playItemsQueue.push({
                id: id,
                type: 'dialogue',
                isDialogue: true,
                startSec: startSec,
                duration: duration,
                text: text,
                audioUrl: audioUrl,
                bubbleDOM: bubble,
                audioObj: null,
                triggered: false
            });

            if (startSec + duration > maxDuration) {
                maxDuration = startSec + duration;
            }
        });

        const sfxCards = activeSceneList.querySelectorAll('.sfx-item');
        sfxCards.forEach(card => {
            const id = card.dataset.id;
            const startSec = parseFloat(card.querySelector('.diag-start').value) || 0;
            const duration = parseFloat(card.querySelector('.diag-duration').value) || 2.0;
            const audioUrl = card.audioUrl || null;

            playItemsQueue.push({
                id: id,
                type: 'sfx',
                isDialogue: false,
                startSec: startSec,
                duration: duration,
                audioUrl: audioUrl,
                audioObj: null,
                triggered: false
            });

            if (startSec + duration > maxDuration) {
                maxDuration = startSec + duration;
            }
        });
    } else {
        // [2] 런타임 뷰어 모드: cuts 선언 배열(data.json 로드 데이터)을 통해 큐 구축
        if (cut.items && cut.items.length > 0) {
            cut.items.forEach(item => {
                const startSec = parseFloat(item.start) || 0;
                const duration = parseFloat(item.duration) || 2.0;
                let bubble = null;

                if (item.type === 'dialogue') {
                    bubble = document.getElementById(`bubble_${item.id}`);
                    if (bubble) {
                        prepareBubbleTyping(bubble, item.text);
                    }
                }

                playItemsQueue.push({
                    id: item.id,
                    type: item.type,
                    isDialogue: item.type === 'dialogue',
                    startSec: startSec,
                    duration: duration,
                    text: item.text || '',
                    audioUrl: item.audioUrl || null,
                    bubbleDOM: bubble,
                    audioObj: null,
                    triggered: false
                });

                if (startSec + duration > maxDuration) {
                    maxDuration = startSec + duration;
                }
            });
        }
    }

    maxCutDuration = maxDuration;
    return playItemsQueue.length;
}

// 말풍선 내부 한 글자 단위 span 쪼개기 헬퍼 함수
function prepareBubbleTyping(bubble, text) {
    const textLayer = bubble.querySelector('.bubble-text-layer');
    if (!textLayer) return;

    // [성능 개선 5 - prepareBubbleTyping 텍스트 캐싱]
    if (bubble.lastPreparedText === text) {
        return;
    }
    bubble.lastPreparedText = text;

    // 강제 초기 상태 청소 (번쩍임 예방 및 opacity=0 락 적용)
    bubble.style.transition = 'none';
    bubble.style.opacity = '0';
    
    const tailSvg = bubble.querySelector('.tail-svg');
    const paths = bubble.querySelectorAll('.bubble-path');
    if (tailSvg) {
        tailSvg.style.transition = 'none';
        tailSvg.style.opacity = '0';
    }
    if (paths.length > 0) {
        paths.forEach(p => {
            p.style.transition = 'none';
            p.style.opacity = '0';
        });
    }

    bubble.classList.remove('show');
    bubble.classList.add('animate');
    void bubble.offsetWidth; // Reflow 강제

    // 글자 분할 래퍼 생성
    const rawText = text || '';
    textLayer.innerHTML = `<span class="typing-wrapper" style="opacity:1;"></span>`;
    const wrapper = textLayer.querySelector('.typing-wrapper');
    
    for (let char of rawText) {
        const span = document.createElement('span');
        span.textContent = char;
        span.style.opacity = '0';
        span.style.transition = 'opacity 0.15s ease';
        wrapper.appendChild(span);
    }
}

// =========================================================================
// 🔄 데이터 스키마 매핑(Mapping Schema) 및 리소스 경로 정규화 엔진 (viewer.js)
// =========================================================================

var autoplayStartTime = window.autoplayStartTime = window.autoplayStartTime || 0;

// 프로퍼티 매핑 용 스키마 정의
const dialogueSchema = {
    id: ['id', 'ID'],
    type: ['type', 'Type'],
    charName: ['charName', 'characterName', 'speaker'],
    charColor: ['charColor', 'color', 'bubbleColor'],
    text: ['text', 'content', 'dialogueText'],
    audioUrl: ['audioUrl', 'audioPath', 'soundUrl', 'audio'],
    start: ['start', 'startTime', 'startSec'],
    duration: ['duration', 'playTime', 'length'],
    x: ['x', 'posX', 'left'],
    y: ['y', 'posY', 'top'],
    baseAngle: ['baseAngle', 'angle'],
    tipDx: ['tipDx', 'dx'],
    tipDy: ['tipDy', 'dy'],
    baseWidth: ['baseWidth', 'tailWidth']
};

const sfxSchema = {
    id: ['id', 'ID'],
    type: ['type', 'Type'],
    name: ['name', 'sfxName', 'title'],
    audioUrl: ['audioUrl', 'audioPath', 'soundUrl', 'audio'],
    start: ['start', 'startTime', 'startSec'],
    duration: ['duration', 'playTime', 'length']
};

const bgmSchema = {
    id: ['id', 'ID'],
    name: ['name', 'bgmName', 'title'],
    audioUrl: ['audioUrl', 'audioPath', 'soundUrl', 'audio'],
    startCut: ['startCut', 'fromCut'],
    endCut: ['endCut', 'toCut'],
    startTime: ['startTime', 'start', 'startSec']
};

// 동적 오브젝트 키-밸류 매핑 유틸리티
function mapObjectProperties(obj, schema) {
    if (!obj) return null;
    const mapped = {};
    for (const [standardKey, possibleKeys] of Object.entries(schema)) {
        // 객체 내에 매치되는 첫 번째 키 인출
        const actualKey = possibleKeys.find(k => k in obj);
        if (actualKey !== undefined) {
            mapped[standardKey] = obj[actualKey];
        } else {
            mapped[standardKey] = null; // 디폴트 널 바인딩
        }
    }
    return mapped;
}

// 전체 데이터 경로 정규화 재귀 탐색기
function normalizeProjectDataPaths(data) {
    if (!data) return data;
    
    // 1. 글로벌 BGM 오디오 경로 정규화
    if (data.bgms && Array.isArray(data.bgms)) {
        data.bgms.forEach(b => {
            if (b.audioUrl) b.audioUrl = normalizeMediaPath(b.audioUrl);
        });
    }
    
    // 2. 개별 컷 및 다중 레이어, 씬 아이템 오디오 경로 정규화
    if (data.cuts && Array.isArray(data.cuts)) {
        data.cuts.forEach(c => {
            if (c.bgImage) c.bgImage = normalizeMediaPath(c.bgImage);
            if (c.bgImageName) c.bgImageName = normalizeMediaPath(c.bgImageName);
            
            if (c.layer1 && c.layer1.url) c.layer1.url = normalizeMediaPath(c.layer1.url);
            if (c.layer2 && c.layer2.url) c.layer2.url = normalizeMediaPath(c.layer2.url);
            if (c.layer3 && c.layer3.url) c.layer3.url = normalizeMediaPath(c.layer3.url);
            
            if (c.items && Array.isArray(c.items)) {
                c.items.forEach(item => {
                    if (item.audioUrl) item.audioUrl = normalizeMediaPath(item.audioUrl);
                });
            }
        });
    }
    return data;
}

// 표준 스키마 검증 및 경로 정규화 통합 어댑터 코어
function normalizeAndMapProjectData(data) {
    if (!data) return data;

    const mappedData = {
        version: data.version || "2.0",
        bgms: [],
        cuts: []
    };

    // 1. 글로벌 BGM 매핑 및 마이그레이션
    if (data.bgms && Array.isArray(data.bgms)) {
        mappedData.bgms = data.bgms.map(b => mapObjectProperties(b, bgmSchema));
    }

    // 2. 컷 데이터 매핑 및 하위 호환 마이그레이션
    if (data.cuts && Array.isArray(data.cuts)) {
        mappedData.cuts = data.cuts.map(c => {
            const mappedCut = {
                id: c.id || "",
                index: c.index || 1,
                layer1: c.layer1 ? { url: c.layer1.url || "", name: c.layer1.name || "", type: c.layer1.type || "image" } : null,
                layer2: c.layer2 ? { url: c.layer2.url || "", name: c.layer2.name || "", type: c.layer2.type || "image" } : null,
                layer3: c.layer3 ? { url: c.layer3.url || "", name: c.layer3.name || "", type: c.layer3.type || "image" } : null,
                bgImage: c.bgImage || null,
                bgImageName: c.bgImageName || null,
                effectType: c.effectType || "none",
                items: []
            };

            // 구버전(1.0) bgImage -> 신버전(2.0) layer3 승격 대응
            if (!mappedCut.layer3 && mappedCut.bgImage) {
                mappedCut.layer3 = {
                    url: mappedCut.bgImage,
                    name: mappedCut.bgImageName || "배경",
                    type: "image"
                };
            }

            // 대사 및 효과음 아이템 매핑
            if (c.items && Array.isArray(c.items)) {
                mappedCut.items = c.items.map(item => {
                    const itemType = item.type || "";
                    if (itemType === 'dialogue') {
                        return {
                            ...mapObjectProperties(item, dialogueSchema),
                            type: 'dialogue'
                        };
                    } else if (itemType === 'sfx') {
                        return {
                            ...mapObjectProperties(item, sfxSchema),
                            type: 'sfx'
                        };
                    }
                    return item;
                });
            }

            return mappedCut;
        });
    }

    // 3. 정규화 파이프라인 수행 후 반환
    return normalizeProjectDataPaths(mappedData);
}

// 글로벌 네임스페이스 바인딩 (HTML에서 호출 가능하도록)
window.normalizeAndMapProjectData = normalizeAndMapProjectData;
window.normalizeProjectDataPaths = normalizeProjectDataPaths;
window.mapObjectProperties = mapObjectProperties;

// =========================================================================
// 🚀 [성능 개선 1 & 3] Lazy Rendering, Swap 및 이미지 풀링 핵심 모듈 (viewer.js)
// =========================================================================

// 명암 대비 색상 계산기 (Contrast YIQ)
function getContrastYIQ(hexcolor){
    if(!hexcolor) return '#111827';
    hexcolor = hexcolor.replace("#", "");
    var r = parseInt(hexcolor.substr(0,2),16);
    var g = parseInt(hexcolor.substr(2,2),16);
    var b = parseInt(hexcolor.substr(4,2),16);
    var yiq = ((r*299)+(g*587)+(b*114))/1000;
    return (yiq >= 128) ? '#111827' : '#ffffff'; 
}
window.getContrastYIQ = getContrastYIQ;

// 말풍선 DOM 동적 생성기 (Swap-in 용)
function createBubbleDOM(cutId, item) {
    const bubble = document.createElement('div');
    bubble.className = 'speech-bubble show';
    bubble.id = `bubble_${item.id}`;
    bubble.dataset.cardId = item.id;
    bubble.style.left = `${item.x}%`;
    bubble.style.top = `${item.y}%`;
    bubble.style.setProperty('--bubble-color', item.charColor || '#ffffff');
    bubble.style.setProperty('--text-color', getContrastYIQ(item.charColor || '#ffffff'));

    // 실시간 말꼬리 렌더링에 필요한 물리 속성들을 데이터셋으로 바인딩
    bubble.dataset.baseAngle = item.baseAngle || 45;
    bubble.dataset.tipDx = item.tipDx || 30;
    bubble.dataset.tipDy = item.tipDy || 30;
    bubble.dataset.baseWidth = item.baseWidth || 14;

    bubble.innerHTML = `
        <div class="bubble-shadow-layer"></div>
        <div class="bubble-bg-cover"></div>
        <svg class="tail-svg" viewBox="0 0 1000 1000" width="1000" height="1000" style="opacity: 1;">
            <path class="bubble-path bubble-path-fill" d="" style="fill: var(--bubble-color); stroke: none; opacity: 1;" />
            <path class="bubble-path bubble-path-stroke" d="" style="fill: none; stroke: #111827; stroke-width: 2.5px; stroke-linejoin: round; stroke-linecap: round; opacity: 1;" />
        </svg>
        <div class="bubble-text-layer">${item.text || ''}</div>
        <div class="handle base-handle" title="뿌리 조절"></div><div class="handle tip-handle" title="꼬리 끝 조절"></div>
    `;

    // 꼬리 그리기 함수 호출
    if (typeof updateTail === 'function') {
        setTimeout(() => updateTail(bubble), 0);
    } else if (typeof updateTailRuntime === 'function') {
        setTimeout(() => updateTailRuntime(bubble, item.baseAngle, item.tipDx, item.tipDy, item.baseWidth), 0);
    }
    
    // ResizeObserver 바인딩
    const observer = window.resizeObserver;
    if (observer) {
        observer.observe(bubble);
    }

    return bubble;
}
window.createBubbleDOM = createBubbleDOM;

// Active Cut 중심 Lazy Rendering & Swap 및 이미지 풀링 시스템
function swapActiveCutsDOM(activeCutId) {
    if (!cuts || cuts.length === 0) return;
    
    const activeCutIdx = cuts.findIndex(c => c.id === activeCutId);
    if (activeCutIdx === -1) return;

    // 활성 윈도우 범위 결정 (활성 컷 + 앞/뒤 1컷)
    const windowStart = Math.max(0, activeCutIdx - 1);
    const windowEnd = Math.min(cuts.length - 1, activeCutIdx + 1);

    cuts.forEach((cut, idx) => {
        const cutItem = document.getElementById(`viewerCut_${cut.id}`);
        if (!cutItem) return;

        const inWindow = idx >= windowStart && idx <= windowEnd;

        if (inWindow) {
            // Swap-in: 활성 범위에 속한 경우
            // 1. 3중 레이어 생성
            const hasLayers = cutItem.querySelector('.cut-layer, .cut-bg-image');
            if (!hasLayers) {
                if (typeof renderCutLayers === 'function') {
                    renderCutLayers(cutItem, cut);
                } else {
                    // viewer.html용 레이어 생성 폴백
                    buildViewerLayersFallback(cutItem, cut);
                }
            }

            // 2. 말풍선 컨테이너 및 말풍선 DOM 생성
            let bubbleContainer = cutItem.querySelector('.bubble-container');
            if (!bubbleContainer) {
                bubbleContainer = document.createElement('div');
                bubbleContainer.className = 'bubble-container';
                bubbleContainer.id = `bubbleContainer_${cut.id}`;
                cutItem.appendChild(bubbleContainer);
            }

            // 각 대사 아이템에 대해 말풍선 DOM 생성
            const dialogueItems = (cut.items || []).filter(item => item.type === 'dialogue');
            dialogueItems.forEach(item => {
                let bubble = document.getElementById(`bubble_${item.id}`) || bubbleContainer.querySelector(`[data-card-id="${item.id}"]`);
                if (!bubble) {
                    bubble = createBubbleDOM(cut.id, item);
                    bubbleContainer.appendChild(bubble);
                }
                
                // 편집기 카드 바인딩 동기화
                const card = document.querySelector(`.dialogue-item[data-id="${item.id}"]`);
                if (card) {
                    card.bubbleDOM = bubble;
                }
            });
        } else {
            // Swap-out (비활성 컷): 이미지 풀링 & 메모리 해제
            // 1. 비디오 해제 및 레이어 DOM 제거
            const layers = cutItem.querySelectorAll('.cut-layer, .cut-bg-image');
            layers.forEach(layer => {
                if (layer.tagName === 'VIDEO') {
                    try {
                        layer.pause();
                        layer.src = "";
                        layer.load();
                    } catch(e) {}
                }
                layer.remove();
            });

            // 2. 말풍선 DOM 및 컨테이너 비우기
            const bubbleContainer = cutItem.querySelector('.bubble-container');
            if (bubbleContainer) {
                const observer = window.resizeObserver;
                bubbleContainer.querySelectorAll('.speech-bubble').forEach(bubble => {
                    if (observer) {
                        try {
                            observer.unobserve(bubble);
                        } catch(e) {}
                    }
                });
                bubbleContainer.innerHTML = "";
            }

            // 3. 씬 리스트 카드의 bubbleDOM 해제
            const dialogueItems = (cut.items || []).filter(item => item.type === 'dialogue');
            dialogueItems.forEach(item => {
                const card = document.querySelector(`.dialogue-item[data-id="${item.id}"]`);
                if (card) {
                    card.bubbleDOM = null;
                }
            });
        }
    });
}
window.swapActiveCutsDOM = swapActiveCutsDOM;

// viewer.html용 레이어 생성 헬퍼
function buildViewerLayersFallback(cutItem, c) {
    function buildLayer(layerIndex, layerObj) {
        if (!layerObj || !layerObj.url) return null;

        let el;
        if (layerObj.type === 'video') {
            el = document.createElement('video');
            el.src = normalizeMediaPath(layerObj.url);
            el.autoplay = true;
            el.loop = true;
            el.muted = true;
            el.playsinline = true;
            el.setAttribute('autoplay', '');
            el.setAttribute('loop', '');
            el.setAttribute('muted', '');
            el.setAttribute('playsinline', '');

            // 첫 번째 컷(Index 1) 비디오 로드 완료 감시
            if (c.index === 1) {
                el.addEventListener('loadeddata', () => {
                    cutItem.style.transition = 'opacity 0.3s ease';
                    cutItem.style.opacity = '1';
                });
            }
        } else {
            el = document.createElement('div');
            el.style.backgroundImage = `url(${normalizeMediaPath(layerObj.url)})`;

            // 첫 번째 컷(Index 1) 이미지 로드 완료 감시
            if (c.index === 1) {
                const img = new Image();
                img.onload = () => {
                    cutItem.style.transition = 'opacity 0.3s ease';
                    cutItem.style.opacity = '1';
                };
                img.src = normalizeMediaPath(layerObj.url);
            }
        }

        el.className = 'cut-layer';
        el.dataset.layer = layerIndex;

        // Stacking order
        if (layerIndex === 3) el.style.zIndex = '1';
        else if (layerIndex === 2) el.style.zIndex = '2';
        else if (layerIndex === 1) el.style.zIndex = '3';

        // 연출 효과 타입 적용
        if (c.effectType && c.effectType !== 'none' && c.effectType !== 'shake') {
            el.classList.add(`effect-${c.effectType}`);
        }

        return el;
    }

    const l3 = buildLayer(3, c.layer3 || (c.bgImage ? { url: c.bgImage, name: c.bgImageName || '배경', type: 'image' } : null));
    const l2 = buildLayer(2, c.layer2);
    const l1 = buildLayer(1, c.layer1);

    const bubbleContainer = cutItem.querySelector('.bubble-container');

    if (l3) cutItem.insertBefore(l3, bubbleContainer || null);
    if (l2) cutItem.insertBefore(l2, bubbleContainer || null);
    if (l1) cutItem.insertBefore(l1, bubbleContainer || null);

    if (c.effectType === 'shake') {
        cutItem.classList.add('effect-shake');
    }
}

