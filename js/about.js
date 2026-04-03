// GSAP animations
gsap.from(".title", { y: 50, opacity: 0, duration: 1 });
gsap.from(".card", { y: 50, opacity: 0, stagger: 0.2, duration: 1 });

// FORM
document.getElementById("contactForm").addEventListener("submit", function(e) {
  e.preventDefault();

  const name = document.getElementById("name").value.trim();
  const email = document.getElementById("email").value.trim();

  if (!name || !email) {
    alert("Please fill all required fields");
    return;
  }

  const msg = document.getElementById("successMsg");
  msg.classList.remove("hidden");

  gsap.fromTo(msg,
    { opacity: 0, y: 20 },
    { opacity: 1, y: 0, duration: 0.5 }
  );

  this.reset();
});