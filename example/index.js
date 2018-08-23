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
server.use((request,response,next) => { console.log(1,request.url); next(); },(request,response,next) => { console.log(2,request.url); next("route"); },(request,response,next) => { console.log(3,request.url); next(); });
server.use(/\/hello/g,async (request,response,next) => { console.log(request.url); });
server.param("id",async (request,response,next,value) => { console.log(request.url,value); });
server.use("/hello/there/:id",(request,response,next) => { console.log(request.url,"to long"); next(); });
server.use("/hello/:id",(request,response) => { response.end("hi!"); });
server.listen(3000);