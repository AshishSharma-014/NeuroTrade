// ─── Custom cursor ────────────────────────────────────────────
    const cursor = document.getElementById('cursor');
    const cursorRing = document.getElementById('cursor-ring');
    let mouseX = 0, mouseY = 0, ringX = 0, ringY = 0;

    document.addEventListener('mousemove', e => {
      mouseX = e.clientX; mouseY = e.clientY;
      gsap.to(cursor, { x: mouseX, y: mouseY, duration: 0.05, ease: 'none' });
    });

    function animateRing() {
      ringX += (mouseX - ringX) * 0.12;
      ringY += (mouseY - ringY) * 0.12;
      gsap.set(cursorRing, { x: ringX, y: ringY });
      requestAnimationFrame(animateRing);
    }
    animateRing();

    // ─── Entrance Animation ───────────────────────────────────────
    gsap.to('#authWrapper', {
      opacity: 1, y: 0,
      duration: 1, ease: 'power3.out', delay: 0.2
    });

    // ─── Form Switching Logic (GSAP Crossfade) ────────────────────
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');

    function toggleAuth(target) {
      if (target === 'signup') {
        gsap.to(loginForm, { opacity: 0, y: -20, duration: 0.3, onComplete: () => {
          loginForm.style.display = 'none';
          signupForm.style.display = 'flex';
          gsap.fromTo(signupForm, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' });
        }});
      } else {
        gsap.to(signupForm, { opacity: 0, y: 20, duration: 0.3, onComplete: () => {
          signupForm.style.display = 'none';
          loginForm.style.display = 'flex';
          gsap.fromTo(loginForm, { opacity: 0, y: -20 }, { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' });
        }});
      }
    }

    // ─── Experience Pill Selector ─────────────────────────────────
    function setExp(element) {
      document.querySelectorAll('.exp-pill').forEach(el => el.classList.remove('active'));
      element.classList.add('active');
    }
    function login() {
  const username = document.getElementById("loginId").value;
  const password = document.getElementById("loginPass").value;
  const btn = document.getElementById("loginBtn");

  // Demo credentials (you can change)
  const correctUser = "ashish";
  const correctPass = "1234";

  if (username === correctUser && password === correctPass) {

    // Store login
    localStorage.setItem("isLoggedIn", "true");
    localStorage.setItem("username", username);

    // Redirect
    window.location.href = "index.html";

  } else {
    // ❌ WRONG PASSWORD ANIMATION

    // Turn red
    btn.style.background = "#f6465d";

    // Shake animation using GSAP
    gsap.fromTo(btn,
      { x: -5 },
      {
        x: 5,
        duration: 0.05,
        repeat: 6,
        yoyo: true,
        onComplete: () => {
          btn.style.background = ""; // reset color
        }
      }
    );
  }
}