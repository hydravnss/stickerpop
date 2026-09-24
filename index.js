(() => {
    'use strict';

    const IMAGE_SELECTOR = '#expression-image';
    const HITBOX_ID = 'stickerpop-hitbox';

    let hidden = false;
    let hiddenRect = null;
    let currentImage = null;
    let hitbox = null;
    let observer = null;
    let suppressMutations = false;

    /* =========================================================
       RÉCUPÈRE LE STICKER
       ========================================================= */

    function getImage() {
        return document.querySelector(IMAGE_SELECTOR);
    }

    /* =========================================================
       CRÉE LA ZONE INVISIBLE DE RÉAPPARITION
       ========================================================= */

    function createHitbox() {
        if (hitbox && document.body.contains(hitbox)) {
            return hitbox;
        }

        hitbox = document.createElement('div');
        hitbox.id = HITBOX_ID;

        Object.assign(hitbox.style, {
            position: 'fixed',
            display: 'none',
            zIndex: '2147483647',
            pointerEvents: 'auto',
            background: 'transparent',
            margin: '0',
            padding: '0',
            border: '0',
            boxSizing: 'border-box',
            cursor: 'pointer',
            touchAction: 'manipulation'
        });

        document.body.appendChild(hitbox);

        hitbox.addEventListener('pointerup', (event) => {
            event.preventDefault();
            event.stopPropagation();

            if (!hidden) {
                return;
            }

            showSticker();
        }, true);

        return hitbox;
    }

    /* =========================================================
       POSITIONNE LA ZONE DE CLIC
       ========================================================= */

    function updateHitbox() {
        if (!hidden || !hiddenRect) {
            if (hitbox) {
                hitbox.style.display = 'none';
            }
            return;
        }

        const box = createHitbox();

        box.style.left = `${hiddenRect.left}px`;
        box.style.top = `${hiddenRect.top}px`;
        box.style.width = `${hiddenRect.right - hiddenRect.left}px`;
        box.style.height = `${hiddenRect.bottom - hiddenRect.top}px`;
        box.style.display = 'block';
    }

    /* =========================================================
       CACHE LE STICKER
       ========================================================= */

    function hideSticker(image) {
        if (!image || hidden) {
            return;
        }

        const rect = image.getBoundingClientRect();

        hiddenRect = {
            left: rect.left,
            top: rect.top,
            right: rect.right,
            bottom: rect.bottom
        };

        hidden = true;
        currentImage = image;

        suppressMutations = true;

        image.classList.add('stickerpop-hidden');

        suppressMutations = false;

        updateHitbox();
    }

    /* =========================================================
       RÉAFFICHE LE STICKER
       ========================================================= */

    function showSticker() {
        const image = getImage();

        suppressMutations = true;

        if (image) {
            image.classList.remove('stickerpop-hidden');
        }

        suppressMutations = false;

        hidden = false;
        hiddenRect = null;
        currentImage = null;

        if (hitbox) {
            hitbox.style.display = 'none';
        }
    }

    /* =========================================================
       CLIC DIRECT SUR LE STICKER
       ========================================================= */

    document.addEventListener(
        'pointerup',
        (event) => {
            const image = event.target.closest?.(IMAGE_SELECTOR);

            if (!image) {
                return;
            }

            if (hidden) {
                return;
            }

            event.preventDefault();
            event.stopPropagation();

            hideSticker(image);
        },
        true
    );

    /* =========================================================
       SURVEILLE SILLYTAVERN
       ========================================================= */

    observer = new MutationObserver((mutations) => {
        if (suppressMutations) {
            return;
        }

        const image = getImage();

        if (!image) {
            return;
        }

        /*
         * IMPORTANT :
         * On ne force PLUS "stickerpop-hidden" sur chaque mutation.
         * SillyTavern peut modifier/recréer le sticker normalement.
         */

        if (hidden) {
            /*
             * Si SillyTavern recrée complètement l'image,
             * on applique seulement l'état caché au nouvel élément.
             */
            if (image !== currentImage) {
                suppressMutations = true;

                image.classList.add('stickerpop-hidden');

                suppressMutations = false;

                currentImage = image;
            }

            /*
             * La zone de clic reste indépendante du sticker.
             */
            updateHitbox();
        }
    });

    /* =========================================================
       RESIZE / ORIENTATION / BARRE DE SAISIE
       ========================================================= */

    function refreshHiddenPosition() {
        if (!hidden) {
            return;
        }

        const image = getImage();

        if (!image) {
            return;
        }

        /*
         * Comme l'image est cachée, son rect peut être inutilisable.
         * On conserve donc la zone précédente sauf si ST la recrée.
         */

        updateHitbox();
    }

    window.addEventListener('resize', refreshHiddenPosition);

    window.addEventListener('orientationchange', refreshHiddenPosition);

    /* =========================================================
       QUAND LA BARRE DE SAISIE CHANGE
       ========================================================= */

    document.addEventListener(
        'focusin',
        () => {
            if (hidden) {
                updateHitbox();
            }
        },
        true
    );

    document.addEventListener(
        'focusout',
        () => {
            if (hidden) {
                updateHitbox();
            }
        },
        true
    );

    /* =========================================================
       INITIALISATION
       ========================================================= */

    function start() {
        if (!document.body) {
            return;
        }

        createHitbox();

        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: [
                'class',
                'style',
                'src'
            ]
        });

        const image = getImage();

        if (image) {
            image.style.pointerEvents = 'auto';
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start, {
            once: true
        });
    } else {
        start();
    }

})();