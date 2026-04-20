const config = require('./config');
const { createApp } = require('./app');

const app = createApp();

app.listen(config.port, '0.0.0.0', () => {
  console.log(`${config.appName} escuchando en http://0.0.0.0:${config.port}`);
});
