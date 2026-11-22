import { connect, safeImage } from './backend.mjs';

const find = id => document.getElementById(id);
const notice = message => { find('status').textContent = message; };
const login = find('login');
const editor = find('editor');
const records = find('records');
const hours = find('hours');
const select = find('record');
const view = find('view');
const publish = find('publish');
const preview = find('photo');
let store, state, revision, busy = false, dirty = false;

function showImage(image) {
  preview.hidden = !safeImage(image);
  if (preview.hidden) preview.removeAttribute('src');
  else preview.src = image;
}

function currentList() { return state[view.value]; }
function currentItem() { return select.value === '' ? null : currentList()[Number(select.value)]; }

function refreshFields() {
  const event = view.value === 'events';
  find('date-field').hidden = !event;
  find('category-field').hidden = event;
  find('price-field').hidden = event;
  records.elements.date.required = event;
  records.elements.price.required = !event;
  const item = currentItem();
  records.elements.title.value = item?.title ?? '';
  records.elements.category.value = item?.category ?? records.elements.category.options[0].value;
  records.elements.date.value = item?.date ?? '';
  records.elements.price.value = item?.price ?? '';
  records.elements.description.value = event ? item?.caption ?? '' : item?.desc ?? '';
  records.elements.image.value = '';
  showImage(item?.image ?? '');
  find('remove-record').disabled = !item;
}

function refreshList(index = '') {
  const showHours = view.value === 'hours';
  records.hidden = showHours;
  hours.hidden = !showHours;
  if (showHours) {
    hours.elements.lunch.value = state.lunch;
    hours.elements.evening.value = state.evening;
    return;
  }
  select.replaceChildren(new Option('Adicionar novo', ''),
    ...currentList().map((item, position) => new Option(item.title, position)));
  select.value = index;
  refreshFields();
}

async function resize(file, event) {
  if (file.size > 15 * 1024 * 1024) throw new Error('Escolha uma imagem de até 15 MB.');
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement('canvas');
    canvas.width = event ? 1080 : 640;
    canvas.height = event ? 1350 : 480;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#211428';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const factor = Math.min(canvas.width / bitmap.width, canvas.height / bitmap.height);
    const width = bitmap.width * factor;
    const height = bitmap.height * factor;
    ctx.drawImage(bitmap, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
    return canvas.toDataURL('image/jpeg', .72);
  } finally { bitmap.close(); }
}

function markEdited(message) {
  dirty = true;
  publish.disabled = false;
  notice(message);
}

view.addEventListener('change', () => refreshList());
select.addEventListener('change', refreshFields);
records.addEventListener('submit', async event => {
  event.preventDefault();
  if (busy) return;
  busy = true;
  publish.disabled = true;
  view.disabled = select.disabled = find('save-record').disabled = find('remove-record').disabled = true;
  try {
    const list = currentList();
    const previous = currentItem();
    const isEvent = view.value === 'events';
    const file = records.elements.image.files[0];
    const image = file ? await resize(file, isEvent) : previous?.image ?? '';
    const title = records.elements.title.value.trim();
    const description = records.elements.description.value.trim();
    if (!title) throw new Error('Informe o título.');
    const price = records.elements.price.value.trim();
    if (!isEvent && !price) throw new Error('Informe o preço.');
    const item = isEvent
      ? { title, date: records.elements.date.value, caption: description, image }
      : { title, category: records.elements.category.value, desc: description, price, reference: Boolean(previous?.reference && previous.price === price), image };
    const index = previous ? Number(select.value) : list.length;
    list[index] = item;
    refreshList(String(index));
    markEdited('Alteração salva na lista. Clique em Publicar alterações.');
  } catch (error) { notice(error.message); }
  finally {
    busy = false;
    view.disabled = select.disabled = find('save-record').disabled = false;
    find('remove-record').disabled = !currentItem();
    publish.disabled = !dirty;
  }
});
find('remove-record').addEventListener('click', () => {
  if (!currentItem() || busy) return;
  currentList().splice(Number(select.value), 1);
  refreshList();
  markEdited('Item removido da lista. Clique em Publicar alterações.');
});
hours.addEventListener('submit', event => {
  event.preventDefault();
  state.lunch = hours.elements.lunch.value.trim();
  state.evening = hours.elements.evening.value.trim();
  markEdited('Horários atualizados na lista. Clique em Publicar alterações.');
});
publish.addEventListener('click', async () => {
  if (busy) return;
  const snapshot = structuredClone(state);
  if (new TextEncoder().encode(JSON.stringify(snapshot)).length > 900000) {
    notice('A publicação excede o espaço disponível. Use imagens menores ou remova publicações antigas.');
    return;
  }
  busy = true;
  editor.inert = true;
  try {
    await store.save(snapshot, revision);
    revision++;
    dirty = false;
    notice('Alterações publicadas no site.');
  } catch (error) {
    notice(error.code === 'permission-denied' ? 'A conta não tem permissão para publicar.' : error.message);
  } finally {
    busy = false;
    editor.inert = false;
    publish.disabled = !dirty;
  }
});

