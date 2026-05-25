// =========================================================================
// ?렗 ?뱁댆 ?쒕꽕留덊떛 酉곗뼱 怨듯넻 ?곗텧 諛??ъ슫???듭떖 ?붿쭊 紐⑤뱢 (viewer.js)
// =========================================================================

// 1. ?꾩뿭 蹂??李몄“ ?덉쟾 ?μ튂 (Global Variable Safeguard)
window.cuts = window.cuts || [];
window.currentCutId = window.currentCutId || null;
window.isSyncScrolling = window.isSyncScrolling || false;
window.programmaticScrollAnimId = window.programmaticScrollAnimId || null;
window.isTimeBasedAutoplay = window.isTimeBasedAutoplay || false;
window.lastSettledCutId = window.lastSettledCutId || null;
window.lastFrameTime = window.lastFrameTime || 0;
window.isProgrammaticPlaying = window.isProgrammaticPlaying || false;
window.accumulatedTime = window.accumulatedTime || 0.0;
window.isFirstCutReady = window.isFirstCutReady || false;
window.isFastForwarding = window.isFastForwarding || false;
window.speedMultiplier = window.speedMultiplier || 1.0;
window.playItemsQueue = window.playItemsQueue || [];
window.playingAudios = window.playingAudios || [];
window.playAnimationId = window.playAnimationId || null;
window.activeSessionId = window.activeSessionId || null;
window.isPlayMode = window.isPlayMode || false;
window.maxCutDuration = window.maxCutDuration || 10.0;
window.isScrollDirectionDown = window.isScrollDirectionDown || true;
window.viewerScrollContainer = window.viewerScrollContainer || null;
window.isBgmVolumeMuted = window.isBgmVolumeMuted || false;
window.isAutoplayPending = window.isAutoplayPending || false;

// 2. ?ㅽ겕由쏀듃 ?꾩뿭 ?ㅼ퐫??蹂???뺤쓽
var cuts;
var currentCutId;
var isSyncScrolling;
var programmaticScrollAnimId;
var isTimeBasedAutoplay;
var lastSettledCutId;
var lastFrameTime;
var isProgrammaticPlaying;
var accumulatedTime;
var isFirstCutReady;
var isFastForwarding;
var speedMultiplier;
var playItemsQueue;
var playingAudios;
var playAnimationId;
var activeSessionId;
var isPlayMode;
var maxCutDuration;
var isScrollDirectionDown;
var viewerScrollContainer;
var isBgmVolumeMuted;
var isAutoplayPending;
var audioPipeManager;

// 3. 濡쒕뱶 ?쒖꽌 臾댁떆 ?섑띁 (Load Event Wrapper)
window.addEventListener('DOMContentLoaded', () => {
    cuts = window.cuts = window.cuts || [];
    currentCutId = window.currentCutId = window.currentCutId || null;
    isSyncScrolling = window.isSyncScrolling = window.isSyncScrolling || false;
    programmaticScrollAnimId = window.programmaticScrollAnimId = window.programmaticScrollAnimId || null;
    isTimeBasedAutoplay = window.isTimeBasedAutoplay = window.isTimeBasedAutoplay || false;
    lastSettledCutId = window.lastSettledCutId = window.lastSettledCutId || null;
    lastFrameTime = window.lastFrameTime = window.lastFrameTime || 0;
    isProgrammaticPlaying = window.isProgrammaticPlaying = window.isProgrammaticPlaying || false;
    accumulatedTime = window.accumulatedTime = window.accumulatedTime || 0.0;
    isFirstCutReady = window.isFirstCutReady = window.isFirstCutReady || false;

    isFastForwarding = window.isFastForwarding = window.isFastForwarding || false;
    speedMultiplier = window.speedMultiplier = window.speedMultiplier || 1.0;
    playItemsQueue = window.playItemsQueue = window.playItemsQueue || [];
    playingAudios = window.playingAudios = window.playingAudios || [];
    playAnimationId = window.playAnimationId = window.playAnimationId || null;
    activeSessionId = window.activeSessionId = window.activeSessionId || null;
    isPlayMode = window.isPlayMode = window.isPlayMode || false;
    maxCutDuration = window.maxCutDuration = window.maxCutDuration || 10.0;
    isScrollDirectionDown = window.isScrollDirectionDown = window.isScrollDirectionDown || true;
    viewerScrollContainer = window.viewerScrollContainer = window.viewerScrollContainer || null;
    isBgmVolumeMuted = window.isBgmVolumeMuted = window.isBgmVolumeMuted || false;
    isAutoplayPending = window.isAutoplayPending = window.isAutoplayPending || false;

    audioPipeManager = window.audioPipeManager = window.audioPipeManager || new WebAudioPipeManager();
});

