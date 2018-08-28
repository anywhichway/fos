const FOS = require("../../index.js"),
	cookieParser = require('cookie-parser'),
	app = new FOS({},{allow:"*"});
app.use(cookieParser());
app.route("/hi").get((request,response,next) => { response.end("Hi!"); next(); });
app.route("/").get(async (request) => { console.log("Cookies",JSON.stringify(request.cookies)); });
app.static("/");
app.listen(3000)