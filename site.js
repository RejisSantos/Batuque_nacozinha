const dialog = document.querySelector("#foto");
const caption = document.querySelector("#legenda");
const preview = document.querySelector("#foto-ampliada");

for (const button of document.querySelectorAll(".photo")) {
  button.addEventListener("click", () => {
    const image = button.querySelector("img");
    preview.src = image.src;
    preview.alt = image.alt;
    caption.textContent = button.dataset.caption;
    dialog.showModal();
  });
}

dialog.addEventListener("click", event => {
  if (event.target !== dialog) return;
  const bounds = dialog.getBoundingClientRect();
  if (event.clientX < bounds.left || event.clientX > bounds.right ||
      event.clientY < bounds.top || event.clientY > bounds.bottom) {
    dialog.close();
  }
});

