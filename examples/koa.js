const Koa = require('koa'),
	fosify = require("../index.js").fosify,
	app = new Koa();

	app.locals = {serverName: "Koa FOS"};
	const api = {
			echo:arg => arg,
			upper:arg => arg.toUpperCase(),
			f:() => () => true,
			locals:(key) => key ? app.locals[key] : undefined
			// direct URL http://localhost:3000/fos/locals?arguments=["serverName"]
	};

app.use(require('koa-static')(__dirname + "/"));
fosify(app,api,{allow:"*",name:"F"});
app.listen(3000,() => console.log("Koa FOS server listening on 3000"));