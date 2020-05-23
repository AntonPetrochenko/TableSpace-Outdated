var socket
var canvasLayer
var chatLayer
var chatBox
var cursor
var mouse = {clientX:0,clientY:0}
var mouseUpdate = true
var lastReply
var activeInteractionUI
var activeInteractionUIOwner
var dragInterval
var dragIntervalObject = {}

tableObjects = []

function toggleDrawer(e) {
	var drawer = e.parentElement
	if (drawer.classList.contains("hidden")) {
		drawer.classList.remove("hidden")
		drawer.classList.add("shown")
	} else {
		drawer.classList.remove("shown")
		drawer.classList.add("hidden")
	}
}

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
		console.log(message)
		if (message[0] == "HELO!") {
			message[1].forEach( (cursor) => {
					createUserCursor(cursor)
				}
			)
			handleNewObjects(message[2])
			setInterval(sendCursorPosition,100)
			return
		}
		lastReply = reply
		if (message[0] == "CursorMove") {
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
			newObject = message[1]

			handleNewObjects([newObject])
		}
		if (message[0] == "DeleteObject") {
			tableObjects[message[1]].node.remove()
			delete tableObjects[message[1]]
		}
		if (message[0] == "ObjectMove") {
			tableObjects[message[1]].animate(100,0,'now').ease('>').move(message[2]+e.rx,message[3]+e.ry)
			tableObjects[message[1]].children().forEach(e => {e.animate(100,0,'now').ease('>').move(message[2]+e.rx,message[3]+e.ry)} )
		}
}

	
}

userCursors = []
function handleNewObjects(objectList) {
	objectList.forEach(object => {
		newSvg = canvasLayer.group()

		newSvg.currentScale = object.currentScale
		if (object.type == "picture") {
			image = newSvg.image(object.filename)
			image.rx = 0
			image.ry = 0
			createInteractionUI
		}

		newSvg.move(object.x,object.y)
		newSvg.dblclick(showInteractionUI)

		newSvg.node.dataset.networkId = object.networkId
		newSvg.networkId = object.networkId
		tableObjects[object.networkId] = newSvg


		newSvg.draggable().on("dragstart", e => { dragInterval = setInterval(sendDraggablePosition, 50) })
		newSvg.on("dragend", e => { clearInterval(dragInterval) })
		newSvg.on("dragmove", e => {
			const { handler, box, el } = e.detail
			e.preventDefault()
			handler.el.move(box.x,box.y)
			handler.el.children().forEach(
                e => {
                	e.move(box.x+e.rx,box.y+e.ry)
                }
			)
			handler.move(box.x, box.y)
			dragIntervalObject.x = box.x
			dragIntervalObject.y = box.y
			dragIntervalObject.element = handler.el
		})

		newSvg.interactionUI = createInteractionUI(newSvg)
	})
}

//Фабричный метод новых курсоров пользователей
function createUserCursor(cursor) {
	newCursor = []
	img = canvasLayer.image('cursor.png')
	newCursor.img = img
	userCursors[cursor[0]] = newCursor
}

function setClientCursorPosition(uid,vec2arr) {
	userCursors[uid].img.animate(100,0,'now').ease('-').move(vec2arr[0],vec2arr[1])
}

function createInteractionUI(target) {
	interactionUI = target.foreignObject(100,0)

	interactionUI.rx = 10
	interactionUI.ry = 10
	interactionUI.move(target.children()[0].x()+10,target.children()[0].y()+10)

	buttonTemplate = document.querySelector('#InteractionUI')
	interactionUI.node.dataset.networkId = target.networkId
	interactionUI.add(buttonTemplate.content.cloneNode(true))

	console.log("Created UI")

	return interactionUI
}

function showInteractionUI() {
	this.interactionUI.animate(700,0,'now').ease('<').attr({width: 100, height: 500})
}

function hideInteractionUI(target) {
	tableObjects[target.parentElement.dataset.networkId].interactionUI.animate(700,0,'now').ease('<').attr({width: 100, height: 0})
}

function buttonDeleteObject(button) {
	message = JSON.stringify(
		[
			"DeleteObject",
			button.parentElement.dataset.networkId
		]
	)
	socket.send(message)
}

function buttonScaleUp(button) {
	targetNetworkId = Number(button.parentElement.dataset.networkId)
	targetElement = tableObjects[targetNetworkId]
	targetElement.currentScale += 0.1

	targetContent = targetElement.children()[0].node
	targetContent.width.baseVal.value *= 1.1
	targetContent.height.baseVal.value *= 1.1


	//targetElement.scale(targetElement.currentScale,0,0)
	message = JSON.stringify(
		[
			"UpdateScale",
			targetNetworkId,
			targetElement.currentScale
		]
	)
	socket.send(message)
}

function buttonScaleDown(button) {
	targetNetworkId = Number(button.parentElement.dataset.networkId)
	targetElement = tableObjects[targetNetworkId]
	targetElement.currentScale -= 0.1

	targetContent = targetElement.children()[0].node
	targetContent.width.baseVal.value *= 0.9
	targetContent.height.baseVal.value *= 0.9


	//targetElement.scale(targetElement.currentScale,0,0)
	message = JSON.stringify(
		[
			"UpdateScale",
			targetNetworkId,
			targetElement.currentScale
		]
	)
	socket.send(message)
}


const appHeight = () => document.documentElement.style.setProperty('--app-height', `${window.innerHeight}px`)
window.addEventListener('resize', appHeight)
appHeight()