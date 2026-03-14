const toggleButton = document.getElementById("toggle-button");
const themeMode = document.getElementById("theme-mode");
const statusText = document.getElementById("status-text");

function initializeShell() {
  toggleButton.disabled = true;
  themeMode.disabled = true;
  statusText.textContent = "Extension shell ready. Interaction wiring lands next.";
}

initializeShell();
