var socket
var canvasLayer
var chatLayer
var chatBox
var cursor
var mouse = {clientX:0,clientY:0}
var mouseUpdate = true
var lastReply
var dragInterval
var dragIntervalObject = {}

tableObjects = []

function updateCursorPosition(e) {
	var m = canvasLayer.node.getScreenCTM();

	// note: assumes the root is an <svg> element, replace 
	// document.documentElement with your <svg> element.
	var p = canvasLayer.node.createSVGPoint(); 

	p.x = e.clientX;
	p.y = e.clientY;
	p = p.matrixTransform(m.inverse());
	mouse = p
	mouseUpdate = true
	e.preventDefault()
}	

function sendCursorPosition() {
	if (mouseUpdate) {
		mouseUpdate = false
		pos = [mouse.x,mouse.y]
		message = JSON.stringify(
			[
				"CursorMove",
				pos
			]
		)
		socket.send(message)
	}
}

function sendDraggablePosition() {
	message = JSON.stringify([
		"ObjectMove",
		tableObjects.indexOf(dragIntervalObject.element),
		dragIntervalObject.x,
		dragIntervalObject.y
	])
	
	socket.send(message)
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
	message = JSON.stringify(
		[
			"CreateObject",
			"debug_box"
		]
	)
	socket.send(message)
}


function initcursors() {

	chatBox = document.getElementById("chatinput")
	chatLayer = document.getElementById("chatport")
	canvasLayer = SVG('#viewport')
	document.body.addEventListener('mousemove',updateCursorPosition)
	
	socket = new WebSocket("ws://" + document.getElementById("ip").value + ":31442/ws")
	socket.onmessage = function (reply) {
		message = JSON.parse(reply.data)
		if (message[0] == "HELO!") {
			message[1].forEach( (cursor) => {
					createUserCursor(cursor)
				}
			)
			setInterval(sendCursorPosition,100)
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
		if (message[0] == "CreateObject") {
			
			newSvg = canvasLayer.rect(200,200)
			newSvg.draggable().on("dragstart",e => {dragInterval = setInterval(sendDraggablePosition,50)})
			newSvg.on("dragend",e => {clearInterval(dragInterval)})
			newSvg.on("dragmove", e => {
				const { handler, box, el } = e.detail

				dragIntervalObject.x = box.x
				dragIntervalObject.y = box.y
				dragIntervalObject.element = handler.el
			})
			tableObjects[message[1]] = newSvg

		}
		if (message[0] == "ObjectMove") {
			tableObjects[message[1]].animate(100,0,'now').ease('>').move(message[2],message[3])
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
	userCursors[uid].img.animate(100,0,'now').ease('-').move(vec2arr[0],vec2arr[1])
}