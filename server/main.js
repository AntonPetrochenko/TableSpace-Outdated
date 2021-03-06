const { Group, PictureBox, PdfBox, Drawing, User } = require("./classes");

var fs = require('fs');
var bcrypt = require('bcrypt')
var hat = require('hat')
var http = require('http')
var https = require('https')
var express = require('express')

var multer = require('multer')
var cookieparser = require('cookie-parser')


var app = express()

app.use(cookieparser())
var storage = multer.diskStorage({
	destination: function (req, file, cb) {
	  cb(null, 'uploads/')
	},
  })
var multer_upload = multer({storage: storage})

//Let's get the show on the road
//Checking if database exists
if (!fs.existsSync('./db/tablespace.sqlite3')) {
	fs.copyFileSync('./db/db-init.sqlite3','./db/tablespace.sqlite3')
	firstStart = true //If it doesn't exist assuming this is a fresh install
	console.log('Assuming furst launch: tablespace.sqlite3 is missing, copying database from db-init.sqlite3')
}

const sqlite3 = require('sqlite3').verbose();
let db = new sqlite3.Database('./db/tablespace.sqlite3', (err) => {
	if (err) {
		console.error(err.message);
	} else {
		console.log('Database up and running!');
	}	
});
exports.db = db;

var groupList = [];
exports.groupList = groupList;

db.serialize(() => {
	db.all('SELECT * FROM groups',(err,rows) => {
		rows.forEach(row => {
			groupList[row.id] = new Group(
				row.id,
				row.displayName,
				parseBooleanString(row.canVideo),
				parseBooleanString(row.canAudio),
				parseBooleanString(row.canChat),
				parseBooleanString(row.canTable)
			)
		})
		console.log('Loaded permission groups')
		
		if (fs.existsSync('fullchain.pem') && fs.existsSync('privkey.pem')) {

			console.log('Found fullchain.pem and privkey.pem')

			var privateKey  = fs.readFileSync('privkey.pem', 'utf8');
			var certificate = fs.readFileSync('fullchain.pem', 'utf8');

			server = https.createServer({key: privateKey, cert: certificate},app).listen(31449)

			//Initializing WebSocket against app
			var expressWs = require('express-ws')(app,server)
			app.ws('/ws',handleWebsocket);

		} else {
			
			server = http.createServer(app).listen(31442)
			var expressWs = require('express-ws')(app,server)
			app.ws('/ws',handleWebsocket);
			
			console.error('Warning: Missing privkey.pem and/or fullchain.pem, starting in NON-SECURE MODE. Audio/video communication is not available!')
			console.log('Warning: Missing privkey.pem and/or fullchain.pem, starting in NON-SECURE MODE. Audio/video communication is not available!')
		}
		
	})
})

const { guestApi } = require("./guestApi");
const { pubApi } = require("./pubApi");
const { modApi } = require("./modApi");
const { fileUpload } = require("./fileUpload");



//app.use('/uploads',express.static('uploads'))

app.post('/api/:requesttype',multer_upload.none(), guestApi) 

app.get('/api/:requesttype',verifyModeratorAccess,pubApi)

app.post('/modapi/:requesttype',verifyModeratorAccess,multer_upload.none(),modApi)

app.get('/uploads/:path',multer_upload.any(), (req,res,next) => 
	{
		fs.createReadStream('./uploads/' + req.params.path).pipe(res);
	}
)

app.post('/upload', multer_upload.single('upload'), fileUpload() )



app.use('/',express.static('../client'))

clientIdIncrement = 0; //Is this used?

connections = []
tableObjects = []
tableDrawings = []

