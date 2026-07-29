/**
 * src/utils/logoAnimation.js
 * Logo absorption animation on the join screen.
 */

const ENTRANCE_DELAY      = 1500;
const ABSORPTION_DURATION = 2200;
const LOOP_INTERVAL       = 8000;

export function initLogoAbsorption(container) {
  let absorptionTimeout = null;
  let loopInterval      = null;

  function triggerAbsorption() {
    const splash = container.querySelector(".splash");
    if (!splash) return;
    const joinScreen = container.querySelector("#join-screen");
    if (joinScreen && joinScreen.style.display === "none") return;
    splash.classList.add("absorbing");
    absorptionTimeout = setTimeout(() => splash.classList.remove("absorbing"), ABSORPTION_DURATION + 50);
  }

  setTimeout(() => {
    triggerAbsorption();
    loopInterval = setInterval(triggerAbsorption, LOOP_INTERVAL);
  }, ENTRANCE_DELAY);

  return function cleanup() {
    clearTimeout(absorptionTimeout);
    clearInterval(loopInterval);
  };
}
