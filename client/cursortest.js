var socket
var cursorLayer
var cursor
var mouse = {clientX:0,clientY:0}
var lastReply


function updateCursorPosition(e) {
	mouse = e
}	

function sendCursorPosition() {
	pos = [mouse.clientX,mouse.clientY]
	message = JSON.stringify(pos)
	socket.send(message)
}

function initcursors() {
	
	cursorLayer = document.getElementById('cursorlayer')
	cursor = document.getElementById("cursor")
	cursorLayer.onmousemove = updateCursorPosition
	
	socket = new WebSocket("ws://localhost:31442")
	socket.onmessage = function (reply) {
	message = JSON.parse(reply.data)
	if (message[0] == "HELO!") {
		message[1].forEach( (cursor) => {
				createUserCursor(cursor)
			}
		)
		setInterval(sendCursorPosition,50)
		return
	}
	
	lastReply = reply
	if (message[0] == "CursorMove") {
		console.log(message)
		setClientCursorPosition(message[1],message[2])
	}
	if (message[0] == "UserJoin") {
		debugger
		createUserCursor(message[1])
	}
}

	
}

userCursors = []
//Конструктор нового курсора пользователя
function createUserCursor(cursor) {
	console.log('Creating a cursor!')
	newCursor = []
	img = document.createElement('img')
	img.src = "cursor.png"
	img.style.position = "absolute"
	img.style.transition = "position: absolute; transition: top 0.05s ease, left 0.05s ease"
	newCursor.img = img
	userCursors[cursor[0]] = newCursor
	cursorLayer.appendChild(newCursor.img)
}
function setClientCursorPosition(uid,vec2arr) {
	userCursors[uid].img.style.left = vec2arr[0]
	userCursors[uid].img.style.top = vec2arr[1]
}