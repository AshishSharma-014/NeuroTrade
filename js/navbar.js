function logout() {
  localStorage.removeItem("isLoggedIn");
  location.reload();
}

document.addEventListener("DOMContentLoaded", () => {

  const navContainer = document.getElementById("navbar");
  if (!navContainer) return;

  const navbarHTML = `
    <nav class="navbar">
      
      <a href="index.html" class="nav-logo">
        <img src="/images/logo.png" class="nav-logo-img"/>
      </a>

      <div style="display:flex;align-items:center;gap:32px;">
        <a href="index.html" class="nav-link">Home</a>
        <a href="market.html" class="nav-link">Market</a>
        <a href="game.html" class="nav-link">AI Simulator</a>
        <a href="CA.html" class="nav-link">Virtual CA</a>
        <a href="about.html" class="nav-link">About Us</a>
      </div>

      <div id="nav-right" style="display:flex;align-items:center;gap:12px;">
        <a href="log-sign.html" class="btn-secondary">Login/Sign up</a>
      </div>

    </nav>
  `;

  navContainer.innerHTML = navbarHTML;

  // Login logic
  const isLoggedIn = localStorage.getItem("isLoggedIn");

  if (isLoggedIn) {
    document.getElementById("nav-right").innerHTML = `
      <span style="color:#0ecb81;">Welcome Trader 🚀</span>
      <button onclick="logout()" class="btn-secondary">Logout</button>
    `;
  }

  // Active link highlight
  const links = document.querySelectorAll(".nav-link");
  const currentPage = window.location.pathname.split("/").pop();

  links.forEach(link => {
    const href = link.getAttribute("href");

    if (href === currentPage) {
      link.style.color = "#0ecb81";
      link.style.fontWeight = "600";
    }
  });

});
const username = localStorage.getItem("username");
const isLoggedIn = localStorage.getItem("isLoggedIn");

if (isLoggedIn && username) {
  document.getElementById("nav-right").innerHTML = `
    <span style="color:#0ecb81;">${username} 🚀</span>
    <button onclick="logout()" class="btn-secondary">Logout</button>
  `;
}