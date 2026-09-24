(() => {
    'use strict';

    const IMAGE_SELECTOR = '#expression-image';

    let hidden = false;
    let hiddenRect = null;
    let currentImage = null;


    /* =========================================================
       RÉCUPÈRE LE STICKER
       ========================================================= */

    function getImage() {
        return document.querySelector(IMAGE_SELECTOR);
    }


    /* =========================================================
       CACHE LE STICKER
       ========================================================= */

    function hideSticker(image) {

        if (!image) return;

        const rect = image.getBoundingClientRect();

        hiddenRect = {
            left: rect.left,
            top: rect.top,
            right: rect.right,
            bottom: rect.bottom
        };

        hidden = true;
        currentImage = image;

        image.classList.add(
            'stickerpop-hidden'
        );
    }


    /* =========================================================
       RÉAFFICHE LE STICKER
       ========================================================= */

    function showSticker() {

        const image = getImage();

        if (image) {

            image.classList.remove(
                'stickerpop-hidden'
            );

        }

        hidden = false;
        hiddenRect = null;
        currentImage = null;
    }


    /* =========================================================
       TESTE SI LE CLIC EST DANS L'ANCIENNE ZONE DU STICKER
       ========================================================= */

    function isInsideSticker(x, y) {

        if (!hiddenRect) return false;

        return (
            x >= hiddenRect.left &&
            x <= hiddenRect.right &&
            y >= hiddenRect.top &&
            y <= hiddenRect.bottom
        );
    }


    /* =========================================================
       CLIC / TOUCH
       ========================================================= */

    document.addEventListener(
        'pointerup',
        (event) => {

            const image =
                event.target.closest?.(
                    IMAGE_SELECTOR
                );


            /*
             * STICKER VISIBLE
             * → clic dessus = disparition
             */
            if (
                image &&
                !hidden
            ) {

                event.stopPropagation();

                hideSticker(image);

                return;
            }


            /*
             * STICKER CACHÉ
             * → uniquement la zone exacte
             *   où il se trouvait = apparition
             */
            if (
                hidden &&
                hiddenRect &&
                isInsideSticker(
                    event.clientX,
                    event.clientY
                )
            ) {

                showSticker();

            }

        },
        true
    );


    /* =========================================================
       SURVEILLE LES MODIFICATIONS DE SILLYTAVERN
       ========================================================= */

    const observer =
        new MutationObserver(() => {

            const image = getImage();

            if (!image) return;


            /*
             * SillyTavern peut recréer #expression-image
             * lorsqu'on ouvre la barre de saisie.
             *
             * Si le sticker était caché avant la modification,
             * on cache également le nouveau sticker.
             */
            if (hidden) {

                image.classList.add(
                    'stickerpop-hidden'
                );

                currentImage = image;
            }


            image.style.pointerEvents =
                hidden
                    ? 'none'
                    : 'auto';
        });


    /* =========================================================
       RESIZE / BARRE DE SAISIE
       ========================================================= */

    /*
     * Quand la barre de saisie s'ouvre ou se ferme,
     * SillyTavern peut déplacer le sticker.
     *
     * On recalcule sa position uniquement s'il est caché.
     */
    window.addEventListener(
        'resize',
        () => {

            if (!hidden) return;

            const image = getImage();

            if (!image) return;

            const rect =
                image.getBoundingClientRect();

            hiddenRect = {
                left: rect.left,
                top: rect.top,
                right: rect.right,
                bottom: rect.bottom
            };
        }
    );


    /* =========================================================
       INITIALISATION
       ========================================================= */

    function start() {

        if (!document.body) return;

        observer.observe(
            document.body,
            {
                childList: true,
                subtree: true
            }
        );

        const image = getImage();

        if (image) {

            image.style.pointerEvents =
                'auto';
        }
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