import { connect, safeImage } from './backend.mjs';

function node(tag, text, className) {
  const result = document.createElement(tag);
  if (text) result.textContent = text;
  if (className) result.className = className;
  return result;
}
function photo(src, alt) {
  const img = node('img');
  img.src = src;
  img.alt = alt;
  img.loading = 'lazy';
  return img;
}
function render(data) {
  const feed = document.querySelector('#feed');
  if (feed && Array.isArray(data.events)) {
    feed.replaceChildren(...[...data.events].sort((a, b) => b.date.localeCompare(a.date)).map(item => {
      const article = node('article');
      if (safeImage(item.image)) article.append(photo(item.image, item.title));
      article.append(node('time', item.date.split('-').reverse().join('/')), node('h3', item.title), node('p', item.caption));
      return article;
    }));
    if (!feed.children.length) feed.append(node('p', 'Confira a agenda no Instagram.'));
  }
  const hours = document.querySelectorAll('.opening-hours dd');
  if (hours.length === 2) {
    if (data.lunch) hours[0].previousElementSibling.textContent = 'Almoço';
    if (data.evening) hours[1].previousElementSibling.textContent = 'Noite';
    if (data.lunch) hours[0].textContent = data.lunch;
    if (data.evening) hours[1].textContent = data.evening;
  }
  for (const section of document.querySelectorAll('.menu-section .menu-items')) {
    const id = section.closest('.menu-section').id;
    section.querySelectorAll('.priced').forEach(card => card.remove());
    for (const item of data.menu.filter(entry => entry.category === id)) {
      const card = node('article', '', 'menu-entry priced');
      const details = node('div');
      details.append(node('h3', item.title));
      if (item.desc) details.append(node('p', item.desc));
      if (safeImage(item.image)) details.append(photo(item.image, item.title));
      const price = node('p', '', 'menu-price');
      if (item.reference) price.append(node('span', 'Referência'));
      price.append(node('strong', item.price));
      card.append(details, price);
      section.append(card);
    }
  }
  document.querySelector('#busca')?.dispatchEvent(new Event('input'));
}
try {
  const data = await (await connect()).read();
  if (data) render(data);
} catch {
  // The initial catalog and poster remain available when the backend is offline.
}
