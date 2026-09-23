(() => {
    'use strict';

    const IMAGE_SELECTOR = '#expression-image';
    const WRAPPER_SELECTOR = '#expression-wrapper';

    let hiddenSticker = null;

    /*
     * Clic global.
     * Fonctionne même si SillyTavern recrée le sticker.
     */
    document.addEventListener('click', (event) => {

        const image = event.target.closest(IMAGE_SELECTOR);

        /*
         * Clic sur le sticker
         * → on le cache
         */
        if (image) {

            event.stopPropagation();

            hiddenSticker = image;

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
         * Si le sticker est caché,
         * clic dans sa zone → réapparition
         */
        if (hiddenSticker) {

            const wrapper =
                hiddenSticker.closest(
                    WRAPPER_SELECTOR
                );

            if (
                wrapper &&
                wrapper.contains(event.target)
            ) {

                hiddenSticker.classList.remove(
                    'stickerpop-hidden'
                );

                wrapper.classList.remove(
                    'stickerpop-hidden'
                );

                hiddenSticker = null;

            }

        }

    }, true);


    /*
     * Surveille l'apparition de nouveaux stickers.
     */
    const observer =
        new MutationObserver(() => {

            const image =
                document.querySelector(
                    IMAGE_SELECTOR
                );

            if (!image) return;

            /*
             * Nouveau sticker :
             * on s'assure qu'il n'est pas caché.
             */
            if (
                !image.classList.contains(
                    'stickerpop-hidden'
                )
            ) {

                image.style.pointerEvents =
                    'auto';

            }

        });


    function start() {

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