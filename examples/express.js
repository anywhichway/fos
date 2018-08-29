const express = require('express'),
fosify = require("../index.js").fosify,
	app = express();

app.locals.serverName = "Express FOS";
const api = {
		echo:arg => arg,
		upper:arg => arg.toUpperCase(),
		f:() => () => true,
		locals:(key) => key ? app.locals[key] : undefined
		// direct URL http://localhost:3000/fos/locals?arguments=["serverName"]
};
fosify(app,api,{allow:"*",name:"F"});
app.use(express.static(__dirname + "/"));

app.listen(3000, () => console.log("Express FOS listening on 3000"))