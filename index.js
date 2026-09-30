/**
 * StickerPop - extension SillyTavern
 * Affiche le sprite des « Character Expressions » (#expression-holder / #expression-image) comme un sticker.
 *
 * v1.1.0
 *  - COMPORTEMENT D'ORIGINE RESTAURÉ : UN SEUL toucher sur le sticker le fait disparaître ; un toucher à l'endroit où il
 *    se trouvait le fait réapparaître (zone transparente, de la taille exacte du sticker, active seulement pendant le masquage).
 *    Plus de double toucher par défaut, plus de verrou de 1,2 s. Le petit bouton 🖼 devient une option (désactivée par défaut).
 *  - On garde les protections utiles de la 1.0.1 : un NOUVEAU sticker (changement d'expression) est toujours affiché,
 *    et un glisser-déposer / redimensionnement n'est jamais pris pour un toucher.
 *  - Animations d'apparition et de disparition au choix (16 choix), durée (100-2000 ms) et courbe réglables, bouton « Tester ».
 *    Les animations sont calculées en JS et appliquées en style inline !important sur #expression-holder : elles fonctionnent
 *    même si le CSS perso de l'utilisateur force opacity/transform/transition avec !important.
 *
 * v1.0.1 - le masquage est porté par #expression-holder (stable) et non par <img id="expression-image"> que SillyTavern
 *  clone/supprime à chaque changement d'expression.
 */
