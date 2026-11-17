// =====================================================================
//  ACCESO SOLO ADMINISTRADOR
//  La web queda cerrada: solo se ve después de entrar con el email del
//  administrador y su contraseña (Firebase Authentication).
//  Se carga en <head> con: <script src="acceso.js?v=1"></script>
// =====================================================================
(() => {
  const ADMIN = 'colezzionisaglimbenimedina@gmail.com';
  const FB = 'https://www.gstatic.com/firebasejs/10.12.2/';
  const CFG = {
    apiKey: 'AIzaSyBe6sgVxhXGKYilnV0Dghj8Z9wn6TSWobc',
    authDomain: 'precio-cartas.firebaseapp.com',
    projectId: 'precio-cartas',
    storageBucket: 'precio-cartas.firebasestorage.app',
    messagingSenderId: '729865479700',
    appId: '1:729865479700:web:f960c11e34422c9d7a2901',
  };

  // 1) Oculta la página desde el primer momento
  const root = document.documentElement;
  root.classList.add('locked');
  const st = document.createElement('style');
  st.textContent = `
    html.locked body > *:not(#accGate){display:none!important}
    html.locked body{overflow:hidden}
    #accGate{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;
      background:#0f172a;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;padding:16px}
    html:not(.locked) #accGate{display:none}
    #accGate form{background:#fff;color:#0f172a;border-radius:16px;padding:28px 24px;width:100%;max-width:340px;
      box-shadow:0 20px 50px rgba(0,0,0,.4);display:flex;flex-direction:column;gap:12px}
    #accGate h2{margin:0 0 4px;font-size:22px;text-align:center}
    #accGate p{margin:0;font-size:14px;color:#475569;text-align:center}
    #accGate input{font:inherit;font-size:16px;padding:12px;border:1px solid #cbd5e1;border-radius:10px;width:100%;box-sizing:border-box}
    #accGate button{font:inherit;font-size:16px;font-weight:600;padding:12px;border:0;border-radius:10px;background:#2563eb;color:#fff;cursor:pointer}
    #accGate button:disabled{opacity:.6;cursor:default}
    #accGate .accMsg{min-height:18px;font-size:14px;color:#dc2626}
    #accGate .accMsg.ok{color:#475569}
    #accGate .accLink{background:none;color:#2563eb;font-weight:500;font-size:14px;padding:4px}`;
  document.head.appendChild(st);

  const $ = id => document.getElementById(id);
  function drawGate(){
    if ($('accGate')) return;
    document.body.insertAdjacentHTML('afterbegin', `<div id="accGate"><form id="accForm" autocomplete="on">
      <h2>🔒 Acceso privado</h2>
      <p>Solo el administrador puede entrar.</p>
      <input id="accEmail" type="email" placeholder="Email del administrador" autocomplete="username" required>
      <input id="accPass" type="password" placeholder="Contraseña" autocomplete="current-password" required>
      <button id="accBtn" type="submit" disabled>Comprobando…</button>
      <button id="accForgot" type="button" class="accLink">¿No tienes contraseña o la olvidaste?</button>
      <div class="accMsg ok" id="accMsg"></div>
    </form></div>`);
  }
  const msg = (t, ok) => { const m = $('accMsg'); if (m) { m.textContent = t; m.className = 'accMsg' + (ok ? ' ok' : ''); } };
  const ready = () => { const b = $('accBtn'); if (b) { b.disabled = false; b.textContent = 'Entrar'; } };

  // 2) Espera a que la página (y su Firebase) se haya cargado y comprueba la sesión
  document.addEventListener('DOMContentLoaded', async () => {
    drawGate();
    try {
      const { initializeApp, getApps, getApp } = await import(FB + 'firebase-app.js');
      const { getAuth, onAuthStateChanged, signInWithEmailAndPassword, sendPasswordResetEmail, signOut } = await import(FB + 'firebase-auth.js');
      // usa la misma app de Firebase que la página (así la sesión es la misma)
      const app = getApps().length ? getApp() : initializeApp(CFG);
      const auth = getAuth(app);
      const isAdmin = u => !!u && (u.email || '').toLowerCase() === ADMIN;

      onAuthStateChanged(auth, u => {
        if (isAdmin(u)) { root.classList.remove('locked'); return; }
        root.classList.add('locked');
        if (u) { signOut(auth); msg('Esta cuenta no tiene acceso.'); }
        ready();
      });

      $('accForm').addEventListener('submit', async e => {
        e.preventDefault();
        const email = $('accEmail').value.trim().toLowerCase();
        if (email !== ADMIN) return msg('Email o contraseña incorrectos.');
        $('accBtn').disabled = true; msg('');
        try { await signInWithEmailAndPassword(auth, email, $('accPass').value); $('accPass').value = ''; }
        catch { msg('Email o contraseña incorrectos.'); }
        ready();
      });

      // envía al email del administrador un enlace para poner una contraseña nueva
      $('accForgot').addEventListener('click', async () => {
        try { await sendPasswordResetEmail(auth, ADMIN);
          msg('Te hemos enviado un email a ' + ADMIN + ' para poner la contraseña. Mira también en spam.', true); }
        catch { msg('No se pudo enviar el email. Inténtalo otra vez.'); }
      });
    } catch {
      msg('No se pudo conectar. Recarga la página.');
    }
  });
})();
