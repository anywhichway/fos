(function() {
	const http = require("http"),
		querystring = require("querystring");
	
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
					accum += `"${key}":(...args) => {return fetch("${server}/${parent}${key}?"+encodeURIComponent(toJSON(args)),fos._options).then(response => response.text().then(text => { delete fos._options; if(response.ok) { return text; } throw new Error(response.status + " " + text); })).then(text => fromJSON(text,true));}`
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
		
	class FOS {
		constructor(functions,{allow,name,before,after,done}={}) {
			this.functions = functions;
			this.properties = {};
			const requestHandler = async (request, response) => {
				request.fos = this;
				if(allow) {
					response.setHeader("Access-Control-Allow-Origin",allow);
				}
				if(before) {
					await before({request,response});
				}
				if(!response.headersSent) {
					let result;
					if(request.url==="/") {
				  	response.setHeader("Content-Type","text/javascript");
				  	response.end(`${name ? "const " + name + " = " : ""}${toScript(this.functions,{server:(request.secure ? "https://" : "http://" ) + request.headers.host})};`);
				  } else if(request.url==="favicon.ico") {
				  	;
				  } else {
				  	const [path,args] = request.url.split("?"),
				  		parts = path.substring(1).split(".");
				  	let node = this.functions,
				  		key;
				  	while((key = parts.shift()) && (node = node[key])) {
				  		if(parts.length===0) {
				  			try {
				  				result = await node.apply({request,response},fromJSON(querystring.unescape(args)));
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
				  }
					if(this.functions.request===FOS.request) {
						await this.functions.request.call({request,response},request.url);
						if(response.headersSent) return;
					}
				  response.statusCode = 404;
					response.end("Not Found");
				} else {
					response.end();
				}
				if(done) {
					done({result,request,response});
				}
			};
			this.server = http.createServer(requestHandler);
		}
		get(name) {
			return this.properties[name];
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
			this.properties[name] = value;
		}
		route(path) {
			if(!this.routes) {
				this.routes = [];
			}
			const route = {path};
			this.routes.push(route);
			const proxy = new Proxy(route,{
				get(target,property) {
					if(!["all","delete","get","head","patch","post","put"].includes(property)) throw new Error(`${property} is not an HTTP verb or 'all'`);
					return cb => { target[property] = cb; return proxy; }
				}
			});
			return proxy;
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
		static async request(path) {
			const {request,response} = this,
				fos = request.fos,
				uparts = path.split("/"),
				params = Object.assign({},fos.params);
			for(const route of fos.routes) {
				const type = typeof(route.path),
					pparts = type==="string" ? route.path.split("/") : [];
				let result;
				for(let i=0;i<pparts.length && i<uparts.length;i++) {
					const ppart = pparts[i],
						upart = uparts[i];
					if(params[ppart]) {
						result = await runCallback(params[ppart],request,response,uparts[i]);
						delete params[ppart];
						if(result==="route") break;
					} else if(ppart!==upart) {
						result="route";
						break;
					}
				}
				if(result==="route" || pparts.length>uparts.length) continue;
				if((type==="function" && route.path(request)) || (type==="object" && route.path instanceof RegExp && route.path.test(request.url)) || (type==="string" && route.path.indexOf(request.url.substring(0,route.path.length)===0))) {
					if(route.all) result = await runCallback(route.all,request,response);
					if(result==="route") continue;
					const verb = request.method.toLowerCase();
					if(route[verb]) result = await runCallback(route[verb],request,response);
				}
			}
		}
	}
	
	module.exports = FOS;

}).call(this);