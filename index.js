const http = require('http');
http.createServer(function(request, response)
{
	response.writeHead(200, {'Content-Type': 'text/plain'});
	response.end('Bot is online!');
}).listen(8000);

console.log("Botを起動しました。");
require('./jrpg.js');
require('./aooni.js');
