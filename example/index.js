const FOS = require("../index.js"),
	server = new FOS(
			{
				echo:arg => arg,
				upper:arg => arg.toUpperCase(),
				f:() => () => true,
				request: FOS.request
			},
			{allow:"*",name:"F"}
	);
server.use("/hello",(request,response) => { response.end("hi!"); });
server.listen(3000);