function normalizeMediaPath(url) {
    if (!url) return "";
    if (url.startsWith('blob:') || url.startsWith('http:') || url.startsWith('https:') || url.startsWith('/') || url.includes('/') || url.includes('\\')) {
        return url;
    }
    return '자료/' + url;
}
window.normalizeMediaPath = normalizeMediaPath; // 전역 스코프 바인딩
// ================= Web Audio API ?먮룞 ?뚯븬 ?뺢퇋??Auto-Normalization) ?쒖뒪??=================
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
        
        // 1. 蹂댁씠??諛?SFX 留덉뒪??梨꾨꼸 ?뗭뾽
        this.voiceMasterGain = this.ctx.createGain();
        this.voiceMasterAnalyser = this.ctx.createAnalyser();
        this.voiceMasterAnalyser.fftSize = 512;
        this.voiceMasterGain.connect(this.voiceMasterAnalyser);
        this.voiceMasterAnalyser.connect(this.ctx.destination);
        
        // 2. BGM 留덉뒪??梨꾨꼸 ?뗭뾽
        this.bgmMasterGain = this.ctx.createGain();
        this.bgmMasterAnalyser = this.ctx.createAnalyser();
        this.bgmMasterAnalyser.fftSize = 512;
        this.bgmMasterGain.connect(this.bgmMasterAnalyser);
        this.bgmMasterAnalyser.connect(this.ctx.destination);
    }

    connectAudio(audioElement, type = 'voice') {
        // [CORS 蹂댁븞 ?덉쇅 李⑤떒 媛?? 濡쒖뺄 file:/// ?꾨줈?좎퐳 ?섍꼍?먯꽌??釉뚮씪?곗???媛뺣젰??CORS ?쒖빟?쇰줈 
        // MediaElementAudioSourceNode ?앹꽦 ??臾댁“嫄?SecurityError媛 ?좊컻?섎?濡? ?⑥닚 諛붿씠?⑥뒪 泥섎━?⑸땲??
        if (window.location.protocol === 'file:') {
            console.log("CORS ?쒗븳 紐⑤뱶 媛먯?: Web Audio API 留덉뒪??誘뱀꽌 ?곌껐??諛붿씠?⑥뒪?⑸땲??");
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

            // ?대떦 移댄뀒怨좊━ 留덉뒪??誘뱀꽌??蹂묓빀 ?곌껐
            const targetMaster = (type === 'bgm') ? this.bgmMasterGain : this.voiceMasterGain;
            analyserNode.connect(targetMaster);

            const nodePair = { gainNode, analyserNode, type };
            this.sourceCache.set(audioElement, source);
            this.nodesCache.set(audioElement, nodePair);

            return nodePair;
        } catch (e) {
            console.error("Web Audio API ?곌껐 ?ㅽ뙣:", e);
            return null;
        }
    }
}


// ?ㅼ떆媛?RMS 遺꾩꽍 諛??ㅽ넗 寃뚯씤 ?쇰뱶諛?猷⑦봽
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
        
        // 蹂댁씠???寃?-14dB, BGM ?寃?-26dB
        const targetDb = (type === 'bgm') ? -26.0 : -14.0;
        let targetGain = 1.0;
        
        if (db < -45.0) {
            // ?몄씠利?寃뚯씠???묐룞: 臾댁쓬/?≪쓬 ?뚮줈??援ш컙?먯꽌??寃뚯씤??1.0?쇰줈 媛뺤젣 ?섏썝?섏뿬 ?몄씠利??뚰븨 諛⑹?
            targetGain = 1.0;
        } else {
            const diffDb = targetDb - db;
            
            if (type === 'voice') {
                if (diffDb > 0) {
                    // ??ш? ??? 寃쎌슦?먮쭔 ?먮룞 利앺룺
                    targetGain = Math.pow(10, diffDb / 20);
                    targetGain = Math.min(4.0, targetGain); // 理쒕? 4諛?利앺룺 ?쒗븳
                } else {
                    targetGain = 1.0;
                }
            } else if (type === 'bgm') {
                if (diffDb < 0) {
                    // BGM???덈Т ?믪? 寃쎌슦?먮쭔 ?먮룞 媛먯뇙
                    targetGain = Math.pow(10, diffDb / 20);
                    targetGain = Math.max(0.05, targetGain); // 理쒖냼 0.05 媛먯뇙 ?쒗븳
                } else {
                    targetGain = 1.0;
                }
            }
        }
        
        // setTargetAtTime???댁슜??泥?컖??嫄곕?媛??놁씠 100ms 吏???섎졃
        gainNode.gain.setTargetAtTime(targetGain, now, 0.1);
    });
}

