(function() {
	var createServer,
		URL;
	if(typeof(module)!=="undefined") {
		createServer = require("http").createServer;
		URL = require("url").URL;
	} else {
		class ServerResponse {
			constructor() {
				this.promise = new Promise(resolve => this.resolve=resolve);
				this.promise.statusCode = 200;
				this.promise.statusMessage = "";
				this.promise.headers = {};
				this.promise.body = "";
				Object.keys(ServerResponse.prototype).forEach(key => Object.defineProperty(this.promise,key,{enumerable:false,configurable:true,writable:true,value:ServerResponse.prototype[key]}))
				return this.promise;
			}
			addTrailers()	{} // Adds HTTP trailing headers
			end(text="")	{ this.body += text; this.finished = true; this.resolve(); } // Signals that the the server should consider that the response is complete
			// finished	Returns true if the response is complete, otherwise false
			getHeader(key) { return this.headers[key]; } // Returns the value of the specified header
			// headersSent	// Returns true if headers were sent, otherwise false
			removeHeader(key)	{ delete this.headers[key]; } // Removes the specified header
			// sendDate set to false if the Date header should not be sent in the response. Default true
			setHeader(key,value)	{ this.headers[key] = value; } // Sets the specified header
			setTimeout() {} // Sets the timeout value of the socket to the specified number of milliseconds
			// statusCode Sets the status code that will be sent to the client
			// statusMessage	Sets the status message that will be sent to the client
			write(text)	{ this.headersSent = true; this.body += text; } // Sends text, or a text stream, to the client
			//writeContinue()	{} // Sends a HTTP Continue message to the client
			writeHead()	{ this.headersSent = true; } // Sends status and response headers to the client
		}
		createServer = async handler => {
			self.addEventListener('fetch', async event => {
				const request = Object.assign({},event.request),
					response = new ServerResponse();
				request.headers = new Proxy(request.headers,{get:(target,property) => target.get(property)});
				handler(request,response);
				await response;
			  event.respondWith(new Response(response.body,{status:response.status,statusText:response.statusText||response.statusMessage,headers:response.headers}));
			});
		}
	}
	
	function fromJSON(json,functions) {
		return JSON.parse(json,(_,value) => {
		  if(value==='@NaN') return NaN;
		  if(value==='@Infinity') return Infinity;
		  if(value==='@-Infinity') return -Infinity;
		  if(value==='@undefined') return undefined;
		  if(typeof(value)==="string" && value.indexOf("Function@")===0) {
		  	if(functions) return Function("return " + value.substring(9))();
		  	return;
		  }
		  return value;
		});
	}
	
	async function runCallback(cb,request,response,value) {
		if(typeof(cb)==="string") return true; // it is actually a path
		return new Promise(resolve => {
			const result = cb(request,response,resolve,value);
			if(result && typeof(result)==="object" && result instanceof Promise) {
				result.then(result => resolve(result))
			}
		});
	}
	
	function toJSON(value) {
		return JSON.stringify(value,(_,value) => {
		  if(value!==value || value===Infinity || value===-Infinity || value===undefined) return `@{value}`;
		  if(typeof(value)==="function") return "Function@" + value;
		  return value;
		})
	}
	
	function toScript(object,{server},parent="") {
		function fos(options) { fos._options = options; return fos; };
		const	handlers = "{" + Object.keys(object).reduce((accum,key,index,array) => {
				const value = object[key],
					type = typeof(value);
				if(type==="function") { // headers available as fos._headers
					accum += `"${key}":(...args) => {return fetch("${server}/fos/${parent}${key}?arguments="+encodeURIComponent(toJSON(args)),fos._options).then(response => response.text().then(text => { delete fos._options; if(response.ok) { return text; } throw new Error(response.status + " " + text); })).then(text => fromJSON(text,true));}`
				} else if(value && type==="object") {
					accum += `"${key}":` + toScript(value,{server},`${parent}${key}.`);
				}
				if(index<array.length-1) {
					accum += ",";
				}
				return accum;
			},"") + "}";
		return `(() => {
			${toJSON};
			${fromJSON};
			var fos = Object.assign(${fos},${handlers});
			return fos; 
			})()`; 
	}
	
	const VERBS = ["all","delete","get","head","patch","post","put"];
		
	class FOS {
		constructor(functions,{allow,name,before,after,done,middleware}={}) {
			this.functions = functions;
			this.settings = {};
			this.routes = [];
			this.locals = {};
			this.engines = {};
			const handler = async (request, response, complete=Promise.resolve()) => {
				request.fos = this;
				response.locals = Object.assign({},this.locals);
				const url = new URL(request.url,(request.secure ? "https://" : "http://") + request.headers.host);
				request.subdomains = [];
				const parts = request.headers.host.split(".");
				if(parts.length>2) {
					parts.pop();
					parts.pop();
					request.subdomains.push(parts.join("."));
				}
				request = new Proxy(request,{
					get:(target,property) => {
						if(url[property]) {
							return url[property];
						}
						if(property==="path") {
							return url.pathname;
						}
						if(property==="query") {
							return new Proxy(url.searchParams,{get:(target,property) => typeof(target.get)==="function" ? target.get(property) : target[property]});
						}
						if(property==="ip") {
							return (req.headers['x-forwarded-for'] || '').split(',').pop() || 
			         req.connection.remoteAddress || 
			         req.socket.remoteAddress || 
			         req.connection.socket.remoteAddress
						}
						return target[property];
					}
				});
				if(allow) {
					response.setHeader("Access-Control-Allow-Origin",allow);
				}
				if(before) {
					await before({request,response});
				}
				if(!response.headersSent) {
					let result;
					if(request.pathname==="/fos") {
				  	response.setHeader("Content-Type","text/javascript");
				  	response.end(`${name ? "const " + name + " = " : ""}${toScript(this.functions,{server:request.protocol  + "//" + request.host})};`);
				  	return;
					} else if(request.pathname.indexOf("/fos/")===0){
				  	const parts = request.pathname.substring(5).split(".");
				  	let node = this.functions,
				  		key;
				  	while((key = parts.shift()) && (node = node[key])) {
				  		if(parts.length===0) {
				  			try {
				  				result = await node.apply({request,response},fromJSON(request.query.arguments));
				  				if(after) {
				  					result = await after({result,request,response});
				  				}
				  				if(!response.headersSent) {
				  					response.end(toJSON(result));
				  				} else {
				  					response.end();
				  				}
				  			} catch(err) {
				  				response.statusCode = 500;
				  				response.end(err.message);
				  			}
				  			if(done) {
				  				done({result,request,response});
				  			}
				  			return;
				  		}
				  	}
				  } else if(this.functions.request) { // request hander added
				  	await this.functions.request.call({request,response},request.pathname);
				  	if(response.finished) return;
				  }
					if(middleware) {
						complete();
					} else { 
						response.statusCode = 404;
						response.end("Not Found");
					}
				}
				if(done) {
					done({result,request,response});
				}
			};
			if(middleware) {
				return handler;
			}
			this.server = createServer(handler);
		}
		disable(key) {
			this.set(key,false);
		}
		disabled(key) {
			return this.get(key)===false;
		}
		enable(key) {
			this.set(key,true);
		}
		enabled(key) {
			return this.get(key)===true;
		}
		engine(extension,renderFunction) {
			this.engines[extension] = renderFunction;
		}
		listen(port) {
			this.server.listen(port, err => {
				if(err) {
					console.log(err);
				}
				console.log(`A FOS is listening on ${port}`);
			})
		}
		param(params,callback) {
			if(!this.params) {
				this.params = {};
			}
			if(Array.isArray(params)) {
				params.slice().forEach(param => this.params[`:${param}`] = callback);
			} else {
				this.params[`:${params}`] = callback;
			}
		}
		set(name,value) {
			this.settings[name] = value;
		}
		route(path) {
			if(!this.functions.request) {
				this.functions.request = FOS.request;
			}
			const route = {path,all:[],delete:[],get:[],head:[],patch:[],post:[],put:[]};
			this.routes.push(route);
			const proxy = new Proxy(route,{
				get(target,property) {
					if(!VERBS.includes(property)) throw new Error(`${property} is not an HTTP verb or 'all'`);
					return (...callbacks) => { target[property] = callbacks; return proxy; }
				}
			});
			return proxy;
		}
		static(path,{location=".",defaultFile="index.html",mimeTypes={}}={}) {
			mimeTypes = Object.assign({html:"text/html",js:"application/javascript"},mimeTypes);
			let fs,
				normalize;
			try {
				if(typeof(require)==="function") {
					fs = require("fs");
					normalize = require("path").normalize;
				}
			} catch(e) { ; }
			if(!fs || !normalize) return; // no-op if not on server where require("fs") works
			this.route(path).get(async (request,response) => {
				if(response.headersSent) return;		
				let url = request.pathname.substring(path.length);
				if(url.length===0) url = defaultFile;
				else if(url[url.length-1]==="/") url += defaultFile;
				const extension = url.split(".").pop();
				return new Promise(resolve => {
					location = normalize(__dirname + location + "/" + url);
					fs.readFile(url, function(err, data){
		        if(err) {
		          response.writeHead(404, {'Content-Type': 'text/plain'});
		          response.write("Not Found");
		        } else {
		          if(mimeTypes[extension]) {
		          	response.writeHead(200, {'Content-Type':mimeTypes[extension]});
		          } 
		          response.write(data);
		        }
		        response.end();
		        resolve();
		      });
				});
			});
		}
		use(pathOrCallback,...callbacks) {
			if(typeof(pathOrCallback)==="function") {
				callbacks.unshift(pathOrCallback);
				pathOrCallback = () => true;
			}
			this.route(pathOrCallback).all(async (request,response,next) => {
					for(const cb of callbacks) {
						if("route"===await runCallback(cb,request,response)) break;
					}
					next();
				});
			return this;
		}
		static fosify(app,functions,options) {
			app.path("/fos").get(new FOS(functions,options));
		}
		static async request(path) {
			const {request,response} = this,
				fos = request.fos,
				uparts = path.split("/"),
				params = Object.assign({},fos.params);
			for(const route of fos.routes) {
				const path = route.path,
					type = typeof(path),
					pparts = type==="string" ? path.split("/") : [];
				let result;
				for(let i=0;i<pparts.length && i<uparts.length;i++) {
					const ppart = pparts[i],
						upart = uparts[i];
					if(params[ppart]) {
						result = await runCallback(params[ppart],request,response,uparts[i]);
						delete params[ppart];
						if(result==="route") break;
					} else if(ppart && ppart!==upart) {
						result="route";
						break;
					}
				}
				if(result==="route" || pparts.length>uparts.length) continue;
				if((type==="function" && path(request)) || (type==="object" && path instanceof RegExp && path.test(request.pathname)) || (type==="string" && path.indexOf(request.pathname.substring(0,path.length)===0))) {
					for(const callback of route.all) {
						result = await runCallback(callback,request,response);
						if(result==="route") {
							result = null;
							break;
						}
						if(result==="done") {
							return;
						}
					}
					const verb = request.method.toLowerCase();
					if(route[verb]) {
						for(const callback of route[verb]) {
							result = await runCallback(callback,request,response);
							if(result==="route") {
								result = null;
								break;
							}
							if(result==="done") {
								return;
							}
						}
					}
				}
			}
		}
	}
	VERBS.forEach(key => {
			FOS.prototype[key] =	function(path,...callbacks) {
				return this.route(path)[key](...callbacks);
			}
	});
	FOS.prototype.get = function(pathOrKey,...callbacks) {
		if(typeof(pathOrKey)==="string" && callbacks.length===0) {
			return this.settings[pathOrKey];
		}
		return this.route(pathOrKey).get(...callbacks);
	}
	
	module.exports = FOS;

}).call(this);