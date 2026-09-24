(() => {
    'use strict';

    const IMAGE_SELECTOR = '#expression-image';
    const WRAPPER_SELECTOR = '#expression-wrapper';

    let hiddenSticker = null;
    let hiddenZone = null;

    /*
     * Récupère la zone exacte occupée par le sticker.
     */
    function getStickerZone(image) {
        const wrapper = image?.closest(WRAPPER_SELECTOR);

        if (!wrapper) return null;

        const rect = image.getBoundingClientRect();

        return {
            wrapper,
            left: rect.left,
            top: rect.top,
            right: rect.right,
            bottom: rect.bottom
        };
    }

    /*
     * Toggle du sticker :
     *
     * 1. Clic sur le sticker visible
     *    → il disparaît.
     *
     * 2. Clic exactement à l'endroit où se trouvait
     *    le sticker
     *    → il réapparaît.
     *
     * Les rebords du wrapper ne sont PAS cliquables.
     */
    document.addEventListener('click', (event) => {

        const image = event.target.closest?.(IMAGE_SELECTOR);

        /*
         * STICKER VISIBLE
         */
        if (image) {

            event.stopPropagation();

            hiddenSticker = image;

            hiddenZone = getStickerZone(image);

            image.classList.add(
                'stickerpop-hidden'
            );

            const wrapper =
                image.closest(
                    WRAPPER_SELECTOR
                );

            if (wrapper) {

                wrapper.classList.add(
                    'stickerpop-hidden'
                );

            }

            return;
        }


        /*
         * STICKER CACHÉ
         */
        if (
            !hiddenSticker ||
            !hiddenZone
        ) {
            return;
        }


        const x = event.clientX;
        const y = event.clientY;


        /*
         * On vérifie UNIQUEMENT la zone exacte
         * occupée par l'image.
         */
        const insideExactZone =
            x >= hiddenZone.left &&
            x <= hiddenZone.right &&
            y >= hiddenZone.top &&
            y <= hiddenZone.bottom;


        /*
         * Clic en dehors du sticker :
         * on ne fait absolument rien.
         */
        if (!insideExactZone) {
            return;
        }


        /*
         * Clic dans la zone exacte :
         * le sticker réapparaît.
         */
        hiddenSticker.classList.remove(
            'stickerpop-hidden'
        );

        if (hiddenZone.wrapper) {

            hiddenZone.wrapper.classList.remove(
                'stickerpop-hidden'
            );

        }


        hiddenSticker = null;
        hiddenZone = null;

    }, true);


    /*
     * Surveille SillyTavern lorsqu'il recrée
     * ou remplace le sticker.
     */
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