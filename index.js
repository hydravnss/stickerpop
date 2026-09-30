/**
 * StickerPop - extension SillyTavern
 * Affiche le sprite des « Character Expressions » (#expression-holder / #expression-image) comme un sticker.
 *
 * v1.0.1 - correctif « le sticker apparaît puis disparaît environ 1 seconde après » :
 *  - l'état « caché » ne s'applique plus qu'au sticker que l'on a caché ; un NOUVEAU sticker (nouvelle image) est toujours
 *    réaffiché (avant : l'état restait collé et chaque nouveau sticker était recaché aussitôt après son animation) ;
 *  - la classe de masquage est posée sur #expression-holder (stable) et non sur <img id="expression-image"> que
 *    SillyTavern clone/supprime à chaque changement d'expression (le clone héritait de la classe) ;
 *  - un simple « pointerup » ne masque plus : il faut un vrai toucher (pas de déplacement, pas de glisser-déposer du
 *    sprite, pas de défilement), par défaut un DOUBLE toucher, et jamais juste après l'apparition du sticker ;
 *  - plus de zone invisible plein-écran (z-index max) qui volait les touchers : petit bouton visible pour réafficher ;
 *  - plus d'observateur sur tout le body (style/class) : observation limitée à #expression-holder ;
 *  - l'animation d'entrée n'est plus liée à #expression-image (elle se rejouait quand SillyTavern échangeait l'id).
 */
