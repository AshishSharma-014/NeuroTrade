
'use strict';

// ─── Register GSAP plugins ────────────────────────────────────
gsap.registerPlugin(ScrollTrigger, TextPlugin);

// ─── Custom cursor ────────────────────────────────────────────
const cursor = document.getElementById('cursor');
const cursorRing = document.getElementById('cursor-ring');
let mouseX = 0, mouseY = 0;
let ringX = 0, ringY = 0;

document.addEventListener('mousemove', e => {
    mouseX = e.clientX; mouseY = e.clientY;
    gsap.to(cursor, { x: mouseX, y: mouseY, duration: 0.05, ease: 'none' });
});

// Cursor ring follows with lag
function animateRing() {
    ringX += (mouseX - ringX) * 0.12;
    ringY += (mouseY - ringY) * 0.12;
    gsap.set(cursorRing, { x: ringX, y: ringY });
    requestAnimationFrame(animateRing);
}
animateRing();

// ─── Navbar scroll effect ─────────────────────────────────────
const navbar = document.getElementById('navbar');
ScrollTrigger.create({
    start: 'top -80',
    onUpdate: self => navbar.classList.toggle('scrolled', self.scroll() > 80),
});

// ─── Hero badge entrance ──────────────────────────────────────
gsap.to('#hero-badge', {
    opacity: 1, y: 0,
    duration: .8, delay: .2, ease: 'power3.out',
    from: { y: 20 },
});
gsap.from('#hero-badge', { y: 20 });

// ─── Hero headline — character-by-character reveal ───────────
function splitAndAnimate(selector, delay = 0.5) {
    const el = document.querySelector(selector);
    if (!el) return;

    // Wrap each character in a span
    el.querySelectorAll('span').forEach(span => {
        const text = span.textContent;
        let html = '';
        for (const char of text) {
            html += char === ' '
                ? ' '
                : `<span class="char" style="display:inline-block;">${char}</span>`;
        }
        span.innerHTML = html;
    });

    const chars = el.querySelectorAll('.char');
    gsap.to(chars, {
        opacity: 1,
        y: 0,
        duration: .05,
        stagger: 0.028,
        delay,
        ease: 'power2.out',
    });
}

splitAndAnimate('#hero-h1', 0.6);

// ─── Hero sub, CTAs, trust ────────────────────────────────────
const heroTl = gsap.timeline({ delay: 1.2 });
heroTl
    .to('#hero-sub', { opacity: 1, y: 0, duration: .7, ease: 'power3.out' }, 0)
    .to('#hero-ctas', { opacity: 1, y: 0, duration: .6, ease: 'power3.out' }, .2)
    .to('#hero-trust', { opacity: 1, y: 0, duration: .5, ease: 'power3.out' }, .4);

gsap.set(['#hero-sub', '#hero-ctas', '#hero-trust'], { y: 24 });

// ─── Hero visual — 3D float entrance ─────────────────────────
gsap.fromTo('#hero-visual', {
    opacity: 0, y: 60, rotateX: 12, rotateY: -4,
}, {
    opacity: 1, y: 0, rotateX: 0, rotateY: 0,
    duration: 1.4, delay: 1.0, ease: 'power3.out',
});

// ─── SVG chart line draw ──────────────────────────────────────
gsap.to('#chart-line', {
    strokeDashoffset: 0,
    duration: 2.2, delay: 1.6, ease: 'power2.inOut',
});

// ─── Floating animation for hero visual (infinite) ───────────
gsap.to('#hero-visual', {
    y: -16,
    duration: 3.5,
    repeat: -1,
    yoyo: true,
    ease: 'sine.inOut',
    delay: 2.4,
});

