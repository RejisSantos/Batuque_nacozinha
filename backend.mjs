const sdk = 'https://www.gstatic.com/firebasejs/11.10.0/';
export async function connect() {
  const response = await fetch('./firebase-web.json', { cache: 'no-cache' });
  if (!response.ok) throw new Error('Configuração do Firebase indisponível.');
  const config = await response.json();
  if (!config.apiKey || !config.projectId || !config.appId) {
    throw new Error('O login aguarda a configuração do projeto Firebase.');
  }
  const [{initializeApp}, authApi, dbApi] = await Promise.all([
    import(sdk + 'firebase-app.js'),
    import(sdk + 'firebase-auth.js'),
    import(sdk + 'firebase-firestore.js')
  ]);
  const app = initializeApp(config);
  const db = dbApi.getFirestore(app);
  const ref = dbApi.doc(db, 'publicacao', 'site');
  const unpack = snapshot => snapshot.exists()
    ? { ...JSON.parse(snapshot.data().conteudo), revision: snapshot.data().revisao }
    : null;
  return {
    auth: authApi.getAuth(app), authApi,
    read: () => dbApi.getDoc(ref).then(unpack),
    save: (state, revision) => dbApi.runTransaction(db, async transaction => {
      const current = await transaction.get(ref);
      if ((current.data()?.revisao ?? 0) !== revision) {
        throw new Error('O site foi editado em outra aba. Recarregue a página antes de publicar.');
      }
      transaction.set(ref, { conteudo: JSON.stringify(state), revisao: revision + 1 });
    })
  };
}

export function safeImage(value) {
  return /^(?:assets\/[\w.-]+\.(?:jpg|jpeg|png|webp)|data:image\/jpeg;base64,[\w+/=]+)$/i.test(value);
}
