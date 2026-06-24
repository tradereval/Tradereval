const SPLASH_MS = 3200;

export function runSplash() {
  const splash = document.getElementById("splash");
  if (!splash) return Promise.resolve();

  return new Promise((resolve) => {
    const finish = () => {
      splash.classList.add("splash-exit");
      splash.addEventListener(
        "transitionend",
        () => {
          splash.remove();
          resolve();
        },
        { once: true }
      );
      setTimeout(() => {
        if (splash.isConnected) {
          splash.remove();
          resolve();
        }
      }, 700);
    };

    splash.querySelector(".splash-skip")?.addEventListener("click", finish);

    requestAnimationFrame(() => {
      splash.classList.add("splash-active");
    });

    setTimeout(finish, SPLASH_MS);
  });
}
