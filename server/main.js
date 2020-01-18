const WebSocket = require('ws');
 
const wss = new WebSocket.Server({ port: 31442 });
clientIdIncrement = 0;

connections = []
wss.on('connection', function connection(ws) {
	
	ws.on('message', function incoming(message) {
		message = JSON.parse(message)
		connections.forEach( (client, index) => {
				if (client !== ws) {
					reply = [
						'CursorMove',
						index,
						message
					]
					client.send(JSON.stringify(reply))
				}
			}
		)
		
	});


	//Конструирование HELO! пакета
	connections.push(ws)
	userlist = []
	connections.forEach( (connection,index) => {
			userlist.push([
				index
			])
		}
	)
	
	console.log('Sent HELO!')
	connectionMessage = [
		"HELO!",
		userlist
	]
	ws.send(JSON.stringify(connectionMessage));
});