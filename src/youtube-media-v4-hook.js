const legacy = require('./youtube');
const { registerYouTubeMediaV4Routes } = require('./youtube-media-v4');

if (!legacy.__youtubeMediaV4Wrapped) {
    const registerLegacy = legacy.registerYouTubeRoutes;
    legacy.registerYouTubeRoutes = function registerYouTubeRoutesWithV4(app) {
        registerYouTubeMediaV4Routes(app);
        return registerLegacy(app);
    };
    Object.defineProperty(legacy, '__youtubeMediaV4Wrapped', { value: true });
}
