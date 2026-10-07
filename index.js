/**
 * StickerPop - extension SillyTavern
 * Affiche le sprite des « Character Expressions » (#expression-holder / #expression-image) comme un sticker.
 *
 * v1.2.3 (performance : plus aucun travail pendant la frappe)
 *  - Plus de setInterval 1 s + 500 ms permanents : tout est piloté par les événements ; un contrôle de sécurité léger toutes les 2 s,
 *    en pause en arrière-plan, sans aucune lecture de mise en page. Les mesures (zone de toucher, champs du panneau, <style> en dernier)
 *    attendent que l'on ne soit pas en train d'écrire (simple lecture de document.activeElement) et passent par requestIdleCallback si dispo.
 *  - Plus de getClientRects() chaque seconde pour savoir si le panneau est ouvert : IntersectionObserver.
 *  - Observateur du chat réduit aux enfants directs de #chat (plus de subtree) et seulement pour de vrais .mes ; les compteurs de swipes
 *    sont observés un par un. Le chat n'est reparcouru que si sa signature change (nombre de messages / swipes du dernier).
 *  - getContext() (gros objet recréé à chaque appel) mis en cache pour la tâche en cours : 1 appel au lieu de ~30 par passage.
 *  - Écouteurs touchmove / pointermove non passifs, gesture* et keydown sur tout le document posés UNIQUEMENT pendant le mode « Déplacer ».
 *  - L'observateur du holder ignore nos propres écritures (classe / styles d'animation image par image) ; resize regroupé par image (rAF).
 *  - Aucun changement de réglage ni de comportement visible.
 *
 * v1.2.2 (correctif « les stickers n'apparaissent plus »)
 *  - Le masquage du cadre vide (v1.2.1) est désormais PUREMENT COSMÉTIQUE : plus aucun display:none / taille 0 ; le holder reste dans la mise
 *    en page (visibility:hidden, bordure / fond / ombre retirés) et l'image continue de se charger normalement.
 *  - Le cadre n'est considéré « vide » que si l'image n'a PAS de src, ou si son chargement a réellement échoué (error / chargée avec
 *    naturalWidth = 0). Une image en cours de chargement ou chargée n'est JAMAIS masquée.
 *  - Sécurité : si une image du holder a un src valide et naturalWidth > 0, le holder est forcé visible. Réévaluation sur load / error /
 *    changement de src ou d'attribut / CHAT_CHANGED / MESSAGE_RECEIVED / rendu des messages / retour au premier plan, avec un contrôle
 *    périodique (500 ms ; 2 s depuis v1.2.3). Chaque étape est protégée (try/catch) : une erreur ne laisse jamais le cadre masqué (échec = visible).
 *  - Nouveau réglage « Désactiver le masquage automatique » (mode sécurité) : coupe le masquage du cadre vide ET du compteur de swipes.
 *
 * v1.2.1
 *  - CADRE VIDE MASQUÉ : quand aucun sticker n'est affiché (pas de src, image en échec, personnage sans sprite), #expression-holder est
 *    masqué en entier (display:none + bordure / fond / ombre / contour retirés + non interactif) et réapparaît tout seul dès qu'une image
 *    est chargée. Réglage « Masquer le cadre quand il n'y a pas de sticker » (activé par défaut). Fonctionne en mode thème comme en
 *    position personnalisée ; la zone de toucher pour réafficher un sticker masqué continue de fonctionner.
 *  - COMPTEUR DE SWIPES : le bloc « > 1/1 » en bas à droite du dernier message (.swipeRightBlock : flèche .swipe_right + .swipes-counter)
 *    appartient à SillyTavern, pas aux Expressions. Deux options : le masquer quand il n'y a qu'un seul swipe (activé par défaut ; reste visible
 *    dès qu'il y a 2 swipes ou plus) et le masquer toujours (désactivé par défaut).
 *
 * v1.2.0
 *  - POSITION ET TAILLE LIBRES : le sticker peut être placé n'importe où sur l'écran et redimensionné (curseurs Horizontal / Vertical
 *    en % avec champs px, positions prédéfinies, mode « Déplacer » par glisser-déposer + pincement à deux doigts + poignée,
 *    taille en % de la largeur de l'écran, hauteur max, rotation, miroir, opacité, calque devant / derrière le chat,
 *    mémorisation par personnage facultative, bouton Réinitialiser).
 *    En position personnalisée, #expression-holder est déplacé directement dans <body> (hors de tout ancêtre transformé :
 *    un wrapper avec transform ne décale plus le sticker) et placé en position:fixed !important en % de l'écran (zone de sécurité iOS comprise).
 *    Position personnalisée désactivée (défaut) = comportement 1.1.0 strictement identique.
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
    const CLS_EMPTY = 'stickerpop-empty';              // holder sans image affichable
    const CLS_NOBOX = 'stickerpop-nobox';              // #expression-wrapper : plus aucun cadre / fond quand le sticker est absent ou masqué
    const CLS_SW1 = 'stickerpop-hide-swipe1';          // <body> : masquer le compteur quand il n'y a qu'un swipe
    const CLS_SWALL = 'stickerpop-hide-swipe-all';     // <body> : masquer toujours le compteur et les flèches
    const CLS_MULTI = 'stickerpop-swipes-multi';       // .mes : le message a 2 swipes ou plus (le compteur reste visible)
    const TAP_MAX_MS = 500;     // durée max d'un toucher
    const TAP_MAX_MOVE = 10;    // déplacement max (px) d'un toucher
    const DOUBLE_TAP_MS = 400;  // délai max entre 2 touchers (mode « double toucher » facultatif)
    const SETTINGS_VERSION = 3;
    const SIZE_MIN = 5;         // % de la largeur de l'écran
    const SIZE_PX_MIN = 40;
    const SIZE_PX_MAX = 1200;

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
        // --- v1.2.0 : position / taille personnalisées (désactivées par défaut = comportement 1.1.0) ---
        placeEnabled: false,
        placed: false,           // true une fois la position initialisée à partir de l'emplacement réel du sticker
        posX: 100,               // 0-100 % : 0 = bord gauche, 100 = bord droit (le sticker reste entièrement visible)
        posY: 100,               // 0-100 % : 0 = haut, 100 = bas
        sizePct: 30,             // largeur en % de la largeur de l'écran (5-100), 40-1200 px
        maxHeightPct: 90,        // garde-fou : hauteur max en % de la hauteur de l'écran (20-100)
        rotation: 0,             // -180..180 °
        flipH: false,
        flipV: false,
        opacity: 100,            // 10-100 %
        layer: 'front',          // 'front' (devant le chat) | 'back' (derrière)
        showHandle: true,        // poignée de redimensionnement en mode Déplacer
        perCharacter: false,     // mémoriser position / taille par personnage (sinon global)
        // --- v1.2.1 ---
        hideEmptyFrame: true,    // masquer entièrement le cadre quand il n'y a pas de sticker
        hideSwipe1: true,        // masquer le compteur « 1/1 » et la flèche quand le message n'a qu'un seul swipe
        hideSwipeAlways: false,  // masquer toujours le compteur de swipes et les flèches
        // --- v1.2.2 ---
        disableAutoHide: false,  // mode sécurité : aucun masquage automatique (cadre vide + compteur de swipes)
        settingsVersion: SETTINGS_VERSION,
    });
    // réglages remis à zéro par « Réinitialiser » (perCharacter et showHandle sont des préférences et restent)
    const RESET_KEYS = ['placeEnabled', 'placed', 'posX', 'posY', 'sizePct', 'maxHeightPct', 'rotation', 'flipH', 'flipV', 'opacity', 'layer'];

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
    let pendingIn = false;       // un nouveau sticker est en cours de chargement alors que le cadre est vide : animer son arrivée une fois chargé
    const failedSrc = new WeakMap(); // image -> { src, at } du dernier événement « error »
    /** Exécute fn sans jamais laisser une exception se propager (une erreur ne doit pas casser le suivi du holder). */
    function safe(fn) { try { return fn(); } catch (e) { console.warn(LOG, e); } }
    let chatObserver = null;
    let observedChat = null;
    let swipeRaf = 0;

    /* ---------------- réglages ---------------- */

    // getContext() construit à chaque appel un gros objet (~200 propriétés) : on le garde pour la tâche en cours (vidé à la microtâche suivante)
    let ctxCache = null;
    function ctx() {
        if (ctxCache) return ctxCache;
        let c = null;
        try { c = globalThis.SillyTavern?.getContext?.() ?? null; } catch { c = null; }
        if (c) { ctxCache = c; queueMicrotask(() => { ctxCache = null; }); }
        return c;
    }

    /** Valide / borne tous les réglages (migration sûre : toute valeur absente ou invalide revient à sa valeur par défaut). */
    function sanitize(s) {
        if (!['single', 'double', 'never'].includes(s.hideMode)) s.hideMode = DEFAULTS.hideMode;
        if (!ANIM_MAP[s.animIn]) s.animIn = DEFAULTS.animIn;
        if (!ANIM_MAP[s.animOut]) s.animOut = DEFAULTS.animOut;
        if (!(s.easing in EASINGS)) s.easing = DEFAULTS.easing;
        const d = Number(s.duration);
        s.duration = Number.isFinite(d) ? Math.min(2000, Math.max(100, Math.round(d))) : DEFAULTS.duration;
        const n = (k, a, b) => { s[k] = Math.min(b, Math.max(a, numOr(s[k], DEFAULTS[k]))); };
        n('posX', 0, 100); n('posY', 0, 100); n('sizePct', SIZE_MIN, 100); n('maxHeightPct', 20, 100);
        n('rotation', -180, 180); n('opacity', 10, 100);
        ['placeEnabled', 'placed', 'flipH', 'flipV', 'showHandle', 'perCharacter', 'hideEmptyFrame', 'hideSwipe1', 'hideSwipeAlways', 'disableAutoHide'].forEach((k) => { s[k] = !!s[k]; });
        if (s.layer !== 'back') s.layer = 'front';
        if (!s.positions || typeof s.positions !== 'object' || Array.isArray(s.positions)) s.positions = {};
        return s;
    }

    function settings() {
        const c = ctx();
        if (!c || !c.extensionSettings) return sanitize({ ...DEFAULTS });
        const s = c.extensionSettings[MODULE] ?? (c.extensionSettings[MODULE] = {});
        for (const k of Object.keys(DEFAULTS)) {
            if (s[k] === undefined) s[k] = DEFAULTS[k];
        }
        // Migration : en 1.0.1 « double » était la valeur par défaut ; le comportement d'origine est le simple toucher.
        if (s.settingsVersion !== SETTINGS_VERSION) {
            if (s.hideMode === 'double' && !(Number(s.settingsVersion) >= 2)) s.hideMode = 'single';
            s.settingsVersion = SETTINGS_VERSION;
        }
        return sanitize(s);
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

    const SVG_RE = /\.svg(\?|#|$)|^data:image\/svg/i;

    /** L'image est-elle chargée ET affichable (src valide, naturalWidth > 0) ? C'est le critère du « failsafe » : visible quoi qu'il arrive. */
    function imgLoaded(im) {
        const src = im.getAttribute('src');
        if (!src) return false;
        return im.complete && (im.naturalWidth > 0 || (SVG_RE.test(src) && im.complete));
    }

    /** L'image est-elle DÉFINITIVEMENT inutilisable ? (pas de src, erreur de chargement sur ce src, ou chargée avec naturalWidth = 0) */
    function imgBroken(im) {
        const src = im.getAttribute('src');
        if (!src) return true;
        if (imgLoaded(im)) return false;
        if (im.complete && im.naturalWidth === 0 && !SVG_RE.test(src)) return true; // chargement terminé sans image
        return false; // en cours de chargement (ou inconnu) : jamais considérée comme cassée
    }

    /** Une image du holder existe-t-elle ou est-elle en cours de chargement ? (= pas de cadre vide) */
    function hasSticker(h = getHolder()) {
        return !!h && Array.from(h.querySelectorAll(IMAGE_SELECTOR)).some((im) => !imgBroken(im));
    }

    function hasLoadedSticker(h = getHolder()) {
        return !!h && Array.from(h.querySelectorAll(IMAGE_SELECTOR)).some(imgLoaded);
    }

    const holderEmpty = () => !!getHolder()?.classList.contains(CLS_EMPTY);

    /**
     * Cadre vide : purement cosmétique. Le holder reste dans la page (aucun display:none) ; sans image il perd bordure / fond / ombre et
     * devient invisible et non interactif. Il revient tout seul dès qu'une image existe ou se charge.
     * Échec = visible : toute erreur ou le mode sécurité retire la classe.
     */
    function syncEmpty() {
        const h = getHolder();
        if (!h) return;
        let empty = false;
        try {
            empty = !settings().disableAutoHide && !!settings().hideEmptyFrame && !hasSticker(h);
            if (hasLoadedSticker(h)) empty = false; // failsafe : image valide chargée => holder forcé visible
        } catch (e) { empty = false; console.warn(LOG, e); }
        const was = h.classList.contains(CLS_EMPTY);
        if (empty !== was) {
            h.classList.toggle(CLS_EMPTY, empty);
            try {
                if (!empty) {
                    const animate = pendingIn && !hidden && settings().animNew;
                    pendingIn = false;
                    if (settings().placeEnabled) { applyPlacement(); scheduleUiSync(); } // nouveau ratio : on recalcule la taille et la position
                    if (hidden && !ctrl) { ensureHitbox(); } // sticker masqué par l'utilisateur : la zone de toucher revient avec lui
                    if (animate) run('in');
                } else if (hidden && !ctrl) {
                    removeHitbox(); // plus de sticker : rien à réafficher, aucune zone invisible ne doit intercepter les touchers
                }
                syncRestoreButton();
            } catch (e) { console.warn(LOG, e); }
        }
        syncNoBox();
    }

    /** #expression-wrapper n'affiche jamais de cadre / fond quand il n'y a rien à montrer (sticker absent ou masqué par l'utilisateur). */
    function syncNoBox() {
        const w = document.getElementById('expression-wrapper');
        const h = getHolder();
        if (!w) return;
        const on = !!h && (h.classList.contains(CLS_EMPTY) || h.classList.contains(CLS_HIDDEN));
        if (w.classList.contains(CLS_NOBOX) !== on) w.classList.toggle(CLS_NOBOX, on);
    }

    /** Nombre de swipes d'un message (<= 1 : un seul). */
    function swipeCountOf(mes, chat = ctx()?.chat) {
        const id = Number(mes.getAttribute('mesid'));
        const msg = Number.isInteger(id) ? chat?.[id] : null;
        if (msg) return Array.isArray(msg.swipes) ? msg.swipes.length : 1;
        const m = (mes.querySelector('.swipes-counter')?.textContent || '').match(/(\d+)\D+(\d+)/);
        return m ? Number(m[2]) : 1;
    }

    /** Marque les messages à 2 swipes ou plus (le compteur reste alors visible) et pose les classes d'options sur <body>. */
    function syncSwipes() {
        const b = document.body;
        if (!b) return;
        const s = settings();
        const sw1 = !!s.hideSwipe1 && !s.disableAutoHide;
        const swAll = !!s.hideSwipeAlways && !s.disableAutoHide;
        if (b.classList.contains(CLS_SW1) !== sw1) b.classList.toggle(CLS_SW1, sw1);
        if (b.classList.contains(CLS_SWALL) !== swAll) b.classList.toggle(CLS_SWALL, swAll);
        const chatEl = document.getElementById('chat');
        if (!chatEl) return;
        const chat = ctx()?.chat;
        swipeSig = swipeSignature(chatEl, chat);
        // aucune option active et aucune classe à retirer : rien à parcourir
        if (!sw1 && !chatEl.querySelector(`.${CLS_MULTI}`)) return;
        chatEl.querySelectorAll('.mes').forEach((m) => {
            watchCounter(m);
            const multi = sw1 && swipeCountOf(m, chat) > 1;
            if (m.classList.contains(CLS_MULTI) !== multi) m.classList.toggle(CLS_MULTI, multi);
        });
    }

    /** Regroupe les demandes : un seul passage, ~120 ms après la dernière (jamais pendant une rafale de mutations). */
    function scheduleSwipeSync() {
        if (swipeRaf) return;
        swipeRaf = setTimeout(() => { swipeRaf = 0; safe(syncSwipes); }, 120);
    }

    let swipeSig = '';
    /** Signature bon marché de l'état du chat (nombre de messages + swipes du dernier) : le filet de sécurité ne reparcourt le chat que si elle change. */
    function swipeSignature(chatEl, chat) {
        const last = chat?.[chat.length - 1];
        return `${chat?.length ?? -1}|${chatEl.childElementCount}|${Array.isArray(last?.swipes) ? last.swipes.length : 1}`;
    }

    // Compteurs de swipes (« 1/2 ») : observés UN PAR UN (minuscules sous-arbres) au lieu de tout #chat en subtree.
    // /addswipe, /delswipe… changent le compteur sans toujours émettre d'événement.
    let counterObserver = null;
    const watchedCounters = new WeakSet();
    function watchCounter(mes) {
        const c = mes.querySelector('.swipes-counter');
        if (!c || watchedCounters.has(c)) return;
        counterObserver ??= new MutationObserver(scheduleSwipeSync);
        counterObserver.observe(c, { childList: true, characterData: true, subtree: true });
        watchedCounters.add(c);
    }

    const isMes = (n) => n.nodeType === 1 && n.classList.contains('mes');

    function ensureChatObserver() {
        const chat = document.getElementById('chat');
        if (!chat || chat === observedChat) return;
        chatObserver?.disconnect();
        observedChat = chat;
        chatObserver = new MutationObserver((muts) => {
            // v1.2.3 : enfants DIRECTS de #chat seulement (pas de subtree : ni le streaming, ni les indicateurs de saisie, ni le texte),
            // et uniquement si un vrai message (.mes) a été ajouté / retiré. Le nombre de swipes est suivi par les événements de ST.
            for (const m of muts) {
                for (const n of m.addedNodes) if (isMes(n)) { scheduleSwipeSync(); return; }
                for (const n of m.removedNodes) if (isMes(n)) { scheduleSwipeSync(); return; }
            }
        });
        chatObserver.observe(chat, { childList: true });
        scheduleSwipeSync();
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
        const on = hidden && !ctrl && settings().showRestoreButton && !holderEmpty();
        if (on) { ensureRestoreButton(); placeRestore(); }
        restoreBtn?.classList.toggle('stickerpop-restore-on', !!on);
    }

    /* ---------------- position et taille personnalisées (v1.2.0) ---------------- */

    const CLS_CUSTOM = 'stickerpop-custom';
    const CLS_VNOFF = 'stickerpop-vn-off';
    const CLS_MOVING = 'stickerpop-moving';
    const CLS_GHOST = 'stickerpop-ghost';
    const MOVE_ID = 'stickerpop-move';
    const HANDLE_ID = 'stickerpop-handle';
    const BAR_ID = 'stickerpop-bar';
    const SAFE_ID = 'stickerpop-safe';
    const Z_FRONT = 1500;       // devant le chat (#sheld = 30), toujours sous les tiroirs / fenêtres de SillyTavern (≥ 2000)
    const Z_BACK = 2;           // derrière le chat (valeur d'origine de SillyTavern pour le sprite)
    const DRAG_THRESHOLD = 3;   // px avant qu'un doigt posé en mode Déplacer devienne un glissement
    const HANDLE_SIZE = 30;
    const PLACE_PROPS = ['position', 'left', 'top', 'right', 'bottom', 'width', 'height', 'min-width', 'min-height', 'max-width', 'max-height', 'margin', 'z-index'];

    let lastGeom = null;         // géométrie appliquée en dernier (px)
    let lastAr = 0;              // dernier rapport hauteur/largeur connu du sprite
    let origin = null;           // { parent, next, inline } : emplacement d'origine du holder dans le DOM
    let safeProbe = null;
    let styleObserver = null;
    let observedStyleHolder = null;
    let moving = false;          // mode « Déplacer » actif
    let mvEls = null;            // { overlay, handle, bar }
    const ptrs = new Map();      // pointeurs actifs en mode Déplacer
    let gesture = null;
    let uiRaf = 0;
    let lastViewW = 0;

    const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
    const numOr = (v, d) => ((v === null || v === '' || v === undefined || !Number.isFinite(Number(v))) ? d : Number(v));
    const pxs = (v) => `${+v.toFixed(3)}px`;

    /** Clé du sticker / personnage courant (dossier de sprites d'Expressions, sinon avatar du personnage). */
    function activeKey() {
        const img = getImage();
        const f = img?.getAttribute?.('data-sprite-folder-name');
        if (f) return String(f);
        const c = ctx();
        const ch = c?.characters?.[c.characterId];
        return String(ch?.avatar || ch?.name || '_');
    }

    function getLayout(s = settings()) {
        const e = s.perCharacter ? s.positions[activeKey()] : null;
        const src = e && typeof e === 'object' ? e : s;
        return {
            posX: clamp(numOr(src.posX, s.posX), 0, 100),
            posY: clamp(numOr(src.posY, s.posY), 0, 100),
            sizePct: clamp(numOr(src.sizePct, s.sizePct), SIZE_MIN, 100),
        };
    }

    function setLayout(patch) {
        const s = settings();
        if (s.perCharacter) s.positions[activeKey()] = { ...getLayout(s), ...patch };
        else Object.assign(s, patch);
    }

    function viewport() {
        const de = document.documentElement;
        return { w: de.clientWidth || innerWidth, h: de.clientHeight || innerHeight };
    }

    /** Zones de sécurité (encoche, barre d'accueil) via env(safe-area-inset-*). */
    function insets() {
        try {
            if (!safeProbe || !safeProbe.isConnected) {
                safeProbe = document.createElement('div');
                safeProbe.id = SAFE_ID;
                safeProbe.setAttribute('aria-hidden', 'true');
                safeProbe.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;'
                    + 'padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px);';
                document.body.appendChild(safeProbe);
            }
            const cs = getComputedStyle(safeProbe);
            return { t: parseFloat(cs.paddingTop) || 0, r: parseFloat(cs.paddingRight) || 0, b: parseFloat(cs.paddingBottom) || 0, l: parseFloat(cs.paddingLeft) || 0 };
        } catch { return { t: 0, r: 0, b: 0, l: 0 }; }
    }

    /** Rapport hauteur/largeur du sprite courant (le dernier <img> chargé de #expression-holder). */
    function aspect() {
        const imgs = getHolder()?.querySelectorAll(IMAGE_SELECTOR);
        if (!imgs) return 0;
        for (let i = imgs.length - 1; i >= 0; i--) {
            const im = imgs[i];
            if (im.naturalWidth > 0 && im.naturalHeight > 0) return im.naturalHeight / im.naturalWidth;
        }
        return 0;
    }

    /**
     * Géométrie du sticker. Position : 0 % = collé au bord gauche/haut (zone de sécurité comprise), 100 % = collé au bord
     * droit/bas ; le sticker ne peut donc jamais sortir de l'écran. Taille : % de la largeur de l'écran (40-1200 px), ratio conservé,
     * hauteur limitée à maxHeightPct % de l'écran.
     */
    function computeGeom(s = settings()) {
        const { w: vw, h: vh } = viewport();
        const ins = insets();
        const L = getLayout(s);
        const ar = aspect() || lastAr || 1;
        const availW = Math.max(1, vw - ins.l - ins.r);
        const availH = Math.max(1, vh - ins.t - ins.b);
        let w = Math.min(clamp((L.sizePct / 100) * vw, SIZE_PX_MIN, SIZE_PX_MAX), availW);
        const maxH = Math.min(availH, (s.maxHeightPct / 100) * vh);
        let h = w * ar;
        if (h > maxH) { h = maxH; w = h / ar; }
        const minL = ins.l, maxL = Math.max(minL, vw - ins.r - w);
        const minT = ins.t, maxT = Math.max(minT, vh - ins.b - h);
        return {
            vw, vh, ins, ar, w, h, minL, maxL, minT, maxT,
            left: minL + (L.posX / 100) * (maxL - minL),
            top: minT + (L.posY / 100) * (maxT - minT),
            posX: L.posX, posY: L.posY, sizePct: L.sizePct,
        };
    }

    const pctFromPx = (v, min, max) => (max - min > 0.01 ? clamp(((v - min) / (max - min)) * 100, 0, 100) : 0);

    function wrapperHidden() {
        const w = document.getElementById('expression-wrapper');
        return !!w && getComputedStyle(w).display === 'none'; // mode « Visual Novel » : le wrapper est masqué, le holder d'origine aussi
    }

    function adopt(holder) {
        if (holder.parentElement === document.body) return;
        if (!origin || origin.holder !== holder) {
            const inline = {};
            PLACE_PROPS.forEach((p) => { inline[p] = [holder.style.getPropertyValue(p), holder.style.getPropertyPriority(p)]; });
            origin = { holder, parent: holder.parentElement, next: holder.nextSibling, inline };
        }
        document.body.appendChild(holder); // hors de tout ancêtre transformé : position:fixed redevient relative à l'écran
    }

    function releasePlacement(holder = getHolder()) {
        lastGeom = null;
        if (!holder) { origin = null; return; }
        holder.classList.remove(CLS_CUSTOM, CLS_VNOFF);
        ['--spop-opacity', '--spop-img-tf'].forEach((p) => holder.style.removeProperty(p));
        if (origin && origin.holder === holder) {
            PLACE_PROPS.forEach((p) => {
                const [v, pr] = origin.inline[p] || ['', ''];
                if (v) holder.style.setProperty(p, v, pr); else holder.style.removeProperty(p);
            });
            if (holder.parentElement === document.body && origin.parent?.isConnected && origin.parent !== document.body) {
                const next = origin.next && origin.next.parentNode === origin.parent ? origin.next : null;
                origin.parent.insertBefore(holder, next);
            }
        } else {
            PLACE_PROPS.forEach((p) => holder.style.removeProperty(p));
        }
        origin = null;
        if (hidden && !ctrl) positionHitbox();
    }

    function placementIntact(holder) {
        const g = lastGeom;
        if (!g) return false;
        const st = holder.style;
        const imp = (p) => st.getPropertyPriority(p) === 'important';
        for (const [p, want] of [['left', g.left], ['top', g.top], ['width', g.w], ['height', g.h]]) {
            if (!imp(p) || Math.abs(parseFloat(st.getPropertyValue(p)) - want) > 0.05) return false;
        }
        if (!imp('position') || st.getPropertyValue('position') !== 'fixed' || !imp('min-width') || !imp('min-height')) return false;
        return holder.classList.contains(CLS_CUSTOM) && holder.parentElement === document.body;
    }

    /** Applique (ou retire) la position / taille personnalisées sur #expression-holder. */
    function applyPlacement() {
        const holder = getHolder();
        if (!holder) return;
        const s = settings();
        if (!s.placeEnabled) {
            if (holder.classList.contains(CLS_CUSTOM) || origin) releasePlacement(holder);
            syncMoveUI();
            return;
        }
        adopt(holder);
        const g = computeGeom(s);
        const ar = aspect();
        if (ar) lastAr = ar;
        lastGeom = g;
        const st = holder.style;
        const set = (p, v) => st.setProperty(p, v, 'important');
        set('position', 'fixed');
        set('left', pxs(g.left));
        set('top', pxs(g.top));
        set('right', 'auto');
        set('bottom', 'auto');
        set('width', pxs(g.w));
        set('height', pxs(g.h));
        set('min-width', '0');
        set('min-height', '0');
        set('max-width', 'none');
        set('max-height', 'none');
        set('margin', '0');
        set('z-index', String(s.layer === 'back' ? Z_BACK : Z_FRONT));
        st.setProperty('--spop-opacity', String(clamp(s.opacity, 10, 100) / 100));
        st.setProperty('--spop-img-tf', `rotate(${s.rotation}deg) scale(${s.flipH ? -1 : 1}, ${s.flipV ? -1 : 1})`);
        holder.classList.add(CLS_CUSTOM);
        holder.classList.toggle(CLS_VNOFF, wrapperHidden());
        if (hidden && !ctrl) positionHitbox();
        syncMoveUI();
    }

    function ensureStyleObserver() {
        const holder = getHolder();
        if (!holder || holder === observedStyleHolder) return;
        styleObserver?.disconnect();
        observedStyleHolder = holder;
        styleObserver = new MutationObserver(() => {
            // quelqu'un (ST : glisser du holder, mode VN, min-width de la transition d'expression…) a modifié nos styles : on les rétablit
            if (ctrl || !settings().placeEnabled) return;
            const h = getHolder();
            if (h && !placementIntact(h)) applyPlacement();
        });
        styleObserver.observe(holder, { attributes: true, attributeFilter: ['style', 'class'] });
        holder.addEventListener('load', () => { if (settings().placeEnabled) { applyPlacement(); scheduleUiSync(); } }, true);
    }

    /** Position / taille actuelles du sticker (tel que le thème le place), exprimées comme nos réglages. */
    function measureCurrent() {
        const r = stickerRect();
        if (!r) return null;
        const { w: vw, h: vh } = viewport();
        const ins = insets();
        return {
            sizePct: clamp((r.width / vw) * 100, SIZE_MIN, 100),
            posX: pctFromPx(r.left, ins.l, Math.max(ins.l, vw - ins.r - r.width)),
            posY: pctFromPx(r.top, ins.t, Math.max(ins.t, vh - ins.b - r.height)),
            left: r.left, top: r.top, w: r.width, h: r.height,
        };
    }

    /** Activation : la première fois, on part de l'emplacement et de la taille actuels (aucun saut visible). */
    function enablePlacement() {
        const s = settings();
        if (s.placeEnabled) return;
        if (!s.placed) {
            const h = getHolder();
            const wasEmpty = !!h?.classList.contains(CLS_EMPTY);
            if (wasEmpty) h.classList.remove(CLS_EMPTY); // cadre vide masqué : on le remesure tel qu'il serait affiché
            const m = measureCurrent();
            if (wasEmpty) h.classList.add(CLS_EMPTY);
            if (m) {
                lastAr = m.h / m.w;
                setLayout({ posX: m.posX, posY: m.posY, sizePct: m.sizePct });
            }
            s.placed = true;
        }
        s.placeEnabled = true;
        applyPlacement();
    }

    /** Modifie la mise en page (position / taille) : active le mode personnalisé si besoin, applique, enregistre. */
    function changeLayout(patchOrFn, { save = true } = {}) {
        enablePlacement();
        const s = settings();
        const g = computeGeom(s);
        const patch = typeof patchOrFn === 'function' ? patchOrFn(g) : patchOrFn;
        if (patch) {
            const lay = {};
            ['posX', 'posY', 'sizePct'].forEach((k) => { if (k in patch) lay[k] = patch[k]; });
            if (Object.keys(lay).length) setLayout(lay);
            ['rotation', 'flipH', 'flipV', 'opacity', 'layer', 'maxHeightPct'].forEach((k) => { if (k in patch) s[k] = patch[k]; });
        }
        sanitize(s);
        // la taille enregistrée reste dans la plage réellement utilisable (40-1200 px) : pas de « zone morte » du curseur
        const L1 = getLayout(s);
        const lo = Math.max(SIZE_MIN, (SIZE_PX_MIN / g.vw) * 100), hi = Math.min(100, (SIZE_PX_MAX / g.vw) * 100);
        if (L1.sizePct < lo - 1e-9 || L1.sizePct > hi + 1e-9) setLayout({ sizePct: clamp(L1.sizePct, lo, Math.max(lo, hi)) });
        applyPlacement();
        scheduleUiSync();
        if (save) saveSettings();
    }

    const setPosPx = (axis, px) => changeLayout((g) => (axis === 'x' ? { posX: pctFromPx(px, g.minL, g.maxL) } : { posY: pctFromPx(px, g.minT, g.maxT) }));
    const setSizePx = (px) => changeLayout((g) => ({ sizePct: clamp((clamp(px, SIZE_PX_MIN, SIZE_PX_MAX) / g.vw) * 100, SIZE_MIN, 100) }));

    function resetPlacement() {
        if (moving) stopMove();
        const s = settings();
        for (const k of RESET_KEYS) s[k] = DEFAULTS[k];
        s.positions = {};
        applyPlacement();
        syncPlacementUI();
        saveSettings();
    }

    /* ---------------- mode « Déplacer » : glisser, pincer, poignée ---------------- */

    function mkEl(id, cls) {
        const el = document.createElement('div');
        el.id = id;
        if (cls) el.className = cls;
        return el;
    }

    function syncMoveUI() {
        if (!moving || !mvEls) return;
        const g = lastGeom || computeGeom();
        const o = mvEls.overlay.style;
        o.setProperty('left', pxs(g.left), 'important');
        o.setProperty('top', pxs(g.top), 'important');
        o.setProperty('width', pxs(g.w), 'important');
        o.setProperty('height', pxs(g.h), 'important');
        const show = !!settings().showHandle;
        const hs = mvEls.handle.style;
        hs.setProperty('display', show ? 'block' : 'none', 'important');
        hs.setProperty('left', pxs(clamp(g.left + g.w - HANDLE_SIZE / 2, 0, g.vw - HANDLE_SIZE)), 'important');
        hs.setProperty('top', pxs(clamp(g.top + g.h - HANDLE_SIZE / 2, 0, g.vh - HANDLE_SIZE)), 'important');
    }

    function startMove() {
        if (moving) return;
        enablePlacement();
        finishCtrl();
        if (hidden) showSticker({ animate: false });
        moving = true;
        down = null;
        const overlay = mkEl(MOVE_ID);
        overlay.setAttribute('aria-label', 'Déplacer le sticker');
        const handle = mkEl(HANDLE_ID);
        handle.setAttribute('aria-label', 'Redimensionner le sticker');
        const bar = mkEl(BAR_ID);
        bar.innerHTML = '<span>Glissez le sticker · pincez pour la taille</span><button type="button">✓ Terminer</button>';
        bar.querySelector('button').addEventListener('click', (e) => { e.preventDefault(); stopMove(); });
        document.body.append(overlay, handle, bar);
        mvEls = { overlay, handle, bar };
        overlay.addEventListener('pointerdown', (e) => trackDown(e, 'drag'));
        handle.addEventListener('pointerdown', (e) => trackDown(e, 'resize'));
        overlay.addEventListener('wheel', (e) => {
            e.preventDefault();
            const f = Math.exp(-e.deltaY * 0.0015);
            changeLayout((g) => ({ sizePct: clamp(g.sizePct * f, SIZE_MIN, 100) }), { save: false });
            saveSettings();
        }, { passive: false });
        // le menu contextuel / la loupe iOS ne doivent pas s'en mêler
        [overlay, handle].forEach((el) => el.addEventListener('contextmenu', (e) => e.preventDefault()));
        document.documentElement.classList.add(CLS_MOVING);
        setMoveListeners(true);
        syncMoveUI();
        syncMoveButton();
    }

    function stopMove() {
        if (!moving) return;
        moving = false;
        ptrs.clear();
        gesture = null;
        mvEls?.overlay.remove(); mvEls?.handle.remove(); mvEls?.bar.remove();
        mvEls = null;
        document.documentElement.classList.remove(CLS_MOVING);
        setMoveListeners(false);
        saveSettings();
        syncMoveButton();
        syncPlacementUI();
    }

    function beginGesture(kind) {
        const g = computeGeom();
        const pts = [...ptrs.values()];
        if (pts.length >= 2) {
            const [a, b] = pts;
            gesture = {
                kind: 'pinch', g0: g, d0: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
                m0: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, c0: { x: g.left + g.w / 2, y: g.top + g.h / 2 },
            };
        } else {
            gesture = { kind, g0: g, p0: { x: pts[0].x, y: pts[0].y }, moved: kind === 'resize' };
        }
    }

    function trackDown(e, kind) {
        if (!moving) return;
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        if (ptrs.has(e.pointerId) || ptrs.size >= 2) return;
        e.preventDefault();
        e.stopPropagation();
        try { e.target.setPointerCapture?.(e.pointerId); } catch { /* pointeur synthétique : sans importance */ }
        ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
        beginGesture(kind);
    }

    function onMoveDownDoc(e) {
        if (!moving) return;
        // deuxième doigt posé n'importe où à l'écran pendant qu'un premier tient le sticker : pincement
        if (ptrs.size === 1 && !ptrs.has(e.pointerId) && !e.target?.closest?.(`#${BAR_ID}`)) {
            e.preventDefault();
            e.stopPropagation();
            ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
            beginGesture('drag');
        }
    }

    function onMoveMoveDoc(e) {
        if (!moving || !ptrs.has(e.pointerId) || !gesture) return;
        e.preventDefault();
        ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
        const g0 = gesture.g0;
        if (gesture.kind === 'pinch') {
            const [a, b] = [...ptrs.values()];
            if (!b) return;
            const d = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
            const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
            const sizePct = clamp(((g0.w * d) / gesture.d0 / g0.vw) * 100, SIZE_MIN, 100);
            changeLayout((g) => {
                // taille d'après l'écart des doigts, centre du sticker suivant le milieu des doigts
                setLayout({ sizePct });
                const g1 = computeGeom();
                const cx = gesture.c0.x + (m.x - gesture.m0.x), cy = gesture.c0.y + (m.y - gesture.m0.y);
                return { sizePct, posX: pctFromPx(cx - g1.w / 2, g1.minL, g1.maxL), posY: pctFromPx(cy - g1.h / 2, g1.minT, g1.maxT) };
            }, { save: false });
            return;
        }
        const p = ptrs.get(e.pointerId);
        const dx = p.x - gesture.p0.x, dy = p.y - gesture.p0.y;
        if (gesture.kind === 'drag') {
            if (!gesture.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
            gesture.moved = true;
            changeLayout((g) => ({ posX: pctFromPx(g0.left + dx, g.minL, g.maxL), posY: pctFromPx(g0.top + dy, g.minT, g.maxT) }), { save: false });
        } else { // poignée : coin haut-gauche fixe, ratio conservé
            const w = g0.w + (dx + dy / g0.ar) / 2;
            const sizePct = clamp((w / g0.vw) * 100, SIZE_MIN, 100);
            changeLayout(() => {
                setLayout({ sizePct });
                const g1 = computeGeom();
                return { sizePct, posX: pctFromPx(g0.left, g1.minL, g1.maxL), posY: pctFromPx(g0.top, g1.minT, g1.maxT) };
            }, { save: false });
        }
    }

    function onMoveUpDoc(e) {
        if (!moving || !ptrs.has(e.pointerId)) return;
        ptrs.delete(e.pointerId);
        if (ptrs.size === 0) { gesture = null; saveSettings(); scheduleUiSync(); } else beginGesture('drag'); // le doigt restant continue en glissement
    }

    const onTouchMoveDoc = (e) => { if (moving && ptrs.size) e.preventDefault(); };
    const onGestureDoc = (e) => { if (moving) e.preventDefault(); };
    const onKeyDownDoc = (e) => { if (moving && e.key === 'Escape') stopMove(); };
    /**
     * v1.2.3 : les écouteurs du mode « Déplacer » (dont touchmove / pointermove NON passifs sur tout le document, qui obligent iOS à attendre
     * le JavaScript avant chaque défilement, et keydown) ne sont posés QUE pendant le mode Déplacer, puis retirés.
     */
    function setMoveListeners(on) {
        const f = on ? 'addEventListener' : 'removeEventListener';
        document[f]('pointerdown', onMoveDownDoc, { capture: true });
        document[f]('pointermove', onMoveMoveDoc, { capture: true, passive: false });
        document[f]('pointerup', onMoveUpDoc, { capture: true });
        document[f]('pointercancel', onMoveUpDoc, { capture: true });
        document[f]('touchmove', onTouchMoveDoc, { capture: true, passive: false });
        ['gesturestart', 'gesturechange'].forEach((n) => document[f](n, onGestureDoc, { passive: false }));
        document[f]('keydown', onKeyDownDoc);
    }

    /* ---------------- panneau : synchronisation des champs ---------------- */

    function scheduleUiSync() {
        if (uiRaf) return;
        uiRaf = requestAnimationFrame(() => { uiRaf = 0; syncPlacementUI(); });
    }

    function syncMoveButton() {
        const b = document.getElementById('stickerpop_move');
        if (b) b.textContent = moving ? '✓ Terminer le déplacement' : '✋ Déplacer';
    }

    function syncPlacementUI() {
        if (!document.getElementById('stickerpop_settings')) return;
        const s = settings();
        let g = computeGeom(s);
        if (!s.placeEnabled) { // mode thème : les champs montrent où se trouve réellement le sticker (rien n'est modifié)
            const m = measureCurrent();
            if (m) g = { ...g, posX: m.posX, posY: m.posY, sizePct: m.sizePct, left: m.left, top: m.top, w: m.w };
        }
        const put = (id, v) => {
            const el = document.getElementById(id);
            if (el && document.activeElement !== el) el.value = String(v);
        };
        const r1 = (v) => Math.round(v * 10) / 10;
        put('stickerpop_posX', r1(g.posX)); put('stickerpop_posX_n', r1(g.posX)); put('stickerpop_posX_px', r1(g.left));
        put('stickerpop_posY', r1(g.posY)); put('stickerpop_posY_n', r1(g.posY)); put('stickerpop_posY_px', r1(g.top));
        put('stickerpop_sizePct', r1(g.sizePct)); put('stickerpop_sizePct_n', r1(g.sizePct)); put('stickerpop_size_px', r1(g.w));
        put('stickerpop_maxHeightPct', s.maxHeightPct); put('stickerpop_maxHeightPct_n', s.maxHeightPct);
        put('stickerpop_rotation', s.rotation); put('stickerpop_rotation_n', s.rotation);
        put('stickerpop_opacity', s.opacity); put('stickerpop_opacity_n', s.opacity);
        put('stickerpop_layer', s.layer);
        const chk = (id, v) => { const el = document.getElementById(id); if (el) el.checked = !!v; };
        chk('stickerpop_placeEnabled', s.placeEnabled); chk('stickerpop_flipH', s.flipH); chk('stickerpop_flipV', s.flipV);
        chk('stickerpop_showHandle', s.showHandle); chk('stickerpop_perCharacter', s.perCharacter);
        syncMoveButton();
    }

    function onViewportChange() {
        const { w } = viewport();
        const typing = /^(INPUT|TEXTAREA)$/.test(document.activeElement?.tagName || '');
        if (typing && Math.abs(w - lastViewW) < 1) return; // ouverture du clavier : on ne bouge pas le sticker
        lastViewW = w;
        if (settings().placeEnabled) { applyPlacement(); scheduleUiSync(); }
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
        if (!holderEmpty()) ensureHitbox(); // zone transparente exactement à l'emplacement et à la taille du sticker
        syncRestoreButton();
        syncNoBox();
    }

    function clearHiddenState() {
        const holder = getHolder();
        if (holder) {
            holder.classList.remove(CLS_HIDDEN);
            restoreProps(holder, HIDE_PROPS);
        }
        removeHitbox();
        syncNoBox();
    }

    function hideSticker() {
        finishCtrl();
        const holder = getHolder();
        const img = getImage();
        if (!holder || !img || hidden || moving || !holderDisplayed()) return;
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
        if (moving) { down = null; return; } // en mode Déplacer, un toucher ne masque jamais le sticker
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
        if (!d || moving) return;
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
        // v1.2.3 : nos propres écritures (classe du holder, styles d'animation image par image) ne déclenchent plus rien
        if (!mutations.some((m) => m.type === 'childList' || m.target !== observedHolder)) return;
        safe(syncEmpty);
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
        if (!hidden && isNew && settings().animNew && (wasHidden || !ctrl)) {
            if (holderEmpty()) pendingIn = true; // cadre masqué (image pas encore chargée) : l'animation d'apparition se joue au chargement
            else run('in');
        }
        if (settings().placeEnabled) { applyPlacement(); scheduleUiSync(); } // nouveau ratio / personnage : on recalcule la taille et la position
        if (hidden) { positionHitbox(); syncRestoreButton(); }
    }

    function attachObserver() {
        const holder = getHolder();
        if (!holder || holder === observedHolder) return;
        holderObserver?.disconnect();
        observedHolder = holder;
        holderObserver = new MutationObserver(onHolderMutation);
        holderObserver.observe(holder, { childList: true, subtree: true, attributes: true, attributeFilter: ['src', 'class', 'srcset'] });
        // chargement / échec d'une image (événements qui ne remontent pas : écoute en phase de capture)
        holder.addEventListener('load', () => safe(syncEmpty), true);
        holder.addEventListener('error', (e) => {
            const t = e.target;
            if (t?.matches?.(IMAGE_SELECTOR) && t.getAttribute('src')) failedSrc.set(t, { src: t.getAttribute('src'), at: Date.now() });
            safe(syncEmpty);
        }, true);
        syncEmpty();
        if (hidden && !ctrl) applyHiddenState();
        const img = getImage();
        if (img) lastKey = keyOf(img);
    }

    /* ---------------- feuille de style (injectée en dernier, spécificité élevée) ---------------- */

    const INJECTED_CSS = `
html body #expression-holder.${CLS_CUSTOM} { transform: none !important; translate: none !important; rotate: none !important; scale: none !important; opacity: var(--spop-opacity, 1) !important; box-sizing: border-box !important; padding: 0 !important; border: 0 !important; overflow: visible !important; }
html body #expression-holder.${CLS_CUSTOM} img.expression { position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important; height: 100% !important; min-width: 0 !important; min-height: 0 !important; max-width: none !important; max-height: none !important; margin: 0 !important; object-fit: contain !important; transform: var(--spop-img-tf, none) !important; transform-origin: 50% 50% !important; }
html body #expression-holder.${CLS_CUSTOM} #expression-holderheader { display: none !important; }
html body #expression-holder.${CLS_CUSTOM}.${CLS_VNOFF} { display: none !important; }
html body #expression-holder.${CLS_HIDDEN} { opacity: 0 !important; visibility: hidden !important; pointer-events: none !important; transition: none !important; background: none !important; border: 0 !important; box-shadow: none !important; outline: 0 !important; filter: none !important; }
html body #expression-holder.${CLS_EMPTY} { visibility: hidden !important; opacity: 0 !important; pointer-events: none !important; background: none !important; border: 0 !important; box-shadow: none !important; outline: 0 !important; filter: none !important; }
html body #expression-holder.${CLS_EMPTY}:not(.${CLS_CUSTOM}) { min-width: 0 !important; min-height: 0 !important; padding: 0 !important; }
html body #expression-wrapper.${CLS_NOBOX} { background: none !important; border: 0 !important; box-shadow: none !important; outline: 0 !important; pointer-events: none !important; }
html body.${CLS_SW1} .mes:not(.${CLS_MULTI}) :is(.swipeRightBlock, .swipe_right, .swipe_left, .swipes-counter),
html body.${CLS_SWALL} :is(.swipeRightBlock, .swipe_right, .swipe_left, .swipes-counter) { display: none !important; visibility: hidden !important; pointer-events: none !important; background: none !important; border: 0 !important; box-shadow: none !important; outline: 0 !important; }
html body #expression-holder img.expression { -webkit-touch-callout: none; -webkit-user-select: none; user-select: none; touch-action: manipulation; }
html body #${RESTORE_ID} { display: none; position: fixed; width: 36px; height: 36px; padding: 0; border: 0; border-radius: 50%; font-size: 18px; line-height: 36px; text-align: center; background: rgba(40,40,40,.55); color: #fff; opacity: .75; z-index: 2147483000; touch-action: manipulation; cursor: pointer; }
html body #${RESTORE_ID}.stickerpop-restore-on { display: block !important; }
html body #${MOVE_ID} { position: fixed; z-index: 2147483000; margin: 0; padding: 0; box-sizing: border-box; background: rgba(74,140,255,.14); outline: 2px dashed rgba(255,255,255,.95); box-shadow: 0 0 0 1px rgba(0,0,0,.55); touch-action: none; pointer-events: auto; cursor: grab; transform: none; -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; -webkit-tap-highlight-color: transparent; }
html body #${HANDLE_ID} { position: fixed; z-index: 2147483001; width: ${HANDLE_SIZE}px; height: ${HANDLE_SIZE}px; margin: 0; padding: 0; box-sizing: border-box; border-radius: 50%; background: #fff; border: 3px solid #4a8cff; box-shadow: 0 1px 4px rgba(0,0,0,.5); touch-action: none; pointer-events: auto; cursor: nwse-resize; -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; }
html body #${BAR_ID} { position: fixed; z-index: 2147483002; left: 50%; top: calc(env(safe-area-inset-top, 0px) + 8px); transform: translateX(-50%); display: flex; align-items: center; gap: 10px; max-width: calc(100vw - 16px); padding: 6px 8px 6px 12px; border-radius: 20px; background: rgba(20,20,20,.88); color: #fff; font: 13px/1.25 -apple-system, system-ui, sans-serif; touch-action: manipulation; -webkit-user-select: none; user-select: none; }
html body #${BAR_ID} button { border: 0; border-radius: 14px; padding: 7px 12px; background: #4a8cff; color: #fff; font: 600 13px/1 -apple-system, system-ui, sans-serif; white-space: nowrap; }
html.${CLS_MOVING} .drawer-content { opacity: 0 !important; pointer-events: none !important; }
.${CLS_GHOST} { opacity: .08 !important; transition: opacity .1s !important; }
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
      <b>Cadre vide et compteur de swipes</b>
      <label class="checkbox_label"><input type="checkbox" id="stickerpop_hideEmptyFrame"><span>Masquer le cadre quand il n'y a pas de sticker</span></label>
      <small>Pas d'image, image en échec ou personnage sans sprite : le cadre (bordure, fond, ombre) est entièrement masqué et ne reçoit plus aucun toucher. Il revient tout seul avec le prochain sticker.</small>
      <label class="checkbox_label"><input type="checkbox" id="stickerpop_hideSwipe1"><span>Masquer le compteur de swipes 1/1 / flèche quand il n'y a qu'un seul swipe</span></label>
      <small>Le petit bloc « &gt; 1/1 » en bas à droite du dernier message vient de SillyTavern. Il reste visible dès qu'il y a 2 swipes ou plus.</small>
      <label class="checkbox_label"><input type="checkbox" id="stickerpop_hideSwipeAlways"><span>Masquer toujours le compteur de swipes et les flèches</span></label>
      <label class="checkbox_label"><input type="checkbox" id="stickerpop_disableAutoHide"><span>Désactiver le masquage automatique</span></label>
      <small>Mode sécurité : plus aucun masquage automatique (ni cadre vide, ni compteur de swipes). À cocher si un sticker n'apparaît pas.</small>
      <hr>
      <b>Position et taille du sticker</b>
      <label class="checkbox_label"><input type="checkbox" id="stickerpop_placeEnabled"><span>Utiliser une position et une taille personnalisées</span></label>
      <small>Désactivé : le sticker reste où votre thème / CSS le place (comportement d'origine). Activé : il est placé comme ci-dessous, sur tout l'écran.</small>
      <div class="flex-container" style="gap:8px;margin:6px 0">
        <button type="button" id="stickerpop_move" class="menu_button">✋ Déplacer</button>
        <button type="button" id="stickerpop_reset" class="menu_button">↺ Réinitialiser</button>
      </div>
      <small>« Déplacer » masque ce panneau : faites glisser le sticker avec le doigt, pincez à deux doigts pour changer sa taille, puis touchez « ✓ Terminer ».</small>
      <div style="margin:6px 0">
        <label for="stickerpop_posX">Horizontal</label>
        <div class="flex-container alignItemsCenter" style="gap:6px;flex-wrap:nowrap">
          <input type="range" id="stickerpop_posX" min="0" max="100" step="0.1" style="flex:1;min-width:100px">
          <input type="number" id="stickerpop_posX_n" class="text_pole" min="0" max="100" step="0.1" style="width:64px"><span>%</span>
          <input type="number" id="stickerpop_posX_px" class="text_pole" step="0.1" style="width:72px"><span>px</span>
        </div>
      </div>
      <div style="margin:6px 0">
        <label for="stickerpop_posY">Vertical</label>
        <div class="flex-container alignItemsCenter" style="gap:6px;flex-wrap:nowrap">
          <input type="range" id="stickerpop_posY" min="0" max="100" step="0.1" style="flex:1;min-width:100px">
          <input type="number" id="stickerpop_posY_n" class="text_pole" min="0" max="100" step="0.1" style="width:64px"><span>%</span>
          <input type="number" id="stickerpop_posY_px" class="text_pole" step="0.1" style="width:72px"><span>px</span>
        </div>
      </div>
      <div style="margin:6px 0">
        <label>Positions prédéfinies</label>
        <div id="stickerpop_presets" style="display:grid;grid-template-columns:repeat(3,48px);gap:6px">
          <button type="button" class="menu_button" data-px="0" data-py="0" title="Coin haut gauche">↖</button>
          <button type="button" class="menu_button" data-px="50" data-py="0" title="Haut au centre">↑</button>
          <button type="button" class="menu_button" data-px="100" data-py="0" title="Coin haut droit">↗</button>
          <button type="button" class="menu_button" data-px="0" data-py="50" title="Centre gauche">←</button>
          <button type="button" class="menu_button" data-px="50" data-py="50" title="Centre de l'écran">●</button>
          <button type="button" class="menu_button" data-px="100" data-py="50" title="Centre droit">→</button>
          <button type="button" class="menu_button" data-px="0" data-py="100" title="Coin bas gauche">↙</button>
          <button type="button" class="menu_button" data-px="50" data-py="100" title="Bas au centre">↓</button>
          <button type="button" class="menu_button" data-px="100" data-py="100" title="Coin bas droit">↘</button>
        </div>
      </div>
      <div style="margin:6px 0">
        <label for="stickerpop_sizePct">Taille (largeur, % de l'écran)</label>
        <div class="flex-container alignItemsCenter" style="gap:6px;flex-wrap:nowrap">
          <input type="range" id="stickerpop_sizePct" min="5" max="100" step="0.1" style="flex:1;min-width:100px">
          <input type="number" id="stickerpop_sizePct_n" class="text_pole" min="5" max="100" step="0.1" style="width:64px"><span>%</span>
          <input type="number" id="stickerpop_size_px" class="text_pole" min="40" max="1200" step="1" style="width:72px"><span>px</span>
        </div>
        <small>Le ratio de l'image est toujours conservé (40 à 1200 px).</small>
      </div>
      <div style="margin:6px 0">
        <label for="stickerpop_maxHeightPct">Hauteur maximale (% de l'écran)</label>
        <div class="flex-container alignItemsCenter" style="gap:6px;flex-wrap:nowrap">
          <input type="range" id="stickerpop_maxHeightPct" min="20" max="100" step="1" style="flex:1;min-width:100px">
          <input type="number" id="stickerpop_maxHeightPct_n" class="text_pole" min="20" max="100" step="1" style="width:64px"><span>%</span>
        </div>
      </div>
      <label class="checkbox_label"><input type="checkbox" id="stickerpop_showHandle"><span>Poignée de redimensionnement en mode Déplacer</span></label>
      <div style="margin:6px 0">
        <label for="stickerpop_rotation">Rotation</label>
        <div class="flex-container alignItemsCenter" style="gap:6px;flex-wrap:nowrap">
          <input type="range" id="stickerpop_rotation" min="-180" max="180" step="1" style="flex:1;min-width:100px">
          <input type="number" id="stickerpop_rotation_n" class="text_pole" min="-180" max="180" step="1" style="width:64px"><span>°</span>
        </div>
      </div>
      <div class="flex-container" style="gap:14px;margin:6px 0">
        <label class="checkbox_label"><input type="checkbox" id="stickerpop_flipH"><span>Miroir horizontal</span></label>
        <label class="checkbox_label"><input type="checkbox" id="stickerpop_flipV"><span>Miroir vertical</span></label>
      </div>
      <div style="margin:6px 0">
        <label for="stickerpop_opacity">Opacité</label>
        <div class="flex-container alignItemsCenter" style="gap:6px;flex-wrap:nowrap">
          <input type="range" id="stickerpop_opacity" min="10" max="100" step="1" style="flex:1;min-width:100px">
          <input type="number" id="stickerpop_opacity_n" class="text_pole" min="10" max="100" step="1" style="width:64px"><span>%</span>
        </div>
      </div>
      <div class="flex-container alignItemsCenter" style="gap:8px;margin:6px 0">
        <label for="stickerpop_layer">Calque</label>
        <select id="stickerpop_layer" class="text_pole" style="width:auto">
          <option value="front">Devant le chat</option>
          <option value="back">Derrière le chat</option>
        </select>
      </div>
      <label class="checkbox_label"><input type="checkbox" id="stickerpop_perCharacter"><span>Mémoriser position et taille par personnage (sinon : réglage global)</span></label>
      <small>Pendant que vous touchez un curseur de position / taille, ce panneau devient presque transparent pour voir le sticker.</small>
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
        bindCheck('hideEmptyFrame', 'hideEmptyFrame', () => syncEmpty());
        bindCheck('disableAutoHide', 'disableAutoHide', () => { syncEmpty(); syncSwipes(); });
        bindCheck('hideSwipe1', 'hideSwipe1', () => syncSwipes());
        bindCheck('hideSwipeAlways', 'hideSwipeAlways', () => syncSwipes());
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
        // ----- position / taille (v1.2.0) -----
        const cfgNow = () => settings();
        const bindPair = (id, fromValue, opts = {}) => {
            // curseur (input) + champ numérique (change) liés
            $(`#stickerpop_${id}`).on('input change', function () { fromValue(Number(this.value)); });
            $(`#stickerpop_${id}_n`).on('change', function () { if (this.value !== '') fromValue(Number(this.value)); else syncPlacementUI(); });
        };
        bindPair('posX', (v) => Number.isFinite(v) && changeLayout({ posX: clamp(v, 0, 100) }));
        bindPair('posY', (v) => Number.isFinite(v) && changeLayout({ posY: clamp(v, 0, 100) }));
        bindPair('sizePct', (v) => Number.isFinite(v) && changeLayout({ sizePct: clamp(v, SIZE_MIN, 100) }));
        bindPair('maxHeightPct', (v) => Number.isFinite(v) && changeLayout({ maxHeightPct: clamp(Math.round(v), 20, 100) }));
        bindPair('rotation', (v) => Number.isFinite(v) && changeLayout({ rotation: clamp(Math.round(v), -180, 180) }));
        bindPair('opacity', (v) => Number.isFinite(v) && changeLayout({ opacity: clamp(Math.round(v), 10, 100) }));
        $('#stickerpop_posX_px').on('change', function () { if (this.value !== '') setPosPx('x', Number(this.value)); else syncPlacementUI(); });
        $('#stickerpop_posY_px').on('change', function () { if (this.value !== '') setPosPx('y', Number(this.value)); else syncPlacementUI(); });
        $('#stickerpop_size_px').on('change', function () { if (this.value !== '') setSizePx(Number(this.value)); else syncPlacementUI(); });
        $('#stickerpop_layer').on('change', function () { changeLayout({ layer: this.value === 'back' ? 'back' : 'front' }); });
        $('#stickerpop_flipH').on('change', function () { changeLayout({ flipH: this.checked }); });
        $('#stickerpop_flipV').on('change', function () { changeLayout({ flipV: this.checked }); });
        $('#stickerpop_showHandle').on('change', function () { cfgNow().showHandle = this.checked; syncMoveUI(); saveSettings(); });
        $('#stickerpop_perCharacter').on('change', function () { cfgNow().perCharacter = this.checked; applyPlacement(); syncPlacementUI(); saveSettings(); });
        $('#stickerpop_placeEnabled').on('change', function () {
            if (this.checked) { enablePlacement(); } else { if (moving) stopMove(); cfgNow().placeEnabled = false; applyPlacement(); }
            syncPlacementUI();
            saveSettings();
        });
        $('#stickerpop_presets button').on('click', function () {
            changeLayout({ posX: Number(this.dataset.px), posY: Number(this.dataset.py) });
        });
        $('#stickerpop_move').on('click', () => { if (moving) stopMove(); else startMove(); });
        $('#stickerpop_reset').on('click', () => resetPlacement());
        // pendant qu'on tient un curseur de position / taille, le tiroir de réglages devient presque transparent
        const ghostEl = () => document.getElementById('stickerpop_settings')?.closest('.drawer-content');
        const unghost = () => ghostEl()?.classList.remove(CLS_GHOST);
        $('#stickerpop_settings input[type=range]').on('pointerdown touchstart', function () {
            if (this.id === 'stickerpop_duration') return;
            ghostEl()?.classList.add(CLS_GHOST);
        });
        $(document).on('pointerup pointercancel touchend touchcancel', unghost);
        $(window).on('blur', unghost);
        syncPlacementUI();
    }

    /* ---------------- initialisation ---------------- */

    /* ---------------- surveillance périodique légère (v1.2.3) ----------------
       Avant : setInterval 1 s (relecture de la mise en page : getClientRects, getBoundingClientRect, elementFromPoint, getComputedStyle,
       parcours de tous les .mes) + setInterval 500 ms, en continu, même pendant la frappe.
       Maintenant : tout est piloté par les événements ; il reste un contrôle de sécurité toutes les 2 s, en pause quand la page est en
       arrière-plan, qui ne fait que des vérifications sans lecture de mise en page. Les étapes qui mesurent l'écran (zone de toucher,
       champs du panneau) attendent que l'on ne soit pas en train d'écrire, et passent par requestIdleCallback quand il existe. */
    const WATCHDOG_MS = 2000;
    let watchdogTimer = 0;
    let idleHandle = 0;
    let panelVisible = false;
    let panelIO = null;

    /** L'utilisateur est-il en train d'écrire (champ de saisie actif) ? Simple lecture de document.activeElement, aucun écouteur de frappe. */
    function isTyping() {
        const a = document.activeElement;
        return !!a && (a.id === 'send_textarea' || a.tagName === 'TEXTAREA' || a.tagName === 'INPUT' || a.isContentEditable);
    }

    function scheduleWatchdog() {
        clearTimeout(watchdogTimer);
        if (document.hidden) { watchdogTimer = 0; return; } // reprend sur visibilitychange
        watchdogTimer = setTimeout(() => { watchdogTimer = 0; tick(); scheduleWatchdog(); }, WATCHDOG_MS);
    }

    /** Exécute fn quand le fil principal est libre (requestIdleCallback si disponible, sinon tout de suite : le contrôle est déjà espacé). */
    function whenIdle(fn) {
        if (idleHandle) return;
        if (typeof requestIdleCallback === 'function') {
            idleHandle = requestIdleCallback(() => { idleHandle = 0; safe(fn); }, { timeout: 1000 });
        } else {
            safe(fn);
        }
    }

    function tick() {
        safe(syncEmpty); // d'abord : le suivi du cadre vide ne doit dépendre d'aucune autre étape
        safe(tickMain);
        safe(syncEmpty);
    }

    function tickMain() {
        // vérifications bon marché (aucune lecture de mise en page)
        attachObserver();
        ensureStyleObserver();
        ensureChatObserver();
        mountSettings();
        watchPanel();
        if (hidden && !ctrl) {
            const h = getHolder();
            if (h && !h.classList.contains(CLS_HIDDEN)) applyHiddenState(); // quelqu'un a retiré notre état : on le rétablit
        }
        const chatEl = document.getElementById('chat');
        if (chatEl && swipeSignature(chatEl, ctx()?.chat) !== swipeSig) scheduleSwipeSync(); // filet de sécurité (lecture d'un compteur, aucun parcours tant que rien ne change)
        if (isTyping() && !panelVisible) return; // pendant la frappe : on ne touche ni au <head> ni à la mise en page
        whenIdle(tickLayout);
    }

    /** Étapes qui lisent la mise en page / le style calculé : seulement hors frappe, au repos. */
    function tickLayout() {
        if (isTyping() && !panelVisible) return;
        ensureStyle();
        if (panelVisible && !moving) syncPlacementUI(); // champs du panneau à jour tant qu'il est visible
        if (!ctrl && !moving) {
            const h0 = getHolder();
            if (h0 && (settings().placeEnabled ? !placementIntact(h0) || h0.classList.contains(CLS_VNOFF) !== wrapperHidden() : h0.classList.contains(CLS_CUSTOM))) applyPlacement();
        }
        if (hidden && !ctrl) {
            const h = getHolder();
            if (h && !holderEmpty()) ensureHitbox();
            positionHitbox();
            syncRestoreButton();
        }
    }

    /** Visibilité du panneau de réglages via IntersectionObserver (asynchrone, aucun reflow forcé). */
    function watchPanel() {
        const el = document.getElementById('stickerpop_settings');
        if (!el || panelIO?.target === el) return;
        panelIO?.io.disconnect();
        panelVisible = false;
        if (typeof IntersectionObserver !== 'function') { panelVisible = true; return; }
        const io = new IntersectionObserver((entries) => {
            const vis = entries.some((e) => e.isIntersecting);
            if (vis && !panelVisible) scheduleUiSync();
            panelVisible = vis;
        });
        io.observe(el.querySelector('.inline-drawer-content') || el);
        panelIO = { io, target: el };
    }

    let viewRaf = 0;
    /** resize / orientationchange regroupés : un seul recalcul par image affichée. */
    function onResize() {
        if (viewRaf) return;
        viewRaf = requestAnimationFrame(() => {
            viewRaf = 0;
            safe(onViewportChange);
            if (hidden && !ctrl) { positionHitbox(); syncRestoreButton(); }
        });
    }

    function start() {
        if (!document.body) return;
        settings();
        ensureStyle();
        document.addEventListener('pointerdown', onPointerDown, { capture: true, passive: true });
        document.addEventListener('pointerup', onPointerUp, { capture: true, passive: true });
        document.addEventListener('pointercancel', () => { down = null; }, { capture: true, passive: true });
        // position / taille personnalisées + zone de toucher : recalcul (regroupé par image) à chaque changement de taille d'écran
        // (iOS rapporte parfois la taille avec retard). Les écouteurs du mode Déplacer ne sont posés que pendant ce mode (setMoveListeners).
        lastViewW = viewport().w;
        window.addEventListener('resize', onResize, { passive: true });
        window.addEventListener('orientationchange', () => { onResize(); setTimeout(onResize, 350); }, { passive: true });
        document.addEventListener('visibilitychange', () => { if (document.hidden) finishCtrl(); });

        attachObserver();
        ensureStyleObserver();
        ensureChatObserver();
        syncSwipes();
        if (settings().placeEnabled) applyPlacement();
        // #expression-holder est créé par l'extension Expressions, éventuellement après nous ; il peut être recréé :
        // contrôle léger toutes les 2 s (en pause en arrière-plan), plus quelques passages rapprochés au démarrage.
        scheduleWatchdog();
        [300, 1000, 2500].forEach((ms) => setTimeout(tick, ms));
        document.addEventListener('visibilitychange', () => { safe(syncEmpty); if (!document.hidden) { tick(); scheduleWatchdog(); } });
        window.addEventListener('pageshow', () => safe(syncEmpty));
        window.addEventListener('focus', () => safe(syncEmpty));
        mountSettings();
        watchPanel();

        try {
            const c = ctx();
            c?.eventSource?.on?.(c.eventTypes?.CHAT_CHANGED ?? 'chat_id_changed', () => { pendingIn = false; showSticker({ animate: false }); safe(syncEmpty); setTimeout(() => safe(syncEmpty), 500); setTimeout(() => safe(syncEmpty), 2500); scheduleSwipeSync(); if (settings().placeEnabled) { applyPlacement(); scheduleUiSync(); } });
            // le nombre de swipes d'un message change : on remet à jour les classes (le MutationObserver du chat le fait aussi)
            ['MESSAGE_RECEIVED', 'CHARACTER_MESSAGE_RENDERED', 'MESSAGE_SWIPED', 'CHARACTER_SELECTED', 'GROUP_UPDATED', 'SETTINGS_UPDATED', 'EXPRESSION_CHANGED', 'EXPRESSION_SET']
                .forEach((k) => { const ev = c?.eventTypes?.[k]; if (ev) c.eventSource.on(ev, () => { safe(syncEmpty); setTimeout(() => safe(syncEmpty), 300); setTimeout(() => safe(syncEmpty), 1500); }); });
            ['MESSAGE_SWIPED', 'MESSAGE_RECEIVED', 'MESSAGE_SENT', 'MESSAGE_DELETED', 'MESSAGE_SWIPE_DELETED', 'CHARACTER_MESSAGE_RENDERED', 'USER_MESSAGE_RENDERED']
                .forEach((k) => { const ev = c?.eventTypes?.[k]; if (ev) c.eventSource.on(ev, () => { scheduleSwipeSync(); setTimeout(scheduleSwipeSync, 150); }); });
        } catch (e) { console.warn(LOG, e); }
        console.debug(LOG, 'prêt v1.2.3');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start, { once: true });
    } else {
        start();
    }
})();
