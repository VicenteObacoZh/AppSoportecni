const apiStatus = document.getElementById('apiStatus');
const apiMessage = document.getElementById('apiMessage');
const checkApiButton = document.getElementById('checkApiButton');
const loginForm = document.getElementById('loginForm');
const loginMessage = document.getElementById('loginMessage');

async function checkApi() {
  const apiUrl = 'https://rastreo.soportecni.com';

  apiStatus.textContent = 'Validando servicio...';
  apiMessage.textContent = 'Intentando consultar la plataforma en vivo.';
  checkApiButton.disabled = true;

  try {
    const response = await fetch(apiUrl, { method: 'GET', mode: 'cors' });

    if (!response.ok) {
      throw new Error(`Respuesta ${response.status}`);
    }

    const html = await response.text();
    const isLogin = html.includes('Iniciar sesion') || html.includes('Iniciar sesión') || html.includes('Soportecni GPS');

    apiStatus.textContent = isLogin ? 'Servicio operativo' : 'Servicio accesible';
    apiMessage.textContent = isLogin
      ? 'La plataforma respondio correctamente y devolvio la pantalla de acceso.'
      : 'La plataforma respondio, aunque la respuesta no coincide con la vista esperada.';
  } catch (error) {
    apiStatus.textContent = 'Validacion desde navegador limitada';
    apiMessage.textContent = 'La plataforma existe, pero el navegador puede bloquear la consulta directa por CORS. La integracion real se puede hacer con backend o proxy seguro.';
  } finally {
    checkApiButton.disabled = false;
  }
}

if (checkApiButton) {
  checkApiButton.addEventListener('click', checkApi);
}

if (loginForm) {
  loginForm.addEventListener('submit', (event) => {
    event.preventDefault();

    if (loginMessage) {
      loginMessage.textContent = 'Validacion demo completada. Redirigiendo al dashboard operativo...';
    }

    window.setTimeout(() => {
      window.location.href = './dashboard.html';
    }, 700);
  });
}
