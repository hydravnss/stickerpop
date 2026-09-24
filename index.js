(() => {
    'use strict';

    const IMAGE_SELECTOR = '#expression-image';

    let hiddenSticker = null;
    let hitbox = null;


    /* =========================================================
       CRÉE LA ZONE INVISIBLE EXACTEMENT SUR LE STICKER
       ========================================================= */

    function createHitbox(image) {

        removeHitbox();

        const rect = image.getBoundingClientRect();

        hitbox = document.createElement('div');

        hitbox.id = 'stickerpop-hitbox';

        Object.assign(hitbox.style, {
            position: 'fixed',
            left: `${rect.left}px`,
            top: `${rect.top}px`,
            width: `${rect.width}px`,
            height: `${rect.height}px`,

            zIndex: '2147483647',

            background: 'transparent',

            cursor: 'pointer',

            pointerEvents: 'auto',

            touchAction: 'manipulation'
        });


        hitbox.addEventListener('click', (event) => {

            event.preventDefault();
            event.stopPropagation();

            showSticker();

        });


        hitbox.addEventListener('touchend', (event) => {

            event.preventDefault();
            event.stopPropagation();

            showSticker();

        }, {
            passive: false
        });


        document.body.appendChild(hitbox);
    }


    /* =========================================================
       SUPPRIME LA ZONE INVISIBLE
       ========================================================= */

    function removeHitbox() {

        if (hitbox) {

            hitbox.remove();

            hitbox = null;
        }
    }


    /* =========================================================
       CACHE LE STICKER
       ========================================================= */

    function hideSticker(image) {

        if (!image) return;

        hiddenSticker = image;

        /*
         * On garde sa taille et sa position.
         * On le rend simplement invisible.
         */
        image.classList.add(
            'stickerpop-hidden'
        );

        /*
         * Crée la zone de clic exactement
         * à l'endroit du sticker.
         */
        createHitbox(image);
    }


    /* =========================================================
       FAIT RÉAPPARAÎTRE LE STICKER
       ========================================================= */

    function showSticker() {

        if (!hiddenSticker) return;

        hiddenSticker.classList.remove(
            'stickerpop-hidden'
        );

        removeHitbox();

        hiddenSticker = null;
    }


    /* =========================================================
       CLIC SUR LE STICKER
       ========================================================= */

    document.addEventListener(
        'click',
        (event) => {

            const image =
                event.target.closest?.(
                    IMAGE_SELECTOR
                );

            if (!image) return;

            /*
             * Si le sticker est visible :
             * on le cache.
             */
            if (
                !image.classList.contains(
                    'stickerpop-hidden'
                )
            ) {

                event.preventDefault();
                event.stopPropagation();

                hideSticker(image);
            }

        },
        true
    );


    /* =========================================================
       TOUCH IPHONE
       ========================================================= */

    document.addEventListener(
        'touchend',
        (event) => {

            const image =
                event.target.closest?.(
                    IMAGE_SELECTOR
                );

            if (!image) return;

            if (
                !image.classList.contains(
                    'stickerpop-hidden'
                )
            ) {

                event.preventDefault();
                event.stopPropagation();

                hideSticker(image);
            }

        },
        {
            capture: true,
            passive: false
        }
    );


    /* =========================================================
       SI SILLYTAVERN RECRÉE LE STICKER
       ========================================================= */

    const observer =
        new MutationObserver(() => {

            const image =
                document.querySelector(
                    IMAGE_SELECTOR
                );

            if (!image) return;

            image.style.pointerEvents =
                'auto';

        });


    function start() {

        if (!document.body) return;

        observer.observe(
            document.body,
            {
                childList: true,
                subtree: true
            }
        );
    }


    if (
        document.readyState ===
        'loading'
    ) {

        document.addEventListener(
            'DOMContentLoaded',
            start
        );

    } else {

        start();

    }

})();