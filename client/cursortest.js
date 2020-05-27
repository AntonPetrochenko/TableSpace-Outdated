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
pdf = []
userCursors = []

var formCallbacks = {
	nothing: function nothing() {
		console.log('Did nothing')
	},
	loginSuccess: function loginSuccess() {
		$('#loginScreen').modal('hide')
		init()
	},
}

var userInterface = {
	toggleDrawer: function toggleDrawer(e) {
		var drawer = e.parentElement
		if (drawer.classList.contains("hidden")) {
			drawer.classList.remove("hidden")
			drawer.classList.add("shown")
		} else {
			drawer.classList.remove("shown")
			drawer.classList.add("hidden")
		}
	}
}

var networking = {
	sendCursorPosition: function sendCursorPosition() {
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
	},
	
	sendDraggablePosition: function sendDraggablePosition() {
		message = JSON.stringify([
			"ObjectMove",
			tableObjects.indexOf(dragIntervalObject.element),
			dragIntervalObject.x,
			dragIntervalObject.y
		])
		
		socket.send(message)
	},

	sendChat: function sendchat() {
		message = JSON.stringify(
			[
				"ChatMessage",
				chatBox.value
			]
		)
		socket.send(message)
		chatBox.value = ""
	},

	requestFiles: function requestFiles() {
		message = JSON.stringify(
			[
				"RequestFiles"
			]
		)
		socket.send(message)
	},

	requestObjectCreation: function requestObjectCreation(e) {
		message = JSON.stringify(
			[
				"CreateObject",
				Number(e.dataset.id)
			]
		)
		socket.send(message)
	}
	
}

var debugHax = {
	createUser: function () {
		$('#loginScreen').modal('hide')
		$('#addUser').modal()
	}
}

var tableCursorDisplay = {
	updateCursorPosition: function updateCursorPosition(e) {
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
	},
	setClientCursorPosition: function setClientCursorPosition(uid,vec2arr) {
		userCursors[uid].img.animate(100,0,'now').ease('-').move(vec2arr[0],vec2arr[1])
	}
}

