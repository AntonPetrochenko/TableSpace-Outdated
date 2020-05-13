//const WebSocket = require('ws');
var express = require('express')
var multer = require('multer')

var app = express()

var expressWs = require('express-ws')(app)

var storage = multer.diskStorage({
	destination: function (req, file, cb) {
	  cb(null, 'uploads/')
	},
	filename: function (req, file, cb) {
	  cb(null, file.originalname)
	}
  })
var upload = multer({storage: storage})
var fs = require('fs');
 
//const wss = new WebSocket.Server(,"TableSpace");
clientIdIncrement = 0;

connections = []
tableObjects = []

class Widget {
	x = 800
	y = 450
	constructor(type) {
		this.type = type
	}
}

class DebugBox extends Widget {
	constructor() {
		super("debug_box")
	}
}

class PictureBox extends Widget {
	constructor(filename) {
		super("picture")
		this.filename = filename
	}
}

const asyncHandler = fn => (req, res, next) =>
  Promise
    .resolve(fn(req, res, next))
    .catch(next)

app.use('/',express.static('../client'))
app.use('/uploads',express.static('uploads'))

app.post('/upload', upload.single('upload'), asyncHandler( (req, res, next) => {
	const file = req.file
	if (!file) {
		const error = new Error('Please upload a file')
		error.httpStatusCode = 400
		return next(error)
	}
	res.send("Success")
	newObject = new PictureBox(file.path)
	tableObjects.push(newObject)
	newObject.networkId = tableObjects.indexOf(newObject)
	broadcastAll(["CreateObject",newObject])
	
	
  }) )

app.ws('/ws',function(ws,req) {
//wss.on('connection', function connection(ws) {
	
	ws.on('message', async function incoming(message) {
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
			newObject = new PictureBox(message[1])
			tableObjects.push(newObject)
			newObject.networkId = tableObjects.indexOf(newObject)
			broadcastAll(["CreateObject",newObject])
		}
		if (message[0] == "ObjectMove") {
			broadcastOthers([
				"ObjectMove",
				message[1],
				message[2],
				message[3]
			],ws)
			tableObjects[message[1]].x = message[2]
			tableObjects[message[1]].y = message[3]
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
	sendPacket(ws,connectionMessage); //HELO! был отправлен, отправляем остальным пользователям UserJoin
	broadcastOthers([
					'UserJoin',
					[connections.indexOf(ws)],
				],ws)
	console.log('Sent HELO!')
	
	

});

function broadcastOthers(message,sender) {
	connections.forEach( (client, index) => {
			if (client !== sender) {
				sendPacket(client,message)
			}
		}
	)
}
function broadcastAll(message) {
	connections.forEach( (client, index) => {
			sendPacket(client,message)
		}
	)
}

function sendPacket(ws,message) {
	if (ws.readyState == 1) {
		ws.send(JSON.stringify(message))
	}
}

app.listen(31442)