(() => {
    'use strict';

    const MODULE = 'stickerpop';
    const LOG = '[StickerPop]';
    const HOLDER_ID = 'expression-holder';
    const IMAGE_SELECTOR = 'img.expression';
    const RESTORE_ID = 'stickerpop-restore';
    const CLS_HIDDEN = 'stickerpop-hidden';
    const CLS_ENTER = 'stickerpop-enter';
    const GRACE_MS = 1200;      // aucun masquage juste après l'apparition d'un sticker
    const TAP_MAX_MS = 450;     // durée max d'un toucher
    const TAP_MAX_MOVE = 10;    // déplacement max (px) d'un toucher
    const DOUBLE_TAP_MS = 400;  // délai max entre 2 touchers

    const DEFAULTS = Object.freeze({
        enabled: true,
        hideMode: 'double', // 'double' | 'single' | 'never'
        animation: true,
    });

    let hidden = false;
    let hiddenKey = '';
    let lastShownAt = 0;
    let restoreBtn = null;
    let holderObserver = null;
    let observedHolder = null;
    let down = null;
    let lastTap = null;

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
        if (!['double', 'single', 'never'].includes(s.hideMode)) s.hideMode = DEFAULTS.hideMode;
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

    /* ---------------- masquer / réafficher ---------------- */

    function placeRestore() {
        if (!restoreBtn) return;
        const holder = getHolder();
        const r = holder?.getBoundingClientRect();
        const size = 36;
        let left = 8, top = Math.max(8, innerHeight - size - 90);
        if (r && r.width > 0 && r.height > 0) {
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
        restoreBtn.addEventListener('click', (e) => {
            e.preventDefault();
            showSticker();
        });
        document.body.appendChild(restoreBtn);
        return restoreBtn;
    }

    function hideSticker() {
        const holder = getHolder();
        const img = getImage();
        if (!holder || !img || hidden) return;
        hidden = true;
        hiddenKey = keyOf(img);
        ensureRestoreButton();
        placeRestore();
        holder.classList.add(CLS_HIDDEN);
        restoreBtn.classList.add('stickerpop-restore-on');
    }

    function showSticker() {
        hidden = false;
        hiddenKey = '';
        getHolder()?.classList.remove(CLS_HIDDEN);
        restoreBtn?.classList.remove('stickerpop-restore-on');
    }

    /* ---------------- toucher sur le sticker ---------------- */

    function onPointerDown(e) {
        const holder = getHolder();
        if (!holder || !e.target?.closest?.(`#${HOLDER_ID}`)) { down = null; return; }
        // l'en-tête (poignée de déplacement) et la poignée de redimensionnement ne comptent jamais
        if (e.target.closest('#expression-holderheader, .drag-grabber')) { down = null; return; }
        if (!e.target.closest(IMAGE_SELECTOR)) { down = null; return; }
        const r = holder.getBoundingClientRect();
        down = { x: e.clientX, y: e.clientY, t: performance.now(), rx: r.left, ry: r.top, rw: r.width, rh: r.height, id: e.pointerId };
    }

    function onPointerUp(e) {
        const d = down;
        down = null;
        if (!d || hidden) return;
        const cfg = settings();
        if (!cfg.enabled || cfg.hideMode === 'never') return;
        const holder = getHolder();
        if (!holder) return;
        const now = performance.now();
        if (now - d.t > TAP_MAX_MS) return;
        if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > TAP_MAX_MOVE) return;
        // le holder a bougé / changé de taille => glisser-déposer ou redimensionnement, pas un toucher
        const r = holder.getBoundingClientRect();
        if (Math.abs(r.left - d.rx) > 2 || Math.abs(r.top - d.ry) > 2 || Math.abs(r.width - d.rw) > 2 || Math.abs(r.height - d.rh) > 2) return;
        if (Date.now() - lastShownAt < GRACE_MS) return;

        if (cfg.hideMode === 'single') {
            hideSticker();
            return;
        }
        if (lastTap && now - lastTap.t <= DOUBLE_TAP_MS && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) <= 40) {
            lastTap = null;
            hideSticker();
        } else {
            lastTap = { t: now, x: e.clientX, y: e.clientY };
        }
    }

    /* ---------------- surveillance de #expression-holder ---------------- */

    function markEntering(img) {
        if (!settings().animation) return;
        img.classList.remove(CLS_ENTER);
        void img.offsetWidth; // relance l'animation
        img.classList.add(CLS_ENTER);
        const clear = () => img.classList.remove(CLS_ENTER);
        img.addEventListener('animationend', clear, { once: true });
        setTimeout(clear, 800);
    }

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
        // On retire d'un clone tout ce qui viendrait d'un état précédent.
        newImage.classList.remove(CLS_HIDDEN);
        const k = keyOf(newImage);
        if (!k) return;
        lastShownAt = Date.now();
        // Nouveau sticker (autre image) : toujours l'afficher. Même image rechargée : l'état est conservé.
        if (hidden && k !== hiddenKey) showSticker();
        if (!hidden) markEntering(newImage);
        else placeRestore();
    }

    function attachObserver() {
        const holder = getHolder();
        if (!holder || holder === observedHolder) return;
        holderObserver?.disconnect();
        observedHolder = holder;
        holderObserver = new MutationObserver(onHolderMutation);
        holderObserver.observe(holder, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] });
        if (hidden) holder.classList.add(CLS_HIDDEN);
    }

    /* ---------------- panneau de réglages ---------------- */

    function mountSettings() {
        const $ = globalThis.jQuery;
        if (!$ || $('#stickerpop_settings').length) return;
        const host = $('#extensions_settings2').length ? $('#extensions_settings2') : $('#extensions_settings');
        if (!host.length) return;
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
        <label for="stickerpop_hideMode">Masquer le sticker avec</label>
        <select id="stickerpop_hideMode" class="text_pole" style="width:auto">
          <option value="double">un double toucher (recommandé)</option>
          <option value="single">un simple toucher</option>
          <option value="never">jamais : permanent, toujours affiché</option>
        </select>
      </div>
      <label class="checkbox_label"><input type="checkbox" id="stickerpop_animation"><span>Animation d'apparition</span></label>
      <small>Le sticker reste affiché tant que vous ne le masquez pas ; un nouveau sticker est toujours affiché. Un petit bouton 🖼 permet de réafficher un sticker masqué.</small>
    </div>
  </div>
</div>`);
        const s = settings();
        $('#stickerpop_enabled').prop('checked', !!s.enabled).on('change', function () {
            settings().enabled = this.checked;
            if (!this.checked) showSticker();
            saveSettings();
        });
        $('#stickerpop_hideMode').val(s.hideMode).on('change', function () {
            settings().hideMode = this.value;
            if (this.value === 'never') showSticker();
            saveSettings();
        });
        $('#stickerpop_animation').prop('checked', !!s.animation).on('change', function () {
            settings().animation = this.checked;
            saveSettings();
        });
    }

    /* ---------------- initialisation ---------------- */

    function start() {
        if (!document.body) return;
        settings();
        document.addEventListener('pointerdown', onPointerDown, { capture: true, passive: true });
        document.addEventListener('pointerup', onPointerUp, { capture: true, passive: true });
        document.addEventListener('pointercancel', () => { down = null; }, { capture: true, passive: true });
        window.addEventListener('resize', () => hidden && placeRestore());
        window.addEventListener('orientationchange', () => hidden && placeRestore());

        attachObserver();
        // #expression-holder est créé par l'extension Expressions, éventuellement après nous ; il peut être recréé.
        setInterval(() => { attachObserver(); mountSettings(); if (hidden) placeRestore(); }, 1000);
        mountSettings();

        try {
            const c = ctx();
            c?.eventSource?.on?.(c.eventTypes?.CHAT_CHANGED ?? 'chat_id_changed', () => showSticker());
        } catch (e) { console.warn(LOG, e); }
        console.debug(LOG, 'prêt');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start, { once: true });
    } else {
        start();
    }
})();
