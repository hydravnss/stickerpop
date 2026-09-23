(() => {
    'use strict';

    const IMAGE_SELECTOR = '#expression-image';
    const WRAPPER_SELECTOR = '#expression-wrapper';

    let currentImage = null;
    let currentWrapper = null;

    function setupSticker() {
        const image = document.querySelector(IMAGE_SELECTOR);
        const wrapper = document.querySelector(WRAPPER_SELECTOR);

        if (!image || !wrapper) return;

        /*
         * Nouveau sticker détecté :
         * on réinitialise son état.
         */
        if (image !== currentImage) {
            currentImage = image;
            currentWrapper = wrapper;

            image.classList.remove('stickerpop-hidden');
            wrapper.classList.remove('stickerpop-hidden');

            setupClickEvents(image, wrapper);
        }
    }

    function setupClickEvents(image, wrapper) {

        if (image.dataset.stickerpopReady === 'true') {
            return;
        }

        image.dataset.stickerpopReady = 'true';

        /*
         * Clic directement sur le sticker
         * → disparition
         */
        image.addEventListener('click', (event) => {

            event.stopPropagation();

            image.classList.add('stickerpop-hidden');
            wrapper.classList.add('stickerpop-hidden');

        });

        /*
         * Clic sur la zone où se trouvait le sticker
         * → réapparition
         */
        wrapper.addEventListener('click', () => {

            if (
                image.classList.contains(
                    'stickerpop-hidden'
                )
            ) {

                image.classList.remove(
                    'stickerpop-hidden'
                );

                wrapper.classList.remove(
                    'stickerpop-hidden'
                );

            }

        });
    }

    /*
     * Surveille les changements de sticker
     * effectués par SillyTavern.
     */
    function startObserver() {

        const wrapper =
            document.querySelector(
                WRAPPER_SELECTOR
            );

        if (!wrapper) {
            setTimeout(startObserver, 500);
            return;
        }

        const observer =
            new MutationObserver(() => {
                setupSticker();
            });

        observer.observe(wrapper, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: [
                'src',
                'class'
            ]
        });

        setupSticker();
    }

    /*
     * Attend que SillyTavern ait chargé
     * son interface.
     */
    function init() {
        startObserver();
    }

    if (
        document.readyState === 'loading'
    ) {

        document.addEventListener(
            'DOMContentLoaded',
            init
        );

    } else {

        init();

    }

})();