// ─── Stat pills float with offset ────────────────────────────
gsap.to('#pill-1', { y: -10, duration: 3.2, repeat: -1, yoyo: true, ease: 'sine.inOut', delay: 2.6 });
gsap.to('#pill-2', { y: 12, duration: 2.8, repeat: -1, yoyo: true, ease: 'sine.inOut', delay: 2.9 });
gsap.to('#pill-3', { y: -8, duration: 3.8, repeat: -1, yoyo: true, ease: 'sine.inOut', delay: 3.1 });

// ─── Magnetic CTA button ──────────────────────────────────────
function makeMagnetic(btnId) {
    const btn = document.getElementById(btnId);
    if (!btn) return;

    btn.addEventListener('mousemove', e => {
        const rect = btn.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = e.clientX - cx;
        const dy = e.clientY - cy;
        const strength = 0.35;
        gsap.to(btn, { x: dx * strength, y: dy * strength, duration: .3, ease: 'power2.out' });
    });
    btn.addEventListener('mouseleave', () => {
        gsap.to(btn, { x: 0, y: 0, duration: .5, ease: 'elastic.out(1,.4)' });
    });

    // Ripple on click
    btn.addEventListener('click', e => {
        const rect = btn.getBoundingClientRect();
        const ripple = document.createElement('span');
        ripple.className = 'btn-ripple';
        const size = Math.max(rect.width, rect.height);
        ripple.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - rect.left - size / 2}px;top:${e.clientY - rect.top - size / 2}px;`;
        btn.appendChild(ripple);
        setTimeout(() => ripple.remove(), 700);
    });
}

makeMagnetic('main-cta');
makeMagnetic('nav-cta');
makeMagnetic('cta-main');

// ─── Logos row scroll reveal ──────────────────────────────────
gsap.to('#logos-row .logo-pill', {
    opacity: 1, y: 0,
    duration: .5, stagger: .08, ease: 'power2.out',
    scrollTrigger: { trigger: '#proof', start: 'top 80%' },
});
gsap.set('#logos-row .logo-pill', { y: 16 });

// ─── Stats section — count up ────────────────────────────────
const stats = [
    { id: 'stat-1', target: 2400, suffix: '+', prefix: '' },
    { id: 'stat-2', target: 100, suffix: '×', prefix: '' },
    { id: 'stat-3', target: 48200, suffix: '+', prefix: '' },
    { id: 'stat-4', target: 50, suffix: '+', prefix: '' },
];

gsap.to('#stats-grid .stat-block', {
    opacity: 1, y: 0,
    duration: .6, stagger: .12, ease: 'power3.out',
    scrollTrigger: { trigger: '#stats', start: 'top 75%' },
    onStart() {
        stats.forEach(s => {
            const el = document.getElementById(s.id);
            if (!el) return;
            const obj = { val: 0 };
            gsap.to(obj, {
                val: s.target, duration: 2, ease: 'power2.out',
                onUpdate() {
                    el.textContent = s.prefix + Math.round(obj.val).toLocaleString('en-IN') + s.suffix;
                },
            });
        });
    },
});
gsap.set('#stats-grid .stat-block', { y: 30 });

// ─── Trial by fire — sticky pin + card reveals ────────────────
const trialSection = document.getElementById('trial');
const trialSticky = document.getElementById('trial-sticky');


// Animate each feature card on scroll
// Animate each feature card on scroll
const featureCards = ['#fc-1', '#fc-2', '#fc-3'];
featureCards.forEach((sel, i) => {
    gsap.from(sel, {
        opacity: 0, y: 60,
        duration: .7, ease: 'power3.out',
        scrollTrigger: { trigger: sel, start: 'top 80%', toggleActions: 'play none none reverse' },
    });

    // Update sidebar progress indicator
    ScrollTrigger.create({
        trigger: sel,
        start: 'top 50%',
        end: 'bottom 50%',
        onEnter() { activateTrialStep(i + 1); },
        onLeave() { deactivateTrialStep(i + 1); },
        onEnterBack() { activateTrialStep(i + 1); },
        onLeaveBack() { deactivateTrialStep(i + 1); },
    });
});

function activateTrialStep(n) {
    const el = document.getElementById(`tp-${n}`);
    const dot = el?.querySelector('.tp-dot');
    if (!el || !dot) return;
    el.style.color = 'var(--text)';
    dot.style.background = 'var(--up)';
    dot.style.boxShadow = '0 0 8px var(--up)';
}
function deactivateTrialStep(n) {
    const el = document.getElementById(`tp-${n}`);
    const dot = el?.querySelector('.tp-dot');
    if (!el || !dot) return;
    el.style.color = 'var(--muted)';
    dot.style.background = 'var(--border)';
    dot.style.boxShadow = 'none';
}

// ─── Discipline section animations ───────────────────────────
// Text columns slide in
gsap.fromTo('#disc-text', { opacity: 0, x: -50 }, {
    opacity: 1, x: 0, duration: 1, ease: 'power3.out',
    scrollTrigger: { trigger: '#discipline', start: 'top 70%' },
});

gsap.fromTo('#disc-ring', { opacity: 0, x: 50 }, {
    opacity: 1, x: 0, duration: 1, delay: .15, ease: 'power3.out',
    scrollTrigger: { trigger: '#discipline', start: 'top 70%' },
});

// Metric rows stagger
gsap.to(['#m1', '#m2', '#m3', '#m4', '#m5'], {
    opacity: 1, x: 0,
    duration: .5, stagger: .1, ease: 'power2.out',
    scrollTrigger: { trigger: '#metrics-list', start: 'top 80%' },
});
gsap.set(['#m1', '#m2', '#m3', '#m4', '#m5'], { x: -20 });

// Discipline score ring + progress bar animate on scroll
ScrollTrigger.create({
    trigger: '#disc-ring',
    start: 'top 75%',
    once: true,
    onEnter() {
        const TARGET_SCORE = 92;
        const CIRCUMFERENCE = 2 * Math.PI * 96; // 603.19
        const fillEl = document.getElementById('ring-fill');
        const pctEl = document.getElementById('ring-pct');
        const progressBar = document.getElementById('progress-bar');
        const progressPct = document.getElementById('progress-pct');

        const obj = { score: 0, pct: 0 };
        gsap.to(obj, {
            score: TARGET_SCORE,
            pct: TARGET_SCORE,
            duration: 2.2,
            ease: 'power3.out',
            onUpdate() {
                const offset = CIRCUMFERENCE - (obj.score / 100) * CIRCUMFERENCE;
                fillEl.style.strokeDashoffset = offset;
                pctEl.textContent = Math.round(obj.score);

                const barPct = Math.round(obj.pct);
                progressBar.style.width = barPct + '%';
                progressPct.textContent = barPct + '%';
            },
        });
    },
});

// ─── Final CTA section ────────────────────────────────────────
const ctaTl = gsap.timeline({
    scrollTrigger: { trigger: '#cta-banner', start: 'top 70%' },
});
gsap.set(['#cta-h', '#cta-p', '#cta-btn-wrap', '#cta-fine'], { y: 30 });

ctaTl
    .to('#cta-h', { opacity: 1, y: 0, duration: .8, ease: 'power3.out' })
    .to('#cta-p', { opacity: 1, y: 0, duration: .6, ease: 'power3.out' }, .2)
    .to('#cta-btn-wrap', { opacity: 1, y: 0, duration: .6, ease: 'power3.out' }, .35)
    .to('#cta-fine', { opacity: 1, y: 0, duration: .5, ease: 'power3.out' }, .5);

// ─── Subtle parallax on hero visual ──────────────────────────
gsap.to('#hero-visual', {
    yPercent: -12,
    ease: 'none',
    scrollTrigger: { trigger: '#hero', start: 'top top', end: 'bottom top', scrub: true },
});

// ─── Refresh ScrollTrigger on load ───────────────────────────
window.addEventListener('load', () => ScrollTrigger.refresh());