async function start() {
  const initialResponse = await fetch('./conteudo-inicial.json');
  const initial = await initialResponse.json();
  const catalogResponse = await fetch('./cardapio.html');
  const catalog = new DOMParser().parseFromString(await catalogResponse.text(), 'text/html');
  records.elements.category.replaceChildren(...[...catalog.querySelectorAll('.menu-section')]
    .filter(section => section.querySelector('.menu-items'))
    .map(section => new Option(section.querySelector('h2').textContent, section.id)));
  store = await connect();
  const { auth, authApi } = store;
  authApi.onAuthStateChanged(auth, async user => {
    login.hidden = Boolean(user);
    editor.hidden = true;
    find('verify').hidden = !user || user.emailVerified;
    find('logout').hidden = !user;
    if (!user) { notice('Entre com seu e-mail e senha.'); return; }
    if (user.uid !== 'EndBtEcHK0PmwdDLnjgQqa9NlwZ2') {
      find('verify').hidden = true;
      notice('Esta conta não é administradora do Batuque.');
      return;
    }
    if (!user.emailVerified) {
      notice('Confirme seu endereço de e-mail. Depois, saia e entre novamente.');
      return;
    }
    try {
      const data = await store.read();
      if (auth.currentUser !== user) return;
      revision = data?.revision ?? 0;
      state = data ? { menu: data.menu, events: data.events, lunch: data.lunch, evening: data.evening } : structuredClone(initial);
      dirty = false;
      publish.disabled = true;
      refreshList();
      editor.hidden = false;
      notice('Conta conectada. As permissões de publicação são verificadas pelo Firebase.');
    } catch { notice('Não foi possível carregar os dados.'); }
  });
  login.addEventListener('submit', async event => {
    event.preventDefault();
    try {
      await authApi.signInWithEmailAndPassword(auth, login.elements.email.value.trim(), login.elements.password.value);
      login.elements.password.value = '';
    } catch { notice('Não foi possível entrar. Confira os dados ou redefina a senha.'); }
  });
  find('reset').addEventListener('click', async () => {
    if (!login.elements.email.reportValidity()) return;
    try {
      await authApi.sendPasswordResetEmail(auth, login.elements.email.value.trim());
      notice('Se a conta estiver cadastrada, o link será enviado ao e-mail informado.');
    } catch { notice('Não foi possível solicitar a redefinição agora.'); }
  });
  find('verify').addEventListener('click', async () => {
    try {
      await authApi.sendEmailVerification(auth.currentUser);
      notice('Verificação enviada. Abra o link no e-mail e entre novamente.');
    } catch { notice('Não foi possível enviar a verificação agora.'); }
  });
  find('logout').addEventListener('click', () => authApi.signOut(auth));
}
start().catch(error => notice(error.message));


