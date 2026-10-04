# StickerPop
Extension SillyTavern : affiche le sprite des Character Expressions (#expression-holder) comme un sticker, que l'on peut **placer où l'on veut** et **redimensionner**.

## Utilisation (v1.2.2)
- **Un seul toucher** sur le sticker le fait **disparaître** ; un toucher **à l'endroit où il se trouvait** le fait **réapparaître**
  (zone transparente de la taille exacte du sticker, active uniquement tant qu'il est masqué). Ça marche à n'importe quelle position et taille.
- Un **nouveau sticker** (changement d'expression) est toujours affiché, même si le précédent était masqué.
- Aucun minuteur : le sticker reste affiché tant que vous ne le masquez pas.

## Correctif 1.2.2 : « les stickers n'apparaissent plus »
Si, après la mise à jour en 1.2.1, plus aucun sticker ne s'affichait : le masquage du cadre vide reposait sur `display:none` (dans la feuille de style **et** dans
l'extension) et sur une détection fragile de l'image (« chargée ? »), avec des vérifications qui pouvaient s'arrêter après une erreur. Un cadre pouvait donc rester masqué alors que l'image existait.
Depuis 1.2.2 :
- le masquage du cadre vide est **purement cosmétique** (plus de `display:none` : le holder reste dans la page, `visibility:hidden`, bordure / fond / ombre retirés) ;
- le cadre n'est « vide » que s'il n'y a **aucun `src`** ou si l'image a **réellement échoué** (erreur / chargée avec `naturalWidth = 0`). Une image en cours de chargement n'est **jamais** masquée ;
- **sécurité** : dès qu'une image a un `src` valide et `naturalWidth > 0`, le sticker est forcé visible ;
- réévaluation à chaque `load` / `error` / changement de `src` / de classe / de style, aux événements SillyTavern (changement de chat, message reçu / rendu, swipe, sélection de personnage…), au retour au premier plan, plus un contrôle toutes les 500 ms ; chaque étape est isolée (une erreur laisse le cadre **visible**) ;
- nouveau réglage **« Désactiver le masquage automatique »** (mode sécurité) : coupe tout masquage automatique (cadre vide **et** compteur de swipes). À cocher en cas de souci.

## Cadre vide et compteur de swipes (1.2.1, adapté en 1.2.2)
Sur iPhone avec un thème qui dessine un cadre (bordure fine claire, fond semi-transparent), deux rectangles gênants pouvaient rester à l'écran sans sticker.
Ce sont **deux éléments différents** :

1. **Le cadre du sticker** (`#expression-holder`, 100 × 100 px minimum même sans image) : quand aucune image n'est affichable
   (pas de `src`, image en échec / 404, personnage sans sprite), il est **rendu invisible** (depuis 1.2.2 : `visibility: hidden`, sans `display: none` ; bordure / fond / ombre / contour retirés,
   plus aucun toucher) et **réapparaît tout seul** dès qu'une image est chargée (avec l'animation d'apparition). Marche en mode thème comme en position
   personnalisée. Quand vous masquez le sticker d'un toucher, le holder est aussi débarrassé de tout cadre ; la zone transparente pour le réafficher
   fonctionne comme avant (elle est retirée si le personnage change pour un personnage sans sprite).
   Réglage : **« Masquer le cadre quand il n'y a pas de sticker »** (activé par défaut).
2. **Le bloc « > 1/1 »** en bas à droite du dernier message (`.swipeRightBlock` = flèche `.swipe_right` + compteur `.swipes-counter`) : il n'appartient **pas**
   aux Expressions mais à SillyTavern, et s'affiche pour tout message de personnage avec un seul swipe (le thème lui ajoute bordure et fond). Deux options :
   - **« Masquer le compteur de swipes 1/1 / flèche quand il n'y a qu'un seul swipe »** (activé par défaut) : masqué seulement quand le message n'a qu'un swipe ;
     dès qu'il y en a 2 ou plus, flèches et compteur « 1/2 » réapparaissent.
   - **« Masquer toujours le compteur de swipes et les flèches »** (désactivé par défaut).
   Ces éléments sont seulement masqués (le message n'est pas modifié) : tant qu'ils le sont, la flèche et l'appui sur le compteur (historique des swipes) ne sont plus accessibles ; décochez l'option pour les retrouver.

## Position et taille libres (1.2.0)
Dans **Extensions > StickerPop > Position et taille du sticker** :

1. Cochez **Utiliser une position et une taille personnalisées**. Au premier passage, le sticker reste exactement où il est (aucun saut) ;
   décochez pour revenir à l'emplacement défini par votre thème / CSS (comportement des versions précédentes).
2. **Horizontal / Vertical** : curseurs de 0 à 100 % (précision 0,1 %) avec champ % et champ **px**. 0 % = collé au bord gauche / haut,
   100 % = collé au bord droit / bas : le sticker ne sort donc jamais de l'écran. Le réglage est enregistré **en %**, il s'adapte à tous les écrans
   (portrait, paysage, iPad…) et respecte la zone de sécurité de l'iPhone (encoche, barre d'accueil).
3. **Positions prédéfinies** : 4 coins, 4 milieux de bord et centre de l'écran.
4. **✋ Déplacer** : le panneau se masque et le sticker s'entoure d'un cadre en pointillés.
   - **Glissez** avec le doigt : le sticker va n'importe où sur l'écran (borné à l'écran, zone de sécurité comprise). Un appui de moins de 3 px ne déplace rien
     et un toucher ne masque pas le sticker pendant ce mode.
   - **Pincez à deux doigts** (le second doigt peut se poser n'importe où) pour changer la taille ; le centre du sticker suit vos doigts.
   - **Poignée ronde** au coin bas-droit (option) : tirez-la pour redimensionner, le coin haut-gauche reste fixe.
   - Molette de souris sur ordinateur, **Échap** ou **✓ Terminer** pour finir.
5. **Taille** : largeur en % de l'écran (5 à 100 %, soit 40 à 1200 px) avec champ px. Le **ratio de l'image est toujours conservé**.
   **Hauteur maximale** (garde-fou, 20 à 100 % de l'écran) : si le sticker est trop haut, il est réduit proportionnellement.
6. **Rotation** (-180° à 180°), **miroir** horizontal / vertical, **opacité** (10 à 100 %).
7. **Calque** : *devant le chat* (par défaut) ou *derrière le chat*. Devant, le sticker passe au-dessus du chat et de la barre d'envoi mais reste sous les menus et fenêtres de SillyTavern.
8. **Mémoriser par personnage** (facultatif) : position et taille sont alors retenues pour chaque personnage (dossier de sprites), sinon le réglage est global.
9. **↺ Réinitialiser** : désactive la position personnalisée et remet tous les réglages de position / taille / rotation / miroir / opacité / calque aux valeurs par défaut
   (le sticker retrouve l'emplacement de votre thème).

Astuce : pendant que vous tenez un curseur du panneau, celui-ci devient presque transparent pour que vous voyiez le sticker bouger derrière.

### Pourquoi le sticker ne bouge-t-il plus avec le thème ?
En position personnalisée, `#expression-holder` est déplacé directement dans `<body>` et placé en `position: fixed !important` : un wrapper du thème avec un `transform`
(par exemple `#tjxv3p { transform: translateY(-12px) }`) ne le décale plus, et un CSS perso qui force `right`, `bottom`, `transform`, `margin`… sur le sticker est neutralisé.
Si le mode « Visual Novel » de SillyTavern est activé, le sticker déplacé est masqué comme l'était l'original. La poignée de déplacement native de SillyTavern est masquée en mode personnalisé (utilisez « Déplacer »).

## Réglages (Extensions > StickerPop)
- Mode : simple toucher (défaut), double toucher, ou jamais (permanent).
- Bouton 🖼 facultatif pour réafficher (désactivé par défaut).
- **Animation d'apparition** et **Animation de disparition** (boutons « Tester » pour un aperçu en direct) : Aucune, Fondu,
  Zoom (pop), Rebond, Glissement depuis le bas / le haut / la gauche / la droite, Rotation, Flip 3D, Secousse,
  Ballon (gonflement + balancement), Étincelle / Flou, Élastique, Tourbillon (rotation + zoom), Rétrécir vers un coin.
- **Durée** de 100 à 2000 ms (350 par défaut) et **courbe** : douce (ease), décélération (ease-out), rebond (cubic-bezier), linéaire.
- Option pour animer (ou non) l'arrivée d'un nouveau sticker.

## Compatibilité avec le CSS personnalisé
Les animations sont appliquées en style inline `!important` sur `#expression-holder`, et la feuille de style de l'extension est réinjectée en dernier avec une spécificité élevée :
un CSS perso qui force `opacity`, `transform` ou `transition` en `!important` sur `#expression-holder` / `#expression-image` ne bloque pas l'animation.
À la fin de chaque animation, les styles inline d'animation sont retirés (ou, pour un sticker masqué, remplacés par l'état masqué final) : le sticker ne reste jamais à moitié transparent.

## Mise à jour
- **depuis 1.2.1** : aucun réglage à migrer ; `disableAutoHide` (false) est ajouté. Si les stickers avaient disparu, la mise à jour suffit ; sinon cochez « Désactiver le masquage automatique » et rechargez la page.
- **depuis 1.2.0** : aucun réglage à migrer ; `hideEmptyFrame` (true), `hideSwipe1` (true) et `hideSwipeAlways` (false) sont ajoutés avec leurs valeurs par défaut.
  Pour retrouver exactement le comportement 1.2.0, décochez les deux premières options.
- **depuis 1.1.0** : tous les réglages existants sont conservés ; la position personnalisée est **désactivée** par défaut, le sticker ne bouge donc pas tant que vous ne l'activez pas.
  Les nouveaux réglages (clés `placeEnabled`, `posX`, `posY`, `sizePct`, `maxHeightPct`, `rotation`, `flipH`, `flipV`, `opacity`, `layer`, `showHandle`, `perCharacter`, `positions`)
  sont enregistrés dans `extension_settings.stickerpop`, avec valeurs invalides ramenées à leurs bornes / défauts.
- **depuis 1.0.x** : le mode « double toucher » (défaut de la 1.0.1) repasse en « simple toucher », le comportement d'origine.
