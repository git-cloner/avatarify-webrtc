const { createProxyMiddleware } = require("http-proxy-middleware");
module.exports = function (app) {
    app.use(
        "/api",
        createProxyMiddleware({
            target: "https://classnotfound.com.cn", 
            changeOrigin: true,
            pathRewrite: {
                "/api": "", 
            },
        }),
        createProxyMiddleware
    ) ;
    app.use(
        "/webrtc",
        createProxyMiddleware({
            target: "https://gitclone.com/aiit/avatarify-webrtc", 
            changeOrigin: true,
            pathRewrite: {
                "/webrtc": "", 
            },
        })
    );
};