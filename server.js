const { createApp } = require('./src/app');
const { PORT } = require('./src/config');

const app = createApp();
app.listen(PORT, () => {
    console.log(`SkyNetApi rodando em http://localhost:${PORT}`);
});
