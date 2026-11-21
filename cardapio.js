const search = document.querySelector("#busca");
const reset = document.querySelector("#limpar");
const status = document.querySelector("#resultados");
const entries = [...document.querySelectorAll(".menu-section")];

function normalize(text) {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("pt-BR").trim();
}

function updateResults() {
  const query = normalize(search.value);
  let matching = 0;

  for (const entry of entries) {
    const categoryMatches = normalize(entry.querySelector("h2").textContent).includes(query);
    let sectionMatches = false;
    for (const item of entry.querySelectorAll(".menu-entry")) {
      const visible = categoryMatches || normalize(item.textContent).includes(query);
      item.hidden = !visible;
      if (visible) {
        sectionMatches = true;
        matching++;
      }
    }
    entry.hidden = !sectionMatches;
  }

  reset.hidden = !query;
  status.textContent = query && !matching ? "Nenhum resultado. Tente outro termo." : "";
}

search.closest(".menu-search").hidden = false;
search.addEventListener("input", updateResults);
reset.addEventListener("click", () => {
  search.value = "";
  updateResults();
  search.focus();
});

for (const link of document.querySelectorAll(".category-links a")) {
  link.addEventListener("click", () => {
    if (!search.value) return;
    search.value = "";
    updateResults();
  });
}

