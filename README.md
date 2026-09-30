# StickerPop
Extension SillyTavern : affiche le sprite des Character Expressions (#expression-holder) comme un sticker.

## Utilisation (v1.1.0)
- **Un seul toucher** sur le sticker le fait **disparaître** ; un toucher **à l'endroit où il se trouvait** le fait **réapparaître**
  (zone transparente de la taille exacte du sticker, active uniquement tant qu'il est masqué).
- Un **nouveau sticker** (changement d'expression) est toujours affiché, même si le précédent était masqué.
- Un glisser-déposer ou un redimensionnement du sticker n'est jamais pris pour un toucher.
- Aucun minuteur : le sticker reste affiché tant que vous ne le masquez pas.

## Réglages (Extensions > StickerPop)
- Mode : simple toucher (défaut), double toucher, ou jamais (permanent).
- Bouton 🖼 facultatif pour réafficher (désactivé par défaut).
- **Animation d'apparition** et **Animation de disparition** (boutons « Tester » pour un aperçu en direct) : Aucune, Fondu,
  Zoom (pop), Rebond, Glissement depuis le bas / le haut / la gauche / la droite, Rotation, Flip 3D, Secousse,
  Ballon (gonflement + balancement), Étincelle / Flou, Élastique, Tourbillon (rotation + zoom), Rétrécir vers un coin.
- **Durée** de 100 à 2000 ms (350 par défaut) et **courbe** : douce (ease), décélération (ease-out), rebond (cubic-bezier), linéaire.
- Option pour animer (ou non) l'arrivée d'un nouveau sticker.

## Compatibilité avec le CSS personnalisé
Les animations sont appliquées en style inline `!important` sur `#expression-holder` (l'élément stable que SillyTavern ne remplace pas),
et la feuille de style de l'extension est réinjectée en dernier avec une spécificité élevée : un CSS perso qui force
`opacity`, `transform` ou `transition` en `!important` sur `#expression-holder` / `#expression-image` ne bloque pas l'animation.
À la fin de chaque animation, les styles inline sont retirés (ou, pour un sticker masqué, remplacés par l'état masqué final) :
le sticker ne reste jamais à moitié transparent.

## Mise à jour depuis 1.0.x
Les réglages existants sont conservés et complétés par les valeurs par défaut. Le mode « double toucher » (défaut de la 1.0.1)
repasse en « simple toucher », le comportement d'origine.