async function ws_incoming(message) { //Network packet handlers
	ws = this
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
					message[1],
					ws.user.displayName,
					ws.user.color
				 ]
		)
	}
	if (message[0] == "CreateObject") {
		objectId = message[1]
		object = db.get("SELECT * FROM files WHERE id = ?",[objectId],(err,row) => {
			if (err) {
				console.error(error.message);
				return
			}	

			console.log("Requested a " + row.mimetype)	
			var newObject	

			if (row.mimetype.indexOf('image/') > -1) {
				newObject = new PictureBox(row.path)
			}
			if (row.mimetype == "application/pdf") {
				newObject = new PdfBox(row.path)
			}

			if (newObject) {
				tableObjects.push(newObject)
				newObject.networkId = tableObjects.indexOf(newObject)
				tableDrawings[newObject.networkId] = []
				broadcastAll(["CreateObject",newObject])
			} else {
				//unsupported mimetype
			}
		})
	}
	if (message[0] == "DeleteObject") {
		broadcastAll(["DeleteObject",message[1]])
		delete tableObjects[message[1]]
	}
	if (message[0] == "UpdateSize") {
		broadcastOthers(["UpdateScale",message[1],message[2],message[3]],ws)
		tableObjects[message[1]].displayWidth = message[2]
		tableObjects[message[1]].displayHeight = message[3]
		
	}
	if (message[0] == "ObjectMove") {
		broadcastOthers([
			"ObjectMove",
			message[1],
			message[2],
			message[3]
		],ws)
		if (tableObjects[message[1]]) {
			tableObjects[message[1]].x = message[2]
			tableObjects[message[1]].y = message[3]
		}
		
	}
	if (message[0] == "RequestFiles") {
		db.all("SELECT * from files", [], (err, rows) => {
			filesArray = []
			if (err) {
				console.log('Error during FileList construction')
				console.error(err.message)
				return;
			}
			rows.forEach((row) => {
				filesArray.push({
					id: row.id,
					timestamp: row.creationTimestamp,
					name: row.displayName
				})
			});
			sendPacket(ws,["FileList",filesArray])
		  });	
	}
	if (message[0] == "Drawing") {
		let drawing =  new Drawing(message[2],message[3],message[4],message[1],message[5],message[6])
		tableDrawings[message[1]].push(drawing)
		broadcastOthers([
			'Drawing',
			message[1],
			drawing
		],ws)
	}

	if (message[0] == "EraseDrawing") {
		//Search for the appropriate serverside drawing to delete
		tableDrawings[message[1]].forEach(drawing => {
			if (drawing.eraseId == message[2]) {
				drawing.points = []
			}
		})
		broadcastOthers([
			'EraseDrawing',
			message[1],
			message[2]
		],ws)
	}

	if (message[0] == "SetPdfPage") {
		tableObjects[message[1]].currentPage = message[2]
		broadcastOthers([
			'SetPdfPage',
			message[1],
			message[2]
		],ws)
	}
}

function ws_handleClose(ws) {
	leavingUser = connections.indexOf(this)
	
	broadcastAll([
			'UserLeft',
			leavingUser
		])
	
	delete connections[leavingUser]
}

function handleWebsocket(ws,req) { //Real time functionality starts here

	db.get('SELECT * FROM users WHERE authToken = $token',{
		$token: req.cookies.token
	},(err,row) => {
		if (row) {
			ws.user = new User(
				row.id,
				row.displayName,
				row.permissionLevel,
				row.connectPermissions,
				row.color,
				row.profilePicturePath,
				groupList[row.userGroup]
			)
			//Building the HELO! packet
			//includes current user list and current table objects
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
				tableObjects,
				ws.user.displayName,
				ws.user.color,
				ws.user.getPermissions(),
				ws.user.adminPermissions,
				tableDrawings
			]
			connections.push(ws)
			sendPacket(ws,connectionMessage); //HELO! sent, sending UserJoin packet to the rest
			broadcastOthers([
							'UserJoin',
							[connections.indexOf(ws)],
						],ws)
			console.log('Accepted connection from user ' + row.login)
		} else {
			console.log('Someone attempted unauthorized access!')
			ws.close()
		}
	})
	ws.on('message', ws_incoming);
	ws.on('close', ws_handleClose)
	
}

//Packet helper functions

function sendPacket(ws,message) {
	if (ws.readyState == 1) {
		ws.send(JSON.stringify(message))
	}
}

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

function sendPacketByDBUID(uid,message) {
	connections.forEach((client,index) => {
		if (client.user.id == uid) {
			sendPacket(client,message)
		}
	})
}

function sendPacketByGroupUID(gid,message) {
	connections.forEach((client,index) => {
		if (client.user.getGroupId() == gid) {
			sendPacket(client,message)
		}
	})
}


function parseBooleanString(string) {
	if (string == "true") {
		return true
	} else {
		return false
	}
}

function verifyAdminAccess(req,res,next) {
	db.get('SELECT permissionLevel FROM users WHERE authToken = $token',{
		$token: req.cookies.token
	},(err,row) => {
		if (row && row.permissionLevel > 1) {
			next()
		} else {
			res.json({
				status: "failure",
				reason: "unverified"
			})
		}
	})
}

function verifyModeratorAccess(req,res,next) {
	db.get('SELECT permissionLevel FROM users WHERE authToken = $token',{
		$token: req.cookies.token
	},(err,row) => {
		if (row && row.permissionLevel > 0) {
			console.log('Verified moderator')
			next()
		} else {
			console.log('Unverified moderator level access!')
			res.json({
				status: "failure",
				reason: "unverified"
			})
		}
	})
}