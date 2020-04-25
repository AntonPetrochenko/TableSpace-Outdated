var socket
var canvasLayer
var chatLayer
var chatBox
var cursor
var mouse = {clientX:0,clientY:0}
var mouseUpdate = true
var lastReply

function updateCursorPosition(e) {
	mouse = e
	mouseUpdate = true
	e.preventDefault()
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


function addObject() {
	newGroup = canvasLayer.group()
	newGroup.rect(200,200).draggable()
}


function initcursors() {
	
	canvasLayer = SVG('#viewport')
	document.body.addEventListener('mousemove',updateCursorPosition)
	
	socket = new WebSocket("ws://" + document.getElementById("ip").value + ":31442", ['TableSpace'])
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
	newCursor = []
	img = canvasLayer.image('cursor.png')
	newCursor.img = img
	userCursors[cursor[0]] = newCursor
}

function setClientCursorPosition(uid,vec2arr) {
	userCursors[uid].img.animate(100,0,'now').ease('>').move(vec2arr[0],vec2arr[1])
}