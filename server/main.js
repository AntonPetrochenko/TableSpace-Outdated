
//helper function but not sure i'll be using it at all
const asyncHandler = fn => (req, res, next) =>
  Promise
    .resolve(fn(req, res, next))
    .catch(next)

var express = require('express')
var app = express()

var multer = require('multer')

var storage = multer.diskStorage({
	destination: function (req, file, cb) {
	  cb(null, 'uploads/')
	},
  })
var multer_upload = multer({storage: storage})




var fs = require('fs');
//Let's get the show on the road
//Checking if database directory exists
var firstStart = false
if (!fs.existsSync('./db/tablespace.sqlite3')) {
	fs.copyFileSync('./db/db-init.sqlite3','./db/tablespace.sqlite3')
	firstStart = true //If it doesn't exist assuming this is a fresh install
}

if (firstStart) {
	//Copy the default database template
	fs.copyFileSync('./db/db-init.sqlite3','./db/tablespace.sqlite3')
}

const sqlite3 = require('sqlite3').verbose();
let db = new sqlite3.Database('./db/tablespace.sqlite3', (err) => {
	if (err) {
		console.error(err.message);
	} else {
		console.log('Database up and running!');
	}	
});





//app.use('/uploads',express.static('uploads'))

app.get('/uploads/:path', (req,res,next) => 
	{
		//res.setHeader("content-type", "some/type");
		fs.createReadStream('./uploads/' + req.params.path).pipe(res);
	}
)

app.post('/upload', multer_upload.single('upload'), asyncHandler( (req, res, next) => {
	const file = req.file
	if (!file) {
		const error = new Error('Please upload a file')
		error.httpStatusCode = 400
		return next(error)
	}
	res.send("Success")
	db.run('INSERT INTO files (path, mimetype) VALUES ($path, $type)',{
				$path: '/uploads/' + file.filename, 
				$type: file.mimetype
			},
		(err) => {console.error(err)
		}
	)
  }) )

//Initializing WebSocket against app
var expressWs = require('express-ws')(app)

app.use('/',express.static('../client'))

clientIdIncrement = 0; //Is this used?

connections = []
tableObjects = []

class Widget {
	x = 800
	y = 450
	constructor(type) {
		this.type = type
		this.currentScale = 1
	}
}

class PictureBox extends Widget {
	constructor(filename) {
		super("picture")
		this.filename = filename
	}
}

class PdfBox extends Widget {
	currentPage = 1
	constructor(filename) {
		super("pdf") 
		this.filename = filename
	}
}



app.ws('/ws',function(ws,req) { //Real time functionality starts here
	
	ws.on('message', async function incoming(message) { //Network packet handlers
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
			tableObjects[message[1]].x = message[2]
			tableObjects[message[1]].y = message[3]
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
	});
	ws.on('close', function handleClose() {
		leavingUser = connections.indexOf(ws)
		
		broadcastAll([
				'UserLeft',
				leavingUser
			])
		
		delete connections[leavingUser]
	})
	
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
		tableObjects
	]
	connections.push(ws)
	console.log(connections.indexOf(ws))
	sendPacket(ws,connectionMessage); //HELO! sent, sending UserJoin packet to the rest
	broadcastOthers([
					'UserJoin',
					[connections.indexOf(ws)],
				],ws)
	console.log('Sent HELO!')
});

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


app.listen(31442)