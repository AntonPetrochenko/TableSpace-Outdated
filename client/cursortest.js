var socket
var cursorLayer
var chatLayer
var chatBox
var cursor
var mouse = {clientX:0,clientY:0}
var mouseUpdate = true
var lastReply

function updateCursorPosition(e) {
	mouse = e
	mouseUpdate = true
}	

function sendCursorPosition() {
	if (mouseUpdate) {
		mouseUpdate = false
		pos = [mouse.clientX,mouse.clientY]
		message = JSON.stringify(
			[
				"CursorMove",
				pos
			]
		)
		socket.send(message)
	}
}

function sendchat() {
	message = JSON.stringify(
		[
			"ChatMessage",
			chatBox.value
		]
	)
	socket.send(message)
	chatBox.value = ""
}

function initcursors() {
	
	cursorLayer = document.getElementById('cursorlayer')
	cursor = document.getElementById("cursor")
	cursorLayer.onmousemove = updateCursorPosition
	
	chatLayer = document.getElementById('chatlayer')
	chatBox = document.getElementById("chatinput")
	socket = new WebSocket("ws://" + document.getElementById("ip").value + ":31442")
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
		console.log(message)
		lastReply = reply
		if (message[0] == "CursorMove") {
			console.log(message)
			setClientCursorPosition(message[1],message[2])
		}
		if (message[0] == "UserJoin") {
			createUserCursor(message[1])
		}
		if (message[0] == "UserLeft") {
			userCursors[message[1]].img.remove()
			delete userCursors[message[1]]
		}
		if (message[0] == "ChatMessage") {
			chatLayer.innerHTML = chatLayer.innerHTML + `<div> ${message[1]} </div>`
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
	img.style.transition = "top 0.05s ease, left 0.05s ease"
	newCursor.img = img
	userCursors[cursor[0]] = newCursor
	cursorLayer.appendChild(newCursor.img)
}

function setClientCursorPosition(uid,vec2arr) {
	userCursors[uid].img.style.left = vec2arr[0]
	userCursors[uid].img.style.top = vec2arr[1]
}