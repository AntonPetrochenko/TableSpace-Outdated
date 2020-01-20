const WebSocket = require('ws');
 
const wss = new WebSocket.Server({ port: 31442 });
clientIdIncrement = 0;

connections = []
wss.on('connection', function connection(ws) {
	
	ws.on('message', function incoming(message) {
		message = JSON.parse(message)
		connections.forEach( (client, index) => { //Отправляем ответ каждому клиенту, client = цель отправителя, index = индекс отправителя
				if (client !== ws) {
					reply = [
						'CursorMove',
						connections.indexOf(ws),
						message
					]
					client.send(JSON.stringify(reply))
				}
			}
		)
	});

	
	//Конструирование HELO! пакета
	userlist = []
	connections.forEach( (connection,index) => {
			userlist.push([
				index]
			)
		}
	)
	
	
	connectionMessage = [
		"HELO!",
		userlist
	]
	connections.push(ws)
	console.log(connections.indexOf(ws))
	ws.send(JSON.stringify(connectionMessage)); //HELO! был отправлен, отправляем остальным пользователям UserJoin
	connections.forEach( (client, index) => {
			if (client !== ws) {
				reply = [
					'UserJoin',
					[connections.indexOf(ws)],
				]
				client.send(JSON.stringify(reply))
			}
		}
	)
	console.log('Sent HELO!')
	
	//Только теперь добавляем нового пользователя в список, чтобы он не получал данные о своём же входе

});