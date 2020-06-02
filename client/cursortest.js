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

var drawToolState = {
	drawingMode: false,
	currentlyDrawing: false,
	erasingMode: false,
	stroke: { color: '#f06', opacity: 0.6, width: 5 },
	fill: {color: '#00f', opacity: 0},
}

tableObjects = []
pdf = []
userCursors = []

var formCallbacks = {
	nothing: function nothing() {
		 
	},
	loginSuccess: function loginSuccess() {
		$('#loginScreen').modal('hide')
		init()
	},
}

var userInterface = {
	buttons: {
		enableDrawing: document.getElementById("enableDrawing"),
		disableDrawing: document.getElementById("disableDrawing"),
		eraserTool: document.getElementById("eraserTool")
	},
	toggleDrawer: function toggleDrawer(e) {
		var drawer = e.parentElement
		if (drawer.classList.contains("hidden")) {
			drawer.classList.remove("hidden")
			drawer.classList.add("shown")
		} else {
			drawer.classList.remove("shown")
			drawer.classList.add("hidden")
		}
	},
	enableDrawing: function endableDrawing() {
		this.buttons.enableDrawing.classList.add('btn-primary')
		this.buttons.enableDrawing.classList.remove('btn-light')

		this.buttons.disableDrawing.classList.remove('btn-primary')
		this.buttons.disableDrawing.classList.add('btn-light')

		this.buttons.eraserTool.classList.remove('btn-primary')
		this.buttons.eraserTool.classList.add('btn-light')

		drawToolState.drawingMode = true
		drawToolState.erasingMode = false

		document.body.addEventListener('pointermove',userInterface.drawing.drawMove)
		document.body.addEventListener('pointerdown',userInterface.drawing.drawStart)
		document.body.addEventListener('pointerup',userInterface.drawing.drawEnd)
	},
	disableDrawing: function disableDrawing(button) {
		this.buttons.enableDrawing.classList.remove('btn-primary')
		this.buttons.enableDrawing.classList.add('btn-light')

		this.buttons.disableDrawing.classList.add('btn-primary')
		this.buttons.disableDrawing.classList.remove('btn-light')

		this.buttons.eraserTool.classList.remove('btn-primary')
		this.buttons.eraserTool.classList.add('btn-light')
		
		drawToolState.drawingMode = false
		drawToolState.erasingMode = false

		document.body.removeEventListener('pointermove',userInterface.drawing.drawMove)
		document.body.removeEventListener('pointerdown',userInterface.drawing.drawStart)
		document.body.removeEventListener('pointerup',userInterface.drawing.drawEnd)
	},
	eraserTool: function eraserTool(button) {
		this.buttons.enableDrawing.classList.remove('btn-primary')
		this.buttons.enableDrawing.classList.add('btn-light')

		this.buttons.disableDrawing.classList.remove('btn-primary')
		this.buttons.disableDrawing.classList.add('btn-light')

		this.buttons.eraserTool.classList.add('btn-primary')
		this.buttons.eraserTool.classList.remove('btn-light')
		
		drawToolState.drawingMode = false
		drawToolState.erasingMode = true

		document.body.removeEventListener('pointermove',userInterface.drawing.drawMove)
		document.body.removeEventListener('pointerdown',userInterface.drawing.drawStart)
		document.body.removeEventListener('pointerup',userInterface.drawing.drawEnd)

		document.body.addEventListener('pointerdown',userInterface.drawing.erasePolyline)
	},
	updatePermissions() {
		//we have canChat, canTable, canVideo and canAudio and separately adminPermissions
		document.querySelector('#drawer-handle-userSettings').classList.remove('notAllowed')
		if (user.permissions.canTable) {
			document.querySelector('#buttonPanel-tableButtons').classList.remove('notAllowed')
			document.querySelector('#drawer-handle-files').classList.remove('notAllowed')
		} else {
			document.querySelector('#buttonPanel-tableButtons').classList.add('notAllowed')
			document.querySelector('#drawer-handle-files').classList.add('notAllowed')
		}

		if (user.adminPermissions > 0) {
			document.querySelector('#drawer-handle-userList').classList.remove('notAllowed')
		} else {
			document.querySelector('#drawer-handle-userList').classList.add('notAllowed')
		}

		if (user.adminPermissions > 1) {
			document.querySelector('#drawer-handle-roomSettings').classList.remove('notAllowed')
		} else {
			document.querySelector('#drawer-handle-roomSettings').classList.add('notAllowed')
		}
	},
	getTransformedCoordinates: function getTransformedCoordinates(x,y) {
		var m = canvasLayer.node.getScreenCTM();
		var p = canvasLayer.node.createSVGPoint(); 

		p.x = x//event.clientX;
		p.y = y//event.clientY;
		p = p.matrixTransform(m.inverse());
		return {
			x: Math.round(p.x*100)/100,
			y: Math.round(p.y*100)/100
		}
	},
	dragging: {
		dragStart: function dragStart(event) {
			if (user.permissions.canTable && !drawToolState.drawingMode) {
				dragInterval = setInterval(networking.sendDraggablePosition, 50) 
			}
		},
		dragMove: function dragMove(event) {
			event.preventDefault()
			if (user.permissions.canTable && !drawToolState.drawingMode && !drawToolState.erasingMode) {
				const { handler, box, el } = event.detail
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
			}
		},
		dragEnd: function dragEnd(event) {
			if (user.permissions.canTable && !drawToolState.drawingMode) {
				clearInterval(dragInterval) 
			}
		}
	}
	,
	drawing: {
		drawMove: makeThrottled(25,function drawMove(event) {
			if (drawToolState.currentlyDrawing) {
				let p = userInterface.getTransformedCoordinates(event.clientX,event.clientY)
				let c = { //constrained coordinates
					x: clamp(p.x,drawToolState.constraints.x_min,drawToolState.constraints.x_max),
					y: clamp(p.y,drawToolState.constraints.y_min,drawToolState.constraints.y_max)
				}
				let pointArray = drawToolState.newSvg.array()
				pointArray.push([c.x,c.y])
				drawToolState.newSvg.plot(pointArray)
			}
		}),
		drawStart: function drawStart(event) {
			 
			if (drawToolState.drawingMode && user.permissions.canTable) {
				let drawingTarget = event.target.instance.parent().drawingCanvas
				if (drawingTarget) {
					drawToolState.target = drawingTarget
					
					let currentMouse = userInterface.getTransformedCoordinates(event.clientX,event.clientY)
					drawToolState.newSvg = drawingTarget.polyline([currentMouse])

					if (drawingTarget.parent().paged) {
						drawToolState.newSvg.attr({page: drawingTarget.parent().currentPage})
					}
					drawToolState.newSvg.fill(drawToolState.fill)
					drawToolState.newSvg.stroke(drawToolState.stroke)

					let rbox = drawToolState.target.parent().bbox()

					drawToolState.constraints = {
						x_min: rbox.x,
						y_min: rbox.y,
						x_max: rbox.x+rbox.w,
						y_max: rbox.y+rbox.h, 
					}

					drawToolState.currentlyDrawing = true
				}
			}
		},
		drawEnd: function drawEnd(event) {
			//drawToolState.newSvg.node.style.cssText = "pointer-events: none;"
			 

			

			let parray = drawToolState.newSvg.array()
			let reverse = parray.slice().reverse()
			let longarray = parray.concat(reverse)
			drawToolState.newSvg.plot(longarray)
			parray.forEach((point) => {
				point[0] -= drawToolState.target.x()
				point[1] -= drawToolState.target.y()
			})
			drawToolState.newSvg.erasable = true


			let eraseId = makeid(16)
			message = JSON.stringify([
				'Drawing',
				drawToolState.target.parent().networkId,
				parray,
				drawToolState.fill,
				drawToolState.stroke,
				drawToolState.target.parent().paged ? drawToolState.newSvg.attr().page : 0,
				eraseId
			])
			drawToolState.newSvg.attr({eraseId: eraseId})
			socket.send(message)
			
			delete drawToolState.target
			delete drawToolState.newSvg
			drawToolState.currentlyDrawing = false
		},
		erasePolyline: function erasePolyline(event) {
			let target = event.target.instance
			if (target.erasable) {
				let targetOwner = target.parents()[1]
				let targetOwnerNetworkId = targetOwner.networkId
				let targetEraseId = target.attr().eraseId
				let message = JSON.stringify([
					'EraseDrawing',
					targetOwnerNetworkId,
					targetEraseId,
				])
				socket.send(message)
				target.remove()
			}
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
	parseBooleanString: function parseBooleanString(string) {
		if (string == "true") {
			return true
		} else {
			return false
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

	requestUsers: function requestUsers() {
		target = document.getElementById('userbox-table')
		target.innerHTML = `<tr> <td> Загрузка... <td> </tr>`
		$.get("/api/userlist",result => {
			target.innerHTML = ""
			result.data.forEach(user => (
				target.innerHTML += `
					<tr data-toggle="modal" data-target="#controlUser" data-displayname="${user.displayName}" data-uid="${user.id}">
						<th scope="row"> ${user.permissionLevel} </th>
						<td> ${user.displayName} </td>
						<td> ${user.group}</td>
					</tr>
				`
			))
		})
	},

	requestObjectCreation: function requestObjectCreation(e) {
		message = JSON.stringify(
			[
				"CreateObject",
				Number(e.dataset.id)
			]
		)
		socket.send(message)
	},

	populateGroupSelect: function populateGroupSelect(targetId) {
		target = document.getElementById(targetId)
		target.innerHTML = `<option value=1>Загрузка...</option>`
		$.get("/api/grouplist",result => {
			target.innerHTML = ""
			result.data.forEach(group => (
				target.innerHTML += `<option value="${group.id}">${group.displayName}</option>`
			))
		})
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
			if (object) {
				newSvg = canvasLayer.group()
				newSvg.move(object.x,object.y)
				newSvg.currentPage = 1
				newSvg.pageCount = 1
				newSvg.pageCanvasPool = []

				newSvg.pageCanvasPool[1] = newSvg.group()
				newSvg.pageCanvasPool[1].polyline([[object.x,object.y]]).attr({anchor: 1}) //грязный костыль - придаём сущность пустой группе
				newSvg.pageCanvasPool[1].rx = 0
				newSvg.pageCanvasPool[1].ry = 0
				newSvg.drawingCanvas = newSvg.pageCanvasPool[1]

				newSvg.currentScale = object.currentScale
				newSvg.contentType = object.type

				
				if (object.type == "picture") {
					image = newSvg.image(object.filename)
					image.back()
					image.move(object.x,object.y)
					if (object.displayWidth) {
						image.width(object.displayWidth)
						image.height(object.displayHeight)
					}

					image.rx = 0
					image.ry = 0
				}
		
				if (object.type == "pdf") {
					
					newSvg.paged = true
					newSvg.contentImage = newSvg.image()
					newSvg.contentImage.move(object.x,object.y)
					newSvg.contentImage.rx = 0
					newSvg.contentImage.ry = 0
					newSvg.currentPage = object.currentPage

					newSvg.preloader = newSvg.image('data:image/svg+xml,%3Csvg xmlns:svg="http://www.w3.org/2000/svg" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.0" width="64px" height="64px" viewBox="0 0 128 128" xml:space="preserve"%3E%3Cg%3E%3Cpath d="M75.4 126.63a11.43 11.43 0 0 1-2.1-22.65 40.9 40.9 0 0 0 30.5-30.6 11.4 11.4 0 1 1 22.27 4.87h.02a63.77 63.77 0 0 1-47.8 48.05v-.02a11.38 11.38 0 0 1-2.93.37z" fill="%23213ded" fill-opacity="1"/%3E%3CanimateTransform attributeName="transform" type="rotate" from="0 64 64" to="360 64 64" dur="400ms" repeatCount="indefinite"%3E%3C/animateTransform%3E%3C/g%3E%3C/svg%3E')
					newSvg.preloader.move(object.x,object.y)
					newSvg.preloader.rx = 0
					newSvg.preloader.ry = 0

					newSvg.preloader.show()
					
					
					pdfLoader = pdfjsLib.getDocument(object.filename)
					newSvg.loaderPromise = pdfLoader.promise
		
					newSvg.loaderPromise.then(function (pdfObject) {
						this.pdfContent = pdfObject
						this.pageCount = pdfObject.numPages
						for(i = 2; i<=this.pageCount; i+=1) {
							if (!newSvg.pageCanvasPool[i]) {
								tableObjectControl.prepareSvgCanvas(this,i,object.x,object.y)
							}
						}
						this.drawingCanvas = this.pageCanvasPool[1]
						tableObjectControl.interactionUI.pdf.setPdfPage(newSvg,newSvg.currentPage)
						this.contentImage.back()
					}.bind(newSvg))
					
				}
		
				
				newSvg.dblclick(tableObjectControl.interactionUI.show)
				
				tableObjectControl.makeSyncDraggable(newSvg)
		
				newSvg.node.dataset.networkId = object.networkId
				newSvg.networkId = object.networkId
				tableObjects[object.networkId] = newSvg

				newSvg.interactionUI = tableObjectControl.interactionUI.create(newSvg)
				newSvg.interactionUI.front()
				
				
			}
		})
	},
	prepareSvgCanvas: function prepareSvgCanvas(target,pageNumber,anchor_x,anchor_y) {
		target.pageCanvasPool[pageNumber] = newSvg.group()
		target.pageCanvasPool[pageNumber].polyline([[anchor_x,anchor_y]]).attr({anchor: 1}) //грязный костыль - придаём сущность пустой группе
		target.pageCanvasPool[pageNumber].rx = 0
		target.pageCanvasPool[pageNumber].ry = 0
	},
	handleNewDrawings: function handleNewDrawings(drawingContainerList) {
		drawingContainerList.forEach(drawing => {
			if (drawing) {
				let relatedTableObject = tableObjects[drawing.relatedNetworkId]
				if (relatedTableObject) {
					let targetObject = tableObjects[drawing.relatedNetworkId]
					let targetCanvasPool = targetObject.pageCanvasPool
					let targetCanvas = targetCanvasPool[drawing.relatedPage]
					if (!targetCanvas) {
						tableObjectControl.prepareSvgCanvas(targetObject,drawing.relatedPage,targetObject.x(),targetObject.y())
						targetCanvas = targetCanvasPool[drawing.relatedPage]
					}
					let newPolyline = targetCanvas.polyline()
				
					let parray = drawing.points
					let anchor = relatedTableObject.drawingCanvas.children()[0]
					parray.forEach(point => {
						point[0] += anchor.x()
						point[1] += anchor.y()
					})
					let reverse = parray.slice().reverse()
					let longarray = parray.concat(reverse)
					
					newPolyline.plot(longarray)
					newPolyline.stroke(drawing.stroke)
					newPolyline.fill(drawing.fill)
					newPolyline.erasable = true
					newPolyline.attr({page: drawing.relatedPage, eraseId: drawing.eraseId})
				}
			} else {
				tableObjects[drawing.relatedNetworkId].drawingCanvas.polyline([0,0])
			}
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
		newSvg.draggable().on("dragstart",userInterface.dragging.dragStart)
		newSvg.on("dragend", userInterface.dragging.dragEnd)
		let throttledDragMove = makeThrottled(5,userInterface.dragging.dragMove)
		newSvg.on("dragmove", e => {e.preventDefault(); throttledDragMove(e)} )
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
		
			 
		
			return interactionUI
		},
		show: function showInteractionUI() {
			this.interactionUI.animate(200,0,'now').ease('<').attr({width: 200, height: 180})
		},
		hide: function hideInteractionUI(target) {
			tableObjects[target.parentElement.dataset.networkId].interactionUI.animate(200,0,'now').ease('<').attr({width: 0, height: 0})
		},
		common: {
			buttonDeleteObject: function buttonDeleteObject(button) {
				message = JSON.stringify(
					[
						"DeleteObject",
						button.parentElement.parentElement.dataset.networkId
					]
				)
				socket.send(message)
			},

			buttonScaleUp: function buttonScaleUp(button) {
				targetNetworkId = Number(button.parentElement.parentElement.dataset.networkId)
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
				targetNetworkId = Number(button.parentElement.parentElement.dataset.networkId)
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
				let targetNetworkId = Number(button.parentElement.parentElement.dataset.networkId)
				let targetElement = tableObjects[targetNetworkId]
				targetElement.currentPage += pageOffset
				tableObjectControl.interactionUI.pdf.setPdfPage(targetElement,targetElement.currentPage)
				let message = JSON.stringify([
					'SetPdfPage',
					targetNetworkId,
					targetElement.currentPage
				])
				socket.send(message)
			},
			setPdfPage: function setPdfPage(targetSvg,pageNumber) {
				pdfObject = targetSvg.pdfContent
				targetSvg.preloader.show()
				pdfObject.getPage(pageNumber).then(page => 
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
							targetSvg.preloader.hide()
							targetSvg.contentImage.load(canvas.toDataURL())
							targetSvg.pageCanvasPool.forEach(svgCanvas => {
								svgCanvas.node.style.cssText = "visibility: hidden"
							})
							targetSvg.drawingCanvas = targetSvg.pageCanvasPool[pageNumber]
							targetSvg.drawingCanvas.node.style.cssText = "visibility: visible"
						});
					}
				)
			}
		}
	},
	
}
var socket
var user = {}
function init() {

	chatBox = document.getElementById("chatinput")
	chatLayer = document.getElementById("chatport")
	canvasLayer = SVG('#viewport')
	document.body.addEventListener('mousemove',tableCursorDisplay.updateCursorPosition)
	
	
	if (location.protocol === 'https:') {
		socket = new WebSocket("wss://" + document.domain + ":31449/ws")
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
			user.displayName = message[3]
			user.color = message[4]
			user.permissions = message[5]
			user.adminPermissions = message[6]
			userInterface.updatePermissions()
			tableObjectControl.handleNewObjects(message[2])
			message[7].forEach(drawingSet => {
				tableObjectControl.handleNewDrawings(drawingSet)
			})
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
			console.log('Got a message')
			chatLayer.innerHTML = chatLayer.innerHTML + `<div class="chat-message"> <span style="color:${message[3]}"> [${message[2]}]</span>: ${message[1]} </div>`
			chatLayer.scrollTop = chatLayer.scrollHeight
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

		if (message[0] == "Drawing") {
			tableObjectControl.handleNewDrawings([message[2]])
		}

		if (message[0] == "EraseDrawing") {
			tableObjects[message[1]].pageCanvasPool.forEach(drawingCanvas => {
				drawingCanvas.children().forEach(drawing => {
					if (drawing.attr().eraseId == message[2]) {
						drawing.remove()
					}
				})
			})
		}

		if (message[0] == "SetPdfPage") {
			console.log('Remote PDF page changed')
			tableObjectControl.interactionUI.pdf.setPdfPage(tableObjects[message[1]],message[2])
		}
}

	
}


const appHeight = () => document.documentElement.style.setProperty('--app-height', `${window.innerHeight}px`)
window.addEventListener('resize', appHeight)
appHeight()

function makeThrottled(delay, fn) {
	let lastCall = 0;
	return function (...args) {
		const now = (new Date).getTime();
		if (now - lastCall < delay) {
		return;
		}
		lastCall = now;
		return fn(...args);
	}
}
function clamp(val, min, max) {
    return val > max ? max : val < min ? min : val;
}

function makeid(length) {
	var result           = '';
	var characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	var charactersLength = characters.length;
	for ( var i = 0; i < length; i++ ) {
	   result += characters.charAt(Math.floor(Math.random() * charactersLength));
	}
	return result;
 }