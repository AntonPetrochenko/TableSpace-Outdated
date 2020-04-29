const WebSocket = require('ws');
var app = require('express')
 
const wss = new WebSocket.Server({ port: 31442 },"TableSpace",{perMessageDeflate: true});
clientIdIncrement = 0;

connections = []
tableObjects = []

class Widget {
	constructor(x,y,type) {
		this.x = x
		this.y = y
		this.type = type
	}
}

class DebugBox extends Widget {
	constructor() {
		super(100,100,"debug_box")
	}
}

wss.on('connection', function connection(ws) {
	
	ws.on('message', function incoming(message) {
		message = JSON.parse(message)
		if (message[0] == "CursorMove") { 
			broadcastOthers([
			       		 'CursorMove',
					 connections.indexOf(ws),
					 message[1]
					],ws)

		}
		if (message[0] == "ChatMessage") {
			broadcastAll([
				      'ChatMessage',
				       message[1]
				     ]
			)
		}
		if (message[0] == "CreateObject") {
			newObject = new Widget(message[1],message[2])
			tableObjects.push(newObject)
			broadcastAll(["CreateObject",tableObjects.indexOf(newObject),newObject])
		}
		if (message[0] == "ObjectMove") {
			broadcastOthers([
				"ObjectMove",
				message[1],
				message[2],
				message[3]
			],ws)
		}
	});
	ws.on('close', function handleClose() {
		leavingUser = connections.indexOf(ws)
		
		broadcastAll([
				'UserLeft',
				leavingUser
			])
		
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
		userlist,
		tableObjects
	]
	connections.push(ws)
	console.log(connections.indexOf(ws))
	ws.send(JSON.stringify(connectionMessage)); //HELO! был отправлен, отправляем остальным пользователям UserJoin
	broadcastOthers([
					'UserJoin',
					[connections.indexOf(ws)],
				],ws)
	console.log('Sent HELO!')
	
	

});

function broadcastOthers(message,sender) {
	connections.forEach( (client, index) => {
			if (client !== sender) {
				client.send(JSON.stringify(message))
			}
		}
	)
}
function broadcastAll(message) {
	connections.forEach( (client, index) => {
			client.send(JSON.stringify(message))
		}
	)
}