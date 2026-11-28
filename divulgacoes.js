const feed = document.querySelector('#feed');
const form = document.querySelector('#admin-form');
const picturePattern = /^(?:assets\/[\w.-]+\.(?:jpg|jpeg|png|webp)|data:image\/jpeg;base64,[\w+/=]+)$/i;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

async function loadEntries() {
  const response = await fetch('divulgacoes.json', { cache: 'no-cache' });
  if (!response.ok) throw new Error('Arquivo de divulgações indisponível.');
  const entries = await response.json();
  if (!Array.isArray(entries)) throw new Error('Formato de divulgações inválido.');
  return entries.filter(item => item && typeof item.title === 'string' &&
    typeof item.caption === 'string' && datePattern.test(item.date) &&
    picturePattern.test(item.image));
}

function element(tag, text) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  return node;
}

function renderFeed(entries) {
  entries.sort((a, b) => b.date.localeCompare(a.date));
  const posts = entries.map(item => {
    const post = element('article');
    const img = element('img');
    img.src = item.image;
    img.alt = [item.title, item.date.split('-').reverse().join('/'), item.caption].filter(Boolean).join('. ');
    img.width = 1080;
    img.height = 1350;
    img.loading = 'lazy';
    if (item.image.startsWith('assets/')) {
      const link = element('a');
      link.href = item.image;
      link.append(img);
      post.append(link);
    } else {
      post.append(img);
    }
    return post;
  });
  feed.replaceChildren(...(posts.length ? posts : [element('p', 'Confira a agenda da casa no Instagram.')]));
}

async function prepareImage(file, mode) {
  const source = await createImageBitmap(file);
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1350;
    const context = canvas.getContext('2d');
    context.fillStyle = '#211428';
    context.fillRect(0, 0, canvas.width, canvas.height);
    const ratios = [canvas.width / source.width, canvas.height / source.height];
    const scale = mode === 'cover' ? Math.max(...ratios) : Math.min(...ratios);
    const width = source.width * scale;
    const height = source.height * scale;
    context.drawImage(source, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
    return canvas.toDataURL('image/jpeg', 0.83);
  } finally {
    source.close();
  }
}

async function setupEditor() {
  const select = document.querySelector('#entries');
  const upload = document.querySelector('#upload');
  const fit = document.querySelector('#fit');
  const preview = document.querySelector('#preview');
  const status = document.querySelector('#admin-status');
  const remove = document.querySelector('#remove');
  const exportButton = document.querySelector('#export');
  const submit = form.querySelector('button[type="submit"]');
  submit.disabled = true;
  let entries;
  try {
    entries = await loadEntries();
  } catch {
    status.textContent = 'Abra o painel pelo site hospedado ou pelo servidor local para carregar a lista.';
    return;
  }
  let image = '';
  let dirty = false;
  let imageRequest = 0;
  function showImage() {
    if (image) preview.src = image;
    else preview.removeAttribute('src');
    preview.hidden = !image;
  }
  function refresh() {
    select.replaceChildren(new Option('Nova divulgação', ''),
      ...entries.map((item, index) => new Option(item.title, index)));
    exportButton.disabled = !dirty;
    resetFields();
  }
  function resetFields() {
    imageRequest++;
    const current = select.value === '' ? null : entries[Number(select.value)];
    for (const field of ['title', 'date', 'caption']) form.elements[field].value = current?.[field] ?? '';
    upload.value = '';
    image = current?.image ?? '';
    showImage();
    submit.disabled = false;
    remove.disabled = !current;
  }
  async function updateImage() {
    const file = upload.files[0];
    const request = ++imageRequest;
    submit.disabled = true;
    try {
      if (!file || file.size > 15 * 1024 * 1024) throw new Error('Escolha uma imagem de até 15 MB.');
      const next = await prepareImage(file, fit.value);
      if (request !== imageRequest) return;
      image = next;
      showImage();
      status.textContent = 'Imagem pronta em 1080 × 1350.';
    } catch (error) {
      if (request === imageRequest) {
        upload.value = '';
        status.textContent = error.message;
      }
    } finally {
      if (request === imageRequest) submit.disabled = false;
    }
  }
  select.addEventListener('change', resetFields);
  upload.addEventListener('change', () => { if (upload.files.length) updateImage(); });
  fit.addEventListener('change', () => { if (upload.files.length) updateImage(); });
  form.addEventListener('submit', event => {
    event.preventDefault();
    const fields = new FormData(form);
    const title = fields.get('title').trim();
    if (!title || !image) {
      status.textContent = 'Informe um título e escolha uma imagem.';
      return;
    }
    const item = { title, date: fields.get('date'), caption: fields.get('caption').trim(), image };
    if (select.value === '') entries.push(item);
    else entries[Number(select.value)] = item;
    dirty = true;
    refresh();
    status.textContent = 'Divulgação salva na lista. Baixe e publique o arquivo para atualizar o site.';
  });
  remove.addEventListener('click', () => {
    if (select.value === '') return;
    entries.splice(Number(select.value), 1);
    dirty = true;
    refresh();
    status.textContent = 'Divulgação removida da lista.';
  });
  exportButton.addEventListener('click', () => {
    const file = new Blob([JSON.stringify(entries, null, 2) + '\n'], { type: 'application/json' });
    const url = URL.createObjectURL(file);
    const download = element('a');
    download.href = url;
    download.download = 'divulgacoes.json';
    download.click();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    status.textContent = 'Arquivo exportado. Envie ao GitHub para publicar as mudanças.';
  });
  refresh();
}

if (feed) loadEntries().then(renderFeed).catch(() => {});
if (form) setupEditor();