// 蹂댁씠?ㅼ? BGM???곗꽑?쒖쐞 媛以묒튂 6dB 寃⑹감 ?ㅼ떆媛??щ줈?ㅼ삤踰?議곗젅
function runPriorityCrossoverMonitoring() {
    if (!audioPipeManager.ctx || !audioPipeManager.voiceMasterAnalyser || !audioPipeManager.bgmMasterAnalyser) return;
    
    const now = audioPipeManager.ctx.currentTime;
    
    // 留뚯빟 諛곌꼍?뚯븙???뚯냼嫄??곹깭?쇰㈃ 寃뚯씤??0.0?쇰줈 媛뺤젣 怨좎젙 ??諛붿씠?⑥뒪
    if (window.isBgmVolumeMuted) {
        audioPipeManager.bgmMasterGain.gain.setTargetAtTime(0.0, now, 0.08);
        return;
    }
    
    // 1. 蹂댁씠??留덉뒪??RMS 怨꾩궛
    const voiceBuffer = new Float32Array(audioPipeManager.voiceMasterAnalyser.fftSize);
    audioPipeManager.voiceMasterAnalyser.getFloatTimeDomainData(voiceBuffer);
    let voiceSum = 0;
    for (let i = 0; i < voiceBuffer.length; i++) voiceSum += voiceBuffer[i] * voiceBuffer[i];
    const voiceRms = Math.sqrt(voiceSum / voiceBuffer.length);
    let voiceDb = -100;
    if (voiceRms > 0.00001) voiceDb = 20 * Math.log10(voiceRms);
    
    // 2. BGM 留덉뒪??RMS 怨꾩궛
    const bgmBuffer = new Float32Array(audioPipeManager.bgmMasterAnalyser.fftSize);
    audioPipeManager.bgmMasterAnalyser.getFloatTimeDomainData(bgmBuffer);
    let bgmSum = 0;
    for (let i = 0; i < bgmBuffer.length; i++) bgmSum += bgmBuffer[i] * bgmBuffer[i];
    const bgmRms = Math.sqrt(bgmSum / bgmBuffer.length);
    let bgmDb = -100;
    if (bgmRms > 0.00001) bgmDb = 20 * Math.log10(bgmRms);

    // 3. 蹂댁씠???ъ깮 媛먯? 諛?BGM ?곷? ?뚯븬 6dB ?댁긽 踰뚮┝ ?щ줈?ㅼ삤踰??묐룞
    if (voiceDb > -40.0) {
        // 蹂댁씠?ㅺ? ?ㅼ젣濡??좎쓽誘명븯寃?異쒕젰?섎뒗 援ш컙!
        const currentDiff = voiceDb - bgmDb;
        if (currentDiff < 6.0) {
            // 寃⑹감媛 6dB 誘몃쭔?댁뼱????ш? 臾삵옄 ?곕젮媛 ?덉쓣 ??BGM 留덉뒪?곕? 媛먯뇙
            const shortfallDb = 6.0 - currentDiff; // 梨꾩썙?????곗떆踰?李⑥씠
            const targetBgmMasterGain = Math.pow(10, -shortfallDb / 20);
            
            // BGM 留덉뒪??寃뚯씤??遺?쒕읇寃?媛먯뇙 (80ms 鍮좊Ⅸ 諛섏쓳 ?섎졃)
            audioPipeManager.bgmMasterGain.gain.setTargetAtTime(Math.min(1.0, Math.max(0.15, targetBgmMasterGain)), now, 0.08);
        } else {
            // ?대? 異⑸텇??李⑥씠媛 ?섎뒗 寃쎌슦 ?먮옒 蹂쇰ⅷ?쇰줈 蹂듭썝
            audioPipeManager.bgmMasterGain.gain.setTargetAtTime(1.0, now, 0.1);
        }
    } else {
        // 蹂댁씠??臾댁쓬 援ш컙: BGM 留덉뒪?곕? ?먮옒 蹂쇰ⅷ?쇰줈 遺?쒕읇寃?蹂듦뎄
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
    
    isSyncScrolling = true; // ?ㅽ겕濡??뺤? ??대㉧ 諛??몄쭛 蹂듦뎄 ?쏀궧
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

// ?ㅼ떆媛?Scene Sandboxing (?꾩옱 而룹씠 ?꾨땶 ?ㅻⅨ 紐⑤뱺 而룹쓽 ?붿냼 諛??ъ슫??寃⑸━)
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
            
            // 鍮꾪솢??而룸뱾??吏꾪뻾 以묒씤 媛쒕퀎 ?ㅻ뵒??媛뺤젣 以묐떒
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
                // ?고???酉곗뼱 紐⑤뱶???? playItemsQueue ???깅줉?섏뼱 ?덈뜕 ?ㅻⅨ 而룹쓽 ?ㅻ뵒?ㅻ뱾 ?뺤?
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

// 100% ?ㅽ겕濡?吏꾪뻾瑜?湲곕컲 ??꾨씪???ㅽ겕?щ튃 ?쒖뼱 肄붿뼱 ?⑥닔
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

        // [?몄쭛湲????깊겕 媛??
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
            // viewer.html ?꾩슜 ?≫떚釉??대옒??吏곸젒 ?깊겕
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
            cutImageName.textContent = activeCut.bgImageName || '?좏깮???뚯씪 ?놁쓬';
        }

        buildPlayItemsQueue(bestCutId);

        // [?깅뒫 媛쒖꽑 1 - Lazy Rendering Swap 湲곕룞]
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

// GPU 媛??鍮꾩＜???곗텧 ?ㅼ떆媛??ㅽ겕?щ튃 二쇱엯
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
    // ?몄쭛湲?移대뱶 ?붽낵 ?고???酉곗뼱 ???명솚???뺣낫
    const cards = [];
    const activeSceneList = document.getElementById(`sceneList_${cutId}`);
    if (activeSceneList) {
        activeSceneList.querySelectorAll('.dialogue-item').forEach(c => cards.push({ bubbleDOM: c.bubbleDOM }));
    } else {
        // ?고???酉곗뼱 紐⑤뱶: cuts 諛곗뿴?먯꽌 dialogue ?꾩씠?쒕뱾??李얠븘 吏곸젒 bubble DOM ?섏쭛
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
                
                // [援먯젙] 留먰뭾?좎씠 ?대? ?몄텧 ?곹깭?щ룄, ?ㅻⅨ ?곗텧???섑빐 媛?ㅼ죱??留먭섕由??⑥뒪?ㅺ낵 ?먮쭑 ?ㅽ뙩?ㅼ쓽 ?щ챸?꾨뒗 媛뺤젣濡??먮났?쒗궢?덈떎.
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

// 1?④퀎 ?뚮뜑留??꾨젅???⑥닔 ?낅┰??諛?[?깅뒫 媛쒖꽑 4 - ??댄븨 ?뚮뜑留?罹먯떛] ?곸슜
function renderItemsFrame() {
    // 3. 렌더링 엔진 상태 동기화 및 안전장치 완화
    // isFirstCutReady가 false일지라도 accumulatedTime(globalElapsed)이 0 이상이라면 화면을 렌더링함
    if (window.isFirstCutReady === false && (typeof window.accumulatedTime !== 'number' || window.accumulatedTime < 0)) {
        requestAnimationFrame(() => {
            if (typeof renderItemsFrame === 'function') {
                renderItemsFrame();
            }
        });
        return;
    }
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
                
                // [?깅뒫 媛쒖꽑 4 - ??댄븨 ?뚮뜑留?罹먯떛 ?꾪꽣]
                const spans = bubble.querySelectorAll('.typing-wrapper span');
                if (spans.length > 0) {
                    const progressPct = Math.min(1.0, elapsed / item.duration);
                    const spansToShow = Math.floor(spans.length * progressPct);
                    
                    // 罹먯떛 ?곸슜: ?댁쟾 ?꾨젅?꾧낵 ?숈씪??媛쒖닔?쇰㈃ DOM 媛깆떊 李⑤떒
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
                            item.audioObj.play().catch(e => console.log("?ㅻ뵒??play 吏??", e));
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
    
    // ?꾩옱 ?쒖꽦?붾맂 而??댁쓽 ?댁쨷 ??꾨씪???뚮젅?댄뿤??媛깆떊 (?몄쭛湲?紐⑤뱶?먯꽌留??ㅽ뻾)
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

// 60fps 留덉뒪???꾨젅???ㅼ?以꾨윭 (?ъ깮 ?곹깭???뚮쭔 臾댄븳 猷⑦봽 媛??
function updateRealtimeTimeline(mySessionId) {
    if (mySessionId !== activeSessionId) {
        return;
    }

    if (!isPlayMode) {
        document.querySelectorAll('.timeline-playhead').forEach(ph => ph.style.opacity = '0');
        playAnimationId = null; // 猷⑦봽 ?뚮옒洹?由ъ뀑 ???덉텧
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
                showStatus("?곗텧 ?꾨즺!");
            }
            return;
        }
    }
    lastFrameTime = now;

    renderItemsFrame();

    // [?뚰봽?몄썾???ㅼ씠?대? BGM ?뷀궧] Web Audio API 諛붿씠?⑥뒪 紐⑤뱶 (CORS ?쒗븳 file:// ?꾨줈?좎퐳 ?? ??묒쓣 ?꾪븳 
    // ?섏씠釉뚮━????꾨씪???곕룞??BGM ?먮룞 ?뚯븬 蹂댁젙 ?쒖뒪??
    const isLocalFileMode = window.location.protocol === 'file:';
    if (isLocalFileMode && window.activeBgms) {
        // ?꾩옱 ??꾨씪?몄긽 ?쒖꽦???ъ깮) 以묒씤 ???Dialogue) 蹂댁씠?ㅺ? ?덈뒗吏 媛먯?
        const isVoicePlaying = playItemsQueue.some(item => {
            if (!item.isDialogue) return false;
            const elapsed = accumulatedTime - item.startSec;
            return elapsed >= 0 && elapsed < item.duration;
        });

        // 蹂댁씠???ъ깮 以묒씪 ?뚮뒗 BGM??0.06(留ㅼ슦 ??땄), 洹??몄뿉??0.25(?쒖? 諛곌꼍??濡??ㅼ젙 (?? ?뚯냼嫄??쒖뿉??媛뺤젣 0.0)
        const targetBgmVol = window.isBgmVolumeMuted ? 0.0 : (isVoicePlaying ? 0.06 : 0.25);

        // activeBgms 媛앹껜 ?쒗쉶?섏뿬 媛?BGM ?몃옓???ㅻ뵒???섎━癒쇳듃 蹂쇰ⅷ??60fps濡?留ㅻ걚?쎄쾶 ?쇰뱶諛?議곗젅 (100ms ?대궡 ?섎졃)
        Object.values(window.activeBgms).forEach(track => {
            if (track.isPlaying && track.audio && !track.audio.fadeTimer) {
                const currentVol = track.audio.volume;
                // 留ㅻ걚?ъ슫 ?좏삎 蹂닿컙 媛먯뇙/蹂듦뎄 (lerp)
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

// 0.0珥??쒖젏遺???쒕꽕留덊떛 ?먮룞 ?곗텧???꾩쟾??源⑤걮?섍쾶 ?ㅽ넗?뚮젅??湲곕룞
function triggerAutoplayForCurrentCut() {
    isTimeBasedAutoplay = true; 
    accumulatedTime = 0.0;     
    lastFrameTime = performance.now(); 
    isProgrammaticPlaying = false; 
    window.autoplayStartTime = performance.now(); // ?ㅽ넗?뚮젅???쒖옉 ??꾩뒪?ы봽 湲곕줉 (誘몄꽭 愿??媛?쒖슜)

    // 鍮⑤━媛먭린 ?곹깭媛 ?꾨땲硫?諛곗쑉??1.0?쇰줈 由ъ뀑
    if (!isFastForwarding) {
        speedMultiplier = 1.0; 
    }
    updatePlayingAudiosPlaybackRate(); 

    // ?대떦 而??곗텧 ?④낵瑜?0% ?곹깭濡??좎젣 ?쏀궧?섏뿬 1?꾨젅?????寃고븿???꾩쟾??李⑤떒?⑸땲??
    renderCutVisualEffects(currentCutId, 0, true);

    buildPlayItemsQueue(currentCutId);

    const mySessionId = Math.random();
    activeSessionId = mySessionId;
    isPlayMode = true;

    // 留뚯빟 ?ㅻ뵒??而⑦뀓?ㅽ듃媛 議댁옱?섎㈃ resume 蹂댁옣
    if (audioPipeManager.ctx) {
        audioPipeManager.ctx.resume().catch(() => {});
    }

    updateRealtimeTimeline(mySessionId);
}

// ?먮룞 ?곗텧 ?꾨즺 ?먮뒗 以묐떒 ???쇰컲 ?섎룞 紐⑤뱶濡?遺?쒕읇寃??먮났?쒗궎??蹂듦뎄???ы띁 ?⑥닔
function restoreEditMode() {
    isTimeBasedAutoplay = false; 
    isPlayMode = false;          
    isProgrammaticPlaying = false;

    // 鍮⑤━媛먭린媛 ?꾨땺 ??諛곗쑉 由ъ뀑
    if (!isFastForwarding) {
        speedMultiplier = 1.0;
    }
    updatePlayingAudiosPlaybackRate();

    stopAllAudios();

    if (playAnimationId) {
        cancelAnimationFrame(playAnimationId);
        playAnimationId = null;
    }

    // 而?鍮꾩＜???④낵 理쒖쥌 ?곹깭(1.0) 蹂듭썝
    if (currentCutId) {
        renderCutVisualEffects(currentCutId, 1.0, false);
    }

    // 留먰뭾?좊뱾???몃씪??opacity 由ъ뀑?섏뿬 CSS ?몃옖吏???대옒??show) 蹂몄뿰 ?곹깭濡??먮났
    cuts.forEach(c => {
        const belongsToCurrentCut = c.id === currentCutId;
        const state = belongsToCurrentCut ? 'show' : 'hide';
        
        syncCutBubblesState(c.id, state);
        
        // ?고???酉곗뼱 諛??몄쭛湲?蹂듦뎄 ?곌퀎
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

                    void bubble.offsetWidth; // 由ы뵆濡쒖슦

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

    // [?몄쭛湲??꾩슜 濡쒖쭅 蹂듦뎄 媛??
    const playBtn = document.getElementById('playBtn');
    if (playBtn) {
        playBtn.innerHTML = '???꾩옱 而??곗텧 ?ъ깮';
        playBtn.className = 'play-btn';
    }

    // ?꾩옱 ?몄쭛 紐⑤뱶濡?蹂듦뎄??而룹쓽 諛곌꼍?뚯씪紐?諛??④낵 ??됲꽣 由щ줈??
    const activeCut = cuts.find(c => c.id === currentCutId);
    if (activeCut) {
        const cutImageName = document.getElementById('cutImageName');
        if (cutImageName) {
            cutImageName.textContent = activeCut.bgImageName || '?좏깮???뚯씪 ?놁쓬';
        }
        const cutEffectSelect = document.getElementById('cutEffectSelect');
        if (cutEffectSelect) {
            cutEffectSelect.value = activeCut.effectType || 'none';
        }
        
        // ??꾨씪???뚮젅?댄뿤??珥덇린??
        const activeSceneList = document.getElementById(`sceneList_${currentCutId}`);
        if (activeSceneList) {
            activeSceneList.querySelectorAll('.timeline-playhead').forEach(ph => {
                ph.style.opacity = '0';
                ph.style.left = '0%';
            });
        }
    }
}

// ?ㅻ뵒???ъ슫???꾩껜 ?뚮㈇
function stopAllAudios() {
    playingAudios.forEach(audio => {
        try {
            audio.pause();
            audio.currentTime = 0;
        } catch (e) {}
    });
    playingAudios = [];
}

// ?ъ깮 以묒씤 ?ㅻ뵒??諛곗냽 蹂???곸슜
function updatePlayingAudiosPlaybackRate() {
    playingAudios.forEach(audio => {
        try {
            audio.playbackRate = speedMultiplier;
        } catch (e) {}
    });
}

// ?⑥씪?붾맂 ?곗텧 ?꾨젅????鍮뚮뜑 (?몄쭛湲?移대뱶 諛??고???酉곗뼱 ?곗씠???댁쨷 援ъ“ 吏??
function buildPlayItemsQueue(cutId) {
    playItemsQueue = [];
    stopAllAudios();

    const cut = cuts.find(c => c.id === cutId);
    if (!cut) return 0;

    let maxDuration = 2.0; // 理쒖냼 ?ъ깮 蹂댁옣 ?쒓컙
    const activeSceneList = document.getElementById(`sceneList_${cutId}`);

    if (activeSceneList) {
        // [1] ?몄쭛湲?紐⑤뱶: DOM 移대뱶瑜?吏곸젒 湲곸뼱???ㅼ떆媛??곗텧 ??援ъ텞
        const dialogueCards = activeSceneList.querySelectorAll('.dialogue-item');
        dialogueCards.forEach(card => {
            const id = card.dataset.id;
            const charName = card.querySelector('.diag-char-name').value;
            const text = card.querySelector('.diag-text').value;
            const startSec = parseFloat(card.querySelector('.diag-start').value) || 0;
            const duration = parseFloat(card.querySelector('.diag-duration').value) || 2.0;
            
            // ?ㅻ뵒??URL
            const audioUrl = card.audioUrl || null;
            
            // 罹붾쾭??留먰뭾??留ㅼ묶
            const bubble = card.bubbleDOM || document.querySelector(`.speech-bubble[data-card-id="${id}"]`);
            if (bubble) {
                card.bubbleDOM = bubble;
                // 1湲???⑥쐞 ??댄븨 ?섑띁 鍮뚮뱶
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
        // [2] ?고???酉곗뼱 紐⑤뱶: cuts ?좎뼵 諛곗뿴(data.json 濡쒕뱶 ?곗씠?????듯빐 ??援ъ텞
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

// 留먰뭾???대? ??湲???⑥쐞 span 履쇨컻湲??ы띁 ?⑥닔
function prepareBubbleTyping(bubble, text) {
    const textLayer = bubble.querySelector('.bubble-text-layer');
    if (!textLayer) return;

    // [?깅뒫 媛쒖꽑 5 - prepareBubbleTyping ?띿뒪??罹먯떛]
    if (bubble.lastPreparedText === text) {
        return;
    }
    bubble.lastPreparedText = text;

    // 媛뺤젣 珥덇린 ?곹깭 泥?냼 (踰덉찉???덈갑 諛?opacity=0 ???곸슜)
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
    void bubble.offsetWidth; // Reflow 媛뺤젣

    // 湲??遺꾪븷 ?섑띁 ?앹꽦
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
// ?봽 ?곗씠???ㅽ궎留?留ㅽ븨(Mapping Schema) 諛?由ъ냼??寃쎈줈 ?뺢퇋???붿쭊 (viewer.js)
// =========================================================================

var autoplayStartTime = window.autoplayStartTime = window.autoplayStartTime || 0;

// ?꾨줈?쇳떚 留ㅽ븨 ???ㅽ궎留??뺤쓽
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

// ?숈쟻 ?ㅻ툕?앺듃 ??諛몃쪟 留ㅽ븨 ?좏떥由ы떚
function mapObjectProperties(obj, schema) {
    if (!obj) return null;
    const mapped = {};
    for (const [standardKey, possibleKeys] of Object.entries(schema)) {
        // 媛앹껜 ?댁뿉 留ㅼ튂?섎뒗 泥?踰덉㎏ ???몄텧
        const actualKey = possibleKeys.find(k => k in obj);
        if (actualKey !== undefined) {
            mapped[standardKey] = obj[actualKey];
        } else {
            mapped[standardKey] = null; // ?뷀뤃????諛붿씤??
        }
    }
    return mapped;
}

// ?꾩껜 ?곗씠??寃쎈줈 ?뺢퇋???ш? ?먯깋湲?
function normalizeProjectDataPaths(data) {
    if (!data) return data;
    
    // 1. 湲濡쒕쾶 BGM ?ㅻ뵒??寃쎈줈 ?뺢퇋??
    if (data.bgms && Array.isArray(data.bgms)) {
        data.bgms.forEach(b => {
            if (b.audioUrl) b.audioUrl = normalizeMediaPath(b.audioUrl);
        });
    }
    
    // 2. 媛쒕퀎 而?諛??ㅼ쨷 ?덉씠?? ???꾩씠???ㅻ뵒??寃쎈줈 ?뺢퇋??
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

// ?쒖? ?ㅽ궎留?寃利?諛?寃쎈줈 ?뺢퇋???듯빀 ?대뙌??肄붿뼱
function normalizeAndMapProjectData(data) {
    if (!data) return data;

    const mappedData = {
        version: data.version || "2.0",
        bgms: [],
        cuts: []
    };

    // 1. 湲濡쒕쾶 BGM 留ㅽ븨 諛?留덉씠洹몃젅?댁뀡
    if (data.bgms && Array.isArray(data.bgms)) {
        mappedData.bgms = data.bgms.map(b => mapObjectProperties(b, bgmSchema));
    }

    // 2. 而??곗씠??留ㅽ븨 諛??섏쐞 ?명솚 留덉씠洹몃젅?댁뀡
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

            // 援щ쾭??1.0) bgImage -> ?좊쾭??2.0) layer3 ?밴꺽 ???
            if (!mappedCut.layer3 && mappedCut.bgImage) {
                mappedCut.layer3 = {
                    url: mappedCut.bgImage,
                    name: mappedCut.bgImageName || "諛곌꼍",
                    type: "image"
                };
            }

            // ???諛??④낵???꾩씠??留ㅽ븨
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

    // 3. ?뺢퇋???뚯씠?꾨씪???섑뻾 ??諛섑솚
    return normalizeProjectDataPaths(mappedData);
}

// 湲濡쒕쾶 ?ㅼ엫?ㅽ럹?댁뒪 諛붿씤??(HTML?먯꽌 ?몄텧 媛?ν븯?꾨줉)
window.normalizeAndMapProjectData = normalizeAndMapProjectData;
window.normalizeProjectDataPaths = normalizeProjectDataPaths;
window.mapObjectProperties = mapObjectProperties;

// =========================================================================
// ?? [?깅뒫 媛쒖꽑 1 & 3] Lazy Rendering, Swap 諛??대?吏 ?留??듭떖 紐⑤뱢 (viewer.js)
// =========================================================================

// 紐낆븫 ?鍮??됱긽 怨꾩궛湲?(Contrast YIQ)
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

// 留먰뭾??DOM ?숈쟻 ?앹꽦湲?(Swap-in ??
function createBubbleDOM(cutId, item) {
    const bubble = document.createElement('div');
    bubble.className = 'speech-bubble show';
    bubble.id = `bubble_${item.id}`;
    bubble.dataset.cardId = item.id;
    bubble.style.left = `${item.x}%`;
    bubble.style.top = `${item.y}%`;
    bubble.style.setProperty('--bubble-color', item.charColor || '#ffffff');
    bubble.style.setProperty('--text-color', getContrastYIQ(item.charColor || '#ffffff'));

    // ?ㅼ떆媛?留먭섕由??뚮뜑留곸뿉 ?꾩슂??臾쇰━ ?띿꽦?ㅼ쓣 ?곗씠?곗뀑?쇰줈 諛붿씤??
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
        <div class="handle base-handle" title="肉뚮━ 議곗젅"></div><div class="handle tip-handle" title="瑗щ━ ??議곗젅"></div>
    `;

    // 瑗щ━ 洹몃━湲??⑥닔 ?몄텧
    if (typeof updateTail === 'function') {
        setTimeout(() => updateTail(bubble), 0);
    } else if (typeof updateTailRuntime === 'function') {
        setTimeout(() => updateTailRuntime(bubble, item.baseAngle, item.tipDx, item.tipDy, item.baseWidth), 0);
    }
    
    // ResizeObserver 諛붿씤??
    const observer = window.resizeObserver;
    if (observer) {
        observer.observe(bubble);
    }

    return bubble;
}
window.createBubbleDOM = createBubbleDOM;

// Active Cut 중심 Lazy Rendering & Swap 및 이미지 타임아웃 핵심 모듈 (viewer.js)

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

// 말풍선 DOM 동적 생성기 (Swap-in 시)
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

// Active Cut 중심 Lazy Rendering & Swap 및 이미지 대기 시스템
function swapActiveCutsDOM(activeCutId) {
    if (!cuts || cuts.length === 0) return;
    
    const activeCutIdx = cuts.findIndex(c => c.id === activeCutId);
    if (activeCutIdx === -1) return;

    // 활성 윈도우 범위 결정 (활성 컷 + 전후 1컷)
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
                    // viewer.html의 레이어 생성 콜백
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

            // 각 대화 아이템에 대해 말풍선 DOM 생성
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
            // Swap-out (비활성 컷): 이미지 해제 & 메모리 해제
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

            // 3. 리스트 카드의 bubbleDOM 해제
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

// viewer.html의 레이어 생성 헬퍼
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

            // 첫 번째 컷(Index 1) 비디오 로드 완료 감시 및 2초 강제 타임아웃
            if (c.index === 1) {
                let fallbackTriggered = false;
                const forceShowTimeout = setTimeout(() => {
                    fallbackTriggered = true;
                    cutItem.style.transition = 'opacity 0.3s ease';
                    cutItem.style.opacity = '1';
                    window.isFirstCutReady = true;
                    console.log("[Fallback Video Timeout] Force display Cut 1");
                }, 2000);

                el.addEventListener('loadeddata', () => {
                    if (fallbackTriggered) return;
                    clearTimeout(forceShowTimeout);
                    cutItem.style.transition = 'opacity 0.3s ease';
                    cutItem.style.opacity = '1';
                    window.isFirstCutReady = true;
                });
            }
        } else {
            el = document.createElement('div');
            el.style.backgroundImage = `url(${normalizeMediaPath(layerObj.url)})`;

            // 첫 번째 컷(Index 1) 이미지 로드 완료 감시 및 2초 강제 타임아웃
            if (c.index === 1) {
                let fallbackTriggered = false;
                const forceShowTimeout = setTimeout(() => {
                    fallbackTriggered = true;
                    cutItem.style.transition = 'opacity 0.3s ease';
                    cutItem.style.opacity = '1';
                    window.isFirstCutReady = true;
                    console.log("[Fallback Image Timeout] Force display Cut 1");
                }, 2000);

                const img = new Image();
                img.onload = () => {
                    if (fallbackTriggered) return;
                    clearTimeout(forceShowTimeout);
                    cutItem.style.transition = 'opacity 0.3s ease';
                    cutItem.style.opacity = '1';
                    window.isFirstCutReady = true;
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

        // 연출 효과 대상 적용
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