(() => {
    'use strict';

    const MODULE = 'stickerpop';
    const LOG = '[StickerPop]';
    const HOLDER_ID = 'expression-holder';
    const IMAGE_SELECTOR = 'img.expression';
    const RESTORE_ID = 'stickerpop-restore';
    const HITBOX_ID = 'stickerpop-hitbox';
    const STYLE_ID = 'stickerpop-style';
    const CLS_HIDDEN = 'stickerpop-hidden';
    const TAP_MAX_MS = 500;     // durée max d'un toucher
    const TAP_MAX_MOVE = 10;    // déplacement max (px) d'un toucher
    const DOUBLE_TAP_MS = 400;  // délai max entre 2 touchers (mode « double toucher » facultatif)
    const SETTINGS_VERSION = 2;

    const EASINGS = Object.freeze({
        'ease': [0.25, 0.1, 0.25, 1],
        'ease-out': [0, 0, 0.58, 1],
        'bounce': [0.34, 1.56, 0.64, 1],
        'linear': null,
    });
    const EASING_LABELS = [
        ['ease', 'Douce (ease)'],
        ['ease-out', 'Décélération (ease-out)'],
        ['bounce', 'Rebond (cubic-bezier)'],
        ['linear', 'Linéaire'],
    ];

    const DEFAULTS = Object.freeze({
        enabled: true,
        hideMode: 'single',      // 'single' | 'double' | 'never'
        animation: true,         // animations activées (sinon tout est instantané)
        animNew: true,           // animer aussi l'arrivée d'un nouveau sticker
        animIn: 'pop',
        animOut: 'pop',
        duration: 350,
        easing: 'ease',
        showRestoreButton: false, // bouton 🖼 facultatif
        settingsVersion: SETTINGS_VERSION,
    });

    /* ---------------- catalogue d'animations ----------------
       Chaque animation est une suite d'images clés [position 0..1, propriétés] décrivant l'APPARITION
       (du « invisible » au repos). La disparition est la même suite parcourue à l'envers.
       o opacité, x/y translation en % de la taille du sticker, s échelle, sx/sy échelle par axe, r rotation (°),
       rx/ry rotation 3D (°), b flou (px), br luminosité. Repos = { o:1, x:0, y:0, s:1, sx:1, sy:1, r:0, rx:0, ry:0, b:0, br:1 }. */
    const REST = Object.freeze({ o: 1, x: 0, y: 0, s: 1, sx: 1, sy: 1, r: 0, rx: 0, ry: 0, b: 0, br: 1 });
    const ANIMS = [
        { id: 'none', label: 'Aucune', frames: null },
        { id: 'fade', label: 'Fondu', frames: [[0, { o: 0 }], [1, {}]] },
        { id: 'pop', label: 'Zoom (pop)', frames: [[0, { o: 0, s: 0.55 }], [0.65, { o: 1, s: 1.08 }], [1, {}]] },
        { id: 'bounce', label: 'Rebond', frames: [[0, { o: 0, y: -45 }], [0.4, { o: 1, y: 0 }], [0.55, { y: -14 }], [0.7, { y: 0 }], [0.82, { y: -5 }], [1, {}]] },
        { id: 'slide-up', label: 'Glissement depuis le bas', frames: [[0, { o: 0, y: 60 }], [1, {}]] },
        { id: 'slide-down', label: 'Glissement depuis le haut', frames: [[0, { o: 0, y: -60 }], [1, {}]] },
        { id: 'slide-left', label: 'Glissement depuis la gauche', frames: [[0, { o: 0, x: -60 }], [1, {}]] },
        { id: 'slide-right', label: 'Glissement depuis la droite', frames: [[0, { o: 0, x: 60 }], [1, {}]] },
        { id: 'rotate', label: 'Rotation', frames: [[0, { o: 0, r: -180, s: 0.6 }], [1, {}]] },
        { id: 'flip', label: 'Flip 3D', frames: [[0, { o: 0, ry: -90 }], [0.5, { o: 1, ry: -40 }], [1, {}]] },
        { id: 'shake', label: 'Secousse', frames: [[0, { o: 0 }], [0.12, { o: 1 }], [0.24, { x: -6 }], [0.4, { x: 5 }], [0.56, { x: -4 }], [0.72, { x: 3 }], [0.86, { x: -1.5 }], [1, {}]] },
        { id: 'balloon', label: 'Ballon (gonflement + balancement)', frames: [[0, { o: 0, s: 0.1, y: 15 }], [0.45, { o: 1, s: 1.15, r: -6, y: -3 }], [0.6, { s: 0.95, r: 5 }], [0.75, { s: 1.05, r: -3 }], [0.9, { s: 0.99, r: 1.5 }], [1, {}]] },
        { id: 'blur', label: 'Étincelle / Flou', frames: [[0, { o: 0, b: 20, br: 2.2, s: 1.2 }], [0.6, { o: 1, b: 4, br: 1.3, s: 1.02 }], [1, {}]] },
        { id: 'elastic', label: 'Élastique', frames: [[0, { o: 0, sx: 0.3, sy: 1.6 }], [0.3, { o: 1, sx: 1.25, sy: 0.75 }], [0.5, { sx: 0.9, sy: 1.1 }], [0.7, { sx: 1.05, sy: 0.96 }], [0.85, { sx: 0.99, sy: 1.01 }], [1, {}]] },
        { id: 'whirl', label: 'Tourbillon (rotation + zoom)', frames: [[0, { o: 0, s: 0, r: -540 }], [0.5, { o: 1 }], [1, {}]] },
        { id: 'corner', label: 'Rétrécir vers un coin', corner: true, frames: [[0, { o: 0, s: 0.02, r: -20 }], [0.25, { o: 1, s: 0.3, r: -10 }], [1, {}]] },
    ];
    const ANIM_MAP = Object.fromEntries(ANIMS.map((a) => [a.id, a]));

    /* ---------------- état ---------------- */

    let hidden = false;          // masqué par l'utilisateur (y compris pendant l'animation de sortie)
    let hiddenKey = '';
    let lastKey = '';            // dernier sticker vu (pour animer un nouveau sticker une seule fois)
    let ctrl = null;             // animation en cours { kind, finish() }
    let restoreBtn = null;
    let hitbox = null;
    let holderObserver = null;
    let observedHolder = null;
    let down = null;
    let lastTap = null;
    let styleMoves = 0;
    let styleMovedAt = 0;
    const savedInline = new Map();

    /* ---------------- réglages ---------------- */

    function ctx() {
        try { return globalThis.SillyTavern?.getContext?.() ?? null; } catch { return null; }
    }

    function settings() {
        const c = ctx();
        if (!c || !c.extensionSettings) return { ...DEFAULTS };
        const s = c.extensionSettings[MODULE] ?? (c.extensionSettings[MODULE] = {});
        for (const k of Object.keys(DEFAULTS)) {
            if (s[k] === undefined) s[k] = DEFAULTS[k];
        }
        // Migration : en 1.0.1 « double » était la valeur par défaut ; le comportement d'origine est le simple toucher.
        if (s.settingsVersion !== SETTINGS_VERSION) {
            if (s.hideMode === 'double') s.hideMode = 'single';
            s.settingsVersion = SETTINGS_VERSION;
        }
        if (!['single', 'double', 'never'].includes(s.hideMode)) s.hideMode = DEFAULTS.hideMode;
        if (!ANIM_MAP[s.animIn]) s.animIn = DEFAULTS.animIn;
        if (!ANIM_MAP[s.animOut]) s.animOut = DEFAULTS.animOut;
        if (!(s.easing in EASINGS)) s.easing = DEFAULTS.easing;
        const d = Number(s.duration);
        s.duration = Number.isFinite(d) ? Math.min(2000, Math.max(100, Math.round(d))) : DEFAULTS.duration;
        return s;
    }

    function saveSettings() {
        try { ctx()?.saveSettingsDebounced?.(); } catch (e) { console.warn(LOG, e); }
    }

    /* ---------------- outils ---------------- */

    const getHolder = () => document.getElementById(HOLDER_ID);
    const getImage = () => document.getElementById('expression-image') || getHolder()?.querySelector(IMAGE_SELECTOR) || null;

    /** Identité d'un sticker : son URL sans le paramètre anti-cache ?t=... */
    function keyOf(img) {
        const src = img?.getAttribute?.('src') || '';
        return src.split('?')[0];
    }

    function holderDisplayed() {
        const h = getHolder();
        return !!h && getComputedStyle(h).display !== 'none';
    }

    /** Style inline !important, avec sauvegarde de la valeur d'origine pour pouvoir la restaurer exactement. */
    function setInline(el, prop, value) {
        const k = prop;
        if (!savedInline.has(k)) savedInline.set(k, [el.style.getPropertyValue(prop), el.style.getPropertyPriority(prop)]);
        el.style.setProperty(prop, value, 'important');
    }

    function saveInline(el, prop) {
        if (!savedInline.has(prop)) savedInline.set(prop, [el.style.getPropertyValue(prop), el.style.getPropertyPriority(prop)]);
    }

    function restoreInline(el, prop) {
        if (!savedInline.has(prop)) return;
        const [v, p] = savedInline.get(prop);
        savedInline.delete(prop);
        if (v) el.style.setProperty(prop, v, p); else el.style.removeProperty(prop);
    }

    const ANIM_PROPS = ['opacity', 'transform', 'filter', 'transform-origin', 'transition'];
    const HIDE_PROPS = ['visibility', 'pointer-events', 'opacity', 'transition'];

    /** Restaure des propriétés inline en neutralisant toute transition (éventuellement forcée par le CSS perso). */
    function restoreProps(h, props) {
        const other = props.filter((p) => p !== 'transition');
        if (props.includes('transition') || other.length) {
            const hadT = savedInline.has('transition');
            if (!hadT) saveInline(h, 'transition');
            h.style.setProperty('transition', 'none', 'important');
            other.forEach((p) => restoreInline(h, p));
            void h.offsetWidth; // applique les valeurs finales tout de suite, sans transition
            restoreInline(h, 'transition');
        }
    }

    function clearAnimInline() {
        const h = getHolder();
        if (!h) { savedInline.clear(); return; }
        restoreProps(h, ANIM_PROPS);
    }

    /* ---------------- moteur d'animation ---------------- */

    function bezier(x1, y1, x2, y2) {
        const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
        const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
        const X = (t) => ((ax * t + bx) * t + cx) * t;
        const Y = (t) => ((ay * t + by) * t + cy) * t;
        const dX = (t) => (3 * ax * t + 2 * bx) * t + cx;
        return (x) => {
            if (x <= 0) return 0;
            if (x >= 1) return 1;
            let t = x;
            for (let i = 0; i < 8; i++) {
                const d = X(t) - x;
                if (Math.abs(d) < 1e-5) return Y(t);
                const dd = dX(t);
                if (Math.abs(dd) < 1e-6) break;
                t -= d / dd;
            }
            let lo = 0, hi = 1;
            t = x;
            for (let i = 0; i < 40; i++) {
                const v = X(t);
                if (Math.abs(v - x) < 1e-5) break;
                if (x > v) lo = t; else hi = t;
                t = (hi - lo) / 2 + lo;
            }
            return Y(t);
        };
    }

    function easingFn(name) {
        const p = EASINGS[name];
        return p ? bezier(...p) : ((x) => x);
    }

    function buildFrames(def, kind) {
        let f = def.frames.map(([t, p]) => ({ t, ...REST, ...p }));
        if (kind === 'out') f = f.reverse().map((fr) => ({ ...fr, t: 1 - fr.t }));
        return f;
    }

    function sample(frames, p, ease) {
        if (p <= 0) return frames[0];
        if (p >= 1) return frames[frames.length - 1];
        let i = 0;
        while (i < frames.length - 2 && p > frames[i + 1].t) i++;
        const a = frames[i], b = frames[i + 1];
        const span = b.t - a.t || 1;
        const e = ease((p - a.t) / span);
        const out = {};
        for (const k of Object.keys(REST)) out[k] = a[k] + (b[k] - a[k]) * e;
        return out;
    }

    function applyFrame(holder, st, base) {
        const o = Math.min(1, Math.max(0, st.o)) * base.opacity;
        let tf = base.transform !== 'none' ? base.transform + ' ' : '';
        tf += `translate(${st.x.toFixed(3)}%, ${st.y.toFixed(3)}%)`;
        if (st.rx || st.ry) tf += ` perspective(800px) rotateX(${st.rx.toFixed(2)}deg) rotateY(${st.ry.toFixed(2)}deg)`;
        if (st.r) tf += ` rotate(${st.r.toFixed(2)}deg)`;
        tf += ` scale(${Math.max(0, st.s * st.sx).toFixed(4)}, ${Math.max(0, st.s * st.sy).toFixed(4)})`;
        let flt = base.filter !== 'none' ? base.filter : '';
        if (st.b > 0.01) flt += ` blur(${st.b.toFixed(2)}px)`;
        if (Math.abs(st.br - 1) > 0.01) flt += ` brightness(${st.br.toFixed(3)})`;
        holder.style.setProperty('opacity', o.toFixed(4), 'important');
        holder.style.setProperty('transform', tf, 'important');
        holder.style.setProperty('filter', flt.trim() || 'none', 'important');
    }

    /** Termine immédiatement l'animation en cours (état final garanti, jamais d'état bloqué à mi-chemin). */
    function finishCtrl() {
        const c = ctrl;
        if (c) c.finish();
    }

    /**
     * Joue une animation sur #expression-holder.
     * kind : 'in' | 'out'. onDone est appelé à la fin (ou à l'arrêt forcé). opts : { name, dur, hold, force }.
     */
    function run(kind, onDone, opts = {}) {
        const cfg = settings();
        const holder = getHolder();
        const name = opts.name || (kind === 'in' ? cfg.animIn : cfg.animOut);
        const def = ANIM_MAP[name];
        if (!holder || !def || !def.frames || (!cfg.animation && !opts.force) || !holderDisplayed() || document.hidden) {
            onDone?.();
            return null;
        }
        clearAnimInline(); // repart d'un état propre (lecture des valeurs de base du CSS de l'utilisateur)
        // mémorise les valeurs inline d'origine de ce que applyFrame va écrire (sinon elles ne seraient jamais retirées)
        ['opacity', 'transform', 'filter'].forEach((p) => saveInline(holder, p));
        const cs = getComputedStyle(holder);
        const base = {
            opacity: parseFloat(cs.opacity) || 1,
            transform: cs.transform || 'none',
            filter: cs.filter || 'none',
        };
        const frames = buildFrames(def, kind);
        const ease = easingFn(opts.easing || cfg.easing);
        const dur = opts.dur || cfg.duration;
        setInline(holder, 'transition', 'none');
        if (def.corner) {
            const r = holder.getBoundingClientRect();
            const right = r.left + r.width / 2 > innerWidth / 2;
            const bottom = r.top + r.height / 2 > innerHeight / 2;
            setInline(holder, 'transform-origin', `${right ? 'right' : 'left'} ${bottom ? 'bottom' : 'top'}`);
        }
        let raf = 0, timer = 0, done = false;
        const me = {
            kind,
            finish() {
                if (done) return;
                done = true;
                cancelAnimationFrame(raf);
                clearTimeout(timer);
                if (ctrl === me) ctrl = null;
                if (!opts.hold) clearAnimInline();
                onDone?.();
            },
        };
        ctrl = me;
        const t0 = performance.now();
        applyFrame(holder, sample(frames, 0, ease), base);
        const tick = (now) => {
            if (done) return;
            const p = (now - t0) / dur;
            if (p >= 1) { me.finish(); return; }
            applyFrame(holder, sample(frames, p, ease), base);
            raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        timer = setTimeout(() => me.finish(), dur + 150); // sécurité si rAF est suspendu (onglet en arrière-plan)
        return me;
    }

    /* ---------------- zone de toucher invisible ---------------- */

    function stickerRect() {
        const img = getImage();
        let r = img?.getBoundingClientRect();
        if (!r || r.width < 2 || r.height < 2) r = getHolder()?.getBoundingClientRect();
        return r && r.width >= 2 && r.height >= 2 ? r : null;
    }

    function effectiveZ(el) {
        let z = 0;
        for (let e = el; e && e !== document.documentElement; e = e.parentElement) {
            const v = parseInt(getComputedStyle(e).zIndex, 10);
            if (Number.isFinite(v)) z = Math.max(z, v);
        }
        return z;
    }

    function positionHitbox() {
        if (!hitbox) return;
        const r = stickerRect();
        if (!r) return; // on garde la dernière position connue
        const st = hitbox.style;
        st.setProperty('left', `${r.left}px`, 'important');
        st.setProperty('top', `${r.top}px`, 'important');
        st.setProperty('width', `${r.width}px`, 'important');
        st.setProperty('height', `${r.height}px`, 'important');
        // Juste au-dessus du niveau du sticker (donc jamais au-dessus des fenêtres/menus de SillyTavern)...
        const holder = getHolder();
        let z = Math.max(3, (holder ? effectiveZ(holder) : 0) + 1);
        // ...mais, si un élément de bas niveau recouvre quand même la zone, on passe au-dessus de lui.
        const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        if (top && top !== hitbox && !hitbox.contains(top)) {
            const tz = effectiveZ(top);
            if (tz < 1000) z = Math.max(z, tz + 1);
        }
        const cur = parseInt(st.zIndex, 10);
        st.setProperty('z-index', String(Math.max(z, Number.isFinite(cur) ? cur : 0)), 'important');
    }

    function ensureHitbox() {
        if (hitbox && document.body.contains(hitbox)) { positionHitbox(); return hitbox; }
        hitbox = document.createElement('div');
        hitbox.id = HITBOX_ID;
        hitbox.setAttribute('aria-label', 'Réafficher le sticker');
        const props = {
            'position': 'fixed', 'background': 'transparent', 'border': '0', 'margin': '0', 'padding': '0',
            'opacity': '1', 'pointer-events': 'auto', 'touch-action': 'manipulation', 'cursor': 'pointer',
            'transform': 'none', 'transition': 'none', 'user-select': 'none', '-webkit-user-select': 'none',
            '-webkit-tap-highlight-color': 'transparent', 'z-index': '3',
        };
        for (const [k, v] of Object.entries(props)) hitbox.style.setProperty(k, v, 'important');
        let d = null;
        hitbox.addEventListener('pointerdown', (e) => { d = { x: e.clientX, y: e.clientY, t: performance.now() }; }, { passive: true });
        hitbox.addEventListener('pointerup', (e) => {
            const s = d; d = null;
            if (!s || performance.now() - s.t > 1000 || Math.hypot(e.clientX - s.x, e.clientY - s.y) > TAP_MAX_MOVE * 2) return;
            e.preventDefault();
            showSticker();
        });
        hitbox.addEventListener('pointercancel', () => { d = null; }, { passive: true });
        // Le « click » fantôme qui suit un toucher ne doit rien déclencher (sinon le sticker réapparaîtrait aussitôt).
        hitbox.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); });
        document.body.appendChild(hitbox);
        positionHitbox();
        return hitbox;
    }

    function removeHitbox() {
        hitbox?.remove();
        hitbox = null;
    }

    /* ---------------- bouton 🖼 facultatif ---------------- */

    function placeRestore() {
        if (!restoreBtn) return;
        const r = stickerRect();
        const size = 36;
        let left = 8, top = Math.max(8, innerHeight - size - 90);
        if (r) {
            left = Math.min(Math.max(4, r.left + 4), innerWidth - size - 4);
            top = Math.min(Math.max(4, r.bottom - size - 4), innerHeight - size - 4);
        }
        restoreBtn.style.left = `${Math.round(left)}px`;
        restoreBtn.style.top = `${Math.round(top)}px`;
    }

    function ensureRestoreButton() {
        if (restoreBtn && document.body.contains(restoreBtn)) return restoreBtn;
        restoreBtn = document.createElement('button');
        restoreBtn.id = RESTORE_ID;
        restoreBtn.type = 'button';
        restoreBtn.textContent = '\u{1F5BC}';
        restoreBtn.title = 'Réafficher le sticker';
        restoreBtn.setAttribute('aria-label', 'Réafficher le sticker');
        restoreBtn.addEventListener('click', (e) => { e.preventDefault(); showSticker(); });
        document.body.appendChild(restoreBtn);
        return restoreBtn;
    }

    function syncRestoreButton() {
        const on = hidden && !ctrl && settings().showRestoreButton;
        if (on) { ensureRestoreButton(); placeRestore(); }
        restoreBtn?.classList.toggle('stickerpop-restore-on', !!on);
    }

    /* ---------------- masquer / réafficher ---------------- */

    /** État « masqué » définitif (après l'animation de sortie). */
    function applyHiddenState() {
        const holder = getHolder();
        if (!holder) return;
        clearAnimInline();
        HIDE_PROPS.forEach((p) => restoreInline(holder, p));
        setInline(holder, 'transition', 'none');
        setInline(holder, 'opacity', '0');
        setInline(holder, 'visibility', 'hidden');
        setInline(holder, 'pointer-events', 'none');
        holder.classList.add(CLS_HIDDEN);
        ensureHitbox(); // zone transparente exactement à l'emplacement et à la taille du sticker
        syncRestoreButton();
    }

    function clearHiddenState() {
        const holder = getHolder();
        if (holder) {
            holder.classList.remove(CLS_HIDDEN);
            restoreProps(holder, HIDE_PROPS);
        }
        removeHitbox();
    }

    function hideSticker() {
        finishCtrl();
        const holder = getHolder();
        const img = getImage();
        if (!holder || !img || hidden || !holderDisplayed()) return;
        hidden = true;
        hiddenKey = keyOf(img);
        run('out', applyHiddenState); // l'élément reste visible pendant l'animation, puis passe en « masqué »
    }

    function showSticker({ animate = true } = {}) {
        finishCtrl(); // si une sortie était en cours : elle se termine (état masqué), puis on réaffiche aussitôt
        if (!hidden) return;
        hidden = false;
        hiddenKey = '';
        clearHiddenState();
        syncRestoreButton();
        if (animate) run('in');
    }

    function toggleSticker() {
        if (hidden) showSticker(); else hideSticker();
    }

    /* ---------------- toucher sur le sticker ---------------- */

    function onPointerDown(e) {
        const holder = getHolder();
        if (!holder || !e.target?.closest?.(`#${HOLDER_ID}`)) { down = null; return; }
        // l'en-tête (poignée de déplacement) et la poignée de redimensionnement ne comptent jamais
        if (e.target.closest('#expression-holderheader, .drag-grabber')) { down = null; return; }
        if (!e.target.closest(IMAGE_SELECTOR)) { down = null; return; }
        const r = holder.getBoundingClientRect();
        down = { x: e.clientX, y: e.clientY, t: performance.now(), rx: r.left, ry: r.top, rw: r.width, rh: r.height };
    }

    function onPointerUp(e) {
        const d = down;
        down = null;
        if (!d) return;
        const cfg = settings();
        if (!cfg.enabled || cfg.hideMode === 'never') return;
        const holder = getHolder();
        if (!holder) return;
        const now = performance.now();
        if (now - d.t > TAP_MAX_MS) return;
        if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > TAP_MAX_MOVE) return;
        // le holder a bougé / changé de taille => glisser-déposer ou redimensionnement, pas un toucher
        // (pendant une animation le rectangle transformé change : on compare donc avec la mise en page, sans transformation)
        if (!ctrl) {
            const r = holder.getBoundingClientRect();
            if (Math.abs(r.left - d.rx) > 2 || Math.abs(r.top - d.ry) > 2 || Math.abs(r.width - d.rw) > 2 || Math.abs(r.height - d.rh) > 2) return;
        }
        if (cfg.hideMode === 'double' && !hidden) {
            if (lastTap && now - lastTap.t <= DOUBLE_TAP_MS && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) <= 40) {
                lastTap = null;
                toggleSticker();
            } else {
                lastTap = { t: now, x: e.clientX, y: e.clientY };
            }
            return;
        }
        toggleSticker();
    }

    /* ---------------- surveillance de #expression-holder ---------------- */

    function onHolderMutation(mutations) {
        let newImage = null;
        for (const m of mutations) {
            if (m.type === 'childList') {
                m.addedNodes.forEach((n) => {
                    if (n.nodeType === 1 && n.matches?.(IMAGE_SELECTOR)) newImage = n;
                });
            } else if (m.type === 'attributes' && m.attributeName === 'src' && m.target.matches?.(IMAGE_SELECTOR)) {
                if (m.target.getAttribute('src')) newImage = m.target;
            }
        }
        if (!newImage) return;
        newImage.classList.remove(CLS_HIDDEN); // un clone ne doit rien hériter d'un état précédent
        const k = keyOf(newImage);
        if (!k) return;
        const isNew = k !== lastKey;
        lastKey = k;
        // Nouveau sticker (autre image) : toujours l'afficher, sans hériter de l'état « masqué ».
        // Même image rechargée : l'état est conservé.
        let wasHidden = false;
        if (hidden && k !== hiddenKey) { showSticker({ animate: false }); wasHidden = true; }
        if (!hidden && isNew && settings().animNew && (wasHidden || !ctrl)) run('in');
        if (hidden) { positionHitbox(); syncRestoreButton(); }
    }

    function attachObserver() {
        const holder = getHolder();
        if (!holder || holder === observedHolder) return;
        holderObserver?.disconnect();
        observedHolder = holder;
        holderObserver = new MutationObserver(onHolderMutation);
        holderObserver.observe(holder, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] });
        if (hidden && !ctrl) applyHiddenState();
        const img = getImage();
        if (img) lastKey = keyOf(img);
    }

    /* ---------------- feuille de style (injectée en dernier, spécificité élevée) ---------------- */

    const INJECTED_CSS = `
html body #expression-holder.${CLS_HIDDEN} { opacity: 0 !important; visibility: hidden !important; pointer-events: none !important; transition: none !important; }
html body #expression-holder img.expression { -webkit-touch-callout: none; -webkit-user-select: none; user-select: none; touch-action: manipulation; }
html body #${RESTORE_ID} { display: none; position: fixed; width: 36px; height: 36px; padding: 0; border: 0; border-radius: 50%; font-size: 18px; line-height: 36px; text-align: center; background: rgba(40,40,40,.55); color: #fff; opacity: .75; z-index: 2147483000; touch-action: manipulation; cursor: pointer; }
html body #${RESTORE_ID}.stickerpop-restore-on { display: block !important; }
`;

    function ensureStyle() {
        let el = document.getElementById(STYLE_ID);
        if (!el) {
            el = document.createElement('style');
            el.id = STYLE_ID;
            el.textContent = INJECTED_CSS;
            document.head.appendChild(el);
            return;
        }
        // On reste le dernier <style>/<link> du <head> (limité, pour ne pas se battre avec d'autres extensions).
        if (document.head.lastElementChild !== el && styleMoves < 20 && Date.now() - styleMovedAt > 3000) {
            styleMoves++;
            styleMovedAt = Date.now();
            document.head.appendChild(el);
        }
    }

    /* ---------------- panneau de réglages ---------------- */

    function setStatus(text) {
        const $ = globalThis.jQuery;
        $?.('#stickerpop_test_status').text(text || '');
    }

    /** Aperçu en direct : joue l'animation sur le sticker actuellement affiché, sans changer son état. */
    function previewAnim(kind) {
        const cfg = settings();
        const name = kind === 'in' ? cfg.animIn : cfg.animOut;
        if (!ANIM_MAP[name].frames) { setStatus('Animation « Aucune » : rien à montrer.'); return; }
        const img = getImage();
        if (!holderDisplayed() || !img || !img.getAttribute('src')) { setStatus('Aucun sticker affiché : faites apparaître un sticker pour tester.'); return; }
        if (hidden) { setStatus('Le sticker est masqué : réaffichez-le (toucher) pour tester.'); return; }
        setStatus('');
        finishCtrl();
        if (kind === 'in') {
            run('in', null, { force: true });
            return;
        }
        run('out', () => {
            // on garde l'état « sorti » 450 ms, puis on ramène le sticker en fondu
            const holder = getHolder();
            let t = 0;
            const hold = {
                kind: 'hold',
                finish() {
                    clearTimeout(t);
                    if (ctrl === hold) ctrl = null;
                    clearAnimInline();
                },
            };
            ctrl = hold;
            t = setTimeout(() => {
                if (ctrl !== hold) return;
                ctrl = null;
                if (!holder || hidden) { clearAnimInline(); return; }
                run('in', null, { force: true, name: 'fade', dur: 250 });
            }, 450);
        }, { force: true, hold: true });
    }

    function mountSettings() {
        const $ = globalThis.jQuery;
        if (!$ || $('#stickerpop_settings').length) return;
        const host = $('#extensions_settings2').length ? $('#extensions_settings2') : $('#extensions_settings');
        if (!host.length) return;
        const opts = ANIMS.map((a) => `<option value="${a.id}">${a.label}</option>`).join('');
        const eopts = EASING_LABELS.map(([v, l]) => `<option value="${v}">${l}</option>`).join('');
        host.append(`
<div id="stickerpop_settings" class="extension_container">
  <div class="inline-drawer">
    <div class="inline-drawer-toggle inline-drawer-header">
      <b>StickerPop</b>
      <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
    </div>
    <div class="inline-drawer-content">
      <label class="checkbox_label"><input type="checkbox" id="stickerpop_enabled"><span>Activer le masquage au toucher</span></label>
      <div class="flex-container alignItemsCenter" style="gap:8px;margin:6px 0">
        <label for="stickerpop_hideMode">Masquer / réafficher avec</label>
        <select id="stickerpop_hideMode" class="text_pole" style="width:auto">
          <option value="single">un simple toucher (défaut)</option>
          <option value="double">un double toucher</option>
          <option value="never">jamais : permanent, toujours affiché</option>
        </select>
      </div>
      <label class="checkbox_label"><input type="checkbox" id="stickerpop_showRestoreButton"><span>Afficher aussi un petit bouton 🖼 pour réafficher</span></label>
      <hr>
      <label class="checkbox_label"><input type="checkbox" id="stickerpop_animation"><span>Activer les animations</span></label>
      <label class="checkbox_label"><input type="checkbox" id="stickerpop_animNew"><span>Animer aussi l'arrivée d'un nouveau sticker</span></label>
      <div class="flex-container alignItemsCenter" style="gap:8px;margin:6px 0">
        <label for="stickerpop_animIn">Animation d'apparition</label>
        <select id="stickerpop_animIn" class="text_pole" style="width:auto">${opts}</select>
        <button type="button" id="stickerpop_test_in" class="menu_button">Tester</button>
      </div>
      <div class="flex-container alignItemsCenter" style="gap:8px;margin:6px 0">
        <label for="stickerpop_animOut">Animation de disparition</label>
        <select id="stickerpop_animOut" class="text_pole" style="width:auto">${opts}</select>
        <button type="button" id="stickerpop_test_out" class="menu_button">Tester</button>
      </div>
      <div class="flex-container alignItemsCenter" style="gap:8px;margin:6px 0">
        <label for="stickerpop_duration">Durée : <span id="stickerpop_duration_val"></span> ms</label>
        <input type="range" id="stickerpop_duration" min="100" max="2000" step="50" style="flex:1;min-width:120px">
      </div>
      <div class="flex-container alignItemsCenter" style="gap:8px;margin:6px 0">
        <label for="stickerpop_easing">Courbe d'animation</label>
        <select id="stickerpop_easing" class="text_pole" style="width:auto">${eopts}</select>
      </div>
      <small id="stickerpop_test_status"></small><br>
      <small>Un toucher sur le sticker le fait disparaître ; un toucher à l'endroit où il se trouvait le fait réapparaître. Un nouveau sticker est toujours affiché.</small>
    </div>
  </div>
</div>`);
        const s = settings();
        const bindCheck = (id, key, after) => $(`#stickerpop_${id}`).prop('checked', !!s[key]).on('change', function () {
            settings()[key] = this.checked;
            after?.(this.checked);
            saveSettings();
        });
        const bindSelect = (id, key, after) => $(`#stickerpop_${id}`).val(s[key]).on('change', function () {
            settings()[key] = this.value;
            after?.(this.value);
            saveSettings();
        });
        bindCheck('enabled', 'enabled', (on) => { if (!on) showSticker({ animate: false }); });
        bindSelect('hideMode', 'hideMode', (v) => { if (v === 'never') showSticker({ animate: false }); });
        bindCheck('showRestoreButton', 'showRestoreButton', () => syncRestoreButton());
        bindCheck('animation', 'animation');
        bindCheck('animNew', 'animNew');
        bindSelect('animIn', 'animIn');
        bindSelect('animOut', 'animOut');
        bindSelect('easing', 'easing');
        $('#stickerpop_duration').val(s.duration);
        $('#stickerpop_duration_val').text(s.duration);
        $('#stickerpop_duration').on('input change', function () {
            const v = Math.min(2000, Math.max(100, Number(this.value) || DEFAULTS.duration));
            settings().duration = v;
            $('#stickerpop_duration_val').text(v);
            saveSettings();
        });
        $('#stickerpop_test_in').on('click', () => previewAnim('in'));
        $('#stickerpop_test_out').on('click', () => previewAnim('out'));
    }

    /* ---------------- initialisation ---------------- */

    function tick() {
        ensureStyle();
        attachObserver();
        mountSettings();
        if (hidden && !ctrl) {
            const h = getHolder();
            if (h && !h.classList.contains(CLS_HIDDEN)) applyHiddenState(); // quelqu'un a retiré notre état : on le rétablit
            positionHitbox();
            syncRestoreButton();
        }
    }

    function start() {
        if (!document.body) return;
        settings();
        ensureStyle();
        document.addEventListener('pointerdown', onPointerDown, { capture: true, passive: true });
        document.addEventListener('pointerup', onPointerUp, { capture: true, passive: true });
        document.addEventListener('pointercancel', () => { down = null; }, { capture: true, passive: true });
        const relayout = () => { if (hidden && !ctrl) { positionHitbox(); syncRestoreButton(); } };
        window.addEventListener('resize', relayout);
        window.addEventListener('orientationchange', relayout);
        document.addEventListener('visibilitychange', () => { if (document.hidden) finishCtrl(); });

        attachObserver();
        // #expression-holder est créé par l'extension Expressions, éventuellement après nous ; il peut être recréé.
        setInterval(tick, 1000);
        mountSettings();

        try {
            const c = ctx();
            c?.eventSource?.on?.(c.eventTypes?.CHAT_CHANGED ?? 'chat_id_changed', () => showSticker({ animate: false }));
        } catch (e) { console.warn(LOG, e); }
        console.debug(LOG, 'prêt v1.1.0');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start, { once: true });
    } else {
        start();
    }
})();
