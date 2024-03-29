const md = require('markdown-it')({
    html: true,
    linkify: true,
    typographer: true
});

const FOS = require("../index.js"),
    server = new FOS(
        {
            echo: arg => arg,
            upper: arg => arg.toUpperCase(),
            f: () => () => true
        },
        {allow: "*", log: true},
    );
server.use((request, response, next) => {
    next();
}, (request, response, next) => {
    next("route");
}, (request, response, next) => {
    console.log("should not be here");
    next();
});
server.use(/\/hello/g, async (request, response, next) => {
    console.log("RegExp", request.url);
});
server.param("id", async (request, response, next, value) => {
    console.log(request.url, value);
});
server.use("/hello/there/:id", (request, response, next) => {
    console.log(request.url, "to long");
    next();
});
server.use("/hello/:id", async (request, response, next) => {
    response.end("hi!");
});
server.static("/", {
    mimeTypes: {
        md: {
            contentType: "text/html",
            transform: (content) => md.render(content.toString())
        }
    }
});
server.listen(3000);