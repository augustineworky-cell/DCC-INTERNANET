/* =========================================================
   DCC — DYNAMIC LIQUID GLASS CURSOR EFFECT
   Works for cards created after page load too
   ========================================================= */

(function () {

  var selector =
    '.metric, .link-card, .quote-card, .map-card, .feat';

  document.addEventListener('mousemove', function (event) {

    var card = event.target.closest(selector);

    if (!card) return;

    var rect = card.getBoundingClientRect();

    var x = ((event.clientX - rect.left) / rect.width) * 100;
    var y = ((event.clientY - rect.top) / rect.height) * 100;

    card.style.setProperty('--mouse-x', x + '%');
    card.style.setProperty('--mouse-y', y + '%');

  });

})();