var tableObjectControl = {
	handleNewObjects: function handleNewObjects(objectList) {
		objectList.forEach(object => {
			newSvg = canvasLayer.group()
	
			newSvg.currentScale = object.currentScale
			newSvg.contentType = object.type
			if (object.type == "picture") {
				image = newSvg.image(object.filename)
	
				if (object.displayWidth) {
					image.width(object.displayWidth)
					image.height(object.displayHeight)
				}
				
				image.rx = 0
				image.ry = 0
			}
	
			if (object.type == "pdf") {
				
				newSvg.contentImage = newSvg.image()
				newSvg.contentImage.rx = 0
				newSvg.contentImage.ry = 0
				newSvg.currentPage = object.currentPage
				
				pdfLoader = pdfjsLib.getDocument(object.filename)
				newSvg.loaderPromise = pdfLoader.promise
	
				newSvg.loaderPromise.then(function (pdfObject) {
					this.pdfContent = pdfObject
					setPdfPage(this,1)
				}.bind(newSvg))
				
			}
	
			newSvg.move(object.x,object.y)
			newSvg.dblclick(tableObjectControl.interactionUI.show)
	
			tableObjectControl.makeSyncDraggable(newSvg)
	
			newSvg.node.dataset.networkId = object.networkId
			newSvg.networkId = object.networkId
			tableObjects[object.networkId] = newSvg
	
			newSvg.interactionUI = tableObjectControl.interactionUI.create(newSvg)
			newSvg.interactionUI.front()
		})
	},

	//Фабричный метод новых курсоров пользователей
	createUserCursor: function createUserCursor(cursor) {
		newCursor = []
		img = canvasLayer.image('cursor.png')
		newCursor.img = img
		userCursors[cursor[0]] = newCursor
	},

	makeSyncDraggable: function makeSyncDraggable(newSvg) {
		newSvg.draggable().on("dragstart", e => { dragInterval = setInterval(networking.sendDraggablePosition, 50) })
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
			//handler.move(box.x, box.y)
			dragIntervalObject.x = box.x
			dragIntervalObject.y = box.y
			dragIntervalObject.element = handler.el
		})
	},

	interactionUI: {
		create: function createInteractionUI(target) {
			interactionUI = target.foreignObject(100,0)
		
			interactionUI.rx = 10
			interactionUI.ry = 10
			interactionUI.move(target.children()[0].x()+10,target.children()[0].y()+10)
		
			buttonTemplate = document.querySelector('#InteractionUI-'+target.contentType)
			interactionUI.node.dataset.networkId = target.networkId
			interactionUI.add(buttonTemplate.content.cloneNode(true))
		
			console.log("Created UI")
		
			return interactionUI
		},
		show: function showInteractionUI() {
			this.interactionUI.animate(200,0,'now').ease('<').attr({width: 100, height: 180})
		},
		hide: function hideInteractionUI(target) {
			tableObjects[target.parentElement.dataset.networkId].interactionUI.animate(200,0,'now').ease('<').attr({width: 100, height: 0})
		},
		common: {
			buttonDeleteObject: function buttonDeleteObject(button) {
				message = JSON.stringify(
					[
						"DeleteObject",
						button.parentElement.dataset.networkId
					]
				)
				socket.send(message)
			},

			buttonScaleUp: function buttonScaleUp(button) {
				targetNetworkId = Number(button.parentElement.dataset.networkId)
				targetElement = tableObjects[targetNetworkId]
				targetElement.currentScale += 0.1
			
				targetContent = targetElement.children()[0].node
				targetContent.width.baseVal.value *= 1.1
				targetContent.height.baseVal.value *= 1.1
			
			
				//targetElement.scale(targetElement.currentScale,0,0)
				message = JSON.stringify(
					[
						"UpdateSize",
						targetNetworkId,
						targetContent.width.baseVal.value,
						targetContent.height.baseVal.value
					]
				)
				socket.send(message)
			},
			
			buttonScaleDown: function buttonScaleDown(button) {
				targetNetworkId = Number(button.parentElement.dataset.networkId)
				targetElement = tableObjects[targetNetworkId]
				targetElement.currentScale -= 0.1
			
				targetContent = targetElement.children()[0].node
				targetContent.width.baseVal.value *= 0.9
				targetContent.height.baseVal.value *= 0.9
			
			
				//targetElement.scale(targetElement.currentScale,0,0)
				message = JSON.stringify(
					[
						"UpdateSize",
						targetNetworkId,
						targetContent.width.baseVal.value,
						targetContent.height.baseVal.value
					]
				)
				socket.send(message)
			}
		},
		pdf: {
			offsetPdfPage: function changePdfPage(button,pageOffset) {
				targetNetworkId = Number(button.parentElement.dataset.networkId)
				targetElement = tableObjects[targetNetworkId]
				targetElement.currentPage += pageOffset
				setPdfPage(targetElement,targetElement.currentPage + pageOffset)
			},
			setPdfPage: function setPdfPage(targetSvg,page) {
				pdfObject = targetSvg.pdfContent
				pdfObject.getPage(page).then(page => 
					{
					var canvas = document.createElement('canvas')
					var viewport = page.getViewport({ scale: 1, });
			
					canvas.width = viewport.width
					canvas.height = viewport.height
			
					var renderCanvasContext = canvas.getContext('2d')
					var renderContext = {
						canvasContext: renderCanvasContext,
						viewport: viewport
					};
					
					page.render(renderContext).promise.then(() => 
						{
							targetSvg.contentImage.load(canvas.toDataURL())
						});
					}
				)
			}
		}
	},
	
}
var socket
function init() {

	chatBox = document.getElementById("chatinput")
	chatLayer = document.getElementById("chatport")
	canvasLayer = SVG('#viewport')
	document.body.addEventListener('mousemove',tableCursorDisplay.updateCursorPosition)
	
	
	if (location.protocol === 'https:') {
		socket = new WebSocket("wss://" + document.domain + ":31443/ws")
	} else {
		socket = new WebSocket("ws://" + document.domain + ":31442/ws")
	}
	 
	socket.onmessage = function (reply) {
		message = JSON.parse(reply.data)
		if (message[0] == "HELO!") {
			message[1].forEach( (cursor) => {
				tableObjectControl.createUserCursor(cursor)
				}
			)
			tableObjectControl.handleNewObjects(message[2])
			setInterval(networking.sendCursorPosition,100)
			return
		}
		lastReply = reply
		if (message[0] == "CursorMove") {
			tableCursorDisplay.setClientCursorPosition(message[1],message[2])
		}
		if (message[0] == "UserJoin") {
			tableObjectControl.createUserCursor(message[1])
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

			tableObjectControl.handleNewObjects([newObject])
		}
		if (message[0] == "DeleteObject") {
			tableObjects[message[1]].node.remove()
			delete tableObjects[message[1]]
		}
		if (message[0] == "ObjectMove") {
			tableObjects[message[1]].children().forEach(e => {e.animate(100,0,'now').ease('>').move(message[2]+e.rx,message[3]+e.ry)} )
		}

		if (message[0] == "UpdateScale") {
			targetContent = tableObjects[message[1]].children()[0].node
			targetContent.width.baseVal.value = message[2]
			targetContent.height.baseVal.value = message[3]
		}

		if (message[0] == "FileList") {
			console.log(message)
			
			fileContainer = document.getElementById('filebox')
			fileContainer.textContent = ""
			message[1].forEach(fileData => {
				newFileIcon = document.querySelector('#FileIcon').content.cloneNode(true)
				newFileIcon.querySelector('.displayname').textContent = fileData.name
				newFileIcon.querySelector('.datecreated').textContent = fileData.timestamp
				newFileIcon.firstElementChild.dataset.id = fileData.id
				fileContainer.appendChild(newFileIcon)
			})
		}
}

	
}


const appHeight = () => document.documentElement.style.setProperty('--app-height', `${window.innerHeight}px`)
window.addEventListener('resize', appHeight)
appHeight()