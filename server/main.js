const WebSocket = require('ws');
 
const wss = new WebSocket.Server({ port: 31442 });
clientIdIncrement = 0;

connections = []
wss.on('connection', function connection(ws) {
	
	ws.on('message', function incoming(message) {
		message = JSON.parse(message)
		if (message[0] == "CursorMove") { 
			connections.forEach( (client, index) => { //Отправляем ответ каждому клиенту, client = цель отправителя, index = индекс отправителя
					if (client !== ws) {
						reply = [
							'CursorMove',
							connections.indexOf(ws),
							message[1]
						]
						client.send(JSON.stringify(reply))
					}
				}
			)
		}
		if (message[0] == "ChatMessage") {
			connections.forEach( (client, index) => { //Отправляем ответ каждому клиенту, client = цель отправителя, index = индекс отправителя
					reply = [
						'ChatMessage',
						message[1]
					]
					client.send(JSON.stringify(reply))
				}
			)
			console.log("Chat")
		}
	});
	ws.on('close', function handleClose() {
		leavingUser = connections.indexOf(ws)
		
		connections.forEach( (client) => {
			reply = [
				'UserLeft',
				leavingUser
			]
			client.send(JSON.stringify(reply))
		} )
		
		delete connections[leavingUser]
	})
	
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
	//Только теперь добавляем нового пользователя в список, чтобы он не получал данные о самом себе в списке существующих пользователей
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
	
	

});